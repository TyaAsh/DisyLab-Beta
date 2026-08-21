import { parseSkillManifest } from './manifestSchema'
import { OFFICIAL_IMAGE_SKILLS } from './manifests/official/image'
import { OFFICIAL_TEXT_SKILLS } from './manifests/official/text'
import { listUserSkillManifests } from './storage'
import type { SkillManifest } from './types'

export const officialSkills: SkillManifest[] = [...OFFICIAL_IMAGE_SKILLS, ...OFFICIAL_TEXT_SKILLS].map((skill) => parseSkillManifest(skill) as SkillManifest)

export async function listSkills(kind?: SkillManifest['kind']) {
  const all = [...officialSkills, ...await listUserSkillManifests()]
  return all.filter((skill) => skill.enabled && (!kind || skill.kind === kind))
}
