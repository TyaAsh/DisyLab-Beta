const APIYI_HOSTS = new Set(['api.apiyi.com', 'vip.apiyi.com', 'b.apiyi.com'])

export const RELAY_LIMITS = Object.freeze({
  requestBytes: 20 * 1024 * 1024,
  responseBytes: 100 * 1024 * 1024,
  timeoutMs: 60_000,
})

export function isAllowedApiyiHost(hostname) {
  return APIYI_HOSTS.has(String(hostname).toLowerCase())
}

export function corsHeaders(extraAllowedHeaders = '') {
  const allowedHeaders = ['Authorization', 'Content-Type', 'X-DisyLab-APIYI-Origin', 'X-DisyLab-APIYI-Base', extraAllowedHeaders]
    .filter(Boolean)
    .join(',')
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': allowedHeaders,
    'Access-Control-Max-Age': '86400',
  }
}

export function jsonError(message, status, headers = corsHeaders()) {
  return Response.json({ error: { message } }, { status, headers })
}

export async function readLimitedBody(request, maxBytes = RELAY_LIMITS.requestBytes) {
  if (request.method === 'GET' || request.method === 'HEAD') return undefined
  const declaredSize = Number(request.headers.get('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) throw new RelayLimitError('请求体过大', 413)
  const body = await request.arrayBuffer()
  if (body.byteLength > maxBytes) throw new RelayLimitError('请求体过大', 413)
  return body
}

export function sanitizeForwardHeaders(input, privateHeaders = []) {
  const headers = new Headers(input)
  for (const name of ['host', 'content-length', 'content-encoding', 'connection', ...privateHeaders]) headers.delete(name)
  headers.set('Accept-Encoding', 'identity')
  return headers
}

export async function fetchWithTimeout(url, init, timeoutMs = RELAY_LIMITS.timeoutMs) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

export function limitedResponseBody(response, maxBytes = RELAY_LIMITS.responseBytes) {
  const declaredSize = Number(response.headers.get('content-length'))
  if (Number.isFinite(declaredSize) && declaredSize > maxBytes) throw new RelayLimitError('上游响应过大', 502)
  if (!response.body) return null
  let received = 0
  return response.body.pipeThrough(new TransformStream({
    transform(chunk, controller) {
      received += chunk.byteLength
      if (received > maxBytes) {
        controller.error(new Error('upstream response exceeded relay limit'))
        return
      }
      controller.enqueue(chunk)
    },
  }))
}

export function copyResponseHeaders(upstream, cors = corsHeaders()) {
  const output = new Headers(cors)
  for (const name of ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified', 'x-request-id', 'x-shellapi-request-id']) {
    const value = upstream.headers.get(name)
    if (value) output.set(name, value)
  }
  return output
}

export class RelayLimitError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

export function relayFailure(error, headers = corsHeaders()) {
  if (error instanceof RelayLimitError) return jsonError(error.message, error.status, headers)
  const timedOut = error instanceof DOMException && error.name === 'AbortError'
  return jsonError(timedOut ? 'APIYI 上游请求超时' : 'APIYI 上游连接失败', timedOut ? 504 : 502, {
    ...headers,
    'x-disylab-relay-error': timedOut ? 'upstream-timeout' : 'upstream-fetch-failed',
  })
}

export async function forwardRequest(request, target, { privateHeaders = [], cors = corsHeaders(), maxResponseBytes } = {}) {
  try {
    const body = await readLimitedBody(request)
    const upstream = await fetchWithTimeout(target, {
      method: request.method,
      headers: sanitizeForwardHeaders(request.headers, privateHeaders),
      body,
    })
    return new Response(limitedResponseBody(upstream, maxResponseBytes), {
      status: upstream.status,
      headers: copyResponseHeaders(upstream, cors),
    })
  } catch (error) {
    return relayFailure(error, cors)
  }
}
