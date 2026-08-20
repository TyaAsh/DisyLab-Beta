/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab-Canvas
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
export type AgentMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  references?: AgentImageReference[]
  textNode?: {
    title: string
    content: string
    nodeId?: string
  }
}

export type AgentImageReference = {
  nodeId: string
  name: string
  url: string
  kind?: 'image' | 'video'
  autoResolved?: boolean
  resolutionReason?: string
}

export type AgentContextReference = {
  nodeId: string
  name: string
  kind: 'image' | 'video' | 'text'
  url?: string
  excerpt?: string
  autoResolved?: boolean
  resolutionReason?: string
}

export type AgentStyleReference = {
  id: string
  name: string
  url: string
}

export type AgentInvokedStylePreset = {
  id: string
  name: string
  keyword: string
  references: AgentStyleReference[]
}

export type AgentImagePlan = {
  id: string
  status: 'proposed' | 'ready' | 'running' | 'completed' | 'failed' | 'cancelled'
  label?: string
  prompt: string
  referenceNodeIds: string[]
  references?: AgentImageReference[]
  contextReferences?: AgentContextReference[]
  invokedStyleReferences?: AgentStyleReference[]
  styleInvocationWord?: string
  invokedStylePresets?: AgentInvokedStylePreset[]
  aspectRatio: string
  resolution: string
  detail: string
  count: number
  imageConnectionId?: string
  imageModelId?: string
  assistantMessageId?: string
  createdAt?: string
  collapsed?: boolean
  nodeId?: string
  results?: Array<{
    id: string
    url: string
    fileName: string
    mediaId?: string
  }>
  error?: string
}

export type AgentVideoPlan = {
  id: string
  mediaKind: 'video'
  status: 'ready' | 'running' | 'completed' | 'failed' | 'cancelled'
  label?: string
  prompt: string
  referenceNodeIds: string[]
  references?: AgentImageReference[]
  contextReferences?: AgentContextReference[]
  invokedStyleReferences?: AgentStyleReference[]
  styleInvocationWord?: string
  invokedStylePresets?: AgentInvokedStylePreset[]
  aspectRatio: string
  resolution: string
  duration: number
  count: number
  generationMode?: 'text' | 'image' | 'frames' | 'reference' | 'omni'
  videoConnectionId?: string
  videoModelId?: string
  assistantMessageId?: string
  createdAt?: string
  nodeId?: string
  error?: string
}

export type AgentTextPlan = {
  id: string
  status: 'ready' | 'completed' | 'cancelled'
  title: string
  content: string
  contextReferences?: AgentContextReference[]
  assistantMessageId?: string
  createdAt?: string
  nodeId?: string
}

export type AgentConversation = {
  id: string
  title: string
  messages: AgentMessage[]
  createdAt: string
  updatedAt: string
}

export interface CanvasAgentService {
  sendMessage(conversation: AgentConversation, message: string): Promise<AgentConversation>
}

export type AgentReply = {
  reply: string
  imagePlan?: AgentImagePlanDraft
  imagePlans?: AgentImagePlanDraft[]
  videoPlan?: AgentVideoPlanDraft
  videoPlans?: AgentVideoPlanDraft[]
  textNode?: {
    title: string
    content: string
  }
}

export type AgentImagePlanDraft = Pick<AgentImagePlan, 'prompt' | 'aspectRatio' | 'resolution' | 'detail' | 'count' | 'label'>
export type AgentVideoPlanDraft = Pick<AgentVideoPlan, 'prompt' | 'aspectRatio' | 'resolution' | 'duration' | 'count' | 'label'>

export function compactReferenceName(value: string, maxLength = 8) {
  const characters = Array.from(value.trim())
  return characters.length > maxLength ? `${characters.slice(0, maxLength).join('')}...` : value.trim()
}

const CHINESE_DIGITS: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }

function parsePlanCountText(value: string) {
  if (/^\d+$/.test(value)) {
    const count = Number(value)
    return Number.isSafeInteger(count) && count > 0 ? count : null
  }
  if (value === '十') return 10
  const [tensText, onesText] = value.split('十')
  if (onesText !== undefined) {
    const tens = tensText ? CHINESE_DIGITS[tensText] : 1
    const ones = onesText ? CHINESE_DIGITS[onesText] : 0
    return tens !== undefined && ones !== undefined ? tens * 10 + ones : null
  }
  return CHINESE_DIGITS[value] ?? null
}

