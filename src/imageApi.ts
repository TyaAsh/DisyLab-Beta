/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab-Canvas
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
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

export type GeneratedVideo = { blob: Blob; taskId: string; progress: number; sourceUrl?: string }
export type VideoGenerationOptions = {
  prompt: string
  seconds: number
  size: string
  mode?: 'text2video' | 'image2video' | 'first_last_frame' | 'image_reference' | 'all_reference'
  referenceImage?: string
  referenceImages?: string[]
  firstFrame?: string
  lastFrame?: string
  referenceVideo?: string
  referenceVideos?: string[]
  generateAudio?: boolean
  signal?: AbortSignal
  onProgress?: (progress: number, status: string) => void
  /** Persists an async provider task before polling/download begins. */
  onTaskId?: (taskId: string) => void
  /** Captures the provider request/result for recovery and output history. */
  captureAdminLog?: (log: GenerationAdminLog) => void
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
  kind?: 'image' | 'text' | 'video'
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

const REFERENCE_IMAGE_REQUEST_MAX_DIMENSION = 1024
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
  const isBrowserRelativeImage = /^(?:\/|\.\/|\.\.\/)/.test(trimmedSource)
  if (!trimmedSource || (!isBrowserRelativeImage && !/^(?:https?:|blob:|data:image\/)/i.test(trimmedSource))) return trimmedSource
  const readableSource = isBrowserRelativeImage ? new URL(trimmedSource, window.location.href).href : trimmedSource

  let sourceBlob: Blob
  const referenceController = new AbortController()
  const abortReferenceRead = () => referenceController.abort()
  signal?.addEventListener('abort', abortReferenceRead, { once: true })
  const referenceTimeout = window.setTimeout(() => referenceController.abort(), REFERENCE_IMAGE_READ_TIMEOUT_MS)
  try {
    const response = await fetch(readableSource, { signal: referenceController.signal })
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

  const isPreferredEditFormat = /^image\/(?:png|jpe?g)$/i.test(sourceBlob.type)
  // Remote and blob URLs are converted to stable request data. Unsupported
  // formats are always re-encoded while preserving their exact pixel dimensions.
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
    const maxSourceDimension = Math.max(bitmap.width, bitmap.height)
    if (isPreferredEditFormat && maxSourceDimension <= REFERENCE_IMAGE_REQUEST_MAX_DIMENSION) {
      return /^data:image\//i.test(trimmedSource) ? trimmedSource : blobToDataUrl(sourceBlob)
    }
    const canvas = document.createElement('canvas')
    // Requests cap their longest edge at 1K. This is large enough for image
    // guidance while preventing an oversized local upload from bloating payloads.
    const scale = Math.min(1, REFERENCE_IMAGE_REQUEST_MAX_DIMENSION / maxSourceDimension)
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法创建图片压缩画布')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)

    // WebP and uncommon formats become PNG only for request compatibility.
    // PNG remains lossless; JPEG retains JPEG encoding at high quality.
    const outputType = /^image\/jpe?g$/i.test(sourceBlob.type) ? 'image/jpeg' : 'image/png'
    return blobToDataUrl(await canvasToBlob(canvas, outputType, .92))

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
  resultUrls?: string[]

  constructor(
    category: GenerationErrorCategory,
    message: string,
    detail: string,
    metadata?: { status?: number; code?: string; requestId?: string; adminLog?: GenerationAdminLog; resultUrls?: string[] },
  ) {
    super(message)
    this.name = 'GenerationRequestError'
    this.category = category
    this.detail = detail
    this.status = metadata?.status
    this.code = metadata?.code
    this.requestId = metadata?.requestId
    this.adminLog = metadata?.adminLog
    this.resultUrls = metadata?.resultUrls
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
  const trimmed = baseUrl.trim().replace(/^['"]|['"]$/g, '').replace(/\/$/, '')
  if (!trimmed) throw new Error('接口地址不能为空')
  if (/\.apifox\.cn(?:\/|$)/i.test(trimmed)) {
    throw new Error('这里填写的是 Apifox 文档地址。GRS AI 请使用 https://grsaiapi.com/v1 或 https://grsai.dakka.com.cn/v1')
  }
  let url: URL
  try {
    url = new URL(trimmed)
  } catch {
    throw new Error('接口地址必须是完整的 http(s) URL，例如 https://api.example.com/v1')
  }
  if (!/^https?:$/i.test(url.protocol)) throw new Error('接口地址只支持 http:// 或 https://')
  const host = url.hostname.toLowerCase()
  if (!url.pathname || url.pathname === '/') {
    const defaultPath = host === 'api.openai.com' || host === 'api.deepseek.com' || /siliconflow\.cn$/i.test(host)
      ? '/v1'
      : /(?:api\.apiyi\.com|apiyi\.com|apimart\.ai)$/i.test(host)
        ? '/v1'
        : /^(?:grsaiapi\.com|grsai\.dakka\.com\.cn)$/i.test(host)
          ? '/v1'
          : ''
    if (defaultPath) url.pathname = defaultPath
  }
  return url.toString().replace(/\/$/, '')
}

function endpoint(baseUrl: string, path: string) {
  // APIYI's OpenAI-compatible endpoints are not consistently CORS-enabled.
  // Browser builds use the same-origin relay; server-side callers keep the
  // configured provider URL. The relay forwards the original path unchanged.
  if (typeof window !== 'undefined' && /api\.apiyi\.com|apiyi\.com/i.test(baseUrl)) {
    const normalized = normalizedApiBaseUrl(baseUrl)
    const providerPath = new URL(normalized).pathname.replace(/\/$/, '')
    return `/apiyi/openai${providerPath}/${path.replace(/^\//, '')}`
  }
  return `${normalizedApiBaseUrl(baseUrl)}/${path.replace(/^\//, '')}`
}

function apiYiRelayHeaders(settings: Pick<ApiRequestSettings, 'baseUrl'>, init?: HeadersInit) {
  const headers = new Headers(init)
  if (typeof window !== 'undefined' && /api\.apiyi\.com|apiyi\.com/i.test(settings.baseUrl)) {
    try {
      const normalized = normalizedApiBaseUrl(settings.baseUrl)
      headers.set('X-DisyLab-APIYI-Origin', new URL(normalized).origin)
      headers.set('X-DisyLab-APIYI-Base', normalized)
    } catch { /* validated by endpoint */ }
  }
  return headers
}

/** GRS's account endpoints live at the host root, outside the /v1 API prefix. */
function grsaiControlEndpoint(baseUrl: string, path: string) {
  const url = new URL(normalizedApiBaseUrl(baseUrl))
  return `${url.origin}/${path.replace(/^\//, '')}`
}

function isGrsaiBaseUrl(baseUrl: string) {
  return /^https?:\/\/(?:grsaiapi\.com|grsai\.dakka\.com\.cn)(?:\/|$)/i.test(normalizedApiBaseUrl(baseUrl))
}

// Decide whether the structured numbered reference guide ("图1 / 图片1 / 参考图1 =
// 第 1 张输入图片") should be appended to the prompt.
//
// The guide is ONLY required by the OpenAI `images/edits` multipart path
// (GPT Image / ChatGPT Image): there the reference images are uploaded as unnamed
// files, so the model can only tell them apart from the prompt's "图N" mapping.
//
// Every other path receives reference images positionally (GRS AI unified
// `images` array, Seedream / Volces `image_urls`, the standard OpenAI
// `image_urls` field, or multimodal text content). For these the guide is
// redundant and — critically — GRS AI enforces a server-side prompt regex
// ("The string did not match the expected pattern") that the guide's
// `图1 / 图片1 / 参考图1 = 第 1 张输入图片（@name）` structure violates, so the
// request is rejected before any image is generated. We omit it everywhere but
// the multipart GPT Image path so every model accepts the prompt and returns
// results. Position-based reference ("图1/图2" in the user's own prompt) still
// works because those providers align images by upload order.
export function shouldAppendReferenceGuide(opts: { modelId: string; baseUrl: string; isImageGeneration: boolean }): boolean {
  if (isGrsaiBaseUrl(opts.baseUrl)) return false
  if (opts.isImageGeneration) return /(?:gpt-image|chatgpt-image)/i.test(opts.modelId)
  return true
}

export function resolveProviderLabel(baseUrl: string) {
  const normalized = normalizedApiBaseUrl(baseUrl).toLowerCase()
  if (/grsaiapi\.com|grsai\.dakka\.com\.cn/.test(normalized)) return 'GRS AI'
  if (/api\.apiyi\.com|apiyi\.com/.test(normalized)) return 'APIYI'
  if (/api\.apimart\.ai|apimart\.ai/.test(normalized)) return 'APIMart'
  if (/gptgod\.online|gptgod\.com/.test(normalized)) return 'GPTGod'
  if (/ark\.cn-beijing\.volces\.com/.test(normalized)) return '即梦'
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

async function mediaSourceForApiYi(source: string, signal?: AbortSignal) {
  // APIYI accepts remote URLs, but browser clients cannot reliably read the
  // provider CDN (CORS). Route APIYI-hosted media through our same-origin
  // relay; data/blob URLs remain local and are read directly.
  const isRemote = /^https?:\/\//i.test(source)
  const isApiYiMedia = (() => {
    try { return /(?:^|\.)apiyi\.com$|(?:^|\.)volces\.com$|(?:^|\.)aliyuncs\.com$/i.test(new URL(source).hostname) } catch { return false }
  })()
  const readableSource = typeof window !== 'undefined' && isRemote && isApiYiMedia
    ? `/apiyi/media?url=${encodeURIComponent(source)}`
    : source
  if (isRemote && typeof window === 'undefined') return source
  const response = await fetch(readableSource, { signal })
  if (!response.ok) throw new GenerationRequestError('platform', '参考媒体无法读取', `媒体读取失败（${response.status}）`)
  const blob = await response.blob()
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('参考媒体转换失败'))
    reader.readAsDataURL(blob)
  })
}

function videoResultUrl(payload: unknown): string {
  if (!payload || typeof payload !== 'object') return ''
  const record = payload as Record<string, unknown>
  const nested = record.content && typeof record.content === 'object' ? record.content as Record<string, unknown> : null
  const data = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : null
  const output = record.output && typeof record.output === 'object' ? record.output as Record<string, unknown> : null
  const candidates = [
    record.video_url, record.videoUrl, record.result_url, record.resultUrl, record.url,
    nested?.video_url, nested?.videoUrl, nested?.result_url, nested?.resultUrl, nested?.url,
    data?.video_url, data?.videoUrl, data?.result_url, data?.resultUrl, data?.url,
    output?.video_url, output?.videoUrl, output?.result_url, output?.resultUrl, output?.url,
  ]
  return candidates.find((value): value is string => typeof value === 'string' && /^https?:\/\//i.test(value)) ?? ''
}

function videoTaskStatus(payload: unknown, fallback = 'queued') {
  if (!payload || typeof payload !== 'object') return fallback
  const record = payload as Record<string, unknown>
  const nested = record.data && typeof record.data === 'object' ? record.data as Record<string, unknown> : null
  const output = record.output && typeof record.output === 'object' ? record.output as Record<string, unknown> : null
  return String(record.status ?? record.state ?? nested?.status ?? nested?.state ?? output?.status ?? output?.state ?? fallback).trim().toLowerCase()
}

function apiYiGeneratedMediaUrl(source: string) {
  // Result/CDN URLs are often missing CORS headers. Keep browser downloads on
  // the app origin; server-side callers continue to use the provider URL.
  return typeof window === 'undefined' ? source : `/apiyi/media?url=${encodeURIComponent(source)}`
}

function apiYiVideoEndpoint(settings: ApiRequestSettings, relayPrefix: string, path: string) {
  if (typeof window !== 'undefined') return `${relayPrefix}${path}`
  return `${new URL(normalizedApiBaseUrl(settings.baseUrl)).origin}${path}`
}

function apiYiVideoHeaders(settings: ApiRequestSettings, headers: Record<string, string> = {}) {
  const output = { ...headers }
  if (typeof window !== 'undefined') output['X-DisyLab-APIYI-Origin'] = new URL(normalizedApiBaseUrl(settings.baseUrl)).origin
  return output
}

function apiYiVideoRatio(size: string) {
  const match = /^(\d+)x(\d+)$/i.exec(size)
  if (!match) return 'adaptive'
  const ratio = Number(match[1]) / Number(match[2])
  const options: Array<[string, number]> = [['16:9', 16 / 9], ['4:3', 4 / 3], ['1:1', 1], ['3:4', 3 / 4], ['9:16', 9 / 16], ['21:9', 21 / 9]]
  return options.sort((left, right) => Math.abs(left[1] - ratio) - Math.abs(right[1] - ratio))[0][0]
}

async function generateApiYiSeedanceVideo(settings: ApiRequestSettings, options: VideoGenerationOptions): Promise<GeneratedVideo> {
  const origin = new URL(normalizedApiBaseUrl(settings.baseUrl)).origin
  const taskPath = '/seedance/api/v3/contents/generations/tasks'
  // APIYI documents that browsers cannot read this endpoint's response because
  // of CORS even when the paid task was accepted. Use the app's same-origin
  // relay in the browser; Node/test callers continue to use the provider URL.
  const taskEndpoint = typeof window === 'undefined'
    ? `${origin}${taskPath}`
    : `/apiyi/seedance${taskPath}`
  const content: Array<Record<string, unknown>> = [{ type: 'text', text: options.prompt }]
  const imageSources = options.mode === 'first_last_frame'
    ? [options.firstFrame, options.lastFrame]
    : options.mode === 'image2video'
      ? [options.firstFrame ?? options.referenceImage]
      : options.referenceImages ?? []
  const imageRoles = options.mode === 'first_last_frame' ? ['first_frame', 'last_frame'] : imageSources.map(() => options.mode === 'image2video' ? undefined : 'reference_image')
  for (const [index, source] of imageSources.entries()) {
    if (!source) continue
    content.push({ type: 'image_url', image_url: { url: await mediaSourceForApiYi(source, options.signal) }, ...(imageRoles[index] ? { role: imageRoles[index] } : {}) })
  }
  const referenceVideos = Array.from(new Set([...(options.referenceVideos ?? []), options.referenceVideo].filter((source): source is string => Boolean(source))))
  for (const source of referenceVideos) {
    content.push({ type: 'video_url', video_url: { url: await mediaSourceForApiYi(source, options.signal) } })
  }
  const requestedResolution = /fast|mini/i.test(settings.model) && options.size.endsWith('x1080') ? '720p' : options.size.endsWith('x480') ? '480p' : options.size.endsWith('x1080') ? '1080p' : '720p'
  let response: Response
  const requestHeaders = new Headers({
    Authorization: `Bearer ${settings.apiKey}`,
    'Content-Type': 'application/json',
    'Accept-Encoding': 'identity',
  })
  if (typeof window !== 'undefined') requestHeaders.set('X-DisyLab-APIYI-Origin', origin)
  try {
    response = await fetch(taskEndpoint, {
      method: 'POST',
      signal: options.signal,
      headers: requestHeaders,
      body: JSON.stringify({
        model: settings.model,
        content,
        resolution: requestedResolution,
        ratio: apiYiVideoRatio(options.size),
        duration: Math.max(4, Math.min(15, Math.round(options.seconds))),
        generate_audio: options.generateAudio !== false,
      }),
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new GenerationRequestError('network', 'Seedance 同源代理请求失败', `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}。请求地址：${taskEndpoint}`)
  }
  if (!response.ok) throw await createApiError(response)
  const created = await response.json() as Record<string, unknown>
  const taskId = extractTaskId(created)
  if (!taskId) throw new GenerationRequestError('platform', 'Seedance 没有返回任务编号', sanitizeAdminLogJson(created))
  options.onTaskId?.(taskId)
  options.onProgress?.(1, 'queued')
  const startedAt = Date.now()
  let status = 'queued'
  while (!['succeeded', 'completed', 'success', 'failed', 'expired', 'cancelled', 'canceled'].includes(status)) {
    if (Date.now() - startedAt > 15 * 60_000) throw new GenerationRequestError('network', 'Seedance 视频生成等待超时', `任务 ${taskId} 超过 15 分钟仍未完成`)
    await waitForDelay(20_000, options.signal)
    let poll: Response
    try {
      poll = await fetch(`${taskEndpoint}/${encodeURIComponent(taskId)}`, {
        signal: options.signal,
        headers: requestHeaders,
      })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw new GenerationRequestError('network', 'Seedance 任务查询请求失败', `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}。任务 ${taskId}`, { requestId: taskId })
    }
    if (!poll.ok) throw await createApiError(poll)
    const job = await poll.json() as Record<string, unknown>
    status = videoTaskStatus(job, status)
    options.onProgress?.(status === 'running' || status === 'processing' ? 50 : ['succeeded', 'completed', 'success'].includes(status) ? 90 : 10, status)
    if (['failed', 'expired', 'cancelled', 'canceled'].includes(status)) throw new GenerationRequestError('api', `Seedance 任务${status === 'expired' ? '已过期' : '失败'}`, sanitizeAdminLogJson(job), { requestId: taskId })
    if (['succeeded', 'completed', 'success'].includes(status)) {
      const videoUrl = videoResultUrl(job)
      if (!videoUrl) throw new GenerationRequestError('platform', 'Seedance 成功但没有返回视频地址', sanitizeAdminLogJson(job), { requestId: taskId })
      let videoResponse: Response
      try {
        videoResponse = await fetch(apiYiGeneratedMediaUrl(videoUrl), { signal: options.signal })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') throw error
        throw new GenerationRequestError('network', 'Seedance 视频下载请求失败', `${error instanceof Error ? `${error.name}: ${error.message}` : String(error)}。任务 ${taskId}。视频地址：${videoUrl}`, { requestId: taskId, resultUrls: [videoUrl] })
      }
      if (!videoResponse.ok) throw new GenerationRequestError('network', 'Seedance 视频下载失败', `视频下载失败（${videoResponse.status}）。任务 ${taskId}。视频地址：${videoUrl}`, { requestId: taskId, resultUrls: [videoUrl] })
      const blob = await videoResponse.blob()
      if (!blob.size) throw new GenerationRequestError('platform', 'Seedance 返回了空视频文件', `任务 ${taskId}。视频地址：${videoUrl}`, { requestId: taskId, resultUrls: [videoUrl] })
      options.onProgress?.(100, 'completed')
      return { blob, taskId, progress: 100, sourceUrl: videoUrl }
    }
  }
  throw new GenerationRequestError('platform', 'Seedance 任务未完成', `任务 ${taskId}`, { requestId: taskId })
}

function videoResolutionFromSize(size: string) {
  const height = Number(/x(\d+)$/i.exec(size)?.[1] ?? 720)
  return height >= 2160 ? '4k' : height >= 1080 ? '1080p' : height <= 480 ? '480p' : '720p'
}

async function generateApiYiVeoVideo(settings: ApiRequestSettings, options: VideoGenerationOptions): Promise<GeneratedVideo> {
  if (options.mode !== 'text2video') {
    throw new GenerationRequestError('api', 'Veo 图生视频需要专用上传接口', '当前已适配 APIYI Veo 3.1 文生视频端点；图生视频请先使用文本模式，避免把参考图静默丢弃。')
  }
  const resolution = videoResolutionFromSize(options.size)
  const requestedSeconds = [4, 6, 8].reduce((best, current) => Math.abs(current - options.seconds) < Math.abs(best - options.seconds) ? current : best, 4)
  const seconds = resolution === '1080p' || resolution === '4k' ? 8 : requestedSeconds
  const response = await fetch(apiYiVideoEndpoint(settings, '/apiyi/veo', '/v1/videos'), {
    method: 'POST',
    signal: options.signal,
    headers: apiYiVideoHeaders(settings, { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      model: settings.model,
      prompt: options.prompt,
      seconds: String(seconds),
      size: options.size,
      metadata: { resolution, aspectRatio: apiYiVideoRatio(options.size) },
    }),
  })
  if (!response.ok) throw await createApiError(response)
  const created = await response.json() as Record<string, unknown>
  const taskId = extractTaskId(created)
  if (!taskId) throw new GenerationRequestError('platform', 'Veo 没有返回任务编号', sanitizeAdminLogJson(created))
  options.onTaskId?.(taskId)
  let status = videoTaskStatus(created)
  const startedAt = Date.now()
  while (!['completed', 'succeeded', 'success', 'failed', 'cancelled', 'canceled'].includes(status)) {
    if (Date.now() - startedAt > 10 * 60_000) throw new GenerationRequestError('network', 'Veo 视频生成等待超时', `任务 ${taskId} 超过 10 分钟仍未完成`, { requestId: taskId })
    await waitForDelay(8_000, options.signal)
    const poll = await fetch(apiYiVideoEndpoint(settings, '/apiyi/veo', `/v1/videos/${encodeURIComponent(taskId)}`), { signal: options.signal, headers: apiYiVideoHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }) })
    if (!poll.ok) throw await createApiError(poll)
    const job = await poll.json() as Record<string, unknown>
    status = videoTaskStatus(job, status)
    const jobProgress = Number(job.progress)
    options.onProgress?.(Number.isFinite(jobProgress) ? jobProgress : (['completed', 'succeeded', 'success'].includes(status) ? 100 : 30), status)
    if (status === 'failed') throw new GenerationRequestError('api', 'Veo 视频生成失败', sanitizeAdminLogJson(job), { requestId: taskId })
    if (status === 'cancelled' || status === 'canceled') throw new GenerationRequestError('api', 'Veo 视频生成已取消', sanitizeAdminLogJson(job), { requestId: taskId })
  }
  await waitForDelay(4_000, options.signal)
  let lastError: GenerationRequestError | null = null
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const content = await fetch(apiYiVideoEndpoint(settings, '/apiyi/veo', `/v1/videos/${encodeURIComponent(taskId)}/content`), { signal: options.signal, headers: apiYiVideoHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }) })
    if (content.ok) {
      const blob = await content.blob()
      if (blob.size) return { blob, taskId, progress: 100 }
    }
    lastError = await createApiError(content)
    if (attempt < 3) await waitForDelay(4_000, options.signal)
  }
  throw lastError ?? new GenerationRequestError('platform', 'Veo 返回了空视频文件', `任务 ${taskId}`, { requestId: taskId })
}

