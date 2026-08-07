import { createContext, forwardRef, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import {
  ArrowUp,
  ArrowUpRight,
  Bold,
  Box,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Download,
  FileImage,
  Folder,
  FolderPlus,
  Focus,
  Grid3X3,
  History,
  ImagePlus,
  Info,
  Italic,
  KeyRound,
  Library,
  List,
  ListOrdered,
  Lock,
  LoaderCircle,
  Maximize2,
  Minus,
  MessageCircle,
  PanelsTopLeft,
  Plus,
  Pilcrow,
  Search,
  Settings2,
  Sparkles,
  Type,
  Trash2,
  Upload,
  Unlink2,
  Unlock,
  WandSparkles,
  X,
} from 'lucide-react'
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ConnectionLineType,
  Handle,
  MiniMap,
  NodeResizeControl,
  PanOnScrollMode,
  Position,
  ReactFlow,
  addEdge,
  useEdgesState,
  getBezierPath,
  useNodesState,
  useReactFlow,
  useUpdateNodeInternals,
  type Connection,
  type Edge,
  type EdgeProps,
  type Node,
  type NodeProps,
  type OnConnectEnd,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useDisyStore, type ApiConnection, type ApiModelConfig, type ModelCapability } from './store'
import { loadLocalProject, saveLocalProject } from './localDb'
import { fetchRemoteModels, generateRemoteImages, generateRemoteText, normalizeGenerationError, prepareReferenceImageForRequest, type GenerationErrorCategory } from './imageApi'

type NodeKind = 'text' | 'image' | 'upload' | 'group'
type CreatableNodeKind = Exclude<NodeKind, 'group'>
type ImageAspectRatio = 'auto' | '1:1' | '2:1' | '4:3' | '3:4' | '5:4' | '4:5' | '3:2' | '2:3' | '16:9' | '9:16' | '21:9' | '9:21'
type ImageResolution = '1K' | '2K' | '4K'
type ImageDetail = 'low' | 'medium' | 'high'
type ImageReference = {
  id: string
  name: string
  url: string
}
type ImageVariant = {
  id: string
  url: string
  fileName: string
  createdAt: string
  revisedPrompt?: string
}
type CanvasNode = Node<{
  kind: NodeKind
  title: string
  body: string
  promptText?: string
  status?: string
  imageUrl?: string
  fileName?: string
  imageVariants?: ImageVariant[]
  activeImageVariantId?: string
  generationSourceNodeId?: string
  referenceImageUrl?: string
  referenceImageName?: string
  referenceImages?: ImageReference[]
  useCurrentImageAsReference?: boolean
  imageAspectRatio?: ImageAspectRatio
  imageResolution?: ImageResolution
  imageDetail?: ImageDetail
  groupColor?: string
}>

type ActiveImageReference = ImageReference & {
  source: 'current' | 'connection' | 'manual'
  sourceNodeId?: string
  selected: boolean
  mention: string
}

const IMAGE_ASPECT_OPTIONS: Array<{ value: ImageAspectRatio; label: string; width: number; height: number }> = [
  { value: 'auto', label: '自适应', width: 1, height: 1 },
  { value: '1:1', label: '1:1', width: 1, height: 1 },
  { value: '2:1', label: '2:1', width: 2, height: 1 },
  { value: '4:3', label: '4:3', width: 4, height: 3 },
  { value: '3:4', label: '3:4', width: 3, height: 4 },
  { value: '5:4', label: '5:4', width: 5, height: 4 },
  { value: '4:5', label: '4:5', width: 4, height: 5 },
  { value: '3:2', label: '3:2', width: 3, height: 2 },
  { value: '2:3', label: '2:3', width: 2, height: 3 },
  { value: '16:9', label: '16:9', width: 16, height: 9 },
  { value: '9:16', label: '9:16', width: 9, height: 16 },
  { value: '21:9', label: '21:9', width: 21, height: 9 },
  { value: '9:21', label: '9:21', width: 9, height: 21 },
]

const IMAGE_DETAIL_LABELS: Record<ImageDetail, string> = { low: '低画质', medium: '标准画质', high: '高画质' }

function getImageGenerationNodeSize(aspectRatio: ImageAspectRatio = '1:1') {
  const option = IMAGE_ASPECT_OPTIONS.find((item) => item.value === aspectRatio) ?? IMAGE_ASPECT_OPTIONS[1]
  const ratio = option.width / option.height
  const baseArea = 260 * 260
  let contentWidth = Math.sqrt(baseArea * ratio)
  let contentHeight = contentWidth / ratio
  const minimumEdge = Math.min(contentWidth, contentHeight)
  if (minimumEdge < 180) {
    const scale = 180 / minimumEdge
    contentWidth *= scale
    contentHeight *= scale
  }
  const maximumEdge = Math.max(contentWidth, contentHeight)
  if (maximumEdge > 420) {
    const scale = 420 / maximumEdge
    contentWidth *= scale
    contentHeight *= scale
  }
  return {
    width: Math.round(contentWidth),
    height: Math.round(contentHeight + 92),
  }
}

const NodeTextUpdateContext = createContext<(nodeId: string, body: string) => void>(() => undefined)
const ImageGalleryOpenContext = createContext<(nodeId: string) => void>(() => undefined)
const ImagePreviewOpenContext = createContext<(nodeId: string) => void>(() => undefined)

type NodeMenuState = {
  x: number
  y: number
  flowX: number
  flowY: number
  connectionSourceId?: string
}

type NodeContextMenuState = {
  x: number
  y: number
  nodeId: string
}

type SavedAsset = {
  id: string
  savedAt: string
  type?: 'node' | 'group'
  title?: string
  data?: CanvasNode['data']
  style?: CanvasNode['style']
  nodes?: CanvasNode[]
  edges?: Edge[]
  folderId?: string | null
}

type AssetFolder = {
  id: string
  name: string
  preset?: boolean
}

type GenerationRecord = {
  id: string
  createdAt: string
  prompt: string
  model: string
  imageUrl: string
  fileName: string
}

type LibraryPreview = {
  kind: 'asset' | 'history'
  id: string
}

type DeleteConfirm =
  | { kind: 'asset' | 'history'; id: string; label: string }
  | { kind: 'assets' | 'history-batch'; ids: string[]; label: string }

type OutputHistoryRecord = {
  id: string
  createdAt: string
  kind: 'text' | 'image'
  status: 'success' | 'failed'
  prompt: string
  modelId: string
  modelName: string
  connectionName: string
  requestedCount: number
  outputCount: number
  preview?: string
  error?: {
    category: GenerationErrorCategory
    summary: string
    detail: string
    status?: number
    requestId?: string
  }
}

const ASSET_FOLDERS_KEY = 'disy-asset-folders'
const GENERATION_HISTORY_KEY = 'disy-generation-history'
const OUTPUT_HISTORY_KEY = 'disy-output-history-v1'
const OUTPUT_HISTORY_RETENTION_MS = 24 * 60 * 60 * 1000
const DEFAULT_ASSET_FOLDERS: AssetFolder[] = [
  { id: 'people', name: '人物', preset: true },
  { id: 'scenes', name: '场景', preset: true },
  { id: 'styles', name: '风格', preset: true },
]
const MODEL_CAPABILITY_LABELS: Record<ModelCapability, string> = {
  text: '文本',
  image: '图像',
  video: '视频',
  audio: '音频',
}

function readSavedAssets() {
  try {
    const assets = JSON.parse(localStorage.getItem('disy-saved-assets') ?? '[]') as SavedAsset[]
    return Array.isArray(assets) ? assets : []
  } catch {
    return []
  }
}

function readAssetFolders() {
  try {
    const folders = JSON.parse(localStorage.getItem(ASSET_FOLDERS_KEY) ?? '[]') as AssetFolder[]
    if (Array.isArray(folders) && folders.length) return folders
  } catch {
    // Use defaults when local data is unavailable.
  }
  return DEFAULT_ASSET_FOLDERS
}

function readGenerationHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(GENERATION_HISTORY_KEY) ?? '[]') as GenerationRecord[]
    return Array.isArray(history) ? history : []
  } catch {
    return []
  }
}

function pruneOutputHistory(history: OutputHistoryRecord[], now = Date.now()) {
  const cutoff = now - OUTPUT_HISTORY_RETENTION_MS
  return history.filter((record) => {
    const createdAt = Date.parse(record.createdAt)
    return Number.isFinite(createdAt) && createdAt > cutoff
  })
}

function readOutputHistory() {
  try {
    const history = JSON.parse(localStorage.getItem(OUTPUT_HISTORY_KEY) ?? '[]') as OutputHistoryRecord[]
    return Array.isArray(history) ? pruneOutputHistory(history) : []
  } catch {
    return []
  }
}

type NodeClipboard = {
  data: CanvasNode['data']
  style?: CanvasNode['style']
}

type SelectionToolbarRect = {
  left: number
  top: number
}

type WritableFileHandle = {
  createWritable: () => Promise<{
    write: (data: Blob) => Promise<void>
    close: () => Promise<void>
  }>
}

type FilePickerWindow = Window & {
  showSaveFilePicker?: (options: {
    suggestedName: string
    types?: Array<{ description: string; accept: Record<string, string[]> }>
  }) => Promise<WritableFileHandle>
  showDirectoryPicker?: () => Promise<{
    getFileHandle: (name: string, options: { create: boolean }) => Promise<WritableFileHandle>
  }>
}

function getNodeDisplayTitle(data: CanvasNode['data']) {
  if (data.kind === 'text') return '文本'
  if (data.kind === 'image') return '图像'
  if (data.kind === 'group') return '分组'
  return data.title
}

function getReferenceLabel(name: string, fallbackIndex: number) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  return (normalized || `参考图片 ${fallbackIndex + 1}`).slice(0, 36)
}

function getReferenceMention(label: string) {
  return `@[${label}]`
}

type AtomicPromptEditorHandle = {
  focusAt: (offset: number) => void
}

type AtomicPromptEditorProps = {
  value: string
  references: ActiveImageReference[]
  onChange: (value: string, cursor: number) => void
  onRemoveToken: (start: number, end: number) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
}

function serializeAtomicPrompt(root: globalThis.Node): string {
  if (root.nodeType === globalThis.Node.TEXT_NODE) return root.textContent ?? ''
  if (!(root instanceof HTMLElement) && !(root instanceof DocumentFragment)) return ''
  if (root instanceof HTMLElement) {
    const mention = root.dataset.atomicMention
    if (mention) return mention
    if (root.tagName === 'BR') return '\n'
  }
  const content = Array.from(root.childNodes).map(serializeAtomicPrompt).join('')
  if (root instanceof HTMLElement && (root.tagName === 'DIV' || root.tagName === 'P')) return `${content}\n`
  return content
}

function serializeAtomicPromptRoot(root: globalThis.Node): string {
  return Array.from(root.childNodes).map(serializeAtomicPrompt).join('')
}

function readAtomicPrompt(root: globalThis.Node): string {
  const value = serializeAtomicPromptRoot(root).replace(/\n$/, '')
  return /^\n*$/.test(value) ? '' : value
}

function getAtomicPromptCaret(root: HTMLElement) {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return serializeAtomicPromptRoot(root).length
  const range = selection.getRangeAt(0)
  if (!root.contains(range.endContainer)) return serializeAtomicPromptRoot(root).length
  const prefix = range.cloneRange()
  prefix.selectNodeContents(root)
  prefix.setEnd(range.endContainer, range.endOffset)
  const holder = document.createElement('div')
  holder.append(prefix.cloneContents())
  return serializeAtomicPromptRoot(holder).length
}

function setAtomicPromptCaret(root: HTMLElement, requestedOffset: number) {
  const selection = window.getSelection()
  if (!selection) return
  const range = document.createRange()
  let remaining = Math.max(0, requestedOffset)
  let placed = false
  const visit = (node: globalThis.Node) => {
    if (placed) return
    const length = serializeAtomicPrompt(node).length
    if (node.nodeType === globalThis.Node.TEXT_NODE) {
      if (remaining <= length) {
        range.setStart(node, Math.min(remaining, node.textContent?.length ?? 0))
        placed = true
      } else remaining -= length
      return
    }
    if (node instanceof HTMLElement && node.dataset.atomicMention) {
      if (remaining === 0) {
        range.setStartBefore(node)
        placed = true
      } else if (remaining <= length) {
        range.setStartAfter(node)
        placed = true
      } else remaining -= length
      return
    }
    if (node instanceof HTMLElement && node.tagName === 'BR') {
      if (remaining <= 1) {
        range.setStartAfter(node)
        placed = true
      } else remaining -= 1
      return
    }
    Array.from(node.childNodes).forEach(visit)
  }
  Array.from(root.childNodes).forEach(visit)
  if (!placed) {
    range.selectNodeContents(root)
    range.collapse(false)
  } else range.collapse(true)
  selection.removeAllRanges()
  selection.addRange(range)
}

function atomicDeleteTouchesToken(root: HTMLElement, direction: 'backward' | 'forward') {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return false
  const range = selection.getRangeAt(0)
  const tokens = Array.from(root.querySelectorAll<HTMLElement>('[data-atomic-mention]'))
  if (!range.collapsed) return tokens.some((token) => range.intersectsNode(token))
  const caret = getAtomicPromptCaret(root)
  return tokens.some((token) => {
    const prefix = document.createRange()
    prefix.selectNodeContents(root)
    prefix.setEndBefore(token)
    const holder = document.createElement('div')
    holder.append(prefix.cloneContents())
    const start = serializeAtomicPromptRoot(holder).length
    const end = start + (token.dataset.atomicMention?.length ?? 0)
    return direction === 'backward'
      ? caret > start && caret <= end
      : caret >= start && caret < end
  })
}

const AtomicPromptEditor = forwardRef<AtomicPromptEditorHandle, AtomicPromptEditorProps>(function AtomicPromptEditor({
  value,
  references,
  onChange,
  onRemoveToken,
  onKeyDown,
}, forwardedRef) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lastEmittedValueRef = useRef(value)
  const composingRef = useRef(false)
  const referenceSignature = references.map((reference) => `${reference.id}:${reference.mention}:${reference.url}`).join('|')

  const renderValue = useCallback(() => {
    const root = rootRef.current
    if (!root) return
    const referenceByMention = new Map(references.map((reference) => [reference.mention, reference]))
    const mentions = [...referenceByMention.keys()].sort((a, b) => b.length - a.length)
    const pattern = mentions.length
      ? new RegExp(`(${mentions.map((mention) => mention.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'g')
      : null
    const parts = pattern ? value.split(pattern) : [value]
    const fragment = document.createDocumentFragment()
    let sourceOffset = 0
    parts.forEach((part) => {
      const reference = referenceByMention.get(part)
      if (!reference) {
        fragment.append(document.createTextNode(part))
        sourceOffset += part.length
        return
      }
      const token = document.createElement('span')
      token.className = 'inline-image-reference atomic-image-reference'
      token.contentEditable = 'false'
      token.dataset.atomicMention = reference.mention
      const image = document.createElement('img')
      image.src = reference.url
      image.alt = ''
      const label = document.createElement('span')
      label.textContent = reference.name
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'atomic-reference-remove'
      remove.tabIndex = -1
      remove.textContent = '×'
      remove.dataset.removeTokenStart = String(sourceOffset)
      remove.dataset.removeTokenEnd = String(sourceOffset + reference.mention.length)
      remove.setAttribute('aria-label', `移除引用 ${reference.name}`)
      token.append(image, label, remove)
      fragment.append(token)
      sourceOffset += reference.mention.length
    })
    root.replaceChildren(fragment)
    lastEmittedValueRef.current = value
  }, [referenceSignature, value])

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    if (composingRef.current) return
    if (document.activeElement === root && lastEmittedValueRef.current === value) return
    const wasFocused = document.activeElement === root
    const caret = wasFocused ? getAtomicPromptCaret(root) : 0
    renderValue()
    if (wasFocused) setAtomicPromptCaret(root, Math.min(caret, value.length))
  }, [renderValue, value])

  useImperativeHandle(forwardedRef, () => ({
    focusAt(offset) {
      const root = rootRef.current
      if (!root) return
      root.focus()
      setAtomicPromptCaret(root, offset)
    },
  }), [])

  return (
    <div
      ref={rootRef}
      className="atomic-prompt-editor"
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label="图像提示词"
      data-placeholder="描述任何你想生成的图像，按 @ 引用参考图"
      onCompositionStart={() => {
        composingRef.current = true
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false
        const nextValue = readAtomicPrompt(event.currentTarget)
        const cursor = getAtomicPromptCaret(event.currentTarget)
        lastEmittedValueRef.current = nextValue
        onChange(nextValue, cursor)
      }}
      onBeforeInput={(event) => {
        if (event.nativeEvent.isComposing || composingRef.current) return
        const inputType = event.nativeEvent.inputType
        if (/^delete.*Backward$/.test(inputType) && atomicDeleteTouchesToken(event.currentTarget, 'backward')) event.preventDefault()
        if (/^delete.*Forward$/.test(inputType) && atomicDeleteTouchesToken(event.currentTarget, 'forward')) event.preventDefault()
        if (inputType === 'deleteByCut' && atomicDeleteTouchesToken(event.currentTarget, 'backward')) event.preventDefault()
      }}
      onInput={(event) => {
        if (event.nativeEvent.isComposing || composingRef.current) return
        const nextValue = readAtomicPrompt(event.currentTarget)
        const cursor = getAtomicPromptCaret(event.currentTarget)
        lastEmittedValueRef.current = nextValue
        onChange(nextValue, cursor)
      }}
      onClick={(event) => {
        const removeButton = (event.target as HTMLElement).closest<HTMLButtonElement>('[data-remove-token-start]')
        if (!removeButton) return
        event.preventDefault()
        event.stopPropagation()
        const token = removeButton.closest<HTMLElement>('[data-atomic-mention]')
        const root = rootRef.current
        if (!token || !root) return
        const prefix = document.createRange()
        prefix.selectNodeContents(root)
        prefix.setEndBefore(token)
        const holder = document.createElement('div')
        holder.append(prefix.cloneContents())
        const start = serializeAtomicPromptRoot(holder).length
        onRemoveToken(start, start + (token.dataset.atomicMention?.length ?? 0))
      }}
      onKeyDown={(event) => {
        if (event.nativeEvent.isComposing || composingRef.current) return
        if (event.key === 'Backspace' && atomicDeleteTouchesToken(event.currentTarget, 'backward')) {
          event.preventDefault()
          return
        }
        if (event.key === 'Delete' && atomicDeleteTouchesToken(event.currentTarget, 'forward')) {
          event.preventDefault()
          return
        }
        onKeyDown(event)
      }}
    />
  )
})

function renderInlineMarkdown(text: string) {
  const parts: React.ReactNode[] = []
  const pattern = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\n]+\*|_[^_\n]+_)/g
  let cursor = 0
  let match: RegExpExecArray | null

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > cursor) parts.push(text.slice(cursor, match.index))
    const token = match[0]
    if (token.startsWith('**') || token.startsWith('__')) {
      parts.push(<strong key={`${match.index}-strong`}>{token.slice(2, -2)}</strong>)
    } else {
      parts.push(<em key={`${match.index}-em`}>{token.slice(1, -1)}</em>)
    }
    cursor = match.index + token.length
  }
  if (cursor < text.length) parts.push(text.slice(cursor))
  return parts
}

function MarkdownPreview({ content }: { content: string }) {
  const lines = content.split('\n')
  const blocks: React.ReactNode[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index]
    const heading = line.match(/^(#{1,3})\s+(.+)$/)

    if (!line.trim()) {
      blocks.push(<span className="markdown-empty-line" key={`empty-${index}`} />)
      index += 1
      continue
    }
    if (/^\s*(?:---+|___+|\*\*\*+)\s*$/.test(line)) {
      blocks.push(<hr key={`divider-${index}`} />)
      index += 1
      continue
    }
    if (heading) {
      const level = heading[1].length
      const HeadingTag = `h${level}` as 'h1' | 'h2' | 'h3'
      blocks.push(<HeadingTag key={`heading-${index}`}>{renderInlineMarkdown(heading[2])}</HeadingTag>)
      index += 1
      continue
    }
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: React.ReactNode[] = []
      while (index < lines.length && /^\s*[-*+]\s+/.test(lines[index])) {
        items.push(<li key={`bullet-${index}`}>{renderInlineMarkdown(lines[index].replace(/^\s*[-*+]\s+/, ''))}</li>)
        index += 1
      }
      blocks.push(<ul key={`ul-${index}`}>{items}</ul>)
      continue
    }
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: React.ReactNode[] = []
      while (index < lines.length && /^\s*\d+\.\s+/.test(lines[index])) {
        items.push(<li key={`ordered-${index}`}>{renderInlineMarkdown(lines[index].replace(/^\s*\d+\.\s+/, ''))}</li>)
        index += 1
      }
      blocks.push(<ol key={`ol-${index}`}>{items}</ol>)
      continue
    }

    blocks.push(<div className="markdown-line" key={`line-${index}`}>{renderInlineMarkdown(line)}</div>)
    index += 1
  }

  return <>{blocks}</>
}

function buildCanvasSignature(
  nodes: CanvasNode[],
  edges: Edge[],
  name: string,
  styleReferenceName: string,
  styleReferenceUrl: string,
  styleReferenceEnabled: boolean,
  promptSuffix: string,
  settingsLocked: boolean,
) {
  return JSON.stringify({
    name,
    styleReferenceName,
    styleReferenceUrl: styleReferenceUrl
      ? `${styleReferenceUrl.length}:${styleReferenceUrl.slice(0, 36)}`
      : '',
    styleReferenceEnabled,
    promptSuffix,
    settingsLocked,
    nodes: nodes.map((node) => ({
      id: node.id,
      position: node.position,
      style: node.style,
      measured: node.measured,
      data: {
        ...node.data,
        imageUrl: node.data.imageUrl
          ? `${node.data.imageUrl.length}:${node.data.imageUrl.slice(0, 36)}`
          : undefined,
        imageVariants: node.data.imageVariants?.map((variant) => ({
          ...variant,
          url: `${variant.url.length}:${variant.url.slice(0, 36)}`,
        })),
        referenceImageUrl: node.data.referenceImageUrl
          ? `${node.data.referenceImageUrl.length}:${node.data.referenceImageUrl.slice(0, 36)}`
          : undefined,
        referenceImages: node.data.referenceImages?.map((reference) => ({
          id: reference.id,
          name: reference.name,
          url: `${reference.url.length}:${reference.url.slice(0, 36)}`,
        })),
      },
    })),
    edges: edges.map((edge) => ({
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
    })),
  })
}

type MarkdownAction = 'h1' | 'h2' | 'h3' | 'paragraph' | 'bold' | 'italic' | 'bullet' | 'ordered' | 'divider'

function MarkdownToolbar({
  onFormat,
  onExpand,
}: {
  onFormat: (action: MarkdownAction) => void
  onExpand?: () => void
}) {
  const formatButton = (action: MarkdownAction, label: string, content: React.ReactNode) => (
    <button
      type="button"
      aria-label={label}
      title={label}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => onFormat(action)}
    >
      {content}
    </button>
  )

  return (
    <div className="markdown-toolbar" role="toolbar" aria-label="Markdown 文本格式">
      <span className="toolbar-color-dot" />
      <span className="toolbar-divider" />
      {formatButton('h1', '一级标题', <span className="heading-tool">H1</span>)}
      {formatButton('h2', '二级标题', <span className="heading-tool">H2</span>)}
      {formatButton('h3', '三级标题', <span className="heading-tool">H3</span>)}
      {formatButton('paragraph', '正文', <Pilcrow size={15} />)}
      <span className="toolbar-divider" />
      {formatButton('bold', '粗体', <Bold size={14} />)}
      {formatButton('italic', '斜体', <Italic size={14} />)}
      <span className="toolbar-divider" />
      {formatButton('bullet', '无序列表', <List size={15} />)}
      {formatButton('ordered', '有序列表', <ListOrdered size={15} />)}
      {formatButton('divider', '分隔线', <Minus size={15} />)}
      {onExpand && (
        <>
          <span className="toolbar-divider" />
          <button type="button" aria-label="放大编辑" title="放大编辑" onClick={onExpand}>
            <Maximize2 size={15} />
          </button>
        </>
      )}
    </div>
  )
}

function LuminousEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  style,
}: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    curvature: 0.36,
  })
  const gradientId = `edge-gradient-${id.replace(/[^a-zA-Z0-9_-]/g, '-')}`

  return (
    <>
      <defs>
        <linearGradient
          id={gradientId}
          gradientUnits="userSpaceOnUse"
          x1={sourceX}
          y1={sourceY}
          x2={targetX}
          y2={targetY}
        >
          <stop offset="0%" stopColor="var(--edge-start)" />
          <stop offset="52%" stopColor="var(--edge-middle)" />
          <stop offset="100%" stopColor="var(--edge-end)" />
        </linearGradient>
      </defs>
      <path
        d={path}
        className="luminous-edge-glow"
        stroke={`url(#${gradientId})`}
        vectorEffect="non-scaling-stroke"
      />
      <BaseEdge
        id={id}
        path={path}
        className="luminous-edge-core"
        interactionWidth={22}
        style={{ ...style, stroke: `url(#${gradientId})` }}
      />
      <path
        d={path}
        className="luminous-edge-flow"
        vectorEffect="non-scaling-stroke"
      />
    </>
  )
}

const edgeTypes = { luminous: LuminousEdge }
const CURRENT_PROJECT_ID = 'default-project'

const initialNodes: CanvasNode[] = []
const initialEdges: Edge[] = []

function NodeCard({
  id,
  data,
  selected,
  width,
  height,
}: {
  id: string
  data: CanvasNode['data']
  selected?: boolean
  width?: number
  height?: number
}) {
  const Icon = data.kind === 'text' ? Type : data.kind === 'upload' ? Upload : WandSparkles
  const updateNodeText = useContext(NodeTextUpdateContext)
  const openImageGallery = useContext(ImageGalleryOpenContext)
  const openImagePreview = useContext(ImagePreviewOpenContext)
  const [inlineEditing, setInlineEditing] = useState(false)
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (!inlineEditing) return
    const textarea = inlineTextareaRef.current
    textarea?.focus()
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [inlineEditing])

  if (data.kind === 'group') {
    return (
      <div
        className={`canvas-group-node ${selected ? 'is-selected' : ''}`}
        style={{ background: data.groupColor || 'rgba(72, 76, 73, .2)' }}
      >
        <span><Box size={13} />{data.title || '分组'}</span>
      </div>
    )
  }

  const nodeHandles = (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="handle handle-target node-extension"
        title="连接到节点"
      >
        <span className="extension-button extension-button-left" aria-hidden="true">
          <Plus size={18} strokeWidth={1.8} />
        </span>
      </Handle>
      <Handle
        type="source"
        position={Position.Right}
        className="handle handle-source node-extension"
        title="延伸节点"
      >
        <span className="extension-button" aria-hidden="true">
          <Plus size={18} strokeWidth={1.8} />
        </span>
      </Handle>
    </>
  )

  if (data.kind === 'upload' && data.imageUrl) {
    const variantCount = data.imageVariants?.length ?? 0
    return (
      <div className={`disy-node asset-image-node ${selected ? 'is-selected' : ''}`}>
        <div className="asset-image-label" title={data.fileName}>
          <FileImage size={13} strokeWidth={1.8} />
          <span>{data.fileName || data.title}</span>
        </div>
        <div className="asset-image-frame">
          <img
            src={data.imageUrl}
            alt={data.fileName || '上传的参考图'}
            draggable={false}
            onDoubleClick={(event) => {
              event.stopPropagation()
              openImagePreview(id)
            }}
          />
          {variantCount > 1 && (
            <button
              type="button"
              className="image-variant-badge nodrag nowheel"
              aria-label={`查看并选择 ${variantCount} 张图片`}
              title="查看批量结果"
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                openImageGallery(id)
              }}
            >
              <span>{variantCount}</span>
              <Grid3X3 size={11} />
            </button>
          )}
        </div>
        {nodeHandles}
      </div>
    )
  }

  return (
    <div
      className={`disy-node ${data.kind === 'text' ? 'resizable-text-node' : ''} ${data.kind === 'image' ? 'image-generation-node' : ''} ${data.kind === 'image' && data.status === '生成中' ? 'is-generating' : ''} ${selected ? 'is-selected' : ''}`}
      style={data.kind === 'text'
        ? { width: width || 275, height: height || 126 }
        : data.kind === 'image'
          ? { width: '100%', height: '100%' }
          : undefined}
    >
      {data.kind === 'text' && selected && (
        <NodeResizeControl
          position="bottom-right"
          minWidth={240}
          minHeight={126}
          maxWidth={920}
          maxHeight={680}
          className="text-node-resize-control"
        >
          <span className="resize-corner-glyph" />
        </NodeResizeControl>
      )}
      <div className="node-heading">
        <span className={`node-icon node-icon-${data.kind}`}>
          <Icon size={15} strokeWidth={2.2} />
        </span>
        <span>{getNodeDisplayTitle(data)}</span>
      </div>

      {data.kind === 'upload' ? (
        <div className="upload-placeholder">
          <ImagePlus size={20} />
          <span>{data.body}</span>
        </div>
      ) : data.kind === 'image' ? (
        <div className={`image-placeholder ${data.imageUrl || data.referenceImageUrl ? 'has-reference' : ''}`}>
          {data.imageUrl || data.referenceImageUrl ? (
            <>
              <img
                src={data.imageUrl || data.referenceImageUrl}
                alt={data.fileName || data.referenceImageName || '图像节点图片'}
                draggable={false}
                onDoubleClick={(event) => {
                  event.stopPropagation()
                  if (data.imageUrl) openImagePreview(id)
                }}
              />
              {(data.imageVariants?.length ?? 0) > 1 && (
                <button
                  type="button"
                  className="image-variant-badge image-generation-variant-badge nodrag nowheel"
                  aria-label={`查看并选择 ${data.imageVariants?.length ?? 0} 张图片`}
                  title="查看批量结果"
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={(event) => {
                    event.stopPropagation()
                    openImageGallery(id)
                  }}
                >
                  <span>{data.imageVariants?.length ?? 0}</span>
                  <Grid3X3 size={11} />
                </button>
              )}
            </>
          ) : (
            data.status === '生成中'
              ? <LoaderCircle className="image-node-generation-icon is-spinning" size={24} aria-label="正在生成图片" />
              : <Sparkles className="image-node-generation-icon" size={22} aria-label="等待生成图片" />
          )}
        </div>
      ) : (
        inlineEditing ? (
          <textarea
            ref={inlineTextareaRef}
            className="inline-node-textarea nodrag nowheel"
            value={data.body}
            maxLength={2000}
            placeholder="写下你的灵感…"
            aria-label="编辑文本节点内容"
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onChange={(event) => updateNodeText(id, event.target.value)}
            onBlur={() => setInlineEditing(false)}
            onKeyDown={(event) => {
              event.stopPropagation()
              if (event.key === 'Escape' || (event.key === 'Enter' && (event.ctrlKey || event.metaKey))) {
                event.preventDefault()
                setInlineEditing(false)
              }
            }}
          />
        ) : (
          <div
            className={`node-body nowheel ${data.body ? '' : 'is-empty'}`}
            title="双击编辑文字"
            onWheel={(event) => event.stopPropagation()}
            onDoubleClick={(event) => {
              event.stopPropagation()
              setInlineEditing(true)
            }}
          >
            {data.body ? <MarkdownPreview content={data.body} /> : '双击开始编辑…'}
          </div>
        )
      )}

      {data.status && (
        <div className="node-status">
          <span className="status-dot" />
          {data.status}
        </div>
      )}

      {nodeHandles}
    </div>
  )
}

