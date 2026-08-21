import { openDB } from 'idb'
import type { SkillManifest } from './types'
import { skillKey } from './types'

const dbPromise = openDB('disylab-skill-system', 1, {
  upgrade(db) {
    if (!db.objectStoreNames.contains('skill_manifests')) db.createObjectStore('skill_manifests', { keyPath: 'key' })
  },
})

export async function listUserSkillManifests(): Promise<SkillManifest[]> {
  const rows = await (await dbPromise).getAll('skill_manifests') as Array<{ key: string; manifest: SkillManifest }>
  return rows.map((row) => row.manifest).filter((skill) => skill.source === 'user')
}

export async function saveUserSkillManifest(manifest: SkillManifest) {
  await (await dbPromise).put('skill_manifests', { key: skillKey(manifest), manifest })
}

export async function deleteUserSkillManifest(manifest: SkillManifest) {
  await (await dbPromise).delete('skill_manifests', skillKey(manifest))
}
