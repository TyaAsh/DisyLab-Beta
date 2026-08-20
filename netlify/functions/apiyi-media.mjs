/** Same-origin media relay for short-lived APIYI result URLs. */
export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
  if (request.method !== 'GET') return new Response('method not allowed', { status: 405 })
  const target = new URL(request.url).searchParams.get('url')
  if (!target || !/^https:\/\//i.test(target)) return new Response('invalid media url', { status: 400 })
  try {
    const targetUrl = new URL(target)
    if (!/(?:^|\.)apiyi\.com$|(?:^|\.)volces\.com$|(?:^|\.)aliyuncs\.com$/i.test(targetUrl.hostname)) return new Response('media host not allowed', { status: 403 })
    const upstream = await fetch(targetUrl, { headers: { 'Accept-Encoding': 'identity' } })
    const headers = new Headers({ 'Access-Control-Allow-Origin': '*' })
    for (const name of ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (error) {
    return new Response(error instanceof Error ? error.message : String(error), { status: 502 })
  }
}
