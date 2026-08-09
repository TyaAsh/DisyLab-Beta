/** Binary DisyLab workspace bundle — avoids giant base64 JSON string limits. */

const MAGIC = 'DISYLAB1'
const MAX_MANIFEST_BYTES = 256 * 1024 * 1024
const MAX_MEDIA_COUNT = 10_000
const MAX_BUNDLE_BYTES = 16 * 1024 * 1024 * 1024
export const BUNDLE_MEDIA_PREFIX = 'disy-media:'

export type BundleMediaEntry = {
  id: string
  blob: Blob
  fileName?: string
  createdAt?: string
  kind?: 'history' | 'asset'
}

export type UnpackedWorkspaceBundle = {
  manifest: Record<string, unknown>
  media: Map<string, BundleMediaEntry>
}

function encodeUtf8(text: string) {
  return new TextEncoder().encode(text)
}

function decodeUtf8(bytes: Uint8Array) {
  return new TextDecoder().decode(bytes)
}

function u8(n: number) {
  return Uint8Array.of(n & 0xff)
}

function u16(n: number) {
  const bytes = new Uint8Array(2)
  new DataView(bytes.buffer).setUint16(0, n, false)
  return bytes
}

function u32(n: number) {
  const bytes = new Uint8Array(4)
  new DataView(bytes.buffer).setUint32(0, n, false)
  return bytes
}

function readU16(view: DataView, offset: number) {
  return view.getUint16(offset, false)
}

function readU32(view: DataView, offset: number) {
  return view.getUint32(offset, false)
}

export function isWorkspaceBundle(bytes: Uint8Array) {
  if (bytes.byteLength < MAGIC.length) return false
  return decodeUtf8(bytes.subarray(0, MAGIC.length)) === MAGIC
}

export async function packWorkspaceBundle(
  manifest: Record<string, unknown>,
  media: Iterable<BundleMediaEntry>,
): Promise<Blob> {
  const mediaList = [...media]
  const manifestBytes = encodeUtf8(JSON.stringify(manifest))
  if (manifestBytes.byteLength > MAX_MANIFEST_BYTES) throw new Error('项目包清单超过 256 MB，无法安全导出')
  if (mediaList.length > MAX_MEDIA_COUNT) throw new Error(`项目包包含超过 ${MAX_MEDIA_COUNT} 个媒体文件，无法安全导出`)
  const parts: BlobPart[] = [MAGIC, u32(manifestBytes.byteLength), manifestBytes, u32(mediaList.length)]

  for (const entry of mediaList) {
    const idBytes = encodeUtf8(entry.id)
    const fileNameBytes = encodeUtf8(entry.fileName || 'image.bin')
    const createdAtBytes = encodeUtf8(entry.createdAt || '')
    const kindBytes = encodeUtf8(entry.kind || 'asset')
    const typeBytes = encodeUtf8(entry.blob.type || 'application/octet-stream')
    if (idBytes.byteLength > 0xffff) throw new Error('媒体 ID 过长')
    if (fileNameBytes.byteLength > 0xffff) throw new Error('媒体文件名过长')
    if (createdAtBytes.byteLength > 0xffff) throw new Error('媒体创建时间过长')
    if (kindBytes.byteLength > 0xff) throw new Error('媒体类型过长')
    if (typeBytes.byteLength > 0xff) throw new Error('媒体内容类型过长')
    if (entry.blob.size > 0xffffffff) throw new Error(`媒体文件“${entry.fileName || entry.id}”超过 4 GB，无法安全导出`)
    parts.push(
      u16(idBytes.byteLength),
      idBytes,
      u16(fileNameBytes.byteLength),
      fileNameBytes,
      u16(createdAtBytes.byteLength),
      createdAtBytes,
      u8(kindBytes.byteLength),
      kindBytes,
      u8(typeBytes.byteLength),
      typeBytes,
      u32(entry.blob.size),
      entry.blob,
    )
  }

  const bundle = new Blob(parts, { type: 'application/octet-stream' })
  if (bundle.size > MAX_BUNDLE_BYTES) throw new Error('项目包超过 16 GB，当前浏览器无法安全导出')
  return bundle
}

