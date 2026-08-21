const ALLOWED_HOSTS = new Set(['visionary.beer', 'api.visionary.beer'])
const MAX_REQUEST_BYTES = 20 * 1024 * 1024
const MAX_RESPONSE_BYTES = 100 * 1024 * 1024

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    setCors(response)
    return response.status(204).end()
  }
  setCors(response)
  const requestedBase = String(request.headers['x-disylab-visionary-base'] ?? 'https://api.visionary.beer/v1')
  let base
  try { base = new URL(requestedBase) } catch { return response.status(400).json({ error: { message: 'Visionary 上游地址无效' } }) }
  if (base.protocol !== 'https:' || !ALLOWED_HOSTS.has(base.hostname.toLowerCase()) || base.username || base.password || base.port) {
    return response.status(400).json({ error: { message: '不支持的 Visionary 上游地址' } })
  }
  const declaredSize = Number(request.headers['content-length'])
  if (Number.isFinite(declaredSize) && declaredSize > MAX_REQUEST_BYTES) return response.status(413).json({ error: { message: '请求体过大' } })
  const path = Array.isArray(request.query.path) ? request.query.path.join('/') : String(request.query.path ?? '')
  const target = new URL(`${path}${request.url.includes('?') ? request.url.slice(request.url.indexOf('?')) : ''}`, `${base.origin}${base.pathname.replace(/\/$/, '')}/`)
  const headers = { ...request.headers, host: undefined, connection: undefined, 'content-length': undefined, 'x-disylab-visionary-base': undefined, 'accept-encoding': 'identity' }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 60_000)
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: ['GET', 'HEAD'].includes(request.method) ? undefined : JSON.stringify(request.body),
      signal: controller.signal,
    })
    const body = Buffer.from(await upstream.arrayBuffer())
    if (body.length > MAX_RESPONSE_BYTES) return response.status(502).json({ error: { message: '上游响应过大' } })
    response.status(upstream.status)
    for (const name of ['content-type', 'cache-control', 'x-request-id']) {
      const value = upstream.headers.get(name)
      if (value) response.setHeader(name, value)
    }
    return response.send(body)
  } catch (error) {
    return response.status(error?.name === 'AbortError' ? 504 : 502).json({ error: { message: error?.name === 'AbortError' ? 'Visionary 上游请求超时' : 'Visionary 上游连接失败' } })
  } finally {
    clearTimeout(timer)
  }
}

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,Idempotency-Key,X-DisyLab-Visionary-Base')
}
