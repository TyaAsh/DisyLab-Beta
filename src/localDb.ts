const DATABASE_NAME = 'disy-infinite-local'
const DATABASE_VERSION = 5
const LEGACY_PROJECT_STORE = 'projects'
const ASSET_STORE = 'assets'
const WORKSPACE_PROJECT_STORE = 'workspace-projects'
const CANVAS_STORE = 'canvases'
const WORKSPACE_DATA_STORE = 'workspace-data'
const AGENT_SESSION_STORE = 'agent-sessions'
const HISTORY_MEDIA_STORE = 'history-media'
const IMPORT_BACKUP_STORE = 'import-backups'
const ASSET_LIBRARY_ID = 'library'
const WORKSPACE_DATA_ID = 'workspace'

export const DEFAULT_PROJECT_ID = 'default-project'

export type StyleReferenceRecord = {
  id: string
  name: string
  url: string
}

export type StylePresetRecord = {
  id: string
  name: string
  keyword: string
  enabled: boolean
  collapsed: boolean
  references: StyleReferenceRecord[]
}

export type LocalProject = {
  id: string
  name: string
  nodes: unknown[]
  edges: unknown[]
  styleReferenceName: string
  styleReferenceUrl?: string
  styleReferences?: StyleReferenceRecord[]
  styleReferenceEnabled?: boolean
  styleReferenceKeyword?: string
  stylePresets?: StylePresetRecord[]
  promptSuffix: string
  settingsLocked: boolean
  updatedAt: string
}

export type WorkspaceProject = {
  id: string
  name: string
  activeCanvasId: string
  canvasIds: string[]
  createdAt: string
  updatedAt: string
}

export type WorkspaceCanvas = Omit<LocalProject, 'id'> & {
  id: string
  projectId: string
  createdAt: string
}

export type AgentSessionRecord = {
  id: string
  projectId: string
  canvasId: string
  title?: string
  messages?: unknown[]
  plans?: unknown[]
  selectedChatModelId?: string
  selectedImageModelId?: string
  createdAt: string
  updatedAt: string
  [key: string]: unknown
}

export type HistoryMediaRecord = {
  id: string
  blob: Blob
  fileName: string
  createdAt: string
}

export type SerializedHistoryMedia = {
  id: string
  fileName: string
  createdAt: string
  dataUrl: string
}

export type WorkspaceAuxiliaryData = {
  id: typeof WORKSPACE_DATA_ID
  folders: unknown[]
  generationHistory: unknown[]
  outputHistory: unknown[]
  publicSettings: Record<string, unknown>
  updatedAt: string
}

export type WorkspaceSnapshot = {
  format: 'disy-infinite-workspace'
  version: 1
  exportedAt: string
  projects: WorkspaceProject[]
  canvases: WorkspaceCanvas[]
  assets: unknown[]
  folders: unknown[]
  generationHistory: unknown[]
  outputHistory: unknown[]
  publicSettings: Record<string, unknown>
  agentSessions: AgentSessionRecord[]
  /** Optional portable copies of IndexedDB history blobs (data URLs). */
  historyMedia?: SerializedHistoryMedia[]
}

export type WorkspaceImportBackup = {
  id: 'latest'
  createdAt: string
  snapshot: WorkspaceSnapshot
  historyMedia: HistoryMediaRecord[]
}

export function workspaceSnapshotHasContent(snapshot: WorkspaceSnapshot) {
  const canvasHasContent = snapshot.canvases.some((canvas) => {
    const record = canvas as WorkspaceCanvas & Record<string, unknown>
    const hasConfiguredStylePreset = Array.isArray(record.stylePresets) && record.stylePresets.some((preset) => {
      if (!preset || typeof preset !== 'object') return false
      const style = preset as Record<string, unknown>
      return style.enabled === true
        || (Array.isArray(style.references) && style.references.length > 0)
        || (typeof style.keyword === 'string' && style.keyword.trim() !== '' && style.keyword.trim() !== 'Disy')
        || (typeof style.name === 'string' && style.name.trim() !== '' && style.name.trim() !== '默认风格')
    })
    return (Array.isArray(record.nodes) && record.nodes.length > 0)
      || (Array.isArray(record.edges) && record.edges.length > 0)
      || Boolean(record.styleReferenceUrl)
      || (Array.isArray(record.styleReferences) && record.styleReferences.length > 0)
      || hasConfiguredStylePreset
      || Boolean(record.promptSuffix)
  })
  const sessionHasContent = snapshot.agentSessions.some((session) => {
    return (Array.isArray(session.messages) && session.messages.length > 0)
      || (Array.isArray(session.plans) && session.plans.length > 0)
  })
  const hasCustomFolders = snapshot.folders.some((folder) => {
    return Boolean(folder && typeof folder === 'object' && (folder as Record<string, unknown>).preset !== true)
  })
  return canvasHasContent
    || snapshot.assets.length > 0
    || hasCustomFolders
    || snapshot.generationHistory.length > 0
    || snapshot.outputHistory.length > 0
    || sessionHasContent
    || Boolean(snapshot.historyMedia?.length)
}