export function getRequestedAgentPlanCount(content: string) {
  const match = content.match(/(?:给|要|来|出|提供|做|准备|整理|生成|想要)?\s*(\d+|[一二两三四五六七八九十]+)\s*(?:个|套|份|种|款)?\s*(?:方案|方向|创意|版本)/i)
  return match ? parsePlanCountText(match[1]) : null
}

export function messageRequestsDirectImagePlan(content: string) {
  return /(?:不用|不要|无需)(?:再|先)?(?:选择|提供|给出|查看)?(?:任何|多个|这些|三套)?(?:方案|方向)/i.test(content)
    || /(?:直接|就|照着|按照|按我说的).{0,18}(?:生成|生图|出图|做|制作|设计|修复|修改)/i.test(content)
}

export function messageExpectsImagePlans(content: string) {
  const explicitImageIntent = /(?:生图|出图|绘图|画图|生成图片|生成图像|制作图片|制作海报|设计海报|视觉稿|效果图|封面图|配图)/i.test(content)
    || /(?:生成|制作|设计|创作|画|做|出)(?:.{0,10})(?:图像|图片|海报|视觉画面)/i.test(content)
  return explicitImageIntent
}

export function messageExpectsVideoPlans(content: string) {
  return /(?:生成|制作|创作|做|出|续写|延展).{0,12}(?:视频|短片|动画|动态画面)/i.test(content)
    || /(?:文生视频|图生视频|视频生成|生成视频)/i.test(content)
}

function extractFirstJsonContainer(value: string) {
  const objectStart = value.indexOf('{')
  const arrayStart = value.indexOf('[')
  const start = objectStart < 0 ? arrayStart : arrayStart < 0 ? objectStart : Math.min(objectStart, arrayStart)
  if (start < 0) return null
  const stack: string[] = []
  let quoted = false
  let escaped = false
  for (let index = start; index < value.length; index += 1) {
    const character = value[index]
    if (quoted) {
      if (escaped) escaped = false
      else if (character === '\\') escaped = true
      else if (character === '"') quoted = false
      continue
    }
    if (character === '"') quoted = true
    else if (character === '{') stack.push('}')
    else if (character === '[') stack.push(']')
    else if (character === '}' || character === ']') {
      if (stack.at(-1) !== character) return null
      stack.pop()
      if (!stack.length) return value.slice(start, index + 1)
    }
  }
  return null
}

function normalizeAgentReplyRecord(value: unknown): Record<string, unknown> | null {
  if (Array.isArray(value)) {
    const records = value.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === 'object' && !Array.isArray(item))
    const protocolRecords = records.filter((record) => ['reply', 'imagePlan', 'imagePlans', 'videoPlan', 'videoPlans', 'textNode'].some((field) => field in record))
    return protocolRecords.length ? Object.assign({}, ...protocolRecords) : null
  }
  return value && typeof value === 'object' ? value as Record<string, unknown> : null
}

function parseAgentReplyRecord(value: string) {
  const attempts = [value, extractFirstJsonContainer(value)].filter((item, index, items): item is string => Boolean(item) && items.indexOf(item) === index)
  for (const attempt of attempts) {
    try {
      let parsed: unknown = JSON.parse(attempt)
      if (typeof parsed === 'string') parsed = JSON.parse(parsed)
      const record = normalizeAgentReplyRecord(parsed)
      if (record) return record
    } catch {
      // Try the next cleaned JSON candidate.
    }
  }
  return null
}

