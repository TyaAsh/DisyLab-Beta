/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab-Canvas
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
import { create } from 'zustand'

const API_SETTINGS_KEY = 'disy-api-settings'
const API_SECRETS_KEY = 'disy-api-secrets'
const API_BALANCE_TOKENS_KEY = 'disy-api-balance-tokens'
const LEGACY_API_SECRET_KEY = 'disy-api-secret'

export type ActivePanel = 'canvas' | 'assets' | 'settings'
export type ModelCapability = 'text' | 'image' | 'video'

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
  balanceToken?: string
  models: ApiModelConfig[]
  modelsFetchedAt?: string
  /** Master switch for whether this connection's models participate in selection. Defaults to true. */
  enabled?: boolean
  /** Soft disconnect state: API Key remains stored, but the connection and its models are hidden from all model selectors until re-linked. Defaults to false. */
  disconnected?: boolean
}

/** A connection is usable only when it is enabled and not in a disconnected state. */
export function isConnectionUsable(connection: ApiConnection): boolean {
  return connection.enabled !== false
    && !connection.disconnected
    && Boolean(connection.baseUrl.trim() && connection.apiKey.trim())
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

function inferLegacyCapability(modelId: string): ModelCapability | null {
  if (/image|seedream|imagen|flux|banana|dall-e|gpt-image/i.test(modelId)) return 'image'
  if (/video|seedance|sora|veo|kling|runway|hailuo/i.test(modelId)) return 'video'
  if (/tts|speech|audio|voice|whisper/i.test(modelId)) return null
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
  let balanceTokens: Record<string, string> = {}
  try {
    balanceTokens = JSON.parse(sessionStorage.getItem(API_BALANCE_TOKENS_KEY) ?? '{}') as Record<string, string>
  } catch {
    balanceTokens = {}
  }
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
          balanceToken: typeof balanceTokens[id] === 'string' ? balanceTokens[id] : '',
          models: Array.isArray(connection.models)
            ? connection.models.filter((model): model is ApiModelConfig => Boolean(model) && ['text', 'image', 'video'].includes((model as ApiModelConfig).capability))
            : [],
          modelsFetchedAt: typeof connection.modelsFetchedAt === 'string' ? connection.modelsFetchedAt : undefined,
          enabled: connection.enabled === false ? false : true,
          disconnected: connection.disconnected === true,
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
          models: modelId && legacyCapability ? [{ id: modelId, name: modelId, capability: legacyCapability, enabled: true }] : [],
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
    connections: settings.connections.map(({ apiKey: _apiKey, balanceToken: _balanceToken, ...connection }) => connection),
  }
  const secretMap = Object.fromEntries(settings.connections.filter((connection) => connection.apiKey).map((connection) => [connection.id, connection.apiKey]))
  const balanceTokenMap = Object.fromEntries(settings.connections.filter((connection) => connection.balanceToken).map((connection) => [connection.id, connection.balanceToken]))
  const previousSecrets = sessionStorage.getItem(API_SECRETS_KEY)
  sessionStorage.setItem(API_SECRETS_KEY, JSON.stringify(secretMap))
  sessionStorage.setItem(API_BALANCE_TOKENS_KEY, JSON.stringify(balanceTokenMap))
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
  apiConfigured: initialApiSettings.connections.some((connection) => isConnectionUsable(connection) && Boolean(connection.baseUrl && connection.apiKey)),
  apiSettings: initialApiSettings,
  setActivePanel: (activePanel) => set({ activePanel }),
  saveApiSettings: (apiSettings) => {
    persistApiSettings(apiSettings)
    set({
      apiSettings,
      apiConfigured: apiSettings.connections.some((connection) => isConnectionUsable(connection) && Boolean(connection.baseUrl && connection.apiKey)),
    })
  },
  clearApiSettings: () => {
    localStorage.removeItem(API_SETTINGS_KEY)
    sessionStorage.removeItem(API_SECRETS_KEY)
    sessionStorage.removeItem(API_BALANCE_TOKENS_KEY)
    sessionStorage.removeItem(LEGACY_API_SECRET_KEY)
    set({ apiSettings: { connections: [] }, apiConfigured: false })
  },
}))