const now = () => new Date().toISOString()
const defaultCanvasId = (projectId: string) => `${projectId}--canvas-default`

export function makeUniqueWorkspaceName(requestedName: string, existingNames: Iterable<string>, fallback: string) {
  const normalized = requestedName.trim() || fallback
  const comparisonKey = (name: string) => name.trim().normalize('NFKC').toLocaleLowerCase()
  const taken = new Set([...existingNames].map(comparisonKey))
  if (!taken.has(comparisonKey(normalized))) return normalized
  const match = normalized.match(/^(.*?)(?:\s+(\d+))?$/)
  const base = match?.[1]?.trim() || normalized
  let index = match?.[2] ? Number(match[2]) + 1 : 1
  let candidate = `${base} ${index}`
  while (taken.has(comparisonKey(candidate))) {
    index += 1
    candidate = `${base} ${index}`
  }
  return candidate
}

function normalizeWorkspaceSnapshotNames(snapshot: WorkspaceSnapshot) {
  const projectNames: string[] = []
  snapshot.projects.forEach((project) => {
    project.name = makeUniqueWorkspaceName(typeof project.name === 'string' ? project.name : '', projectNames, '未命名项目')
    projectNames.push(project.name)
  })
  const canvasNames = new Map<string, string[]>()
  snapshot.canvases.forEach((canvas) => {
    const names = canvasNames.get(canvas.projectId) ?? []
    canvas.name = makeUniqueWorkspaceName(typeof canvas.name === 'string' ? canvas.name : '', names, '未命名画布')
    names.push(canvas.name)
    canvasNames.set(canvas.projectId, names)
  })
}

function canvasFromLegacy(project: LocalProject): WorkspaceCanvas {
  return {
    ...project,
    id: defaultCanvasId(project.id),
    projectId: project.id,
    name: project.name || '画布 1',
    createdAt: project.updatedAt || now(),
  }
}

function projectFromLegacy(project: LocalProject): WorkspaceProject {
  const canvasId = defaultCanvasId(project.id)
  return {
    id: project.id,
    name: project.name || '未命名项目',
    activeCanvasId: canvasId,
    canvasIds: [canvasId],
    createdAt: project.updatedAt || now(),
    updatedAt: project.updatedAt || now(),
  }
}

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = (event) => {
      const database = request.result
      const transaction = request.transaction
      if (!database.objectStoreNames.contains(LEGACY_PROJECT_STORE)) {
        database.createObjectStore(LEGACY_PROJECT_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(ASSET_STORE)) {
        database.createObjectStore(ASSET_STORE, { keyPath: 'id' })
      }
      const projects = database.objectStoreNames.contains(WORKSPACE_PROJECT_STORE)
        ? transaction!.objectStore(WORKSPACE_PROJECT_STORE)
        : database.createObjectStore(WORKSPACE_PROJECT_STORE, { keyPath: 'id' })
      const canvases = database.objectStoreNames.contains(CANVAS_STORE)
        ? transaction!.objectStore(CANVAS_STORE)
        : database.createObjectStore(CANVAS_STORE, { keyPath: 'id' })
      if (!canvases.indexNames.contains('projectId')) canvases.createIndex('projectId', 'projectId')
      if (!database.objectStoreNames.contains(WORKSPACE_DATA_STORE)) {
        database.createObjectStore(WORKSPACE_DATA_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(AGENT_SESSION_STORE)) {
        const sessions = database.createObjectStore(AGENT_SESSION_STORE, { keyPath: 'id' })
        sessions.createIndex('canvasId', 'canvasId')
        sessions.createIndex('projectId', 'projectId')
      }
      if (!database.objectStoreNames.contains(HISTORY_MEDIA_STORE)) {
        database.createObjectStore(HISTORY_MEDIA_STORE, { keyPath: 'id' })
      }
      if (!database.objectStoreNames.contains(IMPORT_BACKUP_STORE)) {
        database.createObjectStore(IMPORT_BACKUP_STORE, { keyPath: 'id' })
      }

      // v2 and older stored one canvas as one "project". Copy it during the
      // schema transaction, using deterministic IDs so an interrupted upgrade
      // can safely run again.
      if (event.oldVersion < 3) {
        const legacy = transaction!.objectStore(LEGACY_PROJECT_STORE)
        legacy.openCursor().onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (!cursor) return
          const value = cursor.value as LocalProject
          projects.put(projectFromLegacy(value))
          canvases.put(canvasFromLegacy(value))
          cursor.continue()
        }
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
    request.onblocked = () => reject(new Error('本地数据库升级被另一个页面阻塞，请关闭其他 Disy 页面后重试。'))
  })
}

function runTransaction<T>(stores: string[], mode: IDBTransactionMode, executor: (transaction: IDBTransaction) => T) {
  return openDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        const transaction = database.transaction(stores, mode)
        let result: T
        try {
          result = executor(transaction)
        } catch (error) {
          database.close()
          reject(error)
          return
        }
        transaction.oncomplete = () => {
          database.close()
          resolve(result)
        }
        transaction.onerror = () => {
          database.close()
          reject(transaction.error)
        }
        transaction.onabort = () => {
          database.close()
          reject(transaction.error ?? new Error('本地数据库事务已取消'))
        }
      }),
  )
}