async function generateApiYiWanVideo(settings: ApiRequestSettings, options: VideoGenerationOptions): Promise<GeneratedVideo> {
  const requestedMode = options.mode ?? 'text2video'
  const expectedSuffix = requestedMode === 'image2video'
    ? 'i2v'
    : requestedMode === 'image_reference' || requestedMode === 'all_reference' || requestedMode === 'first_last_frame'
      ? 'r2v'
      : 't2v'
  const modelSuffix = /-(t2v|i2v|r2v)$/i.exec(settings.model)?.[1]?.toLowerCase()
  if (modelSuffix && modelSuffix !== expectedSuffix) {
    throw new GenerationRequestError(
      'api',
      `当前选择的是 ${settings.model}`,
      `当前节点使用 ${requestedMode} 模式，但模型 ${settings.model} 与它不匹配。请选择 wan2.7-${expectedSuffix}；wan2.7-videoedit 只用于输入已有视频后再编辑。`,
    )
  }
  const input: Record<string, unknown> = { prompt: options.prompt }
  if (expectedSuffix === 'i2v') {
    const image = options.firstFrame ?? options.referenceImage ?? options.referenceImages?.[0]
    if (!image) throw new GenerationRequestError('platform', 'Wan 图生视频缺少参考图', '请选择一张首帧或参考图片后再生成。')
    input.img_url = await mediaSourceForApiYi(image, options.signal)
  } else if (expectedSuffix === 'r2v') {
    const images = [
      ...(options.referenceImages ?? []),
      ...(requestedMode === 'first_last_frame' ? [options.firstFrame, options.lastFrame] : []),
    ].filter((source): source is string => Boolean(source))
    if (images.length) input.reference_image_urls = await Promise.all(images.map((source) => mediaSourceForApiYi(source, options.signal)))
    const videos = Array.from(new Set([...(options.referenceVideos ?? []), options.referenceVideo].filter((source): source is string => Boolean(source))))
    if (videos.length) input.reference_video_urls = await Promise.all(videos.map((source) => mediaSourceForApiYi(source, options.signal)))
    if (!images.length && !videos.length) throw new GenerationRequestError('platform', 'Wan 参考生视频缺少参考素材', '请选择至少一张参考图或一个参考视频后再生成。')
  }
  const response = await fetch(apiYiVideoEndpoint(settings, '/apiyi/wan', '/wan/api/v1/services/aigc/video-generation/video-synthesis'), {
    method: 'POST',
    signal: options.signal,
    headers: apiYiVideoHeaders(settings, { Authorization: `Bearer ${settings.apiKey}`, 'Content-Type': 'application/json', 'X-DashScope-Async': 'enable' }),
    body: JSON.stringify({
      model: settings.model,
      input,
      parameters: {
        resolution: videoResolutionFromSize(options.size) === '1080p' ? '1080P' : '720P',
        ratio: apiYiVideoRatio(options.size),
        duration: Math.max(2, Math.min(15, Math.round(options.seconds))),
        prompt_extend: true,
        watermark: false,
      },
    }),
  })
  if (!response.ok) throw await createApiError(response)
  const created = await response.json() as Record<string, unknown>
  const taskId = extractTaskId(created)
  if (!taskId) throw new GenerationRequestError('platform', 'Wan 没有返回任务编号', sanitizeAdminLogJson(created))
  options.onTaskId?.(taskId)
  const startedAt = Date.now()
  let status = 'submitted'
  while (!['completed', 'succeeded', 'success', 'failed', 'cancelled', 'canceled'].includes(status)) {
    if (Date.now() - startedAt > 15 * 60_000) throw new GenerationRequestError('network', 'Wan 视频生成等待超时', `任务 ${taskId} 超过 15 分钟仍未完成`, { requestId: taskId })
    await waitForDelay(8_000, options.signal)
    const poll = await fetch(apiYiVideoEndpoint(settings, '/apiyi/wan', `/v1/tasks/${encodeURIComponent(taskId)}`), { signal: options.signal, headers: apiYiVideoHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }) })
    if (!poll.ok) throw await createApiError(poll)
    const job = await poll.json() as Record<string, unknown>
    status = videoTaskStatus(job, status)
    const progressValue = Number(job.progress ?? (status === 'completed' || status === 'succeeded' || status === 'success' ? 100 : 30))
    options.onProgress?.(Number.isFinite(progressValue) ? progressValue : 30, status)
    if (['failed', 'cancelled', 'canceled'].includes(status)) throw new GenerationRequestError('api', 'Wan 视频生成失败', sanitizeAdminLogJson(job), { requestId: taskId })
    if (['completed', 'succeeded', 'success'].includes(status)) {
      const resultUrl = videoResultUrl(job)
      if (!resultUrl) throw new GenerationRequestError('platform', 'Wan 成功但没有返回视频地址', sanitizeAdminLogJson(job), { requestId: taskId })
      const video = await fetch(apiYiGeneratedMediaUrl(resultUrl), { signal: options.signal })
      if (!video.ok) throw new GenerationRequestError('network', 'Wan 视频下载失败', `视频下载失败（${video.status}）`, { requestId: taskId, resultUrls: [resultUrl] })
      const blob = await video.blob()
      if (!blob.size) throw new GenerationRequestError('platform', 'Wan 返回了空视频文件', `任务 ${taskId}`, { requestId: taskId, resultUrls: [resultUrl] })
      return { blob, taskId, progress: 100, sourceUrl: resultUrl }
    }
  }
  throw new GenerationRequestError('platform', 'Wan 任务未完成', `任务 ${taskId}`, { requestId: taskId })
}

