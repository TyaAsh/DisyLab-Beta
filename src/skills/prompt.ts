import Handlebars from 'handlebars'
import type { SkillManifest } from './types'

export function renderSkillPrompt(skill: SkillManifest, subject: string, overrides: Record<string, string | number | boolean> = {}) {
  const defaults = Object.fromEntries(skill.parameters.map((parameter) => [
    parameter.name,
    parameter.bind === 'prompt' ? subject : parameter.default,
  ]))
  const template = Handlebars.compile(skill.template.prompt, { noEscape: true, strict: true })
  const parameterGuide = skill.parameters
    .filter((parameter) => parameter.bind !== 'prompt' && overrides[parameter.name] !== undefined)
    .map((parameter) => `${parameter.label}：${String(overrides[parameter.name])}`)
    .join('\n')
  return `${template({ subject, ...defaults, ...overrides })}${parameterGuide ? `\n\n执行参数：\n${parameterGuide}` : ''}`.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, 24000)
}
