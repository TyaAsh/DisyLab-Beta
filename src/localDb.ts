const DATABASE_NAME = 'disy-infinite-local'
const DATABASE_VERSION = 3
const LEGACY_PROJECT_STORE = 'projects'
const ASSET_STORE = 'assets'
const WORKSPACE_PROJECT_STORE = 'workspace-projects'
const CANVAS_STORE = 'canvases'
const WORKSPACE_DATA_STORE = 'workspace-data'
const AGENT_SESSION_STORE = 'agent-sessions'
const ASSET_LIBRARY_ID = 'library'
const WORKSPACE_DATA_ID = 'workspace'

export const DEFAULT_PROJECT_ID = 'default-project'

export type LocalProject = {
  id: string
  name: string
  nodes: unknown[]
  edges: unknown[]
  styleReferenceName: string
  styleReferenceUrl?: string
  styleReferenceEnabled?: boolean
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
}

const now = () => new Date().toISOString()
const defaultCanvasId = (projectId: string) => `${projectId}--canvas-default`

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
  const next = { ...project, name: name.trim() || '未命名项目', updatedAt: now() }
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
  const timestamp = now()
  const projectId = crypto.randomUUID()
  const canvasId = crypto.randomUUID()
  const project: WorkspaceProject = {
    id: projectId,
    name,
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
  const next = { ...canvas, name: name.trim() || '未命名画布', updatedAt: now() }
  await saveWorkspaceCanvas(next)
  return next
}

export async function createWorkspaceCanvas(projectId: string, name?: string, source?: Partial<WorkspaceCanvas>) {
  const project = await loadWorkspaceProject(projectId)
  if (!project) throw new Error('项目不存在')
  const timestamp = now()
  const id = crypto.randomUUID()
  const canvas: WorkspaceCanvas = {
    id,
    projectId,
    name: name || `画布 ${project.canvasIds.length + 1}`,
    nodes: source?.nodes ?? [],
    edges: source?.edges ?? [],
    styleReferenceName: source?.styleReferenceName ?? '',
    styleReferenceUrl: source?.styleReferenceUrl,
    styleReferenceEnabled: source?.styleReferenceEnabled,
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
  const projectIds = new Set(snapshot.projects.map((project) => project.id))
  if (snapshot.canvases.some((canvas) => !projectIds.has(canvas.projectId))) throw new Error('项目包包含无法归属的画布')
  const canvasIds = new Set(snapshot.canvases.map((canvas) => canvas.id))
  if (snapshot.projects.some((project) => !project.canvasIds.length || !project.canvasIds.includes(project.activeCanvasId))) {
    throw new Error('项目包中的画布索引无效')
  }
  if (snapshot.projects.some((project) => project.canvasIds.some((canvasId) => !canvasIds.has(canvasId)))) {
    throw new Error('项目包引用了不存在的画布')
  }
}

export async function replaceWorkspace(snapshotValue: unknown) {
  validateWorkspaceSnapshot(snapshotValue)
  const snapshot = removeSecrets(snapshotValue) as WorkspaceSnapshot
  await runTransaction<void>([WORKSPACE_PROJECT_STORE, CANVAS_STORE, ASSET_STORE, WORKSPACE_DATA_STORE, AGENT_SESSION_STORE], 'readwrite', (transaction) => {
    const projects = transaction.objectStore(WORKSPACE_PROJECT_STORE)
    const canvases = transaction.objectStore(CANVAS_STORE)
    const assets = transaction.objectStore(ASSET_STORE)
    const data = transaction.objectStore(WORKSPACE_DATA_STORE)
    const sessions = transaction.objectStore(AGENT_SESSION_STORE)
    projects.clear()
    canvases.clear()
    sessions.clear()
    snapshot.projects.forEach((project) => projects.put(project))
    snapshot.canvases.forEach((canvas) => canvases.put(canvas))
    snapshot.agentSessions.forEach((session) => sessions.put(session))
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
