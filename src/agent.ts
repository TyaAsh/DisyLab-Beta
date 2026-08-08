export type AgentMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
}

export type AgentImageReference = {
  nodeId: string
  name: string
  url: string
}

export type AgentImagePlan = {
  id: string
  status: 'ready' | 'running' | 'completed' | 'failed' | 'cancelled'
  prompt: string
  referenceNodeIds: string[]
  aspectRatio: string
  resolution: string
  detail: string
  count: number
  imageConnectionId?: string
  imageModelId?: string
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
  imagePlan?: Pick<AgentImagePlan, 'prompt' | 'aspectRatio' | 'resolution' | 'detail' | 'count'>
}

export function parseAgentReply(raw: string): AgentReply {
  const cleaned = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '')
  try {
    const value = JSON.parse(cleaned) as Record<string, unknown>
    const reply = typeof value.reply === 'string' ? value.reply.trim() : ''
    const candidate = value.imagePlan && typeof value.imagePlan === 'object'
      ? value.imagePlan as Record<string, unknown>
      : undefined
    const prompt = typeof candidate?.prompt === 'string' ? candidate.prompt.trim() : ''
    return {
      reply: reply || (prompt ? '我已整理好一份图像方案，请确认后生成。' : raw.trim()),
      imagePlan: prompt ? {
        prompt,
        aspectRatio: typeof candidate?.aspectRatio === 'string' ? candidate.aspectRatio : '1:1',
        resolution: typeof candidate?.resolution === 'string' ? candidate.resolution : '1K',
        detail: typeof candidate?.detail === 'string' ? candidate.detail : 'medium',
        count: Math.min(4, Math.max(1, Number(candidate?.count) || 1)),
      } : undefined,
    }
  } catch {
    return { reply: raw.trim() }
  }
}

export const canvasAgentAvailability = 'available' as const
