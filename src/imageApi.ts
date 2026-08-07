import type { ModelCapability } from './store'

export type ApiRequestSettings = {
  baseUrl: string
  apiKey: string
  model: string
}

export type RemoteModel = {
  id: string
  name: string
  capability: ModelCapability
}

export type GeneratedImage = {
  url: string
  revisedPrompt?: string
}

export type GenerationErrorCategory = 'api' | 'network' | 'platform'

export class GenerationRequestError extends Error {
  category: GenerationErrorCategory
  detail: string
  status?: number
  code?: string
  requestId?: string

  constructor(category: GenerationErrorCategory, message: string, detail: string, metadata?: { status?: number; code?: string; requestId?: string }) {
    super(message)
    this.name = 'GenerationRequestError'
    this.category = category
    this.detail = detail
    this.status = metadata?.status
    this.code = metadata?.code
    this.requestId = metadata?.requestId
  }
}

function endpoint(baseUrl: string, path: string) {
  return `${baseUrl.trim().replace(/\/$/, '')}/${path.replace(/^\//, '')}`
}

async function readError(response: Response) {
  try {
    const payload = await response.json() as { error?: { message?: string } | string; message?: string }
    if (typeof payload.error === 'string') return payload.error
    return payload.error?.message || payload.message || `请求失败（${response.status}）`
  } catch {
    return `请求失败（${response.status}）`
  }
}

function apiErrorSummary(status: number) {
  if (status === 400 || status === 422) return '当前模型不接受这组生成参数'
  if (status === 401) return 'API Key 无效或已经过期'
  if (status === 403) return '当前账号没有使用这个模型的权限'
  if (status === 404) return '接口地址或模型不存在'
  if (status === 408) return 'API 请求超时了'
  if (status === 429) return '请求太频繁，或者账号额度不足'
  if (status >= 500) return 'API 服务暂时不可用'
  return 'API 服务拒绝了这次请求'
}

async function createApiError(response: Response) {
  const detail = await readError(response)
  return new GenerationRequestError('api', apiErrorSummary(response.status), detail, {
    status: response.status,
    requestId: response.headers.get('x-request-id') ?? undefined,
  })
}

function createNetworkError(error: unknown) {
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  return new GenerationRequestError('network', '没有连接到 API 服务，请检查网络、接口地址或跨域设置', detail)
}

export function normalizeGenerationError(error: unknown) {
  if (error instanceof GenerationRequestError) return error
  if (error instanceof TypeError && /fetch|network|load|cors/i.test(error.message)) return createNetworkError(error)
  const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
  if (error instanceof Error && /没有返回图片|没有返回图像/.test(error.message)) {
    return new GenerationRequestError('platform', '模型没有返回图像', detail)
  }
  return new GenerationRequestError('platform', 'Disy 处理生成结果时遇到了问题', detail)
}

export function inferModelCapability(modelId: string): ModelCapability {
  if (/image|seedream|imagen|flux|banana|dall-e|gpt-image/i.test(modelId)) return 'image'
  if (/video|seedance|sora|veo|kling|runway|hailuo/i.test(modelId)) return 'video'
  if (/tts|speech|audio|voice|whisper/i.test(modelId)) return 'audio'
  return 'text'
}

function readDeclaredCapability(item: Record<string, unknown>, modelId: string): ModelCapability {
  const declared = [item.capability, item.type, item.task, item.mode, item.modalities]
    .flatMap((value) => Array.isArray(value) ? value : [value])
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .toLowerCase()
  if (/image|vision-generation|text-to-image/.test(declared)) return 'image'
  if (/video|text-to-video|image-to-video/.test(declared)) return 'video'
  if (/audio|speech|voice|tts|whisper/.test(declared)) return 'audio'
  if (/text|chat|completion|language/.test(declared)) return 'text'
  return inferModelCapability(modelId)
}

export async function fetchRemoteModels(settings: Pick<ApiRequestSettings, 'baseUrl' | 'apiKey'>): Promise<RemoteModel[]> {
  const response = await fetch(endpoint(settings.baseUrl, 'models'), {
    headers: { Authorization: `Bearer ${settings.apiKey}` },
  })
  if (!response.ok) throw new Error(await readError(response))
  const payload = await response.json() as unknown
  const container = payload && typeof payload === 'object' ? payload as { data?: unknown[]; models?: unknown[] } : {}
  const rows = Array.isArray(payload) ? payload : container.data ?? container.models ?? []
  const models = rows
    .map((model) => {
      if (typeof model === 'string') return { id: model.trim(), name: model.trim(), capability: inferModelCapability(model) }
      if (!model || typeof model !== 'object') return { id: '', name: '', capability: 'text' as const }
      const item = model as Record<string, unknown>
      const id = String(item.id ?? item.model ?? item.model_id ?? '').trim()
      const name = String(item.name ?? item.display_name ?? item.displayName ?? id).trim()
      return { id, name, capability: readDeclaredCapability(item, id) }
    })
    .filter((model) => model.id)
  return Array.from(new Map(models.map((model) => [model.id, model])).values())
    .sort((left, right) => left.name.localeCompare(right.name))
}

