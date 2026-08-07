import { create } from 'zustand'

const API_SETTINGS_KEY = 'disy-api-settings'
const API_SECRETS_KEY = 'disy-api-secrets'
const LEGACY_API_SECRET_KEY = 'disy-api-secret'

export type ActivePanel = 'canvas' | 'assets' | 'settings'
export type ModelCapability = 'text' | 'image' | 'video' | 'audio'

export type ApiModelConfig = {
  id: string
  name: string
  capability: ModelCapability
  enabled: boolean
}

export type ApiConnection = {
  id: string
  name: string
  baseUrl: string
  apiKey: string
  models: ApiModelConfig[]
  modelsFetchedAt?: string
}

export type ModelSelection = {
  connectionId: string
  modelId: string
}

export type ApiSettings = {
  connections: ApiConnection[]
  selectedTextModel?: ModelSelection
  selectedImageModel?: ModelSelection
}

function inferLegacyCapability(modelId: string): ModelCapability {
  if (/image|seedream|imagen|flux|banana|dall-e|gpt-image/i.test(modelId)) return 'image'
  if (/video|seedance|sora|veo|kling|runway|hailuo/i.test(modelId)) return 'video'
  if (/tts|speech|audio|voice|whisper/i.test(modelId)) return 'audio'
  return 'text'
}

function readSecretMap() {
  try {
    const value = JSON.parse(sessionStorage.getItem(API_SECRETS_KEY) ?? '{}') as Record<string, unknown>
    return Object.fromEntries(Object.entries(value).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
  } catch {
    return {}
  }
}

function readApiSettings(): ApiSettings {
  const secrets = readSecretMap()
  try {
    const value = JSON.parse(localStorage.getItem(API_SETTINGS_KEY) ?? '{}') as Record<string, unknown>
    if (Array.isArray(value.connections)) {
      const connections = value.connections.map((item) => {
        const connection = item as Partial<ApiConnection>
        const id = typeof connection.id === 'string' ? connection.id : crypto.randomUUID()
        return {
          id,
          name: typeof connection.name === 'string' ? connection.name : 'API 连接',
          baseUrl: typeof connection.baseUrl === 'string' ? connection.baseUrl : '',
          apiKey: secrets[id] ?? '',
          models: Array.isArray(connection.models) ? connection.models : [],
          modelsFetchedAt: typeof connection.modelsFetchedAt === 'string' ? connection.modelsFetchedAt : undefined,
        }
      })
      return {
        connections,
        selectedTextModel: value.selectedTextModel as ModelSelection | undefined,
        selectedImageModel: value.selectedImageModel as ModelSelection | undefined,
      }
    }

    // Migrate the original single-connection shape.
    const baseUrl = typeof value.baseUrl === 'string' ? value.baseUrl : ''
    const legacySecret = sessionStorage.getItem(LEGACY_API_SECRET_KEY) ?? ''
    if (baseUrl || legacySecret) {
      const id = 'connection-migrated'
      const modelId = typeof value.model === 'string' ? value.model : ''
      const legacyCapability = inferLegacyCapability(modelId)
      return {
        connections: [{
          id,
          name: '默认连接',
          baseUrl,
          apiKey: legacySecret,
          models: modelId ? [{ id: modelId, name: modelId, capability: legacyCapability, enabled: true }] : [],
        }],
        selectedTextModel: modelId && legacyCapability === 'text' ? { connectionId: id, modelId } : undefined,
        selectedImageModel: modelId && legacyCapability === 'image' ? { connectionId: id, modelId } : undefined,
      }
    }
  } catch {
    // Fall through to an empty configuration.
  }
  return { connections: [] }
}

function persistApiSettings(settings: ApiSettings) {
  const publicSettings = {
    ...settings,
    connections: settings.connections.map(({ apiKey: _apiKey, ...connection }) => connection),
  }
  const secretMap = Object.fromEntries(settings.connections.filter((connection) => connection.apiKey).map((connection) => [connection.id, connection.apiKey]))
  const previousSecrets = sessionStorage.getItem(API_SECRETS_KEY)
  sessionStorage.setItem(API_SECRETS_KEY, JSON.stringify(secretMap))
  try {
    localStorage.setItem(API_SETTINGS_KEY, JSON.stringify(publicSettings))
    sessionStorage.removeItem(LEGACY_API_SECRET_KEY)
  } catch (error) {
    if (previousSecrets === null) sessionStorage.removeItem(API_SECRETS_KEY)
    else sessionStorage.setItem(API_SECRETS_KEY, previousSecrets)
    throw error
  }
}

const initialApiSettings = readApiSettings()

type DisyStore = {
  activePanel: ActivePanel
  apiConfigured: boolean
  apiSettings: ApiSettings
  setActivePanel: (panel: ActivePanel) => void
  saveApiSettings: (settings: ApiSettings) => void
  clearApiSettings: () => void
}

export const useDisyStore = create<DisyStore>((set) => ({
  activePanel: 'canvas',
  apiConfigured: initialApiSettings.connections.some((connection) => Boolean(connection.baseUrl && connection.apiKey)),
  apiSettings: initialApiSettings,
  setActivePanel: (activePanel) => set({ activePanel }),
  saveApiSettings: (apiSettings) => {
    persistApiSettings(apiSettings)
    set({
      apiSettings,
      apiConfigured: apiSettings.connections.some((connection) => Boolean(connection.baseUrl && connection.apiKey)),
    })
  },
  clearApiSettings: () => {
    localStorage.removeItem(API_SETTINGS_KEY)
    sessionStorage.removeItem(API_SECRETS_KEY)
    sessionStorage.removeItem(LEGACY_API_SECRET_KEY)
    set({ apiSettings: { connections: [] }, apiConfigured: false })
  },
}))