function payloadMarksUnsupported(payload: unknown) {
  const text = JSON.stringify(payload).toLowerCase()
  return /not[_ -]?support|unsupported|disable|disabled|closed|offline|unavailable|deprecated|retired|inactive|not[_ -]?found|不存在|不支持|已下线|关闭|不可用|停用|废弃/.test(text)
}

function readModelAvailability(item: Record<string, unknown>) {
  if (item.available === false || item.enabled === false || item.is_available === false || item.isAvailable === false) return false
  if (item.disabled === true || item.deprecated === true || item.retired === true) return false
  const statusValues = [item.status, item.state, item.availability].filter((value) => value !== undefined)
  return !payloadMarksUnsupported(statusValues)
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
  const responseRequestId = response.headers.get('x-request-id') ?? response.headers.get('x-shellapi-request-id') ?? undefined
  if (response.status === 502 && response.headers.get('x-disylab-relay-error') === 'upstream-fetch-failed') {
    return new GenerationRequestError('network', '没有连接到 APIYI 视频服务', `${detail}。请检查当前网络是否能访问所配置的 APIYI 节点，或在接口设置中切换 APIYI 官方备用节点。`, {
      status: response.status,
      requestId: responseRequestId,
    })
  }
  if (/no available channels|没有可用通道|no available channel/i.test(detail)) {
    return new GenerationRequestError('api', '当前 API 分组没有可用通道', `${detail}。请在 APIYI Token 页面切换支持该模型的分组，或改用当前分组可用的模型；这不是浏览器网络故障。`, {
      status: response.status,
      requestId: responseRequestId,
    })
  }
  return new GenerationRequestError('api', apiErrorSummary(response.status), detail, {
    status: response.status,
    requestId: responseRequestId,
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
  // Several video IDs omit the literal word "video" (for example Wan's
  // `wan2.7-t2v/i2v/r2v`). Keep those in the video catalog as well.
  if (/video|seedance|sora|veo|kling|runway|hailuo|happyhorse|wan(?:2\.\d)?|(?:^|[-_.])(?:t2v|i2v|r2v)(?:[-_.]|$)/i.test(modelId)) return 'video'
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
  // Some OpenAI-compatible registries label every generative model as
  // `text`; provider-specific Wan IDs still carry the authoritative mode.
  if (inferModelCapability(modelId) === 'video') return 'video'
  if (/text|chat|completion|language/.test(declared)) return 'text'
  return inferModelCapability(modelId)
}

// GRS AI does not expose an OpenAI-compatible GET /v1/models endpoint. Keep its
// catalog local so the connection remains usable in the browser; the list mirrors
// the provider's public model page and can be replaced by a server-side catalog
// proxy when one is deployed.
const GRSAI_LOCAL_MODEL_MANIFEST: RemoteModel[] = [
  { id: 'gpt-image-2', name: 'GPT Image 2', capability: 'image' },
  { id: 'gpt-image-2-vip', name: 'GPT Image 2 VIP', capability: 'image' },
  { id: 'nano-banana-pro', name: 'Nano Banana Pro', capability: 'image' },
  { id: 'nano-banana-2', name: 'Nano Banana 2', capability: 'image' },
  { id: 'nano-banana-2-lite', name: 'Nano Banana 2 Lite', capability: 'image' },
  { id: 'nano-banana-pro-vt', name: 'Nano Banana Pro VT', capability: 'image' },
  { id: 'nano-banana-fast', name: 'Nano Banana Fast', capability: 'image' },
  { id: 'nano-banana-2-cl', name: 'Nano Banana 2 CL', capability: 'image' },
  { id: 'nano-banana-pro-cl', name: 'Nano Banana Pro CL', capability: 'image' },
  { id: 'nano-banana-2-2k-cl', name: 'Nano Banana 2 2K CL', capability: 'image' },
  { id: 'nano-banana-pro-4k-vip', name: 'Nano Banana Pro 4K VIP', capability: 'image' },
  { id: 'nano-banana-pro-vip', name: 'Nano Banana Pro VIP', capability: 'image' },
  { id: 'nano-banana-2-4k-cl', name: 'Nano Banana 2 4K CL', capability: 'image' },
  { id: 'gpt-5.4', name: 'GPT 5.4', capability: 'text' },
  { id: 'gpt-5.5', name: 'GPT 5.5', capability: 'text' },
  { id: 'gemini-3.1-flash-lite', name: 'Gemini 3.1 Flash Lite', capability: 'text' },
  { id: 'gemini-3.1-pro', name: 'Gemini 3.1 Pro', capability: 'text' },
  { id: 'gemini-3.5-flash', name: 'Gemini 3.5 Flash', capability: 'text' },
  { id: 'gemini-3-flash', name: 'Gemini 3 Flash', capability: 'text' },
  { id: 'gemini-3-pro', name: 'Gemini 3 Pro', capability: 'text' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', capability: 'text' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', capability: 'text' },
]

const ARK_LOCAL_MODEL_MANIFEST: RemoteModel[] = [
  { id: 'doubao-seedance-2-0-260128', name: 'Doubao Seedance 2.0', capability: 'video' },
  { id: 'doubao-seedance-2-0-fast-260128', name: 'Doubao Seedance 2.0 Fast', capability: 'video' },
  { id: 'doubao-seedance-2-0-mini-260615', name: 'Doubao Seedance 2.0 Mini', capability: 'video' },
  { id: 'doubao-seedance-1-5-pro-251215', name: 'Doubao Seedance 1.5 Pro', capability: 'video' },
  { id: 'doubao-seedream-5-0-pro-260628', name: 'Doubao Seedream 5.0 Pro', capability: 'image' },
]

const OPENAI_LOCAL_MODEL_MANIFEST: RemoteModel[] = [
  { id: 'sora-2', name: 'Sora 2', capability: 'video' },
  { id: 'sora-2-pro', name: 'Sora 2 Pro', capability: 'video' },
]

// Generic registry so any vendor can declare models that its standard OpenAI-compatible
// GET /v1/models endpoint will not enumerate (typically video/image models behind a
// dedicated endpoint). Vendors flagged `catalogOnly` skip the live request entirely.
type VendorModelSupplement = {
  match: (normalizedBaseUrl: string) => boolean
  supplementalModels: RemoteModel[]
  catalogOnly?: boolean
}

const VENDOR_MODEL_SUPPLEMENTS: VendorModelSupplement[] = [
  { match: isGrsaiBaseUrl, supplementalModels: GRSAI_LOCAL_MODEL_MANIFEST, catalogOnly: true },
  { match: (url) => /^https?:\/\/[^/]*ark\.cn-beijing\.volces\.com(?:\/|$)/i.test(url), supplementalModels: ARK_LOCAL_MODEL_MANIFEST },
  { match: (url) => /^https?:\/\/api\.openai\.com(?:\/|$)/i.test(url), supplementalModels: OPENAI_LOCAL_MODEL_MANIFEST },
]

const GRSAI_CATALOG_PROXY_PATH = '/api/model-catalog?provider=grsai'

function parseRemoteModelCatalog(payload: unknown): RemoteModel[] {
  const container = payload && typeof payload === 'object' ? payload as { data?: unknown[]; models?: unknown[]; object?: string } : {}
  const rows = Array.isArray(payload) ? payload : container.data ?? container.models ?? []
  const models = rows
    .map((model) => {
      if (typeof model === 'string') return { id: model.trim(), name: model.trim(), capability: inferModelCapability(model) }
      if (!model || typeof model !== 'object') return { id: '', name: '', capability: 'text' as const }
      const item = model as Record<string, unknown>
      const id = String(item.id ?? item.model ?? item.model_id ?? item.slug ?? item.key ?? '').trim()
      const name = String(item.name ?? item.display_name ?? item.displayName ?? item.title ?? id).trim()
      if (!readModelAvailability(item)) return { id: '', name: '', capability: 'text' as const }
      return { id, name, capability: readDeclaredCapability(item, id) }
    })
    .filter((model) => model.id)
  return Array.from(new Map(models.map((model) => [model.id, model])).values())
    .sort((left, right) => left.name.localeCompare(right.name))
}

async function fetchGrsaiProxyCatalog(): Promise<RemoteModel[] | null> {
  try {
    const response = await fetch(GRSAI_CATALOG_PROXY_PATH)
    if (!response.ok || !/application\/json/i.test(response.headers.get('content-type') ?? '')) return null
    const models = parseRemoteModelCatalog(await response.json() as unknown)
    return models.length ? models : null
  } catch {
    return null
  }
}

export async function fetchRemoteModels(settings: Pick<ApiRequestSettings, 'baseUrl' | 'apiKey'>): Promise<RemoteModel[]> {
  const normalizedBase = normalizedApiBaseUrl(settings.baseUrl)
  const supplement = VENDOR_MODEL_SUPPLEMENTS.find((entry) => entry.match(normalizedBase))
  // Vendors flagged `catalogOnly` (GRS AI) keep the original behavior: never hit a
  // standard models endpoint, fall back to the local manifest.
  if (supplement?.catalogOnly) {
    return await fetchGrsaiProxyCatalog()
      ?? [...GRSAI_LOCAL_MODEL_MANIFEST].sort((left, right) => left.name.localeCompare(right.name))
  }
  let response: Response
  try {
    response = await fetch(endpoint(settings.baseUrl, 'models'), {
      headers: apiYiRelayHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }),
    })
  } catch (error) {
    if (supplement) return [...supplement.supplementalModels].sort((left, right) => left.name.localeCompare(right.name))
    throw error
  }
  if (!response.ok) {
    // A response means the provider evaluated the request. In particular, do
    // not replace 401/403 credential failures with a local catalog: that makes a
    // bad key look connected and leaves unusable models visible in the canvas.
    throw new Error(await readError(response))
  }
  const live = parseRemoteModelCatalog(await response.json() as unknown)
  if (!supplement) return live
  const liveIds = new Set(live.map((model) => model.id))
  const merged = [...live]
  for (const model of supplement.supplementalModels) {
    if (!liveIds.has(model.id)) merged.push(model)
  }
  return Array.from(new Map(merged.map((model) => [model.id, model])).values())
    .sort((left, right) => left.name.localeCompare(right.name))
}

