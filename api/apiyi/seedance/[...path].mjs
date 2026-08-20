/** Same-origin relay for APIYI Seedance on Vercel deployments. */
export default async function handler(request, response) {
  if (request.method === 'OPTIONS') { setCors(response); return response.status(204).end() }
  const path = Array.isArray(request.query.path) ? request.query.path.join('/') : String(request.query.path ?? '')
  const requestedOrigin = String(request.headers['x-disylab-apiyi-origin'] ?? '').trim()
  const requestedHost = requestedOrigin ? new URL(requestedOrigin).hostname.toLowerCase() : 'api.apiyi.com'
  const allowedHosts = new Set(['api.apiyi.com', 'vip.apiyi.com', 'b.apiyi.com'])
  if (!allowedHosts.has(requestedHost)) return response.status(400).json({ error: { message: '不支持的 APIYI 上游节点' } })
  const query = new URL(request.url, 'http://localhost').search
  const target = `https://${requestedHost}/${path}${query}`
  const { host: _host, ...forwardedHeaders } = request.headers
  delete forwardedHeaders['content-length']
  delete forwardedHeaders['content-encoding']
  delete forwardedHeaders.connection
  delete forwardedHeaders['x-disylab-apiyi-origin']
  const headers = { ...forwardedHeaders, 'accept-encoding': 'identity' }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD'
        ? undefined
        : typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {}),
    })
    setCors(response)
    response.status(upstream.status)
    const contentType = upstream.headers.get('content-type')
    if (contentType) response.setHeader('content-type', contentType)
    const requestId = upstream.headers.get('x-request-id') || upstream.headers.get('x-shellapi-request-id')
    if (requestId) response.setHeader('x-request-id', requestId)
    response.send(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    response.setHeader('x-disylab-relay-error', 'upstream-fetch-failed')
    const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : ''
    response.status(502).json({ error: { message: `APIYI 上游连接失败：${error instanceof Error ? error.message : String(error)}${cause}` } })
  }
}

function setCors(response) {
  response.setHeader('Access-Control-Allow-Origin', '*')
  response.setHeader('Access-Control-Allow-Methods', 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS')
  response.setHeader('Access-Control-Allow-Headers', 'Authorization,Content-Type,X-DisyLab-APIYI-Origin')
  response.setHeader('Access-Control-Max-Age', '86400')
}
