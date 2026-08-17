/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab-Canvas
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
/**
 * Client-side operator gate.
 * The passphrase never appears as a string literal in the bundle — only a salted digest does.
 * This raises the bar for casual inspection; it is not server-grade secrecy.
 */

const GATE_SALT = String.fromCharCode(
  68, 105, 115, 121, 76, 97, 98, 46, 103, 97, 116, 101, 46, 118, 49,
)

/** SHA-256 hex of `${GATE_SALT}:${passphrase}` */
const GATE_DIGEST = '198af0a64171c64356577a5ffe6b648f16b51e22454bbce71dbca2ef2c51b8af'

const SESSION_FLAG = String.fromCharCode(100, 108, 45, 111, 112, 45, 115, 101, 115, 115)
const LOG_KEY = String.fromCharCode(100, 108, 45, 111, 112, 45, 108, 111, 103, 115, 45, 118, 49)

async function sha256Hex(value: string) {
  const bytes = new TextEncoder().encode(value)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false
  let miss = 0
  for (let index = 0; index < left.length; index += 1) miss |= left.charCodeAt(index) ^ right.charCodeAt(index)
  return miss === 0
}

export async function verifyOperatorAccess(passphrase: string) {
  const digest = await sha256Hex(`${GATE_SALT}:${passphrase}`)
  return timingSafeEqual(digest, GATE_DIGEST)
}

export function isOperatorSessionUnlocked() {
  try {
    return sessionStorage.getItem(SESSION_FLAG) === '1'
  } catch {
    return false
  }
}

export function unlockOperatorSession() {
  try {
    sessionStorage.setItem(SESSION_FLAG, '1')
  } catch {
    // Session unlock is best-effort.
  }
}

export function lockOperatorSession() {
  try {
    sessionStorage.removeItem(SESSION_FLAG)
  } catch {
    // ignore
  }
}

export type OperatorRecoveryLog = {
  id: string
  createdAt: string
  projectId?: string
  provider: string
  taskId?: string
  model: string
  modelName?: string
  connectionName?: string
  prompt: string
  durationMs: number
  resultType: 'success' | 'failed'
  kind?: 'image' | 'text'
  requestJson: string
  resultJson: string
  resultUrls?: string[]
}

function readOperatorLogsRaw(): OperatorRecoveryLog[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(LOG_KEY) ?? '[]') as OperatorRecoveryLog[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function listOperatorRecoveryLogs(projectId?: string) {
  const logs = readOperatorLogsRaw()
  if (!projectId) return logs
  return logs.filter((log) => !log.projectId || log.projectId === projectId)
}

export function appendOperatorRecoveryLog(log: Omit<OperatorRecoveryLog, 'id' | 'createdAt'> & { createdAt?: string }) {
  const next: OperatorRecoveryLog = {
    ...log,
    id: `op-${Date.now()}-${crypto.randomUUID()}`,
    createdAt: log.createdAt ?? new Date().toISOString(),
  }
  const retained = [next, ...readOperatorLogsRaw()]
    .filter((item) => Date.now() - Date.parse(item.createdAt) < 7 * 24 * 60 * 60 * 1000)
    .slice(0, 120)
  try {
    localStorage.setItem(LOG_KEY, JSON.stringify(retained))
  } catch {
    // Never break generation if operator log storage is full.
  }
  return next
}