const nodeTypes = {
  disy: ({ id, data, selected, width, height }: NodeProps<CanvasNode>) => (
    <NodeCard id={id} data={data} selected={selected} width={width} height={height} />
  ),
}

function App() {
  const {
    apiConfigured,
    apiSettings,
    clearApiSettings,
    saveApiSettings,
  } = useDisyStore()

  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState | null>(null)
  const [nodeContextMenu, setNodeContextMenu] = useState<NodeContextMenuState | null>(null)
  const [nodeClipboard, setNodeClipboard] = useState<NodeClipboard | null>(null)
  const [savedAssets, setSavedAssets] = useState<SavedAsset[]>(readSavedAssets)
  const [assetFolders, setAssetFolders] = useState<AssetFolder[]>(readAssetFolders)
  const [activeAssetFolderId, setActiveAssetFolderId] = useState<'all' | 'unfiled' | string>('all')
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false)
  const [assetSearch, setAssetSearch] = useState('')
  const [assetScope, setAssetScope] = useState<'all' | 'current'>('all')
  const [assetThumbnailSize, setAssetThumbnailSize] = useState(132)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([])
  const [libraryPreview, setLibraryPreview] = useState<LibraryPreview | null>(null)
  const [libraryPreviewDirection, setLibraryPreviewDirection] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null)
  const [generationHistory, setGenerationHistory] = useState<GenerationRecord[]>(readGenerationHistory)
  const [generationHistoryOpen, setGenerationHistoryOpen] = useState(false)
  const [generationHistorySearch, setGenerationHistorySearch] = useState('')
  const [historyThumbnailSize, setHistoryThumbnailSize] = useState(132)
  const [outputHistory, setOutputHistory] = useState<OutputHistoryRecord[]>(readOutputHistory)
  const [outputHistoryOpen, setOutputHistoryOpen] = useState(false)
  const [outputHistoryFilter, setOutputHistoryFilter] = useState<'all' | 'text' | 'image' | 'failed'>('all')
  const [outputHistorySearch, setOutputHistorySearch] = useState('')
  const [expandedOutputErrorId, setExpandedOutputErrorId] = useState<string | null>(null)
  const [modelsLoading, setModelsLoading] = useState(false)
  const [modelsError, setModelsError] = useState('')
  const [modelMenuOpen, setModelMenuOpen] = useState(false)
  const [imageModelMenuOpen, setImageModelMenuOpen] = useState(false)
  const [imageParameterMenuOpen, setImageParameterMenuOpen] = useState(false)
  const [imageMentionOpen, setImageMentionOpen] = useState(false)
  const [imageMentionQuery, setImageMentionQuery] = useState('')
  const [imageMentionIndex, setImageMentionIndex] = useState(0)
  const [imageMentionRange, setImageMentionRange] = useState<{ start: number; end: number } | null>(null)
  const [canvasReferencePickerNodeId, setCanvasReferencePickerNodeId] = useState<string | null>(null)
  const [generationLoading, setGenerationLoading] = useState(false)
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [showGrid, setShowGrid] = useState(true)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [activeEditorNodeId, setActiveEditorNodeId] = useState<string | null>(null)
  const [activeImageNodeId, setActiveImageNodeId] = useState<string | null>(null)
  const [activeGenerationNodeId, setActiveGenerationNodeId] = useState<string | null>(null)
  const [previewImageNodeId, setPreviewImageNodeId] = useState<string | null>(null)
  const [previewImageIndex, setPreviewImageIndex] = useState(0)
  const [previewImageDirection, setPreviewImageDirection] = useState(1)
  const [imageGalleryNodeId, setImageGalleryNodeId] = useState<string | null>(null)
  const [expandedEditorNodeId, setExpandedEditorNodeId] = useState<string | null>(null)
  const [generationCount, setGenerationCount] = useState(1)
  const [quantityMenuOpen, setQuantityMenuOpen] = useState(false)
  const [isNodeDragging, setIsNodeDragging] = useState(false)
  const [nodeOverlayRect, setNodeOverlayRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectionToolbarRect, setSelectionToolbarRect] = useState<SelectionToolbarRect | null>(null)
  const [marqueeSelectionCommitted, setMarqueeSelectionCommitted] = useState(false)
  const [groupColorMenuOpen, setGroupColorMenuOpen] = useState(false)
  const [apiOpen, setApiOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [projectSearch, setProjectSearch] = useState('')
  const [canvasName, setCanvasName] = useState('Disy Infinite')
  const [canvasNameDraft, setCanvasNameDraft] = useState('Disy Infinite')
  const [canvasNameEditing, setCanvasNameEditing] = useState(false)
  const [canvasSaved, setCanvasSaved] = useState(true)
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false)
  const [projectSettingsLocked, setProjectSettingsLocked] = useState(false)
  const [styleReferenceName, setStyleReferenceName] = useState('')
  const [styleReferenceUrl, setStyleReferenceUrl] = useState('')
  const [styleReferenceEnabled, setStyleReferenceEnabled] = useState(true)
  const [projectPromptSuffix, setProjectPromptSuffix] = useState('')
  const [editingConnectionId, setEditingConnectionId] = useState<string>(apiSettings.connections[0]?.id ?? 'new')
  const [apiDraft, setApiDraft] = useState({ name: '', baseUrl: '', apiKey: '' })
  const [draftModels, setDraftModels] = useState<ApiModelConfig[]>([])
  const [apiModelTab, setApiModelTab] = useState<ModelCapability>('text')
  const [apiError, setApiError] = useState('')

  const shellRef = useRef<HTMLDivElement>(null)
  const firstApiInputRef = useRef<HTMLInputElement>(null)
  const apiButtonRef = useRef<HTMLButtonElement>(null)
  const canvasNameInputRef = useRef<HTMLInputElement>(null)
  const styleReferenceInputRef = useRef<HTMLInputElement>(null)
  const savedCanvasSignatureRef = useRef<string | null>(null)
  const canvasSavedRef = useRef(true)
  const autoSaveActionRef = useRef<() => void>(() => undefined)
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null)
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null)
  const imagePromptEditorRef = useRef<AtomicPromptEditorHandle>(null)
  const overlayMeasureFrameRef = useRef<number | null>(null)
  const overlayMeasureTargetRef = useRef<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const generationReferenceInputRef = useRef<HTMLInputElement>(null)
  const generationReferenceNodeIdRef = useRef<string | null>(null)
  const assetUploadInputRef = useRef<HTMLInputElement>(null)
  const uploadPositionRef = useRef<{ x: number; y: number } | null>(null)
  const pasteSequenceRef = useRef(0)
  const modelFetchRequestRef = useRef(0)
  const generationRequestLockRef = useRef(false)
  const aspectTweenRef = useRef<{ kill: () => void } | null>(null)
  const galleryWheelLockRef = useRef(false)
  const previewWheelLockRef = useRef(false)
  const latestSelectedNodeIdsRef = useRef<string[]>([])
  const { fitView: fitCanvas, screenToFlowPosition, zoomTo } = useReactFlow()
  const updateNodeInternals = useUpdateNodeInternals()
  const reduceMotion = useReducedMotion()

  canvasSavedRef.current = canvasSaved

  useEffect(() => {
    if (reduceMotion || !shellRef.current) return

    let animationContext: { revert: () => void } | undefined
    let disposed = false

    void import('gsap').then(({ default: gsap }) => {
      if (disposed || !shellRef.current) return
      animationContext = gsap.context(() => {
        gsap.from('.floating-chrome', {
          y: -8,
          autoAlpha: 0,
          duration: 0.42,
          stagger: 0.05,
          ease: 'power2.out',
        })
        gsap.from('.tool-rail', {
          x: -10,
          autoAlpha: 0,
          duration: 0.46,
          ease: 'power2.out',
        })
      }, shellRef)
    })

    return () => {
      disposed = true
      animationContext?.revert()
    }
  }, [reduceMotion])

  useEffect(() => {
    if (!apiOpen) return

    const directConnection = apiSettings.connections.find((item) => item.id === editingConnectionId)
    const connection = directConnection ?? (editingConnectionId === 'new' ? undefined : apiSettings.connections[0])
    if (!directConnection && connection && connection.id !== editingConnectionId) {
      setEditingConnectionId(connection.id)
      return
    }
    if (connection) {
      setApiDraft({ name: connection.name, baseUrl: connection.baseUrl, apiKey: connection.apiKey })
      setDraftModels(connection.models)
    } else {
      setApiDraft({ name: '', baseUrl: '', apiKey: '' })
      setDraftModels([])
    }
    setApiError('')
    const focusTimer = window.setTimeout(() => firstApiInputRef.current?.focus(), 40)
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setApiOpen(false)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.clearTimeout(focusTimer)
      window.removeEventListener('keydown', onKeyDown)
      apiButtonRef.current?.focus()
    }
  }, [apiOpen, apiSettings.connections, editingConnectionId])

  useEffect(() => {
    if (!projectOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProjectOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [projectOpen])

  useEffect(() => {
    if (!assetLibraryOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !libraryPreview) setAssetLibraryOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [assetLibraryOpen, libraryPreview])

  useEffect(() => {
    if (!generationHistoryOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !libraryPreview) setGenerationHistoryOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [generationHistoryOpen, libraryPreview])

  useEffect(() => {
    if (!outputHistoryOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOutputHistoryOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [outputHistoryOpen])

  useEffect(() => {
    try {
      if (outputHistory.length) localStorage.setItem(OUTPUT_HISTORY_KEY, JSON.stringify(outputHistory))
      else localStorage.removeItem(OUTPUT_HISTORY_KEY)
    } catch {
      // Output history remains available for the current session when storage is unavailable.
    }
  }, [outputHistory])

  useEffect(() => {
    const pruneExpiredOutputHistory = () => {
      setOutputHistory((current) => {
        const retained = pruneOutputHistory(current)
        return retained.length === current.length ? current : retained
      })
    }
    const expirations = outputHistory
      .map((record) => Date.parse(record.createdAt))
      .filter(Number.isFinite)
      .map((createdAt) => createdAt + OUTPUT_HISTORY_RETENTION_MS)
    const nextExpiration = Math.min(...expirations)
    const timer = Number.isFinite(nextExpiration)
      ? window.setTimeout(pruneExpiredOutputHistory, Math.max(0, nextExpiration - Date.now() + 1))
      : undefined
    const pruneWhenVisible = () => {
      if (!document.hidden) pruneExpiredOutputHistory()
    }
    window.addEventListener('focus', pruneExpiredOutputHistory)
    document.addEventListener('visibilitychange', pruneWhenVisible)
    return () => {
      if (timer !== undefined) window.clearTimeout(timer)
      window.removeEventListener('focus', pruneExpiredOutputHistory)
      document.removeEventListener('visibilitychange', pruneWhenVisible)
    }
  }, [outputHistory])

  useEffect(() => {
    if (!canvasReferencePickerNodeId) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCanvasReferencePickerNodeId(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [canvasReferencePickerNodeId])

  useEffect(() => () => aspectTweenRef.current?.kill(), [])

  useEffect(() => {
    const releaseNodeDrag = () => setIsNodeDragging(false)
    window.addEventListener('pointerup', releaseNodeDrag)
    window.addEventListener('pointercancel', releaseNodeDrag)
    window.addEventListener('blur', releaseNodeDrag)
    return () => {
      window.removeEventListener('pointerup', releaseNodeDrag)
      window.removeEventListener('pointercancel', releaseNodeDrag)
      window.removeEventListener('blur', releaseNodeDrag)
    }
  }, [])

  const refreshRemoteModels = useCallback(async () => {
    if (!apiDraft.baseUrl.trim() || !apiDraft.apiKey.trim()) {
      setModelsError('请先填写当前连接的接口地址和 API Key')
      return
    }
    setModelsLoading(true)
    setModelsError('')
    const requestId = ++modelFetchRequestRef.current
    try {
      const models = await fetchRemoteModels({ baseUrl: apiDraft.baseUrl.trim(), apiKey: apiDraft.apiKey.trim() })
      if (requestId !== modelFetchRequestRef.current) return
      setDraftModels((current) => models.map((model) => ({
        ...model,
        enabled: current.find((item) => item.id === model.id)?.enabled ?? false,
      })))
      if (!models.length) setModelsError('接口没有返回可用模型')
    } catch (error) {
      if (requestId !== modelFetchRequestRef.current) return
      setDraftModels([])
      setModelsError(error instanceof Error ? error.message : '模型列表读取失败')
    } finally {
      if (requestId === modelFetchRequestRef.current) setModelsLoading(false)
    }
  }, [apiDraft.apiKey, apiDraft.baseUrl])

  useEffect(() => {
    if (!canvasNameEditing) return
    const timer = window.setTimeout(() => {
      canvasNameInputRef.current?.focus()
      canvasNameInputRef.current?.select()
    }, 20)
    return () => window.clearTimeout(timer)
  }, [canvasNameEditing])

  useEffect(() => {
    let cancelled = false
    void loadLocalProject(CURRENT_PROJECT_ID).then((project) => {
      if (cancelled || !project) return
      const restoredNodes = project.nodes as CanvasNode[]
      const restoredEdges = project.edges as Edge[]
      setNodes(restoredNodes)
      setEdges(restoredEdges)
      setCanvasName(project.name)
      setCanvasNameDraft(project.name)
      setStyleReferenceName(project.styleReferenceName)
      setStyleReferenceUrl(project.styleReferenceUrl ?? '')
      setStyleReferenceEnabled(project.styleReferenceEnabled ?? true)
      setProjectPromptSuffix(project.promptSuffix)
      setProjectSettingsLocked(project.settingsLocked)
      savedCanvasSignatureRef.current = buildCanvasSignature(
        restoredNodes,
        restoredEdges,
        project.name,
        project.styleReferenceName,
        project.styleReferenceUrl ?? '',
        project.styleReferenceEnabled ?? true,
        project.promptSuffix,
        project.settingsLocked,
      )
      setCanvasSaved(true)
    }).catch(() => {
      if (!cancelled) setToastMessage('本地项目读取失败')
    })
    return () => {
      cancelled = true
    }
  }, [setEdges, setNodes])

  useEffect(() => {
    const signature = buildCanvasSignature(
      nodes,
      edges,
      canvasName,
      styleReferenceName,
      styleReferenceUrl,
      styleReferenceEnabled,
      projectPromptSuffix,
      projectSettingsLocked,
    )
    if (savedCanvasSignatureRef.current === null) {
      savedCanvasSignatureRef.current = signature
      setCanvasSaved(true)
      return
    }
    setCanvasSaved(signature === savedCanvasSignatureRef.current)
  }, [canvasName, edges, nodes, projectPromptSuffix, projectSettingsLocked, styleReferenceEnabled, styleReferenceName, styleReferenceUrl])

  useEffect(() => {
    if (!toastMessage) return
    const timer = window.setTimeout(() => setToastMessage(null), 1800)
    return () => window.clearTimeout(timer)
  }, [toastMessage])

  useEffect(() => {
    if (!imageParameterMenuOpen) return
    const closeImageParameterMenu = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.image-parameter-control')) return
      setImageParameterMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeImageParameterMenu, true)
    return () => document.removeEventListener('pointerdown', closeImageParameterMenu, true)
  }, [imageParameterMenuOpen])

  useEffect(() => {
    if (activeEditorNodeId && !nodes.some((node) => node.id === activeEditorNodeId)) {
      setActiveEditorNodeId(null)
      setExpandedEditorNodeId(null)
    }
    if (activeImageNodeId && !nodes.some((node) => node.id === activeImageNodeId)) setActiveImageNodeId(null)
    if (activeGenerationNodeId && !nodes.some((node) => node.id === activeGenerationNodeId)) setActiveGenerationNodeId(null)
    if (previewImageNodeId && !nodes.some((node) => node.id === previewImageNodeId)) setPreviewImageNodeId(null)
    if (imageGalleryNodeId && !nodes.some((node) => node.id === imageGalleryNodeId)) setImageGalleryNodeId(null)
  }, [activeEditorNodeId, activeGenerationNodeId, activeImageNodeId, imageGalleryNodeId, nodes, previewImageNodeId])

  const closeNodeMenu = useCallback(() => setNodeMenu(null), [])
  const closeContextMenu = useCallback(() => setNodeContextMenu(null), [])
  const closeAllMenus = useCallback(() => {
    setNodeMenu(null)
    setNodeContextMenu(null)
  }, [])

  const measureNodeOverlay = useCallback((nodeId?: string | null) => {
    const targetNodeId = nodeId ?? activeImageNodeId ?? activeGenerationNodeId ?? activeEditorNodeId
    if (!targetNodeId || !shellRef.current) {
      if (overlayMeasureFrameRef.current !== null) window.cancelAnimationFrame(overlayMeasureFrameRef.current)
      overlayMeasureFrameRef.current = null
      overlayMeasureTargetRef.current = null
      setNodeOverlayRect(null)
      return
    }
    if (overlayMeasureFrameRef.current !== null) {
      if (overlayMeasureTargetRef.current === targetNodeId) return
      window.cancelAnimationFrame(overlayMeasureFrameRef.current)
      overlayMeasureFrameRef.current = null
    }
    overlayMeasureTargetRef.current = targetNodeId
    overlayMeasureFrameRef.current = window.requestAnimationFrame(() => {
      overlayMeasureFrameRef.current = null
      overlayMeasureTargetRef.current = null
      const nodeElement = document.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(targetNodeId)}"]`)
      const shellElement = shellRef.current
      if (!nodeElement || !shellElement) {
        setNodeOverlayRect(null)
        return
      }
      const nodeRect = nodeElement.getBoundingClientRect()
      const shellRect = shellElement.getBoundingClientRect()
      setNodeOverlayRect({
        left: nodeRect.left - shellRect.left,
        top: nodeRect.top - shellRect.top,
        width: nodeRect.width,
        height: nodeRect.height,
      })
    })
  }, [activeEditorNodeId, activeGenerationNodeId, activeImageNodeId])

  useEffect(() => {
    const activeOverlayNodeId = activeImageNodeId ?? activeGenerationNodeId ?? activeEditorNodeId
    if (!activeOverlayNodeId || isNodeDragging) {
      if (!activeOverlayNodeId) setNodeOverlayRect(null)
      return
    }
    measureNodeOverlay(activeOverlayNodeId)
  }, [activeEditorNodeId, activeGenerationNodeId, activeImageNodeId, canvasZoom, isNodeDragging, measureNodeOverlay, nodes])

  useEffect(() => {
    const activeOverlayNodeId = activeImageNodeId ?? activeGenerationNodeId ?? activeEditorNodeId
    if (!activeOverlayNodeId || isNodeDragging) return
    const nodeElement = shellRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(activeOverlayNodeId)}"]`)
    if (!nodeElement || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(() => measureNodeOverlay(activeOverlayNodeId))
    observer.observe(nodeElement)
    return () => observer.disconnect()
  }, [activeEditorNodeId, activeGenerationNodeId, activeImageNodeId, isNodeDragging, measureNodeOverlay])

  useEffect(() => {
    if (!previewImageNodeId) return
    const closePreview = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPreviewImageNodeId(null)
      }
    }
    window.addEventListener('keydown', closePreview)
    return () => window.removeEventListener('keydown', closePreview)
  }, [previewImageNodeId])

  useEffect(() => {
    if (!imageGalleryNodeId) return
    const closeGallery = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setImageGalleryNodeId(null)
    }
    window.addEventListener('keydown', closeGallery)
    return () => window.removeEventListener('keydown', closeGallery)
  }, [imageGalleryNodeId])

  useEffect(() => {
    const onResize = () => measureNodeOverlay()
    window.addEventListener('resize', onResize)
    return () => {
      window.removeEventListener('resize', onResize)
      if (overlayMeasureFrameRef.current !== null) window.cancelAnimationFrame(overlayMeasureFrameRef.current)
    }
  }, [measureNodeOverlay])

  const addImageFiles = useCallback(async (fileList: FileList | File[], position: { x: number; y: number }) => {
    const files = Array.from(fileList).filter((file) => file.type.startsWith('image/'))
    if (!files.length) {
      setToastMessage('请选择图片文件')
      return
    }

    const readFile = (file: File) => new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(String(reader.result))
      reader.onerror = () => reject(reader.error)
      reader.readAsDataURL(file)
    })

    try {
      const imageUrls = await Promise.all(files.map(readFile))
      const timestamp = Date.now()
      const uploadedNodes: CanvasNode[] = files.map((file, index) => ({
        id: `upload-${timestamp}-${index}`,
        type: 'disy',
        position: {
          x: position.x + index * 34,
          y: position.y + index * 34,
        },
        data: {
          kind: 'upload',
          title: file.name,
          body: '',
          fileName: file.name,
          imageUrl: imageUrls[index],
        },
      }))
      setNodes((current) => [...current, ...uploadedNodes])
      setToastMessage(files.length > 1 ? `已上传 ${files.length} 张图片` : '图片已加入画布')
    } catch {
      setToastMessage('图片读取失败，请重新选择')
    }
  }, [setNodes])

  const openImagePicker = useCallback((position: { x: number; y: number }) => {
    uploadPositionRef.current = position
    closeAllMenus()
    imageInputRef.current?.click()
  }, [closeAllMenus])

  const onConnect = useCallback(
    (connection: Connection) => {
      const source = nodes.find((node) => node.id === connection.source)
      const target = nodes.find((node) => node.id === connection.target)
      if (!source || !target || source.id === target.id) return
      setEdges((current) =>
        addEdge(
          { ...connection, type: 'luminous' },
          current,
        ),
      )
      closeAllMenus()
    },
    [closeAllMenus, nodes, setEdges],
  )

  const onConnectEnd: OnConnectEnd = useCallback(
    (event, connectionState) => {
      if (connectionState.isValid || !connectionState.fromNode) return
      const point = 'changedTouches' in event ? event.changedTouches.item(0) : event
      if (!point) return
      const targetElement = document
        .elementFromPoint(point.clientX, point.clientY)
        ?.closest<HTMLElement>('.react-flow__node')
      const targetNodeId = targetElement?.dataset.id

      if (targetNodeId && targetNodeId !== connectionState.fromNode.id) {
        const sourceNodeId = connectionState.fromNode.id
        setEdges((current) =>
          addEdge(
            {
              id: `${sourceNodeId}-${targetNodeId}-${Date.now()}`,
              source: sourceNodeId,
              target: targetNodeId,
              type: 'luminous',
            },
            current,
          ),
        )
        closeAllMenus()
        return
      }

      if (connectionState.toNode) return
      const flowPosition = screenToFlowPosition({ x: point.clientX, y: point.clientY })

      setNodeMenu({
        x: Math.min(point.clientX, window.innerWidth - 250),
        y: Math.min(point.clientY, window.innerHeight - 190),
        flowX: flowPosition.x,
        flowY: flowPosition.y,
        connectionSourceId: connectionState.fromNode.id,
      })
      closeContextMenu()
    },
    [closeAllMenus, closeContextMenu, screenToFlowPosition, setEdges],
  )

  const createNode = (kind: CreatableNodeKind, positionOverride?: { x: number; y: number }) => {
    const titles: Record<CreatableNodeKind, string> = {
      text: '文本',
      image: '图像',
      upload: '新上传',
    }
    const bodies: Record<CreatableNodeKind, string> = {
      text: '写下你的灵感，连接到图像节点。',
      image: '',
      upload: '上传一张参考图。',
    }
    const id = `${kind}-${Date.now()}`

    setNodes((current) => [
      ...current,
      {
        id,
        type: 'disy',
        position: positionOverride ?? { x: nodeMenu?.flowX ?? 360, y: nodeMenu?.flowY ?? 260 },
        ...(kind === 'text'
          ? { style: { width: 275, height: 126 } }
          : kind === 'image'
            ? { style: getImageGenerationNodeSize('1:1') }
            : {}),
        data: {
          kind,
          title: titles[kind],
          body: bodies[kind],
          ...(kind === 'image' ? {
            status: '待生成',
            imageAspectRatio: '1:1' as ImageAspectRatio,
            imageResolution: '1K' as ImageResolution,
            imageDetail: 'medium' as ImageDetail,
          } : {}),
        },
      },
    ])

    const connectionSourceId = positionOverride ? undefined : nodeMenu?.connectionSourceId
    if (connectionSourceId && kind === 'image') {
      setEdges((current) =>
        addEdge(
          {
            id: `${connectionSourceId}-${id}`,
            source: connectionSourceId,
            target: id,
            type: 'luminous',
          },
          current,
        ),
      )
    }
    closeNodeMenu()
  }

  const createNodeFromEmptyState = (kind: CreatableNodeKind) => {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    if (kind === 'upload') {
      openImagePicker({ x: center.x - 130, y: center.y - 110 })
      return
    }
    createNode(kind, { x: center.x - 138, y: center.y - 72 })
  }

  const openCenteredNodeMenu = () => {
    const x = window.innerWidth / 2
    const y = window.innerHeight / 2 + 28
    const flowPosition = screenToFlowPosition({ x, y })
    setNodeMenu({ x: x - 119, y, flowX: flowPosition.x, flowY: flowPosition.y })
  }

  const openNodeMenu = (event: React.MouseEvent | MouseEvent) => {
    event.preventDefault()
    closeContextMenu()
    const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
    setNodeMenu({
      x: event.clientX,
      y: event.clientY,
      flowX: flowPosition.x,
      flowY: flowPosition.y,
    })
  }

  const openNodeMenuFromButton = () => {
    closeContextMenu()
    const flowPosition = screenToFlowPosition({ x: 370, y: 210 })
    setNodeMenu({ x: 82, y: 112, flowX: flowPosition.x, flowY: flowPosition.y })
  }

  const updateActiveTextNode = (body: string) => {
    if (!activeEditorNodeId) return
    updateNodeBody(activeEditorNodeId, body)
  }

  const updateNodeBody = useCallback((nodeId: string, body: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, body } } : node,
      ),
    )
  }, [setNodes])

  const openNodeContextMenu = (event: React.MouseEvent, node: CanvasNode) => {
    event.preventDefault()
    event.stopPropagation()
    closeNodeMenu()
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })))
    setNodeContextMenu({
      x: Math.min(event.clientX, window.innerWidth - 254),
      y: Math.min(event.clientY, window.innerHeight - 224),
      nodeId: node.id,
    })
  }

  const copyNodeToClipboard = useCallback((node: CanvasNode, closeMenu = false) => {
    const measuredWidth = node.measured?.width
    const measuredHeight = node.measured?.height
    setNodeClipboard({
      data: { ...node.data },
      style: {
        ...node.style,
        ...(measuredWidth ? { width: measuredWidth } : {}),
        ...(measuredHeight ? { height: measuredHeight } : {}),
      },
    })
    pasteSequenceRef.current = 0
    setToastMessage('已复制节点')
    if (closeMenu) closeContextMenu()
  }, [closeContextMenu])

  const pasteClipboardNode = useCallback((anchor?: CanvasNode, closeMenu = false) => {
    if (!nodeClipboard) return
    pasteSequenceRef.current += 1
    const offset = 30 + Math.min(pasteSequenceRef.current - 1, 6) * 10
    const fallbackCenter = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const basePosition = anchor?.position ?? fallbackCenter
    const id = `${nodeClipboard.data.kind}-${Date.now()}-${pasteSequenceRef.current}`

    setNodes((current) => [
      ...current.map((item) => ({ ...item, selected: false })),
      {
        id,
        type: 'disy',
        position: { x: basePosition.x + offset, y: basePosition.y + offset },
        selected: true,
        style: nodeClipboard.style ? { ...nodeClipboard.style } : undefined,
        data: { ...nodeClipboard.data },
      },
    ])
    setActiveEditorNodeId(null)
    setExpandedEditorNodeId(null)
    setToastMessage('已粘贴节点副本')
    if (closeMenu) closeContextMenu()
  }, [closeContextMenu, nodeClipboard, screenToFlowPosition, setNodes])

  const copyContextNode = () => {
    if (!nodeContextMenu) return
    const node = nodes.find((item) => item.id === nodeContextMenu.nodeId)
    if (node) copyNodeToClipboard(node, true)
  }

  const pasteContextNode = () => {
    if (!nodeContextMenu || !nodeClipboard) return
    const anchor = nodes.find((item) => item.id === nodeContextMenu.nodeId)
    pasteClipboardNode(anchor, true)
  }

  useEffect(() => {
    const onClipboardShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return

      const key = event.key.toLowerCase()
      if (key === 'c') {
        const selectedNode = nodes.find((node) => node.selected)
        if (!selectedNode) return
        event.preventDefault()
        copyNodeToClipboard(selectedNode)
      }
      if (key === 'v' && nodeClipboard) {
        event.preventDefault()
        const selectedNode = nodes.find((node) => node.selected)
        pasteClipboardNode(selectedNode)
      }
    }

    window.addEventListener('keydown', onClipboardShortcut)
    return () => window.removeEventListener('keydown', onClipboardShortcut)
  }, [copyNodeToClipboard, nodeClipboard, nodes, pasteClipboardNode])

  useEffect(() => {
    const onDeleteShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return
      const selectedIds = latestSelectedNodeIdsRef.current
      if (!selectedIds.length) return
      event.preventDefault()
      const selectedIdSet = new Set(selectedIds)
      setNodes((current) => current.filter((node) => !selectedIdSet.has(node.id)))
      setEdges((current) => current.filter((edge) => !selectedIdSet.has(edge.source) && !selectedIdSet.has(edge.target)))
      setActiveEditorNodeId(null)
      setActiveImageNodeId(null)
      setActiveGenerationNodeId(null)
      setNodeOverlayRect(null)
    }
    window.addEventListener('keydown', onDeleteShortcut)
    return () => window.removeEventListener('keydown', onDeleteShortcut)
  }, [setEdges, setNodes])

  const deleteContextNode = () => {
    if (!nodeContextMenu) return
    const nodeId = nodeContextMenu.nodeId
    setNodes((current) => current.filter((item) => item.id !== nodeId))
    setEdges((current) => current.filter((edge) => edge.source !== nodeId && edge.target !== nodeId))
    setToastMessage('节点已删除')
    closeContextMenu()
  }

  const saveNodeToAssets = (node: CanvasNode) => {
    try {
      const nextAssets: SavedAsset[] = [
        ...savedAssets,
        {
          id: `asset-${Date.now()}`,
          savedAt: new Date().toISOString(),
          type: 'node',
          title: node.data.fileName || node.data.title,
          data: { ...node.data },
          style: node.style ? { ...node.style } : undefined,
          folderId: null,
        },
      ]
      localStorage.setItem('disy-saved-assets', JSON.stringify(nextAssets))
      setSavedAssets(nextAssets)
      setToastMessage('已加入资产库')
    } catch {
      setToastMessage('资产保存失败，本机存储空间可能不足')
    }
  }

  const saveContextNodeToAssets = () => {
    if (!nodeContextMenu) return
    const node = nodes.find((item) => item.id === nodeContextMenu.nodeId)
    if (!node) return
    saveNodeToAssets(node)
    closeContextMenu()
  }

  const saveApi = () => {
    if (!apiDraft.baseUrl.trim() || !apiDraft.apiKey.trim()) {
      setApiError('请完整填写接口地址和 API Key。')
      return
    }

    try {
      new URL(apiDraft.baseUrl)
    } catch {
      setApiError('接口地址必须是完整的 http 或 https URL。')
      return
    }

    const connectionId = editingConnectionId === 'new' ? `connection-${crypto.randomUUID()}` : editingConnectionId
    const nextConnection: ApiConnection = {
      id: connectionId,
      name: apiDraft.name.trim() || `连接 ${apiSettings.connections.length + 1}`,
      baseUrl: apiDraft.baseUrl.trim().replace(/\/$/, ''),
      apiKey: apiDraft.apiKey.trim(),
      models: draftModels,
      modelsFetchedAt: draftModels.length ? new Date().toISOString() : undefined,
    }
    const connections = apiSettings.connections.some((connection) => connection.id === connectionId)
      ? apiSettings.connections.map((connection) => connection.id === connectionId ? nextConnection : connection)
      : [...apiSettings.connections, nextConnection]
    const enabledText = connections.flatMap((connection) => connection.models
      .filter((model) => model.enabled && model.capability === 'text')
      .map((model) => ({ connectionId: connection.id, modelId: model.id })))
    const enabledImage = connections.flatMap((connection) => connection.models
      .filter((model) => model.enabled && model.capability === 'image')
      .map((model) => ({ connectionId: connection.id, modelId: model.id })))
    const selectedTextStillValid = enabledText.some((model) => model.connectionId === apiSettings.selectedTextModel?.connectionId && model.modelId === apiSettings.selectedTextModel?.modelId)
    const selectedImageStillValid = enabledImage.some((model) => model.connectionId === apiSettings.selectedImageModel?.connectionId && model.modelId === apiSettings.selectedImageModel?.modelId)
    try {
      saveApiSettings({
        connections,
        selectedTextModel: selectedTextStillValid ? apiSettings.selectedTextModel : enabledText[0],
        selectedImageModel: selectedImageStillValid ? apiSettings.selectedImageModel : enabledImage[0],
      })
    } catch {
      setApiError('保存失败，请检查浏览器本地存储权限')
      return
    }
    setEditingConnectionId(connectionId)
    setToastMessage('API 连接已保存')
  }

  const beginNewApiConnection = () => {
    modelFetchRequestRef.current += 1
    setModelsLoading(false)
    setEditingConnectionId('new')
    setApiDraft({ name: '', baseUrl: '', apiKey: '' })
    setDraftModels([])
    setModelsError('')
    setApiError('')
    setApiModelTab('text')
    window.setTimeout(() => firstApiInputRef.current?.focus(), 20)
  }

  const selectApiConnection = (connection: ApiConnection) => {
    modelFetchRequestRef.current += 1
    setModelsLoading(false)
    setEditingConnectionId(connection.id)
    setApiDraft({ name: connection.name, baseUrl: connection.baseUrl, apiKey: connection.apiKey })
    setDraftModels(connection.models)
    setModelsError('')
    setApiError('')
  }

  const removeCurrentApiConnection = () => {
    if (editingConnectionId === 'new') return
    const connections = apiSettings.connections.filter((connection) => connection.id !== editingConnectionId)
    const selectedTextModel = apiSettings.selectedTextModel?.connectionId === editingConnectionId ? undefined : apiSettings.selectedTextModel
    const selectedImageModel = apiSettings.selectedImageModel?.connectionId === editingConnectionId ? undefined : apiSettings.selectedImageModel
    saveApiSettings({ connections, selectedTextModel, selectedImageModel })
    const next = connections[0]
    if (next) selectApiConnection(next)
    else beginNewApiConnection()
    setToastMessage('API 连接已删除')
  }

  const changeCanvasZoom = (value: number) => {
    const nextZoom = Math.min(2, Math.max(0.25, value))
    setCanvasZoom(nextZoom)
    void zoomTo(nextZoom, { duration: reduceMotion ? 0 : 100 })
  }

  const saveCanvasState = async (nameOverride = canvasName, silent = false) => {
    const normalizedName = nameOverride.trim() || '未命名画布'
    try {
      await saveLocalProject({
        id: CURRENT_PROJECT_ID,
        name: normalizedName,
        nodes,
        edges,
        styleReferenceName,
        styleReferenceUrl,
        styleReferenceEnabled,
        promptSuffix: projectPromptSuffix,
        settingsLocked: projectSettingsLocked,
        updatedAt: new Date().toISOString(),
      })
      setCanvasName(normalizedName)
      setCanvasNameDraft(normalizedName)
      savedCanvasSignatureRef.current = buildCanvasSignature(
        nodes,
        edges,
        normalizedName,
        styleReferenceName,
        styleReferenceUrl,
        styleReferenceEnabled,
        projectPromptSuffix,
        projectSettingsLocked,
      )
      setCanvasSaved(true)
      if (!silent) setToastMessage('项目已保存到本机')
    } catch {
      setCanvasSaved(false)
      setToastMessage('项目保存失败，请检查浏览器存储权限')
    }
  }

  autoSaveActionRef.current = () => {
    void saveCanvasState(canvasName, true)
  }

  useEffect(() => {
    const autoSaveTimer = window.setInterval(() => {
      if (!canvasSavedRef.current) autoSaveActionRef.current()
    }, 2 * 60 * 1000)

    return () => window.clearInterval(autoSaveTimer)
  }, [])

  const commitCanvasName = () => {
    setCanvasNameEditing(false)
    void saveCanvasState(canvasNameDraft)
  }

  useEffect(() => {
    const onSaveShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 's') return
      event.preventDefault()
      void saveCanvasState()
    }
    window.addEventListener('keydown', onSaveShortcut)
    return () => window.removeEventListener('keydown', onSaveShortcut)
  })

  const activeTextNode = nodes.find(
    (node) => node.id === activeEditorNodeId && node.data.kind === 'text',
  )
  const activeImageNode = nodes.find(
    (node) => node.id === activeImageNodeId && node.data.kind === 'upload' && Boolean(node.data.imageUrl),
  )
  const activeGenerationNode = nodes.find(
    (node) => node.id === activeGenerationNodeId && node.data.kind === 'image',
  )
  const activeImageReferences = useMemo<ActiveImageReference[]>(() => {
    if (!activeGenerationNodeId) return []
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const references: Omit<ActiveImageReference, 'mention'>[] = []
    const seenUrls = new Set<string>()

    const generationNode = nodeById.get(activeGenerationNodeId)
    if (generationNode?.data.imageUrl) {
      seenUrls.add(generationNode.data.imageUrl)
      references.push({
        id: `current-${activeGenerationNodeId}`,
        source: 'current',
        sourceNodeId: activeGenerationNodeId,
        selected: generationNode.data.useCurrentImageAsReference !== false,
        name: '当前主图',
        url: generationNode.data.imageUrl,
      })
    }

    edges.forEach((edge) => {
      if (edge.target !== activeGenerationNodeId) return
      const sourceNode = nodeById.get(edge.source)
      const sourceCanReferenceImage = sourceNode?.data.kind === 'upload' || sourceNode?.data.kind === 'image'
      if (!sourceCanReferenceImage || !sourceNode.data.imageUrl || seenUrls.has(sourceNode.data.imageUrl)) return
      seenUrls.add(sourceNode.data.imageUrl)
      references.push({
        id: `connection-${sourceNode.id}`,
        source: 'connection',
        sourceNodeId: sourceNode.id,
        selected: Boolean((edge.data as { referenceSelected?: boolean } | undefined)?.referenceSelected),
        name: sourceNode.data.fileName || sourceNode.data.title || (sourceNode.data.kind === 'image' ? '生成主图' : '连接图片'),
        url: sourceNode.data.imageUrl,
      })
    })

    const manualReferences = generationNode?.data.referenceImages ?? []
    const legacyReferences: ImageReference[] = generationNode?.data.referenceImageUrl ? [{
      id: `legacy-${activeGenerationNodeId}`,
      name: generationNode.data.referenceImageName || '上传参考图',
      url: generationNode.data.referenceImageUrl,
    }] : []
    ;[...manualReferences, ...legacyReferences].forEach((reference) => {
      if (!reference.url || seenUrls.has(reference.url)) return
      seenUrls.add(reference.url)
      references.push({ ...reference, source: 'manual', selected: true })
    })

    const duplicateCounts = new Map<string, number>()
    return references.map((reference, index) => {
      const baseLabel = getReferenceLabel(reference.name, index)
      const duplicateIndex = (duplicateCounts.get(baseLabel) ?? 0) + 1
      duplicateCounts.set(baseLabel, duplicateIndex)
      const label = duplicateIndex > 1 ? `${baseLabel} · ${duplicateIndex}` : baseLabel
      return { ...reference, name: label, mention: getReferenceMention(label) }
    })
  }, [activeGenerationNodeId, edges, nodes])

  useEffect(() => {
    if (!activeGenerationNodeId || !activeImageReferences.length) return
    setNodes((current) => {
      const targetNode = current.find((node) => node.id === activeGenerationNodeId)
      if (!targetNode) return current
      let nextBody = targetNode.data.body
      activeImageReferences.forEach((reference, index) => {
        nextBody = nextBody.replaceAll(`@参考图${index + 1}`, reference.mention)
      })
      if (nextBody === targetNode.data.body) return current
      return current.map((node) => node.id === activeGenerationNodeId
        ? { ...node, data: { ...node.data, body: nextBody } }
        : node)
    })
  }, [activeGenerationNodeId, activeImageReferences, setNodes])
  const filteredImageMentionReferences = activeImageReferences.filter((reference) => {
    const query = imageMentionQuery.trim().toLowerCase()
    return !query || `${reference.name} ${reference.mention}`.toLowerCase().includes(query)
  })
  const selectedImageReferences = activeImageReferences.filter((reference) => (
    reference.selected || activeGenerationNode?.data.body.includes(reference.mention)
  ))
  const activeImageAspectRatio = activeGenerationNode?.data.imageAspectRatio ?? '1:1'
  const activeImageResolution = activeGenerationNode?.data.imageResolution ?? '1K'
  const activeImageDetail = activeGenerationNode?.data.imageDetail ?? 'medium'
  const updateActiveImageOptions = (patch: Partial<Pick<CanvasNode['data'], 'imageAspectRatio' | 'imageResolution' | 'imageDetail'>>) => {
    if (!activeGenerationNode) return
    const nextAspectRatio = patch.imageAspectRatio ?? activeImageAspectRatio
    const nextSize = getImageGenerationNodeSize(nextAspectRatio)
    setNodes((current) => current.map((node) => node.id === activeGenerationNode.id ? {
      ...node,
      style: patch.imageAspectRatio ? { ...node.style, ...nextSize } : node.style,
      data: { ...node.data, ...patch },
    } : node))
    if (patch.imageAspectRatio) {
      const nodeId = activeGenerationNode.id
      window.requestAnimationFrame(() => {
        const wrapper = shellRef.current?.querySelector<HTMLElement>(`.react-flow__node[data-id="${CSS.escape(nodeId)}"]`)
        const content = wrapper?.querySelector<HTMLElement>('.image-placeholder')
        if (!wrapper || !content || reduceMotion) {
          updateNodeInternals(nodeId)
          window.requestAnimationFrame(() => measureNodeOverlay(nodeId))
          return
        }
        void import('gsap').then(({ default: gsap }) => {
          aspectTweenRef.current?.kill()
          aspectTweenRef.current = gsap.fromTo(
            content,
            { scale: 0.975, opacity: 0.72 },
            {
              scale: 1,
              opacity: 1,
              duration: 0.34,
              ease: 'power2.out',
              overwrite: true,
              onComplete: () => {
                aspectTweenRef.current = null
                gsap.set(content, { clearProps: 'transform,opacity' })
                updateNodeInternals(nodeId)
                measureNodeOverlay(nodeId)
              },
            },
          )
        })
      })
    }
  }

  const selectImageMention = (reference: ActiveImageReference) => {
    if (!activeGenerationNode) return
    if (reference.source === 'connection' && reference.sourceNodeId) {
      setEdges((current) => current.map((edge) => (
        edge.source === reference.sourceNodeId && edge.target === activeGenerationNode.id
          ? { ...edge, data: { ...(edge.data ?? {}), referenceSelected: true } }
          : edge
      )))
    }
    const body = activeGenerationNode.data.body
    const range = imageMentionRange ?? { start: body.length, end: body.length }
    const nextBody = `${body.slice(0, range.start)}${reference.mention} ${body.slice(range.end)}`
    setNodes((current) => current.map((node) => node.id === activeGenerationNode.id ? {
      ...node,
      data: { ...node.data, promptText: undefined, body: nextBody },
    } : node))
    setImageMentionOpen(false)
    setImageMentionQuery('')
    setImageMentionRange(null)
    window.requestAnimationFrame(() => {
      imagePromptEditorRef.current?.focusAt(range.start + reference.mention.length + 1)
    })
  }

  const removeImageReference = (reference: ActiveImageReference) => {
    if (!activeGenerationNode) return
    if (reference.source === 'current') {
      setNodes((current) => current.map((node) => node.id === activeGenerationNode.id ? {
        ...node,
        data: { ...node.data, useCurrentImageAsReference: false },
      } : node))
    } else if (reference.source === 'connection' && reference.sourceNodeId) {
      setEdges((current) => current.filter((edge) => !(edge.source === reference.sourceNodeId && edge.target === activeGenerationNode.id)))
    } else {
      setNodes((current) => current.map((node) => node.id === activeGenerationNode.id ? {
        ...node,
        data: {
          ...node.data,
          referenceImages: (node.data.referenceImages ?? []).filter((item) => item.id !== reference.id),
          ...(reference.id.startsWith('legacy-') ? { referenceImageUrl: undefined, referenceImageName: undefined } : {}),
        },
      } : node))
    }
    setNodes((current) => current.map((node) => {
      if (node.id !== activeGenerationNode.id) return node
      const body = node.data.body
        .replaceAll(reference.mention, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ +\n/g, '\n')
        .trimStart()
      return body === node.data.body ? node : { ...node, data: { ...node.data, body } }
    }))
  }

  const handleImagePromptChange = (value: string, cursor: number) => {
    if (!activeGenerationNode) return
    setNodes((current) => current.map((node) => node.id === activeGenerationNode.id ? {
      ...node,
      data: { ...node.data, promptText: undefined, body: value },
    } : node))
    const beforeCursor = value.slice(0, cursor)
    const match = beforeCursor.match(/@(?:\[([^\]]*)\]|([^@\s]*))$/)
    if (match && activeImageReferences.length) {
      setImageMentionRange({ start: cursor - match[0].length, end: cursor })
      setImageMentionQuery(match[1] ?? match[2] ?? '')
      setImageMentionIndex(0)
      setImageMentionOpen(true)
    } else {
      setImageMentionOpen(false)
      setImageMentionRange(null)
    }
  }
  const previewImageNode = nodes.find(
    (node) => node.id === previewImageNodeId && (node.data.kind === 'upload' || node.data.kind === 'image') && Boolean(node.data.imageUrl),
  )
  const previewImageItems = previewImageNode
    ? previewImageNode.data.imageVariants?.length
      ? previewImageNode.data.imageVariants.map((variant, index) => ({
          id: variant.id,
          url: variant.url,
          alt: variant.fileName || `生成图片 ${index + 1}`,
          fileName: variant.fileName || `disy-image-${index + 1}.png`,
        }))
      : previewImageNode.data.imageUrl
        ? [{
            id: `preview-${previewImageNode.id}`,
            url: previewImageNode.data.imageUrl,
            alt: previewImageNode.data.fileName || '图片预览',
            fileName: previewImageNode.data.fileName || 'disy-image.png',
          }]
        : []
    : []
  const safePreviewImageIndex = previewImageItems.length
    ? Math.min(previewImageIndex, previewImageItems.length - 1)
    : 0
  const previewImage = previewImageItems[safePreviewImageIndex] ?? null
  const openNodeImagePreview = useCallback((nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node?.data.imageUrl) return
    const variants = node.data.imageVariants ?? []
    const activeIndex = variants.findIndex((variant) => (
      variant.id === node.data.activeImageVariantId || variant.url === node.data.imageUrl
    ))
    setPreviewImageIndex(activeIndex >= 0 ? activeIndex : 0)
    setPreviewImageDirection(1)
    setPreviewImageNodeId(nodeId)
  }, [nodes])
  const movePreviewImage = useCallback((step: number) => {
    if (previewImageItems.length < 2) return
    setPreviewImageDirection(step > 0 ? 1 : -1)
    setPreviewImageIndex((current) => (current + step + previewImageItems.length) % previewImageItems.length)
  }, [previewImageItems.length])
  const onPreviewImageWheel = (event: React.WheelEvent) => {
    event.preventDefault()
    if (previewWheelLockRef.current || Math.max(Math.abs(event.deltaX), Math.abs(event.deltaY)) < 8) return
    previewWheelLockRef.current = true
    movePreviewImage((Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) > 0 ? 1 : -1)
    window.setTimeout(() => { previewWheelLockRef.current = false }, 260)
  }
  const imageGalleryNode = nodes.find(
    (node) => node.id === imageGalleryNodeId && (node.data.kind === 'upload' || node.data.kind === 'image') && Boolean(node.data.imageVariants?.length),
  )

  useEffect(() => {
    if (!previewImageNodeId) return
    const onPreviewKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft') movePreviewImage(-1)
      if (event.key === 'ArrowRight') movePreviewImage(1)
    }
    window.addEventListener('keydown', onPreviewKeyDown)
    return () => window.removeEventListener('keydown', onPreviewKeyDown)
  }, [movePreviewImage, previewImageNodeId])

  const copyActiveText = async () => {
    if (!activeTextNode) return
    try {
      await navigator.clipboard.writeText(activeTextNode.data.body)
      setToastMessage('已复制全部内容')
    } catch {
      setToastMessage('复制失败，请重试')
    }
  }

  const applyMarkdownFormat = (action: MarkdownAction) => {
    if (!activeTextNode) return
    const textarea = expandedEditorNodeId ? expandedTextareaRef.current : editorTextareaRef.current
    const body = activeTextNode.data.body
    const start = textarea?.selectionStart ?? body.length
    const end = textarea?.selectionEnd ?? start
    const selected = body.slice(start, end)
    let nextBody = body
    let nextStart = start
    let nextEnd = end

    const wrapSelection = (before: string, after = before, fallback = '文字') => {
      const content = selected || fallback
      nextBody = `${body.slice(0, start)}${before}${content}${after}${body.slice(end)}`
      nextStart = start + before.length
      nextEnd = nextStart + content.length
    }

    if (action === 'bold') wrapSelection('**')
    if (action === 'italic') wrapSelection('_')
    if (action === 'divider') {
      const divider = `${start > 0 && !body.slice(0, start).endsWith('\n') ? '\n' : ''}---\n`
      nextBody = `${body.slice(0, start)}${divider}${body.slice(end)}`
      nextStart = nextEnd = start + divider.length
    }
    if (action === 'h1' || action === 'h2' || action === 'h3' || action === 'paragraph') {
      const lineStart = body.lastIndexOf('\n', Math.max(0, start - 1)) + 1
      const lineEndIndex = body.indexOf('\n', end)
      const lineEnd = lineEndIndex === -1 ? body.length : lineEndIndex
      const line = body.slice(lineStart, lineEnd).replace(/^\s{0,3}#{1,6}\s+/, '')
      const prefix = action === 'paragraph' ? '' : `${'#'.repeat(Number(action.slice(1)))} `
      const replacement = `${prefix}${line}`
      nextBody = `${body.slice(0, lineStart)}${replacement}${body.slice(lineEnd)}`
      nextStart = lineStart + prefix.length
      nextEnd = lineStart + replacement.length
    }
    if (action === 'bullet' || action === 'ordered') {
      const blockStart = body.lastIndexOf('\n', Math.max(0, start - 1)) + 1
      const blockEndIndex = body.indexOf('\n', end)
      const blockEnd = blockEndIndex === -1 ? body.length : blockEndIndex
      const lines = body.slice(blockStart, blockEnd).split('\n')
      const replacement = lines.map((line, index) => {
        const cleanLine = line.replace(/^\s*(?:[-*+] |\d+\. )/, '')
        return action === 'bullet' ? `- ${cleanLine}` : `${index + 1}. ${cleanLine}`
      }).join('\n')
      nextBody = `${body.slice(0, blockStart)}${replacement}${body.slice(blockEnd)}`
      nextStart = blockStart
      nextEnd = blockStart + replacement.length
    }

    updateNodeBody(activeTextNode.id, nextBody)
    window.requestAnimationFrame(() => {
      const target = expandedEditorNodeId ? expandedTextareaRef.current : editorTextareaRef.current
      target?.focus()
      target?.setSelectionRange(nextStart, nextEnd)
    })
  }

  const enabledTextModels = apiSettings.connections.flatMap((connection) => connection.models
    .filter((model) => model.enabled && model.capability === 'text')
    .map((model) => ({ connection, model })))
  const selectedTextModel = enabledTextModels.find(({ connection, model }) => (
    connection.id === apiSettings.selectedTextModel?.connectionId
    && model.id === apiSettings.selectedTextModel?.modelId
  )) ?? enabledTextModels[0]
  const enabledImageModels = apiSettings.connections.flatMap((connection) => connection.models
    .filter((model) => model.enabled && model.capability === 'image')
    .map((model) => ({ connection, model })))
  const selectedImageModel = enabledImageModels.find(({ connection, model }) => (
    connection.id === apiSettings.selectedImageModel?.connectionId
    && model.id === apiSettings.selectedImageModel?.modelId
  )) ?? enabledImageModels[0]
  const hasCatalogTextModels = apiSettings.connections.some((connection) => connection.models.some((model) => model.capability === 'text'))
  const hasCatalogImageModels = apiSettings.connections.some((connection) => connection.models.some((model) => model.capability === 'image'))

  const appendOutputHistory = (record: Omit<OutputHistoryRecord, 'id' | 'createdAt'>) => {
    const nextRecord: OutputHistoryRecord = {
      ...record,
      id: `output-${Date.now()}-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
    }
    setOutputHistory((current) => {
      const cutoff = Date.now() - OUTPUT_HISTORY_RETENTION_MS
      const next = [nextRecord, ...current.filter((item) => new Date(item.createdAt).getTime() >= cutoff)].slice(0, 200)
      try {
        localStorage.setItem(OUTPUT_HISTORY_KEY, JSON.stringify(next))
      } catch {
        // Output logging must never turn a successful generation into a failed generation.
      }
      return next
    })
  }

  const deleteOutputHistoryRecord = (recordId: string) => {
    setOutputHistory((current) => {
      const next = current.filter((record) => record.id !== recordId)
      try {
        localStorage.setItem(OUTPUT_HISTORY_KEY, JSON.stringify(next))
      } catch {
        // Keep the visible list usable even if browser storage is full.
      }
      return next
    })
    setExpandedOutputErrorId((current) => current === recordId ? null : current)
  }

  const toOutputHistoryError = (error: unknown): NonNullable<OutputHistoryRecord['error']> => {
    const normalized = normalizeGenerationError(error)
    return {
      category: normalized.category,
      summary: normalized.message,
      detail: normalized.detail,
      status: normalized.status,
      requestId: normalized.requestId,
    }
  }

  const generateFromActiveTextNode = async () => {
    if (!activeTextNode || generationLoading || generationRequestLockRef.current) return
    const prompt = [activeTextNode.data.body.trim(), projectPromptSuffix.trim()].filter(Boolean).join('\n')
    if (!prompt) {
      setToastMessage('请先输入文本提示词')
      return
    }
    if (!selectedTextModel) {
      setToastMessage(hasCatalogTextModels ? '已有文本模型但尚未启用，请到 API 设置中勾选' : hasCatalogImageModels ? '当前只有图像模型，请切换或添加文本模型' : '请先添加并启用文本模型')
      setApiOpen(true)
      return
    }
    if (!selectedTextModel.connection.apiKey) {
      setToastMessage('当前连接的 API Key 已过期，请重新填写')
      setEditingConnectionId(selectedTextModel.connection.id)
      setApiOpen(true)
      return
    }
    if (generationCount > 1) {
      setToastMessage('为避免多次请求重复扣费，文本批量生成暂未开放')
      return
    }

    generationRequestLockRef.current = true
    setGenerationLoading(true)
    setModelMenuOpen(false)
    try {
      const outputs = [await generateRemoteText({
        baseUrl: selectedTextModel.connection.baseUrl,
        apiKey: selectedTextModel.connection.apiKey,
        model: selectedTextModel.model.id,
      }, prompt)]
      const stamp = Date.now()
      const baseX = activeTextNode.position.x + (activeTextNode.width ?? 420) + 150
      const baseY = activeTextNode.position.y
      const generatedNodes: CanvasNode[] = outputs.map((output, index) => ({
        id: `generated-text-${stamp}-${index}`,
        type: 'disy',
        position: { x: baseX + index * 450, y: baseY },
        data: {
          kind: 'text',
          title: '文本',
          body: output,
          status: selectedTextModel.model.name,
        },
        style: { width: 420, height: 240 },
      }))
      const generatedEdges: Edge[] = generatedNodes.map((node, index) => ({
        id: `edge-${activeTextNode.id}-${node.id}-${index}`,
        source: activeTextNode.id,
        target: node.id,
        type: 'luminous',
      }))
      setNodes((current) => [...current, ...generatedNodes])
      setEdges((current) => [...current, ...generatedEdges])
      appendOutputHistory({
        kind: 'text',
        status: 'success',
        prompt,
        modelId: selectedTextModel.model.id,
        modelName: selectedTextModel.model.name,
        connectionName: selectedTextModel.connection.name,
        requestedCount: generationCount,
        outputCount: outputs.length,
        preview: outputs[0]?.slice(0, 240),
      })
      setToastMessage(`已生成 ${outputs.length} 个文本节点`)
    } catch (error) {
      const historyError = toOutputHistoryError(error)
      appendOutputHistory({
        kind: 'text',
        status: 'failed',
        prompt,
        modelId: selectedTextModel.model.id,
        modelName: selectedTextModel.model.name,
        connectionName: selectedTextModel.connection.name,
        requestedCount: generationCount,
        outputCount: 0,
        error: historyError,
      })
      setToastMessage(historyError.summary)
    } finally {
      generationRequestLockRef.current = false
      setGenerationLoading(false)
    }
  }

  const generateFromActiveImageNode = async () => {
    if (!activeGenerationNode || generationLoading || generationRequestLockRef.current) return
    const promptText = activeGenerationNode.data.body.trim()
    if (!promptText) {
      setToastMessage('请先输入图像提示词')
      return
    }
    const mentionGuide = selectedImageReferences.length
      ? `参考图片对应关系：${selectedImageReferences.map((reference, index) => `${reference.mention} 是第 ${index + 1} 张输入图片（${reference.name}）`).join('；')}`
      : ''
    const prompt = [promptText, mentionGuide, projectPromptSuffix.trim()].filter(Boolean).join('\n')
    if (!selectedImageModel) {
      setToastMessage(hasCatalogImageModels ? '已有图像模型但尚未启用，请到 API 设置中勾选' : '请先添加并启用图像模型')
      setApiOpen(true)
      return
    }
    if (!selectedImageModel.connection.apiKey) {
      setToastMessage('当前连接缺少 API Key，请重新填写')
      setEditingConnectionId(selectedImageModel.connection.id)
      setApiOpen(true)
      return
    }
    const requestedReferenceUrls = Array.from(new Set([
      ...selectedImageReferences.map((reference) => reference.url),
      styleReferenceEnabled ? styleReferenceUrl : '',
    ].filter((url): url is string => Boolean(url))))
    if (requestedReferenceUrls.length > 16) {
      setToastMessage(`参考图最多 16 张，当前已选择 ${requestedReferenceUrls.length} 张`)
      return
    }

    generationRequestLockRef.current = true
    setGenerationLoading(true)
    setImageModelMenuOpen(false)
    const generationNodeId = activeGenerationNode.id
    setNodes((current) => current.map((node) => node.id === generationNodeId
      ? { ...node, data: { ...node.data, status: '生成中' } }
      : node))
    try {
      const referenceImages = await Promise.all(requestedReferenceUrls.map(prepareReferenceImageForRequest))
      const requestMode = referenceImages.length > 0 && /(?:gpt-image|chatgpt-image)/i.test(selectedImageModel.model.id)
        ? 'images/edits'
        : 'images/generations'
      const images: Awaited<ReturnType<typeof generateRemoteImages>> = []
      let stoppedError: unknown = null
      // A requested 2×/3×/4× batch is intentionally billed as up to that many
      // single-image requests. Each slot is sent once, sequentially, and the first
      // failure stops the remaining queue so unsupported gateways cannot keep charging.
      while (images.length < generationCount) {
        try {
          const remaining = generationCount - images.length
          const batch = await generateRemoteImages({
            baseUrl: selectedImageModel.connection.baseUrl,
            apiKey: selectedImageModel.connection.apiKey,
            model: selectedImageModel.model.id,
          }, {
            prompt,
            count: 1,
            referenceImages,
            aspectRatio: activeImageAspectRatio,
            resolution: activeImageResolution,
            detail: activeImageDetail,
          })
          if (!batch.length) throw new Error('图像模型没有返回图片')
          images.push(...batch.slice(0, remaining))
        } catch (error) {
          stoppedError = error
          break
        }
      }
      if (!images.length) throw stoppedError ?? new Error('图像模型没有返回图片')

      const stamp = Date.now()
      const createdAt = new Date().toISOString()
      const newVariants: ImageVariant[] = images.map((image, index) => ({
        id: `variant-${stamp}-${index}`,
        url: image.url,
        fileName: `disy-${stamp}-${index + 1}.png`,
        createdAt,
        revisedPrompt: image.revisedPrompt || prompt,
      }))
      const primaryVariant = newVariants[0]
      setNodes((current) => current.map((node) => {
        if (node.id !== activeGenerationNode.id) return node
        const previousVariants = node.data.imageVariants?.length
          ? node.data.imageVariants
          : node.data.imageUrl
            ? [{
                id: `variant-original-${node.id}`,
                url: node.data.imageUrl,
                fileName: node.data.fileName || 'disy-image.png',
                createdAt,
                revisedPrompt: node.data.body,
              }]
            : []
        return {
          ...node,
          data: {
            ...node.data,
            imageUrl: primaryVariant.url,
            fileName: primaryVariant.fileName,
            imageVariants: [...previousVariants, ...newVariants],
            activeImageVariantId: primaryVariant.id,
            status: stoppedError ? '生成失败' : '已完成',
          },
        }
      }))
      const records: GenerationRecord[] = newVariants.map((variant) => ({
        id: `history-${variant.id}`,
        createdAt: new Date().toISOString(),
        prompt,
        model: selectedImageModel.model.name,
        imageUrl: variant.url,
        fileName: variant.fileName,
      }))
      setGenerationHistory((current) => {
        const next = [...current, ...records]
        try {
          // Base64 image payloads can exceed localStorage's small quota. Keep them
          // available in this session without allowing persistence to crash the UI.
          const persistable = next.filter((record) => !record.imageUrl.startsWith('data:'))
          localStorage.setItem(GENERATION_HISTORY_KEY, JSON.stringify(persistable))
        } catch {
          // Persistence failure must never discard the generated result or blank the app.
        }
        return next
      })
      appendOutputHistory({
        kind: 'image',
        status: 'success',
        prompt: promptText,
        modelId: selectedImageModel.model.id,
        modelName: selectedImageModel.model.name,
        connectionName: selectedImageModel.connection.name,
        requestedCount: generationCount,
        outputCount: images.length,
        preview: `${activeImageAspectRatio} · ${activeImageResolution} · ${IMAGE_DETAIL_LABELS[activeImageDetail]} · 参考图 ${referenceImages.length} 张 · ${requestMode}`,
      })
      if (stoppedError) {
        appendOutputHistory({
          kind: 'image',
          status: 'failed',
          prompt: promptText,
          modelId: selectedImageModel.model.id,
          modelName: selectedImageModel.model.name,
          connectionName: selectedImageModel.connection.name,
          requestedCount: generationCount - images.length,
          outputCount: 0,
          preview: `参考图 ${referenceImages.length} 张 · ${requestMode}`,
          error: toOutputHistoryError(stoppedError),
        })
      }
      setToastMessage(stoppedError
        ? `生成失败，已停止后续请求${images.length ? `；已保留 ${images.length} 张成功结果` : ''}`
        : `已生成 ${images.length} 张图像`)
    } catch (error) {
      const historyError = toOutputHistoryError(error)
      const attemptedReferenceCount = selectedImageReferences.length + (styleReferenceEnabled && styleReferenceUrl ? 1 : 0)
      const attemptedRequestMode = attemptedReferenceCount > 0 && /(?:gpt-image|chatgpt-image)/i.test(selectedImageModel.model.id)
        ? 'images/edits'
        : 'images/generations'
      setNodes((current) => current.map((node) => node.id === generationNodeId
        ? { ...node, data: { ...node.data, status: '生成失败' } }
        : node))
      appendOutputHistory({
        kind: 'image',
        status: 'failed',
        prompt: promptText,
        modelId: selectedImageModel.model.id,
        modelName: selectedImageModel.model.name,
        connectionName: selectedImageModel.connection.name,
        requestedCount: generationCount,
        outputCount: 0,
        preview: `参考图 ${attemptedReferenceCount} 张 · ${attemptedRequestMode}`,
        error: historyError,
      })
      setToastMessage(historyError.summary)
    } finally {
      generationRequestLockRef.current = false
      setGenerationLoading(false)
    }
  }

  const shellWidth = shellRef.current?.clientWidth ?? window.innerWidth
  const nodeCenterX = nodeOverlayRect ? nodeOverlayRect.left + nodeOverlayRect.width / 2 : shellWidth / 2
  const symmetricEditorWidth = nodeOverlayRect
    ? 2 * Math.max(130, Math.min(nodeCenterX - 16, shellWidth - nodeCenterX - 16))
    : shellWidth - 32
  const nodeEditorWidth = Math.min(680, symmetricEditorWidth)
  const currentProjectMatches = !projectSearch.trim()
    || canvasName.toLowerCase().includes(projectSearch.trim().toLowerCase())

  const selectedGroupNode = selectedNodeIds.length === 1
    ? nodes.find((node) => node.id === selectedNodeIds[0] && node.data.kind === 'group')
    : undefined

  const handleSelectionChange = useCallback(({ nodes: selectedNodes }: { nodes: CanvasNode[] }) => {
    const ids = selectedNodes.map((node) => node.id)
    latestSelectedNodeIdsRef.current = ids
    setSelectedNodeIds(ids)
    if (!ids.length) setMarqueeSelectionCommitted(false)
    if (ids.length > 1) {
      setActiveEditorNodeId(null)
      setActiveImageNodeId(null)
      setActiveGenerationNodeId(null)
      setExpandedEditorNodeId(null)
    }
    if (!selectedNodes.some((node) => node.data.kind === 'group')) setGroupColorMenuOpen(false)
  }, [])

  const handleSelectionStart = useCallback(() => {
    setMarqueeSelectionCommitted(false)
  }, [])

  const handleSelectionEnd = useCallback(() => {
    window.requestAnimationFrame(() => {
      setMarqueeSelectionCommitted(latestSelectedNodeIdsRef.current.length > 0)
    })
  }, [])

  const selectionToolbarAllowed = marqueeSelectionCommitted || Boolean(selectedGroupNode)

  useEffect(() => {
    if (!selectionToolbarAllowed || !selectedNodeIds.length || isNodeDragging) {
      setSelectionToolbarRect(null)
      return
    }

    const frame = window.requestAnimationFrame(() => {
      const selectedElements = Array.from(
        shellRef.current?.querySelectorAll<HTMLElement>('.react-flow__node.selected') ?? [],
      )
      if (!selectedElements.length) {
        setSelectionToolbarRect(null)
        return
      }

      const rects = selectedElements.map((element) => element.getBoundingClientRect())
      const left = Math.min(...rects.map((rect) => rect.left))
      const right = Math.max(...rects.map((rect) => rect.right))
      const top = Math.min(...rects.map((rect) => rect.top))
      setSelectionToolbarRect({
        left: Math.min(window.innerWidth - 190, Math.max(190, (left + right) / 2)),
        top: Math.max(68, top - 12),
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [canvasZoom, isNodeDragging, nodes, selectedNodeIds, selectionToolbarAllowed])

  const getNodeSize = (node: CanvasNode) => {
    const styleWidth = typeof node.style?.width === 'number' ? node.style.width : Number.parseFloat(String(node.style?.width ?? ''))
    const styleHeight = typeof node.style?.height === 'number' ? node.style.height : Number.parseFloat(String(node.style?.height ?? ''))
    return {
      width: node.measured?.width || (Number.isFinite(styleWidth) ? styleWidth : node.data.kind === 'upload' ? 260 : 275),
      height: node.measured?.height || (Number.isFinite(styleHeight) ? styleHeight : node.data.kind === 'upload' ? 230 : 126),
    }
  }

  const groupSelectedNodes = () => {
    const selected = nodes.filter(
      (node) => selectedNodeIds.includes(node.id) && !node.parentId && node.data.kind !== 'group',
    )
    if (selected.length < 2) {
      setToastMessage('请至少框选两个未分组节点')
      return
    }

    const minX = Math.min(...selected.map((node) => node.position.x))
    const minY = Math.min(...selected.map((node) => node.position.y))
    const maxX = Math.max(...selected.map((node) => node.position.x + getNodeSize(node).width))
    const maxY = Math.max(...selected.map((node) => node.position.y + getNodeSize(node).height))
    const groupId = `group-${Date.now()}`
    const groupX = minX - 32
    const groupY = minY - 54
    const groupNode: CanvasNode = {
      id: groupId,
      type: 'disy',
      position: { x: groupX, y: groupY },
      selected: true,
      style: { width: maxX - minX + 64, height: maxY - minY + 86 },
      data: {
        kind: 'group',
        title: '新分组',
        body: '',
        groupColor: 'rgba(72, 76, 73, .20)',
      },
    }

    setNodes((current) => [
      groupNode,
      ...current.map((node) => selected.some((item) => item.id === node.id)
        ? {
            ...node,
            parentId: groupId,
            extent: 'parent' as const,
            position: { x: node.position.x - groupX, y: node.position.y - groupY },
            selected: false,
          }
        : { ...node, selected: false }),
    ])
    setMarqueeSelectionCommitted(false)
    setSelectedNodeIds([groupId])
    setActiveEditorNodeId(null)
    setToastMessage(`已将 ${selected.length} 个节点打组`)
  }

  const ungroupSelectedNode = () => {
    if (!selectedGroupNode) return
    const groupPosition = selectedGroupNode.position
    setNodes((current) => current
      .filter((node) => node.id !== selectedGroupNode.id)
      .map((node) => node.parentId === selectedGroupNode.id
        ? {
            ...node,
            parentId: undefined,
            extent: undefined,
            position: {
              x: groupPosition.x + node.position.x,
              y: groupPosition.y + node.position.y,
            },
            selected: true,
          }
        : node))
    setSelectedNodeIds(nodes.filter((node) => node.parentId === selectedGroupNode.id).map((node) => node.id))
    setGroupColorMenuOpen(false)
    setToastMessage('分组已解散')
  }

  const arrangeSelectedGroupAsGrid = () => {
    if (!selectedGroupNode) return
    const children = nodes.filter((node) => node.parentId === selectedGroupNode.id)
    if (!children.length) return
    const columns = Math.ceil(Math.sqrt(children.length))
    const rows = Math.ceil(children.length / columns)
    const cellWidth = Math.max(...children.map((node) => getNodeSize(node).width)) + 28
    const cellHeight = Math.max(...children.map((node) => getNodeSize(node).height)) + 28
    const paddingX = 30
    const paddingTop = 54

    setNodes((current) => current.map((node) => {
      if (node.id === selectedGroupNode.id) {
        return {
          ...node,
          style: {
            ...node.style,
            width: paddingX * 2 + columns * cellWidth - 28,
            height: paddingTop + 30 + rows * cellHeight - 28,
          },
        }
      }
      const index = children.findIndex((child) => child.id === node.id)
      if (index === -1) return node
      return {
        ...node,
        position: {
          x: paddingX + (index % columns) * cellWidth,
          y: paddingTop + Math.floor(index / columns) * cellHeight,
        },
      }
    }))
    setToastMessage('已整理为宫格布局')
  }

  const setSelectedGroupColor = (color: string) => {
    if (!selectedGroupNode) return
    setNodes((current) => current.map((node) => node.id === selectedGroupNode.id
      ? { ...node, data: { ...node.data, groupColor: color } }
      : node))
    setGroupColorMenuOpen(false)
  }

  const getSelectedNodesWithGroupChildren = () => {
    const includedIds = new Set(selectedNodeIds)
    let changed = true
    while (changed) {
      changed = false
      nodes.forEach((node) => {
        if (node.parentId && includedIds.has(node.parentId) && !includedIds.has(node.id)) {
          includedIds.add(node.id)
          changed = true
        }
      })
    }
    return nodes.filter((node) => includedIds.has(node.id))
  }

  const saveSelectedNodesToAssets = () => {
    const selectedNodes = getSelectedNodesWithGroupChildren()
    if (!selectedNodes.length) {
      setToastMessage('请先框选要加入资产库的节点')
      return
    }
    const selectedIds = new Set(selectedNodes.map((node) => node.id))
    const selectedEdges = edges.filter((edge) => selectedIds.has(edge.source) && selectedIds.has(edge.target))
    const groupTitle = selectedGroupNode?.data.title || `组合资产 · ${selectedNodes.filter((node) => node.data.kind !== 'group').length} 个节点`
    const asset: SavedAsset = {
      id: `asset-group-${Date.now()}`,
      savedAt: new Date().toISOString(),
      type: 'group',
      title: groupTitle,
      folderId: null,
      nodes: selectedNodes.map((node) => ({ ...node, selected: false })),
      edges: selectedEdges.map((edge) => ({ ...edge, selected: false })),
    }

    try {
      const nextAssets = [...savedAssets, asset]
      localStorage.setItem('disy-saved-assets', JSON.stringify(nextAssets))
      setSavedAssets(nextAssets)
      setToastMessage('组合已加入资产库')
    } catch {
      setToastMessage('资产保存失败，本机存储空间可能不足')
    }
  }

  const downloadSelectedImages = async (nodeOverride?: CanvasNode[]) => {
    const imageNodes = (nodeOverride ?? getSelectedNodesWithGroupChildren())
      .filter((node) => Boolean(node.data.imageUrl))
    if (!imageNodes.length) {
      setToastMessage('选区中没有可下载的图片')
      return
    }

    const safeFileName = (node: CanvasNode, index: number) => {
      const original = node.data.fileName || `${node.data.title || 'disy-image'}-${index + 1}.png`
      const cleaned = original.replace(/[\\/:*?"<>|]/g, '-').trim() || `disy-image-${index + 1}.png`
      return /\.[a-z0-9]{2,5}$/i.test(cleaned) ? cleaned : `${cleaned}.png`
    }
    const pickerWindow = window as FilePickerWindow

    try {
      if (imageNodes.length === 1 && pickerWindow.showSaveFilePicker) {
        const fileName = safeFileName(imageNodes[0], 0)
        const handle = await pickerWindow.showSaveFilePicker({
          suggestedName: fileName,
          types: [{ description: '图片文件', accept: { 'image/*': ['.png', '.jpg', '.jpeg', '.webp'] } }],
        })
        const blob = await fetch(imageNodes[0].data.imageUrl!).then((response) => response.blob())
        const writable = await handle.createWritable()
        await writable.write(blob)
        await writable.close()
      } else if (imageNodes.length > 1 && pickerWindow.showDirectoryPicker) {
        const directory = await pickerWindow.showDirectoryPicker()
        for (let index = 0; index < imageNodes.length; index += 1) {
          const node = imageNodes[index]
          const handle = await directory.getFileHandle(safeFileName(node, index), { create: true })
          const blob = await fetch(node.data.imageUrl!).then((response) => response.blob())
          const writable = await handle.createWritable()
          await writable.write(blob)
          await writable.close()
        }
      } else {
        imageNodes.forEach((node, index) => {
          const anchor = document.createElement('a')
          anchor.href = node.data.imageUrl!
          anchor.download = safeFileName(node, index)
          anchor.click()
        })
      }
      setToastMessage(`已下载 ${imageNodes.length} 张图片`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return
      setToastMessage('下载失败，请检查浏览器文件保存权限')
    }
  }

  const downloadImageUrl = async (imageUrl: string, fileName: string) => {
    const node: CanvasNode = {
      id: 'download-only',
      type: 'disy',
      position: { x: 0, y: 0 },
      data: { kind: 'upload', title: fileName, body: '', imageUrl, fileName },
    }
    await downloadSelectedImages([node])
  }

  const downloadAsset = async (asset: SavedAsset) => {
    if (asset.nodes?.some((node) => node.data.imageUrl)) {
      await downloadSelectedImages(asset.nodes)
      return
    }
    const imageUrl = getAssetPreviewUrl(asset)
    if (imageUrl) await downloadImageUrl(imageUrl, asset.title || asset.data?.fileName || 'disy-asset.png')
  }

  const persistAssetFolders = (folders: AssetFolder[]) => {
    localStorage.setItem(ASSET_FOLDERS_KEY, JSON.stringify(folders))
    setAssetFolders(folders)
  }

  const createAssetFolder = () => {
    const name = newFolderName.trim()
    if (!name) return
    if (assetFolders.some((folder) => folder.name.toLowerCase() === name.toLowerCase())) {
      setToastMessage('已存在同名文件夹')
      return
    }
    const folder: AssetFolder = { id: `folder-${Date.now()}`, name }
    persistAssetFolders([...assetFolders, folder])
    setActiveAssetFolderId(folder.id)
    setNewFolderName('')
    setCreatingFolder(false)
  }

  const uploadAssets = (files: FileList | File[]) => {
    const imageFiles = Array.from(files).filter((file) => file.type.startsWith('image/'))
    if (!imageFiles.length) return
    const targetFolder = assetFolders.some((folder) => folder.id === activeAssetFolderId)
      ? activeAssetFolderId
      : null
    Promise.all(imageFiles.map((file) => new Promise<SavedAsset>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve({
        id: `asset-upload-${Date.now()}-${crypto.randomUUID()}`,
        savedAt: new Date().toISOString(),
        type: 'node',
        title: file.name,
        folderId: targetFolder,
        data: {
          kind: 'upload',
          title: file.name,
          body: '',
          imageUrl: String(reader.result),
          fileName: file.name,
        },
      })
      reader.onerror = reject
      reader.readAsDataURL(file)
    }))).then((uploadedAssets) => {
      const nextAssets = [...savedAssets, ...uploadedAssets]
      localStorage.setItem('disy-saved-assets', JSON.stringify(nextAssets))
      setSavedAssets(nextAssets)
      setToastMessage(`已上传 ${uploadedAssets.length} 个资产`)
    }).catch(() => setToastMessage('资产上传失败，本机存储空间可能不足'))
  }

  const deleteAsset = (assetId: string) => {
    const nextAssets = savedAssets.filter((asset) => asset.id !== assetId)
    localStorage.setItem('disy-saved-assets', JSON.stringify(nextAssets))
    setSavedAssets(nextAssets)
    if (selectedAssetId === assetId) setSelectedAssetId(null)
    setSelectedAssetIds((current) => current.filter((id) => id !== assetId))
    if (libraryPreview?.kind === 'asset' && libraryPreview.id === assetId) setLibraryPreview(null)
    setToastMessage('资产已删除')
  }

  const downloadAssetBatch = async (assetIds: string[]) => {
    const imageNodes = assetIds.flatMap((assetId, assetIndex) => {
      const asset = savedAssets.find((item) => item.id === assetId)
      if (!asset) return []
      const nestedImages = asset.nodes?.filter((node) => Boolean(node.data.imageUrl)) ?? []
      if (nestedImages.length) return nestedImages
      const imageUrl = getAssetPreviewUrl(asset)
      if (!imageUrl) return []
      return [{
        id: `asset-download-${asset.id}`,
        type: 'disy' as const,
        position: { x: 0, y: 0 },
        data: {
          kind: 'upload' as const,
          title: asset.title || `asset-${assetIndex + 1}`,
          body: '',
          imageUrl,
          fileName: asset.title || asset.data?.fileName || `disy-asset-${assetIndex + 1}.png`,
        },
      }]
    })
    if (!imageNodes.length) {
      setToastMessage('选中的资产中没有可下载图片')
      return
    }
    await downloadSelectedImages(imageNodes)
  }

  const downloadHistoryBatch = async (recordIds: string[]) => {
    const imageNodes: CanvasNode[] = recordIds.flatMap((recordId) => {
      const record = generationHistory.find((item) => item.id === recordId)
      return record ? [{
        id: `history-download-${record.id}`,
        type: 'disy',
        position: { x: 0, y: 0 },
        data: { kind: 'image', title: record.fileName, body: record.prompt, imageUrl: record.imageUrl, fileName: record.fileName },
      }] : []
    })
    if (imageNodes.length) await downloadSelectedImages(imageNodes)
  }

  const deleteAssetBatch = (assetIds: string[]) => {
    const idSet = new Set(assetIds)
    const nextAssets = savedAssets.filter((asset) => !idSet.has(asset.id))
    localStorage.setItem('disy-saved-assets', JSON.stringify(nextAssets))
    setSavedAssets(nextAssets)
    setSelectedAssetIds([])
    if (selectedAssetId && idSet.has(selectedAssetId)) setSelectedAssetId(null)
    if (libraryPreview?.kind === 'asset' && idSet.has(libraryPreview.id)) setLibraryPreview(null)
    setToastMessage(`已删除 ${assetIds.length} 个资产`)
  }

  const moveAssetToFolder = (assetId: string, folderId: string | null) => {
    const nextAssets = savedAssets.map((asset) => asset.id === assetId ? { ...asset, folderId } : asset)
    localStorage.setItem('disy-saved-assets', JSON.stringify(nextAssets))
    setSavedAssets(nextAssets)
    setToastMessage(folderId ? '资产已移动到文件夹' : '资产已移至未归档')
  }

  const placeAssetOnCanvas = (assetId: string, position: { x: number; y: number }) => {
    const asset = savedAssets.find((item) => item.id === assetId)
    if (!asset) return
    const stamp = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`

    if (asset.data) {
      const defaultStyle = asset.data.kind === 'text'
        ? { width: 420, height: 240 }
        : asset.data.kind === 'image'
          ? getImageGenerationNodeSize(asset.data.imageAspectRatio ?? '1:1')
          : undefined
      const node: CanvasNode = {
        id: `asset-node-${stamp}`,
        type: 'disy',
        position,
        data: { ...asset.data },
        style: asset.style ? { ...defaultStyle, ...asset.style } : defaultStyle,
      }
      setNodes((current) => [...current, node])
      setToastMessage('资产已放入画布')
      return
    }

    if (!asset.nodes?.length) return
    const idMap = new Map(asset.nodes.map((node, index) => [node.id, `asset-${stamp}-${index}`]))
    const rootNodes = asset.nodes.filter((node) => !node.parentId)
    const minX = Math.min(...rootNodes.map((node) => node.position.x))
    const minY = Math.min(...rootNodes.map((node) => node.position.y))
    const restoredNodes: CanvasNode[] = asset.nodes.map((node) => ({
      ...node,
      id: idMap.get(node.id)!,
      parentId: node.parentId ? idMap.get(node.parentId) : undefined,
      selected: false,
      position: node.parentId ? { ...node.position } : {
        x: position.x + node.position.x - minX,
        y: position.y + node.position.y - minY,
      },
      data: { ...node.data },
      style: node.style ? { ...node.style } : undefined,
    }))
    const restoredEdges = (asset.edges ?? []).map((edge, index) => ({
      ...edge,
      id: `asset-edge-${stamp}-${index}`,
      source: idMap.get(edge.source) ?? edge.source,
      target: idMap.get(edge.target) ?? edge.target,
      selected: false,
    }))
    setNodes((current) => [...current, ...restoredNodes])
    setEdges((current) => [...current, ...restoredEdges])
    setToastMessage('组合资产已放入画布')
  }

  const deleteGenerationRecord = (recordId: string) => {
    const nextHistory = generationHistory.filter((record) => record.id !== recordId)
    localStorage.setItem(GENERATION_HISTORY_KEY, JSON.stringify(nextHistory))
    setGenerationHistory(nextHistory)
    setSelectedHistoryIds((current) => current.filter((id) => id !== recordId))
    if (libraryPreview?.kind === 'history' && libraryPreview.id === recordId) setLibraryPreview(null)
    setToastMessage('历史记录已删除')
  }

  const deleteHistoryBatch = (recordIds: string[]) => {
    const idSet = new Set(recordIds)
    const nextHistory = generationHistory.filter((record) => !idSet.has(record.id))
    localStorage.setItem(GENERATION_HISTORY_KEY, JSON.stringify(nextHistory))
    setGenerationHistory(nextHistory)
    setSelectedHistoryIds([])
    if (libraryPreview?.kind === 'history' && idSet.has(libraryPreview.id)) setLibraryPreview(null)
    setToastMessage(`已删除 ${recordIds.length} 条历史记录`)
  }

  const filteredAssets = savedAssets.filter((asset) => {
    if (activeAssetFolderId === 'unfiled' && asset.folderId) return false
    if (activeAssetFolderId !== 'all' && activeAssetFolderId !== 'unfiled' && asset.folderId !== activeAssetFolderId) return false
    const query = assetSearch.trim().toLowerCase()
    if (!query) return true
    const searchable = [asset.title, asset.data?.title, asset.data?.fileName, asset.data?.body]
      .filter(Boolean)
      .join(' ')
      .toLowerCase()
    return searchable.includes(query)
  })
  const groupedAssets = Array.from(filteredAssets.reduce((groups, asset) => {
    const date = new Date(asset.savedAt)
    const key = Number.isNaN(date.getTime())
      ? '未知日期'
      : date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-')
    const current = groups.get(key) ?? []
    current.push(asset)
    groups.set(key, current)
    return groups
  }, new Map<string, SavedAsset[]>()).entries()).reverse()

  const getAssetPreviewUrl = (asset: SavedAsset) => asset.data?.imageUrl
    || asset.nodes?.find((node) => Boolean(node.data.imageUrl))?.data.imageUrl

  const filteredHistory = generationHistory.filter((record) => {
    const query = generationHistorySearch.trim().toLowerCase()
    return !query || `${record.prompt} ${record.model} ${record.fileName}`.toLowerCase().includes(query)
  })
  const groupedHistory = Array.from(filteredHistory.reduce((groups, record) => {
    const date = new Date(record.createdAt)
    const key = Number.isNaN(date.getTime())
      ? '未知日期'
      : date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-')
    const current = groups.get(key) ?? []
    current.push(record)
    groups.set(key, current)
    return groups
  }, new Map<string, GenerationRecord[]>()).entries()).reverse()
  const outputFailureCount = outputHistory.filter((record) => record.status === 'failed').length
  const filteredOutputHistory = outputHistory.filter((record) => {
    if (outputHistoryFilter === 'failed' && record.status !== 'failed') return false
    if (outputHistoryFilter === 'text' && record.kind !== 'text') return false
    if (outputHistoryFilter === 'image' && record.kind !== 'image') return false
    const query = outputHistorySearch.trim().toLowerCase()
    if (!query) return true
    return `${record.prompt} ${record.modelName} ${record.modelId} ${record.error?.summary ?? ''} ${record.error?.detail ?? ''}`.toLowerCase().includes(query)
  })

  const assetPreviewItems = groupedAssets.flatMap(([, assets]) => assets).flatMap((asset) => {
    const url = getAssetPreviewUrl(asset)
    return url ? [{
      id: asset.id,
      url,
      alt: asset.title || asset.data?.fileName || '资产预览',
      fileName: asset.title || asset.data?.fileName || 'disy-asset.png',
    }] : []
  })
  const historyPreviewItems = groupedHistory.flatMap(([, records]) => records).map((record) => ({
    id: record.id,
    url: record.imageUrl,
    alt: record.fileName || record.prompt || '生成图片预览',
    fileName: record.fileName,
  }))
  const libraryPreviewItems = libraryPreview?.kind === 'asset' ? assetPreviewItems : historyPreviewItems
  const libraryPreviewIndex = libraryPreview
    ? libraryPreviewItems.findIndex((item) => item.id === libraryPreview.id)
    : -1
  const activeLibraryPreview = libraryPreviewIndex >= 0 ? libraryPreviewItems[libraryPreviewIndex] : null

  const moveLibraryPreview = (step: number) => {
    if (!libraryPreview || libraryPreviewItems.length < 2) return
    const currentIndex = libraryPreviewIndex >= 0 ? libraryPreviewIndex : 0
    const nextIndex = (currentIndex + step + libraryPreviewItems.length) % libraryPreviewItems.length
    setLibraryPreviewDirection(step > 0 ? 1 : -1)
    setLibraryPreview({ ...libraryPreview, id: libraryPreviewItems[nextIndex].id })
  }

  useEffect(() => {
    if (!libraryPreview) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setLibraryPreview(null)
      if (event.key === 'ArrowLeft') moveLibraryPreview(-1)
      if (event.key === 'ArrowRight') moveLibraryPreview(1)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [libraryPreview, libraryPreviewIndex, libraryPreviewItems.length])

  const onLibraryGalleryWheel = (event: React.WheelEvent) => {
    event.preventDefault()
    if (galleryWheelLockRef.current || Math.max(Math.abs(event.deltaX), Math.abs(event.deltaY)) < 8) return
    galleryWheelLockRef.current = true
    moveLibraryPreview((Math.abs(event.deltaX) > Math.abs(event.deltaY) ? event.deltaX : event.deltaY) > 0 ? 1 : -1)
    window.setTimeout(() => { galleryWheelLockRef.current = false }, 260)
  }

  return (
    <div ref={shellRef} className="disy-shell">
      <main className="canvas-area">
        <ImagePreviewOpenContext.Provider value={openNodeImagePreview}>
          <ImageGalleryOpenContext.Provider value={setImageGalleryNodeId}>
            <NodeTextUpdateContext.Provider value={updateNodeBody}>
          <ReactFlow
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onConnectEnd={onConnectEnd}
          onSelectionChange={handleSelectionChange}
          onSelectionStart={handleSelectionStart}
          onSelectionEnd={handleSelectionEnd}
          connectionLineType={ConnectionLineType.Bezier}
          onNodeClick={(_, node) => {
            if (canvasReferencePickerNodeId) {
              if (node.id === canvasReferencePickerNodeId) {
                setToastMessage('请选择画布中的其他图片')
                return
              }
              if ((node.data.kind !== 'upload' && node.data.kind !== 'image') || !node.data.imageUrl) {
                setToastMessage('请选择已经上传或生成完成的图片')
                return
              }
              setEdges((current) => {
                if (current.some((edge) => edge.source === node.id && edge.target === canvasReferencePickerNodeId)) return current
                return [...current, {
                  id: `reference-${node.id}-${canvasReferencePickerNodeId}-${crypto.randomUUID()}`,
                  source: node.id,
                  target: canvasReferencePickerNodeId,
                  type: 'luminous',
                  data: { referenceSelected: true },
                }]
              })
              setToastMessage('已加入参考图片，可继续选择')
              return
            }
            setMarqueeSelectionCommitted(false)
            closeAllMenus()
            setModelMenuOpen(false)
            setImageModelMenuOpen(false)
            setImageParameterMenuOpen(false)
            setImageMentionOpen(false)
            setQuantityMenuOpen(false)
            setExpandedEditorNodeId(null)
            setIsNodeDragging(false)
            setActiveEditorNodeId(node.data.kind === 'text' ? node.id : null)
            setActiveImageNodeId(node.data.kind === 'upload' && node.data.imageUrl ? node.id : null)
            setActiveGenerationNodeId(node.data.kind === 'image' ? node.id : null)
            window.requestAnimationFrame(() => measureNodeOverlay(node.id))
          }}
          onNodeDragStart={(_, node) => {
            setIsNodeDragging(true)
          }}
          onNodeDragStop={(_, node) => {
            setIsNodeDragging(false)
            if (node.id === activeEditorNodeId || node.id === activeImageNodeId || node.id === activeGenerationNodeId) measureNodeOverlay(node.id)
          }}
          onNodeContextMenu={openNodeContextMenu}
          onPaneContextMenu={openNodeMenu}
          onDoubleClick={(event) => {
            const target = event.target as HTMLElement
            if (!target.classList.contains('react-flow__pane')) return
            event.preventDefault()
            openNodeMenu(event)
          }}
          onDragOver={(event) => {
            if (event.dataTransfer.types.includes('application/x-disy-asset') || Array.from(event.dataTransfer.items).some((item) => item.kind === 'file')) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }
          }}
          onDrop={(event) => {
            const assetId = event.dataTransfer.getData('application/x-disy-asset')
            if (assetId) {
              event.preventDefault()
              closeAllMenus()
              const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
              placeAssetOnCanvas(assetId, { x: flowPosition.x - 130, y: flowPosition.y - 110 })
              return
            }
            const imageFiles = Array.from(event.dataTransfer.files).filter((file) => file.type.startsWith('image/'))
            if (!imageFiles.length) return
            event.preventDefault()
            closeAllMenus()
            const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
            void addImageFiles(imageFiles, { x: flowPosition.x - 130, y: flowPosition.y - 110 })
          }}
          onPaneClick={(event) => {
            if (canvasReferencePickerNodeId) {
              setCanvasReferencePickerNodeId(null)
              return
            }
            setMarqueeSelectionCommitted(false)
            closeAllMenus()
            setModelMenuOpen(false)
            setImageModelMenuOpen(false)
            setImageParameterMenuOpen(false)
            setImageMentionOpen(false)
            setQuantityMenuOpen(false)
            setActiveEditorNodeId(null)
            setActiveImageNodeId(null)
            setActiveGenerationNodeId(null)
            setExpandedEditorNodeId(null)
          }}
          onMove={(_, viewport) => {
            setCanvasZoom((current) =>
              Math.abs(current - viewport.zoom) > 0.002 ? viewport.zoom : current,
            )
            const activeOverlayNodeId = activeImageNodeId ?? activeGenerationNodeId ?? activeEditorNodeId
            if (activeOverlayNodeId && !isNodeDragging) measureNodeOverlay(activeOverlayNodeId)
          }}
          zoomOnDoubleClick={false}
          zoomOnScroll={false}
          zoomActivationKeyCode="Control"
          panOnScroll
          panOnScrollMode={PanOnScrollMode.Vertical}
          selectionOnDrag
          panOnDrag={[1]}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.2 }}
          colorMode="dark"
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{
            type: 'luminous',
          }}
        >
          {showGrid && (
            <Background variant={BackgroundVariant.Dots} gap={24} size={1} color="var(--canvas-dot)" />
          )}
          <MiniMap
            className="disy-minimap"
            nodeColor="var(--minimap-node)"
            nodeStrokeColor="transparent"
            nodeStrokeWidth={0}
            nodeBorderRadius={2}
            maskColor="var(--minimap-mask)"
            pannable
            zoomable
            ariaLabel="画布小地图，可拖拽导航"
          />
          </ReactFlow>
            </NodeTextUpdateContext.Provider>
          </ImageGalleryOpenContext.Provider>
        </ImagePreviewOpenContext.Provider>

        <AnimatePresence>
          {canvasReferencePickerNodeId && (
            <motion.div
              className="canvas-reference-picker-pill nodrag nowheel"
              role="status"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <Focus size={14} />
              <strong>从画布选择参考</strong>
              <span />
              <button type="button" onClick={() => setCanvasReferencePickerNodeId(null)}>退出</button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {selectionToolbarAllowed && selectionToolbarRect && selectedNodeIds.length > 0 && (
            <motion.div
              className="selection-action-toolbar"
              style={{ left: selectionToolbarRect.left, top: selectionToolbarRect.top }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {selectedGroupNode ? (
                <>
                  <div className="group-color-control">
                    <button
                      type="button"
                      aria-label="选择分组背景颜色"
                      title="背景颜色"
                      onClick={() => setGroupColorMenuOpen((open) => !open)}
                    >
                      <span
                        className="group-color-swatch"
                        style={{ background: selectedGroupNode.data.groupColor || 'rgba(72, 76, 73, .2)' }}
                      />
                      <span>背景</span>
                    </button>
                    <AnimatePresence>
                      {groupColorMenuOpen && (
                        <motion.div
                          className="group-color-palette"
                          initial={{ opacity: 0, y: 5, scale: 0.94 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.95 }}
                        >
                          {[
                            { label: '无背景', color: 'transparent' },
                            { label: '红色', color: 'rgba(174, 75, 79, .32)' },
                            { label: '橙色', color: 'rgba(170, 94, 29, .32)' },
                            { label: '黄色', color: 'rgba(166, 143, 48, .30)' },
                            { label: '绿色', color: 'rgba(58, 126, 72, .32)' },
                          ].map((option) => (
                            <button
                              key={option.label}
                              type="button"
                              aria-label={option.label}
                              title={option.label}
                              className={option.color === 'transparent' ? 'is-transparent' : ''}
                              style={{ background: option.color }}
                              onClick={() => setSelectedGroupColor(option.color)}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button type="button" onClick={arrangeSelectedGroupAsGrid}>
                    <Grid3X3 size={15} /><span>宫格布局</span>
                  </button>
                  <button type="button" disabled title="下一阶段开放">
                    <PanelsTopLeft size={15} /><span>创建模板</span>
                  </button>
                  <button type="button" onClick={saveSelectedNodesToAssets}>
                    <Library size={15} /><span>加入资产库</span>
                  </button>
                  <span className="selection-toolbar-divider" />
                  <button type="button" onClick={ungroupSelectedNode}>
                    <Unlink2 size={15} /><span>解组</span>
                  </button>
                  <button type="button" aria-label="整组下载" title="整组下载" onClick={() => void downloadSelectedImages()}>
                    <Download size={15} />
                  </button>
                </>
              ) : (
                <>
                  <button type="button" disabled title="下一阶段开放">
                    <MessageCircle size={15} /><span>加入对话</span>
                  </button>
                  <button type="button" onClick={groupSelectedNodes}>
                    <Box size={15} /><span>打组</span>
                  </button>
                  <button type="button" aria-label="下载选中图片" title="下载" onClick={() => void downloadSelectedImages()}>
                    <Download size={15} /><span>下载</span>
                  </button>
                  <button type="button" onClick={saveSelectedNodesToAssets}>
                    <Library size={15} /><span>加入资产库</span>
                  </button>
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {nodes.length === 0 && (
          <motion.section
            className="empty-canvas-state"
            aria-label="空画布快捷操作"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="empty-canvas-heading">
              <button onClick={openCenteredNodeMenu}>
                <Sparkles size={14} />
                双击
              </button>
              <span>无限自由想象，世界由你创造</span>
            </div>
            <div className="empty-canvas-actions">
              <button onClick={() => createNodeFromEmptyState('text')}>
                <Type size={15} />
                文本提示词
              </button>
              <button onClick={() => createNodeFromEmptyState('image')}>
                <WandSparkles size={15} />
                图像生成
              </button>
              <button onClick={() => createNodeFromEmptyState('upload')}>
                <Upload size={15} />
                上传参考图
              </button>
            </div>
          </motion.section>
        )}

        <input
          ref={imageInputRef}
          className="image-file-input"
          type="file"
          accept="image/*"
          multiple
          aria-label="选择要上传的参考图片"
          onChange={(event) => {
            const files = event.target.files
            const position = uploadPositionRef.current
            if (files?.length && position) void addImageFiles(files, position)
            event.target.value = ''
            uploadPositionRef.current = null
          }}
        />
        <input
          ref={assetUploadInputRef}
          className="image-file-input"
          type="file"
          accept="image/*"
          multiple
          aria-label="上传图片到资产库"
          onChange={(event) => {
            if (event.target.files?.length) uploadAssets(event.target.files)
            event.target.value = ''
          }}
        />
        <input
          ref={generationReferenceInputRef}
          className="image-file-input"
          type="file"
          accept="image/*"
          multiple
          aria-label="为图像生成节点上传参考图片"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
            const nodeId = generationReferenceNodeIdRef.current
            if (files.length && nodeId) {
              void Promise.all(files.map((file) => new Promise<ImageReference>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => resolve({
                  id: `manual-${crypto.randomUUID()}`,
                  name: file.name,
                  url: String(reader.result),
                })
                reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
                reader.readAsDataURL(file)
              }))).then((references) => {
                setNodes((current) => current.map((node) => node.id === nodeId ? {
                  ...node,
                  data: {
                    ...node.data,
                    referenceImages: [...(node.data.referenceImages ?? []), ...references],
                  },
                } : node))
                setToastMessage(`已添加 ${references.length} 张参考图`)
              }).catch(() => setToastMessage('图片读取失败'))
            }
            event.target.value = ''
            generationReferenceNodeIdRef.current = null
          }}
        />

        <div className="canvas-navigation" aria-label="画布导航和缩放">
          <button
            className={showGrid ? 'is-active' : ''}
            aria-label={showGrid ? '隐藏网格' : '显示网格'}
            aria-pressed={showGrid}
            onClick={() => setShowGrid((visible) => !visible)}
          >
            <Grid3X3 size={16} />
          </button>
          <button aria-label="适应全部节点" onClick={() => void fitCanvas({ duration: reduceMotion ? 0 : 220, padding: 0.2 })}>
            <Focus size={17} />
          </button>
          <div className="zoom-slider-wrap" data-tooltip="放大/缩小画布">
            <input
              type="range"
              min="0.25"
              max="2"
              step="0.01"
              value={canvasZoom}
              aria-label={`画布缩放 ${Math.round(canvasZoom * 100)}%`}
              style={{ '--zoom-progress': `${((canvasZoom - 0.25) / 1.75) * 100}%` } as React.CSSProperties}
              onChange={(event) => changeCanvasZoom(Number(event.target.value))}
              onWheel={(event) => {
                event.preventDefault()
                changeCanvasZoom(canvasZoom + (event.deltaY < 0 ? 0.08 : -0.08))
              }}
            />
          </div>
        </div>

        <button
          type="button"
          className={`output-history-pill ${outputFailureCount ? 'has-failures' : ''}`}
          onClick={() => setOutputHistoryOpen(true)}
          aria-label={`打开输出历史，共 ${outputHistory.length} 条`}
        >
          {generationLoading ? <LoaderCircle size={14} className="is-spinning" /> : <History size={14} />}
          <span>{generationLoading ? '正在生成' : '输出历史'}</span>
          <small>{outputHistory.length}</small>
          {outputFailureCount > 0 && <em>{outputFailureCount} 项失败</em>}
        </button>

        <div className="floating-chrome top-left-cluster canvas-identity-cluster">
          <button className="brand-chip brand-only" aria-label="打开项目" onClick={() => setProjectOpen(true)}>
            <img className="brand-logo" src="/disy-logo.png" alt="" />
          </button>
          <span className="cluster-divider" />
          {canvasNameEditing ? (
            <input
              ref={canvasNameInputRef}
              className="canvas-name-input"
              value={canvasNameDraft}
              maxLength={48}
              aria-label="编辑画布名称"
              onChange={(event) => setCanvasNameDraft(event.target.value)}
              onBlur={commitCanvasName}
              onKeyDown={(event) => {
                if (event.key === 'Enter') event.currentTarget.blur()
                if (event.key === 'Escape') {
                  setCanvasNameDraft(canvasName)
                  event.currentTarget.blur()
                }
              }}
            />
          ) : (
            <button
              className="canvas-name-display"
              title="双击编辑画布名称"
              onDoubleClick={() => {
                setCanvasNameDraft(canvasName)
                setCanvasNameEditing(true)
              }}
            >
              {canvasName}
            </button>
          )}
          <button
            className={`canvas-settings-button ${projectSettingsOpen ? 'is-active' : ''}`}
            aria-label="项目设置"
            title="项目设置"
            onClick={() => setProjectSettingsOpen((open) => !open)}
          >
            <Settings2 size={15} />
          </button>
          <span className="cluster-divider" />
          <button
            className={`canvas-save-status ${canvasSaved ? 'is-saved' : 'is-unsaved'}`}
            aria-label={canvasSaved ? '已保存' : '未保存，点击保存'}
            title={canvasSaved ? '已保存' : '未保存，点击保存'}
            onClick={() => void saveCanvasState()}
          >
            {canvasSaved ? <Check size={13} /> : <span className="unsaved-dot" />}
          </button>
        </div>

        <AnimatePresence>
          {projectSettingsOpen && (
            <>
              <button
                className="project-settings-scrim"
                aria-label="关闭项目设置"
                onClick={() => setProjectSettingsOpen(false)}
              />
              <motion.section
                className="project-settings-popover"
                initial={{ opacity: 0, y: -5, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -4, scale: 0.98 }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <header className="project-settings-header">
                  <div>
                    <strong>项目设置</strong>
                    <small>{canvasName}</small>
                  </div>
                  <button
                    className={projectSettingsLocked ? 'is-locked' : ''}
                    aria-label={projectSettingsLocked ? '解除锁定' : '锁定项目设置'}
                    title={projectSettingsLocked ? '解除锁定' : '锁定项目设置'}
                    onClick={() => setProjectSettingsLocked((locked) => !locked)}
                  >
                    {projectSettingsLocked ? <Lock size={14} /> : <Unlock size={14} />}
                    <span>{projectSettingsLocked ? '已锁定' : '锁定'}</span>
                  </button>
                </header>

                <div className="settings-style-reference">
                  <div className="style-reference-heading">
                    <div>
                      <strong>风格母图</strong>
                      <p>上传卡通或电影截图等，本项目所有图像生成会自动参考此风格。</p>
                    </div>
                    {styleReferenceUrl && (
                      <button
                        type="button"
                        role="switch"
                        aria-checked={styleReferenceEnabled}
                        className={`style-reference-switch ${styleReferenceEnabled ? 'is-on' : ''}`}
                        disabled={projectSettingsLocked}
                        onClick={() => setStyleReferenceEnabled((enabled) => !enabled)}
                      >
                        <span>启用</span>
                        <i />
                      </button>
                    )}
                  </div>

                  {styleReferenceUrl ? (
                    <div className={`style-reference-preview ${styleReferenceEnabled ? '' : 'is-disabled'}`}>
                      <img src={styleReferenceUrl} alt="项目风格母图" draggable={false} />
                      <div className="style-reference-meta">
                        <strong title={styleReferenceName}>{styleReferenceName}</strong>
                        <small>
                          {!styleReferenceEnabled
                            ? '已停用 · 不参与生成'
                            : projectSettingsLocked
                              ? '已锁定 · 生图时自动参考'
                              : '已启用 · 锁定项目后生效'}
                        </small>
                        <div>
                          <button
                            type="button"
                            disabled={projectSettingsLocked}
                            onClick={() => styleReferenceInputRef.current?.click()}
                          >
                            更换
                          </button>
                          <button
                            type="button"
                            className="is-danger"
                            disabled={projectSettingsLocked}
                            onClick={() => {
                              setStyleReferenceName('')
                              setStyleReferenceUrl('')
                              setStyleReferenceEnabled(true)
                            }}
                          >
                            清除
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      className="style-reference-upload"
                      disabled={projectSettingsLocked}
                      onClick={() => styleReferenceInputRef.current?.click()}
                    >
                      <ImagePlus size={16} />
                      上传风格母图
                    </button>
                  )}
                </div>
              </motion.section>
            </>
          )}
        </AnimatePresence>

        <input
          ref={styleReferenceInputRef}
          className="image-file-input"
          type="file"
          accept="image/*"
          aria-label="上传项目风格母图"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) {
              const reader = new FileReader()
              reader.onload = () => {
                if (typeof reader.result !== 'string') return
                setStyleReferenceName(file.name)
                setStyleReferenceUrl(reader.result)
                setStyleReferenceEnabled(true)
              }
              reader.onerror = () => setToastMessage('母图读取失败，请重新选择')
              reader.readAsDataURL(file)
            }
            event.target.value = ''
          }}
        />

        <div className="floating-chrome top-right-cluster">
          <button
            ref={apiButtonRef}
            className={`api-chip ${apiConfigured ? 'configured' : ''}`}
            onClick={() => setApiOpen(true)}
          >
            <KeyRound size={15} />
            {apiConfigured ? 'API 已配置' : '配置 API'}
          </button>
        </div>

        <nav className="floating-chrome tool-rail" aria-label="画布工具">
          <button
            className="rail-primary"
            aria-label="添加"
            data-tooltip="添加"
            onClick={openNodeMenuFromButton}
          >
            <Plus size={22} />
            <span className="rail-status-dot" />
          </button>
          <button
            aria-label="画布/项目"
            data-tooltip="画布/项目"
            onClick={() => setProjectOpen(true)}
          >
            <PanelsTopLeft size={18} />
          </button>
          <button
            aria-label="搜索节点"
            data-tooltip="搜索节点"
            onClick={() => setToastMessage('节点搜索将在下一阶段开放')}
          >
            <Search size={18} />
          </button>
          <button
            aria-label="资产库"
            data-tooltip={`资产库 · ${savedAssets.length}`}
            onClick={() => {
              setAssetLibraryOpen(true)
              setSelectedAssetId(null)
            }}
          >
            <Library size={18} />
          </button>
          <button
            aria-label="生成历史"
            data-tooltip="生成历史"
            onClick={() => setGenerationHistoryOpen(true)}
          >
            <History size={18} />
          </button>
          <span className="rail-divider" />
          <button aria-label="设置" data-tooltip="设置" onClick={() => setApiOpen(true)}>
            <Settings2 size={18} />
          </button>
          <button className="rail-avatar" aria-label="Disy" data-tooltip="Disy">
            <img src="/disy-logo.png" alt="" />
          </button>
        </nav>

        {nodeMenu && (
          <motion.div
            role="menu"
            aria-label={nodeMenu.connectionSourceId ? '选择要连接的新节点' : '添加节点'}
            className="node-menu"
            style={{ left: nodeMenu.x, top: nodeMenu.y }}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
          >
            <div className="menu-title">
              {nodeMenu.connectionSourceId ? '连接到新节点' : '添加到画布'}
            </div>
            {!nodeMenu.connectionSourceId && (
              <button onClick={() => createNode('text')}>
                <Type size={16} />
                <span><strong>文本</strong><small>记录灵感与提示词</small></span>
              </button>
            )}
            <button onClick={() => createNode('image')}>
              <WandSparkles size={16} />
              <span><strong>图像</strong><small>文生图 / 图生图</small></span>
            </button>
            {!nodeMenu.connectionSourceId && (
              <button onClick={() => openImagePicker({ x: nodeMenu.flowX - 130, y: nodeMenu.flowY - 110 })}>
                <FileImage size={16} />
                <span><strong>上传</strong><small>加入参考素材</small></span>
              </button>
            )}
          </motion.div>
        )}

        {nodeContextMenu && (
          <motion.div
            role="menu"
            aria-label="节点操作"
            className="node-context-menu"
            style={{ left: nodeContextMenu.x, top: nodeContextMenu.y }}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            <button className="context-primary" onClick={saveContextNodeToAssets}>
              <span>加入资产库</span>
            </button>
            <div className="context-divider" />
            <button onClick={copyContextNode}>
              <span>复制</span><kbd>Ctrl C</kbd>
            </button>
            <button disabled={!nodeClipboard} onClick={pasteContextNode}>
              <span>粘贴</span><kbd>Ctrl V</kbd>
            </button>
            <div className="context-divider" />
            <button className="context-danger" onClick={deleteContextNode}>
              <span>删除</span><kbd>Delete</kbd>
            </button>
          </motion.div>
        )}

        <AnimatePresence>
          {activeImageNode && nodeOverlayRect && !isNodeDragging && !previewImageNode && (
            <motion.div
              className="node-quick-toolbar image-node-quick-toolbar nodrag nowheel"
              style={{
                left: Math.min(window.innerWidth - 150, Math.max(150, nodeOverlayRect.left + nodeOverlayRect.width / 2)),
                top: nodeOverlayRect.top - 10,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button type="button" onClick={() => openNodeImagePreview(activeImageNode.id)}>
                <Maximize2 size={14} />
                <span>放大查看</span>
              </button>
              <span className="quick-toolbar-divider" />
              <button type="button" onClick={() => void downloadSelectedImages([activeImageNode])}>
                <Download size={14} />
                <span>下载</span>
              </button>
              <span className="quick-toolbar-divider" />
              <button type="button" onClick={() => saveNodeToAssets(activeImageNode)}>
                <Library size={14} />
                <span>加入资产库</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeGenerationNode && nodeOverlayRect && !isNodeDragging && (
            <motion.div
              className={`node-quick-toolbar ${activeGenerationNode.data.imageUrl ? 'image-node-quick-toolbar' : 'image-generation-upload-toolbar'} nodrag nowheel`}
              style={{
                left: nodeCenterX,
                top: nodeOverlayRect.top - 10,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              {activeGenerationNode.data.imageUrl ? (
                <>
                  <button type="button" onClick={() => openNodeImagePreview(activeGenerationNode.id)}>
                    <Maximize2 size={14} />
                    <span>放大查看</span>
                  </button>
                  <span className="quick-toolbar-divider" />
                  <button type="button" onClick={() => void downloadSelectedImages([activeGenerationNode])}>
                    <Download size={14} />
                    <span>下载</span>
                  </button>
                  <span className="quick-toolbar-divider" />
                  <button type="button" onClick={() => saveNodeToAssets(activeGenerationNode)}>
                    <Library size={14} />
                    <span>加入资产库</span>
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    generationReferenceNodeIdRef.current = activeGenerationNode.id
                    generationReferenceInputRef.current?.click()
                  }}
                >
                  <Upload size={14} />
                  <span>{activeGenerationNode.data.referenceImageUrl ? '替换图片' : '上传图片'}</span>
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeTextNode && nodeOverlayRect && !isNodeDragging && !expandedEditorNodeId && (
            <motion.div
              className="node-quick-toolbar nodrag nowheel"
              style={{
                left: Math.min(window.innerWidth - 92, Math.max(92, nodeOverlayRect.left + nodeOverlayRect.width / 2)),
                top: nodeOverlayRect.top - 10,
              }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <button type="button" onClick={() => void copyActiveText()}>
                <Copy size={14} />
                <span>复制全部</span>
              </button>
              <span className="quick-toolbar-divider" />
              <button type="button" onClick={() => setExpandedEditorNodeId(activeTextNode.id)}>
                <Maximize2 size={14} />
                <span>放大</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {previewImage && (
            <motion.div
              className={`image-preview-backdrop ${previewImageItems.length > 1 ? 'has-multiple' : ''}`}
              role="dialog"
              aria-modal="true"
              aria-label="图片预览画廊"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onWheel={onPreviewImageWheel}
              onPointerDown={() => {
                setPreviewImageNodeId(null)
              }}
            >
              <header className="image-preview-toolbar" onPointerDown={(event) => event.stopPropagation()}>
                <span>{safePreviewImageIndex + 1} / {previewImageItems.length}</span>
                <div>
                  <button type="button" aria-label="关闭图片预览" onClick={() => setPreviewImageNodeId(null)}>
                    <X size={21} strokeWidth={1.6} />
                  </button>
                </div>
              </header>

              <div className="image-preview-stage">
                {previewImageItems.length > 1 && (
                  <button type="button" className="image-preview-arrow is-previous" aria-label="上一张" onPointerDown={(event) => event.stopPropagation()} onClick={() => movePreviewImage(-1)}><ChevronLeft size={32} /></button>
                )}
                <AnimatePresence initial={false} mode="wait" custom={previewImageDirection}>
                  <motion.figure
                    key={previewImage.id}
                    className="image-preview-figure"
                    custom={previewImageDirection}
                    initial={{ opacity: 0, x: previewImageDirection * 64, scale: .985 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: previewImageDirection * -48, scale: .99 }}
                    transition={{ duration: .22, ease: [0.22, 1, 0.36, 1] }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <img className="image-preview-content" src={previewImage.url} alt={previewImage.alt} draggable={false} />
                    <figcaption title={previewImage.fileName}>{previewImage.fileName}</figcaption>
                  </motion.figure>
                </AnimatePresence>
                {previewImageItems.length > 1 && (
                  <button type="button" className="image-preview-arrow is-next" aria-label="下一张" onPointerDown={(event) => event.stopPropagation()} onClick={() => movePreviewImage(1)}><ChevronRight size={32} /></button>
                )}
              </div>

              {previewImageItems.length > 1 && (
                <div className="image-preview-filmstrip" onPointerDown={(event) => event.stopPropagation()}>
                  {previewImageItems.map((item, index) => (
                    <button
                      type="button"
                      key={item.id}
                      className={index === safePreviewImageIndex ? 'is-active' : ''}
                      aria-label={`查看第 ${index + 1} 张`}
                      aria-current={index === safePreviewImageIndex ? 'true' : undefined}
                      onClick={() => {
                        setPreviewImageDirection(index > safePreviewImageIndex ? 1 : -1)
                        setPreviewImageIndex(index)
                      }}
                    ><img src={item.url} alt="" draggable={false} /></button>
                  ))}
                </div>
              )}
              {previewImageItems.length > 1 && <span className="image-preview-hint">滚轮或方向键切换</span>}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {libraryPreview && activeLibraryPreview && (
            <motion.div
              className="library-gallery-backdrop"
              role="dialog"
              aria-modal="true"
              aria-label={libraryPreview.kind === 'asset' ? '资产画廊' : '生成历史画廊'}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onWheel={onLibraryGalleryWheel}
              onPointerDown={() => setLibraryPreview(null)}
            >
              <header className="library-gallery-header" onPointerDown={(event) => event.stopPropagation()}>
                <div>
                  <strong>{libraryPreview.kind === 'asset' ? '资产画廊' : '生成历史'}</strong>
                  <span>{libraryPreviewIndex + 1} / {libraryPreviewItems.length}</span>
                </div>
                <div>
                  <button type="button" aria-label="关闭画廊" onClick={() => setLibraryPreview(null)}><X size={20} /></button>
                </div>
              </header>

              <div className="library-gallery-stage">
                {libraryPreviewItems.length > 1 && (
                  <button type="button" className="library-gallery-arrow is-previous" aria-label="上一张" onPointerDown={(event) => event.stopPropagation()} onClick={() => moveLibraryPreview(-1)}><ChevronLeft size={30} /></button>
                )}
                <AnimatePresence initial={false} mode="wait" custom={libraryPreviewDirection}>
                  <motion.figure
                    key={activeLibraryPreview.id}
                    className="library-gallery-figure"
                    custom={libraryPreviewDirection}
                    initial={{ opacity: 0, x: libraryPreviewDirection * 68, scale: .985 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: libraryPreviewDirection * -52, scale: .99 }}
                    transition={{ duration: .22, ease: [0.22, 1, 0.36, 1] }}
                    onPointerDown={(event) => event.stopPropagation()}
                  >
                    <img src={activeLibraryPreview.url} alt={activeLibraryPreview.alt} draggable={false} />
                    <figcaption title={activeLibraryPreview.fileName}>{activeLibraryPreview.fileName}</figcaption>
                  </motion.figure>
                </AnimatePresence>
                {libraryPreviewItems.length > 1 && (
                  <button type="button" className="library-gallery-arrow is-next" aria-label="下一张" onPointerDown={(event) => event.stopPropagation()} onClick={() => moveLibraryPreview(1)}><ChevronRight size={30} /></button>
                )}
              </div>

              <div className="library-gallery-filmstrip" onPointerDown={(event) => event.stopPropagation()}>
                {libraryPreviewItems.map((item, index) => (
                  <button
                    type="button"
                    key={item.id}
                    className={item.id === activeLibraryPreview.id ? 'is-active' : ''}
                    aria-label={`查看第 ${index + 1} 张`}
                    aria-current={item.id === activeLibraryPreview.id ? 'true' : undefined}
                    onClick={() => {
                      setLibraryPreviewDirection(index > libraryPreviewIndex ? 1 : -1)
                      setLibraryPreview({ ...libraryPreview, id: item.id })
                    }}
                  ><img src={item.url} alt="" draggable={false} /></button>
                ))}
              </div>
              <span className="library-gallery-hint">滚轮或方向键切换</span>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {imageGalleryNode && (
            <motion.div
              className="image-variant-gallery-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onPointerDown={() => setImageGalleryNodeId(null)}
            >
              <motion.section
                className="image-variant-gallery"
                role="dialog"
                aria-modal="true"
                aria-label="选择主图"
                initial={{ opacity: 0, y: 18, scale: .975 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: .98 }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <header>
                  <div><Grid3X3 size={15} /><strong>选择主图</strong><span>{imageGalleryNode.data.imageVariants?.length ?? 0} 张</span></div>
                  <button type="button" aria-label="关闭图片选择" onClick={() => setImageGalleryNodeId(null)}><X size={17} /></button>
                </header>
                <div className="image-variant-gallery-grid">
                  {imageGalleryNode.data.imageVariants?.map((variant, index) => {
                    const active = imageGalleryNode.data.activeImageVariantId === variant.id
                      || (!imageGalleryNode.data.activeImageVariantId && imageGalleryNode.data.imageUrl === variant.url)
                    return (
                      <button
                        type="button"
                        key={variant.id}
                        className={active ? 'is-active' : ''}
                        onClick={() => {
                          setNodes((current) => current.map((node) => node.id === imageGalleryNode.id ? {
                            ...node,
                            data: {
                              ...node.data,
                              imageUrl: variant.url,
                              fileName: variant.fileName,
                              body: node.data.kind === 'upload' ? variant.revisedPrompt || node.data.body : node.data.body,
                              activeImageVariantId: variant.id,
                            },
                          } : node))
                          setImageGalleryNodeId(null)
                          setToastMessage(`已将第 ${index + 1} 张设为主图`)
                        }}
                      >
                        <img src={variant.url} alt={`候选图片 ${index + 1}`} draggable={false} />
                        <span className="variant-index">{index + 1}</span>
                        {active && <span className="variant-selected"><Check size={13} />主图</span>}
                      </button>
                    )
                  })}
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeGenerationNode && nodeOverlayRect && !isNodeDragging && (
            <div
              className="image-node-editor-positioner"
              style={{
                left: nodeCenterX,
                top: nodeOverlayRect.top + nodeOverlayRect.height + 14,
                width: nodeEditorWidth,
              }}
            >
              <motion.section
                className="image-node-editor nodrag nowheel"
                aria-label="图像节点编辑器"
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                onPointerDown={(event) => event.stopPropagation()}
                onWheel={(event) => event.stopPropagation()}
              >
                <div className="image-editor-reference-row">
                  <span className="reference-mode-icon" title="参考图片"><WandSparkles size={14} /></span>
                  <div
                    className="image-reference-thumbnails"
                    onWheel={(event) => {
                      event.stopPropagation()
                      event.currentTarget.scrollLeft += event.deltaY || event.deltaX
                    }}
                  >
                    {activeImageReferences.map((reference) => (
                      <button
                        type="button"
                        key={reference.id}
                        className={`image-reference-thumbnail ${reference.selected || activeGenerationNode.data.body.includes(reference.mention) ? 'is-mentioned' : ''} ${reference.source === 'current' && !reference.selected ? 'is-disabled' : ''}`}
                        title={reference.source === 'current' && !reference.selected ? '点击重新启用当前主图参考' : `${reference.name} · 点击插入 ${reference.mention}`}
                        onClick={() => {
                          if (reference.source === 'current' && !reference.selected) {
                            setNodes((current) => current.map((node) => node.id === activeGenerationNode.id ? {
                              ...node,
                              data: { ...node.data, useCurrentImageAsReference: true },
                            } : node))
                            return
                          }
                          selectImageMention(reference)
                        }}
                      >
                        <img src={reference.url} alt={reference.name} />
                        <span className="image-reference-name">{reference.name}{reference.source === 'current' ? (reference.selected ? ' · 默认参考' : ' · 已关闭') : reference.source === 'connection' && !reference.selected && !activeGenerationNode.data.body.includes(reference.mention) ? ' · 候选' : ''}</span>
                        {(reference.source === 'manual' || reference.source === 'connection' || reference.source === 'current') && (
                          <span
                            className="reference-remove"
                            role="button"
                            aria-label={`移除 ${reference.name}`}
                            onClick={(event) => {
                              event.stopPropagation()
                              removeImageReference(reference)
                            }}
                          ><X size={9} /></span>
                        )}
                      </button>
                    ))}
                  </div>
                  <button
                    type="button"
                    className="add-image-reference-button"
                    title="上传参考图片"
                    onClick={() => {
                      generationReferenceNodeIdRef.current = activeGenerationNode.id
                      generationReferenceInputRef.current?.click()
                    }}
                  ><Upload size={15} /></button>
                  <button
                    type="button"
                    className="add-image-reference-button"
                    title="从画布选择参考图片"
                    onClick={() => {
                      setCanvasReferencePickerNodeId(activeGenerationNode.id)
                      setImageMentionOpen(false)
                    }}
                  ><Plus size={15} /></button>
                </div>
                <div className="image-prompt-field">
                  <AtomicPromptEditor
                    key={activeGenerationNode.id}
                    ref={imagePromptEditorRef}
                    value={activeGenerationNode.data.body}
                    references={activeImageReferences}
                    onChange={handleImagePromptChange}
                    onRemoveToken={(start, end) => {
                      const nodeId = activeGenerationNode.id
                      setNodes((current) => current.map((node) => {
                        if (node.id !== nodeId) return node
                        const body = node.data.body
                        const nextBody = `${body.slice(0, start)}${body.slice(end)}`
                        return { ...node, data: { ...node.data, promptText: undefined, body: nextBody } }
                      }))
                      window.requestAnimationFrame(() => imagePromptEditorRef.current?.focusAt(start))
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (imageMentionOpen && filteredImageMentionReferences.length) {
                        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                          event.preventDefault()
                          const direction = event.key === 'ArrowDown' ? 1 : -1
                          setImageMentionIndex((current) => (current + direction + filteredImageMentionReferences.length) % filteredImageMentionReferences.length)
                          return
                        }
                        if (event.key === 'Enter' || event.key === 'Tab') {
                          event.preventDefault()
                          selectImageMention(filteredImageMentionReferences[imageMentionIndex] ?? filteredImageMentionReferences[0])
                          return
                        }
                      }
                      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault()
                        void generateFromActiveImageNode()
                      }
                      if (event.key === 'Escape') {
                        if (imageMentionOpen) setImageMentionOpen(false)
                        else setActiveGenerationNodeId(null)
                      }
                    }}
                  />
                  <AnimatePresence>
                    {imageMentionOpen && (
                      <motion.div className="image-mention-menu" initial={{ opacity: 0, y: 5, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: .98 }}>
                        <div className="image-mention-heading"><span>@ 引用参考图</span><small>{filteredImageMentionReferences.length} 张可用</small></div>
                        {filteredImageMentionReferences.map((reference, index) => (
                          <button type="button" key={reference.id} className={imageMentionIndex === index ? 'is-selected' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => selectImageMention(reference)}>
                            <img src={reference.url} alt="" />
                            <span><strong>{reference.mention}</strong><small>{reference.name}</small></span>
                            <em>{reference.source === 'connection' ? '来自连线' : '手动上传'}</em>
                          </button>
                        ))}
                        {!filteredImageMentionReferences.length && <p>没有匹配的参考图</p>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <footer className="image-editor-footer">
                  <div className="editor-model-control">
                    <AnimatePresence>
                      {imageModelMenuOpen && (
                        <motion.div
                          className="editor-model-menu"
                          initial={{ opacity: 0, y: 5, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        >
                          <div className="editor-model-menu-heading">
                            <span>图像模型</span>
                            <button type="button" onClick={() => { setImageModelMenuOpen(false); setApiOpen(true) }} title="管理 API 连接">
                              <Settings2 size={13} />
                            </button>
                          </div>
                          {enabledImageModels.map(({ connection, model }) => (
                            <button
                              type="button"
                              key={`${connection.id}-${model.id}`}
                              className={selectedImageModel?.connection.id === connection.id && selectedImageModel.model.id === model.id ? 'is-selected' : ''}
                              onClick={() => {
                                saveApiSettings({ ...apiSettings, selectedImageModel: { connectionId: connection.id, modelId: model.id } })
                                setImageModelMenuOpen(false)
                              }}
                            >
                              <ImagePlus size={14} />
                              <span><strong>{model.name}</strong><small>{connection.name} · ID: {model.id}</small></span>
                              {selectedImageModel?.connection.id === connection.id && selectedImageModel.model.id === model.id && <Check size={14} />}
                            </button>
                          ))}
                          {!enabledImageModels.length && <p>{hasCatalogImageModels ? '已获取到图像模型，但尚未启用，请到 API 设置中勾选。' : '还没有图像模型，请先到 API 设置中获取并启用。'}</p>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button
                      type="button"
                      className="editor-model-empty"
                      title={selectedImageModel?.model.name || '选择图像模型'}
                      onClick={() => {
                        setImageParameterMenuOpen(false)
                        setQuantityMenuOpen(false)
                        if (enabledImageModels.length) setImageModelMenuOpen((open) => !open)
                        else setApiOpen(true)
                      }}
                    >
                      <Sparkles size={13} />
                      <span>{selectedImageModel?.model.name || (hasCatalogImageModels ? '图像模型尚未启用' : '配置并启用图像模型')}</span>
                    </button>
                  </div>
                  <div className="image-editor-options">
                    <div className="image-parameter-control">
                      <AnimatePresence>
                        {imageParameterMenuOpen && (
                          <motion.div className="image-parameter-menu" initial={{ opacity: 0, y: 7, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: .97 }}>
                            <header><span>图像参数</span><button type="button" aria-label="关闭图像参数" onClick={() => setImageParameterMenuOpen(false)}><X size={13} /></button></header>
                            <section>
                              <label>画质</label>
                              <div className="image-detail-options">
                                {(['low', 'medium', 'high'] as ImageDetail[]).map((detail) => (
                                  <button type="button" key={detail} className={activeImageDetail === detail ? 'is-selected' : ''} onClick={() => updateActiveImageOptions({ imageDetail: detail })}>{IMAGE_DETAIL_LABELS[detail]}</button>
                                ))}
                              </div>
                            </section>
                            <section>
                              <label>清晰度</label>
                              <div className="image-resolution-options">
                                {(['1K', '2K', '4K'] as ImageResolution[]).map((resolution) => (
                                  <button type="button" key={resolution} className={activeImageResolution === resolution ? 'is-selected' : ''} onClick={() => updateActiveImageOptions({ imageResolution: resolution })}>{resolution}</button>
                                ))}
                              </div>
                            </section>
                            <section>
                              <label>比例</label>
                              <div className="image-ratio-options">
                                {IMAGE_ASPECT_OPTIONS.map((option) => (
                                  <button type="button" key={option.value} className={activeImageAspectRatio === option.value ? 'is-selected' : ''} onClick={() => updateActiveImageOptions({ imageAspectRatio: option.value })}>
                                    <span className="ratio-shape" style={{ aspectRatio: `${option.width} / ${option.height}` }} />
                                    <small>{option.label}</small>
                                  </button>
                                ))}
                              </div>
                            </section>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <button
                        type="button"
                        className={`image-option-chip ${imageParameterMenuOpen ? 'is-open' : ''}`}
                        title="设置图片比例"
                        onClick={() => {
                          setImageParameterMenuOpen((open) => !open)
                          setQuantityMenuOpen(false)
                          setImageModelMenuOpen(false)
                        }}
                      ><Focus size={13} /><span>{activeImageAspectRatio}</span></button>
                      <button
                        type="button"
                        className={`image-option-chip ${imageParameterMenuOpen ? 'is-open' : ''}`}
                        title="设置画质与清晰度"
                        onClick={() => {
                          setImageParameterMenuOpen((open) => !open)
                          setQuantityMenuOpen(false)
                          setImageModelMenuOpen(false)
                        }}
                      ><Grid3X3 size={12} /><span>{activeImageResolution} · {IMAGE_DETAIL_LABELS[activeImageDetail]}</span></button>
                    </div>
                    <div className="generation-quantity-control">
                      <AnimatePresence>
                        {quantityMenuOpen && (
                          <motion.div className="generation-quantity-menu" initial={{ opacity: 0, y: 5, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: 0.96 }}>
                            {[4, 3, 2, 1].map((count) => (
                              <button key={count} type="button" className={generationCount === count ? 'is-selected' : ''} onClick={() => { setGenerationCount(count); setQuantityMenuOpen(false) }}>
                                {count}×
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <button type="button" className="generation-quantity-button" aria-label={`生成数量 ${generationCount}`} onClick={() => { setImageParameterMenuOpen(false); setImageModelMenuOpen(false); setQuantityMenuOpen((open) => !open) }}>
                        {generationCount}×
                      </button>
                    </div>
                    <button className="editor-generate-button image-generate-button" aria-label="生成图像" title={generationLoading ? '正在生成' : '生成图像'} disabled={generationLoading} onClick={() => void generateFromActiveImageNode()}>
                      {generationLoading ? <LoaderCircle size={17} className="is-spinning" /> : <ArrowUp size={17} strokeWidth={2.2} />}
                    </button>
                  </div>
                </footer>
              </motion.section>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeTextNode && nodeOverlayRect && !isNodeDragging && !expandedEditorNodeId && (
            <div
              className="text-node-editor-positioner"
              style={{
                left: nodeCenterX,
                top: nodeOverlayRect.top + nodeOverlayRect.height + 14,
                width: nodeEditorWidth,
              }}
            >
              <motion.section
                className="text-node-editor nodrag nowheel"
                aria-label="文本节点编辑器"
                initial={{ opacity: 0, y: 14, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.98 }}
                onPointerDown={(event) => event.stopPropagation()}
              >
                <textarea
                  ref={editorTextareaRef}
                  value={activeTextNode.data.body}
                  maxLength={2000}
                  placeholder="描述任何你想生成的内容"
                  aria-label="文本提示词内容"
                  onChange={(event) => updateActiveTextNode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                      event.preventDefault()
                      setActiveEditorNodeId(null)
                    }
                    if (event.key === 'Escape') setActiveEditorNodeId(null)
                  }}
                />
                <footer className="text-editor-footer">
                  <div className="editor-model-control">
                    <AnimatePresence>
                      {modelMenuOpen && (
                        <motion.div
                          className="editor-model-menu"
                          initial={{ opacity: 0, y: 5, scale: 0.97 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 4, scale: 0.97 }}
                        >
                          <div className="editor-model-menu-heading">
                            <span>文本模型</span>
                            <button type="button" onClick={() => { setModelMenuOpen(false); setApiOpen(true) }} title="管理 API 连接">
                              <Settings2 size={13} />
                            </button>
                          </div>
                          {enabledTextModels.map(({ connection, model }) => (
                            <button
                              type="button"
                              key={`${connection.id}-${model.id}`}
                              className={selectedTextModel?.connection.id === connection.id && selectedTextModel.model.id === model.id ? 'is-selected' : ''}
                              onClick={() => {
                                saveApiSettings({ ...apiSettings, selectedTextModel: { connectionId: connection.id, modelId: model.id } })
                                setModelMenuOpen(false)
                              }}
                            >
                              <Type size={14} />
                              <span><strong>{model.name}</strong><small>{connection.name} · ID: {model.id}</small></span>
                              {selectedTextModel?.connection.id === connection.id && selectedTextModel.model.id === model.id && <Check size={14} />}
                            </button>
                          ))}
                          {!enabledTextModels.length && (
                            <p>{hasCatalogTextModels ? '已经获取到文本模型，但尚未启用，请到 API 设置中勾选。' : hasCatalogImageModels ? '当前只有图像模型，请切换或添加文本模型。' : '还没有文本模型，请到 API 设置中获取并勾选。'}</p>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button
                      type="button"
                      className="editor-model-empty"
                      title={selectedTextModel?.model.name || '选择文本模型'}
                      onClick={() => enabledTextModels.length ? setModelMenuOpen((open) => !open) : setApiOpen(true)}
                    >
                      <Sparkles size={13} />
                      <span>{selectedTextModel?.model.name || (hasCatalogTextModels ? '文本模型尚未启用' : hasCatalogImageModels ? '当前只有图像模型，请切换' : '配置并启用文本模型')}</span>
                    </button>
                  </div>
                  <div className="editor-footer-actions">
                    <div className="generation-quantity-control">
                      <AnimatePresence>
                        {quantityMenuOpen && (
                          <motion.div
                            className="generation-quantity-menu"
                            initial={{ opacity: 0, y: 5, scale: 0.96 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: 4, scale: 0.96 }}
                          >
                            {[4, 3, 2, 1].map((count) => (
                              <button
                                key={count}
                                type="button"
                                className={generationCount === count ? 'is-selected' : ''}
                                onClick={() => {
                                  setGenerationCount(count)
                                  setQuantityMenuOpen(false)
                                }}
                              >
                                {count}×
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <button
                        type="button"
                        className="generation-quantity-button"
                        aria-label={`生成数量 ${generationCount}`}
                        aria-expanded={quantityMenuOpen}
                        onClick={() => setQuantityMenuOpen((open) => !open)}
                      >
                        {generationCount}×
                      </button>
                    </div>
                    <button
                      className="editor-generate-button"
                      aria-label="生成"
                      title={generationLoading ? '正在生成' : '生成图像'}
                      disabled={generationLoading}
                      onClick={() => void generateFromActiveTextNode()}
                    >
                      {generationLoading ? <LoaderCircle size={17} className="is-spinning" /> : <ArrowUp size={17} strokeWidth={2.2} />}
                    </button>
                  </div>
                </footer>
              </motion.section>
            </div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeTextNode && expandedEditorNodeId === activeTextNode.id && (
            <motion.div
              className="expanded-editor-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onPointerDown={(event) => event.stopPropagation()}
            >
              <motion.section
                className="expanded-text-editor"
                initial={{ opacity: 0, scale: 0.985, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.985, y: 8 }}
              >
                <header className="expanded-editor-header">
                  <button
                    className="expanded-copy-button"
                    type="button"
                    aria-label="复制全部内容"
                    title="复制全部内容"
                    onClick={() => void copyActiveText()}
                  >
                    <Copy size={15} />
                    <span>复制全部</span>
                  </button>
                  <MarkdownToolbar onFormat={applyMarkdownFormat} />
                  <button
                    className="expanded-close-button"
                    type="button"
                    aria-label="关闭放大编辑"
                    title="关闭"
                    onClick={() => setExpandedEditorNodeId(null)}
                  >
                    <X size={17} />
                  </button>
                </header>
                <textarea
                  ref={expandedTextareaRef}
                  value={activeTextNode.data.body}
                  maxLength={2000}
                  autoFocus
                  placeholder="开启你的创作..."
                  aria-label="放大的 Markdown 文本编辑器"
                  onChange={(event) => updateActiveTextNode(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Escape') setExpandedEditorNodeId(null)
                  }}
                />
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {toastMessage && (
            <motion.div
              className={`canvas-toast ${activeTextNode ? 'with-editor' : ''}`}
              role="status"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
            >
              <span className="toast-dot" />
              {toastMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {outputHistoryOpen && (
          <motion.div className="output-history-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setOutputHistoryOpen(false)}>
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="output-history-title"
              className="output-history-modal"
              initial={{ opacity: 0, y: 16, scale: .985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: .985 }}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="output-history-header">
                <div><History size={18} /><h2 id="output-history-title">输出历史</h2><span>共 {outputHistory.length} 条</span></div>
                <div>
                  {outputHistory.length > 0 && <button type="button" className="output-history-clear" onClick={() => { setOutputHistory([]); localStorage.removeItem(OUTPUT_HISTORY_KEY); setExpandedOutputErrorId(null) }}>清空记录</button>}
                  <button type="button" aria-label="关闭输出历史" onClick={() => setOutputHistoryOpen(false)}><X size={18} /></button>
                </div>
              </header>
              <div className="output-history-toolbar">
                <div className="output-history-tabs">
                  {([
                    ['all', '全部'],
                    ['text', '文本'],
                    ['image', '图像'],
                    ['failed', `失败 ${outputFailureCount || ''}`],
                  ] as Array<[typeof outputHistoryFilter, string]>).map(([value, label]) => (
                    <button type="button" key={value} className={outputHistoryFilter === value ? 'is-active' : ''} onClick={() => setOutputHistoryFilter(value)}>{label}</button>
                  ))}
                </div>
                <label className="output-history-search"><Search size={14} /><input value={outputHistorySearch} placeholder="搜索提示词、模型或错误" onChange={(event) => setOutputHistorySearch(event.target.value)} /></label>
              </div>
              <div className="output-history-content">
                {filteredOutputHistory.length ? filteredOutputHistory.map((record) => {
                  const failed = record.status === 'failed'
                  const categoryLabel = record.error?.category === 'api' ? 'API 服务' : record.error?.category === 'network' ? '网络连接' : 'Disy 本地处理'
                  return (
                    <article key={record.id} className={`output-history-record ${failed ? 'is-failed' : 'is-success'}`}>
                      <span className="output-record-status">{failed ? <X size={14} /> : <Check size={14} />}</span>
                      <div className="output-record-main">
                        <header>
                          <span className="output-kind-badge">{record.kind === 'image' ? <ImagePlus size={12} /> : <Type size={12} />}{record.kind === 'image' ? '图像' : '文本'}</span>
                          <strong>{failed ? record.error?.summary : `成功输出 ${record.outputCount} 项内容`}</strong>
                          <time>{new Date(record.createdAt).toLocaleString('zh-CN', { hour12: false })}</time>
                          <button
                            type="button"
                            className="output-record-delete"
                            aria-label="删除这条输出记录"
                            title="删除记录"
                            onClick={() => deleteOutputHistoryRecord(record.id)}
                          ><Trash2 size={13} /></button>
                        </header>
                        <p className="output-record-prompt">{record.prompt}</p>
                        <div className="output-record-meta"><span>{record.modelName}</span><span>{record.connectionName}</span><span>{record.requestedCount}×</span>{record.preview && <span>{record.preview}</span>}</div>
                        {failed && record.error && (
                          <div className="output-error-block">
                            <div><Info size={13} /><span>判断：{categoryLabel}出现问题。{record.error.summary}</span></div>
                            <button type="button" onClick={() => setExpandedOutputErrorId((current) => current === record.id ? null : record.id)}>{expandedOutputErrorId === record.id ? '收起详细错误' : '查看详细错误'}</button>
                            <AnimatePresence>
                              {expandedOutputErrorId === record.id && (
                                <motion.div className="output-error-detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                  <div><code>{record.error.detail}</code><button type="button" title="复制详细错误" onClick={() => void navigator.clipboard.writeText(record.error!.detail)}><Copy size={13} /></button></div>
                                  <footer>{record.error.status && <span>HTTP {record.error.status}</span>}{record.error.requestId && <span>请求 ID：{record.error.requestId}</span>}<span>模型：{record.modelId}</span></footer>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        )}
                      </div>
                    </article>
                  )
                }) : (
                  <div className="output-history-empty"><History size={30} /><strong>{outputHistory.length ? '没有匹配的输出记录' : '暂时没有输出记录'}</strong><span>下一次生成成功或失败后，Disy 会自动记录在这里。</span></div>
                )}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {assetLibraryOpen && (
          <motion.div
            className="asset-library-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setAssetLibraryOpen(false)}
            onDragOver={(event) => {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="asset-library-title"
              className="asset-library-modal"
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.985 }}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="asset-library-header">
                <div>
                  <h2 id="asset-library-title">资产库</h2>
                  <span>{savedAssets.length}</span>
                </div>
                <div className="asset-library-size-control">
                  <span>缩略图</span>
                  <Minus size={14} />
                  <input
                    type="range"
                    min="96"
                    max="190"
                    step="2"
                    value={assetThumbnailSize}
                    aria-label="调整资产缩略图大小"
                    onChange={(event) => setAssetThumbnailSize(Number(event.target.value))}
                  />
                  <Plus size={14} />
                  <button type="button" aria-label="关闭资产库" onClick={() => setAssetLibraryOpen(false)}>
                    <X size={17} />
                  </button>
                </div>
              </header>

              <div className="asset-library-toolbar">
                <div className="asset-library-tabs">
                  <button type="button" className={assetScope === 'all' ? 'is-active' : ''} onClick={() => setAssetScope('all')}>全部资产</button>
                  <button type="button" className={assetScope === 'current' ? 'is-active' : ''} onClick={() => setAssetScope('current')}>当前项目</button>
                </div>
                <label className="asset-library-search">
                  <Search size={15} />
                  <input value={assetSearch} placeholder="搜索资产" aria-label="搜索资产" onChange={(event) => setAssetSearch(event.target.value)} />
                </label>
                <button type="button" className="asset-action-button" onClick={() => setCreatingFolder(true)}><FolderPlus size={15} />新建文件夹</button>
                <button type="button" className="asset-action-button is-primary" onClick={() => assetUploadInputRef.current?.click()}><Upload size={15} />上传图片</button>
                {selectedAssetIds.length > 0 && (
                  <div className="library-batch-actions" role="toolbar" aria-label="资产批量操作">
                    <strong>已选 {selectedAssetIds.length}</strong>
                    <button type="button" onClick={() => setSelectedAssetIds(filteredAssets.map((asset) => asset.id))}>全选</button>
                    <button type="button" onClick={() => void downloadAssetBatch(selectedAssetIds)}><Download size={14} />下载</button>
                    <button type="button" className="is-danger" onClick={() => setDeleteConfirm({ kind: 'assets', ids: selectedAssetIds, label: `${selectedAssetIds.length} 个资产` })}><Trash2 size={14} />删除</button>
                    <button type="button" aria-label="取消选择" onClick={() => setSelectedAssetIds([])}><X size={14} /></button>
                  </div>
                )}
                {selectedAssetId && (
                  <select
                    className="asset-folder-select"
                    aria-label="移动选中资产到文件夹"
                    value={savedAssets.find((asset) => asset.id === selectedAssetId)?.folderId ?? ''}
                    onChange={(event) => moveAssetToFolder(selectedAssetId, event.target.value || null)}
                  >
                    <option value="">移动到：未归档</option>
                    {assetFolders.map((folder) => <option key={folder.id} value={folder.id}>移动到：{folder.name}</option>)}
                  </select>
                )}
              </div>

              <div className="asset-library-body">
                <aside className="asset-folder-sidebar">
                  <button type="button" className={activeAssetFolderId === 'all' ? 'is-active' : ''} onClick={() => setActiveAssetFolderId('all')}>
                    <Library size={15} /><span>全部资产</span><small>{savedAssets.length}</small>
                  </button>
                  <button
                    type="button"
                    className={activeAssetFolderId === 'unfiled' ? 'is-active' : ''}
                    onClick={() => setActiveAssetFolderId('unfiled')}
                    onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
                    onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData('application/x-disy-asset'); if (id) moveAssetToFolder(id, null) }}
                  >
                    <FileImage size={15} /><span>未归档</span><small>{savedAssets.filter((asset) => !asset.folderId).length}</small>
                  </button>
                  <div className="asset-folder-label">文件夹</div>
                  {assetFolders.map((folder) => (
                    <button
                      type="button"
                      key={folder.id}
                      className={activeAssetFolderId === folder.id ? 'is-active' : ''}
                      onClick={() => setActiveAssetFolderId(folder.id)}
                      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'move' }}
                      onDrop={(event) => { event.preventDefault(); event.stopPropagation(); const id = event.dataTransfer.getData('application/x-disy-asset'); if (id) moveAssetToFolder(id, folder.id) }}
                    >
                      <Folder size={15} /><span>{folder.name}</span><small>{savedAssets.filter((asset) => asset.folderId === folder.id).length}</small>
                    </button>
                  ))}
                  {creatingFolder && (
                    <form className="asset-folder-create" onSubmit={(event) => { event.preventDefault(); createAssetFolder() }}>
                      <input autoFocus value={newFolderName} maxLength={20} placeholder="文件夹名称" onChange={(event) => setNewFolderName(event.target.value)} />
                      <button type="submit" aria-label="确认新建"><Check size={14} /></button>
                      <button type="button" aria-label="取消新建" onClick={() => { setCreatingFolder(false); setNewFolderName('') }}><X size={14} /></button>
                    </form>
                  )}
                </aside>

                <div className="asset-library-content" style={{ '--asset-thumbnail-size': `${assetThumbnailSize}px` } as React.CSSProperties}>
                  {groupedAssets.length ? groupedAssets.map(([date, assets]) => (
                    <section className="asset-date-group" key={date}>
                      <h3>{date}</h3>
                      <div className="asset-grid">
                        {assets.map((asset) => {
                          const previewUrl = getAssetPreviewUrl(asset)
                          const groupNodeCount = asset.nodes?.filter((node) => node.data.kind !== 'group').length ?? 0
                          return (
                            <div
                              key={asset.id}
                              draggable
                              className={`asset-library-card ${selectedAssetId === asset.id || selectedAssetIds.includes(asset.id) ? 'is-selected' : ''}`}
                              title={`${asset.title || asset.data?.title || '未命名资产'} · 可拖入文件夹或画布`}
                              onClick={() => setSelectedAssetId(asset.id)}
                              onDoubleClick={() => {
                                if (previewUrl) setLibraryPreview({ kind: 'asset', id: asset.id })
                              }}
                              onDragStart={(event) => {
                                event.dataTransfer.setData('application/x-disy-asset', asset.id)
                                event.dataTransfer.effectAllowed = 'copyMove'
                                const transparentPreview = document.createElement('canvas')
                                transparentPreview.width = 1
                                transparentPreview.height = 1
                                transparentPreview.style.position = 'fixed'
                                transparentPreview.style.left = '-10px'
                                transparentPreview.style.top = '-10px'
                                transparentPreview.style.pointerEvents = 'none'
                                document.body.appendChild(transparentPreview)
                                event.dataTransfer.setDragImage(transparentPreview, 0, 0)
                                window.requestAnimationFrame(() => transparentPreview.remove())
                              }}
                              onDragEnd={(event) => {
                                const modal = document.querySelector<HTMLElement>('.asset-library-modal')
                                if (!modal || event.clientX <= 0 || event.clientY <= 0) return
                                const rect = modal.getBoundingClientRect()
                                const droppedOutside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
                                if (!droppedOutside) return
                                const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
                                placeAssetOnCanvas(asset.id, { x: flowPosition.x - 130, y: flowPosition.y - 110 })
                                setAssetLibraryOpen(false)
                              }}
                            >
                              <div className="asset-library-thumbnail">
                                {previewUrl ? <img src={previewUrl} alt="" draggable={false} /> : (
                                  <div className="asset-library-placeholder">
                                    {asset.type === 'group' ? <Box size={24} /> : <Type size={24} />}
                                    <span>{asset.data?.body || asset.title || '资产'}</span>
                                  </div>
                                )}
                                <button
                                  type="button"
                                  className={`asset-select-toggle ${selectedAssetIds.includes(asset.id) ? 'is-selected' : ''}`}
                                  draggable={false}
                                  aria-label={selectedAssetIds.includes(asset.id) ? '取消选择此资产' : '选择此资产'}
                                  aria-pressed={selectedAssetIds.includes(asset.id)}
                                  onPointerDown={(event) => event.stopPropagation()}
                                  onClick={(event) => {
                                    event.stopPropagation()
                                    setSelectedAssetIds((current) => current.includes(asset.id) ? current.filter((id) => id !== asset.id) : [...current, asset.id])
                                  }}
                                >
                                  {selectedAssetIds.includes(asset.id) && <Check size={13} strokeWidth={3} />}
                                </button>
                                <span className="asset-kind-badge">{asset.type === 'group' ? <Box size={12} /> : <FileImage size={12} />}</span>
                                {groupNodeCount > 0 && <span className="asset-count-badge">{groupNodeCount}</span>}
                                <div className="asset-card-actions">
                                  {previewUrl && <button type="button" title="画廊查看" onClick={(event) => { event.stopPropagation(); setLibraryPreview({ kind: 'asset', id: asset.id }) }}><Maximize2 size={14} /></button>}
                                  {previewUrl && <button type="button" title="下载" onClick={(event) => { event.stopPropagation(); void downloadAsset(asset) }}><Download size={14} /></button>}
                                  <button type="button" title="删除" onClick={(event) => { event.stopPropagation(); setDeleteConfirm({ kind: 'asset', id: asset.id, label: asset.title || asset.data?.fileName || '此资产' }) }}><Trash2 size={14} /></button>
                                </div>
                              </div>
                              <span>{asset.title || asset.data?.fileName || asset.data?.title || '未命名资产'}</span>
                            </div>
                          )
                        })}
                      </div>
                    </section>
                  )) : (
                    <div className="asset-library-empty">
                      <Library size={28} />
                      <strong>{assetSearch ? '没有找到匹配资产' : '这里还没有资产'}</strong>
                      <span>画布中加入的资产默认进入“未归档”，也可以直接上传到当前文件夹。</span>
                    </div>
                  )}
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {generationHistoryOpen && (
          <motion.div
            className="asset-library-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setGenerationHistoryOpen(false)}
            onDragOver={(event) => {
              if (!event.dataTransfer.types.includes('application/x-disy-history')) return
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }}
            onDrop={(event) => {
              if (!event.dataTransfer.types.includes('application/x-disy-history')) return
              event.preventDefault()
            }}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="generation-history-title"
              className="asset-library-modal generation-history-modal"
              initial={{ opacity: 0, y: 16, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.985 }}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="asset-library-header">
                <div><h2 id="generation-history-title">生成历史</h2><span>{generationHistory.length}</span></div>
                <div className="asset-library-size-control">
                  <span>缩略图</span><Minus size={14} />
                  <input type="range" min="96" max="190" step="2" value={historyThumbnailSize} aria-label="调整历史缩略图大小" onChange={(event) => setHistoryThumbnailSize(Number(event.target.value))} />
                  <Plus size={14} />
                  <button type="button" aria-label="关闭生成历史" onClick={() => setGenerationHistoryOpen(false)}><X size={17} /></button>
                </div>
              </header>
              <div className="asset-library-toolbar history-toolbar">
                <div className="asset-library-tabs"><button type="button" className="is-active">全部记录</button><button type="button">当前项目</button></div>
                <label className="asset-library-search"><Search size={15} /><input value={generationHistorySearch} placeholder="搜索提示词、模型或文件名" onChange={(event) => setGenerationHistorySearch(event.target.value)} /></label>
                {selectedHistoryIds.length > 0 && (
                  <div className="library-batch-actions" role="toolbar" aria-label="生成历史批量操作">
                    <strong>已选 {selectedHistoryIds.length}</strong>
                    <button type="button" onClick={() => setSelectedHistoryIds(filteredHistory.map((record) => record.id))}>全选</button>
                    <button type="button" onClick={() => void downloadHistoryBatch(selectedHistoryIds)}><Download size={14} />下载</button>
                    <button type="button" className="is-danger" onClick={() => setDeleteConfirm({ kind: 'history-batch', ids: selectedHistoryIds, label: `${selectedHistoryIds.length} 条历史记录` })}><Trash2 size={14} />删除</button>
                    <button type="button" aria-label="取消选择" onClick={() => setSelectedHistoryIds([])}><X size={14} /></button>
                  </div>
                )}
              </div>
              <div className="asset-library-content" style={{ '--asset-thumbnail-size': `${historyThumbnailSize}px` } as React.CSSProperties}>
                {groupedHistory.length ? groupedHistory.map(([date, records]) => (
                  <section className="asset-date-group" key={date}>
                    <h3>{date}</h3>
                    <div className="asset-grid">
                      {records.map((record) => (
                        <div
                          className={`asset-library-card ${selectedHistoryIds.includes(record.id) ? 'is-selected' : ''}`}
                          key={record.id}
                          draggable
                          title={`${record.prompt} · 拖出窗口可加入画布`}
                          onDoubleClick={() => setLibraryPreview({ kind: 'history', id: record.id })}
                          onDragStart={(event) => {
                            event.dataTransfer.setData('application/x-disy-history', record.id)
                            event.dataTransfer.effectAllowed = 'copy'
                            const transparentPreview = document.createElement('canvas')
                            transparentPreview.width = 1
                            transparentPreview.height = 1
                            transparentPreview.style.position = 'fixed'
                            transparentPreview.style.left = '-10px'
                            transparentPreview.style.top = '-10px'
                            transparentPreview.style.pointerEvents = 'none'
                            document.body.appendChild(transparentPreview)
                            event.dataTransfer.setDragImage(transparentPreview, 0, 0)
                            window.requestAnimationFrame(() => transparentPreview.remove())
                          }}
                          onDragEnd={(event) => {
                            const modal = document.querySelector<HTMLElement>('.generation-history-modal')
                            if (!modal || event.clientX <= 0 || event.clientY <= 0) return
                            const rect = modal.getBoundingClientRect()
                            const droppedOutside = event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom
                            if (!droppedOutside) return
                            const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
                            const stamp = Date.now()
                            setNodes((current) => [...current, {
                              id: `history-image-${stamp}-${crypto.randomUUID()}`,
                              type: 'disy',
                              position: { x: flowPosition.x - 130, y: flowPosition.y - 110 },
                              data: {
                                kind: 'upload',
                                title: record.fileName || '生成历史图片',
                                body: record.prompt || '',
                                imageUrl: record.imageUrl,
                                fileName: record.fileName || `disy-history-${stamp}.png`,
                              },
                            }])
                            setGenerationHistoryOpen(false)
                            setToastMessage('历史图片已加入画布')
                          }}
                        >
                          <div className="asset-library-thumbnail">
                            <img src={record.imageUrl} alt={record.prompt} draggable={false} />
                            <button
                              type="button"
                              className={`asset-select-toggle ${selectedHistoryIds.includes(record.id) ? 'is-selected' : ''}`}
                              draggable={false}
                              aria-label={selectedHistoryIds.includes(record.id) ? '取消选择此历史记录' : '选择此历史记录'}
                              aria-pressed={selectedHistoryIds.includes(record.id)}
                              onPointerDown={(event) => event.stopPropagation()}
                              onClick={(event) => {
                                event.stopPropagation()
                                setSelectedHistoryIds((current) => current.includes(record.id) ? current.filter((id) => id !== record.id) : [...current, record.id])
                              }}
                            >
                              {selectedHistoryIds.includes(record.id) && <Check size={13} strokeWidth={3} />}
                            </button>
                            <span className="asset-kind-badge"><Sparkles size={12} /></span>
                            <div className="asset-card-actions">
                              <button type="button" title="画廊查看" onClick={() => setLibraryPreview({ kind: 'history', id: record.id })}><Maximize2 size={14} /></button>
                              <button type="button" title="下载" onClick={() => void downloadImageUrl(record.imageUrl, record.fileName)}><Download size={14} /></button>
                              <button type="button" title="删除" onClick={() => setDeleteConfirm({ kind: 'history', id: record.id, label: record.fileName })}><Trash2 size={14} /></button>
                            </div>
                          </div>
                          <span>{record.fileName}</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )) : (
                  <div className="asset-library-empty"><History size={28} /><strong>{generationHistorySearch ? '没有找到匹配记录' : '还没有生成记录'}</strong><span>通过文本节点生成的图像会自动出现在这里。</span></div>
                )}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirm && (
          <motion.div className="confirm-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setDeleteConfirm(null)}>
            <motion.section className="confirm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="delete-confirm-title" initial={{ opacity: 0, y: 10, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .97 }} onClick={(event) => event.stopPropagation()}>
              <span className="confirm-icon"><Trash2 size={18} /></span>
              <div><h3 id="delete-confirm-title">确认删除？</h3><p>“{deleteConfirm.label}”删除后无法恢复。</p></div>
              <footer>
                <button type="button" onClick={() => setDeleteConfirm(null)}>取消</button>
                <button
                  type="button"
                  className="is-danger"
                  onClick={() => {
                    if (deleteConfirm.kind === 'asset') deleteAsset(deleteConfirm.id)
                    if (deleteConfirm.kind === 'history') deleteGenerationRecord(deleteConfirm.id)
                    if (deleteConfirm.kind === 'assets') deleteAssetBatch(deleteConfirm.ids)
                    if (deleteConfirm.kind === 'history-batch') deleteHistoryBatch(deleteConfirm.ids)
                    setDeleteConfirm(null)
                  }}
                >
                  删除
                </button>
              </footer>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {projectOpen && (
          <motion.div
            className="project-modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setProjectOpen(false)}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="project-dialog-title"
              className="project-modal"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.98 }}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="project-modal-header">
                <div className="project-title-group">
                  <h2 id="project-dialog-title">项目</h2>
                  <span>1</span>
                </div>
                <button className="project-close" aria-label="关闭项目窗口" onClick={() => setProjectOpen(false)}>
                  <X size={18} />
                </button>
              </header>

              <div className="project-toolbar">
                <label className="project-search-field">
                  <Search size={15} />
                  <input
                    value={projectSearch}
                    placeholder="搜索项目"
                    aria-label="搜索项目"
                    onChange={(event) => setProjectSearch(event.target.value)}
                  />
                </label>
                <button className="project-sort-button">
                  <History size={15} />
                  最近更新
                </button>
                <button onClick={() => setToastMessage('项目导入功能将在下一阶段开放')}>
                  <Upload size={15} />
                  导入项目
                </button>
                <button className="project-create-button" onClick={() => setToastMessage('新建项目功能将在下一阶段开放')}>
                  <Plus size={16} />
                  新建
                </button>
              </div>

              <div className="project-grid">
                {currentProjectMatches && (
                  <button className="project-card is-current" onClick={() => setProjectOpen(false)}>
                    <div className="project-preview">
                      <span className="preview-node preview-node-one" />
                      <span className="preview-node preview-node-two" />
                      <span className="preview-edge" />
                      <span className="preview-node preview-node-three" />
                    </div>
                    <div className="project-card-meta">
                      <strong>{canvasName}</strong>
                      <span className="current-project-badge">当前</span>
                      <small>{nodes.length} 个节点 · 刚刚更新</small>
                    </div>
                  </button>
                )}
                {!currentProjectMatches && (
                  <div className="project-empty-search">没有找到匹配的项目</div>
                )}
                <button className="project-card project-new-card" onClick={() => setToastMessage('新建项目功能将在下一阶段开放')}>
                  <span className="project-new-icon"><Plus size={20} /></span>
                  <strong>新建项目</strong>
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {apiOpen && (
          <motion.div
            className="modal-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setApiOpen(false)}
          >
            <motion.div
              role="dialog"
              aria-modal="true"
              aria-labelledby="api-dialog-title"
              className="api-modal api-manager-modal"
              initial={{ y: reduceMotion ? 0 : 18, opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
              animate={{ y: 0, opacity: 1, scale: 1 }}
              exit={{ y: reduceMotion ? 0 : 18, opacity: 0, scale: reduceMotion ? 1 : 0.98 }}
              onClick={(event) => event.stopPropagation()}
            >
              <div className="modal-heading api-manager-heading">
                <div>
                  <span className="eyebrow">连接你的可能性</span>
                  <h2 id="api-dialog-title">API 设置</h2>
                  <p>分别管理连接、获取模型，并只启用你实际需要的能力。</p>
                </div>
                <button aria-label="关闭 API 设置" className="modal-close" onClick={() => setApiOpen(false)}>
                  <X size={18} />
                </button>
              </div>

              <div className="api-manager-body">
                <aside className="api-connection-list">
                  <button type="button" className="api-new-connection" onClick={beginNewApiConnection}>
                    <Plus size={15} /><span>添加 API 连接</span>
                  </button>
                  <div className="api-list-label">连接</div>
                  {apiSettings.connections.map((connection) => {
                    const enabledCount = connection.models.filter((model) => model.enabled).length
                    return (
                      <button
                        type="button"
                        key={connection.id}
                        className={editingConnectionId === connection.id ? 'is-active' : ''}
                        onClick={() => selectApiConnection(connection)}
                      >
                        <span className={`api-connection-dot ${connection.apiKey ? 'is-online' : ''}`} />
                        <span><strong>{connection.name}</strong><small>{connection.models.length ? `${enabledCount}/${connection.models.length} 个模型已启用` : '尚未获取模型'}</small></span>
                      </button>
                    )
                  })}
                  {!apiSettings.connections.length && <p>添加第一条连接后，再单独获取它的模型。</p>}
                </aside>

                <section className="api-connection-detail">
                  <div className="api-detail-title">
                    <div><strong>{editingConnectionId === 'new' ? '新建连接' : apiDraft.name || 'API 连接'}</strong><span>{editingConnectionId === 'new' ? '配置一个新的 OpenAI 兼容接口' : '编辑连接与启用模型'}</span></div>
                    {editingConnectionId !== 'new' && <button type="button" className="api-delete-connection" onClick={removeCurrentApiConnection}><Trash2 size={14} />删除连接</button>}
                  </div>

                  <div className="api-fields-grid">
                    <label>
                      连接名称
                      <input ref={firstApiInputRef} value={apiDraft.name} onChange={(event) => setApiDraft((draft) => ({ ...draft, name: event.target.value }))} placeholder="例如：主力 API" />
                    </label>
                    <label className="api-field-wide">
                      接口地址
                      <input value={apiDraft.baseUrl} onChange={(event) => setApiDraft((draft) => ({ ...draft, baseUrl: event.target.value }))} placeholder="https://your-api-endpoint.com/v1" />
                    </label>
                    <label className="api-field-wide">
                      API Key
                      <input value={apiDraft.apiKey} onChange={(event) => setApiDraft((draft) => ({ ...draft, apiKey: event.target.value }))} type="password" placeholder="sk-••••••••••••••••" />
                    </label>
                    <button type="button" className="api-fetch-models" disabled={modelsLoading} onClick={() => void refreshRemoteModels()}>
                      {modelsLoading ? <LoaderCircle size={15} className="is-spinning" /> : <History size={15} />}
                      {modelsLoading ? '正在获取模型' : '获取当前连接模型'}
                    </button>
                  </div>

                  <div className="api-model-catalog">
                    <div className="api-model-tabs">
                      {(Object.keys(MODEL_CAPABILITY_LABELS) as ModelCapability[]).map((capability) => (
                        <button type="button" key={capability} className={apiModelTab === capability ? 'is-active' : ''} onClick={() => setApiModelTab(capability)}>
                          {MODEL_CAPABILITY_LABELS[capability]}
                          <span>{draftModels.filter((model) => model.capability === capability).length}</span>
                        </button>
                      ))}
                    </div>
                    <div className="api-model-list">
                      {draftModels.filter((model) => model.capability === apiModelTab).map((model) => (
                        <div key={model.id} className={`api-model-row ${model.enabled ? 'is-enabled' : ''}`}>
                          <button type="button" className="api-model-main" onClick={() => setDraftModels((current) => current.map((item) => item.id === model.id ? { ...item, enabled: !item.enabled } : item))}>
                            <span className="api-model-type">{MODEL_CAPABILITY_LABELS[model.capability].slice(0, 1)}</span>
                            <span><strong>{model.name}</strong><small>ID: {model.id}</small></span>
                            <span className="api-model-check">{model.enabled && <Check size={13} />}</span>
                          </button>
                          <select
                            value={model.capability}
                            aria-label={`修改 ${model.name} 的模型类型`}
                            title="模型分类不准确时可手动修正"
                            onChange={(event) => {
                              const capability = event.target.value as ModelCapability
                              setDraftModels((current) => current.map((item) => item.id === model.id ? { ...item, capability } : item))
                              setApiModelTab(capability)
                            }}
                          >
                            {(Object.keys(MODEL_CAPABILITY_LABELS) as ModelCapability[]).map((capability) => <option key={capability} value={capability}>{MODEL_CAPABILITY_LABELS[capability]}</option>)}
                          </select>
                        </div>
                      ))}
                      {!draftModels.length && <div className="api-model-empty"><Sparkles size={20} /><strong>还没有模型目录</strong><span>填写当前连接后，点击“获取当前连接模型”。系统不会请求其他连接。</span></div>}
                      {draftModels.length > 0 && !draftModels.some((model) => model.capability === apiModelTab) && <div className="api-model-empty"><Info size={19} /><strong>没有{MODEL_CAPABILITY_LABELS[apiModelTab]}模型</strong><span>{apiModelTab === 'text' ? '如果这里只出现图像模型，文本节点会提示你切换连接。' : '可切换上方分类查看其他模型。'}</span></div>}
                    </div>
                  </div>

                  {modelsError && <p className="form-error" role="alert">{modelsError}</p>}
                  {apiError && <p className="form-error" role="alert">{apiError}</p>}

                  <footer className="api-manager-footer">
                    <span className="secure-note"><KeyRound size={14} />API Key 只保留在当前标签页会话</span>
                    <div className="modal-buttons">
                      {apiConfigured && <button className="clear-button" onClick={() => { clearApiSettings(); beginNewApiConnection() }}>清除全部</button>}
                      <button className="connect-button" onClick={saveApi}>保存当前连接 <ArrowUpRight size={15} /></button>
                    </div>
                  </footer>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
