export async function onRequest(context) {
  if (context.request.method === 'OPTIONS') return relayOptions()
  return relay(context, 'wan')
}
function relayOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,POST,PUT,PATCH,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Authorization,Content-Type,X-DisyLab-APIYI-Origin,X-DashScope-Async',
      'Access-Control-Max-Age': '86400',
    },
  })
}
async function relay({ request }, prefix) {
  const url = new URL(request.url); const origin = request.headers.get('x-disylab-apiyi-origin') || 'https://api.apiyi.com'
  let host; try { host = new URL(origin).hostname.toLowerCase() } catch { return Response.json({ error: { message: 'APIYI 上游地址无效' } }, { status: 400 }) }
  if (!['api.apiyi.com', 'vip.apiyi.com', 'b.apiyi.com'].includes(host)) return Response.json({ error: { message: '不支持的 APIYI 上游节点' } }, { status: 400 })
  const path = url.pathname.replace(new RegExp(`^/apiyi/${prefix}/?`), '')
  const headers = new Headers(request.headers); headers.delete('host'); headers.delete('content-length'); headers.delete('content-encoding'); headers.delete('connection'); headers.delete('x-disylab-apiyi-origin'); headers.set('accept-encoding', 'identity')
  try {
    const response = await fetch(`https://${host}/${path}${url.search}`, { method: request.method, headers, body: ['GET', 'HEAD'].includes(request.method) ? undefined : request.body })
    const outputHeaders = new Headers()
    for (const name of ['content-type', 'content-length', 'cache-control', 'x-request-id', 'x-shellapi-request-id']) {
      const value = response.headers.get(name)
      if (value) outputHeaders.set(name, value)
    }
    outputHeaders.set('Access-Control-Allow-Origin', '*')
    return new Response(response.body, { status: response.status, headers: outputHeaders })
  } catch (error) {
    return Response.json({ error: { message: error instanceof Error ? error.message : String(error) } }, { status: 502, headers: { 'x-disylab-relay-error': 'upstream-fetch-failed', 'Access-Control-Allow-Origin': '*' } })
  }
}