/** OpenAI-compatible asynchronous video job. Large media stays as a Blob and is
 * never converted to base64, keeping React state and canvas snapshots small. */
async function generateRemoteVideoRequest(settings: ApiRequestSettings, options: VideoGenerationOptions): Promise<GeneratedVideo> {
  if (/api\.apiyi\.com|apiyi\.com/i.test(settings.baseUrl) && /seedance|doubao-seedance/i.test(settings.model)) {
    return generateApiYiSeedanceVideo(settings, options)
  }
  if (/api\.apiyi\.com|apiyi\.com/i.test(settings.baseUrl) && /veo-3\.1/i.test(settings.model)) {
    return generateApiYiVeoVideo(settings, options)
  }
  if (/api\.apiyi\.com|apiyi\.com/i.test(settings.baseUrl) && /wan2\.|happyhorse/i.test(settings.model)) {
    return generateApiYiWanVideo(settings, options)
  }
  const form = new FormData()
  form.set('model', settings.model)
  form.set('prompt', options.prompt)
  form.set('seconds', String(options.seconds))
  form.set('size', options.size)
  if (options.mode) form.set('mode', options.mode)
  if (typeof options.generateAudio === 'boolean') form.set('generate_audio', String(options.generateAudio))
  for (const [index, image] of (options.referenceImages ?? []).entries()) {
    const reference = await fetch(image, { signal: options.signal })
    if (!reference.ok) throw new GenerationRequestError('platform', '参考图片无法读取', `图片读取失败（${reference.status}）`)
    form.append('reference_images', await reference.blob(), `reference-${index + 1}.png`)
  }
  if (options.firstFrame) {
    const first = await fetch(options.firstFrame, { signal: options.signal })
    if (!first.ok) throw new GenerationRequestError('platform', '首帧图片无法读取', `图片读取失败（${first.status}）`)
    form.set('first_frame', await first.blob(), 'first-frame.png')
  }
  if (options.lastFrame) {
    const last = await fetch(options.lastFrame, { signal: options.signal })
    if (!last.ok) throw new GenerationRequestError('platform', '尾帧图片无法读取', `图片读取失败（${last.status}）`)
    form.set('last_frame', await last.blob(), 'last-frame.png')
  }
  const referenceVideos = Array.from(new Set([...(options.referenceVideos ?? []), options.referenceVideo].filter((url): url is string => Boolean(url))))
  for (const [index, source] of referenceVideos.entries()) {
    const video = await fetch(source, { signal: options.signal })
    if (!video.ok) throw new GenerationRequestError('platform', '参考视频无法读取', `视频读取失败（${video.status}）`)
    if (referenceVideos.length === 1) form.set('reference_video', await video.blob(), 'reference-video.mp4')
    else form.append('reference_videos', await video.blob(), `reference-video-${index + 1}.mp4`)
  }
  if (options.referenceImage) {
    const reference = await fetch(options.referenceImage, { signal: options.signal })
    if (!reference.ok) throw new GenerationRequestError('platform', '首帧图片无法读取', `图片读取失败（${reference.status}）`)
    form.set('input_reference', await reference.blob(), 'start-frame.png')
  }
  let createdResponse: Response
  try {
    createdResponse = await fetch(endpoint(settings.baseUrl, 'videos'), { method: 'POST', headers: apiYiRelayHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }), body: form, signal: options.signal })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw createNetworkError(error)
  }
  if (!createdResponse.ok) throw await createApiError(createdResponse)
  const created = await createdResponse.json() as Record<string, unknown>
  const taskId = extractTaskId(created)
  if (!taskId) throw new GenerationRequestError('platform', '视频服务没有返回任务编号', sanitizeAdminLogJson(created))
  options.onTaskId?.(taskId)
  const startedAt = Date.now()
  let progress = Number(created.progress ?? 0)
  let status = videoTaskStatus(created)
  options.onProgress?.(progress, status)
  while (!['completed', 'succeeded', 'success', 'failed', 'cancelled', 'canceled'].includes(status)) {
    if (Date.now() - startedAt > 30 * 60_000) throw new GenerationRequestError('network', '视频生成等待超时', `任务 ${taskId} 超过 30 分钟仍未完成`)
    await waitForDelay(2_500, options.signal)
    let pollResponse: Response
    try {
      pollResponse = await fetch(endpoint(settings.baseUrl, `videos/${encodeURIComponent(taskId)}`), { headers: apiYiRelayHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }), signal: options.signal })
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') throw error
      throw createNetworkError(error)
    }
    if (!pollResponse.ok) throw await createApiError(pollResponse)
    const job = await pollResponse.json() as Record<string, unknown>
    status = videoTaskStatus(job, status)
    const jobProgress = Number(job.progress)
    progress = Math.max(progress, Number.isFinite(jobProgress) ? jobProgress : progress)
    options.onProgress?.(progress, status)
    if (status === 'failed') throw new GenerationRequestError('api', '视频生成失败', sanitizeAdminLogJson(job))
    if (status === 'cancelled' || status === 'canceled') throw new DOMException('Generation cancelled', 'AbortError')
  }
  const contentResponse = await fetch(endpoint(settings.baseUrl, `videos/${encodeURIComponent(taskId)}/content`), { headers: apiYiRelayHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }), signal: options.signal })
  if (!contentResponse.ok) throw await createApiError(contentResponse)
  const blob = await contentResponse.blob()
  if (!blob.size) throw new GenerationRequestError('platform', '视频服务返回了空文件', `任务 ${taskId}`)
  options.onProgress?.(100, 'completed')
  return { blob, taskId, progress: 100 }
}

