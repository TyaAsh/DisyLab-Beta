export type ProviderImageResult = { url: string; revisedPrompt?: string }

const TASK_ID_KEYS = ['taskId', 'task_id', 'jobId', 'job_id', 'request_id', 'requestId'] as const
const STATUS_KEYS = ['status', 'state'] as const
const SUCCESS_STATES = new Set(['success', 'succeeded', 'completed', 'complete'])
const FAILURE_STATES = new Set(['failed', 'failure', 'error', 'expired', 'cancelled', 'canceled', 'violation'])

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null
}

function taskIdFromRecord(record: Record<string, unknown>, allowGenericId: boolean) {
  // Provider-specific task keys must win over a generic `id`. Some gateways
  // return both a response/image id and the paid task id in the same envelope.
  const keys = allowGenericId ? [...TASK_ID_KEYS, 'id'] : TASK_ID_KEYS
  for (const key of keys) {
    const value = record[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return ''
}

/** Extracts documented task identifiers without mistaking nested image IDs for jobs. */
export function extractProviderTaskId(payload: unknown): string {
  const root = asRecord(payload)
  if (!root) return ''
  const direct = taskIdFromRecord(root, false)
  if (direct) return direct
  const dataItems = Array.isArray(root.data) ? root.data : [root.data]
  for (const item of dataItems) {
    const record = asRecord(item)
    if (!record) continue
    const value = taskIdFromRecord(record, true)
    if (value) return value
  }
  const result = asRecord(root.result)
  const nested = result ? taskIdFromRecord(result, false) : ''
  if (nested) return nested
  return typeof root.id === 'string' ? root.id.trim() : ''
}

export function extractProviderTaskStatus(payload: unknown): string {
  const root = asRecord(payload)
  if (!root) return ''
  // Inspect the task payload before the outer transport envelope. An outer
  // `status: success` often only means the HTTP operation succeeded while the
  // nested paid task is still processing.
  const candidates: unknown[] = [...(Array.isArray(root.data) ? root.data : [root.data]), root.result, root]
  for (const candidate of candidates) {
    const record = asRecord(candidate)
    if (!record) continue
    for (const key of STATUS_KEYS) {
      const value = record[key]
      if (typeof value === 'string' && value.trim()) return value.trim().toLowerCase()
    }
  }
  return ''
}

export function extractProviderImages(payload: unknown): ProviderImageResult[] {
  const rows: ProviderImageResult[] = []
  const visited = new WeakSet<object>()
  const normalize = (value: unknown) => {
    if (typeof value !== 'string') return ''
    const candidate = value.trim()
    if (/^(?:https?:|blob:|data:image\/)/i.test(candidate)) return candidate
    if (candidate.length > 128 && /^[A-Za-z0-9+/=\r\n]+$/.test(candidate)) return `data:image/png;base64,${candidate.replace(/\s/g, '')}`
    return ''
  }
  const push = (value: unknown, revisedPrompt?: unknown) => {
    const url = normalize(value)
    if (!url) return false
    rows.push({ url, revisedPrompt: typeof revisedPrompt === 'string' ? revisedPrompt : undefined })
    return true
  }
  const visit = (value: unknown, depth = 0) => {
    if (depth > 12 || value == null) return
    if (typeof value === 'string') { push(value); return }
    if (Array.isArray(value)) { value.forEach((item) => visit(item, depth + 1)); return }
    if (typeof value !== 'object' || visited.has(value)) return
    visited.add(value)
    const record = value as Record<string, unknown>
    const revisedPrompt = record.revised_prompt ?? record.revisedPrompt
    for (const key of ['url', 'image_url', 'b64_json', 'b64', 'base64']) {
      if (push(record[key], revisedPrompt)) break
      if (Array.isArray(record[key])) visit(record[key], depth + 1)
    }
    for (const key of ['data', 'images', 'image', 'urls', 'output', 'outputs', 'result', 'results', 'artifacts', 'content']) {
      if (key in record) visit(record[key], depth + 1)
    }
  }
  visit(payload)
  return rows
}

export type ProviderPayloadState = 'result' | 'pending' | 'success_without_result' | 'failed' | 'unknown'

/** Common read-only task lookup paths used when a provider omits a poll URL. */
export function providerTaskPollPaths(taskId: string): string[] {
  const encoded = encodeURIComponent(taskId.trim())
  if (!encoded) return []
  return [`tasks/${encoded}`, `jobs/${encoded}`, `requests/${encoded}`, `images/generations/${encoded}`]
}

export function classifyProviderPayload(payload: unknown): ProviderPayloadState {
  if (extractProviderImages(payload).length) return 'result'
  const status = extractProviderTaskStatus(payload)
  if (FAILURE_STATES.has(status)) return 'failed'
  if (SUCCESS_STATES.has(status)) return 'success_without_result'
  if (extractProviderTaskId(payload) || status) return 'pending'
  return 'unknown'
}
