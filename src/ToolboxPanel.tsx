import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { PDFDocument } from 'pdf-lib'
import { Check, ChevronLeft, Combine, Download, FileArchive, FileImage, Film, GripVertical, LoaderCircle, PackageOpen, Trash2, Upload, X } from 'lucide-react'

type ToolKind = 'image' | 'video' | 'pdf-compress' | 'pdf-merge'
type ToolFile = { id: string; file: File }

const tools: Array<{ kind: ToolKind; title: string; detail: string; icon: typeof FileImage; accept: string; multiple: boolean }> = [
  { kind: 'image', title: '图片压缩', detail: 'JPG、PNG、WebP、AVIF', icon: FileImage, accept: '.jpg,.jpeg,.png,.webp,.avif,image/jpeg,image/png,image/webp,image/avif', multiple: true },
  { kind: 'video', title: '视频压缩', detail: 'MP4、MOV、WebM、M4V、MKV', icon: Film, accept: '.mp4,.mov,.webm,.m4v,.mkv,.avi,.ogv,video/*', multiple: false },
  { kind: 'pdf-compress', title: 'PDF 压缩', detail: '优化文件结构', icon: FileArchive, accept: 'application/pdf', multiple: true },
  { kind: 'pdf-merge', title: 'PDF 合并', detail: '按顺序合成', icon: Combine, accept: 'application/pdf', multiple: true },
]

const formatBytes = (bytes: number) => bytes < 1024 * 1024 ? `${Math.max(.1, bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB`
const downloadBlob = (blob: Blob, name: string) => { const url = URL.createObjectURL(blob); const anchor = document.createElement('a'); anchor.href = url; anchor.download = name; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000) }
const pdfBlob = (bytes: Uint8Array) => new Blob([Uint8Array.from(bytes).buffer], { type: 'application/pdf' })
const outputName = (name: string, suffix: string, extension?: string) => `${name.replace(/\.[^.]+$/, '')}-${suffix}.${extension || name.split('.').pop() || 'bin'}`

async function compressImage(file: File, quality: number, maxEdge: number) {
  const bitmap = await createImageBitmap(file)
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale))
  canvas.getContext('2d', { alpha: file.type === 'image/png' })?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  bitmap.close()
  const extension = file.name.split('.').pop()?.toLowerCase() || 'jpg'
  const type = file.type || ({ jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', avif: 'image/avif' } as Record<string, string>)[extension]
  if (!type) throw new Error(`暂不支持 ${extension.toUpperCase()} 原格式编码`)
  const blob = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('图片编码失败')), type, quality))
  if (blob.type !== type) throw new Error(`当前浏览器不能输出 ${extension.toUpperCase()}，已停止处理以保持原格式`)
  return { blob, name: outputName(file.name, 'compressed', extension) }
}

async function compressVideo(file: File, quality: number) {
  const video = document.createElement('video'); video.src = URL.createObjectURL(file); video.muted = true; video.playsInline = true
  await new Promise<void>((resolve, reject) => { video.onloadedmetadata = () => resolve(); video.onerror = () => reject(new Error('无法读取视频')) })
  const capture = (video as HTMLVideoElement & { captureStream?: () => MediaStream }).captureStream
  if (!capture || typeof MediaRecorder === 'undefined') { URL.revokeObjectURL(video.src); throw new Error('当前浏览器不支持本地视频压缩') }
  const stream = capture.call(video)
  const sourceExtension = file.name.split('.').pop()?.toLowerCase() || 'webm'
  const sameContainer = file.type && MediaRecorder.isTypeSupported(file.type) ? file.type : ''
  const mimeType = sameContainer || (MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus') ? 'video/webm;codecs=vp9,opus' : 'video/webm')
  const chunks: BlobPart[] = []; const bitrate = Math.round(400_000 + quality * 3_600_000)
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: bitrate })
  const result = new Promise<Blob>((resolve, reject) => { recorder.ondataavailable = (event) => event.data.size && chunks.push(event.data); recorder.onerror = () => reject(new Error('视频编码失败')); recorder.onstop = () => resolve(new Blob(chunks, { type: mimeType.split(';')[0] })) })
  video.onended = () => recorder.state !== 'inactive' && recorder.stop(); recorder.start(500); await video.play(); const blob = await result
  stream.getTracks().forEach((track) => track.stop()); URL.revokeObjectURL(video.src)
  return { blob, name: outputName(file.name, 'compressed', sameContainer ? sourceExtension : 'webm'), converted: !sameContainer }
}