/**
 * Video providers do not share one response schema, so keep a compact request
 * and lifecycle snapshot even when a provider rejects the request. This is
 * especially useful for APIYI 5xx responses whose actionable detail is only
 * present in the one-time error body.
 */
export async function generateRemoteVideo(settings: ApiRequestSettings, options: VideoGenerationOptions): Promise<GeneratedVideo> {
  const startedAtMs = Date.now()
  const startedAt = new Date(startedAtMs).toISOString()
  const provider = resolveProviderLabel(settings.baseUrl)
  const requestJson = sanitizeAdminLogJson({
    model: settings.model,
    prompt: options.prompt,
    seconds: options.seconds,
    size: options.size,
    mode: options.mode,
    generateAudio: options.generateAudio,
    referenceImageCount: (options.referenceImages?.length ?? 0) + (options.referenceImage ? 1 : 0),
    referenceVideoCount: (options.referenceVideos?.length ?? 0) + (options.referenceVideo ? 1 : 0),
  })
  try {
    const result = await generateRemoteVideoRequest(settings, options)
    options.captureAdminLog?.({
      provider,
      taskId: result.taskId,
      model: settings.model,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      resultType: 'success',
      kind: 'video',
      requestJson,
      resultJson: sanitizeAdminLogJson({ taskId: result.taskId, status: 'completed', progress: result.progress, contentType: result.blob.type, bytes: result.blob.size }),
      resultUrls: result.sourceUrl ? [result.sourceUrl] : [],
    })
    return result
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    const normalized = normalizeGenerationError(error)
    options.captureAdminLog?.({
      provider,
      taskId: normalized.requestId,
      model: settings.model,
      startedAt,
      finishedAt: new Date().toISOString(),
      durationMs: Date.now() - startedAtMs,
      resultType: 'failed',
      kind: 'video',
      requestJson,
      resultJson: sanitizeAdminLogJson({ summary: normalized.message, detail: normalized.detail, status: normalized.status, requestId: normalized.requestId }),
      resultUrls: normalized.resultUrls ?? [],
    })
    throw error
  }
}

