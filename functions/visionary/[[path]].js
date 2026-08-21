const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,HEAD,POST,OPTIONS',
  'Access-Control-Allow-Headers': 'Authorization,Content-Type,Idempotency-Key,X-DisyLab-Visionary-Base',
  'Access-Control-Max-Age': '86400',
}

/** Same-origin Cloudflare Pages relay for Visionary's async image API. */
export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS })
  if (!['GET', 'HEAD', 'POST'].includes(request.method)) return new Response('method not allowed', { status: 405, headers: CORS })

  let base
  try { base = new URL(request.headers.get('x-disylab-visionary-base') || 'https://api.visionary.beer/v1') } catch {
    return Response.json({ error: { message: 'Visionary 上游地址无效' } }, { status: 400, headers: CORS })
  }
  if (base.protocol !== 'https:' || base.hostname.toLowerCase() !== 'api.visionary.beer' || base.username || base.password || base.port || !/^\/v1(?:\/|$)/.test(base.pathname)) {
    return Response.json({ error: { message: '不支持的 Visionary 上游地址' } }, { status: 400, headers: CORS })
  }

  const requestUrl = new URL(request.url)
  const path = requestUrl.pathname.replace(/^\/visionary\/?/, '').replace(/^\/+/, '')
  const target = new URL(path + requestUrl.search, `${base.origin}${base.pathname.replace(/\/$/, '')}/`)
  const headers = new Headers(request.headers)
  for (const name of ['host', 'content-length', 'content-encoding', 'connection', 'x-disylab-visionary-base']) headers.delete(name)
  headers.set('accept-encoding', 'identity')
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      body: request.method === 'GET' || request.method === 'HEAD' ? undefined : request.body,
    })
    const outputHeaders = new Headers(CORS)
    for (const name of ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified', 'x-request-id']) {
      const value = upstream.headers.get(name)
      if (value) outputHeaders.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers: outputHeaders })
  } catch {
    return Response.json({ error: { message: 'Visionary 上游连接失败' } }, { status: 502, headers: CORS })
  }
}
