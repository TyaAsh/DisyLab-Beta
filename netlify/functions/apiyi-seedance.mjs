/**
 * Same-origin relay for APIYI Seedance's browser-incompatible task endpoint.
 * The user's Bearer token is forwarded for this request only and is never
 * persisted by the function.
 */
export default async (request, context) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
  const path = new URL(request.url).pathname
    .replace(/^\/apiyi\/seedance/, '')
    .replace(/^\/\.netlify\/functions\/apiyi-seedance/, '') || '/'
  const requestedOrigin = String(request.headers.get('x-disylab-apiyi-origin') ?? '').trim()
  const requestedHost = requestedOrigin ? new URL(requestedOrigin).hostname.toLowerCase() : 'api.apiyi.com'
  const allowedHosts = new Set(['api.apiyi.com', 'vip.apiyi.com', 'b.apiyi.com'])
  if (!allowedHosts.has(requestedHost)) return Response.json({ error: { message: '不支持的 APIYI 上游节点' } }, { status: 400 })
  const target = `https://${requestedHost}${path}${new URL(request.url).search}`
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.delete('connection')
  headers.delete('x-disylab-apiyi-origin')
  headers.set('Accept-Encoding', 'identity')
  try {
    const response = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    })
    const outputHeaders = new Headers()
    const contentType = response.headers.get('content-type')
    if (contentType) outputHeaders.set('content-type', contentType)
    const requestId = response.headers.get('x-request-id') || response.headers.get('x-shellapi-request-id')
    if (requestId) outputHeaders.set('x-request-id', requestId)
    outputHeaders.set('Access-Control-Allow-Origin', '*')
    return new Response(response.body, { status: response.status, headers: outputHeaders })
  } catch (error) {
    const cause = error instanceof Error && error.cause instanceof Error ? ` (${error.cause.message})` : ''
    return Response.json(
      { error: { message: `APIYI 上游连接失败：${error instanceof Error ? error.message : String(error)}${cause}` } },
      { status: 502, headers: { ...corsHeaders(), 'x-disylab-relay-error': 'upstream-fetch-failed' } },
    )
  }
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-DisyLab-APIYI-Origin',
    'Access-Control-Max-Age': '86400',
  }
}
