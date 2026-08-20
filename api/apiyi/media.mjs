/** Same-origin media relay for short-lived APIYI result URLs. */
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
    if (!/(?:^|\.)apiyi\.com$|(?:^|\.)volces\.com$|(?:^|\.)aliyuncs\.com$/i.test(targetUrl.hostname)) {
      response.status(403).send('media host not allowed')
      return
    }
    const upstream = await fetch(targetUrl, { headers: { 'Accept-Encoding': 'identity' } })
    response.setHeader('Access-Control-Allow-Origin', '*')
    response.status(upstream.status)
    const contentType = upstream.headers.get('content-type')
    if (contentType) response.setHeader('content-type', contentType)
    const contentLength = upstream.headers.get('content-length')
    if (contentLength) response.setHeader('content-length', contentLength)
    response.send(Buffer.from(await upstream.arrayBuffer()))
  } catch (error) {
    response.status(502).send(error instanceof Error ? error.message : String(error))
  }
}
