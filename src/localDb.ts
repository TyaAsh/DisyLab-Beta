const DATABASE_NAME = 'disy-infinite-local'
const DATABASE_VERSION = 1
const PROJECT_STORE = 'projects'

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

function openDatabase() {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION)
    request.onupgradeneeded = () => {
      const database = request.result
      if (!database.objectStoreNames.contains(PROJECT_STORE)) {
        database.createObjectStore(PROJECT_STORE, { keyPath: 'id' })
      }
    }
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

export async function saveLocalProject(project: LocalProject) {
  const database = await openDatabase()
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, 'readwrite')
    transaction.objectStore(PROJECT_STORE).put(project)
    transaction.oncomplete = () => {
      database.close()
      resolve()
    }
    transaction.onerror = () => {
      database.close()
      reject(transaction.error)
    }
  })
}

export async function loadLocalProject(id: string) {
  const database = await openDatabase()
  return new Promise<LocalProject | null>((resolve, reject) => {
    const transaction = database.transaction(PROJECT_STORE, 'readonly')
    const request = transaction.objectStore(PROJECT_STORE).get(id)
    request.onsuccess = () => resolve((request.result as LocalProject | undefined) ?? null)
    request.onerror = () => reject(request.error)
    transaction.oncomplete = () => database.close()
  })
}
