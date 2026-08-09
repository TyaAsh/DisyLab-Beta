export type AgentMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
  references?: AgentImageReference[]
}

export type AgentImageReference = {
  nodeId: string
  name: string
  url: string
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
  error?: string
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
}

export type AgentImagePlanDraft = Pick<AgentImagePlan, 'prompt' | 'aspectRatio' | 'resolution' | 'detail' | 'count' | 'label'>

export function parseAgentReply(raw: string): AgentReply {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const value = JSON.parse(cleaned) as Record<string, unknown>
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
    return {
      reply: reply || (imagePlans.length ? `我已整理好${imagePlans.length > 1 ? `${imagePlans.length}份` : '一份'}图像方案，请选择并确认后生成。` : raw.trim()),
      imagePlan: imagePlans[0],
      imagePlans: imagePlans.length ? imagePlans : undefined,
    }
  } catch {
    return { reply: raw.trim() }
  }
}

export const canvasAgentAvailability = 'available' as const
