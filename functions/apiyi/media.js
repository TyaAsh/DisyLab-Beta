export async function onRequest({ request }) {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' } })
  if (request.method !== 'GET') return new Response('method not allowed', { status: 405 })
  const target = new URL(request.url).searchParams.get('url') || ''
  if (!/^https:\/\//i.test(target)) return new Response('invalid media url', { status: 400 })
  let parsed
  try { parsed = new URL(target) } catch { return new Response('invalid media url', { status: 400 }) }
  if (parsed.username || parsed.password || parsed.port) return new Response('invalid media url', { status: 400 })
  if (!/(?:^|\.)apiyi\.com$|(?:^|\.)volces\.com$|(?:^|\.)aliyuncs\.com$|(?:^|\.)visionary\.beer$/i.test(parsed.hostname)) return new Response('media host not allowed', { status: 403 })
  try {
    const upstream = await fetch(parsed, { headers: { 'Accept-Encoding': 'identity' } })
    const headers = new Headers()
    for (const name of ['content-type', 'content-length', 'cache-control', 'etag', 'last-modified']) {
      const value = upstream.headers.get(name)
      if (value) headers.set(name, value)
    }
    headers.set('Access-Control-Allow-Origin', '*')
    return new Response(upstream.body, { status: upstream.status, headers })
  } catch (error) { return new Response(error instanceof Error ? error.message : String(error), { status: 502 }) }
}
