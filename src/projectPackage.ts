/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab-Canvas
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
import { exportWorkspaceSnapshot, replaceWorkspace, validateWorkspaceSnapshot, type WorkspaceSnapshot } from './localDb'

export const DISY_PACKAGE_EXTENSION = '.disy'

export async function createWorkspacePackageBlob() {
  const snapshot = await exportWorkspaceSnapshot()
  return new Blob([JSON.stringify(snapshot)], { type: 'application/vnd.disy.workspace+json' })
}

export async function downloadWorkspacePackage(fileName = `Disy-${new Date().toISOString().slice(0, 10)}${DISY_PACKAGE_EXTENSION}`) {
  const blob = await createWorkspacePackageBlob()
  const url = URL.createObjectURL(blob)
  try {
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = fileName.endsWith(DISY_PACKAGE_EXTENSION) ? fileName : `${fileName}${DISY_PACKAGE_EXTENSION}`
    anchor.click()
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }
}

export async function readWorkspacePackage(file: Blob): Promise<WorkspaceSnapshot> {
  let value: unknown
  try {
    value = JSON.parse(await file.text())
  } catch {
    throw new Error('无法读取项目包：文件不是有效的 Disy JSON 数据')
  }
  validateWorkspaceSnapshot(value)
  return value
}

/** Replaces the current local workspace atomically after the package validates. */
export async function importWorkspacePackage(file: Blob) {
  const snapshot = await readWorkspacePackage(file)
  await replaceWorkspace(snapshot)
  return snapshot
}