function requestResult<T>(request: IDBRequest<T>) {
  return new Promise<T>((resolve, reject) => {
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveLocalProject(project: LocalProject) {
  // Keep the original API/store working, while mirroring it into the new data
  // model for callers that have not migrated yet.
  const workspaceProject = projectFromLegacy(project)
  const canvas = canvasFromLegacy(project)
  await runTransaction<void>([LEGACY_PROJECT_STORE, WORKSPACE_PROJECT_STORE, CANVAS_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(LEGACY_PROJECT_STORE).put(project)
    const projects = transaction.objectStore(WORKSPACE_PROJECT_STORE)
    const canvases = transaction.objectStore(CANVAS_STORE)
    const existingRequest = projects.get(project.id)
    existingRequest.onsuccess = () => {
      const existing = existingRequest.result as WorkspaceProject | undefined
      if (!existing) {
        projects.put(workspaceProject)
        canvases.put(canvas)
        return
      }
      // A legacy caller may continue saving the migrated default canvas, but
      // must never collapse a project that already contains extra canvases.
      if (existing.canvasIds.includes(canvas.id)) canvases.put(canvas)
    }
  })
}

export async function loadLocalProject(id: string) {
  const database = await openDatabase()
  try {
    const legacy = await requestResult(database.transaction(LEGACY_PROJECT_STORE, 'readonly').objectStore(LEGACY_PROJECT_STORE).get(id))
    return (legacy as LocalProject | undefined) ?? null
  } finally {
    database.close()
  }
}

export async function listWorkspaceProjects() {
  const database = await openDatabase()
  try {
    const values = await requestResult(database.transaction(WORKSPACE_PROJECT_STORE, 'readonly').objectStore(WORKSPACE_PROJECT_STORE).getAll())
    return (values as WorkspaceProject[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } finally {
    database.close()
  }
}

export async function loadWorkspaceProject(id: string) {
  const database = await openDatabase()
  try {
    const value = await requestResult(database.transaction(WORKSPACE_PROJECT_STORE, 'readonly').objectStore(WORKSPACE_PROJECT_STORE).get(id))
    return (value as WorkspaceProject | undefined) ?? null
  } finally {
    database.close()
  }
}

export async function saveWorkspaceProject(project: WorkspaceProject) {
  await runTransaction<void>([WORKSPACE_PROJECT_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(WORKSPACE_PROJECT_STORE).put(project)
  })
}

export async function renameWorkspaceProject(projectId: string, name: string) {
  const project = await loadWorkspaceProject(projectId)
  if (!project) throw new Error('项目不存在')
  const projects = await listWorkspaceProjects()
  const uniqueName = makeUniqueWorkspaceName(name, projects.filter((item) => item.id !== projectId).map((item) => item.name), '未命名项目')
  const next = { ...project, name: uniqueName, updatedAt: now() }
  await saveWorkspaceProject(next)
  return next
}

export async function setActiveWorkspaceCanvas(projectId: string, canvasId: string) {
  const project = await loadWorkspaceProject(projectId)
  if (!project) throw new Error('项目不存在')
  if (!project.canvasIds.includes(canvasId)) throw new Error('画布不属于当前项目')
  const next = { ...project, activeCanvasId: canvasId, updatedAt: now() }
  await saveWorkspaceProject(next)
  return next
}

export async function createWorkspaceProject(name = '未命名项目') {
  const projects = await listWorkspaceProjects()
  const timestamp = now()
  const projectId = crypto.randomUUID()
  const canvasId = crypto.randomUUID()
  const project: WorkspaceProject = {
    id: projectId,
    name: makeUniqueWorkspaceName(name, projects.map((project) => project.name), '未命名项目'),
    activeCanvasId: canvasId,
    canvasIds: [canvasId],
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const canvas: WorkspaceCanvas = {
    id: canvasId,
    projectId,
    name: '画布 1',
    nodes: [],
    edges: [],
    styleReferenceName: '',
    promptSuffix: '',
    settingsLocked: false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  await runTransaction<void>([WORKSPACE_PROJECT_STORE, CANVAS_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(WORKSPACE_PROJECT_STORE).put(project)
    transaction.objectStore(CANVAS_STORE).put(canvas)
  })
  return { project, canvas }
}

export async function deleteWorkspaceProject(projectId: string) {
  const canvases = await listWorkspaceCanvases(projectId)
  await runTransaction<void>([WORKSPACE_PROJECT_STORE, CANVAS_STORE, AGENT_SESSION_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(WORKSPACE_PROJECT_STORE).delete(projectId)
    const canvasStore = transaction.objectStore(CANVAS_STORE)
    canvases.forEach((canvas) => canvasStore.delete(canvas.id))
    const sessions = transaction.objectStore(AGENT_SESSION_STORE).index('projectId').openKeyCursor(IDBKeyRange.only(projectId))
    sessions.onsuccess = () => {
      const cursor = sessions.result
      if (!cursor) return
      transaction.objectStore(AGENT_SESSION_STORE).delete(cursor.primaryKey)
      cursor.continue()
    }
  })
}

export async function listWorkspaceCanvases(projectId: string) {
  const database = await openDatabase()
  try {
    const store = database.transaction(CANVAS_STORE, 'readonly').objectStore(CANVAS_STORE)
    const values = await requestResult(store.index('projectId').getAll(IDBKeyRange.only(projectId)))
    return (values as WorkspaceCanvas[]).sort((a, b) => a.createdAt.localeCompare(b.createdAt))
  } finally {
    database.close()
  }
}

export async function loadWorkspaceCanvas(id: string) {
  const database = await openDatabase()
  try {
    const value = await requestResult(database.transaction(CANVAS_STORE, 'readonly').objectStore(CANVAS_STORE).get(id))
    return (value as WorkspaceCanvas | undefined) ?? null
  } finally {
    database.close()
  }
}

export async function saveWorkspaceCanvas(canvas: WorkspaceCanvas) {
  await runTransaction<void>([CANVAS_STORE, WORKSPACE_PROJECT_STORE], 'readwrite', (transaction) => {
    const timestamp = now()
    transaction.objectStore(CANVAS_STORE).put({ ...canvas, updatedAt: timestamp })
    const projectRequest = transaction.objectStore(WORKSPACE_PROJECT_STORE).get(canvas.projectId)
    projectRequest.onsuccess = () => {
      const project = projectRequest.result as WorkspaceProject | undefined
      if (project) transaction.objectStore(WORKSPACE_PROJECT_STORE).put({ ...project, updatedAt: timestamp })
    }
  })
}

export async function renameWorkspaceCanvas(canvasId: string, name: string) {
  const canvas = await loadWorkspaceCanvas(canvasId)
  if (!canvas) throw new Error('画布不存在')
  const canvases = await listWorkspaceCanvases(canvas.projectId)
  const uniqueName = makeUniqueWorkspaceName(name, canvases.filter((item) => item.id !== canvasId).map((item) => item.name), '未命名画布')
  const next = { ...canvas, name: uniqueName, updatedAt: now() }
  await saveWorkspaceCanvas(next)
  return next
}

export async function createWorkspaceCanvas(projectId: string, name?: string, source?: Partial<WorkspaceCanvas>) {
  const project = await loadWorkspaceProject(projectId)
  if (!project) throw new Error('项目不存在')
  const canvases = await listWorkspaceCanvases(projectId)
  const timestamp = now()
  const id = crypto.randomUUID()
  const canvas: WorkspaceCanvas = {
    id,
    projectId,
    name: makeUniqueWorkspaceName(name || `画布 ${project.canvasIds.length + 1}`, canvases.map((canvas) => canvas.name), '未命名画布'),
    nodes: source?.nodes ?? [],
    edges: source?.edges ?? [],
    styleReferenceName: source?.styleReferenceName ?? '',
    styleReferenceUrl: source?.styleReferenceUrl,
    styleReferences: source?.styleReferences,
    styleReferenceEnabled: source?.styleReferenceEnabled,
    styleReferenceKeyword: source?.styleReferenceKeyword,
    stylePresets: source?.stylePresets,
    promptSuffix: source?.promptSuffix ?? '',
    settingsLocked: source?.settingsLocked ?? false,
    createdAt: timestamp,
    updatedAt: timestamp,
  }
  const nextProject = { ...project, activeCanvasId: id, canvasIds: [...project.canvasIds, id], updatedAt: timestamp }
  await runTransaction<void>([CANVAS_STORE, WORKSPACE_PROJECT_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(CANVAS_STORE).put(canvas)
    transaction.objectStore(WORKSPACE_PROJECT_STORE).put(nextProject)
  })
  return canvas
}

export async function duplicateWorkspaceCanvas(canvasId: string, name?: string) {
  const source = await loadWorkspaceCanvas(canvasId)
  if (!source) throw new Error('画布不存在')
  // structuredClone prevents subsequent edits from sharing object references.
  const cloned = typeof structuredClone === 'function' ? structuredClone(source) : JSON.parse(JSON.stringify(source)) as WorkspaceCanvas
  return createWorkspaceCanvas(source.projectId, name || `${source.name} 副本`, cloned)
}

export async function deleteWorkspaceCanvas(projectId: string, canvasId: string) {
  const project = await loadWorkspaceProject(projectId)
  if (!project) throw new Error('项目不存在')
  if (project.canvasIds.length <= 1) throw new Error('每个项目至少需要保留一个画布')
  if (!project.canvasIds.includes(canvasId)) return project
  const canvasIds = project.canvasIds.filter((id) => id !== canvasId)
  const next = { ...project, canvasIds, activeCanvasId: project.activeCanvasId === canvasId ? canvasIds[0] : project.activeCanvasId, updatedAt: now() }
  await runTransaction<void>([CANVAS_STORE, WORKSPACE_PROJECT_STORE, AGENT_SESSION_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(CANVAS_STORE).delete(canvasId)
    transaction.objectStore(WORKSPACE_PROJECT_STORE).put(next)
    const request = transaction.objectStore(AGENT_SESSION_STORE).index('canvasId').openKeyCursor(IDBKeyRange.only(canvasId))
    request.onsuccess = () => {
      const cursor = request.result
      if (!cursor) return
      transaction.objectStore(AGENT_SESSION_STORE).delete(cursor.primaryKey)
      cursor.continue()
    }
  })
  return next
}

export async function saveAgentSession(session: AgentSessionRecord) {
  await runTransaction<void>([AGENT_SESSION_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(AGENT_SESSION_STORE).put(session)
  })
}

export async function deleteAgentSession(id: string) {
  await runTransaction<void>([AGENT_SESSION_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(AGENT_SESSION_STORE).delete(id)
  })
}

export async function listAgentSessions(canvasId?: string) {
  const database = await openDatabase()
  try {
    const store = database.transaction(AGENT_SESSION_STORE, 'readonly').objectStore(AGENT_SESSION_STORE)
    const request = canvasId ? store.index('canvasId').getAll(IDBKeyRange.only(canvasId)) : store.getAll()
    const values = await requestResult(request)
    return (values as AgentSessionRecord[]).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
  } finally {
    database.close()
  }
}

export async function saveWorkspaceAuxiliaryData(data: Omit<WorkspaceAuxiliaryData, 'id' | 'updatedAt'>) {
  await runTransaction<void>([WORKSPACE_DATA_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(WORKSPACE_DATA_STORE).put({ ...data, id: WORKSPACE_DATA_ID, updatedAt: now() })
  })
}

export async function loadWorkspaceAuxiliaryData(): Promise<WorkspaceAuxiliaryData> {
  const database = await openDatabase()
  try {
    const value = (await requestResult(database.transaction(WORKSPACE_DATA_STORE, 'readonly').objectStore(WORKSPACE_DATA_STORE).get(WORKSPACE_DATA_ID))) as WorkspaceAuxiliaryData | undefined
    return value ?? { id: WORKSPACE_DATA_ID, folders: [], generationHistory: [], outputHistory: [], publicSettings: {}, updatedAt: now() }
  } finally {
    database.close()
  }
}

export async function saveLocalAssets(assets: unknown[]) {
  await runTransaction<void>([ASSET_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(ASSET_STORE).put({ id: ASSET_LIBRARY_ID, assets, updatedAt: now() })
  })
}

export async function loadLocalAssets<T>() {
  const database = await openDatabase()
  try {
    const value = (await requestResult(database.transaction(ASSET_STORE, 'readonly').objectStore(ASSET_STORE).get(ASSET_LIBRARY_ID))) as { assets?: T[] } | undefined
    return Array.isArray(value?.assets) ? value.assets : null
  } finally {
    database.close()
  }
}

const SECRET_KEY_PATTERN = /(api[-_]?key|authorization|access[-_]?token|secret|password|credential|user[-_]?key)/i

function removeSecrets(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(removeSecrets)
  if (!value || typeof value !== 'object') return value
  const clean: Record<string, unknown> = {}
  for (const [key, child] of Object.entries(value as Record<string, unknown>)) {
    if (!SECRET_KEY_PATTERN.test(key)) clean[key] = removeSecrets(child)
  }
  return clean
}

export async function saveHistoryMedia(record: HistoryMediaRecord) {
  await runTransaction<void>([HISTORY_MEDIA_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(HISTORY_MEDIA_STORE).put(record)
  })
}

export async function loadHistoryMedia(id: string) {
  const database = await openDatabase()
  try {
    const record = await requestResult(database.transaction(HISTORY_MEDIA_STORE, 'readonly').objectStore(HISTORY_MEDIA_STORE).get(id))
    return (record as HistoryMediaRecord | undefined) ?? null
  } finally {
    database.close()
  }
}

export async function deleteHistoryMedia(id: string) {
  await runTransaction<void>([HISTORY_MEDIA_STORE], 'readwrite', (transaction) => {
    transaction.objectStore(HISTORY_MEDIA_STORE).delete(id)
  })
}

export async function listHistoryMedia(): Promise<HistoryMediaRecord[]> {
  const database = await openDatabase()
  try {
    const records = await requestResult(database.transaction(HISTORY_MEDIA_STORE, 'readonly').objectStore(HISTORY_MEDIA_STORE).getAll())
    return (records as HistoryMediaRecord[]) ?? []
  } finally {
    database.close()
  }
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('历史图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

async function dataUrlToBlob(dataUrl: string) {
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error(`历史图片还原失败（${response.status}）`)
  return response.blob()
}

export async function exportHistoryMedia(): Promise<SerializedHistoryMedia[]> {
  const records = await listHistoryMedia()
  const exported: SerializedHistoryMedia[] = []
  for (const record of records) {
    try {
      exported.push({
        id: record.id,
        fileName: record.fileName,
        createdAt: record.createdAt,
        dataUrl: await blobToDataUrl(record.blob),
      })
    } catch {
      // Skip unreadable blobs so the rest of the workspace can still export.
    }
  }
  return exported
}

export async function replaceHistoryMediaRecords(records: HistoryMediaRecord[]) {
  await runTransaction<void>([HISTORY_MEDIA_STORE], 'readwrite', (transaction) => {
    const store = transaction.objectStore(HISTORY_MEDIA_STORE)
    store.clear()
    records.forEach((record) => store.put(record))
  })
}

export async function replaceHistoryMedia(serialized: SerializedHistoryMedia[] | undefined) {
  await replaceHistoryMediaRecords(await deserializeHistoryMedia(serialized))
}

export async function loadWorkspaceImportBackup() {
  const database = await openDatabase()
  try {
    const value = await requestResult(database.transaction(IMPORT_BACKUP_STORE, 'readonly').objectStore(IMPORT_BACKUP_STORE).get('latest'))
    return (value as WorkspaceImportBackup | undefined) ?? null
  } finally {
    database.close()
  }
}

export async function restoreWorkspaceImportBackup() {
  const backup = await loadWorkspaceImportBackup()
  if (!backup) throw new Error('没有可恢复的导入前版本')
  await replaceWorkspace(backup.snapshot, backup.historyMedia)
  return backup
}

async function deserializeHistoryMedia(serialized: SerializedHistoryMedia[] | undefined) {
  const records: HistoryMediaRecord[] = []
  for (const item of serialized ?? []) {
    if (!item?.id || typeof item.dataUrl !== 'string' || !item.dataUrl.startsWith('data:')) {
      throw new Error('项目包包含无效的历史媒体资料')
    }
    try {
      records.push({
        id: item.id,
        fileName: item.fileName || 'image.png',
        createdAt: item.createdAt || now(),
        blob: await dataUrlToBlob(item.dataUrl),
      })
    } catch {
      throw new Error(`历史媒体“${item.fileName || item.id}”已损坏，当前工作区未改变`)
    }
  }
  return records
}

export async function exportWorkspaceSnapshot(): Promise<WorkspaceSnapshot> {
  const database = await openDatabase()
  try {
    const transaction = database.transaction([WORKSPACE_PROJECT_STORE, CANVAS_STORE, ASSET_STORE, WORKSPACE_DATA_STORE, AGENT_SESSION_STORE], 'readonly')
    const [projects, canvases, assetRecord, auxiliary, sessions] = await Promise.all([
      requestResult(transaction.objectStore(WORKSPACE_PROJECT_STORE).getAll()),
      requestResult(transaction.objectStore(CANVAS_STORE).getAll()),
      requestResult(transaction.objectStore(ASSET_STORE).get(ASSET_LIBRARY_ID)),
      requestResult(transaction.objectStore(WORKSPACE_DATA_STORE).get(WORKSPACE_DATA_ID)),
      requestResult(transaction.objectStore(AGENT_SESSION_STORE).getAll()),
    ])
    const data = (auxiliary as WorkspaceAuxiliaryData | undefined) ?? { folders: [], generationHistory: [], outputHistory: [], publicSettings: {} }
    return removeSecrets({
      format: 'disy-infinite-workspace',
      version: 1,
      exportedAt: now(),
      projects,
      canvases,
      assets: (assetRecord as { assets?: unknown[] } | undefined)?.assets ?? [],
      folders: data.folders ?? [],
      generationHistory: data.generationHistory ?? [],
      outputHistory: data.outputHistory ?? [],
      publicSettings: data.publicSettings ?? {},
      agentSessions: sessions,
    }) as WorkspaceSnapshot
  } finally {
    database.close()
  }
}

export function validateWorkspaceSnapshot(value: unknown): asserts value is WorkspaceSnapshot {
  if (!value || typeof value !== 'object') throw new Error('项目包不是有效对象')
  const snapshot = value as Partial<WorkspaceSnapshot>
  if (snapshot.format !== 'disy-infinite-workspace' || snapshot.version !== 1) throw new Error('不支持的 Disy 项目包版本')
  if (!Array.isArray(snapshot.projects) || !Array.isArray(snapshot.canvases) || !Array.isArray(snapshot.assets) || !Array.isArray(snapshot.agentSessions)) {
    throw new Error('项目包缺少必要数据')
  }
  if (snapshot.historyMedia !== undefined && !Array.isArray(snapshot.historyMedia)) throw new Error('项目包历史媒体格式无效')
  const projects = snapshot.projects as unknown[]
  const canvases = snapshot.canvases as unknown[]
  const validProjects = projects.every((project) => {
    if (!project || typeof project !== 'object') return false
    const record = project as Record<string, unknown>
    return typeof record.id === 'string'
      && typeof record.activeCanvasId === 'string'
      && Array.isArray(record.canvasIds)
      && record.canvasIds.every((id) => typeof id === 'string')
  })
  if (!validProjects) throw new Error('项目包中的项目索引无效')
  const validCanvases = canvases.every((canvas) => {
    if (!canvas || typeof canvas !== 'object') return false
    const record = canvas as Record<string, unknown>
    return typeof record.id === 'string' && typeof record.projectId === 'string'
  })
  if (!validCanvases) throw new Error('项目包中的画布数据无效')
  const typedProjects = snapshot.projects as WorkspaceProject[]
  const typedCanvases = snapshot.canvases as WorkspaceCanvas[]
  const projectIds = new Set(typedProjects.map((project) => project.id))
  if (typedCanvases.some((canvas) => !projectIds.has(canvas.projectId))) throw new Error('项目包包含无法归属的画布')
  const canvasIds = new Set(typedCanvases.map((canvas) => canvas.id))
  if (typedProjects.some((project) => !project.canvasIds.length || !project.canvasIds.includes(project.activeCanvasId))) {
    throw new Error('项目包中的画布索引无效')
  }
  if (typedProjects.some((project) => project.canvasIds.some((canvasId) => !canvasIds.has(canvasId)))) {
    throw new Error('项目包引用了不存在的画布')
  }
}

export async function replaceWorkspace(
  snapshotValue: unknown,
  historyMediaRecords?: HistoryMediaRecord[],
  options?: { recoverySnapshot?: WorkspaceSnapshot; recoveryHistoryMedia?: HistoryMediaRecord[] },
) {
  validateWorkspaceSnapshot(snapshotValue)
  const snapshot = removeSecrets(snapshotValue) as WorkspaceSnapshot
  normalizeWorkspaceSnapshotNames(snapshot)
  const nextHistoryMedia = historyMediaRecords ?? await deserializeHistoryMedia(snapshot.historyMedia)
  await runTransaction<void>([WORKSPACE_PROJECT_STORE, CANVAS_STORE, ASSET_STORE, WORKSPACE_DATA_STORE, AGENT_SESSION_STORE, HISTORY_MEDIA_STORE, IMPORT_BACKUP_STORE], 'readwrite', (transaction) => {
    const projects = transaction.objectStore(WORKSPACE_PROJECT_STORE)
    const canvases = transaction.objectStore(CANVAS_STORE)
    const assets = transaction.objectStore(ASSET_STORE)
    const data = transaction.objectStore(WORKSPACE_DATA_STORE)
    const sessions = transaction.objectStore(AGENT_SESSION_STORE)
    const historyMedia = transaction.objectStore(HISTORY_MEDIA_STORE)
    const importBackups = transaction.objectStore(IMPORT_BACKUP_STORE)
    projects.clear()
    canvases.clear()
    sessions.clear()
    historyMedia.clear()
    snapshot.projects.forEach((project) => projects.put(project))
    snapshot.canvases.forEach((canvas) => canvases.put(canvas))
    snapshot.agentSessions.forEach((session) => sessions.put(session))
    nextHistoryMedia.forEach((record) => historyMedia.put(record))
    if (options?.recoverySnapshot) {
      importBackups.put({
        id: 'latest',
        createdAt: now(),
        snapshot: removeSecrets(options.recoverySnapshot) as WorkspaceSnapshot,
        historyMedia: options.recoveryHistoryMedia ?? [],
      } satisfies WorkspaceImportBackup)
    }
    assets.put({ id: ASSET_LIBRARY_ID, assets: snapshot.assets, updatedAt: now() })
    data.put({
      id: WORKSPACE_DATA_ID,
      folders: snapshot.folders ?? [],
      generationHistory: snapshot.generationHistory ?? [],
      outputHistory: snapshot.outputHistory ?? [],
      publicSettings: snapshot.publicSettings ?? {},
      updatedAt: now(),
    })
  })
  return snapshot
}

function remapImportedMediaIds(value: unknown, mediaIdMap: Map<string, string>): void {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    value.forEach((item) => remapImportedMediaIds(item, mediaIdMap))
    return
  }
  const record = value as Record<string, unknown>
  Object.entries(record).forEach(([key, item]) => {
    if (typeof item === 'string' && mediaIdMap.has(item)) record[key] = mediaIdMap.get(item)!
    else remapImportedMediaIds(item, mediaIdMap)
  })
}

function prepareImportedProjectData(snapshotValue: unknown, historyMediaRecords?: HistoryMediaRecord[]) {
  validateWorkspaceSnapshot(snapshotValue)
  const snapshot = structuredClone(removeSecrets(snapshotValue)) as WorkspaceSnapshot
  const timestamp = now()
  const projectIdMap = new Map(snapshot.projects.map((project) => [project.id, crypto.randomUUID()]))
  const canvasIdMap = new Map(snapshot.canvases.map((canvas) => [canvas.id, crypto.randomUUID()]))
  const mediaIdMap = new Map((historyMediaRecords ?? []).map((record) => [record.id, `history-media-${crypto.randomUUID()}`]))
  remapImportedMediaIds(snapshot, mediaIdMap)

  const projects = snapshot.projects.map((project) => ({
    ...project,
    id: projectIdMap.get(project.id)!,
    activeCanvasId: canvasIdMap.get(project.activeCanvasId)!,
    canvasIds: project.canvasIds.map((id) => canvasIdMap.get(id)!),
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  const canvases = snapshot.canvases.map((canvas) => ({
    ...canvas,
    id: canvasIdMap.get(canvas.id)!,
    projectId: projectIdMap.get(canvas.projectId)!,
    createdAt: timestamp,
    updatedAt: timestamp,
  }))
  const sessions = snapshot.agentSessions
    .filter((session) => projectIdMap.has(session.projectId) && canvasIdMap.has(session.canvasId))
    .map((session) => ({
      ...session,
      id: crypto.randomUUID(),
      projectId: projectIdMap.get(session.projectId)!,
      canvasId: canvasIdMap.get(session.canvasId)!,
      createdAt: timestamp,
      updatedAt: timestamp,
    }))
  const historyMedia = (historyMediaRecords ?? []).map((record) => ({
    ...record,
    id: mediaIdMap.get(record.id)!,
  }))
  return { projects, canvases, sessions, historyMedia }
}

/** Append imported packages as independent projects without touching existing workspace data. */
export async function appendWorkspaceProjects(snapshotValue: unknown, historyMediaRecords?: HistoryMediaRecord[]) {
  const imported = prepareImportedProjectData(snapshotValue, historyMediaRecords)
  const existingProjects = await listWorkspaceProjects()
  const usedNames = existingProjects.map((project) => project.name)
  imported.projects.forEach((project) => {
    project.name = makeUniqueWorkspaceName(project.name, usedNames, '导入项目')
    usedNames.push(project.name)
  })
  await runTransaction<void>([WORKSPACE_PROJECT_STORE, CANVAS_STORE, AGENT_SESSION_STORE, HISTORY_MEDIA_STORE], 'readwrite', (transaction) => {
    const projects = transaction.objectStore(WORKSPACE_PROJECT_STORE)
    const canvases = transaction.objectStore(CANVAS_STORE)
    const sessions = transaction.objectStore(AGENT_SESSION_STORE)
    const historyMedia = transaction.objectStore(HISTORY_MEDIA_STORE)
    imported.projects.forEach((project) => projects.put(project))
    imported.canvases.forEach((canvas) => canvases.put(canvas))
    imported.sessions.forEach((session) => sessions.put(session))
    imported.historyMedia.forEach((record) => historyMedia.put(record))
  })
  return imported.projects
}

/** Replace only one open project; every other project and global workspace data is preserved. */
export async function replaceWorkspaceProject(
  targetProjectId: string,
  snapshotValue: unknown,
  historyMediaRecords?: HistoryMediaRecord[],
  options?: { recoverySnapshot?: WorkspaceSnapshot; recoveryHistoryMedia?: HistoryMediaRecord[] },
) {
  const target = await loadWorkspaceProject(targetProjectId)
  if (!target) throw new Error('当前项目不存在')
  const imported = prepareImportedProjectData(snapshotValue, historyMediaRecords)
  const sourceProject = imported.projects[0]
  if (!sourceProject) throw new Error('导入包没有项目')
  const sourceCanvases = imported.canvases.filter((canvas) => canvas.projectId === sourceProject.id)
  if (!sourceCanvases.length) throw new Error('导入项目没有画布')
  const sourceCanvasIds = new Set(sourceCanvases.map((canvas) => canvas.id))
  const nextProject: WorkspaceProject = {
    ...sourceProject,
    id: targetProjectId,
    name: sourceProject.name || target.name,
    createdAt: target.createdAt,
    updatedAt: now(),
  }
  const nextCanvases = sourceCanvases.map((canvas) => ({ ...canvas, projectId: targetProjectId }))
  const nextSessions = imported.sessions
    .filter((session) => sourceCanvasIds.has(session.canvasId))
    .map((session) => ({ ...session, projectId: targetProjectId }))
  const stores = [WORKSPACE_PROJECT_STORE, CANVAS_STORE, AGENT_SESSION_STORE, HISTORY_MEDIA_STORE, IMPORT_BACKUP_STORE]
  await runTransaction<void>(stores, 'readwrite', (transaction) => {
    const canvases = transaction.objectStore(CANVAS_STORE)
    const sessions = transaction.objectStore(AGENT_SESSION_STORE)
    const oldCanvases = canvases.index('projectId').openKeyCursor(IDBKeyRange.only(targetProjectId))
    oldCanvases.onsuccess = () => {
      const cursor = oldCanvases.result
      if (!cursor) return
      canvases.delete(cursor.primaryKey)
      cursor.continue()
    }
    const oldSessions = sessions.index('projectId').openKeyCursor(IDBKeyRange.only(targetProjectId))
    oldSessions.onsuccess = () => {
      const cursor = oldSessions.result
      if (!cursor) return
      sessions.delete(cursor.primaryKey)
      cursor.continue()
    }
    transaction.objectStore(WORKSPACE_PROJECT_STORE).put(nextProject)
    nextCanvases.forEach((canvas) => canvases.put(canvas))
    nextSessions.forEach((session) => sessions.put(session))
    imported.historyMedia.forEach((record) => transaction.objectStore(HISTORY_MEDIA_STORE).put(record))
    if (options?.recoverySnapshot) {
      transaction.objectStore(IMPORT_BACKUP_STORE).put({
        id: 'latest',
        createdAt: now(),
        snapshot: removeSecrets(options.recoverySnapshot) as WorkspaceSnapshot,
        historyMedia: options.recoveryHistoryMedia ?? [],
      } satisfies WorkspaceImportBackup)
    }
  })
  return { project: nextProject, canvases: nextCanvases }
}
