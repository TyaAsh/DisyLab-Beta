/** Same-origin relay for APIYI's OpenAI-compatible /v1 endpoints. */
export const config = { api: { bodyParser: false } }

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    response.status(204)
    setCors(response)
    response.end()
    return
  }
  const path = (Array.isArray(request.query.path) ? request.query.path.join('/') : String(request.query.path ?? '')).replace(/^v1(?:beta)?\//i, '')
  const requestedBase = String(request.headers['x-disylab-apiyi-base'] ?? 'https://api.apiyi.com/v1')
  let base
  try { base = new URL(requestedBase) } catch { setCors(response); response.status(400).json({ error: { message: 'APIYI 上游地址无效' } }); return }
  if (!allowedHost(base.hostname) || !/^\/v1(?:beta)?(?:\/|$)/i.test(base.pathname)) { setCors(response); response.status(400).json({ error: { message: '不支持的 APIYI 上游节点或路径' } }); return }
  const query = new URL(request.url, 'http://localhost').search
  const target = new URL(path + query, `${base.origin}${base.pathname.replace(/\/$/, '')}/`)
  const forwardedHeaders = { ...request.headers }
  for (const name of ['host', 'content-length', 'content-encoding', 'connection', 'x-disylab-apiyi-origin', 'x-disylab-apiyi-base']) delete forwardedHeaders[name]
  forwardedHeaders['accept-encoding'] = 'identity'
  let body
  if (request.method !== 'GET' && request.method !== 'HEAD') body = await readBody(request)
  try {
    const upstream = await fetch(target, { method: request.method, headers: forwardedHeaders, body })
    setCors(response)
    for (const name of ['content-type', 'content-length', 'cache-control', 'x-request-id', 'x-shellapi-request-id']) {
      const value = upstream.headers.get(name)
      if (value) response.setHeader(name, value)
    }
    response.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    setCors(response)
    response.setHeader('x-disylab-relay-error', 'upstream-fetch-failed')
    response.status(502).json({ error: { message: `APIYI 上游连接失败：${error instanceof Error ? error.message : String(error)}` } })
  }
}

function readBody(request) {
  if (typeof request.body === 'string' || Buffer.isBuffer(request.body)) return Promise.resolve(request.body)
  if (request.body && typeof request.body === 'object' && !request.readable) return Promise.resolve(JSON.stringify(request.body))
  return new Promise((resolve, reject) => {
    const chunks = []
    request.on('data', (chunk) => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)))
    request.on('end', () => resolve(Buffer.concat(chunks)))
    request.on('error', reject)
  })
}

function allowedHost(hostname) {
  return new Set(['api.apiyi.com', 'vip.apiyi.com', 'b.apiyi.com']).has(hostname.toLowerCase())
}

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-DisyLab-APIYI-Origin,X-DisyLab-APIYI-Base')
  response.setHeader('Access-Control-Max-Age', '86400')
}
