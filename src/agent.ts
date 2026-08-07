export type AgentMessage = {
  id: string
  role: 'user' | 'assistant'
  content: string
  createdAt: string
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

// Reserved for the next phase. Keeping the contract isolated prevents the
// unreleased conversation agent from coupling to canvas or image generation.
export const canvasAgentAvailability = 'coming-soon' as const
