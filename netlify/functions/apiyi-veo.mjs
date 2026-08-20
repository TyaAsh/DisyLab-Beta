/** Same-origin relay for APIYI Veo submit/poll/content endpoints. */
export default async (request, context) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
  const path = new URL(request.url).pathname
    .replace(/^\/apiyi\/veo/, '')
    .replace(/^\/\.netlify\/functions\/apiyi-veo/, '') || '/'
  const requestedOrigin = request.headers.get('x-disylab-apiyi-origin') || 'https://api.apiyi.com'
  let host
  try { host = new URL(requestedOrigin).hostname.toLowerCase() } catch { return Response.json({ error: { message: 'APIYI 上游地址无效' } }, { status: 400, headers: corsHeaders() }) }
  if (!['api.apiyi.com', 'vip.apiyi.com', 'b.apiyi.com'].includes(host)) return Response.json({ error: { message: '不支持的 APIYI 上游节点' } }, { status: 400, headers: corsHeaders() })
  const target = `https://${host}${path}${new URL(request.url).search}`
  const headers = new Headers(request.headers)
  headers.delete('host')
  headers.delete('content-length')
  headers.delete('content-encoding')
  headers.delete('connection')
  headers.delete('x-disylab-apiyi-origin')
  headers.set('Accept-Encoding', 'identity')
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : await request.arrayBuffer(),
    })
    const outputHeaders = new Headers(corsHeaders())
    for (const name of ['content-type', 'content-length', 'cache-control', 'x-request-id', 'x-shellapi-request-id']) {
      const value = upstream.headers.get(name)
      if (value) outputHeaders.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers: outputHeaders })
  } catch (error) {
    return Response.json({ error: { message: `APIYI 上游连接失败：${error instanceof Error ? error.message : String(error)}` } }, { status: 502, headers: { ...corsHeaders(), 'x-disylab-relay-error': 'upstream-fetch-failed' } })
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