export async function unpackWorkspaceBundle(file: Blob): Promise<UnpackedWorkspaceBundle> {
  if (file.size > MAX_BUNDLE_BYTES) throw new Error('项目包超过 16 GB，当前浏览器无法安全导入')
  let offset = 0
  const readBytes = async (length: number, label: string) => {
    if (!Number.isSafeInteger(length) || length < 0 || offset < 0 || offset + length > file.size) {
      throw new Error(`${label}已损坏`)
    }
    const bytes = new Uint8Array(await file.slice(offset, offset + length).arrayBuffer())
    offset += length
    return bytes
  }
  const readLength16 = async (label: string) => {
    const bytes = await readBytes(2, label)
    return readU16(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0)
  }
  const readLength32 = async (label: string) => {
    const bytes = await readBytes(4, label)
    return readU32(new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength), 0)
  }

  const header = await readBytes(MAGIC.length, '项目包文件头')
  if (!isWorkspaceBundle(header)) throw new Error('不是 DisyLab 二进制项目包')

  const manifestLength = await readLength32('项目包清单索引')
  if (manifestLength > MAX_MANIFEST_BYTES) throw new Error('项目包清单超过 256 MB，无法安全导入')
  const manifestText = decodeUtf8(await readBytes(manifestLength, '项目包清单'))
  let manifest: Record<string, unknown>
  try {
    manifest = JSON.parse(manifestText) as Record<string, unknown>
  } catch {
    throw new Error('项目包清单不是有效的 JSON 数据')
  }

  const mediaCount = await readLength32('项目包媒体索引')
  if (mediaCount > MAX_MEDIA_COUNT) throw new Error(`项目包包含超过 ${MAX_MEDIA_COUNT} 个媒体文件，无法安全导入`)
  const media = new Map<string, BundleMediaEntry>()

  for (let index = 0; index < mediaCount; index += 1) {
    const label = `项目包媒体 #${index + 1}`
    const idLength = await readLength16(`${label} ID 索引`)
    const id = decodeUtf8(await readBytes(idLength, `${label} ID`))

    const fileNameLength = await readLength16(`${label}文件名索引`)
    const fileName = decodeUtf8(await readBytes(fileNameLength, `${label}文件名`))

    const createdAtLength = await readLength16(`${label}创建时间索引`)
    const createdAt = decodeUtf8(await readBytes(createdAtLength, `${label}创建时间`))

    const kindLength = (await readBytes(1, `${label}类型索引`))[0]
    const kindText = decodeUtf8(await readBytes(kindLength, `${label}类型`))

    const typeLength = (await readBytes(1, `${label}内容类型索引`))[0]
    const contentType = decodeUtf8(await readBytes(typeLength, `${label}内容类型`)) || 'application/octet-stream'

    const dataLength = await readLength32(`${label}数据索引`)
    if (offset + dataLength > file.size) throw new Error(`${label}数据已损坏`)
    const blob = file.slice(offset, offset + dataLength, contentType)
    offset += dataLength

    if (media.has(id)) throw new Error(`${label}使用了重复媒体 ID，项目包已损坏`)
    media.set(id, {
      id,
      fileName,
      createdAt: createdAt || undefined,
      kind: kindText === 'history' ? 'history' : 'asset',
      blob,
    })
  }

  if (offset !== file.size) throw new Error('项目包包含无法识别的尾部数据')

  return { manifest, media }
}

export async function fetchMediaBlob(source: string, timeoutMs = 3500): Promise<Blob | null> {
  const trimmed = source.trim()
  if (!trimmed) return null
  if (trimmed.startsWith(BUNDLE_MEDIA_PREFIX)) return null
  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const response = await fetch(trimmed, { signal: controller.signal })
    if (!response.ok) return null
    const blob = await response.blob()
    return blob.size ? blob : null
  } catch {
    return null
  } finally {
    window.clearTimeout(timer)
  }
}

export async function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
    reader.readAsDataURL(blob)
  })
}

const MEDIA_KEYS = new Set(['url', 'imageUrl', 'styleReferenceUrl', 'referenceImageUrl'])

function mediaSourceKey(source: string, kind: NonNullable<BundleMediaEntry['kind']>) {
  return `${kind}:${source}`
}

async function mediaContentKey(blob: Blob, kind: NonNullable<BundleMediaEntry['kind']>) {
  if (!crypto.subtle) return null
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', await blob.arrayBuffer()))
  const hash = Array.from(digest, (byte) => byte.toString(16).padStart(2, '0')).join('')
  // History media is persisted separately during import. Never let an ordinary
  // canvas/asset image reuse a history ID, even when their bytes are identical.
  return `${kind}:${blob.type}:${blob.size}:${hash}`
}

export function collectReferencedMediaIds(value: unknown, ids = new Set<string>()): Set<string> {
  if (!value || typeof value !== 'object') return ids
  if (Array.isArray(value)) {
    value.forEach((item) => collectReferencedMediaIds(item, ids))
    return ids
  }
  const record = value as Record<string, unknown>
  if (typeof record.mediaId === 'string' && record.mediaId) ids.add(record.mediaId)
  Object.values(record).forEach((child) => collectReferencedMediaIds(child, ids))
  return ids
}

