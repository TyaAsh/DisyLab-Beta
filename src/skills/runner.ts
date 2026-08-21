import { renderSkillPrompt } from './prompt'
import type { SkillManifest } from './types'

export type PreparedImageSkill = { prompt: string; aspectRatio?: string; negativePrompt?: string }

/** Maps a validated manifest onto the existing image-node options. It never performs network requests. */
export function prepareImageSkill(skill: SkillManifest, subject: string, values: Record<string, string | number | boolean> = {}): PreparedImageSkill {
  if (!skill.enabled) throw new Error('Skill 已停用')
  if (skill.kind !== 'image' && skill.kind !== 'storyboard_comic') throw new Error('该 Skill 不能在图像节点运行')
  if (!skill.capability.allowedModelCapabilities.includes('image')) throw new Error('该 Skill 不支持图像模型')
  const aspectParameter = skill.parameters.find((parameter) => parameter.bind === 'aspectRatio')
  const aspectRatio = values[aspectParameter?.name ?? 'aspectRatio'] ?? aspectParameter?.default
  return {
    prompt: renderSkillPrompt(skill, subject, values),
    aspectRatio: typeof aspectRatio === 'string' ? aspectRatio : undefined,
    negativePrompt: skill.template.negativePrompt,
  }
}