export async function generateRemoteImages(
  settings: ApiRequestSettings,
  options: {
    prompt: string
    count: number
    referenceImages?: string[]
    aspectRatio?: string
    resolution?: '1K' | '2K' | '4K'
    detail?: 'low' | 'medium' | 'high'
  },
): Promise<GeneratedImage[]> {
  const compatibleSize = (() => {
    const [width, height] = String(options.aspectRatio ?? '1:1').split(':').map(Number)
    if (!Number.isFinite(width) || !Number.isFinite(height) || height === 0) return '1024x1024'
    const ratio = width / height
    if (ratio > 1.15) return '1536x1024'
    if (ratio < 0.87) return '1024x1536'
    return '1024x1024'
  })()
  const body: Record<string, unknown> = {
    model: settings.model,
    prompt: options.prompt,
    n: options.count,
    size: compatibleSize,
  }
  if (options.aspectRatio && options.aspectRatio !== 'auto') body.aspect_ratio = options.aspectRatio
  if (options.resolution) body.resolution = options.resolution
  if (options.detail) body.quality = options.detail
  if (!/gpt-image/i.test(settings.model)) body.response_format = 'url'
  if (options.referenceImages?.length) body.image_urls = options.referenceImages

  let response: Response
  try {
    response = await fetch(endpoint(settings.baseUrl, 'images/generations'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })
  } catch (error) {
    throw createNetworkError(error)
  }
  // Paid generation requests are never retried or split automatically. A rejected
  // batch stops here so one click can produce at most one billable API request.
  if (!response.ok) throw await createApiError(response)
  let payload: unknown
  try {
    payload = await response.json()
  } catch (error) {
    throw new GenerationRequestError('platform', 'API 返回了无法识别的数据', error instanceof Error ? error.message : String(error))
  }
  type ImageRow = { url: string; revisedPrompt?: string }
  const rows: ImageRow[] = []
  const visited = new WeakSet<object>()
  const normalizeImageValue = (value: unknown) => {
    if (typeof value !== 'string') return ''
    const candidate = value.trim()
    if (/^(?:https?:|blob:|data:image\/)/i.test(candidate)) return candidate
    if (candidate.length > 128 && /^[A-Za-z0-9+/=\r\n]+$/.test(candidate)) return `data:image/png;base64,${candidate.replace(/\s/g, '')}`
    return ''
  }
  const pushImage = (value: unknown, revisedPrompt?: unknown) => {
    const url = normalizeImageValue(value)
    if (!url) return false
    rows.push({
      url,
      revisedPrompt: typeof revisedPrompt === 'string' ? revisedPrompt : undefined,
    })
    return true
  }
  const visit = (value: unknown, depth = 0) => {
    if (depth > 12 || value == null) return
    if (typeof value === 'string') {
      pushImage(value)
      return
    }
    if (Array.isArray(value)) {
      value.forEach((item) => visit(item, depth + 1))
      return
    }
    if (typeof value !== 'object') return
    if (visited.has(value)) return
    visited.add(value)
    const record = value as Record<string, unknown>
    const revisedPrompt = record.revised_prompt ?? record.revisedPrompt
    for (const key of ['url', 'image_url', 'b64_json', 'b64', 'base64']) {
      if (pushImage(record[key], revisedPrompt)) break
    }
    ;['data', 'images', 'image', 'urls', 'output', 'outputs', 'result', 'results', 'artifacts', 'content'].forEach((key) => {
      if (key in record) visit(record[key], depth + 1)
    })
  }
  visit(payload)
  // Preserve response order and cardinality. Some gateways intentionally reuse the
  // same proxy URL for separate batch items, so URL-based deduplication can lose images.
  return rows
}

export async function generateRemoteText(settings: ApiRequestSettings, prompt: string) {
  let response: Response
  try {
    response = await fetch(endpoint(settings.baseUrl, 'chat/completions'), {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: prompt }],
        stream: false,
      }),
    })
  } catch (error) {
    throw createNetworkError(error)
  }
  if (!response.ok) throw await createApiError(response)
  let payload: {
    choices?: Array<{ message?: { content?: string }; text?: string }>
    output_text?: string
    text?: string
  }
  try {
    payload = await response.json() as typeof payload
  } catch (error) {
    throw new GenerationRequestError('platform', 'API 返回了无法识别的数据', error instanceof Error ? error.message : String(error))
  }
  const content = payload.choices?.[0]?.message?.content
    ?? payload.choices?.[0]?.text
    ?? payload.output_text
    ?? payload.text
    ?? ''
  if (!content.trim()) throw new GenerationRequestError('platform', '模型没有返回文本内容', '接口请求成功，但响应中没有可用的文本字段。')
  return content.trim()
}