export type ProviderCredits = {
  provider: string
  amount: number
  unit: string
  updatedAt: string
}

export type CurrencyRate = {
  base: string
  target: string
  rate: number
  date: string
  fetchedAt: string
}

export async function fetchUsdToCnyRate(): Promise<CurrencyRate> {
  const response = await fetch('https://api.frankfurter.app/latest?from=USD&to=CNY', {
    headers: { Accept: 'application/json' },
  })
  if (!response.ok) throw new Error(`汇率服务暂不可用（${response.status}）`)
  const payload = await response.json() as { amount?: unknown; base?: unknown; date?: unknown; rates?: { CNY?: unknown } }
  const rate = Number(payload.rates?.CNY)
  if (!Number.isFinite(rate) || rate <= 0) throw new Error('汇率服务返回了无效的 USD/CNY 汇率')
  return {
    base: String(payload.base ?? 'USD'),
    target: 'CNY',
    rate,
    date: String(payload.date ?? new Date().toISOString().slice(0, 10)),
    fetchedAt: new Date().toISOString(),
  }
}

export type ProviderModelPrice = {
  modelId: string
  credits: number
  billing: 'fixed' | 'token'
  priceExample?: string
  unit?: string
}

export async function fetchProviderModelPrices(baseUrl: string): Promise<ProviderModelPrice[]> {
  const normalizedBase = normalizedApiBaseUrl(baseUrl)
  if (/api\.apiyi\.com|apiyi\.com/i.test(normalizedBase)) {
    const apiYiOrigin = new URL(normalizedBase).origin
    const response = await fetch(`${apiYiOrigin}/api/pricing`, {
      headers: { Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(await readError(response) || apiErrorSummary(response.status))
    const payload = await response.json() as { success?: unknown; data?: unknown }
    if (payload.success !== true || !Array.isArray(payload.data)) return []
    return payload.data.flatMap((row): ProviderModelPrice[] => {
      if (!row || typeof row !== 'object') return []
      const item = row as Record<string, unknown>
      const modelId = String(item.model_name ?? '').trim()
      const quotaType = Number(item.quota_type)
      const modelPrice = Number(item.model_price)
      const modelRatio = Number(item.model_ratio)
      if (!modelId) return []
      if (quotaType === 1 && Number.isFinite(modelPrice) && modelPrice > 0) {
        return [{ modelId, credits: modelPrice, billing: 'fixed', unit: 'USD', priceExample: `约 $${modelPrice.toFixed(2)} / 次` }]
      }
      if (quotaType === 0 && Number.isFinite(modelRatio) && modelRatio > 0) {
        return [{ modelId, credits: modelRatio, billing: 'token', unit: '倍率', priceExample: `按 Token · 倍率 ${modelRatio}` }]
      }
      return []
    })
  }
  if (!isGrsaiBaseUrl(baseUrl)) return []
  const origin = new URL(normalizedApiBaseUrl(baseUrl)).origin
  const response = await fetch(`${origin}/client/serverGrsai/getModelList`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
  })
  if (!response.ok) throw new Error(await readError(response) || apiErrorSummary(response.status))
  const payload = await response.json() as { code?: unknown; data?: { list?: unknown[] }; msg?: unknown }
  if (payload.code !== 0) throw new Error(typeof payload.msg === 'string' ? payload.msg : '未能读取 GRS AI 模型价格')
  return (payload.data?.list ?? []).flatMap((row): ProviderModelPrice[] => {
    if (!row || typeof row !== 'object') return []
    const item = row as Record<string, unknown>
    const modelId = String(item.name ?? item.model ?? '').trim()
    const credits = Number(item.credits)
    if (!modelId || !Number.isFinite(credits) || credits < 0) return []
    return [{
      modelId,
      credits,
      billing: Number(item.cost_type) === 0 ? 'fixed' : 'token',
      priceExample: typeof item.priceExample === 'string' ? item.priceExample : undefined,
    }]
  })
}

/**
 * Provider account adapters live here instead of the UI so adding a new vendor
 * never requires changing the connection screen. OpenAI-compatible APIs do not
 * have a standard balance endpoint, therefore only documented providers appear.
 */
export async function fetchProviderCredits(settings: Pick<ApiRequestSettings, 'baseUrl' | 'apiKey'> & { balanceToken?: string }): Promise<ProviderCredits | null> {
  const normalizedBase = normalizedApiBaseUrl(settings.baseUrl)
  if (/api\.apimart\.ai|apimart\.ai/i.test(normalizedBase)) {
    const response = await fetch('https://api.apimart.ai/v1/balance', {
      headers: { Authorization: `Bearer ${settings.apiKey.trim()}`, Accept: 'application/json' },
    })
    if (!response.ok) throw new Error(await readError(response) || apiErrorSummary(response.status))
    const payload = await response.json() as { success?: unknown; message?: unknown; remain_balance?: unknown; unlimited_quota?: unknown }
    if (payload.success !== true) throw new Error(typeof payload.message === 'string' ? payload.message : '未能读取 APIMart 余额')
    if (payload.unlimited_quota === true) return { provider: 'APIMart', amount: Number.POSITIVE_INFINITY, unit: '无限额度', updatedAt: new Date().toISOString() }
    const amount = Number(payload.remain_balance)
    if (!Number.isFinite(amount) || amount < 0) throw new Error('APIMart 返回了无效的余额')
    return { provider: 'APIMart', amount, unit: '余额（账户币种）', updatedAt: new Date().toISOString() }
  }
  if (/api\.apiyi\.com|apiyi\.com/i.test(normalizedBase)) {
    const token = settings.balanceToken?.trim()
    if (!token) throw new Error('请填写 APIYI 个人中心生成的余额查询 AccessToken')
    const apiYiOrigin = new URL(normalizedBase).origin
    const response = await fetch(`${apiYiOrigin}/api/user/self`, {
      headers: { Accept: 'application/json', Authorization: token, 'Content-Type': 'application/json' },
    })
    if (!response.ok) throw new Error(await readError(response) || apiErrorSummary(response.status))
    const payload = await response.json() as { success?: unknown; message?: unknown; data?: { quota?: unknown } }
    if (payload.success !== true) throw new Error(typeof payload.message === 'string' ? payload.message : '未能读取 APIYI 余额')
    const quota = Number(payload.data?.quota)
    if (!Number.isFinite(quota) || quota < 0) throw new Error('APIYI 返回了无效的余额')
    return { provider: 'APIYI', amount: quota / 500_000, unit: 'USD', updatedAt: new Date().toISOString() }
  }
  if (!isGrsaiBaseUrl(settings.baseUrl) || !settings.apiKey.trim()) return null
  const apiKey = settings.apiKey.trim()
  const nodeOrigin = new URL(normalizedApiBaseUrl(settings.baseUrl)).origin
  const requestCredits = async () => {
    // Official GRS documentation provides this API-key-authenticated endpoint.
    // /client/openapi/getCredits is intentionally not used here: it requires the
    // separate account token from the GRS user-info page, not a generation key.
    const response = await fetch(`${nodeOrigin}/client/common/getCredits?apikey=${encodeURIComponent(apiKey)}`, {
      method: 'GET',
    })
    if (!response.ok) throw new Error(await readError(response) || apiErrorSummary(response.status))
    const payload = await response.json() as { code?: unknown; msg?: unknown; data?: unknown }
    if (payload.code !== 0) throw new Error(typeof payload.msg === 'string' ? payload.msg : '未能读取 GRS AI 积分')
    const credits = payload.data && typeof payload.data === 'object'
      ? (payload.data as { credits?: unknown }).credits
      : undefined
    const amount = typeof credits === 'number' ? credits : typeof credits === 'string' ? Number(credits) : Number.NaN
    if (!Number.isFinite(amount) || amount < 0) throw new Error('GRS AI 返回了无效的积分余额')
    return amount
  }
  const amount = await requestCredits()
  return { provider: 'GRS AI', amount, unit: '积分', updatedAt: new Date().toISOString() }
}

/** Validate credentials without performing a billable generation request. */
export async function validateApiCredentials(settings: Pick<ApiRequestSettings, 'baseUrl' | 'apiKey'>): Promise<void> {
  const normalizedBase = normalizedApiBaseUrl(settings.baseUrl)
  if (!settings.apiKey.trim()) throw new Error('API Key 不能为空')
  const supplement = VENDOR_MODEL_SUPPLEMENTS.find((entry) => entry.match(normalizedBase))
  if (supplement?.catalogOnly) {
    // GRS documents this account endpoint specifically for querying an API key's
    // credit balance. It authenticates the supplied key without starting a
    // generation, unlike the static local catalog which proves nothing about it.
    let response: Response
    try {
      response = await fetch(grsaiControlEndpoint(settings.baseUrl, 'client/openapi/getAPIKeyCredits'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: settings.apiKey.trim() }),
      })
    } catch (error) {
      throw new Error(error instanceof Error ? `无法验证 GRS AI API Key：${error.message}` : '无法验证 GRS AI API Key，请检查地址和网络')
    }
    if (!response.ok) throw new Error(await readError(response) || apiErrorSummary(response.status))
    try {
      const payload = await response.json() as { code?: unknown; msg?: unknown; data?: unknown }
      if (payload.code !== 0) {
        throw new Error(typeof payload.msg === 'string' && payload.msg.trim() ? payload.msg : 'GRS AI API Key 无效或已失效')
      }
    } catch (error) {
      if (error instanceof Error) throw error
      throw new Error('GRS AI 未返回可确认的 API Key 校验结果')
    }
    return
  }
  let response: Response
  try {
    response = await fetch(endpoint(settings.baseUrl, 'models'), {
      headers: apiYiRelayHeaders(settings, { Authorization: `Bearer ${settings.apiKey.trim()}` }),
    })
  } catch (error) {
    throw new Error(error instanceof Error ? `无法连接接口：${error.message}` : '无法连接接口，请检查地址和网络')
  }
  if (!response.ok) throw new Error(await readError(response) || apiErrorSummary(response.status))
}

