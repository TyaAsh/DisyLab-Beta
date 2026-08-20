/** Same-origin relay for APIYI's OpenAI-compatible /v1 endpoints. */
export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders() })
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/apiyi\/openai\/?/, '').replace(/^v1(?:beta)?\//i, '')
  const requestedBase = request.headers.get('x-disylab-apiyi-base') || 'https://api.apiyi.com/v1'
  let base
  try { base = new URL(requestedBase) } catch { return Response.json({ error: { message: 'APIYI 上游地址无效' } }, { status: 400, headers: corsHeaders() }) }
  if (!allowedHost(base.hostname) || !/^\/v1(?:beta)?(?:\/|$)/i.test(base.pathname)) return Response.json({ error: { message: '不支持的 APIYI 上游节点或路径' } }, { status: 400, headers: corsHeaders() })
  const target = new URL(path + url.search, `${base.origin}${base.pathname.replace(/\/$/, '')}/`).toString()
  const headers = new Headers(request.headers)
  for (const name of ['host', 'content-length', 'content-encoding', 'connection', 'x-disylab-apiyi-origin', 'x-disylab-apiyi-base']) headers.delete(name)
  headers.set('accept-encoding', 'identity')
  try {
    const upstream = await fetch(target, { method: request.method, headers, body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body })
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

function allowedHost(hostname) {
  return new Set(['api.apiyi.com', 'vip.apiyi.com', 'b.apiyi.com']).has(hostname.toLowerCase())
}

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
    'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-DisyLab-APIYI-Origin,X-DisyLab-APIYI-Base',
    'Access-Control-Max-Age': '86400',
  }
}
