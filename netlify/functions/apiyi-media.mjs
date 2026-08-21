import { copyResponseHeaders, fetchWithTimeout, limitedResponseBody, relayFailure, RELAY_LIMITS } from './_relay-utils.mjs'

const MEDIA_HOST_SUFFIXES = ['apiyi.com', 'volces.com', 'aliyuncs.com', 'visionary.beer']
const MEDIA_MAX_BYTES = 250 * 1024 * 1024
const MEDIA_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
}

/** Same-origin media relay for short-lived APIYI result URLs. */
export default async (request) => {
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: MEDIA_CORS })
  if (request.method !== 'GET') return new Response('method not allowed', { status: 405, headers: MEDIA_CORS })
  const target = new URL(request.url).searchParams.get('url')
  let targetUrl
  try { targetUrl = target ? new URL(target) : null } catch { targetUrl = null }
  if (!targetUrl || targetUrl.protocol !== 'https:' || targetUrl.username || targetUrl.password || targetUrl.port) return new Response('invalid media url', { status: 400, headers: MEDIA_CORS })
  const hostname = targetUrl.hostname.toLowerCase()
  if (!MEDIA_HOST_SUFFIXES.some((suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`))) return new Response('media host not allowed', { status: 403, headers: MEDIA_CORS })
  try {
    const upstream = await fetchWithTimeout(targetUrl, { headers: { 'Accept-Encoding': 'identity' } }, RELAY_LIMITS.timeoutMs)
    return new Response(limitedResponseBody(upstream, MEDIA_MAX_BYTES), {
      status: upstream.status,
      headers: copyResponseHeaders(upstream, MEDIA_CORS),
    })
  } catch (error) {
    return relayFailure(error, MEDIA_CORS)
  }
}
