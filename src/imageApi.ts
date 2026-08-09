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

export type GenerationAdminLog = {
  provider: string
  taskId?: string
  model: string
  startedAt: string
  finishedAt: string
  durationMs: number
  resultType: 'success' | 'failed'
  requestJson: string
  resultJson: string
  /** Recoverable image/result URLs kept outside sanitized JSON (http kept in full). */
  resultUrls?: string[]
  kind?: 'image' | 'text'
}

export type TextGenerationOptions = {
  referenceImages?: string[]
  signal?: AbortSignal
  captureAdminLog?: (log: GenerationAdminLog) => void
}

export type ImageGenerationOptions = {
  prompt: string
  count: number
  referenceImages?: string[]
  aspectRatio?: string
  resolution?: '1K' | '2K' | '4K'
  detail?: 'low' | 'medium' | 'high'
  signal?: AbortSignal
  /** Captures a sanitized request/result snapshot for admin recovery logs. */
  captureAdminLog?: (log: GenerationAdminLog) => void
}

const REFERENCE_IMAGE_TARGET_BYTES = 1_800_000
const REFERENCE_IMAGE_READ_TIMEOUT_MS = 20_000
const GRSAI_IMAGE_POLL_INTERVAL_MS = 2_500
const GRSAI_IMAGE_POLL_TIMEOUT_MS = 15 * 60_000
const GRSAI_MAX_CONSECUTIVE_POLL_ERRORS = 24

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('参考图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => blob ? resolve(blob) : reject(new Error('参考图片压缩失败')),
      type,
      quality,
    )
  })
}

export async function prepareReferenceImageForRequest(source: string, signal?: AbortSignal): Promise<string> {
  if (signal?.aborted) throw new DOMException('Generation interrupted', 'AbortError')
  const trimmedSource = source.trim()
  if (!trimmedSource || !/^(?:https?:|blob:|data:image\/)/i.test(trimmedSource)) return trimmedSource

  let sourceBlob: Blob
  const referenceController = new AbortController()
  const abortReferenceRead = () => referenceController.abort()
  signal?.addEventListener('abort', abortReferenceRead, { once: true })
  const referenceTimeout = window.setTimeout(() => referenceController.abort(), REFERENCE_IMAGE_READ_TIMEOUT_MS)
  try {
    const response = await fetch(trimmedSource, { signal: referenceController.signal })
    if (!response.ok) throw new Error(`图片读取失败（${response.status}）`)
    sourceBlob = await response.blob()
  } catch (error) {
    if (signal?.aborted) throw new DOMException('Generation interrupted', 'AbortError')
    throw new GenerationRequestError(
      'platform',
      error instanceof DOMException && error.name === 'AbortError' ? '参考图片读取超时' : '参考图片无法读取',
      `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}。本次付费生成请求尚未发送。`,
    )
  } finally {
    window.clearTimeout(referenceTimeout)
    signal?.removeEventListener('abort', abortReferenceRead)
  }

  if (!sourceBlob.type.startsWith('image/')) {
    throw new GenerationRequestError('platform', '参考图片格式无法识别', `收到的文件类型为 ${sourceBlob.type || 'unknown'}`)
  }

  const isSupportedEditFormat = /^image\/(?:png|jpe?g|webp)$/i.test(sourceBlob.type)
  // Remote and blob URLs are converted to stable request data. Unsupported
  // formats are always re-encoded while preserving their exact pixel dimensions.
  if (isSupportedEditFormat && sourceBlob.size <= REFERENCE_IMAGE_TARGET_BYTES) {
    return /^data:image\//i.test(trimmedSource) ? trimmedSource : blobToDataUrl(sourceBlob)
  }

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(sourceBlob)
  } catch (error) {
    throw new GenerationRequestError(
      'platform',
      '参考图片无法解码',
      error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    )
  }

  try {
    if (signal?.aborted) throw new DOMException('Generation interrupted', 'AbortError')
    const canvas = document.createElement('canvas')
    // Preserve the exact pixel dimensions. Only encoded file size is reduced.
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法创建图片压缩画布')
    context.drawImage(bitmap, 0, 0, bitmap.width, bitmap.height)

    let compressed: Blob | null = isSupportedEditFormat ? sourceBlob : null
    for (const quality of [0.88, 0.78, 0.68, 0.58]) {
      if (signal?.aborted) throw new DOMException('Generation interrupted', 'AbortError')
      const candidate = await canvasToBlob(canvas, 'image/webp', quality)
      if (!compressed || candidate.size < compressed.size) compressed = candidate
      if (candidate.size <= REFERENCE_IMAGE_TARGET_BYTES) {
        compressed = candidate
        break
      }
    }
    if (!compressed) throw new Error('参考图片转码失败')
    return blobToDataUrl(compressed)
  } finally {
    bitmap.close()
  }
}