export async function extractMediaIntoBundle(
  value: unknown,
  media: Map<string, BundleMediaEntry>,
  options: {
    skipped?: { count: number }
    sourceIds?: Map<string, string>
    contentIds?: Map<string, string>
    contentIndexReady?: boolean
  } = {},
): Promise<void> {
  const sourceIds = options.sourceIds ??= new Map<string, string>()
  const contentIds = options.contentIds ??= new Map<string, string>()
  if (!options.contentIndexReady) {
    options.contentIndexReady = true
    for (const entry of media.values()) {
      const key = await mediaContentKey(entry.blob, entry.kind ?? 'asset')
      if (key && !contentIds.has(key)) contentIds.set(key, entry.id)
    }
  }
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) await extractMediaIntoBundle(item, media, options)
    return
  }

  const record = value as Record<string, unknown>
  const mediaId = typeof record.mediaId === 'string' ? record.mediaId : ''
  if (mediaId && media.has(mediaId)) {
    const originalImageUrl = typeof record.imageUrl === 'string' ? record.imageUrl.trim() : ''
    if (originalImageUrl && !originalImageUrl.startsWith(BUNDLE_MEDIA_PREFIX)) {
      sourceIds.set(mediaSourceKey(originalImageUrl, 'history'), mediaId)
    }
    if (typeof record.imageUrl !== 'string' || !record.imageUrl.startsWith(BUNDLE_MEDIA_PREFIX)) {
      record.imageUrl = `${BUNDLE_MEDIA_PREFIX}${mediaId}`
    }
  }

  for (const [key, child] of Object.entries(record)) {
    if (MEDIA_KEYS.has(key) && typeof child === 'string') {
      const source = child.trim()
      if (!source || source.startsWith(BUNDLE_MEDIA_PREFIX)) continue
      if (!/^(?:https?:|blob:|data:)/i.test(source)) continue

      const intendedKind: NonNullable<BundleMediaEntry['kind']> = mediaId && key === 'imageUrl' ? 'history' : 'asset'
      const existingId = sourceIds.get(mediaSourceKey(source, intendedKind))
      if (existingId && media.has(existingId)) {
        record[key] = `${BUNDLE_MEDIA_PREFIX}${existingId}`
        continue
      }

      let id = mediaId && key === 'imageUrl' ? mediaId : ''
      if (id && media.has(id)) {
        record[key] = `${BUNDLE_MEDIA_PREFIX}${id}`
        continue
      }

      const blob = await fetchMediaBlob(source, source.startsWith('data:') ? 30_000 : 3500)
      if (!blob) {
        if (mediaId && key === 'imageUrl' && record.mediaId === mediaId) delete record.mediaId
        if (options?.skipped) options.skipped.count += 1
        continue
      }
      const contentKey = await mediaContentKey(blob, intendedKind)
      const duplicateId = contentKey ? contentIds.get(contentKey) : undefined
      if (duplicateId && media.has(duplicateId)) {
        sourceIds.set(mediaSourceKey(source, intendedKind), duplicateId)
        record[key] = `${BUNDLE_MEDIA_PREFIX}${duplicateId}`
        continue
      }
      id = id || `media-${crypto.randomUUID()}`
      if (!media.has(id)) {
        media.set(id, {
          id,
          blob,
          fileName: typeof record.fileName === 'string' ? record.fileName : 'image.bin',
          createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
          kind: intendedKind,
        })
      }
      if (contentKey) contentIds.set(contentKey, id)
      sourceIds.set(mediaSourceKey(source, intendedKind), id)
      record[key] = `${BUNDLE_MEDIA_PREFIX}${id}`
    } else {
      await extractMediaIntoBundle(child, media, options)
    }
  }
}

export async function reinflateBundleMedia(
  value: unknown,
  media: Map<string, BundleMediaEntry>,
  dataUrlCache = new Map<string, string>(),
): Promise<void> {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) await reinflateBundleMedia(item, media, dataUrlCache)
    return
  }

  const record = value as Record<string, unknown>
  for (const [key, child] of Object.entries(record)) {
    if (MEDIA_KEYS.has(key) && typeof child === 'string' && child.startsWith(BUNDLE_MEDIA_PREFIX)) {
      const id = child.slice(BUNDLE_MEDIA_PREFIX.length)
      const entry = media.get(id)
      if (!entry) continue
      let dataUrl = dataUrlCache.get(id)
      if (!dataUrl) {
        dataUrl = await blobToDataUrl(entry.blob)
        dataUrlCache.set(id, dataUrl)
      }
      record[key] = dataUrl
      if (!record.mediaId && entry.kind === 'history') record.mediaId = id
    } else {
      await reinflateBundleMedia(child, media, dataUrlCache)
    }
  }
}

export function triggerBlobDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName
  anchor.rel = 'noopener'
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
