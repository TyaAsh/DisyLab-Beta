/** Same-origin media relay for short-lived APIYI result URLs. */
const MAX_MEDIA_BYTES = 250 * 1024 * 1024

export default async function handler(request, response) {
  if (request.method === 'OPTIONS') {
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS')
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type')
    response.status(204).end()
    return
  }
  if (request.method !== 'GET') {
    response.status(405).send('method not allowed')
    return
  }
  const target = String(request.query.url ?? '')
  if (!/^https:\/\//i.test(target)) {
    response.status(400).send('invalid media url')
    return
  }
  try {
    const targetUrl = new URL(target)
    if (targetUrl.protocol !== 'https:' || targetUrl.username || targetUrl.password || targetUrl.port) {
      response.status(400).send('invalid media url')
      return
    }
    if (!/(?:^|\.)apiyi\.com$|(?:^|\.)volces\.com$|(?:^|\.)aliyuncs\.com$|(?:^|\.)visionary\.beer$/i.test(targetUrl.hostname)) {
      response.status(403).send('media host not allowed')
      return
    }
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 60_000)
    let upstream
    try {
      upstream = await fetch(targetUrl, { headers: { 'Accept-Encoding': 'identity' }, signal: controller.signal })
    } finally {
      clearTimeout(timer)
    }
    const declaredSize = Number(upstream.headers.get('content-length'))
    if (Number.isFinite(declaredSize) && declaredSize > MAX_MEDIA_BYTES) {
      response.status(502).send('upstream response too large')
      return
    }
    const body = Buffer.from(await upstream.arrayBuffer())
    if (body.length > MAX_MEDIA_BYTES) {
      response.status(502).send('upstream response too large')
      return
    }
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.status(upstream.status)
    const contentType = upstream.headers.get('content-type')
    if (contentType) response.setHeader('content-type', contentType)
    const contentLength = upstream.headers.get('content-length')
    if (contentLength) response.setHeader('content-length', contentLength)
    response.send(body)
  } catch {
    response.status(502).send('media upstream connection failed')
  }
}