export type GenerationErrorCategory = 'api' | 'network' | 'platform'

export class GenerationRequestError extends Error {
  category: GenerationErrorCategory
  detail: string
  status?: number
  code?: string
  requestId?: string
  adminLog?: GenerationAdminLog

  constructor(
    category: GenerationErrorCategory,
    message: string,
    detail: string,
    metadata?: { status?: number; code?: string; requestId?: string; adminLog?: GenerationAdminLog },
  ) {
    super(message)
    this.name = 'GenerationRequestError'
    this.category = category
    this.detail = detail
    this.status = metadata?.status
    this.code = metadata?.code
    this.requestId = metadata?.requestId
    this.adminLog = metadata?.adminLog
  }
}

function sanitizeAdminLogValue(value: unknown, depth = 0): unknown {
  if (depth > 10) return '[…]'
  if (typeof value === 'string') {
    if (/^data:image\//i.test(value) || (value.length > 240 && /^[A-Za-z0-9+/=\s]+$/.test(value.slice(0, 120)))) {
      return `base64 image… (${value.length} chars)`
    }
    if (value.length > 6_000) return `${value.slice(0, 6_000)}…`
    return value
  }
  if (Array.isArray(value)) return value.slice(0, 40).map((item) => sanitizeAdminLogValue(item, depth + 1))
  if (!value || typeof value !== 'object') return value
  const output: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>).slice(0, 80)) {
    output[key] = sanitizeAdminLogValue(child, depth + 1)
  }
  return output
}

export function sanitizeAdminLogJson(value: unknown) {
  try {
    return JSON.stringify(sanitizeAdminLogValue(value), null, 0)
  } catch {
    return String(value)
  }
}

export function extractImageUrlsFromAdminResult(resultJson: string): string[] {
  try {
    return extractGeneratedImages(JSON.parse(resultJson) as unknown).map((image) => image.url)
  } catch {
    return []
  }
}

function normalizedApiBaseUrl(baseUrl: string) {
  const trimmed = baseUrl.trim().replace(/\/$/, '')
  if (/\.apifox\.cn(?:\/|$)/i.test(trimmed)) {
    throw new Error('这里填写的是 Apifox 文档地址。GRS AI 请使用 https://grsaiapi.com/v1 或 https://grsai.dakka.com.cn/v1')
  }
  if (/^https:\/\/(?:grsaiapi\.com|grsai\.dakka\.com\.cn)$/i.test(trimmed)) return `${trimmed}/v1`
  return trimmed
}

function endpoint(baseUrl: string, path: string) {
  return `${normalizedApiBaseUrl(baseUrl)}/${path.replace(/^\//, '')}`
}

function isGrsaiBaseUrl(baseUrl: string) {
  return /^https?:\/\/(?:grsaiapi\.com|grsai\.dakka\.com\.cn)(?:\/|$)/i.test(normalizedApiBaseUrl(baseUrl))
}