export function ToolboxPanel({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [active, setActive] = useState<ToolKind | null>(null)
  const [files, setFiles] = useState<ToolFile[]>([])
  const [quality, setQuality] = useState(72)
  const [maxEdge, setMaxEdge] = useState(2560)
  const [busy, setBusy] = useState(false)
  const [status, setStatus] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const definition = tools.find((tool) => tool.kind === active)
  const totalSize = useMemo(() => files.reduce((sum, item) => sum + item.file.size, 0), [files])

  useEffect(() => { if (!open) { setActive(null); setFiles([]); setStatus('') } }, [open])
  useEffect(() => { const close = (event: KeyboardEvent) => event.key === 'Escape' && onClose(); if (open) window.addEventListener('keydown', close); return () => window.removeEventListener('keydown', close) }, [open, onClose])

  const addFiles = (list: FileList | null) => {
    if (!list || !definition) return
    const acceptedExtensions = definition.accept.split(',').filter((value) => value.startsWith('.'))
    const incoming = Array.from(list).filter((file) => file.type.startsWith(active === 'video' ? 'video/' : active === 'image' ? 'image/' : 'application/pdf') || acceptedExtensions.some((extension) => file.name.toLowerCase().endsWith(extension)))
    setFiles((current) => (definition.multiple ? [...current, ...incoming.map((file) => ({ id: crypto.randomUUID(), file }))] : incoming.slice(0, 1).map((file) => ({ id: crypto.randomUUID(), file }))))
    setStatus('')
  }

  const run = async () => {
    if (!active || !files.length) return
    setBusy(true); setStatus('处理中…')
    try {
      if (active === 'image') {
        for (const item of files) { const result = await compressImage(item.file, quality / 100, maxEdge); downloadBlob(result.blob, result.name) }
      } else if (active === 'video') {
        const result = await compressVideo(files[0].file, quality / 100); downloadBlob(result.blob, result.name); if (result.converted) setStatus('处理完成 · 当前浏览器以 WebM 输出')
      } else if (active === 'pdf-merge') {
        const merged = await PDFDocument.create()
        for (const item of files) { const source = await PDFDocument.load(await item.file.arrayBuffer()); const pages = await merged.copyPages(source, source.getPageIndices()); pages.forEach((page) => merged.addPage(page)) }
        downloadBlob(pdfBlob(await merged.save({ useObjectStreams: true })), 'disy-merged.pdf')
      } else {
        for (const item of files) { const source = await PDFDocument.load(await item.file.arrayBuffer()); const bytes = await source.save({ useObjectStreams: true, addDefaultPage: false, objectsPerTick: 50 }); const candidate = pdfBlob(bytes); downloadBlob(candidate.size < item.file.size ? candidate : item.file, outputName(item.file.name, 'compressed', 'pdf')) }
      }
      setStatus((current) => current.includes('WebM') ? current : '处理完成，文件已下载')
    } catch (error) { setStatus(error instanceof Error ? error.message : '处理失败，请重试') } finally { setBusy(false) }
  }

  return <AnimatePresence>{open && <motion.div className="toolbox-layer" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={onClose}>
    <motion.aside className="toolbox-panel" role="dialog" aria-modal="true" aria-label="文件工具箱" initial={{ opacity: 0, x: -12, y: 8, scale: .975 }} animate={{ opacity: 1, x: 0, y: 0, scale: 1 }} exit={{ opacity: 0, x: -8, y: 6, scale: .98 }} transition={{ duration: .18 }} onMouseDown={(event) => event.stopPropagation()}>
      <header><div><span><PackageOpen size={17} /></span><div><strong>{active ? definition?.title : '文件工具箱'}</strong><small>{active ? '本地处理 · 文件不会上传' : '轻量处理，随用随走'}</small></div></div><button onClick={onClose} aria-label="关闭工具箱"><X size={16} /></button></header>
      {!active ? <div className="toolbox-grid">{tools.map((tool) => <button key={tool.kind} onClick={() => { setActive(tool.kind); setFiles([]); setStatus('') }}><span><tool.icon size={18} /></span><div><strong>{tool.title}</strong><small>{tool.detail}</small></div><ChevronLeft size={14} /></button>)}</div> : <div className="toolbox-workspace">
        <button className="toolbox-back" onClick={() => { setActive(null); setFiles([]); setStatus('') }}><ChevronLeft size={13} />全部工具</button>
        <input ref={inputRef} hidden type="file" accept={definition?.accept} multiple={definition?.multiple} onChange={(event) => { addFiles(event.target.files); event.currentTarget.value = '' }} />
        <button className="toolbox-dropzone" onClick={() => inputRef.current?.click()} onDragOver={(event) => event.preventDefault()} onDrop={(event) => { event.preventDefault(); addFiles(event.dataTransfer.files) }}><Upload size={20} /><strong>拖入文件，或点击选择</strong><small>{definition?.detail} · {definition?.multiple ? '支持批量' : '单个文件'}</small></button>
        {!!files.length && <div className="toolbox-file-list">{files.map((item, index) => <article key={item.id} draggable={active === 'pdf-merge'} onDragStart={(event) => event.dataTransfer.setData('text/toolbox-file', item.id)} onDragOver={(event) => active === 'pdf-merge' && event.preventDefault()} onDrop={(event) => { const sourceId = event.dataTransfer.getData('text/toolbox-file'); if (!sourceId || sourceId === item.id) return; setFiles((current) => { const next = [...current]; const from = next.findIndex((entry) => entry.id === sourceId); const to = next.findIndex((entry) => entry.id === item.id); if (from < 0 || to < 0) return current; const [moved] = next.splice(from, 1); next.splice(to, 0, moved); return next }) }}><span>{active === 'video' ? <Film size={14} /> : active === 'image' ? <FileImage size={14} /> : <FileArchive size={14} />}</span><div><strong>{item.file.name}</strong><small>{formatBytes(item.file.size)}{active === 'pdf-merge' ? ` · 顺序 ${index + 1}` : ''}</small></div>{active === 'pdf-merge' && <GripVertical size={13} />}<button onClick={() => setFiles((current) => current.filter((file) => file.id !== item.id))}><Trash2 size={13} /></button></article>)}</div>}
        {(active === 'image' || active === 'video') && <section className="toolbox-settings"><label><span>压缩质量 <b>{quality}%</b></span><input type="range" min="30" max="90" value={quality} onChange={(event) => setQuality(Number(event.target.value))} /></label>{active === 'image' && <label><span>最长边</span><select value={maxEdge} onChange={(event) => setMaxEdge(Number(event.target.value))}><option value="1280">1280 px</option><option value="1920">1920 px</option><option value="2560">2560 px</option><option value="4096">4096 px</option></select></label>}</section>}
        {!!files.length && <footer><div><span>{files.length} 个文件 · {formatBytes(totalSize)}</span>{status && <small className={status.includes('完成') ? 'is-success' : ''}>{status.includes('完成') && <Check size={11} />}{status}</small>}</div><button disabled={busy || (active === 'pdf-merge' && files.length < 2)} onClick={() => void run()}>{busy ? <LoaderCircle className="is-spinning" size={14} /> : <Download size={14} />}{busy ? '处理中' : active === 'pdf-merge' ? '合并并下载' : '压缩并下载'}</button></footer>}
      </div>}
    </motion.aside>
  </motion.div>}</AnimatePresence>
}
