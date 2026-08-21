import { corsHeaders, forwardRequest, isAllowedApiyiHost, jsonError } from './_relay-utils.mjs'

/** Same-origin relay for APIYI's OpenAI-compatible /v1 endpoints. */
export default async (request) => {
  const cors = corsHeaders()
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/apiyi\/openai\/?/, '').replace(/^\/\.netlify\/functions\/apiyi-openai\/?/, '').replace(/^v1(?:beta)?\//i, '')
  const requestedBase = request.headers.get('x-disylab-apiyi-base') || 'https://api.apiyi.com/v1'
  let base
  try { base = new URL(requestedBase) } catch { return jsonError('APIYI 上游地址无效', 400, cors) }
  if (!isAllowedApiyiHost(base.hostname) || !/^\/v1(?:beta)?(?:\/|$)/i.test(base.pathname)) return jsonError('不支持的 APIYI 上游节点或路径', 400, cors)
  const target = new URL(path + url.search, `${base.origin}${base.pathname.replace(/\/$/, '')}/`)
  return forwardRequest(request, target, { cors, privateHeaders: ['x-disylab-apiyi-origin', 'x-disylab-apiyi-base'] })
}