export function resolveProviderLabel(baseUrl: string) {
  const normalized = normalizedApiBaseUrl(baseUrl).toLowerCase()
  if (/grsaiapi\.com|grsai\.dakka\.com\.cn/.test(normalized)) return 'GRS AI'
  if (/api\.apiyi\.com|apiyi\.com/.test(normalized)) return 'APIYI'
  if (/gptgod\.online|gptgod\.com/.test(normalized)) return 'GPTGod'
  if (/api\.openai\.com/.test(normalized)) return 'OpenAI'
  if (/api\.siliconflow\.cn|siliconflow/.test(normalized)) return '硅基流动'
  if (/api\.deepseek\.com/.test(normalized)) return 'DeepSeek'
  try {
    return new URL(normalized).hostname.replace(/^www\./, '') || 'Custom API'
  } catch {
    return 'Custom API'
  }
}

function extractTaskId(payload: unknown) {
  if (!payload || typeof payload !== 'object') return ''
  const record = payload as Record<string, unknown>
  const nested = record.data && typeof record.data === 'object' && !Array.isArray(record.data)
    ? record.data as Record<string, unknown>
    : null
  return String(
    record.id
    ?? record.taskId
    ?? record.task_id
    ?? record.request_id
    ?? record.requestId
    ?? nested?.id
    ?? nested?.taskId
    ?? nested?.task_id
    ?? '',
  ).trim()
}

function collectRecoverableResultUrls(payload: unknown) {
  return extractGeneratedImages(payload)
    .map((image) => image.url)
    .filter((url) => {
      if (/^https?:\/\//i.test(url)) return true
      // Keep small embedded results so admins can still recover when CDN URLs are absent.
      return /^data:image\//i.test(url) && url.length <= 350_000
    })
}

function waitForDelay(delay: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    if (signal?.aborted) {
      reject(new DOMException('Generation interrupted', 'AbortError'))
      return
    }
    const timer = window.setTimeout(() => {
      signal?.removeEventListener('abort', abort)
      resolve()
    }, delay)
    const abort = () => {
      window.clearTimeout(timer)
      reject(new DOMException('Generation interrupted', 'AbortError'))
    }
    signal?.addEventListener('abort', abort, { once: true })
  })
}

