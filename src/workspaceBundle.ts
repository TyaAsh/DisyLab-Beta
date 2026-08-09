/** Binary DisyLab workspace bundle — avoids giant base64 JSON string limits. */

const MAGIC = 'DISYLAB1'
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
  if (bytes.byteLength < MAGIC.length + 4) return false
  return decodeUtf8(bytes.subarray(0, MAGIC.length)) === MAGIC
}

export async function packWorkspaceBundle(
  manifest: Record<string, unknown>,
  media: Iterable<BundleMediaEntry>,
): Promise<Blob> {
  const mediaList = [...media]
  const manifestBytes = encodeUtf8(JSON.stringify(manifest))
  const parts: BlobPart[] = [MAGIC, u32(manifestBytes.byteLength), manifestBytes, u32(mediaList.length)]

  for (const entry of mediaList) {
    const idBytes = encodeUtf8(entry.id)
    const fileNameBytes = encodeUtf8(entry.fileName || 'image.bin')
    const createdAtBytes = encodeUtf8(entry.createdAt || '')
    const kindBytes = encodeUtf8(entry.kind || 'asset')
    const typeBytes = encodeUtf8(entry.blob.type || 'application/octet-stream')
    const data = new Uint8Array(await entry.blob.arrayBuffer())
    if (idBytes.byteLength > 0xffff) throw new Error('媒体 ID 过长')
    if (fileNameBytes.byteLength > 0xffff) throw new Error('媒体文件名过长')
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
      u32(data.byteLength),
      data,
    )
  }

  return new Blob(parts, { type: 'application/octet-stream' })
}

export async function unpackWorkspaceBundle(file: Blob): Promise<UnpackedWorkspaceBundle> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  if (!isWorkspaceBundle(bytes)) throw new Error('不是 DisyLab 二进制项目包')

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  let offset = MAGIC.length
  const manifestLength = readU32(view, offset)
  offset += 4
  if (offset + manifestLength > bytes.byteLength) throw new Error('项目包清单已损坏')
  const manifestText = decodeUtf8(bytes.subarray(offset, offset + manifestLength))
  offset += manifestLength
  const manifest = JSON.parse(manifestText) as Record<string, unknown>

  if (offset + 4 > bytes.byteLength) throw new Error('项目包媒体索引已损坏')
  const mediaCount = readU32(view, offset)
  offset += 4
  const media = new Map<string, BundleMediaEntry>()

  for (let index = 0; index < mediaCount; index += 1) {
    const idLength = readU16(view, offset)
    offset += 2
    const id = decodeUtf8(bytes.subarray(offset, offset + idLength))
    offset += idLength

    const fileNameLength = readU16(view, offset)
    offset += 2
    const fileName = decodeUtf8(bytes.subarray(offset, offset + fileNameLength))
    offset += fileNameLength

    const createdAtLength = readU16(view, offset)
    offset += 2
    const createdAt = decodeUtf8(bytes.subarray(offset, offset + createdAtLength))
    offset += createdAtLength

    const kindLength = bytes[offset]
    offset += 1
    const kindText = decodeUtf8(bytes.subarray(offset, offset + kindLength))
    offset += kindLength

    const typeLength = bytes[offset]
    offset += 1
    const contentType = decodeUtf8(bytes.subarray(offset, offset + typeLength)) || 'application/octet-stream'
    offset += typeLength

    const dataLength = readU32(view, offset)
    offset += 4
    const data = bytes.subarray(offset, offset + dataLength)
    offset += dataLength

    media.set(id, {
      id,
      fileName,
      createdAt: createdAt || undefined,
      kind: kindText === 'history' ? 'history' : 'asset',
      blob: new Blob([data], { type: contentType }),
    })
  }

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

export async function extractMediaIntoBundle(
  value: unknown,
  media: Map<string, BundleMediaEntry>,
  options?: { skipped?: { count: number } },
): Promise<void> {
  if (!value || typeof value !== 'object') return
  if (Array.isArray(value)) {
    for (const item of value) await extractMediaIntoBundle(item, media, options)
    return
  }

  const record = value as Record<string, unknown>
  const mediaId = typeof record.mediaId === 'string' ? record.mediaId : ''
  if (mediaId && media.has(mediaId)) {
    if (typeof record.imageUrl !== 'string' || !record.imageUrl.startsWith(BUNDLE_MEDIA_PREFIX)) {
      record.imageUrl = `${BUNDLE_MEDIA_PREFIX}${mediaId}`
    }
  }

  for (const [key, child] of Object.entries(record)) {
    if (MEDIA_KEYS.has(key) && typeof child === 'string') {
      const source = child.trim()
      if (!source || source.startsWith(BUNDLE_MEDIA_PREFIX)) continue
      if (!/^(?:https?:|blob:|data:)/i.test(source)) continue

      let id = mediaId && key === 'imageUrl' ? mediaId : ''
      if (id && media.has(id)) {
        record[key] = `${BUNDLE_MEDIA_PREFIX}${id}`
        continue
      }

      const blob = await fetchMediaBlob(source, source.startsWith('data:') ? 30_000 : 3500)
      if (!blob) {
        if (options?.skipped) options.skipped.count += 1
        continue
      }
      id = id || `media-${crypto.randomUUID()}`
      if (!media.has(id)) {
        media.set(id, {
          id,
          blob,
          fileName: typeof record.fileName === 'string' ? record.fileName : 'image.bin',
          createdAt: typeof record.createdAt === 'string' ? record.createdAt : undefined,
          kind: mediaId && id === mediaId ? 'history' : 'asset',
        })
      }
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
