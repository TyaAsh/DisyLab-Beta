import { corsHeaders, forwardRequest, jsonError } from './_relay-utils.mjs'

const ALLOWED_HOSTS = new Set(['visionary.beer', 'api.visionary.beer'])

/** Restricted same-origin relay for Visionary submit and task-query endpoints. */
export default async (request) => {
  const cors = corsHeaders('Idempotency-Key,X-DisyLab-Visionary-Base')
  if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
  const url = new URL(request.url)
  const path = url.pathname.replace(/^\/visionary\/?/, '').replace(/^\/\.netlify\/functions\/visionary\/?/, '')
  const requestedBase = request.headers.get('x-disylab-visionary-base') || 'https://api.visionary.beer/v1'
  let base
  try { base = new URL(requestedBase) } catch { return jsonError('Visionary 上游地址无效', 400, cors) }
  if (base.protocol !== 'https:' || !ALLOWED_HOSTS.has(base.hostname.toLowerCase()) || base.username || base.password || base.port) {
    return jsonError('不支持的 Visionary 上游地址', 400, cors)
  }
  const target = new URL(path + url.search, `${base.origin}${base.pathname.replace(/\/$/, '')}/`)
  return forwardRequest(request, target, { cors, privateHeaders: ['x-disylab-visionary-base'] })
}