function grsaiFallbackModels(baseUrl: string): RemoteModel[] | null {
  if (!/^https?:\/\/(?:grsaiapi\.com|grsai\.dakka\.com\.cn)(?:\/|$)/i.test(baseUrl)) return null
  return [
    { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', capability: 'text' },
    { id: 'gpt-5.4', name: 'GPT 5.4', capability: 'text' },
    { id: 'gpt-5.5', name: 'GPT 5.5', capability: 'text' },
    { id: 'nano-banana-pro', name: 'Nano Banana Pro', capability: 'image' },
    { id: 'nano-banana-2-lite', name: 'Nano Banana 2 Lite', capability: 'image' },
    { id: 'nano-banana-2', name: 'Nano Banana 2', capability: 'image' },
    { id: 'nano-banana-fast', name: 'Nano Banana Fast', capability: 'image' },
    { id: 'gpt-image-2-vip', name: 'GPT Image 2 VIP', capability: 'image' },
    { id: 'gpt-image-2', name: 'GPT Image 2', capability: 'image' },
    { id: 'veo3', name: 'Veo 3', capability: 'video' },
  ]
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
  const fallbackModels = grsaiFallbackModels(normalizedApiBaseUrl(settings.baseUrl))
  let response: Response
  try {
    response = await fetch(endpoint(settings.baseUrl, 'models'), {
      headers: { Authorization: `Bearer ${settings.apiKey}` },
    })
  } catch (error) {
    if (fallbackModels) return fallbackModels
    throw error
  }
  if (!response.ok) {
    if (fallbackModels) return fallbackModels
    throw new Error(await readError(response))
  }
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
  return Array.from(new Map([...models, ...(fallbackModels ?? [])].map((model) => [model.id, model])).values())
    .sort((left, right) => left.name.localeCompare(right.name))
}

function extractGeneratedImages(payload: unknown): GeneratedImage[] {
  const rows: GeneratedImage[] = []
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
  return rows
}

async function resolveGrsaiImageResult(
  settings: ApiRequestSettings,
  initialPayload: unknown,
  signal?: AbortSignal,
) {
  const initial = initialPayload && typeof initialPayload === 'object'
    ? initialPayload as Record<string, unknown>
    : {}
  const taskId = String(initial.id ?? initial.taskId ?? initial.task_id ?? '').trim()
  const initialStatus = String(initial.status ?? '').toLowerCase()
  if (extractGeneratedImages(initialPayload).length) return initialPayload
  if (/^(?:failed|failure|violation|cancelled|canceled)$/.test(initialStatus)) {
    throw new GenerationRequestError(
      'api',
      initialStatus === 'violation' ? '图片生成未通过内容审核' : 'GRS AI 图像任务生成失败',
      String(initial.error ?? initial.message ?? `任务状态：${initialStatus}`),
      { requestId: taskId || undefined },
    )
  }
  if (!taskId) return initialPayload

  const startedAt = Date.now()
  let consecutiveErrors = 0
  let succeededWithoutResultCount = 0
  while (Date.now() - startedAt < GRSAI_IMAGE_POLL_TIMEOUT_MS) {
    await waitForDelay(GRSAI_IMAGE_POLL_INTERVAL_MS, signal)
    let response: Response
    try {
      response = await fetch(`${endpoint(settings.baseUrl, 'api/result')}?id=${encodeURIComponent(taskId)}`, {
        signal,
        headers: { Authorization: `Bearer ${settings.apiKey}` },
      })
      if (!response.ok) {
        const errorPayload = await response.clone().json().catch(() => null) as Record<string, unknown> | null
        const nestedError = errorPayload?.data && typeof errorPayload.data === 'object'
          ? errorPayload.data as Record<string, unknown>
          : null
        const errorRecord = nestedError ?? errorPayload
        const errorStatus = String(errorRecord?.status ?? '').toLowerCase()
        if (/^(?:failed|failure|violation|cancelled|canceled)$/.test(errorStatus)) {
          throw new GenerationRequestError(
            'api',
            errorStatus === 'violation' ? '图片生成未通过内容审核' : 'GRS AI 图像任务生成失败',
            String(errorRecord?.error ?? errorRecord?.message ?? `任务状态：${errorStatus}`),
            { requestId: taskId },
          )
        }
        if (response.status === 401 || response.status === 403) throw await createApiError(response)
        throw new Error(`结果查询失败（${response.status}）`)
      }
      const payload = await response.json() as unknown
      consecutiveErrors = 0
      const images = extractGeneratedImages(payload)
      if (images.length) return payload
      const record = payload && typeof payload === 'object' ? payload as Record<string, unknown> : {}
      const status = String(record.status ?? '').toLowerCase()
      if (/^(?:failed|failure|violation|cancelled|canceled)$/.test(status)) {
        throw new GenerationRequestError(
          'api',
          status === 'violation' ? '图片生成未通过内容审核' : 'GRS AI 图像任务生成失败',
          String(record.error ?? record.message ?? `任务状态：${status}`),
          { requestId: taskId },
        )
      }
      if (/^(?:succeeded|success|completed|complete)$/.test(status)) {
        succeededWithoutResultCount += 1
        // A successful status can arrive just before the result URL is replicated.
        if (succeededWithoutResultCount >= 20) {
          throw new GenerationRequestError(
            'platform',
            'GRS AI 显示生成成功，但暂未返回图片地址',
            `任务 ${taskId} 已成功。Disy 已额外查询多次，但结果地址仍为空；请稍后从 GRS AI 日志找回，避免重复扣费。`,
            { requestId: taskId },
          )
        }
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      if (error instanceof GenerationRequestError) throw error
      consecutiveErrors += 1
      if (consecutiveErrors >= GRSAI_MAX_CONSECUTIVE_POLL_ERRORS) {
        throw new GenerationRequestError(
          'network',
          'GRS AI 任务已提交，但结果查询暂时中断',
          `任务 ID：${taskId}。连续 ${consecutiveErrors} 次查询失败，任务仍可能在服务端成功完成；请勿直接重试。`,
          { requestId: taskId },
        )
      }
    }
  }
  throw new GenerationRequestError(
    'network',
    'GRS AI 任务仍在生成或结果查询超时',
    `任务 ID：${taskId}。Disy 已持续查询 15 分钟，任务仍可能稍后成功；请勿直接重复生成。`,
    { requestId: taskId },
  )
}

export async function generateRemoteImages(
  settings: ApiRequestSettings,
  options: ImageGenerationOptions,
): Promise<GeneratedImage[]> {
  const startedAtMs = Date.now()
  const startedAt = new Date(startedAtMs).toISOString()
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
  const referenceImages = options.referenceImages?.filter(Boolean) ?? []
  const useGrsaiUnifiedImage = isGrsaiBaseUrl(settings.baseUrl)
  const useStandardImageEdit = !useGrsaiUnifiedImage && referenceImages.length > 0 && /(?:gpt-image|chatgpt-image)/i.test(settings.model)
  const grsaiRequestBody = {
    model: settings.model,
    prompt: options.prompt,
    images: referenceImages,
    aspectRatio: options.aspectRatio && options.aspectRatio !== 'auto' ? options.aspectRatio : '1:1',
    imageSize: options.resolution ?? '1K',
    // Async mode returns a task ID immediately. Polling that ID avoids losing
    // successful images when a long-lived synchronous connection is interrupted.
    replyType: 'async',
  }
  const requestForLog: Record<string, unknown> = useGrsaiUnifiedImage
    ? grsaiRequestBody
    : useStandardImageEdit
      ? { model: settings.model, prompt: options.prompt, n: options.count, size: compatibleSize, quality: options.detail, images: `[multipart × ${referenceImages.length}]` }
      : body
  let taskId = ''
  let lastPayload: unknown = null

  const providerLabel = resolveProviderLabel(settings.baseUrl)

  const emitAdminLog = (resultType: 'success' | 'failed', resultPayload: unknown) => {
    if (!options.captureAdminLog) return
    const finishedAt = new Date().toISOString()
    const payload = resultPayload ?? lastPayload ?? {}
    options.captureAdminLog({
      provider: providerLabel,
      taskId: taskId || extractTaskId(payload) || undefined,
      model: settings.model,
      startedAt,
      finishedAt,
      durationMs: Date.now() - startedAtMs,
      resultType,
      kind: 'image',
      requestJson: sanitizeAdminLogJson(requestForLog),
      resultJson: sanitizeAdminLogJson(payload),
      resultUrls: collectRecoverableResultUrls(payload),
    })
  }

  const failWithAdminLog = (error: unknown): never => {
    if (error instanceof GenerationRequestError) {
      if (!error.adminLog && options.captureAdminLog) {
        const payload = lastPayload ?? { error: error.detail, summary: error.message }
        const log: GenerationAdminLog = {
          provider: providerLabel,
          taskId: taskId || error.requestId || extractTaskId(payload) || undefined,
          model: settings.model,
          startedAt,
          finishedAt: new Date().toISOString(),
          durationMs: Date.now() - startedAtMs,
          resultType: 'failed',
          kind: 'image',
          requestJson: sanitizeAdminLogJson(requestForLog),
          resultJson: sanitizeAdminLogJson(payload),
          resultUrls: collectRecoverableResultUrls(payload),
        }
        error.adminLog = log
        options.captureAdminLog(log)
      }
      throw error
    }
    emitAdminLog('failed', { error: error instanceof Error ? error.message : String(error) })
    throw error
  }

  let response: Response
  try {
    if (useGrsaiUnifiedImage) {
      response = await fetch(endpoint(settings.baseUrl, 'api/generate'), {
        method: 'POST',
        signal: options.signal,
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(grsaiRequestBody),
      })
    } else if (useStandardImageEdit) {
      const form = new FormData()
      form.append('model', settings.model)
      form.append('prompt', options.prompt)
      form.append('n', String(options.count))
      form.append('size', compatibleSize)
      if (options.detail) form.append('quality', options.detail)

      for (const [index, imageSource] of referenceImages.entries()) {
        let imageResponse: Response
        const imageController = new AbortController()
        const abortImageRead = () => imageController.abort()
        options.signal?.addEventListener('abort', abortImageRead, { once: true })
        const imageTimeout = window.setTimeout(() => imageController.abort(), REFERENCE_IMAGE_READ_TIMEOUT_MS)
        try {
          imageResponse = await fetch(imageSource, { signal: imageController.signal })
        } catch (error) {
          if (options.signal?.aborted) throw new DOMException('Generation interrupted', 'AbortError')
          throw new GenerationRequestError(
            'platform',
            error instanceof DOMException && error.name === 'AbortError' ? '参考图片读取超时' : '参考图片无法转换为模型输入',
            `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}。为避免产生无效计费，本次请求尚未发送到图像生成接口。`,
          )
        } finally {
          window.clearTimeout(imageTimeout)
          options.signal?.removeEventListener('abort', abortImageRead)
        }
        if (!imageResponse.ok) {
          throw new GenerationRequestError(
            'platform',
            '参考图片无法转换为模型输入',
            `图片读取失败（${imageResponse.status}）。为避免产生无效计费，本次请求尚未发送到图像生成接口。`,
          )
        }
        const imageBlob = await imageResponse.blob()
        if (!imageBlob.type.startsWith('image/')) {
          throw new GenerationRequestError(
            'platform',
            '参考图片格式无法识别',
            `第 ${index + 1} 张参考图的文件类型为 ${imageBlob.type || 'unknown'}，本次生成请求未发送。`,
          )
        }
        const extension = imageBlob.type.includes('webp') ? 'webp' : imageBlob.type.includes('jpeg') ? 'jpg' : 'png'
        // GPT Image edit APIs represent an image array by repeating the same
        // multipart `image` field. The upload order is the prompt's 图1/图2/... order.
        form.append('image', imageBlob, `reference-${index + 1}.${extension}`)
      }

      response = await fetch(endpoint(settings.baseUrl, 'images/edits'), {
        method: 'POST',
        headers: { Authorization: `Bearer ${settings.apiKey}` },
        body: form,
        signal: options.signal,
      })
    } else {
      if (referenceImages.length) body.image_urls = referenceImages
      response = await fetch(endpoint(settings.baseUrl, 'images/generations'), {
        method: 'POST',
        signal: options.signal,
        headers: {
          Authorization: `Bearer ${settings.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      })
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    if (error instanceof GenerationRequestError) return failWithAdminLog(error)
    const detail = error instanceof Error ? `${error.name}: ${error.message}` : String(error)
    return failWithAdminLog(new GenerationRequestError(
      'network',
      '请求可能已送达并扣费，但浏览器没有收到生成结果',
      `${detail}。请先检查中转服务的消费记录、任务详情或生成历史，不要直接重复生成。常见原因是中转响应缺少跨域许可、连接中途断开或代理没有把图片响应返回给浏览器。`,
    ))
  }
  // Paid generation requests are never retried or split automatically. A rejected
  // batch stops here so one click can produce at most one billable API request.
  if (!response.ok) return failWithAdminLog(await createApiError(response))
  let payload: unknown
  try {
    payload = await response.json()
    lastPayload = payload
    taskId = extractTaskId(payload) || taskId
  } catch (error) {
    return failWithAdminLog(new GenerationRequestError(
      'platform',
      '请求可能已经扣费，但 API 返回了无法识别的数据',
      `${error instanceof Error ? error.message : String(error)}。请检查中转任务或生成历史，不要直接重试。`,
    ))
  }
  try {
    if (useGrsaiUnifiedImage) {
      payload = await resolveGrsaiImageResult(settings, payload, options.signal)
      lastPayload = payload
      taskId = extractTaskId(payload) || taskId
    }
    const rows = extractGeneratedImages(payload)
    if (!rows.length) {
      throw new GenerationRequestError(
        'platform',
        '请求可能已经扣费，但没有收到图片结果',
        '接口请求成功，但响应中没有可识别的图片。请检查中转任务或生成历史，不要直接重试。',
        { requestId: taskId || undefined },
      )
    }
    emitAdminLog('success', payload)
    // Preserve response order and cardinality. Some gateways intentionally reuse the
    // same proxy URL for separate batch items, so URL-based deduplication can lose images.
    return rows
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    return failWithAdminLog(error)
  }
}

export async function generateRemoteText(
  settings: ApiRequestSettings,
  prompt: string,
  options: TextGenerationOptions = {},
) {
  const startedAtMs = Date.now()
  const startedAt = new Date(startedAtMs).toISOString()
  const providerLabel = resolveProviderLabel(settings.baseUrl)
  const referenceImages = options.referenceImages?.map((source) => source.trim()).filter(Boolean) ?? []
  const userContent = referenceImages.length
    ? [
        { type: 'text' as const, text: prompt },
        ...referenceImages.map((url) => ({
          type: 'image_url' as const,
          image_url: { url },
        })),
      ]
    : prompt
  const requestForLog = {
    model: settings.model,
    messages: [{ role: 'user', content: typeof userContent === 'string' ? userContent : '[multimodal text + images]' }],
    stream: false,
    referenceImageCount: referenceImages.length,
  }

  const emitTextAdminLog = (resultType: 'success' | 'failed', resultPayload: unknown, taskId?: string) => {
    if (!options.captureAdminLog) return
    options.captureAdminLog({
      provider: providerLabel,
      taskId,
      model: settings.model,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      resultType,
      kind: 'text',
      requestJson: sanitizeAdminLogJson(requestForLog),
      resultJson: sanitizeAdminLogJson(resultPayload),
      resultUrls: [],
    })
  }

  let response: Response
  try {
    response = await fetch(endpoint(settings.baseUrl, 'chat/completions'), {
      method: 'POST',
      signal: options.signal,
      headers: {
        Authorization: `Bearer ${settings.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: settings.model,
        messages: [{ role: 'user', content: userContent }],
        stream: false,
      }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    const networkError = createNetworkError(error)
    emitTextAdminLog('failed', { error: networkError.detail, summary: networkError.message })
    throw networkError
  }
  if (!response.ok) {
    const apiError = await createApiError(response)
    emitTextAdminLog('failed', { error: apiError.detail, summary: apiError.message, status: apiError.status }, apiError.requestId)
    throw apiError
  }
  let payload: {
    id?: string
    choices?: Array<{ message?: { content?: string }; text?: string }>
    output_text?: string
    text?: string
  }
  try {
    payload = await response.json() as typeof payload
  } catch (error) {
    const parseError = new GenerationRequestError('platform', 'API 返回了无法识别的数据', error instanceof Error ? error.message : String(error))
    emitTextAdminLog('failed', { error: parseError.detail, summary: parseError.message })
    throw parseError
  }
  const content = payload.choices?.[0]?.message?.content
    ?? payload.choices?.[0]?.text
    ?? payload.output_text
    ?? payload.text
    ?? ''
  if (!content.trim()) {
    const emptyError = new GenerationRequestError('platform', '模型没有返回文本内容', '接口请求成功，但响应中没有可用的文本字段。')
    emitTextAdminLog('failed', payload, extractTaskId(payload))
    throw emptyError
  }
  emitTextAdminLog('success', {
    id: payload.id,
    content: content.trim().slice(0, 8_000),
    truncated: content.trim().length > 8_000,
  }, extractTaskId(payload))
  return content.trim()
}