function extractMalformedReply(value: string) {
  const match = value.match(/["']?reply["']?\s*:\s*["']((?:\\.|[^"'\\])*)["']/s)
  if (!match) return ''
  try {
    return (JSON.parse(`"${match[1]}"`) as string).trim()
  } catch {
    return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').trim()
  }
}

function looksLikeAgentProtocolPayload(value: string) {
  const cleaned = value.trim()
  const hasProtocolField = /(?:["']|\\["'])?(?:reply|imagePlans?|videoPlans?|textNode)(?:["']|\\["'])?\s*:/i.test(cleaned)
  if (!hasProtocolField) return false
  return /^```(?:json|js)?/i.test(cleaned)
    || /^[\[{"']/.test(cleaned)
    || /\{[\s\S]*(?:reply|imagePlans?|videoPlans?|textNode)\s*:/i.test(cleaned)
    || /^(?:reply|imagePlans?|videoPlans?|textNode)\s*:/i.test(cleaned)
    || /(?:^|\n)\s*(?:reply|imagePlans?|videoPlans?|textNode)\s*:/i.test(cleaned)
}

export function normalizeAgentMessageContent(content: string) {
  return looksLikeAgentProtocolPayload(content) ? parseAgentReply(content).reply : content
}

export function parseAgentReply(raw: string): AgentReply {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const value = parseAgentReplyRecord(cleaned)
    if (!value) throw new Error('Invalid Agent response payload')
    const reply = typeof value.reply === 'string' ? value.reply.trim() : ''
    const candidates = Array.isArray(value.imagePlans)
      ? value.imagePlans.filter((candidate): candidate is Record<string, unknown> => Boolean(candidate) && typeof candidate === 'object')
      : value.imagePlan && typeof value.imagePlan === 'object'
        ? [value.imagePlan as Record<string, unknown>]
        : []
    const imagePlans = candidates
      .map((candidate, index): AgentImagePlanDraft | null => {
        const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : ''
        if (!prompt) return null
        return {
          label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label.trim() : `方案${index + 1}`,
          prompt,
          aspectRatio: typeof candidate.aspectRatio === 'string' ? candidate.aspectRatio : '1:1',
          resolution: typeof candidate.resolution === 'string' ? candidate.resolution : '1K',
          detail: typeof candidate.detail === 'string' ? candidate.detail : 'medium',
          count: Math.min(4, Math.max(1, Number(candidate.count) || 1)),
        }
      })
      .filter((candidate): candidate is AgentImagePlanDraft => Boolean(candidate))
    const videoCandidates = Array.isArray(value.videoPlans)
      ? value.videoPlans.filter((candidate): candidate is Record<string, unknown> => Boolean(candidate) && typeof candidate === 'object')
      : value.videoPlan && typeof value.videoPlan === 'object'
        ? [value.videoPlan as Record<string, unknown>]
        : []
    const videoPlans = videoCandidates
      .map((candidate, index): AgentVideoPlanDraft | null => {
        const prompt = typeof candidate.prompt === 'string' ? candidate.prompt.trim() : ''
        if (!prompt) return null
        return {
          label: typeof candidate.label === 'string' && candidate.label.trim() ? candidate.label.trim() : `视频方案${index + 1}`,
          prompt,
          aspectRatio: typeof candidate.aspectRatio === 'string' ? candidate.aspectRatio : '16:9',
          resolution: typeof candidate.resolution === 'string' ? candidate.resolution : '720p',
          duration: Math.min(15, Math.max(4, Number(candidate.duration) || 4)),
          count: Math.min(4, Math.max(1, Number(candidate.count) || 1)),
        }
      })
      .filter((candidate): candidate is AgentVideoPlanDraft => Boolean(candidate))
    const rawTextNode = value.textNode && typeof value.textNode === 'object'
      ? value.textNode as Record<string, unknown>
      : null
    const textNodeContent = typeof rawTextNode?.content === 'string' ? rawTextNode.content.trim() : ''
    const textNode = textNodeContent
      ? {
          title: typeof rawTextNode?.title === 'string' && rawTextNode.title.trim() ? rawTextNode.title.trim() : 'Agent 文本',
          content: textNodeContent,
        }
      : undefined
    return {
      reply: reply
        || (imagePlans.length ? `我已整理好${imagePlans.length > 1 ? `${imagePlans.length}份` : '一份'}图像方案，请选择并确认后生成。` : '')
        || (videoPlans.length ? `我已整理好${videoPlans.length > 1 ? `${videoPlans.length}份` : '一份'}视频方案，请确认后生成。` : '')
        || (textNode ? '我已整理好最终文本，并放入画布文本节点。' : '这次回复格式异常，请重新发送一次。'),
      imagePlan: imagePlans[0],
      imagePlans: imagePlans.length ? imagePlans : undefined,
      videoPlan: videoPlans[0],
      videoPlans: videoPlans.length ? videoPlans : undefined,
      textNode,
    }
  } catch {
    const recoveredReply = extractMalformedReply(cleaned)
    const looksLikeProtocolPayload = looksLikeAgentProtocolPayload(cleaned)
    return { reply: recoveredReply || (looksLikeProtocolPayload ? '这次回复格式异常，请重新发送一次。' : cleaned) }
  }
}

export const canvasAgentAvailability = 'available' as const
