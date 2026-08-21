import { corsHeaders, forwardRequest, isAllowedApiyiHost, jsonError } from './_relay-utils.mjs'

/** Same-origin relay for APIYI Seedance task endpoints. */
export default async (request) => {
  const cors = corsHeaders()
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/apiyi\/seedance/, '').replace(/^\/\.netlify\/functions\/apiyi-seedance/, '') || '/'
  const requestedOrigin = String(request.headers.get('x-disylab-apiyi-origin') ?? '').trim()
  let host = 'api.apiyi.com'
  try { if (requestedOrigin) host = new URL(requestedOrigin).hostname.toLowerCase() } catch { return jsonError('APIYI 上游地址无效', 400, cors) }
  if (!isAllowedApiyiHost(host)) return jsonError('不支持的 APIYI 上游节点', 400, cors)
  return forwardRequest(request, `https://${host}${path}${url.search}`, { cors, privateHeaders: ['x-disylab-apiyi-origin'] })
}