// Auto-enable current mainstream families when a provider actually exposes
// them to the user's key. This never invents catalog entries or bypasses the
// provider's model/group permissions.
const DEFAULT_TEXT_PATTERN = /gemini|deepseek|gpt/i
const DEFAULT_IMAGE_PATTERN = /nano(?:-banana)?|seedream|gpt-image/i
// Video families that should be enabled immediately after a successful model
// catalog refresh. The match is deliberately based on the provider's returned
// id/name, so it never creates a model the current key cannot access.
const DEFAULT_VIDEO_PATTERN = /seedance|veo|wan(?:2\.\d)?|happyhorse/i

export function isModelAutoEnabled(model: { id: string; name: string; capability: ModelCapability }): boolean {
  const haystack = `${model.id} ${model.name}`
  if (model.capability === 'text') return DEFAULT_TEXT_PATTERN.test(haystack)
  if (model.capability === 'image') return DEFAULT_IMAGE_PATTERN.test(haystack)
  return DEFAULT_VIDEO_PATTERN.test(haystack)
}

export function pickPreferredModelId(
  models: { id: string; name: string; capability: ModelCapability; enabled: boolean }[],
  kind: 'text' | 'image',
): string | undefined {
  const enabled = models.filter((model) => model.enabled && model.capability === kind)
  if (enabled.length === 0) return undefined
  if (kind === 'text') {
    return enabled.find((model) => /gpt/i.test(`${model.id} ${model.name}`))?.id
      ?? enabled.find((model) => /gemini/i.test(`${model.id} ${model.name}`))?.id
      ?? enabled[0].id
  }
  return enabled.find((model) => /gpt-image|image2/i.test(`${model.id} ${model.name}`))?.id
    ?? enabled.find((model) => /nano/i.test(`${model.id} ${model.name}`))?.id
    ?? enabled[0].id
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
        headers: apiYiRelayHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }),
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
  const isApiYiSeedream = /api\.apiyi\.com|apiyi\.com/i.test(settings.baseUrl) && /seedream/i.test(settings.model)
  const body: Record<string, unknown> = {
    model: settings.model,
    prompt: options.prompt,
    ...(isApiYiSeedream ? {} : { n: options.count }),
    size: compatibleSize,
  }
  // APIYI's Seedream endpoint uses resolution presets. A 1024x1024 OpenAI
  // default is invalid for Seedream 5.x (and pro requires 1K/2K presets).
  if (/api\.apiyi\.com|apiyi\.com/i.test(settings.baseUrl) && /seedream/i.test(settings.model)) {
    const requested = options.resolution ?? '2K'
    body.size = /pro/i.test(settings.model)
      ? (requested === '4K' ? '2K' : requested)
      : (requested === '1K' || requested === '4K' ? '2K' : requested)
    body.watermark = false
    body.output_format = 'png'
  }
  if (options.aspectRatio && options.aspectRatio !== 'auto' && !isApiYiSeedream) body.aspect_ratio = options.aspectRatio
  if (options.resolution && !isApiYiSeedream) body.resolution = options.resolution
  if (options.detail && !isApiYiSeedream) body.quality = options.detail
  if (!/gpt-image/i.test(settings.model)) body.response_format = 'url'
  const referenceImages = options.referenceImages?.filter(Boolean) ?? []
  const useGrsaiUnifiedImage = isGrsaiBaseUrl(settings.baseUrl)
  const useStandardImageEdit = !useGrsaiUnifiedImage && referenceImages.length > 0 && /(?:gpt-image|chatgpt-image)/i.test(settings.model)
  // GRS documents `images` as raw Base64 or URL values. A browser Data URL
  // includes a MIME header that its upload worker does not decode reliably.
  const grsaiReferenceImages = referenceImages.map((source) => {
    const dataUrl = /^data:image\/(?:png|jpe?g);base64,([\s\S]+)$/i.exec(source)
    return dataUrl ? dataUrl[1].replace(/\s/g, '') : source
  })
  const isGrsaiGptImage = /(?:gpt-image|chatgpt-image)/i.test(settings.model)
  const grsaiRequestBody: Record<string, unknown> = {
    model: settings.model,
    prompt: options.prompt,
    images: grsaiReferenceImages,
    // GRS uses two schemas on this unified endpoint: GPT Image expects pixel
    // dimensions, while Nano Banana expects a ratio plus imageSize.
    aspectRatio: isGrsaiGptImage
      ? compatibleSize
      : options.aspectRatio && options.aspectRatio !== 'auto' ? options.aspectRatio : '1:1',
    // Async mode returns a task ID immediately. Polling that ID avoids losing
    // successful images when a long-lived synchronous connection is interrupted.
    replyType: 'async',
  }
  if (!isGrsaiGptImage) grsaiRequestBody.imageSize = options.resolution ?? '1K'
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
          ...Object.fromEntries(apiYiRelayHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }).entries()),
          'Content-Type': 'application/json',
          ...(isApiYiSeedream ? { 'Accept-Encoding': 'identity' } : {}),
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
        headers: apiYiRelayHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }),
        body: form,
        signal: options.signal,
      })
    } else {
      if (referenceImages.length) {
        // APIYI Seedream uses `image` URL/base64 array on the same generations
        // endpoint; `image_urls` is not part of its documented schema.
        if (isApiYiSeedream) {
          body.image = referenceImages
          if (!/pro/i.test(settings.model)) body.sequential_image_generation = 'disabled'
        } else body.image_urls = referenceImages
      }
      response = await fetch(endpoint(settings.baseUrl, 'images/generations'), {
        method: 'POST',
        signal: options.signal,
        headers: {
          ...Object.fromEntries(apiYiRelayHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }).entries()),
          'Content-Type': 'application/json',
          ...(isApiYiSeedream ? { 'Accept-Encoding': 'identity' } : {}),
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
        ...Object.fromEntries(apiYiRelayHeaders(settings, { Authorization: `Bearer ${settings.apiKey}` }).entries()),
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
