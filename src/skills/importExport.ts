import { parseSkillManifest } from './manifestSchema'
import type { SkillManifest } from './types'

const MAX_SKILL_BYTES = 256 * 1024
const forbidden = new Set(['baseurl', 'apikey', 'headers', 'endpoint', 'fetch', 'script', 'adapter', 'default_params'])

function rejectForbidden(value: unknown, path = 'manifest') {
  if (!value || typeof value !== 'object') return
  for (const [key, child] of Object.entries(value)) {
    if (forbidden.has(key.toLowerCase())) throw new Error(`${path}.${key} 是禁止字段`)
    rejectForbidden(child, `${path}.${key}`)
  }
}

export async function importSkillFile(file: File): Promise<SkillManifest> {
  if (file.size > MAX_SKILL_BYTES) throw new Error(`${file.name} 超过 256KB`)
  if (!/\.(?:json|disy-skill\.json)$/i.test(file.name)) throw new Error(`${file.name} 不是 .json / .disy-skill.json`)
  let value: unknown
  try { value = JSON.parse(await file.text()) } catch { throw new Error(`${file.name} 不是有效 JSON`) }
  rejectForbidden(value)
  const parsed = parseSkillManifest(value)
  const now = Date.now()
  return parseSkillManifest({
    ...parsed, id: parsed.source === 'official' ? `user.${crypto.randomUUID()}` : parsed.id,
    source: 'user', createdAt: parsed.createdAt || now, updatedAt: now,
  }) as SkillManifest
}
