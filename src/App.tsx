/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
import { createContext, forwardRef, lazy, memo, Suspense, useCallback, useContext, useEffect, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import gsap from 'gsap'
import { useGSAP } from '@gsap/react'
const LightingSpherePreview = lazy(() => import('./LightingSpherePreview'))
import {
  ArrowUp,
  ArrowUpRight,
  Aperture,
  Bold,
  BookOpen,
  Box,
  BriefcaseBusiness,
  Camera,
  Check,
  ChevronDown,
  CircleHelp,
  ChevronLeft,
  ChevronRight,
  Copy,
  Crown,
  Crop,
  Download,
  Expand,
  Eye,
  EyeOff,
  FileImage,
  Folder,
  FolderPlus,
  Focus,
  Film,
  Grid3X3,
  History,
  Hash,
  Heart,
  ImagePlus,
  Info,
  Italic,
  KeyRound,
  Keyboard,
  Library,
  Lightbulb,
  List,
  ListOrdered,
  Lock,
  LoaderCircle,
  Maximize2,
  Minus,
  MessageCircle,
  Music2,
  PanelsTopLeft,
  Pause,
  Palette,
  Pencil,
  Plus,
  Pilcrow,
  Search,
  Settings2,
  Shapes,
  Sparkles,
  Scissors,
  Star,
  Type,
  Trash2,
  Upload,
  ArrowUpDown,
  Unlink2,
  Unlock,
  Rocket,
  WandSparkles,
  X,
  Power,
  Unplug,
  PlugZap,
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
  type EdgeChange,
  type EdgeProps,
  type Node,
  type NodeProps,
  type OnConnectEnd,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { useDisyStore, isConnectionUsable, type ApiConnection, type ApiModelConfig, type ApiSettings, type ModelCapability, type ModelSelection } from './store'
import { appendWorkspaceProjects, createWorkspaceCanvas, createWorkspaceProject, deleteAgentSession, deleteHistoryMedia, deleteWorkspaceCanvas, deleteWorkspaceProject, exportWorkspaceSnapshot, listAgentSessions, listHistoryMedia, listWorkspaceCanvases, listWorkspaceProjects, loadHistoryMedia, loadLocalAssets, loadLocalProject, loadWorkspaceAuxiliaryData, loadWorkspaceCanvas, loadWorkspaceImportBackup, makeUniqueWorkspaceName, renameWorkspaceProject, replaceWorkspaceProject, restoreWorkspaceImportBackup, saveAgentSession, saveHistoryMedia, saveLocalAssets, saveWorkspaceAuxiliaryData, saveWorkspaceCanvas, saveWorkspaceProject, validateWorkspaceSnapshot, workspaceSnapshotHasContent, type StylePresetRecord, type StyleReferenceRecord, type WorkspaceCanvas, type WorkspaceProject } from './localDb'
import { collectReferencedMediaIds, extractMediaIntoBundle, isWorkspaceBundle, packWorkspaceBundle, reinflateBundleMedia, triggerBlobDownload, unpackWorkspaceBundle, type BundleMediaEntry } from './workspaceBundle'
import { appendOperatorRecoveryLog, listOperatorRecoveryLogs, lockOperatorSession, unlockOperatorSession, verifyOperatorAccess, type OperatorRecoveryLog } from './adminGate'
import { extractImageUrlsFromAdminResult, fetchRemoteModels, generateRemoteImages, generateRemoteText, isModelAutoEnabled, normalizeGenerationError, pickPreferredModelId, prepareReferenceImageForRequest, shouldAppendReferenceGuide, validateApiCredentials, type GenerationAdminLog, type GenerationErrorCategory } from './imageApi'
import { AgentPanel } from './AgentPanel'
import { PromptLibraryPanel, type PromptLibraryCase } from './PromptLibraryPanel'
import { compactReferenceName, getRequestedAgentPlanCount, messageExpectsImagePlans, messageRequestsDirectImagePlan, normalizeAgentMessageContent, parseAgentReply, type AgentContextReference, type AgentImagePlan, type AgentImageReference, type AgentMessage, type AgentTextPlan } from './agent'

gsap.registerPlugin(useGSAP)

/** Recompute the persisted text/image model selections from a set of connections, dropping any that are no longer usable. */
function pickValidSelections(connections: ApiConnection[], previous: { selectedTextModel?: ModelSelection; selectedImageModel?: ModelSelection }) {
  const usable = connections.filter(isConnectionUsable)
  const enabledText = usable.flatMap((connection) => connection.models
    .filter((model) => model.enabled && model.capability === 'text')
    .map((model) => ({ connectionId: connection.id, modelId: model.id })))
  const enabledImage = usable.flatMap((connection) => connection.models
    .filter((model) => model.enabled && model.capability === 'image')
    .map((model) => ({ connectionId: connection.id, modelId: model.id })))
  const selectedTextModel = previous.selectedTextModel
    && enabledText.some((model) => model.connectionId === previous.selectedTextModel?.connectionId && model.modelId === previous.selectedTextModel?.modelId)
    ? previous.selectedTextModel
    : enabledText[0]
  const selectedImageModel = previous.selectedImageModel
    && enabledImage.some((model) => model.connectionId === previous.selectedImageModel?.connectionId && model.modelId === previous.selectedImageModel?.modelId)
    ? previous.selectedImageModel
    : enabledImage[0]
  return { selectedTextModel, selectedImageModel }
}

type NodeKind = 'text' | 'image' | 'upload' | 'group'
type CreatableNodeKind = Exclude<NodeKind, 'group'>
type ImageAspectRatio = 'auto' | '1:1' | '2:1' | '4:3' | '3:4' | '5:4' | '4:5' | '3:2' | '2:3' | '16:9' | '9:16' | '21:9' | '9:21'
type ImageResolution = '1K' | '2K' | '4K'
type ImageDetail = 'low' | 'medium' | 'high'
type GroupIconKey = 'folder' | 'hash' | 'palette' | 'camera' | 'heart' | 'star' | 'crown' | 'film' | 'music' | 'briefcase' | 'idea' | 'rocket' | 'shapes' | 'aperture'
type TransferScope = 'workspace-append' | 'project-replace'
type ImageReference = {
  id: string
  name: string
  url: string
}

const MAX_REFERENCE_IMAGES = 16
const SUPPORTED_REFERENCE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp'])

function readReferenceImage(file: File): Promise<ImageReference> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string'
      ? resolve({ id: `manual-${crypto.randomUUID()}`, name: file.name, url: reader.result })
      : reject(new Error('图片读取失败'))
    reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
    reader.readAsDataURL(file)
  })
}
type ProjectClipboardState = {
  projectId: string
  name: string
}
type ProjectContextMenuState = {
  x: number
  y: number
  projectId?: string
}
type ImageVariant = {
  id: string
  url: string
  fileName: string
  createdAt: string
  revisedPrompt?: string
  /** IndexedDB history-media id — durable across CDN expiry / reloads */
  mediaId?: string
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
  referenceOrder?: string[]
  useCurrentImageAsReference?: boolean
  imageAspectRatio?: ImageAspectRatio
  imageResolution?: ImageResolution
  imageDetail?: ImageDetail
  imageModelConnectionId?: string
  imageModelId?: string
  imageModelName?: string
  generationError?: string
  groupColor?: string
  groupFolderColor?: string
  groupAccentColor?: string
  groupIcon?: GroupIconKey
  groupCollapsed?: boolean
  groupNodeCount?: number
  groupPreviewUrls?: string[]
  groupExpandedWidth?: number
  groupExpandedHeight?: number
}>

type ActiveImageReference = Omit<ImageReference, 'url'> & {
  kind?: never
  url?: string
  source: 'current' | 'connection' | 'manual'
  sourceNodeId?: string
  selected: boolean
  mention: string
}

type ActiveNodeReference = {
  id: string
  source: 'connection' | 'manual'
  sourceNodeId?: string
  selected: boolean
  name: string
  mention: string
  kind: 'text' | 'image'
  text?: string
  url?: string
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
    height: Math.round(contentHeight),
  }
}

const NodeTextUpdateContext = createContext<(nodeId: string, body: string) => void>(() => undefined)
const NodeTitleUpdateContext = createContext<(nodeId: string, title: string) => void>(() => undefined)
const ImageGalleryOpenContext = createContext<(nodeId: string) => void>(() => undefined)
const ImagePreviewOpenContext = createContext<(nodeId: string) => void>(() => undefined)
type ImageToolMode = 'grid' | 'expand' | 'studio' | 'local-edit' | 'cutout'
const ImageToolOpenContext = createContext<(nodeId: string, mode: ImageToolMode) => void>(() => undefined)
const NodeExtensionMenuContext = createContext<(nodeId: string, anchor: HTMLElement, direction: 'incoming' | 'outgoing') => void>(() => undefined)
const GroupCollapseContext = createContext<(nodeId: string, collapsed: boolean) => void>(() => undefined)
const ActiveGenerationNodesContext = createContext<ReadonlySet<string>>(new Set())

const GROUP_ICON_OPTIONS: Array<{ key: GroupIconKey; label: string }> = [
  { key: 'folder', label: '文件夹' },
  { key: 'hash', label: '主题' },
  { key: 'palette', label: '视觉' },
  { key: 'camera', label: '摄影' },
  { key: 'heart', label: '收藏' },
  { key: 'star', label: '精选' },
  { key: 'crown', label: '品牌' },
  { key: 'film', label: '视频' },
  { key: 'music', label: '音乐' },
  { key: 'briefcase', label: '项目' },
  { key: 'idea', label: '灵感' },
  { key: 'rocket', label: '发布' },
  { key: 'shapes', label: '组件' },
  { key: 'aperture', label: '素材' },
]

function GroupTypeIcon({ icon = 'folder', size = 15 }: { icon?: GroupIconKey; size?: number }) {
  const props = { size, strokeWidth: 1.9 }
  switch (icon) {
    case 'hash': return <Hash {...props} />
    case 'palette': return <Palette {...props} />
    case 'camera': return <Camera {...props} />
    case 'heart': return <Heart {...props} />
    case 'star': return <Star {...props} />
    case 'crown': return <Crown {...props} />
    case 'film': return <Film {...props} />
    case 'music': return <Music2 {...props} />
    case 'briefcase': return <BriefcaseBusiness {...props} />
    case 'idea': return <Lightbulb {...props} />
    case 'rocket': return <Rocket {...props} />
    case 'shapes': return <Shapes {...props} />
    case 'aperture': return <Aperture {...props} />
    default: return <Folder {...props} />
  }
}

type NodeMenuState = {
  x: number
  y: number
  flowX: number
  flowY: number
  connectionSourceId?: string
  connectionDirection?: 'incoming' | 'outgoing'
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
  projectId?: string
  mediaId?: string
}

type LibraryPreview = {
  kind: 'asset' | 'history'
  id: string
}

type DeleteConfirm =
  | { kind: 'asset' | 'history'; id: string; label: string }
  | { kind: 'assets' | 'history-batch'; ids: string[]; label: string }
  | { kind: 'style-reference'; id: string; presetId: string; label: string }
  | { kind: 'style-preset'; presetId: string; label: string }

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
  projectId?: string
  preview?: string
  recoveredCount?: number
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
const ACTIVE_PROJECT_KEY = 'disy-active-project-id'
const WORKSPACE_INITIALIZED_KEY = 'disy-workspace-initialized-v1'
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
}

const API_PROVIDER_PRESETS = [
  { id: 'grsai', name: 'GRS AI', baseUrl: 'https://grsai.dakka.com.cn/v1', detail: '国内直连 · 图像与文本' },
  { id: 'apiyi', name: 'APIYI', baseUrl: 'https://api.apiyi.com/v1', detail: 'OpenAI 兼容聚合平台' },
  { id: 'openai', name: 'OpenAI', baseUrl: 'https://api.openai.com/v1', detail: '官方 GPT 与图像模型' },
  { id: 'jimeng', name: '即梦', baseUrl: 'https://ark.cn-beijing.volces.com/api/v3', detail: '字节跳动 · 即梦 / Seedream' },
] as const

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

type CanvasHistorySnapshot = {
  nodes: CanvasNode[]
  edges: Edge[]
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
  if (data.kind === 'text') return data.title || '文本'
  if (data.kind === 'image') return data.title || '图像'
  if (data.kind === 'group') return data.title || '分组'
  return data.title || data.fileName || '图像'
}

function normalizeImageGenerationOptions(options: {
  aspectRatio?: string
  resolution?: string
  detail?: string
  count?: number
}) {
  const aspectRatio = (IMAGE_ASPECT_OPTIONS.some((option) => option.value === options.aspectRatio)
    ? options.aspectRatio
    : '1:1') as ImageAspectRatio
  const resolution = (options.resolution === '2K' || options.resolution === '4K' ? options.resolution : '1K') as ImageResolution
  const detail = (options.detail === 'low' || options.detail === 'high' ? options.detail : 'medium') as ImageDetail
  const count = Math.min(4, Math.max(1, Math.round(options.count ?? 1)))
  return { aspectRatio, resolution, detail, count }
}

function getWelcomeModelGlyph(name: string, image = false) {
  const normalized = name.toLowerCase().replace(/[\s_-]+/g, '')
  if (/gpt|openai|dall|sora/.test(normalized)) return '◎'
  if (/gemini|nanobanana|imagen|google/.test(normalized)) return '✦'
  if (/claude|anthropic/.test(normalized)) return 'C'
  if (/即梦|jimeng|dreamina|seedream|seedance/.test(normalized)) return '即'
  if (/豆包|doubao/.test(normalized)) return '豆'
  return image ? '✦' : 'AI'
}

function ModelBrandBadge({ name, image = false }: { name?: string; image?: boolean }) {
  return <span className={`welcome-model-badge ${image ? 'is-image' : ''}`} aria-hidden="true">{getWelcomeModelGlyph(name ?? '', image)}</span>
}

function WelcomeModelSelect({ value, placeholder, options, image, typeSelect, onChange }: {
  value: string
  placeholder: string
  options: Array<{ key: string; name: string; connectionName?: string }>
  image?: boolean
  typeSelect?: boolean
  onChange: (key: string) => void
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const selected = options.find((model) => model.key === value)
  const providerNames = Array.from(new Set(options.map((model) => model.connectionName).filter(Boolean))) as string[]
  const grouped = providerNames.length > 1
  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!(event.target instanceof HTMLElement) || !rootRef.current?.contains(event.target)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])
  return <div ref={rootRef} className={`welcome-model-select ${open ? 'is-open' : ''}`}>
    <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)}>
      {typeSelect
        ? <span className="welcome-model-badge is-type"><Plus size={13} /></span>
        : <span className={`welcome-model-badge ${image ? 'is-image' : ''}`}>{getWelcomeModelGlyph(selected?.name ?? '', image)}</span>}
      <strong>{selected?.name ?? placeholder}</strong>
      <ChevronDown size={13} />
    </button>
    {open && <div className="welcome-model-menu" role="listbox">
      {options.length ? (grouped ? providerNames.map((provider) => <section className="welcome-model-group" key={provider}><small>{provider}</small>{options.filter((model) => model.connectionName === provider).map((model) => <button type="button" role="option" aria-selected={model.key === value} key={model.key} onClick={() => { onChange(model.key); setOpen(false) }}><span>{model.name}</span>{model.key === value && <Check size={13} />}</button>)}</section>) : options.map((model) => <button type="button" role="option" aria-selected={model.key === value} key={model.key} onClick={() => { onChange(model.key); setOpen(false) }}><span>{model.name}</span>{model.key === value && <Check size={13} />}</button>)) : <p>{placeholder}</p>}
    </div>}
  </div>
}

function WelcomeAgentComposer({
  textModels,
  imageModels,
  textModelKey,
  imageModelKey,
  onTextModelChange,
  onImageModelChange,
  onVideoUnavailable,
  onSend,
  busy,
}: {
  textModels: Array<{ key: string; name: string; connectionName?: string }>
  imageModels: Array<{ key: string; name: string; connectionName?: string }>
  textModelKey: string
  imageModelKey: string
  onTextModelChange: (key: string) => void
  onImageModelChange: (key: string) => void
  onVideoUnavailable: () => void
  onSend: (content: string) => void
  busy: boolean
}) {
  const [value, setValue] = useState('')
  const [mediaKind, setMediaKind] = useState<'choose' | 'image'>('choose')
  const [imageModelChosen, setImageModelChosen] = useState(false)
  const [placeholder, setPlaceholder] = useState('比如：做一组夏日咖啡店的视觉方案')
  const prompts = ['比如：做一组夏日咖啡店的视觉方案', '比如：电商头脑风暴，帮我找 3 个方向', '比如：把这个产品做成更有记忆点的海报', '比如：为我的品牌整理一套视觉灵感']
  useEffect(() => {
    let promptIndex = 0
    let characterIndex = 0
    let deleting = false
    const timer = window.setInterval(() => {
      const prompt = prompts[promptIndex]
      characterIndex += deleting ? -1 : 1
      if (characterIndex >= prompt.length + 1) deleting = true
      if (characterIndex <= 0) { deleting = false; promptIndex = (promptIndex + 1) % prompts.length }
      setPlaceholder(prompt.slice(0, Math.max(0, characterIndex)))
    }, 72)
    return () => window.clearInterval(timer)
  }, [])
  const submit = () => {
    const message = value.trim()
    if (!message || busy) return
    onSend(message)
    setValue('')
  }
  return <section className="welcome-agent-composer" aria-label="Disy Agent 快速对话">
    <div className="welcome-agent-title"><span className="welcome-agent-orb"><img src="/disy-logo.png" alt="" /></span><strong>今天想做点什么？</strong></div>
    <div className="welcome-agent-input-wrap"><textarea value={value} rows={2} placeholder={placeholder} onChange={(event) => setValue(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); submit() } }} /><button type="button" className="welcome-agent-send" disabled={!value.trim() || busy} onClick={submit}>{busy ? <LoaderCircle size={17} className="is-spinning" /> : <ArrowUp size={17} />}</button></div>
    <div className="welcome-agent-footer">
      <WelcomeModelSelect value={textModelKey} placeholder={textModels.length ? '选择对话模型' : '请先配置对话模型'} options={textModels} onChange={onTextModelChange} />
      {mediaKind === 'choose' ? <WelcomeModelSelect
        value=""
        placeholder="请选择"
        typeSelect
        options={[{ key: 'image', name: '图像' }, { key: 'video', name: '视频（暂未开放）' }]}
        onChange={(kind) => {
          if (kind === 'video') {
            onVideoUnavailable()
            return
          }
          setMediaKind('image')
          setImageModelChosen(false)
        }}
      /> : <WelcomeModelSelect
        value={imageModelChosen ? imageModelKey : ''}
        placeholder={imageModels.length ? '选择生图模型' : '请先配置生图模型'}
        options={[{ key: '__choose_type__', name: '返回生成类型' }, ...imageModels]}
        image
        onChange={(key) => {
          if (key === '__choose_type__') {
            setMediaKind('choose')
            setImageModelChosen(false)
            return
          }
          onImageModelChange(key)
          setImageModelChosen(true)
        }}
      />}
    </div>
  </section>
}

function getReferenceLabel(name: string, fallbackIndex: number) {
  const normalized = name.trim().replace(/\s+/g, ' ')
  return (normalized || `参考图片 ${fallbackIndex + 1}`).slice(0, 36)
}

function getReferenceMention(label: string) {
  return `@[${label}]`
}

function formatRelativeTime(value: string) {
  const elapsed = Math.max(0, Date.now() - Date.parse(value))
  const minutes = Math.floor(elapsed / 60000)
  if (minutes < 60) return `${Math.max(1, minutes)} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  return `${days} 天前`
}

function formatProjectDate(value: string) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  const pad = (part: number) => String(part).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function getConnectedReferenceLabel(node: CanvasNode) {
  if (node.data.kind === 'text') return '文本'
  return node.data.fileName || node.data.title || '图像'
}

function getConnectedReferenceMention(node: CanvasNode) {
  return `@[node:${node.id}]`
}

type AtomicPromptEditorHandle = {
  focusAt: (offset: number) => void
  getCaret: () => number
}

type AtomicPromptEditorProps = {
  value: string
  references: Array<ActiveImageReference | ActiveNodeReference>
  onChange: (value: string, cursor: number) => void
  onRemoveToken: (start: number, end: number) => void
  onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => void
  onBlur?: () => void
  ariaLabel?: string
  placeholder?: string
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

function getAtomicBackwardTokenRange(root: HTMLElement) {
  const selection = window.getSelection()
  if (!selection?.rangeCount) return null
  const range = selection.getRangeAt(0)
  if (!range.collapsed || !root.contains(range.startContainer)) return null
  const caret = getAtomicPromptCaret(root)
  const tokens = Array.from(root.querySelectorAll<HTMLElement>('[data-atomic-mention]'))
  for (const token of tokens) {
    const prefix = document.createRange()
    prefix.selectNodeContents(root)
    prefix.setEndBefore(token)
    const holder = document.createElement('div')
    holder.append(prefix.cloneContents())
    const start = serializeAtomicPromptRoot(holder).length
    const end = start + (token.dataset.atomicMention?.length ?? 0)
    if (caret > start && caret <= end) return { start, end }
  }
  return null
}

const AtomicPromptEditor = forwardRef<AtomicPromptEditorHandle, AtomicPromptEditorProps>(function AtomicPromptEditor({
  value,
  references,
  onChange,
  onRemoveToken,
  onKeyDown,
  onBlur,
  ariaLabel = '图像提示词',
  placeholder = '描述任何你想生成的图像，按 @ 引用参考素材',
}, forwardedRef) {
  const rootRef = useRef<HTMLDivElement>(null)
  const lastEmittedValueRef = useRef(value)
  const composingRef = useRef(false)
  const lastCaretRef = useRef(value.length)
  const referenceSignature = references.map((reference) => `${reference.id}:${reference.mention}:${reference.url ?? ''}:${'kind' in reference ? reference.kind : 'image'}`).join('|')

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
      token.className = `inline-image-reference atomic-image-reference ${'kind' in reference && reference.kind === 'text' ? 'is-text-reference' : ''}`
      token.contentEditable = 'false'
      token.dataset.atomicMention = reference.mention
      let visual: HTMLElement
      if (reference.url) {
        const image = document.createElement('img')
        image.src = reference.url
        image.alt = ''
        visual = image
      } else {
        const glyph = document.createElement('span')
        glyph.className = 'atomic-text-reference-glyph'
        glyph.textContent = 'T'
        visual = glyph
      }
      const label = document.createElement('span')
      label.textContent = compactReferenceName(reference.name)
      label.title = reference.name
      const remove = document.createElement('button')
      remove.type = 'button'
      remove.className = 'atomic-reference-remove'
      remove.tabIndex = -1
      remove.textContent = '×'
      remove.dataset.removeTokenStart = String(sourceOffset)
      remove.dataset.removeTokenEnd = String(sourceOffset + reference.mention.length)
      remove.setAttribute('aria-label', `移除引用 ${reference.name}`)
      token.append(visual, label, remove)
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
      lastCaretRef.current = offset
    },
    getCaret() {
      return lastCaretRef.current
    },
  }), [])

  return (
    <div
      ref={rootRef}
      className={`atomic-prompt-editor ${value.trim() ? '' : 'is-empty'}`}
      contentEditable
      suppressContentEditableWarning
      role="textbox"
      aria-multiline="true"
      aria-label={ariaLabel}
      data-placeholder={placeholder}
      onCompositionStart={(event) => {
        composingRef.current = true
        // During IME composition the controlled value has not updated yet, but
        // the browser is already painting the phonetic buffer. Hide the stale
        // placeholder immediately so it never overlaps pinyin/zhuyin text.
        event.currentTarget.classList.remove('is-empty')
        event.currentTarget.dataset.composing = 'true'
      }}
      onCompositionEnd={(event) => {
        composingRef.current = false
        const root = event.currentTarget
        delete root.dataset.composing
        window.requestAnimationFrame(() => {
          if (!root.isConnected || composingRef.current) return
          const nextValue = readAtomicPrompt(root)
          if (lastEmittedValueRef.current === nextValue) return
          const cursor = getAtomicPromptCaret(root)
          lastCaretRef.current = cursor
          lastEmittedValueRef.current = nextValue
          root.classList.toggle('is-empty', !nextValue.trim())
          onChange(nextValue, cursor)
        })
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
        lastCaretRef.current = cursor
        lastEmittedValueRef.current = nextValue
        event.currentTarget.classList.toggle('is-empty', !nextValue.trim())
        onChange(nextValue, cursor)
      }}
      onClick={(event) => {
        lastCaretRef.current = getAtomicPromptCaret(event.currentTarget)
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
        if (event.key === 'Backspace') {
          const tokenRange = getAtomicBackwardTokenRange(event.currentTarget)
          if (tokenRange) {
            event.preventDefault()
            onRemoveToken(tokenRange.start, tokenRange.end)
            return
          }
        }
        if (event.key === 'Delete' && atomicDeleteTouchesToken(event.currentTarget, 'forward')) {
          event.preventDefault()
          return
        }
        onKeyDown(event)
      }}
      onKeyUp={(event) => {
        if (!event.nativeEvent.isComposing && !composingRef.current) {
          lastCaretRef.current = getAtomicPromptCaret(event.currentTarget)
        }
      }}
      onBlur={onBlur}
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

function getCanvasStylePresets(canvas: Pick<WorkspaceCanvas, 'styleReferenceName' | 'styleReferenceUrl' | 'styleReferences' | 'styleReferenceEnabled' | 'styleReferenceKeyword' | 'stylePresets'>): StylePresetRecord[] {
  if (Array.isArray(canvas.stylePresets)) {
    return canvas.stylePresets.map((preset, index) => ({
      id: preset.id || `style-preset-${index + 1}`,
      name: preset.name?.trim() || `风格预设 ${index + 1}`,
      keyword: preset.keyword ?? '',
      enabled: preset.enabled === true,
      collapsed: Boolean(preset.collapsed),
      references: Array.isArray(preset.references) ? preset.references.slice(0, 5) : [],
    }))
  }
  const references = canvas.styleReferences?.length
    ? canvas.styleReferences.slice(0, 5)
    : canvas.styleReferenceUrl
      ? [{
          id: 'legacy-style-reference',
          name: canvas.styleReferenceName || '风格参考图',
          url: canvas.styleReferenceUrl,
        }]
      : []
  return [{
    id: 'default-style-preset',
    name: '默认风格',
    keyword: canvas.styleReferenceKeyword ?? 'Disy',
    enabled: canvas.styleReferenceEnabled ?? false,
    collapsed: false,
    references,
  }]
}

function getCanvasPreviewUrl(canvas: Pick<WorkspaceCanvas, 'nodes'>) {
  const previewNode = [...(canvas.nodes as CanvasNode[])].reverse().find((node) => (
    (node.data.kind === 'image' || node.data.kind === 'upload') && Boolean(node.data.imageUrl)
  ))
  return previewNode?.data.imageUrl
}

function uniqueNamedImageReferences<T extends { name: string; url: string }>(references: T[]) {
  return Array.from(new Map(references.map((reference) => [reference.url, reference])).values())
}

function buildNumberedReferenceGuide(references: Array<{ name: string; url: string }>) {
  if (!references.length) return ''
  return [
    '参考图片编号（严格按输入图片上传顺序对应）：',
    ...references.map((reference, index) => {
      const number = index + 1
      return `图${number} / 图片${number} / 参考图${number} = 第 ${number} 张输入图片（@${reference.name}）`
    }),
    '提示词中出现“图1、图2、图3”等称呼时，必须按以上编号理解，不得交换图片顺序。',
  ].join('\n')
}

function getReferencedImageNumbers(prompt: string) {
  const numbers = new Set<number>()
  for (const match of prompt.matchAll(/(?:参考图|图片|图)\s*([1-9]\d*)/g)) {
    const number = Number(match[1])
    if (Number.isSafeInteger(number)) numbers.add(number)
  }
  return numbers
}

function numberAgentReferenceMentions(content: string, references: Array<{ name: string }>) {
  let cursor = 0
  let numbered = content
  references.forEach((reference, index) => {
    const mention = `@${reference.name}`
    const position = numbered.indexOf(mention, cursor)
    if (position < 0) return
    const replacement = `图${index + 1}（${mention}）`
    numbered = `${numbered.slice(0, position)}${replacement}${numbered.slice(position + mention.length)}`
    cursor = position + replacement.length
  })
  return numbered.trim()
}

function ensureAgentPlanReferenceContext(
  prompt: string,
  userRequest: string,
  references: Array<{ name: string; url: string }>,
) {
  if (!references.length) return prompt.trim()
  const marker = '【参考图执行关系】'
  return [
    marker,
    `用户原始要求：${userRequest}`,
    ...references.map((reference, index) => `图${index + 1}：@${reference.name}（第 ${index + 1} 张输入图片；用途严格按用户原始要求执行）`),
    '【生成要求】',
    prompt.trim(),
  ].join('\n')
}

function normalizeHistoricalAgentMessages(messages: AgentMessage[]) {
  return messages.map((message) => message.role === 'assistant'
    ? { ...message, content: normalizeAgentMessageContent(message.content) }
    : message)
}

function resolveStylePresets(presets: StylePresetRecord[], invocationText: string) {
  const normalizedText = invocationText.toLocaleLowerCase()
  const matchedPresets = presets.filter((preset) => {
    const keyword = preset.keyword.trim()
    return preset.enabled && preset.references.length > 0 && keyword.length > 0 && normalizedText.includes(keyword.toLocaleLowerCase())
  })
  const references = Array.from(new Map(
    matchedPresets.flatMap((preset) => preset.references).map((reference) => [reference.url, reference]),
  ).values())
  return { matchedPresets, references }
}

const mediaSignatureCache = new Map<string, string>()

function mediaSignature(value: string) {
  const cached = mediaSignatureCache.get(value)
  if (cached) return cached
  let hash = 2166136261
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index)
    hash = Math.imul(hash, 16777619)
  }
  const signature = `${value.length}:${(hash >>> 0).toString(36)}`
  mediaSignatureCache.set(value, signature)
  if (mediaSignatureCache.size > 256) {
    const oldest = mediaSignatureCache.keys().next().value
    if (oldest !== undefined) mediaSignatureCache.delete(oldest)
  }
  return signature
}

function buildCanvasSignature(
  nodes: CanvasNode[],
  edges: Edge[],
  name: string,
  stylePresets: StylePresetRecord[],
  promptSuffix: string,
  settingsLocked: boolean,
) {
  return JSON.stringify({
    name,
    stylePresets: stylePresets.map((preset) => ({
      ...preset,
      references: preset.references.map((reference) => ({
        id: reference.id,
        name: reference.name,
        url: mediaSignature(reference.url),
      })),
    })),
    promptSuffix,
    settingsLocked,
    nodes: nodes.map((node) => ({
      id: node.id,
      position: node.position,
      style: node.style,
      measured: node.measured,
      data: {
        ...node.data,
        imageUrl: node.data.imageUrl ? mediaSignature(node.data.imageUrl) : undefined,
        imageVariants: node.data.imageVariants?.map((variant) => ({
          ...variant,
          url: mediaSignature(variant.url),
        })),
        referenceImageUrl: node.data.referenceImageUrl ? mediaSignature(node.data.referenceImageUrl) : undefined,
        referenceImages: node.data.referenceImages?.map((reference) => ({
          id: reference.id,
          name: reference.name,
          url: mediaSignature(reference.url),
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
const MAX_CONCURRENT_GENERATION_TASKS = 10

const initialNodes: CanvasNode[] = []
const initialEdges: Edge[] = []

function duplicateNodeData(data: CanvasNode['data']): CanvasNode['data'] {
  const duplicate = structuredClone(data)
  if (duplicate.status === '生成中') duplicate.status = duplicate.imageUrl ? '已完成' : '待生成'
  return duplicate
}

function duplicateCanvasNode(node: CanvasNode, id: string, position: { x: number; y: number }, selected: boolean): CanvasNode {
  const measuredWidth = node.measured?.width
  const measuredHeight = node.measured?.height
  return {
    ...node,
    id,
    position,
    selected,
    dragging: false,
    measured: undefined,
    style: {
      ...node.style,
      ...(measuredWidth ? { width: measuredWidth } : {}),
      ...(measuredHeight ? { height: measuredHeight } : {}),
    },
    data: duplicateNodeData(node.data),
  }
}

function createCanvasHistorySnapshot(nodes: CanvasNode[], edges: Edge[]): CanvasHistorySnapshot {
  return {
    nodes: nodes.map((node) => ({
      ...node,
      data: node.data,
      position: { ...node.position },
      style: node.style ? { ...node.style } : node.style,
      selected: false,
      dragging: false,
      measured: undefined,
    })),
    edges: edges.map((edge) => ({ ...edge, data: edge.data, selected: false })),
  }
}

function canvasHistorySignature(snapshot: CanvasHistorySnapshot) {
  return buildCanvasSignature(snapshot.nodes, snapshot.edges, '', [], '', false)
}

const NodeCard = memo(function NodeCard({
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
  const updateNodeTitle = useContext(NodeTitleUpdateContext)
  const openImageGallery = useContext(ImageGalleryOpenContext)
  const openImagePreview = useContext(ImagePreviewOpenContext)
  const openImageTool = useContext(ImageToolOpenContext)
  const openExtensionMenu = useContext(NodeExtensionMenuContext)
  const setGroupCollapsed = useContext(GroupCollapseContext)
  const activeGenerationNodeIds = useContext(ActiveGenerationNodesContext)
  const isActivelyGenerating = activeGenerationNodeIds.has(id)
  const hasGenerationFailed = data.kind === 'image' && data.status === '生成失败'
  const [inlineEditing, setInlineEditing] = useState(false)
  const [inlineDraft, setInlineDraft] = useState(data.body)
  const inlineTextareaRef = useRef<HTMLTextAreaElement>(null)
  const inlineComposingRef = useRef(false)
  const [titleEditing, setTitleEditing] = useState(false)
  const [titleDraft, setTitleDraft] = useState(getNodeDisplayTitle(data))
  const groupCardRef = useRef<HTMLDivElement>(null)

  useGSAP(() => {
    if (data.kind !== 'group' || !groupCardRef.current) return
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const card = groupCardRef.current
    gsap.fromTo(card, {
      autoAlpha: reducedMotion ? 1 : 0.45,
      scale: reducedMotion ? 1 : data.groupCollapsed ? 0.88 : 1.025,
      transformOrigin: 'left top',
    }, {
      autoAlpha: 1,
      scale: 1,
      duration: reducedMotion ? 0 : 0.38,
      ease: 'power3.out',
      overwrite: 'auto',
      clearProps: 'transform,opacity,visibility',
    })
    if (!reducedMotion && data.groupCollapsed) {
      gsap.fromTo(card.querySelectorAll('.collapsed-group-preview img'), {
        autoAlpha: 0,
        y: 8,
        rotation: -2,
      }, {
        autoAlpha: 1,
        y: 0,
        rotation: 0,
        duration: 0.3,
        stagger: 0.045,
        ease: 'power2.out',
        overwrite: 'auto',
        clearProps: 'transform,opacity,visibility',
      })
    }
  }, { scope: groupCardRef, dependencies: [data.kind, data.groupCollapsed] })

  const commitNodeTitle = () => {
    const nextTitle = titleDraft.trim() || getNodeDisplayTitle(data)
    updateNodeTitle(id, nextTitle)
    setTitleDraft(nextTitle)
    setTitleEditing(false)
  }
  const nodeTitle = titleEditing
    ? <input className="node-title-input nodrag nowheel" autoFocus value={titleDraft} maxLength={48} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()} onChange={(event) => setTitleDraft(event.target.value)} onBlur={commitNodeTitle} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') { setTitleDraft(getNodeDisplayTitle(data)); setTitleEditing(false) } }} />
    : <span className="node-title-label" title="双击重命名" onDoubleClick={(event) => { event.stopPropagation(); setTitleDraft(getNodeDisplayTitle(data)); setTitleEditing(true) }}>{getNodeDisplayTitle(data)}</span>

  useEffect(() => {
    if (!inlineEditing) return
    const textarea = inlineTextareaRef.current
    textarea?.focus()
    textarea?.setSelectionRange(textarea.value.length, textarea.value.length)
  }, [inlineEditing])

  useEffect(() => {
    if (!inlineEditing) setInlineDraft(data.body)
  }, [data.body, inlineEditing])

  useEffect(() => {
    if (!titleEditing) setTitleDraft(getNodeDisplayTitle(data))
  }, [data.title, data.fileName, data.kind, titleEditing])

  if (data.kind === 'group') {
    if (data.groupCollapsed) {
      const previews = data.groupPreviewUrls ?? []
      const accent = data.groupAccentColor || '#78b7ef'
      const groupSurface = data.groupFolderColor || 'linear-gradient(135deg, #70e8f1 0%, #70b5ff 36%, #a793ff 68%, #f0a8d3 100%)'
      return (
        <div
          ref={groupCardRef}
          className={`canvas-group-node is-collapsed ${selected ? 'is-selected' : ''}`}
          style={{ background: groupSurface, '--group-handle': accent } as React.CSSProperties}
          onDoubleClick={(event) => {
            event.stopPropagation()
            setGroupCollapsed(id, false)
          }}
        >
          <Handle id="group-target-left" type="target" position={Position.Left} className="collapsed-group-handle" isConnectable={false} />
          <Handle id="group-target-top" type="target" position={Position.Top} className="collapsed-group-handle" isConnectable={false} />
          <Handle id="group-target-right" type="target" position={Position.Right} className="collapsed-group-handle" isConnectable={false} />
          <Handle id="group-target-bottom" type="target" position={Position.Bottom} className="collapsed-group-handle" isConnectable={false} />
          <Handle id="group-source-left" type="source" position={Position.Left} className="collapsed-group-handle" isConnectable={false} />
          <Handle id="group-source-top" type="source" position={Position.Top} className="collapsed-group-handle" isConnectable={false} />
          <Handle id="group-source-right" type="source" position={Position.Right} className="collapsed-group-handle" isConnectable={false} />
          <Handle id="group-source-bottom" type="source" position={Position.Bottom} className="collapsed-group-handle" isConnectable={false} />
          <div className={`collapsed-group-preview ${previews.length ? '' : 'is-empty'}`}>
            {previews.slice(0, 3).map((url, index) => <img key={`${url}-${index}`} src={url} alt="" draggable={false} />)}
            {!previews.length && <Folder size={34} strokeWidth={1.3} />}
          </div>
          <div className="collapsed-group-meta">
            <span className="collapsed-group-icon"><GroupTypeIcon icon={data.groupIcon} size={14} /></span>
            <div>{nodeTitle}<small>{data.groupNodeCount ?? 0} 个节点</small></div>
            <button
              type="button"
              className="collapsed-group-expand nodrag nowheel"
              title="展开编组"
              aria-label={`展开编组 ${getNodeDisplayTitle(data)}`}
              onPointerDown={(event) => event.stopPropagation()}
              onClick={(event) => {
                event.stopPropagation()
                setGroupCollapsed(id, false)
              }}
            ><Maximize2 size={13} /></button>
          </div>
        </div>
      )
    }
    return (
      <div
        ref={groupCardRef}
        className={`canvas-group-node ${selected ? 'is-selected' : ''}`}
        style={{ background: data.groupColor || 'rgba(72, 76, 73, .20)' }}
      >
        {selected && <NodeResizeControl
          position="bottom-right"
          minWidth={300}
          minHeight={220}
          maxWidth={1600}
          maxHeight={1200}
          className="group-node-resize-control"
        ><span className="resize-corner-glyph" /></NodeResizeControl>}
        <span><GroupTypeIcon icon={data.groupIcon} size={13} />{nodeTitle}</span>
      </div>
    )
  }

  const nodeHandles = (
    <>
      <Handle
        type="target"
        position={Position.Left}
        className="handle handle-target node-extension"
        title="引用该节点生成"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          openExtensionMenu(id, event.currentTarget, 'incoming')
        }}
      >
        <span className="extension-button extension-button-left" aria-hidden="true">
          <Plus size={18} strokeWidth={1.8} />
        </span>
      </Handle>
      <Handle
        type="source"
        position={Position.Right}
        className="handle handle-source node-extension"
        title="引用该节点生成"
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          openExtensionMenu(id, event.currentTarget, 'outgoing')
        }}
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
          {nodeTitle}
        </div>
        <div className="asset-image-frame">
          <div className="image-node-toolbelt nodrag nowheel" role="toolbar" aria-label="图片编辑工具">
            <button type="button" title="自由宫格切分" aria-label="自由宫格切分" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openImageTool(id, 'grid') }}><Grid3X3 size={14} /></button>
            <button type="button" title="自由区域扩图" aria-label="自由区域扩图" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openImageTool(id, 'expand') }}><Expand size={14} /></button>
            <button type="button" title="打光" aria-label="打光" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openImageTool(id, 'studio') }}><Lightbulb size={14} /></button>
            <button type="button" title="评论修改" aria-label="评论修改" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openImageTool(id, 'local-edit') }}><MessageCircle size={14} /></button>
            <button type="button" title="免费本地抠图" aria-label="免费本地抠图" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openImageTool(id, 'cutout') }}><Scissors size={14} /></button>
          </div>
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
      className={`disy-node ${data.kind === 'text' ? 'resizable-text-node' : ''} ${data.kind === 'image' ? 'image-generation-node' : ''} ${data.kind === 'image' && isActivelyGenerating ? 'is-generating' : ''} ${selected ? 'is-selected' : ''}`}
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
        {nodeTitle}
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
              <div className="image-node-toolbelt image-generation-toolbelt nodrag nowheel" role="toolbar" aria-label="图片编辑工具">
                <button type="button" title="自由宫格切分" aria-label="自由宫格切分" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openImageTool(id, 'grid') }}><Grid3X3 size={14} /></button>
                <button type="button" title="自由区域扩图" aria-label="自由区域扩图" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openImageTool(id, 'expand') }}><Expand size={14} /></button>
                <button type="button" title="打光" aria-label="打光" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openImageTool(id, 'studio') }}><Lightbulb size={14} /></button>
                <button type="button" title="评论修改" aria-label="评论修改" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openImageTool(id, 'local-edit') }}><MessageCircle size={14} /></button>
                <button type="button" title="免费本地抠图" aria-label="免费本地抠图" onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); openImageTool(id, 'cutout') }}><Scissors size={14} /></button>
              </div>
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
            isActivelyGenerating
              ? <LoaderCircle className="image-node-generation-icon is-spinning" size={24} aria-label="正在生成图片" />
              : <Sparkles className="image-node-generation-icon" size={22} aria-label="等待生成图片" />
          )}
        </div>
      ) : (
        inlineEditing ? (
          <textarea
            ref={inlineTextareaRef}
            className="inline-node-textarea nodrag nowheel"
            value={inlineDraft}
            maxLength={2000}
            placeholder="写下你的灵感…"
            aria-label="编辑文本节点内容"
            onPointerDown={(event) => event.stopPropagation()}
            onDoubleClick={(event) => event.stopPropagation()}
            onCompositionStart={() => { inlineComposingRef.current = true }}
            onCompositionEnd={(event) => {
              inlineComposingRef.current = false
              setInlineDraft(event.currentTarget.value)
              updateNodeText(id, event.currentTarget.value)
            }}
            onChange={(event) => {
              const nextValue = event.target.value
              setInlineDraft(nextValue)
              if (!inlineComposingRef.current) updateNodeText(id, nextValue)
            }}
            onBlur={(event) => {
              updateNodeText(id, event.currentTarget.value)
              setInlineEditing(false)
            }}
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
              setInlineDraft(data.body)
              setInlineEditing(true)
            }}
          >
            {data.body ? <MarkdownPreview content={data.body} /> : '双击开始编辑…'}
          </div>
        )
      )}

      {(isActivelyGenerating || hasGenerationFailed) && (
        <div className={`node-status ${hasGenerationFailed ? 'is-failed' : ''}`} title={data.generationError || data.status}>
          <span className="status-dot" />
          {hasGenerationFailed ? `生成失败：${data.generationError || '图像服务未返回结果'}` : data.status}
        </div>
      )}

      {nodeHandles}
    </div>
  )
})

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
  const [edges, setEdges, applyEdgesChange] = useEdgesState(initialEdges)
  const [imageTool, setImageTool] = useState<{ nodeId: string; mode: ImageToolMode } | null>(null)
  const [autoGenerateNodeId, setAutoGenerateNodeId] = useState<string | null>(null)
  const [gridGuides, setGridGuides] = useState({ vertical: [33.333, 66.667], horizontal: [33.333, 66.667] })
  const [customGrid, setCustomGrid] = useState({ columns: 3, rows: 3 })
  const [imageToolSourceSize, setImageToolSourceSize] = useState({ width: 1, height: 1 })
  const [expandInsets, setExpandInsets] = useState({ top: -15, right: -15, bottom: -15, left: -15 })
  const [expandSize, setExpandSize] = useState({ width: 1024, height: 1024 })
  const [expandRatio, setExpandRatio] = useState<'original' | ImageAspectRatio | 'custom'>('original')
  const [expandPrompt, setExpandPrompt] = useState('延展画面，保持主体、光线、材质与透视自然连续。')
  const [studioLighting, setStudioLighting] = useState({ yaw: 0, pitch: 0, intensity: 50, temperatureK: 5600, fill: true, rim: false, rimStrength: 20 })
  const [lightingView, setLightingView] = useState<'perspective' | 'front'>('front')
  const [localEditMarks, setLocalEditMarks] = useState<Array<{ id: string; x: number; y: number; prompt: string }>>([])
  const [cutoutProgress, setCutoutProgress] = useState<{ stage: string; progress?: number; detail?: string; failed?: boolean } | null>(null)
  const cutoutWorkerRef = useRef<Worker | null>(null)
  const [nodeMenu, setNodeMenu] = useState<NodeMenuState | null>(null)
  const [nodeContextMenu, setNodeContextMenu] = useState<NodeContextMenuState | null>(null)
  const [nodeClipboard, setNodeClipboard] = useState<NodeClipboard | null>(null)
  const [savedAssets, setSavedAssets] = useState<SavedAsset[]>(readSavedAssets)
  const [assetFolders, setAssetFolders] = useState<AssetFolder[]>(readAssetFolders)
  const [activeAssetFolderId, setActiveAssetFolderId] = useState<'all' | 'unfiled' | string>('all')
  const [newFolderName, setNewFolderName] = useState('')
  const [creatingFolder, setCreatingFolder] = useState(false)
  const [assetLibraryOpen, setAssetLibraryOpen] = useState(false)
  const [promptLibraryOpen, setPromptLibraryOpen] = useState(false)
  const [assetSearch, setAssetSearch] = useState('')
  const [assetScope, setAssetScope] = useState<'all' | 'current'>('all')
  const [assetThumbnailSize, setAssetThumbnailSize] = useState(132)
  const [assetLibraryPage, setAssetLibraryPage] = useState(1)
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([])
  const [selectedHistoryIds, setSelectedHistoryIds] = useState<string[]>([])
  const [libraryPreview, setLibraryPreview] = useState<LibraryPreview | null>(null)
  const [libraryPreviewDirection, setLibraryPreviewDirection] = useState(1)
  const [deleteConfirm, setDeleteConfirm] = useState<DeleteConfirm | null>(null)
  const [generationHistory, setGenerationHistory] = useState<GenerationRecord[]>(readGenerationHistory)
  const [brokenHistoryIds, setBrokenHistoryIds] = useState<string[]>([])
  const historyMediaObjectUrlsRef = useRef(new Map<string, string>())
  const historyArchiveAttemptedRef = useRef(new Set<string>())
  const [generationHistoryOpen, setGenerationHistoryOpen] = useState(false)
  const [generationHistorySearch, setGenerationHistorySearch] = useState('')
  const [historyThumbnailSize, setHistoryThumbnailSize] = useState(132)
  const [generationHistoryPage, setGenerationHistoryPage] = useState(1)
  const [imageGalleryThumbnailSize, setImageGalleryThumbnailSize] = useState(190)
  const [outputHistory, setOutputHistory] = useState<OutputHistoryRecord[]>(readOutputHistory)
  const [outputHistoryOpen, setOutputHistoryOpen] = useState(false)
  const [outputHistoryFilter, setOutputHistoryFilter] = useState<'all' | 'text' | 'image' | 'failed' | 'ops'>('all')
  const [outputHistorySearch, setOutputHistorySearch] = useState('')
  const [operatorUnlocked, setOperatorUnlocked] = useState(false)
  const [operatorPassDraft, setOperatorPassDraft] = useState('')
  const [operatorGateError, setOperatorGateError] = useState('')
  const [operatorLogs, setOperatorLogs] = useState<OperatorRecoveryLog[]>([])
  const [expandedOperatorLogId, setExpandedOperatorLogId] = useState<string | null>(null)
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
  const [textMentionOpen, setTextMentionOpen] = useState(false)
  const [textMentionQuery, setTextMentionQuery] = useState('')
  const [textMentionIndex, setTextMentionIndex] = useState(0)
  const [textMentionRange, setTextMentionRange] = useState<{ start: number; end: number } | null>(null)
  const [textReferencePreview, setTextReferencePreview] = useState<{ name: string; text: string; left: number; bottom: number } | null>(null)
  const [canvasReferencePickerNodeId, setCanvasReferencePickerNodeId] = useState<string | null>(null)
  const [referenceDropTargetNodeId, setReferenceDropTargetNodeId] = useState<string | null>(null)
  const [activeGenerationTaskKeys, setActiveGenerationTaskKeys] = useState<Set<string>>(new Set())
  const generationLoading = activeGenerationTaskKeys.size > 0
  const [toastMessage, setToastMessage] = useState<string | null>(null)
  const [transferProgress, setTransferProgress] = useState<string | null>(null)
  const [transferOpen, setTransferOpen] = useState(false)
  const [transferScope, setTransferScope] = useState<TransferScope>('project-replace')
  const [transferDropActive, setTransferDropActive] = useState(false)
  const [hasImportBackup, setHasImportBackup] = useState(false)
  const transferBusy = Boolean(transferProgress)
  const [showGrid, setShowGrid] = useState(true)
  const [canvasZoom, setCanvasZoom] = useState(1)
  const [canvasViewport, setCanvasViewport] = useState({ x: 0, y: 0 })
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
  const [generationControlMenuNodeId, setGenerationControlMenuNodeId] = useState<string | null>(null)
  const [draggedImageReferenceId, setDraggedImageReferenceId] = useState<string | null>(null)
  const [imageReferenceDropTargetId, setImageReferenceDropTargetId] = useState<string | null>(null)
  const [isNodeDragging, setIsNodeDragging] = useState(false)
  const altDragDuplicateRef = useRef<{ originalId: string; duplicateId: string; originalPosition: { x: number; y: number } } | null>(null)
  const [nodeOverlayRect, setNodeOverlayRect] = useState<{ left: number; top: number; width: number; height: number } | null>(null)
  const [selectedNodeIds, setSelectedNodeIds] = useState<string[]>([])
  const [selectionToolbarRect, setSelectionToolbarRect] = useState<SelectionToolbarRect | null>(null)
  const selectionToolbarRef = useRef<HTMLDivElement>(null)
  const [marqueeSelectionCommitted, setMarqueeSelectionCommitted] = useState(false)
  const [groupColorMenuOpen, setGroupColorMenuOpen] = useState(false)
  const [groupIconMenuOpen, setGroupIconMenuOpen] = useState(false)
  const [apiOpen, setApiOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [projectOpen, setProjectOpen] = useState(false)
  const [projectHomeOpen, setProjectHomeOpen] = useState(true)
  const projectHomeOpenRef = useRef(true)
  const [projectMenuOpen, setProjectMenuOpen] = useState(false)
  const [selectedProjectIds, setSelectedProjectIds] = useState<string[]>([])
  const [projectClipboard, setProjectClipboard] = useState<ProjectClipboardState | null>(null)
  const [projectContextMenu, setProjectContextMenu] = useState<ProjectContextMenuState | null>(null)
  const [createProjectOpen, setCreateProjectOpen] = useState(false)
  const [createProjectName, setCreateProjectName] = useState('')
  const [createProjectCanvasCount, setCreateProjectCanvasCount] = useState(1)
  const [createProjectBusy, setCreateProjectBusy] = useState(false)
  const [projectHomeView, setProjectHomeView] = useState<'grid' | 'list'>('grid')
  const [projectHomeSort, setProjectHomeSort] = useState<{ key: 'name' | 'createdAt' | 'updatedAt'; direction: 'asc' | 'desc' }>({ key: 'updatedAt', direction: 'desc' })
  const [persistedProjectContent, setPersistedProjectContent] = useState<Record<string, { nodeCount: number; activeCanvasNodeCount: number }>>({})

  const openApiSettings = useCallback((event?: React.SyntheticEvent) => {
    event?.preventDefault()
    event?.stopPropagation()
    setProjectContextMenu(null)
    setProjectMenuOpen(false)
    setCreateProjectOpen(false)
    setTransferOpen(false)
    setProjectOpen(false)
    setApiOpen(true)
  }, [])

  useEffect(() => {
    projectHomeOpenRef.current = projectHomeOpen
    const state = history.state && typeof history.state === 'object' ? history.state : {}
    if (projectHomeOpen) history.replaceState({ ...state, disyView: 'workspace' }, '')
    else if (history.state?.disyView !== 'project') history.pushState({ ...state, disyView: 'project' }, '')
  }, [projectHomeOpen])

  useEffect(() => {
    const handleBrowserBack = () => {
      if (agentOpenRef.current) {
        const state = history.state && typeof history.state === 'object' ? history.state : {}
        history.pushState({ ...state, disyView: 'project' }, '')
        setAgentOpen(false)
        setAgentCanvasPicking(false)
        return
      }
      if (!projectHomeOpenRef.current) {
        setProjectMenuOpen(false)
        setProjectOpen(false)
        setProjectHomeOpen(true)
      }
    }
    window.addEventListener('popstate', handleBrowserBack)
    return () => window.removeEventListener('popstate', handleBrowserBack)
  }, [])
  const [projectHomeSelectionMode, setProjectHomeSelectionMode] = useState(false)
  const [nodeSearchOpen, setNodeSearchOpen] = useState(false)
  const [nodeSearchQuery, setNodeSearchQuery] = useState('')
  useEffect(() => {
    if (!nodeSearchOpen) return
    const closeNodeSearchOutside = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.node-search-panel, [data-node-search-trigger]')) return
      setNodeSearchOpen(false)
    }
    document.addEventListener('pointerdown', closeNodeSearchOutside, true)
    return () => document.removeEventListener('pointerdown', closeNodeSearchOutside, true)
  }, [nodeSearchOpen])
  const [projectSearch, setProjectSearch] = useState('')
  const [projectRename, setProjectRename] = useState<{ id: string; draft: string; source: 'switcher' | 'modal' | 'home' } | null>(null)
  const [workspaceProjects, setWorkspaceProjects] = useState<WorkspaceProject[]>([])
  const [workspaceCanvases, setWorkspaceCanvases] = useState<WorkspaceCanvas[]>([])
  const [activeProjectId, setActiveProjectId] = useState(CURRENT_PROJECT_ID)
  const [activeCanvasId, setActiveCanvasId] = useState(`${CURRENT_PROJECT_ID}--canvas-default`)
  useEffect(() => {
    if (!projectHomeOpen) return
    let cancelled = false
    void Promise.all(workspaceProjects.map(async (project) => {
      const canvases = await listWorkspaceCanvases(project.id)
      return [project.id, {
        nodeCount: canvases.reduce((total, canvas) => total + canvas.nodes.length, 0),
        activeCanvasNodeCount: canvases.find((canvas) => canvas.id === project.activeCanvasId)?.nodes.length ?? 0,
      }] as const
    })).then((entries) => {
      if (!cancelled) setPersistedProjectContent(Object.fromEntries(entries))
    }).catch(() => {
      if (!cancelled) setPersistedProjectContent({})
    })
    return () => { cancelled = true }
  }, [projectHomeOpen, workspaceProjects])
  const [projectName, setProjectName] = useState('DisyLab')
  const [canvasSwitcherOpen, setCanvasSwitcherOpen] = useState(false)
  const [projectCardScale, setProjectCardScale] = useState(1)
  const [canvasCardScale, setCanvasCardScale] = useState(1)
  const [agentOpen, setAgentOpen] = useState(false)
  const agentOpenRef = useRef(false)
  const agentRequestRef = useRef<AbortController | null>(null)
  const agentRequestVersionRef = useRef(0)
  useEffect(() => {
    agentOpenRef.current = agentOpen
  }, [agentOpen])
  const [agentBusy, setAgentBusy] = useState(false)
  const [agentMessages, setAgentMessages] = useState<AgentMessage[]>([])
  const [agentPlans, setAgentPlans] = useState<AgentImagePlan[]>([])
  const [agentTextPlans, setAgentTextPlans] = useState<AgentTextPlan[]>([])
  const [agentReferences, setAgentReferences] = useState<AgentImageReference[]>([])
  const [agentPendingReferences, setAgentPendingReferences] = useState<AgentImageReference[]>([])
  const [agentConversationId, setAgentConversationId] = useState(() => `agent-session-${crypto.randomUUID()}`)
  const [agentConversationOptions, setAgentConversationOptions] = useState<{ id: string; title: string; updatedAt: string }[]>([])
  const [agentCanvasPicking, setAgentCanvasPicking] = useState(false)
  const [agentTextModelKey, setAgentTextModelKey] = useState('')
  const [agentImageModelKey, setAgentImageModelKey] = useState('')
  const [agentImageDefaults, setAgentImageDefaults] = useState<{
    aspectRatio: ImageAspectRatio
    resolution: ImageResolution
    detail: ImageDetail
    count: number
  }>({ aspectRatio: '1:1', resolution: '1K', detail: 'medium', count: 1 })
  const [canvasName, setCanvasName] = useState('DisyLab')
  const [canvasNameDraft, setCanvasNameDraft] = useState('DisyLab')
  const [canvasNameEditing, setCanvasNameEditing] = useState(false)
  const [canvasSaved, setCanvasSaved] = useState(true)
  const [projectSettingsOpen, setProjectSettingsOpen] = useState(false)
  const [projectSettingsLocked, setProjectSettingsLocked] = useState(false)
  const [stylePresets, setStylePresets] = useState<StylePresetRecord[]>([{
    id: 'default-style-preset',
    name: '默认风格',
    keyword: 'Disy',
    enabled: false,
    collapsed: false,
    references: [],
  }])
  const [projectPromptSuffix, setProjectPromptSuffix] = useState('')
  const [editingConnectionId, setEditingConnectionId] = useState<string>(apiSettings.connections[0]?.id ?? 'new')
  const [apiDraft, setApiDraft] = useState({ name: '', baseUrl: '', apiKey: '' })
  const [apiKeyVisible, setApiKeyVisible] = useState(false)
  const [draftModels, setDraftModels] = useState<ApiModelConfig[]>([])
  const [apiModelTab, setApiModelTab] = useState<ModelCapability>('text')
  const [apiError, setApiError] = useState('')
  const [apiAlert, setApiAlert] = useState<string | null>(null)

  const showApiAlert = useCallback((message: string) => {
    setApiError('')
    setModelsError('')
    setApiAlert(message)
  }, [])

  const shellRef = useRef<HTMLDivElement>(null)
  const projectHomeContentRef = useRef<HTMLDivElement>(null)
  const nodeMenuButtonRef = useRef<HTMLButtonElement>(null)
  const firstApiInputRef = useRef<HTMLInputElement>(null)
  const apiKeyInputRef = useRef<HTMLInputElement>(null)
  const apiButtonRef = useRef<HTMLButtonElement>(null)
  const canvasNameInputRef = useRef<HTMLInputElement>(null)
  const styleReferenceInputRef = useRef<HTMLInputElement>(null)
  const styleReferenceUploadTargetRef = useRef<{ presetId: string; referenceId?: string } | null>(null)
  const activeProjectIdRef = useRef(activeProjectId)
  const activeCanvasIdRef = useRef(activeCanvasId)
  const agentConversationIdRef = useRef(agentConversationId)
  const savedCanvasSignatureRef = useRef<string | null>(null)
  const canvasSavedRef = useRef(true)
  const autoSaveActionRef = useRef<() => void>(() => undefined)
  const editorTextareaRef = useRef<HTMLTextAreaElement>(null)
  const expandedTextareaRef = useRef<HTMLTextAreaElement>(null)
  const imagePromptEditorRef = useRef<AtomicPromptEditorHandle>(null)
  const textPromptEditorRef = useRef<AtomicPromptEditorHandle>(null)
  const overlayMeasureFrameRef = useRef<number | null>(null)
  const overlayMeasureTargetRef = useRef<string | null>(null)
  const imageInputRef = useRef<HTMLInputElement>(null)
  const generationReferenceInputRef = useRef<HTMLInputElement>(null)
  const generationReferenceNodeIdRef = useRef<string | null>(null)
  activeProjectIdRef.current = activeProjectId
  activeCanvasIdRef.current = activeCanvasId
  agentConversationIdRef.current = agentConversationId
  const assetUploadInputRef = useRef<HTMLInputElement>(null)
  const workspaceImportInputRef = useRef<HTMLInputElement>(null)
  const uploadPositionRef = useRef<{ x: number; y: number } | null>(null)
  const canvasPastePositionRef = useRef<{ x: number; y: number } | null>(null)
  const internalNodePastePreferredRef = useRef(false)
  const pasteSequenceRef = useRef(0)
  const modelFetchRequestRef = useRef(0)
  const autoModelFetchTimerRef = useRef<number | null>(null)
  const autoModelFetchKeyRef = useRef('')
  const generationTaskControllersRef = useRef(new Map<string, AbortController>())
  const generationTaskProjectIdsRef = useRef(new Map<string, string>())
  const generationTaskStopReasonRef = useRef(new Map<string, 'paused' | 'stopped'>())
  const agentPlanLocksRef = useRef(new Set<string>())
  const agentSaveTimerRef = useRef<number | null>(null)
  const aspectTweenRef = useRef<{ kill: () => void } | null>(null)
  const galleryWheelLockRef = useRef(false)
  const previewWheelLockRef = useRef(false)
  const latestSelectedNodeIdsRef = useRef<string[]>([])
  const latestSelectedEdgeIdsRef = useRef<string[]>([])
  const undoStackRef = useRef<CanvasHistorySnapshot[]>([])
  const redoStackRef = useRef<CanvasHistorySnapshot[]>([])
  const currentHistorySnapshotRef = useRef<CanvasHistorySnapshot | null>(null)
  const historyCaptureTimerRef = useRef<number | null>(null)
  const historyReadyRef = useRef(false)
  const { fitView: fitCanvas, screenToFlowPosition, setCenter, zoomTo, getInternalNode, getNodes } = useReactFlow<CanvasNode>()
  const updateNodeInternals = useUpdateNodeInternals()
  const reduceMotion = useReducedMotion()
  const resetCanvasHistory = useCallback((nextNodes: CanvasNode[], nextEdges: Edge[]) => {
    if (historyCaptureTimerRef.current !== null) window.clearTimeout(historyCaptureTimerRef.current)
    historyCaptureTimerRef.current = null
    undoStackRef.current = []
    redoStackRef.current = []
    currentHistorySnapshotRef.current = createCanvasHistorySnapshot(nextNodes, nextEdges)
    historyReadyRef.current = true
  }, [])
  const beginGenerationTask = (taskKey: string) => {
    if (generationTaskControllersRef.current.has(taskKey)) {
      setToastMessage('这个任务已经在生成中')
      return null
    }
    if (generationTaskControllersRef.current.size >= MAX_CONCURRENT_GENERATION_TASKS) {
      setToastMessage(`最多同时进行 ${MAX_CONCURRENT_GENERATION_TASKS} 个生成任务，请等待任一任务完成`)
      return null
    }
    const controller = new AbortController()
    generationTaskControllersRef.current.set(taskKey, controller)
    generationTaskProjectIdsRef.current.set(taskKey, activeProjectId)
    setActiveGenerationTaskKeys(new Set(generationTaskControllersRef.current.keys()))
    return controller
  }
  const finishGenerationTask = (taskKey: string) => {
    generationTaskControllersRef.current.delete(taskKey)
    generationTaskProjectIdsRef.current.delete(taskKey)
    generationTaskStopReasonRef.current.delete(taskKey)
    setActiveGenerationTaskKeys(new Set(generationTaskControllersRef.current.keys()))
  }
  const interruptGenerationTask = (nodeId: string, mode: 'paused' | 'stopped') => {
    const taskKey = `image:${nodeId}`
    const controller = generationTaskControllersRef.current.get(taskKey)
    if (!controller) {
      setGenerationControlMenuNodeId(null)
      setToastMessage('该节点当前没有正在进行的生成任务')
      return
    }
    const action = mode === 'paused' ? '暂停' : '停止'
    if (!window.confirm(`${action}只能终止 Disy 当前的等待和尚未发送的后续请求。\n\n已经提交给服务商的图片仍可能继续生成并扣除积分，无法保证退款或不扣费。确认${action}吗？`)) return
    generationTaskStopReasonRef.current.set(taskKey, mode)
    controller.abort()
    setNodes((current) => current.map((node) => node.id === nodeId
      ? { ...node, data: { ...node.data, status: mode === 'paused' ? '已暂停' : '已停止' } }
      : node))
    setGenerationControlMenuNodeId(null)
    setToastMessage(mode === 'paused' ? '任务已暂停；再次生成会从头发起请求' : '任务已停止')
  }

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
    if (!helpOpen) return
    const closeHelp = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setHelpOpen(false)
    }
    window.addEventListener('keydown', closeHelp)
    return () => window.removeEventListener('keydown', closeHelp)
  }, [helpOpen])

  useEffect(() => {
    if (!projectOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (transferOpen) return
      if (event.key === 'Escape') {
        if (projectRename?.source === 'modal') setProjectRename(null)
        setProjectOpen(false)
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [projectOpen, projectRename, transferOpen])

  useEffect(() => {
    if (!transferOpen) return
    const closeTransfer = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !transferBusy) {
        event.stopImmediatePropagation()
        setTransferOpen(false)
      }
    }
    window.addEventListener('keydown', closeTransfer, true)
    return () => window.removeEventListener('keydown', closeTransfer, true)
  }, [transferOpen, transferBusy])

  useEffect(() => {
    if (!projectMenuOpen) return
    const closeProjectMenu = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.brand-only, .project-brand-menu')) return
      setProjectMenuOpen(false)
    }
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProjectMenuOpen(false)
    }
    document.addEventListener('pointerdown', closeProjectMenu, true)
    window.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeProjectMenu, true)
      window.removeEventListener('keydown', closeWithEscape)
    }
  }, [projectMenuOpen])

  useEffect(() => {
    if (!projectContextMenu) return
    const closeProjectContextMenu = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.project-context-menu')) return
      setProjectContextMenu(null)
    }
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setProjectContextMenu(null)
    }
    document.addEventListener('pointerdown', closeProjectContextMenu, true)
    window.addEventListener('keydown', closeWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeProjectContextMenu, true)
      window.removeEventListener('keydown', closeWithEscape)
    }
  }, [projectContextMenu])

  useEffect(() => {
    if (!createProjectOpen || createProjectBusy) return
    const closeCreateProject = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setCreateProjectOpen(false)
    }
    window.addEventListener('keydown', closeCreateProject)
    return () => window.removeEventListener('keydown', closeCreateProject)
  }, [createProjectBusy, createProjectOpen])

  useEffect(() => {
    if (!projectHomeOpen) return
    const isEditableTarget = (target: EventTarget | null) => target instanceof HTMLElement
      && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName))
    const onProjectClipboardKeyDown = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || isEditableTarget(event.target)) return
      const key = event.key.toLowerCase()
      if (key === 'c') {
        const selectedId = selectedProjectIds[0] ?? activeProjectId
        if (!selectedId) return
        event.preventDefault()
        void copyProjectToClipboard(selectedId)
      } else if (key === 'v' && projectClipboard) {
        event.preventDefault()
        void pasteProjectFromClipboard()
      }
    }
    window.addEventListener('keydown', onProjectClipboardKeyDown)
    return () => window.removeEventListener('keydown', onProjectClipboardKeyDown)
  }, [activeProjectId, projectClipboard, projectHomeOpen, selectedProjectIds])

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
    // Never keep a leftover unlock across reloads.
    lockOperatorSession()
  }, [])

  useEffect(() => {
    if (!outputHistoryOpen) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      if (outputHistoryFilter === 'ops') lockOperatorView()
      setOutputHistoryOpen(false)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [outputHistoryOpen, outputHistoryFilter])

  useEffect(() => {
    try {
      if (outputHistory.length) localStorage.setItem(OUTPUT_HISTORY_KEY, JSON.stringify(outputHistory))
      else localStorage.removeItem(OUTPUT_HISTORY_KEY)
    } catch {
      // Output history remains available for the current session when storage is unavailable.
    }
  }, [outputHistory])

  useEffect(() => {
    try {
      const persistentHistory = generationHistory
        .filter((record) => record.mediaId || !record.imageUrl.startsWith('data:'))
        .map((record) => record.mediaId ? { ...record, imageUrl: '' } : record)
      if (persistentHistory.length) localStorage.setItem(GENERATION_HISTORY_KEY, JSON.stringify(persistentHistory))
      else localStorage.removeItem(GENERATION_HISTORY_KEY)
    } catch {
      // Base64 results remain available in this session when the quota is too small.
    }
  }, [generationHistory])

  useEffect(() => {
    const missingMedia = generationHistory.filter((record) => record.mediaId && !record.imageUrl)
    if (!missingMedia.length) return
    let cancelled = false
    void Promise.all(missingMedia.map(async (record) => {
      const media = await loadHistoryMedia(record.mediaId!)
      if (!media) return null
      const url = URL.createObjectURL(media.blob)
      historyMediaObjectUrlsRef.current.set(record.mediaId!, url)
      return { id: record.id, url }
    })).then((loaded) => {
      if (cancelled) {
        loaded.forEach((item) => {
          if (item) URL.revokeObjectURL(item.url)
        })
        return
      }
      const urlByRecordId = new Map(loaded.filter((item): item is { id: string; url: string } => Boolean(item)).map((item) => [item.id, item.url]))
      const loadedIds = new Set(urlByRecordId.keys())
      const unavailableIds = missingMedia.filter((record) => !loadedIds.has(record.id)).map((record) => record.id)
      if (unavailableIds.length) {
        setBrokenHistoryIds((current) => Array.from(new Set([...current, ...unavailableIds])))
      }
      if (urlByRecordId.size) {
        setGenerationHistory((current) => current.map((record) => {
          const imageUrl = urlByRecordId.get(record.id)
          return imageUrl ? { ...record, imageUrl } : record
        }))
      }
    })
    return () => {
      cancelled = true
    }
  }, [generationHistory])

  useEffect(() => () => {
    historyMediaObjectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    historyMediaObjectUrlsRef.current.clear()
  }, [])

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
      showApiAlert('请先填写当前连接的接口地址和 API Key')
      return
    }
    // Editing a saved credential invalidates every model fetched with the old
    // one before any new lookup begins. This keeps stale choices out of nodes
    // even when the lookup itself fails.
    const savedConnection = apiSettings.connections.find((connection) => connection.id === editingConnectionId)
    const credentialsChanged = Boolean(savedConnection && (
      savedConnection.apiKey.trim() !== apiDraft.apiKey.trim()
      || savedConnection.baseUrl.replace(/\/$/, '') !== apiDraft.baseUrl.trim().replace(/\/$/, '')
    ))
    if (credentialsChanged && savedConnection) {
      const connections = apiSettings.connections.map((connection) => connection.id === savedConnection.id
        ? { ...connection, models: [], modelsFetchedAt: undefined, disconnected: true }
        : connection)
      const { selectedTextModel, selectedImageModel } = pickValidSelections(connections, apiSettings)
      saveApiSettings({ connections, selectedTextModel, selectedImageModel })
      setDraftModels([])
    }
    setModelsLoading(true)
    setModelsError('')
    const requestId = ++modelFetchRequestRef.current
    try {
      await validateApiCredentials({ baseUrl: apiDraft.baseUrl.trim(), apiKey: apiDraft.apiKey.trim() })
      const models = await fetchRemoteModels({ baseUrl: apiDraft.baseUrl.trim(), apiKey: apiDraft.apiKey.trim() })
      if (requestId !== modelFetchRequestRef.current) return
      const mapped = models.map((model) => ({ ...model, enabled: isModelAutoEnabled(model) }))
      const nextDraftModels = models.map((model) => {
        const current = draftModels
        const existing = current.find((item) => item.id === model.id)
        return { ...model, enabled: existing ? existing.enabled : isModelAutoEnabled(model) }
      })
      setDraftModels(nextDraftModels)
      const preferredText = pickPreferredModelId(mapped, 'text')
      const preferredImage = pickPreferredModelId(mapped, 'image')
      if (editingConnectionId !== 'new') {
        const nextSettings = { ...apiSettings,
          selectedTextModel: apiSettings.selectedTextModel ?? (preferredText ? { connectionId: editingConnectionId, modelId: preferredText } : undefined),
          selectedImageModel: apiSettings.selectedImageModel ?? (preferredImage ? { connectionId: editingConnectionId, modelId: preferredImage } : undefined),
        }
        saveApiSettings(nextSettings)
      }
      if (!models.length) showApiAlert('接口没有返回可用模型')
    } catch (error) {
      if (requestId !== modelFetchRequestRef.current) return
      setDraftModels([])
      showApiAlert(error instanceof Error ? error.message : '模型列表读取失败')
    } finally {
      if (requestId === modelFetchRequestRef.current) setModelsLoading(false)
    }
  }, [apiDraft.apiKey, apiDraft.baseUrl, apiSettings, draftModels, editingConnectionId, saveApiSettings, showApiAlert])

  // Auto-fetch the model catalog (debounced ~600ms) when both baseUrl and apiKey are
  // filled and this connection has not fetched a catalog yet. Uses a ref key so it never
  // re-triggers while the user is typing the same connection, and only fires while
  // draftModels is empty — preserving any manual edits the user has made.
  useEffect(() => {
    const key = `${apiDraft.baseUrl}|${apiDraft.apiKey}`
    const canAutoFetch = apiDraft.baseUrl.trim() !== '' && apiDraft.apiKey.trim() !== '' && draftModels.length === 0
    if (!canAutoFetch) {
      autoModelFetchKeyRef.current = ''
      return
    }
    if (autoModelFetchKeyRef.current === key) return
    autoModelFetchKeyRef.current = key
    if (autoModelFetchTimerRef.current !== null) window.clearTimeout(autoModelFetchTimerRef.current)
    autoModelFetchTimerRef.current = window.setTimeout(() => {
      autoModelFetchTimerRef.current = null
      void refreshRemoteModels()
    }, 600)
    return () => {
      if (autoModelFetchTimerRef.current !== null) {
        window.clearTimeout(autoModelFetchTimerRef.current)
        autoModelFetchTimerRef.current = null
      }
    }
  }, [apiDraft.baseUrl, apiDraft.apiKey, draftModels.length, refreshRemoteModels])

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
    const hydrate = (canvas: WorkspaceCanvas, owner?: WorkspaceProject) => {
      const restoredNodes = (canvas.nodes as CanvasNode[]).map((node) => {
        if (node.data.kind === 'text' && node.data.promptText === undefined) {
          return { ...node, data: { ...node.data, promptText: node.data.body } }
        }
        if (node.data.kind === 'image') {
          return { ...node, style: { ...node.style, ...getImageGenerationNodeSize(node.data.imageAspectRatio ?? '1:1') } }
        }
        return node
      })
      const restoredEdges = canvas.edges as Edge[]
      resetCanvasHistory(restoredNodes, restoredEdges)
      setNodes(restoredNodes)
      setEdges(restoredEdges)
      setActiveCanvasId(canvas.id)
      setActiveProjectId(canvas.projectId)
      setProjectName(owner?.name ?? 'DisyLab')
      setCanvasName(canvas.name)
      setCanvasNameDraft(canvas.name)
      const restoredStylePresets = getCanvasStylePresets(canvas)
      setStylePresets(restoredStylePresets)
      setProjectPromptSuffix(canvas.promptSuffix)
      setProjectSettingsLocked(canvas.settingsLocked)
      savedCanvasSignatureRef.current = buildCanvasSignature(
        restoredNodes,
        restoredEdges,
        canvas.name,
        restoredStylePresets,
        canvas.promptSuffix,
        canvas.settingsLocked,
      )
      setCanvasSaved(true)
    }
    void (async () => {
      await loadLocalProject(CURRENT_PROJECT_ID)
      let projects = await listWorkspaceProjects()
      const workspaceInitialized = localStorage.getItem(WORKSPACE_INITIALIZED_KEY) === '1'
      if (!projects.length && !workspaceInitialized) {
        const created = await createWorkspaceProject('第一张画布')
        projects = [created.project]
      }
      if (!projects.length) {
        if (!cancelled) {
          setWorkspaceProjects([])
          setProjectHomeOpen(true)
        }
        return
      }
      if (!workspaceInitialized && projects.length === 1 && /^新项目\s*1$/.test(projects[0].name)) {
        const renamed = await renameWorkspaceProject(projects[0].id, '第一张画布')
        projects = [renamed]
      }
      localStorage.setItem(WORKSPACE_INITIALIZED_KEY, '1')
      if (cancelled) return
      const preferredProjectId = localStorage.getItem(ACTIVE_PROJECT_KEY)
      const owner = projects.find((project) => project.id === preferredProjectId) ?? projects[0]
      localStorage.setItem(ACTIVE_PROJECT_KEY, owner.id)
      const canvases = await listWorkspaceCanvases(owner.id)
      const canvas = canvases.find((item) => item.id === owner.activeCanvasId) ?? canvases[0]
      if (!canvas || cancelled) return
      setWorkspaceProjects(projects)
      setWorkspaceCanvases(canvases)
      setProjectHomeOpen(true)
      hydrate(canvas, owner)
      const sessions = await listAgentSessions(canvas.id)
      if (cancelled) return
      setAgentConversationOptions(sessions.map((item) => ({ id: item.id, title: item.title || 'Disy 对话', updatedAt: item.updatedAt })))
      const activeSession = sessions[0]
      setAgentConversationId(activeSession?.id ?? `${canvas.id}--agent-${crypto.randomUUID()}`)
      setAgentMessages(normalizeHistoricalAgentMessages((activeSession?.messages as AgentMessage[] | undefined) ?? []))
      const storedPlans = (activeSession?.plans as Array<AgentImagePlan | AgentTextPlan> | undefined) ?? []
      const interruptedPlans = storedPlans.filter((plan): plan is AgentImagePlan => 'prompt' in plan)
      setAgentTextPlans(storedPlans.filter((plan): plan is AgentTextPlan => 'content' in plan))
      const interruptedNodeIds = new Set(interruptedPlans.filter((plan) => plan.status === 'running' && plan.nodeId).map((plan) => plan.nodeId))
      if (interruptedNodeIds.size) setNodes((current) => current.map((node) => interruptedNodeIds.has(node.id) ? { ...node, data: { ...node.data, status: '生成失败' } } : node))
      setAgentPlans(interruptedPlans.map((plan) => plan.status === 'running' ? { ...plan, status: 'failed', error: '上次生成在应用关闭时中断，请在对应图像节点中手动重试。' } : plan))
      setAgentTextModelKey(activeSession?.selectedChatModelId ?? '')
      setAgentImageModelKey(activeSession?.selectedImageModelId ?? '')
    })().catch(() => {
      if (!cancelled) setToastMessage('本地项目读取失败')
    })
    return () => {
      cancelled = true
    }
  }, [resetCanvasHistory, setEdges, setNodes])

  useEffect(() => {
    if (!historyReadyRef.current) return
    if (historyCaptureTimerRef.current !== null) window.clearTimeout(historyCaptureTimerRef.current)
    historyCaptureTimerRef.current = window.setTimeout(() => {
      const nextSnapshot = createCanvasHistorySnapshot(nodes, edges)
      const previous = currentHistorySnapshotRef.current
      if (previous && canvasHistorySignature(previous) !== canvasHistorySignature(nextSnapshot)) {
        undoStackRef.current = [...undoStackRef.current.slice(-79), previous]
        redoStackRef.current = []
      }
      currentHistorySnapshotRef.current = nextSnapshot
      historyCaptureTimerRef.current = null
    }, 220)
    return () => {
      if (historyCaptureTimerRef.current !== null) window.clearTimeout(historyCaptureTimerRef.current)
    }
  }, [edges, nodes])

  useEffect(() => {
    const flushPendingHistory = () => {
      if (historyCaptureTimerRef.current !== null) window.clearTimeout(historyCaptureTimerRef.current)
      historyCaptureTimerRef.current = null
      const actual = createCanvasHistorySnapshot(nodes, edges)
      const previous = currentHistorySnapshotRef.current
      if (previous && canvasHistorySignature(previous) !== canvasHistorySignature(actual)) {
        undoStackRef.current = [...undoStackRef.current.slice(-79), previous]
        redoStackRef.current = []
      }
      currentHistorySnapshotRef.current = actual
      return actual
    }
    const applySnapshot = (snapshot: CanvasHistorySnapshot) => {
      currentHistorySnapshotRef.current = snapshot
      setNodes(snapshot.nodes.map((node) => ({
        ...node,
        position: { ...node.position },
        style: node.style ? { ...node.style } : node.style,
      })))
      setEdges(snapshot.edges.map((edge) => ({ ...edge })))
      setActiveEditorNodeId(null)
      setActiveImageNodeId(null)
      setActiveGenerationNodeId(null)
      setExpandedEditorNodeId(null)
      setNodeOverlayRect(null)
      setNodeMenu(null)
      setNodeContextMenu(null)
      setGenerationControlMenuNodeId(null)
    }
    const onHistoryShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey)) return
      const key = event.key.toLowerCase()
      const wantsUndo = key === 'z' && !event.shiftKey
      const wantsRedo = key === 'y' || (key === 'z' && event.shiftKey)
      if (!wantsUndo && !wantsRedo) return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return
      event.preventDefault()
      if (generationLoading || agentBusy) {
        setToastMessage('生成任务进行中，完成或停止后才能撤销画布操作')
        return
      }
      const actual = flushPendingHistory()
      if (wantsUndo) {
        const previous = undoStackRef.current.pop()
        if (!previous) {
          setToastMessage('没有可以撤销的操作')
          return
        }
        redoStackRef.current = [...redoStackRef.current.slice(-79), actual]
        applySnapshot(previous)
        setToastMessage('已撤销上一步操作')
        return
      }
      const next = redoStackRef.current.pop()
      if (!next) {
        setToastMessage('没有可以重做的操作')
        return
      }
      undoStackRef.current = [...undoStackRef.current.slice(-79), actual]
      applySnapshot(next)
      setToastMessage('已重做操作')
    }
    window.addEventListener('keydown', onHistoryShortcut)
    return () => window.removeEventListener('keydown', onHistoryShortcut)
  }, [agentBusy, edges, generationLoading, nodes, setEdges, setNodes])

  useEffect(() => {
    let cancelled = false
    const legacyAssets = readSavedAssets()
    void loadLocalAssets<SavedAsset>().then(async (storedAssets) => {
      if (cancelled) return
      if (storedAssets) {
        setSavedAssets(storedAssets)
        return
      }
      if (!legacyAssets.length) return
      await saveLocalAssets(legacyAssets)
      if (cancelled) return
      setSavedAssets(legacyAssets)
      localStorage.removeItem('disy-saved-assets')
    }).catch((error) => {
      if (!cancelled) setToastMessage(`资产库读取失败：${error instanceof Error ? error.message : '浏览器存储不可用'}`)
    })
    return () => { cancelled = true }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const signature = buildCanvasSignature(
        nodes,
        edges,
        canvasName,
        stylePresets,
        projectPromptSuffix,
        projectSettingsLocked,
      )
      if (savedCanvasSignatureRef.current === null) {
        savedCanvasSignatureRef.current = signature
        setCanvasSaved(true)
        return
      }
      setCanvasSaved(signature === savedCanvasSignatureRef.current)
    }, 160)
    return () => window.clearTimeout(timer)
  }, [canvasName, edges, nodes, projectPromptSuffix, projectSettingsLocked, stylePresets])

  useEffect(() => {
    if (!toastMessage || transferBusy) return
    const timer = window.setTimeout(() => setToastMessage(null), 3200)
    return () => window.clearTimeout(timer)
  }, [toastMessage, transferBusy])

  useEffect(() => () => cutoutWorkerRef.current?.terminate(), [])

  useEffect(() => {
    if (!transferOpen) return
    let cancelled = false
    void loadWorkspaceImportBackup().then((backup) => {
      if (!cancelled) setHasImportBackup(Boolean(backup))
    }).catch(() => {
      if (!cancelled) setHasImportBackup(false)
    })
    return () => { cancelled = true }
  }, [transferOpen])

  useEffect(() => {
    if (!canvasSwitcherOpen) return
    const closeCanvasSwitcher = (event: PointerEvent) => {
      const target = event.target
      if (target instanceof Element && target.closest('.canvas-identity-button, .canvas-switcher-menu')) return
      if (projectRename?.source === 'switcher') setProjectRename(null)
      setCanvasSwitcherOpen(false)
    }
    const closeCanvasSwitcherWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (projectRename?.source === 'switcher') setProjectRename(null)
        setCanvasSwitcherOpen(false)
      }
    }
    document.addEventListener('pointerdown', closeCanvasSwitcher, true)
    window.addEventListener('keydown', closeCanvasSwitcherWithEscape)
    return () => {
      document.removeEventListener('pointerdown', closeCanvasSwitcher, true)
      window.removeEventListener('keydown', closeCanvasSwitcherWithEscape)
    }
  }, [canvasSwitcherOpen, projectRename])

  const persistCurrentAgentConversation = useCallback(async () => {
    if (!activeProjectId || !activeCanvasId) return
    const now = new Date().toISOString()
    const title = agentMessages[0]?.content.slice(0, 36) || '新的对话'
    await saveAgentSession({
      id: agentConversationId,
      projectId: activeProjectId,
      canvasId: activeCanvasId,
      title,
      messages: agentMessages,
      plans: [...agentPlans, ...agentTextPlans],
      selectedChatModelId: agentTextModelKey,
      selectedImageModelId: agentImageModelKey,
      createdAt: agentMessages[0]?.createdAt ?? now,
      updatedAt: now,
    })
    setAgentConversationOptions((current) => [{ id: agentConversationId, title, updatedAt: now }, ...current.filter((item) => item.id !== agentConversationId)].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)))
  }, [activeCanvasId, activeProjectId, agentConversationId, agentImageModelKey, agentMessages, agentPlans, agentTextModelKey, agentTextPlans])

  useEffect(() => {
    if (!activeProjectId || !activeCanvasId) return
    agentSaveTimerRef.current = window.setTimeout(() => {
      agentSaveTimerRef.current = null
      void persistCurrentAgentConversation().catch(() => undefined)
    }, 500)
    return () => {
      if (agentSaveTimerRef.current !== null) window.clearTimeout(agentSaveTimerRef.current)
      agentSaveTimerRef.current = null
    }
  }, [activeCanvasId, activeProjectId, persistCurrentAgentConversation])

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
    setGenerationControlMenuNodeId(null)
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
      const uploadedNodes: CanvasNode[] = files.map((file, index) => {
        const extension = file.type.split('/')[1]?.replace('jpeg', 'jpg') || 'png'
        const fileName = file.name || `clipboard-image-${timestamp}-${index + 1}.${extension}`
        return {
          id: `upload-${timestamp}-${index}`,
          type: 'disy',
          position: {
            x: position.x + index * 34,
            y: position.y + index * 34,
          },
          data: {
            kind: 'upload',
            title: fileName,
            body: '',
            fileName,
            imageUrl: imageUrls[index],
          },
        }
      })
      setNodes((current) => [...current, ...uploadedNodes])
      setToastMessage(files.length > 1 ? `已上传 ${files.length} 张图片` : '图片已加入画布')
    } catch {
      setToastMessage('图片读取失败，请重新选择')
    }
  }, [setNodes])

  const addPromptCaseImage = useCallback((item: PromptLibraryCase, position?: { x: number; y: number }) => {
    const center = position || screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const id = `prompt-reference-${item.id}-${Date.now()}`
    setNodes((current) => [...current, {
      id,
      type: 'disy',
      position: { x: center.x - 130, y: center.y - 110 },
      data: {
        kind: 'upload',
        title: item.title,
        body: `提示库案例 · ${item.sourceLabel || '来源见案例详情'}`,
        fileName: `prompt-case-${item.id}.webp`,
        imageUrl: item.image,
      },
    }])
    setPromptLibraryOpen(false)
    setToastMessage('参考图已加入画布，可继续拖拽或连接到生成节点')
    window.requestAnimationFrame(() => measureNodeOverlay(id))
  }, [measureNodeOverlay, screenToFlowPosition, setNodes])

  const addPromptCaseNode = useCallback((item: PromptLibraryCase) => {
    const center = screenToFlowPosition({ x: window.innerWidth / 2, y: window.innerHeight / 2 })
    const id = `prompt-case-${item.id}-${Date.now()}`
    setNodes((current) => [...current, {
      id,
      type: 'disy',
      position: { x: center.x - 150, y: center.y - 120 },
      data: {
        kind: 'image',
        title: item.title,
        body: item.prompt,
        promptText: item.prompt,
        imageUrl: item.image,
        fileName: `prompt-${item.id}.webp`,
        referenceImageUrl: item.image,
        referenceImageName: `案例 ${item.id} · ${item.title}`,
      },
    }])
    setPromptLibraryOpen(false)
    setActiveGenerationNodeId(id)
    setToastMessage('案例 Prompt 与参考图已写入新的图像节点')
    window.requestAnimationFrame(() => measureNodeOverlay(id))
  }, [measureNodeOverlay, screenToFlowPosition, setNodes])

  const openImagePicker = useCallback((position: { x: number; y: number }) => {
    uploadPositionRef.current = position
    closeAllMenus()
    imageInputRef.current?.click()
  }, [closeAllMenus])

  useEffect(() => {
    const rememberCanvasPointer = (event: PointerEvent) => {
      const target = event.target
      canvasPastePositionRef.current = target instanceof Element && target.closest('.react-flow')
        ? { x: event.clientX, y: event.clientY }
        : null
    }
    const clearPasteContext = () => {
      internalNodePastePreferredRef.current = false
      canvasPastePositionRef.current = null
    }
    const clearHiddenContext = () => {
      if (document.hidden) clearPasteContext()
    }
    window.addEventListener('pointermove', rememberCanvasPointer, { passive: true })
    window.addEventListener('pointerdown', rememberCanvasPointer, { passive: true })
    window.addEventListener('blur', clearPasteContext)
    document.addEventListener('visibilitychange', clearHiddenContext)
    return () => {
      window.removeEventListener('pointermove', rememberCanvasPointer)
      window.removeEventListener('pointerdown', rememberCanvasPointer)
      window.removeEventListener('blur', clearPasteContext)
      document.removeEventListener('visibilitychange', clearHiddenContext)
    }
  }, [])

  const connectionCreatesCycle = useCallback((sourceId: string, targetId: string) => {
    if (sourceId === targetId) return true
    const outgoing = new Map<string, string[]>()
    edges.forEach((edge) => outgoing.set(edge.source, [...(outgoing.get(edge.source) ?? []), edge.target]))
    const pending = [targetId]
    const visited = new Set<string>()
    while (pending.length) {
      const current = pending.pop()!
      if (current === sourceId) return true
      if (visited.has(current)) continue
      visited.add(current)
      pending.push(...(outgoing.get(current) ?? []))
    }
    return false
  }, [edges])

  const onConnect = useCallback(
    (connection: Connection) => {
      const source = nodes.find((node) => node.id === connection.source)
      const target = nodes.find((node) => node.id === connection.target)
      if (!source || !target || source.id === target.id) return
      if (connectionCreatesCycle(source.id, target.id)) {
        setToastMessage('该连接会形成循环引用')
        return
      }
      setEdges((current) =>
        current.some((edge) => edge.source === source.id && edge.target === target.id)
          ? current
          :
        addEdge(
          { ...connection, type: 'luminous', data: { referenceSelected: true } },
          current,
        ),
      )
      closeAllMenus()
    },
    [closeAllMenus, connectionCreatesCycle, nodes, setEdges],
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
        if (connectionCreatesCycle(sourceNodeId, targetNodeId)) {
          setToastMessage('该连接会形成循环引用')
          return
        }
        setEdges((current) =>
          current.some((edge) => edge.source === sourceNodeId && edge.target === targetNodeId)
            ? current
            :
          addEdge(
            {
              id: `${sourceNodeId}-${targetNodeId}-${Date.now()}`,
              source: sourceNodeId,
              target: targetNodeId,
              type: 'luminous',
              data: { referenceSelected: true },
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
    [closeAllMenus, closeContextMenu, connectionCreatesCycle, screenToFlowPosition, setEdges],
  )

  const createNode = (kind: CreatableNodeKind, positionOverride?: { x: number; y: number }) => {
    const titles: Record<CreatableNodeKind, string> = {
      text: '文本',
      image: '图像',
      upload: '新上传',
    }
    const bodies: Record<CreatableNodeKind, string> = {
      text: '',
      image: '',
      upload: '上传一张参考图。',
    }
    const id = `${kind}-${Date.now()}`
    const connectionSourceId = positionOverride ? undefined : nodeMenu?.connectionSourceId
    // A node created from the right-hand handle is a downstream generation.
    // Keep its generation settings in lockstep with the upstream image node.
    const upstreamImageNode = connectionSourceId && nodeMenu?.connectionDirection !== 'incoming'
      ? nodes.find((node) => node.id === connectionSourceId && node.data.kind === 'image')
      : undefined
    const inheritedImageOptions = upstreamImageNode ? {
      imageAspectRatio: upstreamImageNode.data.imageAspectRatio ?? '1:1' as ImageAspectRatio,
      imageResolution: upstreamImageNode.data.imageResolution ?? '1K' as ImageResolution,
      imageDetail: upstreamImageNode.data.imageDetail ?? 'medium' as ImageDetail,
      ...(upstreamImageNode.data.imageModelConnectionId ? { imageModelConnectionId: upstreamImageNode.data.imageModelConnectionId } : {}),
      ...(upstreamImageNode.data.imageModelId ? { imageModelId: upstreamImageNode.data.imageModelId } : {}),
      ...(upstreamImageNode.data.imageModelName ? { imageModelName: upstreamImageNode.data.imageModelName } : {}),
    } : {
      imageAspectRatio: '1:1' as ImageAspectRatio,
      imageResolution: '1K' as ImageResolution,
      imageDetail: 'medium' as ImageDetail,
    }
    const menuAnchor = { x: nodeMenu?.flowX ?? 360, y: nodeMenu?.flowY ?? 260 }
    const imageSize = getImageGenerationNodeSize(inheritedImageOptions.imageAspectRatio)
    const menuPosition = kind === 'text'
      ? { x: menuAnchor.x - 137.5, y: menuAnchor.y - 63 }
      : kind === 'image'
        ? { x: menuAnchor.x - imageSize.width / 2, y: menuAnchor.y - imageSize.height / 2 }
        : { x: menuAnchor.x - 130, y: menuAnchor.y - 110 }

    const focusConnectedImage = Boolean(connectionSourceId && kind === 'image')
    setNodes((current) => [
      ...(focusConnectedImage ? current.map((node) => ({ ...node, selected: false })) : current),
      {
        id,
        type: 'disy',
        position: positionOverride ?? menuPosition,
        selected: focusConnectedImage,
        ...(kind === 'text'
          ? { style: { width: 275, height: 126 } }
          : kind === 'image'
            ? { style: imageSize }
            : {}),
        data: {
          kind,
          title: titles[kind],
          body: bodies[kind],
          ...(kind === 'text' ? { promptText: '' } : {}),
          ...(kind === 'image' ? {
            status: '待生成',
            ...inheritedImageOptions,
          } : {}),
        },
      },
    ])

    if (connectionSourceId && (kind === 'image' || kind === 'text')) {
      const incoming = nodeMenu?.connectionDirection === 'incoming'
      setEdges((current) =>
        addEdge(
          {
            id: `${connectionSourceId}-${id}`,
            source: incoming ? id : connectionSourceId,
            target: incoming ? connectionSourceId : id,
            type: 'luminous',
            data: { referenceSelected: true },
          },
          current,
        ),
      )
    }
    if (focusConnectedImage) {
      setActiveEditorNodeId(null)
      setActiveImageNodeId(null)
      setActiveGenerationNodeId(id)
      window.requestAnimationFrame(() => measureNodeOverlay(id))
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

  const createAgentTextNode = (content: string, title = 'Agent 文本') => {
    const body = content.trim()
    if (!body) return null
    const id = `text-agent-${crypto.randomUUID()}`
    const position = screenToFlowPosition({
      x: Math.max(320, window.innerWidth - (agentOpen ? 660 : 420)),
      y: Math.max(180, window.innerHeight * 0.3),
    })
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      {
        id,
        type: 'disy',
        position,
        selected: true,
        style: { width: 360, height: 210 },
        data: { kind: 'text', title, body, promptText: '' },
      },
    ])
    setActiveImageNodeId(null)
    setActiveGenerationNodeId(null)
    setActiveEditorNodeId(null)
    setToastMessage('已添加文本节点到画布')
    return id
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
      x: Math.max(12, Math.min(event.clientX, window.innerWidth - 250)),
      y: Math.max(12, Math.min(event.clientY, window.innerHeight - 238)),
      flowX: flowPosition.x,
      flowY: flowPosition.y,
    })
  }

  const openNodeMenuFromButton = () => {
    closeContextMenu()
    const rect = nodeMenuButtonRef.current?.getBoundingClientRect()
    if (!rect) return
    const menuWidth = 238
    const menuHeight = 226
    const x = Math.min(rect.right + 12, window.innerWidth - menuWidth - 12)
    const y = Math.max(12, Math.min(rect.top - 6, window.innerHeight - menuHeight - 12))
    const flowPosition = screenToFlowPosition({
      x: Math.min(window.innerWidth - 160, rect.right + menuWidth + 34),
      y: rect.top + rect.height / 2,
    })
    setNodeMenu({ x, y, flowX: flowPosition.x, flowY: flowPosition.y })
  }

  const openNodeExtensionMenu = (nodeId: string, anchor: HTMLElement, direction: 'incoming' | 'outgoing') => {
    closeContextMenu()
    const anchorRect = anchor.getBoundingClientRect()
    const nodeRect = anchor.closest<HTMLElement>('.react-flow__node')?.getBoundingClientRect() ?? anchorRect
    const menuWidth = 238
    const menuHeight = 154
    const openRight = direction === 'outgoing'
    const x = openRight
      ? anchorRect.right + 12
      : anchorRect.left - menuWidth - 12
    const y = Math.max(12, Math.min(anchorRect.top - 18, window.innerHeight - menuHeight - 12))
    const nextNodeCenter = {
      x: openRight
        ? Math.min(window.innerWidth - 150, nodeRect.right + 178)
        : Math.max(150, nodeRect.left - 178),
      y: Math.max(130, Math.min(window.innerHeight - 130, nodeRect.top + nodeRect.height / 2)),
    }
    const flowPosition = screenToFlowPosition(nextNodeCenter)
    setNodeMenu({
      x: Math.max(12, Math.min(x, window.innerWidth - menuWidth - 12)),
      y,
      flowX: flowPosition.x,
      flowY: flowPosition.y,
      connectionSourceId: nodeId,
      connectionDirection: direction,
    })
  }

  const updateActiveTextNode = (promptText: string) => {
    if (!activeEditorNodeId) return
    setNodes((current) => current.map((node) => node.id === activeEditorNodeId
      ? { ...node, data: { ...node.data, promptText } }
      : node))
  }

  const updateNodeBody = useCallback((nodeId: string, body: string) => {
    setNodes((current) =>
      current.map((node) =>
        node.id === nodeId ? { ...node, data: { ...node.data, body } } : node,
      ),
    )
  }, [setNodes])

  const updateNodeTitle = useCallback((nodeId: string, title: string) => {
    setNodes((current) => current.map((node) => node.id === nodeId
      ? { ...node, data: { ...node.data, title } }
      : node))
  }, [setNodes])

  const onEdgesChange = useCallback((changes: EdgeChange[]) => {
    const removedEdgeIds = new Set(changes.filter((change) => change.type === 'remove').map((change) => change.id))
    const removedEdges = changes.flatMap((change) => change.type === 'remove'
      ? edges.filter((edge) => edge.id === change.id)
      : [])
      .filter((removed) => !edges.some((edge) => edge.id !== removed.id
        && !removedEdgeIds.has(edge.id)
        && edge.source === removed.source
        && edge.target === removed.target))
    applyEdgesChange(changes)
    if (!removedEdges.length) return
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    setNodes((current) => current.map((node) => {
      const mentions = removedEdges
        .filter((edge) => edge.target === node.id)
        .map((edge) => nodeById.get(edge.source))
        .filter((source): source is CanvasNode => Boolean(source))
        .map((source) => getConnectedReferenceMention(source))
      if (!mentions.length) return node
      const clean = (value: string) => mentions.reduce((result, mention) => result.replaceAll(mention, ''), value)
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ +\n/g, '\n')
        .trimStart()
      return node.data.kind === 'text'
        ? { ...node, data: { ...node.data, promptText: clean(node.data.promptText ?? '') } }
        : node.data.kind === 'image'
          ? { ...node, data: { ...node.data, body: clean(node.data.body) } }
          : node
    }))
  }, [applyEdgesChange, edges, nodes, setNodes])

  const removeNodesAndCleanReferences = useCallback((nodeIds: Set<string>) => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const removedSourceMentionsByTarget = new Map<string, string[]>()
    edges.forEach((edge) => {
      if (!nodeIds.has(edge.source) || nodeIds.has(edge.target)) return
      const source = nodeById.get(edge.source)
      if (!source) return
      removedSourceMentionsByTarget.set(edge.target, [
        ...(removedSourceMentionsByTarget.get(edge.target) ?? []),
        getConnectedReferenceMention(source),
      ])
    })
    const clean = (value: string, mentions: string[]) => mentions.reduce((result, mention) => result.replaceAll(mention, ''), value)
      .replace(/[ \t]{2,}/g, ' ')
      .replace(/ +\n/g, '\n')
      .trimStart()
    setNodes((current) => current
      .filter((node) => !nodeIds.has(node.id))
      .map((node) => {
        const mentions = removedSourceMentionsByTarget.get(node.id)
        if (!mentions?.length) return node
        return node.data.kind === 'text'
          ? { ...node, data: { ...node.data, promptText: clean(node.data.promptText ?? '', mentions) } }
          : node.data.kind === 'image'
            ? { ...node, data: { ...node.data, body: clean(node.data.body, mentions) } }
            : node
      }))
    setEdges((current) => current.filter((edge) => !nodeIds.has(edge.source) && !nodeIds.has(edge.target)))
  }, [edges, nodes, setEdges, setNodes])

  const openNodeContextMenu = (event: React.MouseEvent, node: CanvasNode) => {
    event.preventDefault()
    event.stopPropagation()
    closeNodeMenu()
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })))
    setNodeContextMenu({
      x: Math.max(12, Math.min(event.clientX, window.innerWidth - 254)),
      y: Math.max(12, Math.min(event.clientY, window.innerHeight - 270)),
      nodeId: node.id,
    })
  }

  const copyNodeToClipboard = useCallback((node: CanvasNode, closeMenu = false) => {
    const measuredWidth = node.measured?.width
    const measuredHeight = node.measured?.height
    setNodeClipboard({
      data: duplicateNodeData(node.data),
      style: {
        ...node.style,
        ...(measuredWidth ? { width: measuredWidth } : {}),
        ...(measuredHeight ? { height: measuredHeight } : {}),
      },
    })
    pasteSequenceRef.current = 0
    internalNodePastePreferredRef.current = true
    setToastMessage('已复制节点')
    if (closeMenu) closeContextMenu()
  }, [closeContextMenu])

  const pasteClipboardNode = useCallback((anchor?: Pick<CanvasNode, 'position'>, closeMenu = false) => {
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
        data: duplicateNodeData(nodeClipboard.data),
      },
    ])
    setActiveEditorNodeId(nodeClipboard.data.kind === 'text' ? id : null)
    setActiveImageNodeId(nodeClipboard.data.kind === 'upload' && nodeClipboard.data.imageUrl ? id : null)
    setActiveGenerationNodeId(nodeClipboard.data.kind === 'image' ? id : null)
    setExpandedEditorNodeId(null)
    window.requestAnimationFrame(() => measureNodeOverlay(id))
    setToastMessage('已粘贴节点副本')
    if (closeMenu) closeContextMenu()
  }, [closeContextMenu, measureNodeOverlay, nodeClipboard, screenToFlowPosition, setNodes])

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

  const duplicateContextNode = () => {
    if (!nodeContextMenu) return
    const source = nodes.find((node) => node.id === nodeContextMenu.nodeId)
    if (!source || source.data.kind === 'group') return
    copyNodeToClipboard(source)
    const id = `${source.data.kind}-duplicate-${crypto.randomUUID()}`
    const duplicate = duplicateCanvasNode(source, id, {
      x: source.position.x + 36,
      y: source.position.y + 36,
    }, true)
    setNodes((current) => [
      ...current.map((node) => ({ ...node, selected: false })),
      duplicate,
    ])
    setActiveEditorNodeId(duplicate.data.kind === 'text' ? id : null)
    setActiveImageNodeId(duplicate.data.kind === 'upload' && duplicate.data.imageUrl ? id : null)
    setActiveGenerationNodeId(duplicate.data.kind === 'image' ? id : null)
    setExpandedEditorNodeId(null)
    closeContextMenu()
    window.requestAnimationFrame(() => measureNodeOverlay(id))
    setToastMessage('已创建节点副本')
  }

  useEffect(() => {
    const onClipboardShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.altKey) return
      const key = event.key.toLowerCase()
      const target = event.target
      if (target instanceof HTMLElement && target.closest('#disy-agent-panel')) {
        if (key === 'c') internalNodePastePreferredRef.current = false
        return
      }
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) {
        if (key === 'c') internalNodePastePreferredRef.current = false
        return
      }

      if (key === 'c') {
        const selectedNode = nodes.find((node) => node.selected)
        if (!selectedNode) {
          internalNodePastePreferredRef.current = false
          return
        }
        event.preventDefault()
        copyNodeToClipboard(selectedNode)
      }
    }
    const onNativeCopy = (event: ClipboardEvent) => {
      internalNodePastePreferredRef.current = false

      // Agent 对话内容是展示文本；将浏览器默认的富文本复制统一为纯文本，
      // 避免粘贴到外部工具时把气泡、颜色与字体样式一并带走。
      const selection = window.getSelection()
      const panel = document.getElementById('disy-agent-panel')
      const toElement = (node: unknown): HTMLElement | null => {
        if (node instanceof HTMLElement) return node
        const parent = (node as { parentElement?: unknown } | null)?.parentElement
        return parent instanceof HTMLElement ? parent : null
      }
      const anchor = toElement(selection?.anchorNode ?? null)
      const focus = toElement(selection?.focusNode ?? null)
      if (!panel || !selection || selection.isCollapsed || !anchor || !focus || !panel.contains(anchor) || !panel.contains(focus) || !event.clipboardData) return

      event.preventDefault()
      event.clipboardData.setData('text/plain', selection.toString())
    }

    window.addEventListener('keydown', onClipboardShortcut)
    window.addEventListener('copy', onNativeCopy)
    return () => {
      window.removeEventListener('keydown', onClipboardShortcut)
      window.removeEventListener('copy', onNativeCopy)
    }
  }, [copyNodeToClipboard, nodeClipboard, nodes, pasteClipboardNode])

  useEffect(() => {
    const onSystemPaste = (event: ClipboardEvent) => {
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return
      const pointer = canvasPastePositionRef.current
      if (!pointer) return

      if (internalNodePastePreferredRef.current && nodeClipboard) {
        event.preventDefault()
        const selectedNode = nodes.find((node) => node.selected)
        pasteClipboardNode(selectedNode)
        return
      }

      const imageFiles = Array.from(event.clipboardData?.items ?? [])
        .filter((item) => item.kind === 'file' && item.type.startsWith('image/'))
        .map((item) => item.getAsFile())
        .filter((file): file is File => Boolean(file))

      if (imageFiles.length) {
        event.preventDefault()
        internalNodePastePreferredRef.current = false
        const position = screenToFlowPosition(pointer)
        void addImageFiles(imageFiles, { x: position.x - 130, y: position.y - 110 })
      }
    }

    window.addEventListener('paste', onSystemPaste)
    return () => window.removeEventListener('paste', onSystemPaste)
  }, [addImageFiles, nodeClipboard, nodes, pasteClipboardNode, screenToFlowPosition])

  useEffect(() => {
    const onDeleteShortcut = (event: KeyboardEvent) => {
      if (event.key !== 'Backspace' && event.key !== 'Delete') return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return
      const selectedIds = latestSelectedNodeIdsRef.current
      const selectedEdgeIds = latestSelectedEdgeIdsRef.current
      if (!selectedIds.length && !selectedEdgeIds.length) return
      event.preventDefault()
      const selectedIdSet = new Set(selectedIds)
      const selectedEdgeIdSet = new Set(selectedEdgeIds)
      if (selectedIdSet.size) removeNodesAndCleanReferences(selectedIdSet)
      if (selectedEdgeIdSet.size) onEdgesChange([...selectedEdgeIdSet].map((id) => ({ id, type: 'remove' as const })))
      latestSelectedNodeIdsRef.current = []
      latestSelectedEdgeIdsRef.current = []
      setActiveEditorNodeId(null)
      setActiveImageNodeId(null)
      setActiveGenerationNodeId(null)
      setNodeOverlayRect(null)
    }
    window.addEventListener('keydown', onDeleteShortcut)
    return () => window.removeEventListener('keydown', onDeleteShortcut)
  }, [onEdgesChange, removeNodesAndCleanReferences])

  const deleteContextNode = () => {
    if (!nodeContextMenu) return
    const nodeId = nodeContextMenu.nodeId
    removeNodesAndCleanReferences(new Set([nodeId]))
    setToastMessage('节点已删除')
    closeContextMenu()
  }

  const commitSavedAssets = async (nextAssets: SavedAsset[], successMessage: string) => {
    try {
      await saveLocalAssets(nextAssets)
      setSavedAssets(nextAssets)
      setToastMessage(successMessage)
      localStorage.removeItem('disy-saved-assets')
      return true
    } catch (error) {
      const reason = error instanceof DOMException && error.name === 'QuotaExceededError'
        ? '浏览器分配给本站的存储额度已用完'
        : error instanceof Error && error.message
          ? error.message
          : '浏览器存储不可用'
      setToastMessage(`资产保存失败：${reason}`)
      return false
    }
  }

  const saveNodeToAssets = (node: CanvasNode) => {
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
    void commitSavedAssets(nextAssets, '已加入资产库')
  }

  const saveContextNodeToAssets = () => {
    if (!nodeContextMenu) return
    const node = nodes.find((item) => item.id === nodeContextMenu.nodeId)
    if (!node) return
    saveNodeToAssets(node)
    closeContextMenu()
  }

  const saveApi = async () => {
    if (!apiDraft.baseUrl.trim() || !apiDraft.apiKey.trim()) {
      showApiAlert('请完整填写接口地址和 API Key。')
      return
    }

    try {
      const parsedUrl = new URL(apiDraft.baseUrl)
      if (parsedUrl.protocol !== 'http:' && parsedUrl.protocol !== 'https:') throw new Error('protocol')
    } catch {
      showApiAlert('接口地址必须是完整的 http 或 https URL。')
      return
    }
    setApiKeyVisible(false)
    try {
      await validateApiCredentials({ baseUrl: apiDraft.baseUrl.trim(), apiKey: apiDraft.apiKey.trim() })
    } catch (error) {
      showApiAlert(error instanceof Error ? error.message : 'API Key 校验失败')
      return
    }

    const connectionId = editingConnectionId === 'new' ? `connection-${crypto.randomUUID()}` : editingConnectionId
    const existingConnection = apiSettings.connections.find((connection) => connection.id === connectionId)
    const hasKey = apiDraft.apiKey.trim() !== ''
    const credentialsChanged = Boolean(existingConnection && (
      existingConnection.apiKey.trim() !== apiDraft.apiKey.trim()
      || existingConnection.baseUrl.replace(/\/$/, '') !== apiDraft.baseUrl.trim().replace(/\/$/, '')
    ))
    // Models returned for a previous key must never remain selectable after the
    // connection credentials change. Catalog-only providers cannot validate a
    // key by listing models, so preserve an explicit disconnected state.
    const keepDisconnected = existingConnection?.disconnected === true || credentialsChanged || !hasKey
    const nextConnection: ApiConnection = {
      id: connectionId,
      name: apiDraft.name.trim() || `连接 ${apiSettings.connections.length + 1}`,
      baseUrl: apiDraft.baseUrl.trim().replace(/\/$/, ''),
      apiKey: apiDraft.apiKey.trim(),
      models: keepDisconnected ? [] : draftModels,
      modelsFetchedAt: keepDisconnected || !draftModels.length ? undefined : new Date().toISOString(),
      enabled: existingConnection?.enabled === false ? false : true,
      disconnected: keepDisconnected,
    }
    const connections = apiSettings.connections.some((connection) => connection.id === connectionId)
      ? apiSettings.connections.map((connection) => connection.id === connectionId ? nextConnection : connection)
      : [...apiSettings.connections, nextConnection]
    const { selectedTextModel, selectedImageModel } = pickValidSelections(connections, apiSettings)
    try {
      saveApiSettings({
        connections,
        selectedTextModel,
        selectedImageModel,
      })
    } catch {
      showApiAlert('保存失败，请检查浏览器本地存储权限')
      return
    }
    setEditingConnectionId(connectionId)
    if (credentialsChanged) {
      setDraftModels([])
      showApiAlert('API Key 或接口地址已变更。为避免旧模型继续出现在节点中，连接已保存为断开状态且模型目录已清空；请确认新凭据有效后再重新链接。')
      return
    }
    setToastMessage('API 连接已保存')
  }

  const beginNewApiConnection = () => {
    modelFetchRequestRef.current += 1
    setModelsLoading(false)
    setEditingConnectionId('new')
    setApiDraft({ name: '', baseUrl: '', apiKey: '' })
    setApiKeyVisible(false)
    setDraftModels([])
    setModelsError('')
    setApiError('')
    setApiModelTab('text')
    window.setTimeout(() => firstApiInputRef.current?.focus(), 20)
  }

  const applyApiProviderPreset = (preset: (typeof API_PROVIDER_PRESETS)[number]) => {
    modelFetchRequestRef.current += 1
    setModelsLoading(false)
    setEditingConnectionId('new')
    setApiDraft({ name: preset.name, baseUrl: preset.baseUrl, apiKey: '' })
    setApiKeyVisible(false)
    setDraftModels([])
    setModelsError('')
    setApiError('')
    window.setTimeout(() => firstApiInputRef.current?.focus(), 20)
  }

  const selectApiConnection = (connection: ApiConnection) => {
    modelFetchRequestRef.current += 1
    setModelsLoading(false)
    setEditingConnectionId(connection.id)
    setApiDraft({ name: connection.name, baseUrl: connection.baseUrl, apiKey: connection.apiKey })
    setApiKeyVisible(false)
    setDraftModels(connection.models)
    setModelsError('')
    setApiError('')
  }

  const removeCurrentApiConnection = () => {
    if (editingConnectionId === 'new') return
    const target = apiSettings.connections.find((connection) => connection.id === editingConnectionId)
    if (!target) return
    const confirmed = window.confirm(`确认删除连接“${target.name}”？\n\n此操作会同时移除该连接下已获取的模型列表，且不可撤销。`)
    if (!confirmed) return
    const connections = apiSettings.connections.filter((connection) => connection.id !== editingConnectionId)
    const { selectedTextModel, selectedImageModel } = pickValidSelections(connections, apiSettings)
    saveApiSettings({ connections, selectedTextModel, selectedImageModel })
    const next = connections[0]
    if (next) selectApiConnection(next)
    else beginNewApiConnection()
    setToastMessage('API 连接已删除')
  }

  const toggleConnectionEnabled = (connectionId: string) => {
    const target = apiSettings.connections.find((connection) => connection.id === connectionId)
    if (!target) return
    const turningOn = target.enabled === false
    const connections = apiSettings.connections.map((connection) =>
      connection.id === connectionId
        ? { ...connection, enabled: turningOn }
        : connection,
    )
    const { selectedTextModel, selectedImageModel } = pickValidSelections(connections, apiSettings)
    saveApiSettings({ connections, selectedTextModel, selectedImageModel })
    setToastMessage(turningOn ? '已启用该连接，其模型可参与选择' : '已停用该连接，其模型不再参与选择')
  }

  const disconnectCurrentApiConnection = () => {
    if (editingConnectionId === 'new') return
    const target = apiSettings.connections.find((connection) => connection.id === editingConnectionId)
    if (!target) return
    const confirmed = window.confirm(
      `确认断开连接“${target.name}”？\n\n断开后，该连接的所有模型会立即从节点选择器中隐藏。API Key 和已获取的模型目录仍会保留，之后可以重新连接。`,
    )
    if (!confirmed) return
    const connections = apiSettings.connections.map((connection) =>
      connection.id === editingConnectionId
        ? { ...connection, disconnected: true }
        : connection,
    )
    const { selectedTextModel, selectedImageModel } = pickValidSelections(connections, {
      selectedTextModel: apiSettings.selectedTextModel?.connectionId === editingConnectionId ? undefined : apiSettings.selectedTextModel,
      selectedImageModel: apiSettings.selectedImageModel?.connectionId === editingConnectionId ? undefined : apiSettings.selectedImageModel,
    })
    saveApiSettings({ connections, selectedTextModel, selectedImageModel })
    setToastMessage('连接已断开，相关模型已从节点中隐藏')
  }

  const reconnectCurrentApiConnection = () => {
    if (editingConnectionId === 'new') return
    const connections = apiSettings.connections.map((connection) =>
      connection.id === editingConnectionId
        ? { ...connection, disconnected: false }
        : connection,
    )
    const { selectedTextModel, selectedImageModel } = pickValidSelections(connections, apiSettings)
    saveApiSettings({ connections, selectedTextModel, selectedImageModel })
    setToastMessage('连接已恢复，相关模型可重新使用')
  }

  const changeCanvasZoom = (value: number) => {
    const nextZoom = Math.min(2, Math.max(0.25, value))
    setCanvasZoom(nextZoom)
    void zoomTo(nextZoom, { duration: reduceMotion ? 0 : 100 })
  }

  const saveCanvasState = async (nameOverride = canvasName, silent = false) => {
    const normalizedName = makeUniqueWorkspaceName(
      nameOverride,
      workspaceCanvases.filter((canvas) => canvas.id !== activeCanvasId).map((canvas) => canvas.name),
      '未命名画布',
    )
    const primaryStylePreset = stylePresets.find((preset) => preset.enabled && preset.references.length)
      ?? stylePresets.find((preset) => preset.references.length)
      ?? stylePresets[0]
    const legacyStyleReferences = primaryStylePreset?.references ?? []
    try {
      await saveWorkspaceCanvas({
        id: activeCanvasId,
        projectId: activeProjectId,
        name: normalizedName,
        nodes,
        edges,
        styleReferenceName: legacyStyleReferences[0]?.name ?? '',
        styleReferenceUrl: legacyStyleReferences[0]?.url,
        styleReferences: legacyStyleReferences,
        styleReferenceEnabled: primaryStylePreset?.enabled ?? false,
        styleReferenceKeyword: primaryStylePreset?.keyword ?? 'Disy',
        stylePresets,
        promptSuffix: projectPromptSuffix,
        settingsLocked: projectSettingsLocked,
        createdAt: workspaceCanvases.find((canvas) => canvas.id === activeCanvasId)?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      setCanvasName(normalizedName)
      setCanvasNameDraft(normalizedName)
      savedCanvasSignatureRef.current = buildCanvasSignature(
        nodes,
        edges,
        normalizedName,
        stylePresets,
        projectPromptSuffix,
        projectSettingsLocked,
      )
      setCanvasSaved(true)
      setWorkspaceCanvases((current) => current.map((canvas) => canvas.id === activeCanvasId ? {
        ...canvas,
        name: normalizedName,
        nodes,
        edges,
        styleReferenceName: legacyStyleReferences[0]?.name ?? '',
        styleReferenceUrl: legacyStyleReferences[0]?.url,
        styleReferences: legacyStyleReferences,
        styleReferenceEnabled: primaryStylePreset?.enabled ?? false,
        styleReferenceKeyword: primaryStylePreset?.keyword ?? 'Disy',
        stylePresets,
        updatedAt: new Date().toISOString(),
      } : canvas))
      if (!silent) setToastMessage('项目已保存到本机')
    } catch {
      setCanvasSaved(false)
      setToastMessage('项目保存失败，请检查浏览器存储权限')
    }
  }

  const persistCurrentCanvasSnapshot = async (snapshotNodes: CanvasNode[], snapshotEdges: Edge[]) => {
    const primaryStylePreset = stylePresets.find((preset) => preset.enabled && preset.references.length)
      ?? stylePresets.find((preset) => preset.references.length)
      ?? stylePresets[0]
    const legacyStyleReferences = primaryStylePreset?.references ?? []
    await saveWorkspaceCanvas({
      id: activeCanvasId,
      projectId: activeProjectId,
      name: canvasName.trim() || '未命名画布',
      nodes: snapshotNodes,
      edges: snapshotEdges,
      styleReferenceName: legacyStyleReferences[0]?.name ?? '',
      styleReferenceUrl: legacyStyleReferences[0]?.url,
      styleReferences: legacyStyleReferences,
      styleReferenceEnabled: primaryStylePreset?.enabled ?? false,
      styleReferenceKeyword: primaryStylePreset?.keyword ?? 'Disy',
      stylePresets,
      promptSuffix: projectPromptSuffix,
      settingsLocked: projectSettingsLocked,
      createdAt: workspaceCanvases.find((canvas) => canvas.id === activeCanvasId)?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  autoSaveActionRef.current = () => {
    void saveCanvasState(canvasName, true)
  }

  const patchCanvasNodesAtOrigin = async (
    origin: { projectId: string; canvasId: string },
    patch: (current: CanvasNode[]) => CanvasNode[],
  ) => {
    if (activeProjectIdRef.current === origin.projectId && activeCanvasIdRef.current === origin.canvasId) {
      setNodes(patch)
      return
    }
    const canvas = await loadWorkspaceCanvas(origin.canvasId)
    if (!canvas || canvas.projectId !== origin.projectId) return
    await saveWorkspaceCanvas({
      ...canvas,
      nodes: patch(canvas.nodes as CanvasNode[]),
      updatedAt: new Date().toISOString(),
    })
  }

  const patchAgentPlansAtOrigin = async (
    origin: { projectId: string; canvasId: string; sessionId: string },
    patch: (current: AgentImagePlan[]) => AgentImagePlan[],
  ) => {
    if (
      activeProjectIdRef.current === origin.projectId
      && activeCanvasIdRef.current === origin.canvasId
      && agentConversationIdRef.current === origin.sessionId
    ) {
      setAgentPlans(patch)
      return
    }
    const sessions = await listAgentSessions(origin.canvasId)
    const session = sessions.find((item) => item.id === origin.sessionId)
    if (!session || session.projectId !== origin.projectId) return
    const storedPlans = (session.plans as Array<AgentImagePlan | AgentTextPlan> | undefined) ?? []
    const imagePlans = storedPlans.filter((plan): plan is AgentImagePlan => 'prompt' in plan)
    const textPlans = storedPlans.filter((plan): plan is AgentTextPlan => 'content' in plan)
    await saveAgentSession({
      ...session,
      messages: (session.messages as AgentMessage[] | undefined) ?? [],
      plans: [...patch(imagePlans), ...textPlans],
      updatedAt: new Date().toISOString(),
    })
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

  const workspaceMutationBlocked = () => agentBusy
  const destructiveWorkspaceMutationBlocked = () => generationLoading
    || agentBusy
    || agentPlanLocksRef.current.size > 0
    || agentPlans.some((plan) => plan.status === 'running')

  const openWorkspaceCanvas = async (canvasId: string, projectId = activeProjectId, skipCurrentSave = false) => {
    if (!skipCurrentSave && workspaceMutationBlocked()) {
      setToastMessage('正在生成内容，完成后才能切换画布')
      throw new Error('Generation in progress')
    }
    if (agentSaveTimerRef.current !== null) window.clearTimeout(agentSaveTimerRef.current)
    agentSaveTimerRef.current = null
    if (!skipCurrentSave) {
      await saveCanvasState(canvasName, true)
      await persistCurrentAgentConversation()
    }
    const [canvas, project, canvases, sessions] = await Promise.all([
      loadWorkspaceCanvas(canvasId),
      listWorkspaceProjects().then((items) => items.find((item) => item.id === projectId)),
      listWorkspaceCanvases(projectId),
      listAgentSessions(canvasId),
    ])
    if (!canvas || !project) throw new Error('画布不存在')
    const restoredNodes = (canvas.nodes as CanvasNode[]).map((node) => node.data.kind === 'image'
      ? { ...node, style: { ...node.style, ...getImageGenerationNodeSize(node.data.imageAspectRatio ?? '1:1') } }
      : node.data.kind === 'text' && node.data.promptText === undefined ? { ...node, data: { ...node.data, promptText: node.data.body } } : node)
    resetCanvasHistory(restoredNodes, canvas.edges as Edge[])
    setNodes(restoredNodes)
    setEdges(canvas.edges as Edge[])
    setActiveProjectId(projectId)
    localStorage.setItem(ACTIVE_PROJECT_KEY, projectId)
    setActiveCanvasId(canvas.id)
    setProjectName(project.name)
    setWorkspaceCanvases(canvases)
    setCanvasName(canvas.name)
    setCanvasNameDraft(canvas.name)
    const restoredStylePresets = getCanvasStylePresets(canvas)
    setStylePresets(restoredStylePresets)
    setProjectPromptSuffix(canvas.promptSuffix)
    setProjectSettingsLocked(canvas.settingsLocked)
    const session = sessions[0]
    setAgentConversationOptions(sessions.map((item) => ({ id: item.id, title: item.title || 'Disy 对话', updatedAt: item.updatedAt })))
    setAgentConversationId(session?.id ?? `${canvas.id}--agent-${crypto.randomUUID()}`)
    setAgentMessages(normalizeHistoricalAgentMessages((session?.messages as AgentMessage[] | undefined) ?? []))
    const storedPlans = (session?.plans as Array<AgentImagePlan | AgentTextPlan> | undefined) ?? []
    const interruptedPlans = storedPlans.filter((plan): plan is AgentImagePlan => 'prompt' in plan)
    setAgentTextPlans(storedPlans.filter((plan): plan is AgentTextPlan => 'content' in plan))
    const interruptedNodeIds = new Set(interruptedPlans.filter((plan) => plan.status === 'running' && plan.nodeId).map((plan) => plan.nodeId))
    if (interruptedNodeIds.size) setNodes((current) => current.map((node) => interruptedNodeIds.has(node.id) ? { ...node, data: { ...node.data, status: '生成失败' } } : node))
    setAgentPlans(interruptedPlans.map((plan) => plan.status === 'running' ? { ...plan, status: 'failed', error: '上次生成已中断，请在对应图像节点中手动重试。' } : plan))
    setAgentTextModelKey(session?.selectedChatModelId ?? agentTextModelKey)
    setAgentImageModelKey(session?.selectedImageModelId ?? agentImageModelKey)
    setActiveEditorNodeId(null)
    setActiveImageNodeId(null)
    setCanvasSwitcherOpen(false)
    const nextProject = { ...project, activeCanvasId: canvas.id, updatedAt: new Date().toISOString() }
    await saveWorkspaceProject(nextProject)
    setWorkspaceProjects((current) => current.map((item) => item.id === nextProject.id ? nextProject : item))
    savedCanvasSignatureRef.current = buildCanvasSignature(restoredNodes, canvas.edges as Edge[], canvas.name, restoredStylePresets, canvas.promptSuffix, canvas.settingsLocked)
    setCanvasSaved(true)
  }

  const addCanvasToCurrentProject = async () => {
    if (workspaceMutationBlocked()) {
      setToastMessage('正在生成内容，完成后才能新建画布')
      return
    }
    await saveCanvasState(canvasName, true)
    const canvas = await createWorkspaceCanvas(activeProjectId)
    setWorkspaceCanvases((current) => [...current, canvas])
    await openWorkspaceCanvas(canvas.id)
    setCanvasNameEditing(true)
    setToastMessage('已创建新画布')
  }

  const beginNewAgentConversation = async () => {
    if (agentBusy) {
      setToastMessage('Agent 正在回复，完成后再新建对话')
      return
    }
    if (agentSaveTimerRef.current !== null) window.clearTimeout(agentSaveTimerRef.current)
    agentSaveTimerRef.current = null
    await persistCurrentAgentConversation()
    const now = new Date().toISOString()
    const id = `${activeProjectId}--${activeCanvasId}--agent-${crypto.randomUUID()}`
    setAgentConversationId(id)
    setAgentMessages([])
    setAgentPlans([])
    setAgentTextPlans([])
    setAgentReferences([])
    setAgentPendingReferences([])
    setAgentCanvasPicking(false)
    setAgentConversationOptions((current) => [{ id, title: '新的对话', updatedAt: now }, ...current])
  }

  const selectAgentConversation = async (id: string) => {
    if (id === agentConversationId) return
    if (agentBusy) {
      setToastMessage('Agent 正在回复，完成后再切换对话')
      return
    }
    if (agentSaveTimerRef.current !== null) window.clearTimeout(agentSaveTimerRef.current)
    agentSaveTimerRef.current = null
    await persistCurrentAgentConversation()
    const sessions = await listAgentSessions(activeCanvasId)
    const session = sessions.find((item) => item.id === id)
    if (!session) return
    setAgentConversationId(session.id)
    setAgentMessages(normalizeHistoricalAgentMessages((session.messages as AgentMessage[] | undefined) ?? []))
    const storedPlans = (session.plans as Array<AgentImagePlan | AgentTextPlan> | undefined) ?? []
    const plans = storedPlans.filter((plan): plan is AgentImagePlan => 'prompt' in plan)
    setAgentPlans(plans.map((plan) => plan.status === 'running'
      ? { ...plan, status: 'failed', error: '上次生成已中断，请在对应图像节点中手动重试。' }
      : plan))
    setAgentTextPlans(storedPlans.filter((plan): plan is AgentTextPlan => 'content' in plan))
    setAgentReferences([])
    setAgentPendingReferences([])
    setAgentCanvasPicking(false)
    setAgentTextModelKey(session.selectedChatModelId ?? agentTextModelKey)
    setAgentImageModelKey(session.selectedImageModelId ?? agentImageModelKey)
  }

  const deleteCurrentAgentConversation = async () => {
    if (agentBusy || agentPlanLocksRef.current.size > 0) {
      setToastMessage('Agent 正在处理，完成后再删除对话')
      return
    }
    if (!window.confirm('确认删除当前对话？')) return
    if (agentSaveTimerRef.current !== null) window.clearTimeout(agentSaveTimerRef.current)
    agentSaveTimerRef.current = null
    await deleteAgentSession(agentConversationId)
    const sessions = (await listAgentSessions(activeCanvasId)).filter((session) => session.id !== agentConversationId)
    setAgentConversationOptions(sessions.map((item) => ({ id: item.id, title: item.title || 'Disy 对话', updatedAt: item.updatedAt })))
    const next = sessions[0]
    if (next) {
      setAgentConversationId(next.id)
      setAgentMessages(normalizeHistoricalAgentMessages((next.messages as AgentMessage[] | undefined) ?? []))
      const storedPlans = (next.plans as Array<AgentImagePlan | AgentTextPlan> | undefined) ?? []
      setAgentPlans(storedPlans.filter((plan): plan is AgentImagePlan => 'prompt' in plan).map((plan) => plan.status === 'running' ? { ...plan, status: 'failed', error: '上次生成已中断，请在对应图像节点中手动重试。' } : plan))
      setAgentTextPlans(storedPlans.filter((plan): plan is AgentTextPlan => 'content' in plan))
      setAgentTextModelKey(next.selectedChatModelId ?? agentTextModelKey)
      setAgentImageModelKey(next.selectedImageModelId ?? agentImageModelKey)
    } else {
      const id = `${activeProjectId}--${activeCanvasId}--agent-${crypto.randomUUID()}`
      setAgentConversationId(id)
      setAgentMessages([])
      setAgentPlans([])
      setAgentTextPlans([])
      setAgentConversationOptions([{ id, title: '新的对话', updatedAt: new Date().toISOString() }])
    }
    setAgentReferences([])
    setAgentPendingReferences([])
    setAgentCanvasPicking(false)
    setToastMessage('对话已删除')
  }

  const removeCanvas = async (canvasId: string) => {
    if (destructiveWorkspaceMutationBlocked()) {
      setToastMessage('正在生成内容，完成后才能删除画布')
      return
    }
    const canvas = workspaceCanvases.find((item) => item.id === canvasId)
    if (!canvas || workspaceCanvases.length <= 1) return
    if (!window.confirm(`确认删除画布“${canvas.name}”？此操作不可撤销。`)) return
    const nextProject = await deleteWorkspaceCanvas(activeProjectId, canvasId)
    const nextCanvases = workspaceCanvases.filter((item) => item.id !== canvasId)
    setWorkspaceCanvases(nextCanvases)
    setWorkspaceProjects((current) => current.map((item) => item.id === nextProject.id ? nextProject : item))
    if (canvasId === activeCanvasId) await openWorkspaceCanvas(nextProject.activeCanvasId, activeProjectId, true)
    setToastMessage('画布已删除')
  }

  const createNewProject = () => {
    if (workspaceMutationBlocked()) {
      setToastMessage('正在生成内容，完成后才能新建项目')
      return
    }
    setCreateProjectName(workspaceProjects.length ? `新项目 ${workspaceProjects.length + 1}` : '第一张画布')
    setCreateProjectCanvasCount(1)
    setCreateProjectOpen(true)
  }

  const persistCurrentAgentSession = async () => {
    await saveAgentSession({
      id: agentConversationId,
      projectId: activeProjectId,
      canvasId: activeCanvasId,
      title: agentMessages[0]?.content.slice(0, 36) || 'Disy 对话',
      messages: agentMessages,
      plans: [...agentPlans, ...agentTextPlans],
      selectedChatModelId: agentTextModelKey,
      selectedImageModelId: agentImageModelKey,
      createdAt: agentMessages[0]?.createdAt ?? new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })
  }

  const copyProjectToClipboard = async (projectId: string) => {
    const project = workspaceProjects.find((item) => item.id === projectId)
    if (!project) {
      setToastMessage('项目不存在，无法复制')
      return false
    }
    if (projectId === activeProjectId) {
      await saveCanvasState(canvasName, true)
      await persistCurrentAgentSession()
    }
    setProjectClipboard({ projectId, name: project.name })
    setToastMessage(`已复制项目“${project.name}”`)
    return true
  }

  const pasteProjectFromClipboard = async () => {
    if (!projectClipboard) {
      setToastMessage('没有可粘贴的项目')
      return
    }
    if (workspaceMutationBlocked()) {
      setToastMessage('正在生成内容，完成后才能粘贴项目')
      return
    }
    const sourceProject = workspaceProjects.find((item) => item.id === projectClipboard.projectId)
    if (!sourceProject) {
      setProjectClipboard(null)
      setToastMessage('源项目已不存在，请重新复制')
      return
    }
    try {
      if (sourceProject.id === activeProjectId) {
        await saveCanvasState(canvasName, true)
        await persistCurrentAgentSession()
      }
      const sourceCanvases = await listWorkspaceCanvases(sourceProject.id)
      if (!sourceCanvases.length) throw new Error('源项目没有可复制的画布')
      const sourceSessions = (await listAgentSessions()).filter((session) => session.projectId === sourceProject.id)
      const created = await createWorkspaceProject(`${sourceProject.name} 副本`)
      const timestamp = new Date().toISOString()
      const firstCanvas = sourceCanvases[0]
      const canvasIdMap = new Map<string, string>([[firstCanvas.id, created.canvas.id]])
      await saveWorkspaceCanvas({
        ...firstCanvas,
        id: created.canvas.id,
        projectId: created.project.id,
        name: firstCanvas.name,
        createdAt: timestamp,
        updatedAt: timestamp,
      })
      for (const canvas of sourceCanvases.slice(1)) {
        const duplicatedCanvas = await createWorkspaceCanvas(created.project.id, canvas.name, canvas)
        canvasIdMap.set(canvas.id, duplicatedCanvas.id)
      }
      for (const session of sourceSessions) {
        const nextCanvasId = canvasIdMap.get(session.canvasId)
        if (!nextCanvasId) continue
        await saveAgentSession({
          ...session,
          id: crypto.randomUUID(),
          projectId: created.project.id,
          canvasId: nextCanvasId,
          createdAt: timestamp,
          updatedAt: timestamp,
        })
      }
      const projects = await listWorkspaceProjects()
      setWorkspaceProjects(projects)
      setSelectedProjectIds([created.project.id])
      setProjectHomeSelectionMode(false)
      setToastMessage(`已粘贴项目“${sourceProject.name}”`)
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : '项目粘贴失败')
    }
  }

  const confirmCreateProject = async () => {
    const requestedName = createProjectName.trim()
    if (!requestedName || createProjectBusy) return
    setCreateProjectBusy(true)
    try {
      if (workspaceProjects.length) await saveCanvasState(canvasName, true)
      const created = await createWorkspaceProject(requestedName)
      for (let index = 2; index <= createProjectCanvasCount; index += 1) {
        await createWorkspaceCanvas(created.project.id, `画布 ${index}`)
      }
      const projects = await listWorkspaceProjects()
      setWorkspaceProjects(projects)
      setCreateProjectOpen(false)
      setProjectOpen(false)
      setSelectedProjectIds([created.project.id])
      setProjectHomeSelectionMode(false)
      setToastMessage(`项目已创建，包含 ${createProjectCanvasCount} 张画布`)
    } catch (error) {
      setToastMessage(error instanceof Error ? error.message : '项目创建失败')
    } finally {
      setCreateProjectBusy(false)
    }
  }

  const commitProjectRename = async (projectId: string, draft: string) => {
    const normalizedName = draft.trim() || '未命名项目'
    const source = projectRename?.id === projectId ? projectRename.source : 'modal'
    setProjectRename((current) => current?.id === projectId ? null : current)
    try {
      const renamed = await renameWorkspaceProject(projectId, normalizedName)
      setWorkspaceProjects((current) => current.map((project) => project.id === projectId ? renamed : project))
      if (projectId === activeProjectId) setProjectName(renamed.name)
      setToastMessage('项目名称已更新')
    } catch {
      setProjectRename({ id: projectId, draft, source })
      setToastMessage('项目重命名失败')
    }
  }

  const removeProject = async (projectId: string) => {
    if (destructiveWorkspaceMutationBlocked()) {
      setToastMessage('正在生成内容，完成后才能删除项目')
      return
    }
    const project = workspaceProjects.find((item) => item.id === projectId)
    if (!project || !window.confirm(`确认删除项目“${project.name}”及其全部画布？此操作不可撤销。`)) return
    const fallback = workspaceProjects.find((item) => item.id !== projectId)
    await deleteWorkspaceProject(projectId)
    const projects = await listWorkspaceProjects()
    setWorkspaceProjects(projects)
    setSelectedProjectIds((current) => current.filter((id) => id !== projectId))
    setGenerationHistory((current) => current.filter((record) => record.projectId ? record.projectId !== projectId : projectId !== CURRENT_PROJECT_ID))
    setOutputHistory((current) => current.filter((record) => record.projectId ? record.projectId !== projectId : projectId !== CURRENT_PROJECT_ID))
    if (projectId === activeProjectId && fallback) await openWorkspaceCanvas(fallback.activeCanvasId, fallback.id, true)
    if (!projects.length) {
      setProjectOpen(false)
      setProjectMenuOpen(false)
      setProjectHomeOpen(true)
    }
    setToastMessage('项目已删除')
  }

  const removeProjects = async (projectIds: string[]) => {
    const ids = Array.from(new Set(projectIds)).filter((id) => workspaceProjects.some((project) => project.id === id))
    if (!ids.length || destructiveWorkspaceMutationBlocked()) return
    const deletingAll = ids.length === workspaceProjects.length
    const message = deletingAll
      ? `确认删除全部 ${ids.length} 个项目及其所有画布吗？此操作不可撤销。`
      : `确认删除选中的 ${ids.length} 个项目及其所有画布吗？此操作不可撤销。`
    if (!window.confirm(message)) return
    await Promise.all(ids.map((id) => deleteWorkspaceProject(id)))
    const deleted = new Set(ids)
    const projects = await listWorkspaceProjects()
    setWorkspaceProjects(projects)
    setSelectedProjectIds([])
    setProjectHomeSelectionMode(false)
    setGenerationHistory((current) => current.filter((record) => !record.projectId || !deleted.has(record.projectId)))
    setOutputHistory((current) => current.filter((record) => !record.projectId || !deleted.has(record.projectId)))
    if (deleted.has(activeProjectId) && projects.length) {
      const fallbackProject = projects[0]
      await openWorkspaceCanvas(fallbackProject.activeCanvasId, fallbackProject.id, true)
    }
    if (!projects.length) {
      setProjectOpen(false)
      setProjectMenuOpen(false)
      setProjectHomeOpen(true)
    }
    setToastMessage(deletingAll ? '全部项目已删除' : `已删除 ${ids.length} 个项目`)
  }

  const exportWholeWorkspace = async (options?: { asBackup?: boolean; manageProgress?: boolean; scope?: 'workspace' | 'project' }) => {
    const asBackup = Boolean(options?.asBackup)
    const manageProgress = options?.manageProgress ?? true
    const scope = asBackup ? 'workspace' : options?.scope ?? 'workspace'
    const exportingProject = scope === 'project'
    const date = new Date().toISOString().slice(0, 10)
    const safeProjectName = projectName.trim().replace(/[\\/:*?"<>|]+/g, '-').slice(0, 80) || '当前项目'
    const fileName = exportingProject
      ? `DisyLab-${safeProjectName}-${date}.disy`
      : `DisyLab-完整工作区-${date}.disy`
    type SaveFileHandle = { createWritable: () => Promise<{ write: (data: Blob) => Promise<void>; close: () => Promise<void> }> }
    const savePicker = (window as Window & {
      showSaveFilePicker?: (options: {
        suggestedName: string
        types: Array<{ description: string; accept: Record<string, string[]> }>
      }) => Promise<SaveFileHandle>
    }).showSaveFilePicker
    let saveHandle: SaveFileHandle | null = null
    if (!asBackup && savePicker) {
      try {
        saveHandle = await savePicker({
          suggestedName: fileName,
          types: [{ description: 'DisyLab 项目包', accept: { 'application/octet-stream': ['.disy'] } }],
        })
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return
        // Browsers with an incomplete File System Access implementation fall
        // back to the regular download path below.
      }
    }
    if (manageProgress) setTransferProgress(asBackup ? '正在备份当前项目…' : '正在打包完整项目…')
    try {
      setTransferProgress(asBackup ? '正在保存当前工作区…' : '正在保存画布与对话…')
      await saveCanvasState(canvasName, true)
      await saveAgentSession({
        id: agentConversationId,
        projectId: activeProjectId,
        canvasId: activeCanvasId,
        title: agentMessages[0]?.content.slice(0, 36) || 'Disy 对话',
        messages: agentMessages,
        plans: [...agentPlans, ...agentTextPlans],
        selectedChatModelId: agentTextModelKey,
        selectedImageModelId: agentImageModelKey,
        createdAt: agentMessages[0]?.createdAt ?? new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })
      await saveWorkspaceAuxiliaryData({
        folders: assetFolders,
        generationHistory,
        outputHistory,
        publicSettings: {
          ...apiSettings,
          connections: apiSettings.connections.map(({ apiKey: _apiKey, ...connection }) => connection),
        },
      })

      // Mutate the export snapshot in place so huge data-URLs are replaced with
      // media refs before JSON.stringify — never clone the fat graph first.
      setTransferProgress(asBackup ? '正在写入备份包…' : '正在打包项目数据…')
      const snapshot = await exportWorkspaceSnapshot()
      if (exportingProject) {
        const project = snapshot.projects.find((item) => item.id === activeProjectId)
        if (!project) throw new Error('当前项目不存在，无法导出')
        snapshot.projects = [project]
        snapshot.canvases = snapshot.canvases.filter((canvas) => canvas.projectId === activeProjectId)
        snapshot.agentSessions = snapshot.agentSessions.filter((session) => session.projectId === activeProjectId)
        const belongsToCurrentProject = (value: unknown) => {
          if (!value || typeof value !== 'object') return false
          const projectId = (value as Record<string, unknown>).projectId
          return projectId === activeProjectId || (!projectId && activeProjectId === CURRENT_PROJECT_ID)
        }
        snapshot.generationHistory = snapshot.generationHistory.filter(belongsToCurrentProject)
        snapshot.outputHistory = snapshot.outputHistory.filter(belongsToCurrentProject)
        // Assets and folders are currently shared across projects and have no
        // projectId. Keep them so a scoped export never drops source material.
      }
      const manifest = snapshot as unknown as Record<string, unknown>
      delete manifest.historyMedia
      const referencedMediaIds = collectReferencedMediaIds(manifest)
      const media = new Map<string, BundleMediaEntry>()
      for (const record of await listHistoryMedia()) {
        if (!referencedMediaIds.has(record.id)) continue
        media.set(record.id, {
          id: record.id,
          blob: record.blob,
          fileName: record.fileName,
          createdAt: record.createdAt,
          kind: 'history',
        })
      }
      const skipped = { count: 0 }
      await extractMediaIntoBundle(manifest, media, { skipped })
      const missingMediaIds = [...collectReferencedMediaIds(manifest)].filter((id) => !media.has(id))
      if (missingMediaIds.length) {
        throw new Error(`有 ${missingMediaIds.length} 张本机图片资料缺失。为避免生成缺图项目包，已取消导出。`)
      }

      setTransferProgress(asBackup ? '正在生成备份下载…' : '正在生成下载文件…')
      const bundle = await packWorkspaceBundle(manifest, media.values())
      const projectCount = Array.isArray(manifest.projects) ? manifest.projects.length : 0
      const canvasCount = Array.isArray(manifest.canvases) ? manifest.canvases.length : 0
      if (saveHandle) {
        const writable = await saveHandle.createWritable()
        await writable.write(bundle)
        await writable.close()
      } else {
        triggerBlobDownload(bundle, fileName)
      }
      const skipNote = skipped.count ? `，${skipped.count} 张外链未能打包` : ''
      const successMessage = asBackup
        ? `备份已开始下载：${projectCount} 个项目、${canvasCount} 张画布`
        : `导出成功：${projectCount} 个项目、${canvasCount} 张画布、${media.size} 张图片，${(bundle.size / 1024 / 1024).toFixed(1)} MB${skipNote}（不含 API Key）`
      if (manageProgress) {
        setTransferProgress(null)
        setToastMessage(successMessage)
      }
      return { projectCount, canvasCount, mediaCount: media.size, skipped: skipped.count }
    } catch (error) {
      if (manageProgress) {
        setTransferProgress(null)
        setToastMessage(error instanceof Error ? error.message : '完整导出失败')
      }
      throw error
    }
  }

  const parseWorkspaceImportFile = async (file: File) => {
    const header = new Uint8Array(await file.slice(0, 8).arrayBuffer())
    if (isWorkspaceBundle(header)) {
      const unpacked = await unpackWorkspaceBundle(file)
      const snapshot = unpacked.manifest
      const missingMediaIds = [...collectReferencedMediaIds(snapshot)].filter((id) => !unpacked.media.has(id))
      if (missingMediaIds.length) {
        throw new Error(`项目包缺少 ${missingMediaIds.length} 张图片或媒体资料，已停止导入，当前工作区未改变。`)
      }
      delete snapshot.historyMedia
      // History blobs stay in IndexedDB; only inflate non-history refs for canvas/assets.
      const historyIds = new Set(
        [...unpacked.media.values()]
          .filter((entry) => entry.kind === 'history' || entry.id.startsWith('history-media-'))
          .map((entry) => entry.id),
      )
      const inflateMedia = new Map(
        [...unpacked.media.entries()].filter(([id]) => !historyIds.has(id)),
      )
      await reinflateBundleMedia(snapshot, inflateMedia)
      const clearHistoryUrls = (value: unknown): void => {
        if (!value || typeof value !== 'object') return
        if (Array.isArray(value)) {
          value.forEach(clearHistoryUrls)
          return
        }
        const record = value as Record<string, unknown>
        if (typeof record.mediaId === 'string' && historyIds.has(record.mediaId)) {
          record.imageUrl = ''
        }
        Object.values(record).forEach(clearHistoryUrls)
      }
      clearHistoryUrls(snapshot)
      const historyMediaRecords = [...unpacked.media.values()]
        .filter((entry) => historyIds.has(entry.id))
        .map((entry) => ({
          id: entry.id,
          blob: entry.blob,
          fileName: entry.fileName || 'image.png',
          createdAt: entry.createdAt || new Date().toISOString(),
        }))
      validateWorkspaceSnapshot(snapshot)
      return { snapshot, historyMediaRecords }
    }

    if (file.size > 512 * 1024 * 1024) {
      throw new Error('旧版 JSON 项目包超过 512 MB，无法安全导入；请先使用新版 DisyLab 重新导出。')
    }
    let snapshot: unknown
    try {
      snapshot = JSON.parse(await file.text()) as unknown
    } catch {
      throw new Error('项目包不是有效的 DisyLab .disy 文件')
    }
    validateWorkspaceSnapshot(snapshot)
    return { snapshot, historyMediaRecords: undefined }
  }

  const appendImportedProjects = async (file: File) => {
    if (transferBusy) {
      setToastMessage('正在导入或导出，请稍候')
      return
    }
    setTransferProgress('正在读取项目包…')
    try {
      const parsed = await parseWorkspaceImportFile(file)
      setTransferProgress('正在添加独立项目…')
      const imported = await appendWorkspaceProjects(parsed.snapshot, parsed.historyMediaRecords)
      const projects = await listWorkspaceProjects()
      setWorkspaceProjects(projects)
      setTransferProgress(null)
      setToastMessage(`已添加 ${imported.length} 个独立项目，现有项目未作改动`)
    } catch (error) {
      setTransferProgress(null)
      throw error
    }
  }

  const importIntoCurrentProject = async (file: File) => {
    if (destructiveWorkspaceMutationBlocked()) {
      setToastMessage('正在生成内容，完成后才能导入项目')
      return
    }
    if (transferBusy) {
      setToastMessage('正在导入或导出，请稍候')
      return
    }
    setTransferProgress('正在读取项目包…')
    try {
      const parsed = await parseWorkspaceImportFile(file)
      const currentSnapshot = await exportWorkspaceSnapshot()
      const currentProjectHasCanvasContent = currentSnapshot.canvases
        .filter((canvas) => canvas.projectId === activeProjectId)
        .some((canvas) => (
        (Array.isArray(canvas.nodes) && canvas.nodes.length > 0)
        || (Array.isArray(canvas.edges) && canvas.edges.length > 0)
      ))
      let recoverySnapshot: Awaited<ReturnType<typeof exportWorkspaceSnapshot>> | undefined
      let recoveryHistoryMedia: Awaited<ReturnType<typeof listHistoryMedia>> | undefined
      if (currentProjectHasCanvasContent) {
        const shouldCreateBackup = window.confirm('检测到当前项目已有内容。是否先导出当前项目备份再覆盖？\n\n选择“确定”备份；选择“取消”表示不备份。')
        if (shouldCreateBackup) {
          setTransferProgress('正在备份当前项目…')
          await exportWholeWorkspace({ scope: 'project', asBackup: true, manageProgress: false })
          recoverySnapshot = await exportWorkspaceSnapshot()
          recoveryHistoryMedia = await listHistoryMedia()
        } else {
          const confirmedOverwrite = window.confirm('你选择了不备份。继续导入只会覆盖当前项目，当前项目中的画布、节点和对话将无法恢复。\n\n请再次确认：确定覆盖当前项目吗？')
          if (!confirmedOverwrite) {
            // `replaceWorkspace` is intentionally below both confirmation
            // gates, so cancelling here leaves IndexedDB and the canvas intact.
            setTransferProgress(null)
            setToastMessage('已取消导入，当前工作区未作任何改动')
            return
          }
        }
      }
      setTransferProgress('正在写入导入数据…')
      const replaced = await replaceWorkspaceProject(activeProjectId, parsed.snapshot, parsed.historyMediaRecords, recoverySnapshot ? { recoverySnapshot, recoveryHistoryMedia } : undefined)
      if (recoverySnapshot) setHasImportBackup(true)
      const projects = await listWorkspaceProjects()
      setWorkspaceProjects(projects)
      setBrokenHistoryIds([])
      historyArchiveAttemptedRef.current.clear()
      historyMediaObjectUrlsRef.current.forEach((objectUrl) => URL.revokeObjectURL(objectUrl))
      historyMediaObjectUrlsRef.current.clear()
      setTransferProgress('正在打开导入的项目…')
      setWorkspaceCanvases(replaced.canvases)
      await openWorkspaceCanvas(replaced.project.activeCanvasId, activeProjectId, true)
      setTransferProgress(null)
      setToastMessage('当前项目已更新，其他项目未作改动')
    } catch (error) {
      setTransferProgress(null)
      throw error
    }
  }

  const restoreLastImportBackup = async () => {
    if (transferBusy || !hasImportBackup) return
    if (!window.confirm('确认恢复最近一次导入前的完整工作区？当前内容会被替换。')) return
    setTransferProgress('正在恢复导入前版本…')
    try {
      await restoreWorkspaceImportBackup()
      window.location.reload()
    } catch (error) {
      setTransferProgress(null)
      setToastMessage(error instanceof Error ? error.message : '恢复导入前版本失败')
    }
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
  const activeGeneratingNodeIds = new Set(Array.from(activeGenerationTaskKeys)
    .filter((taskKey) => taskKey.startsWith('image:'))
    .map((taskKey) => taskKey.slice('image:'.length)))
  const activeImageGenerationRunning = Boolean(activeGenerationNode && activeGeneratingNodeIds.has(activeGenerationNode.id))
  const activeTextGenerationRunning = Boolean(activeTextNode && activeGenerationTaskKeys.has(`text:${activeTextNode.id}`))
  const activeTextReferences = useMemo<ActiveNodeReference[]>(() => {
    if (!activeEditorNodeId) return []
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const targetNode = nodeById.get(activeEditorNodeId)
    const promptText = targetNode?.data.promptText ?? ''
    const connected = edges.flatMap<ActiveNodeReference>((edge): ActiveNodeReference[] => {
      if (edge.target !== activeEditorNodeId) return []
      const sourceNode = nodeById.get(edge.source)
      if (!sourceNode) return []
      const name = getConnectedReferenceLabel(sourceNode)
      const mention = getConnectedReferenceMention(sourceNode)
      if (sourceNode.data.kind === 'text') {
        return [{
          id: `connection-${sourceNode.id}`,
          source: 'connection' as const,
          sourceNodeId: sourceNode.id,
          selected: Boolean((edge.data as { referenceSelected?: boolean } | undefined)?.referenceSelected) || promptText.includes(mention),
          name,
          mention,
          kind: 'text' as const,
          text: sourceNode.data.body,
        }]
      }
      if (sourceNode.data.kind === 'image' || sourceNode.data.kind === 'upload') {
        return [{
          id: `connection-${sourceNode.id}`,
          source: 'connection' as const,
          sourceNodeId: sourceNode.id,
          selected: Boolean((edge.data as { referenceSelected?: boolean } | undefined)?.referenceSelected) || promptText.includes(mention),
          name,
          mention,
          kind: 'image' as const,
          url: sourceNode.data.imageUrl,
        }]
      }
      return []
    })
    const seenUrls = new Set(connected.map((reference) => reference.url).filter(Boolean))
    const manual = (targetNode?.data.referenceImages ?? []).flatMap<ActiveNodeReference>((reference, index) => {
      if (!reference.url || seenUrls.has(reference.url)) return []
      seenUrls.add(reference.url)
      const name = getReferenceLabel(reference.name, connected.length + index)
      const mention = getReferenceMention(name)
      return [{
        id: reference.id,
        source: 'manual',
        selected: true,
        name,
        mention,
        kind: 'image',
        url: reference.url,
      }]
    })
    return [...connected, ...manual]
  }, [activeEditorNodeId, edges, nodes])
  const activeGenerationTextReferences = useMemo<ActiveNodeReference[]>(() => {
    if (!activeGenerationNodeId) return []
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const promptText = nodeById.get(activeGenerationNodeId)?.data.body ?? ''
    return edges.flatMap<ActiveNodeReference>((edge): ActiveNodeReference[] => {
      if (edge.target !== activeGenerationNodeId) return []
      const sourceNode = nodeById.get(edge.source)
      if (!sourceNode || sourceNode.data.kind !== 'text') return []
      const name = getConnectedReferenceLabel(sourceNode)
      const mention = getConnectedReferenceMention(sourceNode)
      return [{
        id: `connection-${sourceNode.id}`,
        source: 'connection' as const,
        sourceNodeId: sourceNode.id,
        selected: Boolean((edge.data as { referenceSelected?: boolean } | undefined)?.referenceSelected) || promptText.includes(mention),
        name,
        mention,
        kind: 'text' as const,
        text: sourceNode.data.body,
      }]
    })
  }, [activeGenerationNodeId, edges, nodes])
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
      if (!sourceCanReferenceImage) return
      if (sourceNode.data.imageUrl && seenUrls.has(sourceNode.data.imageUrl)) return
      if (sourceNode.data.imageUrl) seenUrls.add(sourceNode.data.imageUrl)
      references.push({
        id: `connection-${sourceNode.id}`,
        source: 'connection',
        sourceNodeId: sourceNode.id,
        // An incoming image edge is an explicit upstream reference. Older
        // projects do not persist referenceSelected, so treat only an explicit
        // false as disabled instead of degrading those images into candidates.
        selected: (edge.data as { referenceSelected?: boolean } | undefined)?.referenceSelected !== false,
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

    const persistedOrder = generationNode?.data.referenceOrder ?? []
    if (persistedOrder.length) {
      const orderById = new Map(persistedOrder.map((id, index) => [id, index]))
      const fallbackOrderById = new Map(references.map((reference, index) => [reference.id, index]))
      references.sort((left, right) => {
        const leftOrder = orderById.get(left.id)
        const rightOrder = orderById.get(right.id)
        if (leftOrder !== undefined && rightOrder !== undefined) return leftOrder - rightOrder
        if (leftOrder !== undefined) return -1
        if (rightOrder !== undefined) return 1
        return (fallbackOrderById.get(left.id) ?? 0) - (fallbackOrderById.get(right.id) ?? 0)
      })
    }

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
  const activeGenerationReferences = [...activeImageReferences, ...activeGenerationTextReferences]
  const filteredImageMentionReferences = activeGenerationReferences.filter((reference) => {
    const query = imageMentionQuery.trim().toLowerCase()
    return !query || `${reference.name} ${reference.mention}`.toLowerCase().includes(query)
  })
  const referencedImageNumbers = getReferencedImageNumbers(activeGenerationNode?.data.body ?? '')
  const highestReferencedImageNumber = referencedImageNumbers.size
    ? Math.max(...referencedImageNumbers)
    : 0
  const selectedImageReferences = activeImageReferences.filter((reference, index) => (
    reference.selected
    || activeGenerationNode?.data.body.includes(reference.mention)
    // Preserve the visible top-row numbering. If the prompt asks for 图3, the
    // request must carry 图1..图3 in that exact order so the model sees 图3 as
    // the third input rather than silently renumbering it to 图1.
    || index < highestReferencedImageNumber
  ))
  const selectedAvailableImageReferences = selectedImageReferences.filter((reference): reference is ActiveImageReference & { url: string } => Boolean(reference.url))
  const selectedImageReferenceNumberById = new Map(
    activeImageReferences
      .filter((reference): reference is ActiveImageReference & { url: string } => Boolean(reference.url))
      .map((reference, index) => [reference.id, index + 1]),
  )
  const selectedGenerationTextReferences = activeGenerationTextReferences.filter((reference) => (
    reference.selected || activeGenerationNode?.data.body.includes(reference.mention)
  ))
  const reorderImageReferences = (sourceId: string, targetId: string) => {
    if (!activeGenerationNode || sourceId === targetId) return
    const nextOrder = activeImageReferences.map((reference) => reference.id)
    const sourceIndex = nextOrder.indexOf(sourceId)
    const targetIndex = nextOrder.indexOf(targetId)
    if (sourceIndex < 0 || targetIndex < 0) return
    const [moved] = nextOrder.splice(sourceIndex, 1)
    nextOrder.splice(targetIndex, 0, moved)
    setNodes((current) => current.map((node) => node.id === activeGenerationNode.id
      ? { ...node, data: { ...node.data, referenceOrder: nextOrder } }
      : node))
    setDraggedImageReferenceId(null)
    setImageReferenceDropTargetId(null)
  }
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

  const selectImageMention = (reference: ActiveImageReference | ActiveNodeReference) => {
    if (!activeGenerationNode) return
    if ('kind' in reference && reference.kind === 'text' && !reference.text?.trim()) {
      setToastMessage('来源文本暂无内容')
      return
    }
    if (!('kind' in reference) && !reference.url) {
      setToastMessage('来源图片尚未生成')
      return
    }
    const body = activeGenerationNode.data.body
    const imageCaret = imagePromptEditorRef.current?.getCaret() ?? body.length
    const range = imageMentionRange ?? { start: imageCaret, end: imageCaret }
    const nextBody = `${body.slice(0, range.start)}${reference.mention} ${body.slice(range.end)}`
    setNodes((current) => current.map((node) => node.id === activeGenerationNode.id ? {
      ...node,
      data: { ...node.data, promptText: undefined, body: nextBody },
    } : node))
    if (reference.source === 'connection' && reference.sourceNodeId) {
      setEdges((current) => current.map((edge) => edge.source === reference.sourceNodeId && edge.target === activeGenerationNode.id
        ? { ...edge, data: { ...edge.data, referenceSelected: true } }
        : edge))
    }
    setImageMentionOpen(false)
    setImageMentionQuery('')
    setImageMentionRange(null)
    window.requestAnimationFrame(() => {
      imagePromptEditorRef.current?.focusAt(range.start + reference.mention.length + 1)
    })
  }

  const removeImageReference = (reference: ActiveImageReference | ActiveNodeReference) => {
    if (!activeGenerationNode) return
    if (reference.source === 'current') {
      setNodes((current) => current.map((node) => node.id === activeGenerationNode.id ? {
        ...node,
        data: { ...node.data, useCurrentImageAsReference: false },
      } : node))
    } else if (reference.source === 'connection' && reference.sourceNodeId) {
      setEdges((current) => current.filter((edge) => !(
        edge.source === reference.sourceNodeId && edge.target === activeGenerationNode.id
      )))
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
    const matchedExistingReference = match && activeGenerationReferences.some((reference) => reference.mention === match[0])
    if (match && !matchedExistingReference && activeGenerationReferences.length) {
      setImageMentionRange({ start: cursor - match[0].length, end: cursor })
      setImageMentionQuery(match[1] ?? match[2] ?? '')
      setImageMentionIndex(0)
      setImageMentionOpen(true)
    } else {
      setImageMentionOpen(false)
      setImageMentionRange(null)
    }
  }
  const filteredTextMentionReferences = activeTextReferences.filter((reference) => {
    const query = textMentionQuery.trim().toLowerCase()
    return !query || `${reference.name} ${reference.mention}`.toLowerCase().includes(query)
  })
  const selectedTextNodeReferences = activeTextReferences.filter((reference) => (
    reference.selected || (activeTextNode?.data.promptText ?? '').includes(reference.mention)
  ))
  const addReferenceFilesToNode = async (nodeId: string, incomingFiles: File[]) => {
    const imageFiles = incomingFiles.filter((file) => SUPPORTED_REFERENCE_IMAGE_TYPES.has(file.type))
    const rejectedCount = incomingFiles.length - imageFiles.length
    const targetNode = nodes.find((node) => node.id === nodeId)
    if (!targetNode || (targetNode.data.kind !== 'image' && targetNode.data.kind !== 'text')) return
    if (!imageFiles.length) {
      setToastMessage('仅支持 PNG、JPG/JPEG 和 WebP 图片')
      return
    }

    const connectedImageCount = edges.filter((edge) => {
      if (edge.target !== nodeId) return false
      const source = nodes.find((node) => node.id === edge.source)
      return source?.data.kind === 'image' || source?.data.kind === 'upload'
    }).length
    const currentImageCount = targetNode.data.kind === 'image' && targetNode.data.imageUrl ? 1 : 0
    const existingManual = targetNode.data.referenceImages ?? []
    const remaining = Math.max(0, MAX_REFERENCE_IMAGES - connectedImageCount - currentImageCount - existingManual.length)
    if (!remaining) {
      setToastMessage(`参考图最多 ${MAX_REFERENCE_IMAGES} 张，请先移除部分图片`)
      return
    }

    try {
      const read = await Promise.all(imageFiles.slice(0, remaining).map(readReferenceImage))
      const existingUrls = new Set(existingManual.map((reference) => reference.url))
      const unique = read.filter((reference) => {
        if (existingUrls.has(reference.url)) return false
        existingUrls.add(reference.url)
        return true
      })
      if (unique.length) {
        setNodes((current) => current.map((node) => node.id === nodeId ? {
          ...node,
          data: { ...node.data, referenceImages: [...(node.data.referenceImages ?? []), ...unique] },
        } : node))
      }
      const skippedForLimit = Math.max(0, imageFiles.length - remaining)
      const duplicateCount = read.length - unique.length
      const notes = [
        rejectedCount ? `${rejectedCount} 个格式不支持` : '',
        duplicateCount ? `${duplicateCount} 张重复` : '',
        skippedForLimit ? `${skippedForLimit} 张超出上限` : '',
      ].filter(Boolean)
      setToastMessage(unique.length
        ? `已添加 ${unique.length} 张参考图${notes.length ? `，跳过${notes.join('、')}` : ''}`
        : `没有添加图片${notes.length ? `：${notes.join('、')}` : ''}`)
    } catch {
      setToastMessage('部分图片读取失败，请重新尝试')
    } finally {
      setReferenceDropTargetNodeId(null)
    }
  }
  const handleReferenceDragOver = (event: React.DragEvent<HTMLElement>, nodeId: string) => {
    if (!Array.from(event.dataTransfer.items).some((item) => item.kind === 'file')) return
    event.preventDefault()
    event.stopPropagation()
    event.dataTransfer.dropEffect = 'copy'
    setReferenceDropTargetNodeId(nodeId)
  }
  const handleReferenceDrop = (event: React.DragEvent<HTMLElement>, nodeId: string) => {
    event.preventDefault()
    event.stopPropagation()
    const files = Array.from(event.dataTransfer.files)
    setReferenceDropTargetNodeId(null)
    if (files.length) void addReferenceFilesToNode(nodeId, files)
  }
  const selectTextMention = (reference: ActiveNodeReference) => {
    if (!activeTextNode) return
    if (reference.kind === 'text' ? !reference.text?.trim() : !reference.url) {
      setToastMessage(reference.kind === 'text' ? '来源文本暂无内容' : '来源图片尚未生成')
      return
    }
    const promptText = activeTextNode.data.promptText ?? ''
    const textCaret = textPromptEditorRef.current?.getCaret() ?? promptText.length
    const range = textMentionRange ?? { start: textCaret, end: textCaret }
    const nextPrompt = `${promptText.slice(0, range.start)}${reference.mention} ${promptText.slice(range.end)}`
    setNodes((current) => current.map((node) => node.id === activeTextNode.id
      ? { ...node, data: { ...node.data, promptText: nextPrompt } }
      : node))
    if (reference.source === 'connection' && reference.sourceNodeId) {
      setEdges((current) => current.map((edge) => edge.source === reference.sourceNodeId && edge.target === activeTextNode.id
        ? { ...edge, data: { ...edge.data, referenceSelected: true } }
        : edge))
    }
    setTextMentionOpen(false)
    setTextMentionQuery('')
    setTextMentionRange(null)
    window.requestAnimationFrame(() => textPromptEditorRef.current?.focusAt(range.start + reference.mention.length + 1))
  }
  const removeTextReference = (reference: ActiveNodeReference) => {
    if (!activeTextNode) return
    if (reference.source === 'connection' && reference.sourceNodeId) {
      setEdges((current) => current.filter((edge) => !(
        edge.source === reference.sourceNodeId && edge.target === activeTextNode.id
      )))
    }
    setNodes((current) => current.map((node) => {
      if (node.id !== activeTextNode.id) return node
      const promptText = (node.data.promptText ?? '')
        .replaceAll(reference.mention, '')
        .replace(/[ \t]{2,}/g, ' ')
        .replace(/ +\n/g, '\n')
        .trimStart()
      return { ...node, data: {
        ...node.data,
        promptText,
        referenceImages: reference.source === 'manual'
          ? (node.data.referenceImages ?? []).filter((item) => item.id !== reference.id)
          : node.data.referenceImages,
      } }
    }))
  }
  const handleTextPromptChange = (value: string, cursor: number) => {
    if (!activeTextNode) return
    updateActiveTextNode(value)
    const beforeCursor = value.slice(0, cursor)
    const match = beforeCursor.match(/@(?:\[([^\]]*)\]|([^@\s]*))$/)
    const matchedExistingReference = match && activeTextReferences.some((reference) => reference.mention === match[0])
    if (match && !matchedExistingReference && activeTextReferences.length) {
      setTextMentionRange({ start: cursor - match[0].length, end: cursor })
      setTextMentionQuery(match[1] ?? match[2] ?? '')
      setTextMentionIndex(0)
      setTextMentionOpen(true)
    } else {
      setTextMentionOpen(false)
      setTextMentionRange(null)
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

  const openImageTool = useCallback((nodeId: string, mode: ImageToolMode) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node?.data.imageUrl) {
      setToastMessage('请先选择已生成或已上传的图片')
      return
    }
    const image = new Image()
    image.onload = () => {
      setImageToolSourceSize({ width: image.naturalWidth, height: image.naturalHeight })
      if (mode === 'expand') {
        setExpandSize({ width: image.naturalWidth, height: image.naturalHeight })
        setExpandRatio('original')
      }
    }
    image.src = node.data.imageUrl
    if (mode === 'local-edit') setLocalEditMarks([])
    setImageTool({ nodeId, mode })
  }, [nodes])

  const createDerivedImage = useCallback((sourceId: string, imageUrl: string, title: string, suffix: string) => {
    const source = nodes.find((node) => node.id === sourceId)
    if (!source) return
    const id = `image-tool-${crypto.randomUUID()}`
    const derived: CanvasNode = {
      id,
      type: 'disy',
      position: { x: source.position.x + 330, y: source.position.y + 24 },
      data: { kind: 'upload', title, body: '', fileName: `${source.data.fileName || title}-${suffix}.png`, imageUrl, generationSourceNodeId: sourceId },
    }
    setNodes((current) => [...current, derived])
    setEdges((current) => [...current, { id: `edge-${crypto.randomUUID()}`, source: sourceId, target: id, type: 'luminous' }])
  }, [nodes, setEdges, setNodes])

  const cropImageToDataUrl = useCallback(async (source: string, x: number, y: number, width: number, height: number) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('图片无法读取')); image.src = source })
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(width)); canvas.height = Math.max(1, Math.round(height))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器不支持图片处理')
    context.drawImage(image, x, y, width, height, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/png')
  }, [])

  const applyGridCut = useCallback(async () => {
    if (!imageTool) return
    const source = nodes.find((node) => node.id === imageTool.nodeId)
    if (!source?.data.imageUrl) return
    const x = [0, ...gridGuides.vertical.map((value) => value / 100), 1]
    const y = [0, ...gridGuides.horizontal.map((value) => value / 100), 1]
    try {
      const image = new Image(); image.crossOrigin = 'anonymous'
      await new Promise<void>((resolve, reject) => { image.onload = () => resolve(); image.onerror = () => reject(new Error('图片无法读取')); image.src = source.data.imageUrl! })
      let index = 0
      for (let row = 0; row < y.length - 1; row += 1) for (let column = 0; column < x.length - 1; column += 1) {
        const result = await cropImageToDataUrl(source.data.imageUrl, x[column] * image.naturalWidth, y[row] * image.naturalHeight, (x[column + 1] - x[column]) * image.naturalWidth, (y[row + 1] - y[row]) * image.naturalHeight)
        createDerivedImage(source.id, result, `${getNodeDisplayTitle(source.data)} · 宫格 ${row + 1}-${column + 1}`, `grid-${++index}`)
      }
      setImageTool(null); setToastMessage(`已切分为 ${index} 张图片`)
    } catch { setToastMessage('当前图片不允许浏览器读取像素，请先下载后重新上传再切分') }
  }, [createDerivedImage, cropImageToDataUrl, gridGuides, imageTool, nodes])

  const applyLocalCutout = useCallback(() => {
    if (!imageTool) return
    const source = nodes.find((node) => node.id === imageTool.nodeId)
    if (!source?.data.imageUrl) return
    cutoutWorkerRef.current?.terminate()
    const worker = new Worker(new URL('./backgroundRemoval.worker.ts', import.meta.url), { type: 'module' })
    cutoutWorkerRef.current = worker
    setCutoutProgress({ stage: '正在启动本地抠图引擎', progress: 0 })
    worker.onmessage = (event: MessageEvent<{ type: string; stage?: string; progress?: number; detail?: string; blob?: Blob; message?: string }>) => {
      const message = event.data
      if (message.type === 'progress') {
        setCutoutProgress({ stage: message.stage || '正在处理', progress: message.progress, detail: message.detail })
        return
      }
      worker.terminate()
      cutoutWorkerRef.current = null
      if (message.type === 'complete' && message.blob) {
        const imageUrl = URL.createObjectURL(message.blob)
        const nodeId = `cutout-${crypto.randomUUID()}`
        const createdAt = new Date().toISOString()
        const fileName = `${source.data.fileName || getNodeDisplayTitle(source.data)}-cutout.png`
        const variant: ImageVariant = { id: `variant-${crypto.randomUUID()}`, url: imageUrl, fileName, createdAt, revisedPrompt: '本地 AI 自动识别主体并移除背景' }
        const derived: CanvasNode = {
          id: nodeId,
          type: 'disy',
          selected: true,
          position: { x: source.position.x + 330, y: source.position.y + 24 },
          style: source.style ? { ...source.style } : getImageGenerationNodeSize('auto'),
          data: {
            kind: 'image',
            title: '透明抠图',
            body: '本地 AI 自动识别主体并移除背景',
            promptText: '本地 AI 自动识别主体并移除背景',
            status: '已完成',
            imageUrl,
            fileName,
            imageVariants: [variant],
            activeImageVariantId: variant.id,
            generationSourceNodeId: source.id,
            referenceImageUrl: source.data.imageUrl,
            referenceImageName: getNodeDisplayTitle(source.data),
          },
        }
        setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), derived])
        setEdges((current) => [...current, { id: `edge-${crypto.randomUUID()}`, source: source.id, target: nodeId, type: 'luminous' }])
        setActiveImageNodeId(null)
        setActiveGenerationNodeId(nodeId)
        appendOutputHistory({ kind: 'image', status: 'success', prompt: '本地 AI 自动识别主体并移除背景', modelId: 'studioludens/birefnet-lite-512', modelName: 'BiRefNet Lite 本地抠图', connectionName: '本地浏览器', requestedCount: 1, outputCount: 1, preview: '透明 PNG · 本地处理 · 原图未上传' })
        setCutoutProgress(null)
        setImageTool(null)
        setToastMessage('本地抠图完成，已自动生成并连接透明 PNG 节点')
        return
      }
      setCutoutProgress({ stage: `抠图失败：${message.message || '未知错误'}`, failed: true })
    }
    worker.onerror = (event) => {
      worker.terminate()
      cutoutWorkerRef.current = null
      setCutoutProgress({ stage: `抠图线程失败：${event.message || '浏览器无法启动后台模型'}`, failed: true })
    }
    worker.postMessage({ type: 'start', source: source.data.imageUrl })
  }, [createDerivedImage, imageTool, nodes])
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
      internalNodePastePreferredRef.current = false
      setToastMessage('已复制全部内容')
    } catch {
      setToastMessage('复制失败，请重试')
    }
  }

  const applyMarkdownFormat = (action: MarkdownAction) => {
    if (!activeTextNode) return
    const textarea = expandedEditorNodeId ? expandedTextareaRef.current : editorTextareaRef.current
    const body = expandedEditorNodeId ? activeTextNode.data.body : (activeTextNode.data.promptText ?? '')
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

    if (expandedEditorNodeId) updateNodeBody(activeTextNode.id, nextBody)
    else updateActiveTextNode(nextBody)
    window.requestAnimationFrame(() => {
      const target = expandedEditorNodeId ? expandedTextareaRef.current : editorTextareaRef.current
      target?.focus()
      target?.setSelectionRange(nextStart, nextEnd)
    })
  }

  const enabledTextModels = apiSettings.connections.filter(isConnectionUsable).flatMap((connection) => connection.models
    .filter((model) => model.enabled && model.capability === 'text')
    .map((model) => ({ connection, model })))
  const selectedTextModel = enabledTextModels.find(({ connection, model }) => (
    connection.id === apiSettings.selectedTextModel?.connectionId
    && model.id === apiSettings.selectedTextModel?.modelId
  )) ?? enabledTextModels[0]
  const enabledImageModels = apiSettings.connections.filter(isConnectionUsable).flatMap((connection) => connection.models
    .filter((model) => model.enabled && model.capability === 'image')
    .map((model) => ({ connection, model })))
  const groupTextModelsByProvider = new Set(enabledTextModels.map(({ connection }) => connection.id)).size > 1
  const groupImageModelsByProvider = new Set(enabledImageModels.map(({ connection }) => connection.id)).size > 1
  const selectedImageModel = enabledImageModels.find(({ connection, model }) => (
    connection.id === apiSettings.selectedImageModel?.connectionId
    && model.id === apiSettings.selectedImageModel?.modelId
  )) ?? enabledImageModels[0]
  const activeGenerationPlan = activeGenerationNode
    ? agentPlans.find((plan) => plan.nodeId === activeGenerationNode.id)
    : undefined
  const activeNodeImageConnectionId = activeGenerationNode?.data.imageModelConnectionId ?? activeGenerationPlan?.imageConnectionId
  const activeNodeImageModelId = activeGenerationNode?.data.imageModelId ?? activeGenerationPlan?.imageModelId
  const configuredActiveNodeImageModel = activeNodeImageConnectionId && activeNodeImageModelId
    ? enabledImageModels.find(({ connection, model }) => (
        connection.id === activeNodeImageConnectionId
        && model.id === activeNodeImageModelId
      ))
    : undefined
  const activeNodeImageModel = configuredActiveNodeImageModel ?? selectedImageModel
  const displayedActiveNodeImageModel = configuredActiveNodeImageModel
    ?? (activeNodeImageModelId ? undefined : selectedImageModel)
  const hasCatalogTextModels = apiSettings.connections.filter(isConnectionUsable).some((connection) => connection.models.some((model) => model.capability === 'text'))
  const hasCatalogImageModels = apiSettings.connections.filter(isConnectionUsable).some((connection) => connection.models.some((model) => model.capability === 'image'))

  useEffect(() => {
    const validTextKeys = new Set(enabledTextModels.map(({ connection, model }) => `${connection.id}::${model.id}`))
    const validImageKeys = new Set(enabledImageModels.map(({ connection, model }) => `${connection.id}::${model.id}`))
    if (!validTextKeys.has(agentTextModelKey)) setAgentTextModelKey(enabledTextModels[0] ? `${enabledTextModels[0].connection.id}::${enabledTextModels[0].model.id}` : '')
    if (agentImageModelKey && !validImageKeys.has(agentImageModelKey)) setAgentImageModelKey('')
  }, [agentImageModelKey, agentTextModelKey, enabledImageModels, enabledTextModels])

  const appendOutputHistory = (record: Omit<OutputHistoryRecord, 'id' | 'createdAt' | 'projectId'>, projectId = activeProjectId) => {
    const nextRecord: OutputHistoryRecord = {
      ...record,
      id: `output-${Date.now()}-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      projectId,
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

  const captureGenerationAdminLog = (
    log: GenerationAdminLog,
    meta: { prompt: string; modelName: string; connectionName: string; projectId?: string },
  ) => {
    appendOperatorRecoveryLog({
      projectId: meta.projectId ?? activeProjectId,
      provider: log.provider || meta.connectionName || 'Custom API',
      taskId: log.taskId,
      model: log.model,
      modelName: meta.modelName,
      connectionName: meta.connectionName,
      prompt: meta.prompt,
      durationMs: log.durationMs,
      resultType: log.resultType,
      kind: log.kind ?? 'image',
      requestJson: log.requestJson,
      resultJson: log.resultJson,
      resultUrls: log.resultUrls ?? [],
      createdAt: log.finishedAt,
    })
    if (operatorUnlocked) setOperatorLogs(listOperatorRecoveryLogs(activeProjectId))
  }

  const lockOperatorView = () => {
    lockOperatorSession()
    setOperatorUnlocked(false)
    setOperatorPassDraft('')
    setOperatorGateError('')
    setOperatorLogs([])
    setExpandedOperatorLogId(null)
  }

  const submitOperatorGate = async () => {
    const ok = await verifyOperatorAccess(operatorPassDraft)
    if (!ok) {
      setOperatorGateError('通行凭证无效')
      setOperatorPassDraft('')
      return
    }
    unlockOperatorSession()
    setOperatorUnlocked(true)
    setOperatorPassDraft('')
    setOperatorGateError('')
    setOperatorLogs(listOperatorRecoveryLogs(activeProjectId))
  }

  const selectOutputHistoryFilter = (value: typeof outputHistoryFilter) => {
    if (outputHistoryFilter === 'ops' && value !== 'ops') lockOperatorView()
    setOutputHistoryFilter(value)
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

  const archiveHistoryRecord = async (record: GenerationRecord): Promise<GenerationRecord> => {
    if (record.mediaId || !record.imageUrl) return record
    const response = await fetch(record.imageUrl)
    if (!response.ok) throw new Error(`图片归档失败（${response.status}）`)
    const blob = await response.blob()
    const mediaId = `history-media-${crypto.randomUUID()}`
    await saveHistoryMedia({ id: mediaId, blob, fileName: record.fileName, createdAt: record.createdAt })
    const imageUrl = URL.createObjectURL(blob)
    historyMediaObjectUrlsRef.current.set(mediaId, imageUrl)
    return { ...record, mediaId, imageUrl }
  }

  const archiveGenerationRecords = async (records: GenerationRecord[]) => Promise.all(records.map(async (record) => {
    try {
      return await archiveHistoryRecord(record)
    } catch {
      // Keep the provider URL as a fallback when its CDN disallows browser downloads.
      return record
    }
  }))

  const ensureHistoryRecordArchived = (record: GenerationRecord) => {
    if (record.mediaId || historyArchiveAttemptedRef.current.has(record.id)) return
    historyArchiveAttemptedRef.current.add(record.id)
    void archiveHistoryRecord(record).then((archived) => {
      if (!archived.mediaId) return
      setGenerationHistory((current) => current.map((item) => item.id === record.id ? archived : item))
    }).catch(() => {
      // The visible provider URL remains usable for this session when CORS blocks archiving.
    })
  }

  const repairGenerationHistoryImage = async (record: GenerationRecord, file: File) => {
    if (!file.type.startsWith('image/')) {
      setToastMessage('请选择图片文件')
      return
    }
    try {
      if (record.mediaId) {
        const oldUrl = historyMediaObjectUrlsRef.current.get(record.mediaId)
        if (oldUrl) URL.revokeObjectURL(oldUrl)
        historyMediaObjectUrlsRef.current.delete(record.mediaId)
        await deleteHistoryMedia(record.mediaId)
      }
      const mediaId = `history-media-${crypto.randomUUID()}`
      await saveHistoryMedia({ id: mediaId, blob: file, fileName: file.name || record.fileName, createdAt: record.createdAt })
      const imageUrl = URL.createObjectURL(file)
      historyMediaObjectUrlsRef.current.set(mediaId, imageUrl)
      setGenerationHistory((current) => current.map((item) => item.id === record.id
        ? { ...item, mediaId, imageUrl, fileName: file.name || item.fileName }
        : item))
      setBrokenHistoryIds((current) => current.filter((id) => id !== record.id))
      setToastMessage('历史图片已重新关联并保存到本机')
    } catch (error) {
      setToastMessage(error instanceof Error ? `重新关联失败：${error.message}` : '重新关联图片失败')
    }
  }

  const recoverOutputImages = async (record: OutputHistoryRecord, files: File[]) => {
    const images = files.filter((file) => file.type.startsWith('image/'))
    if (!images.length) {
      setToastMessage('请选择从服务商记录中下载的图片')
      return
    }
    const createdAt = new Date().toISOString()
    try {
      const recovered = await Promise.all(images.map(async (file, index): Promise<GenerationRecord> => {
        const mediaId = `history-media-${crypto.randomUUID()}`
        await saveHistoryMedia({ id: mediaId, blob: file, fileName: file.name, createdAt })
        const imageUrl = URL.createObjectURL(file)
        historyMediaObjectUrlsRef.current.set(mediaId, imageUrl)
        return {
          id: `history-recovered-${crypto.randomUUID()}`,
          createdAt,
          prompt: record.prompt,
          model: record.modelName,
          imageUrl,
          fileName: file.name || `disy-recovered-${Date.now()}-${index + 1}.png`,
          projectId: record.projectId,
          mediaId,
        }
      }))
      setGenerationHistory((current) => [...recovered, ...current])
      setOutputHistory((current) => current.map((item) => item.id === record.id
        ? { ...item, recoveredCount: (item.recoveredCount ?? 0) + recovered.length }
        : item))
      setToastMessage(`已找回 ${recovered.length} 张图片，并放入生成历史`)
    } catch (error) {
      setToastMessage(error instanceof Error ? `找回失败：${error.message}` : '找回图片失败')
    }
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
    if (!activeTextNode) return
    const taskKey = `text:${activeTextNode.id}`
    if (generationTaskControllersRef.current.has(taskKey)) {
      setToastMessage('这个文本节点已经在生成中')
      return
    }
    const rawPromptText = activeTextNode.data.promptText ?? ''
    const promptText = activeTextReferences.reduce((value, reference) => {
      const available = reference.kind === 'text' ? Boolean(reference.text?.trim()) : Boolean(reference.url)
      return value.replaceAll(reference.mention, available ? `@${reference.name}` : '')
    }, rawPromptText).replace(/@\[node:[^\]]+\]/g, '').trim()
    const selectedTextReferences = selectedTextNodeReferences.filter((reference) => reference.kind === 'text' && reference.text?.trim())
    const selectedVisualReferences = selectedTextNodeReferences.filter((reference) => reference.kind === 'image' && reference.url)
    const textReferenceGuide = selectedTextReferences.length
      ? `参考文本：\n${selectedTextReferences.map((reference) => `@${reference.name}\n${reference.text}`).join('\n\n')}`
      : ''
    const imageReferenceGuide = shouldAppendReferenceGuide({
      modelId: selectedTextModel.model.id,
      baseUrl: selectedTextModel.connection.baseUrl,
      isImageGeneration: false,
    })
      ? buildNumberedReferenceGuide(selectedVisualReferences.map((reference) => ({
        name: reference.name,
        url: reference.url!,
      })))
      : ''
    const prompt = [promptText, textReferenceGuide, imageReferenceGuide, projectPromptSuffix.trim()].filter(Boolean).join('\n\n')
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

    const controller = beginGenerationTask(taskKey)
    if (!controller) return
    setModelMenuOpen(false)
    const textGenerationOrigin = { projectId: activeProjectId, canvasId: activeCanvasId }
    const textGenerationNodeId = activeTextNode.id
    try {
      const referenceImages = await Promise.all(selectedVisualReferences.map((reference) => prepareReferenceImageForRequest(reference.url!, controller.signal)))
      const output = await generateRemoteText({
        baseUrl: selectedTextModel.connection.baseUrl,
        apiKey: selectedTextModel.connection.apiKey,
        model: selectedTextModel.model.id,
      }, prompt, {
        referenceImages,
        signal: controller.signal,
        captureAdminLog: (log) => captureGenerationAdminLog(log, {
          prompt,
          modelName: selectedTextModel.model.name,
          connectionName: selectedTextModel.connection.name,
          projectId: textGenerationOrigin.projectId,
        }),
      })
      await patchCanvasNodesAtOrigin(textGenerationOrigin, (current) => current.map((node) => node.id === textGenerationNodeId
        ? { ...node, data: { ...node.data, body: output, status: selectedTextModel.model.name } }
        : node))
      appendOutputHistory({
        kind: 'text',
        status: 'success',
        prompt,
        modelId: selectedTextModel.model.id,
        modelName: selectedTextModel.model.name,
        connectionName: selectedTextModel.connection.name,
        requestedCount: generationCount,
        outputCount: 1,
        preview: output.slice(0, 240),
      }, textGenerationOrigin.projectId)
      setToastMessage('文本节点已更新')
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        setToastMessage('文本生成已停止')
        return
      }
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
      }, textGenerationOrigin.projectId)
      setToastMessage(historyError.summary)
    } finally {
      finishGenerationTask(taskKey)
    }
  }

  const generateFromActiveImageNode = async () => {
    if (!activeGenerationNode) return
    const generationNodeId = activeGenerationNode.id
    const taskKey = `image:${generationNodeId}`
    if (generationTaskControllersRef.current.has(taskKey)) {
      setGenerationControlMenuNodeId(generationNodeId)
      return
    }
    const promptText = activeGenerationReferences.reduce((value, reference) => {
      if (!('kind' in reference)) return value
      const available = reference.kind === 'text' ? Boolean(reference.text?.trim()) : Boolean(reference.url)
      return value.replaceAll(reference.mention, available ? `@${reference.name}` : '')
    }, activeGenerationNode.data.body).replace(/@\[node:[^\]]+\]/g, '').trim()
    if (!promptText) {
      setToastMessage('请先输入图像提示词')
      return
    }
    if (highestReferencedImageNumber > activeImageReferences.filter((reference) => Boolean(reference.url)).length) {
      setToastMessage(`提示词引用了图${highestReferencedImageNumber}，但顶部只有 ${activeImageReferences.filter((reference) => Boolean(reference.url)).length} 张可用图片`)
      return
    }
    const invocationText = activeGenerationReferences.reduce((value, reference) => value.replaceAll(reference.mention, ''), activeGenerationNode.data.body)
    const styleInvocation = resolveStylePresets(stylePresets, invocationText)
    const orderedImageReferences = uniqueNamedImageReferences([
      ...selectedAvailableImageReferences.map((reference) => ({ name: reference.name, url: reference.url })),
      ...styleInvocation.references.map((reference) => ({ name: reference.name, url: reference.url })),
    ])
    const mentionGuide = shouldAppendReferenceGuide({
      modelId: activeNodeImageModel.model.id,
      baseUrl: activeNodeImageModel.connection.baseUrl,
      isImageGeneration: true,
    })
      ? buildNumberedReferenceGuide(orderedImageReferences)
      : ''
    const textReferenceGuide = selectedGenerationTextReferences.filter((reference) => reference.text?.trim()).length
      ? `参考文本：\n${selectedGenerationTextReferences.filter((reference) => reference.text?.trim()).map((reference) => `@${reference.name}\n${reference.text}`).join('\n\n')}`
      : ''
    const prompt = [promptText, textReferenceGuide, mentionGuide, projectPromptSuffix.trim()].filter(Boolean).join('\n\n')
    if (!activeNodeImageModel) {
      setToastMessage(hasCatalogImageModels ? '已有图像模型但尚未启用，请到 API 设置中勾选' : '请先添加并启用图像模型')
      setApiOpen(true)
      return
    }
    if (!activeNodeImageModel.connection.apiKey) {
      setToastMessage('当前连接缺少 API Key，请重新填写')
      setEditingConnectionId(activeNodeImageModel.connection.id)
      setApiOpen(true)
      return
    }
    const requestedReferenceUrls = orderedImageReferences.map((reference) => reference.url)
    if (requestedReferenceUrls.length > 16) {
      setToastMessage(`参考图最多 16 张，当前已选择 ${requestedReferenceUrls.length} 张`)
      return
    }

    const controller = beginGenerationTask(taskKey)
    if (!controller) return
    setImageModelMenuOpen(false)
    const generationOrigin = { projectId: activeProjectId, canvasId: activeCanvasId }
    setNodes((current) => current.map((node) => node.id === generationNodeId
      ? { ...node, data: { ...node.data, status: '生成中', imageModelConnectionId: activeNodeImageModel.connection.id, imageModelId: activeNodeImageModel.model.id, imageModelName: activeNodeImageModel.model.name } }
      : node))
    try {
      const referenceImages = await Promise.all(requestedReferenceUrls.map((url) => prepareReferenceImageForRequest(url, controller.signal)))
      const requestMode = /^https?:\/\/(?:grsaiapi\.com|grsai\.dakka\.com\.cn)(?:\/|$)/i.test(activeNodeImageModel.connection.baseUrl.trim())
        ? 'api/generate + api/result'
        : referenceImages.length > 0 && /(?:gpt-image|chatgpt-image)/i.test(activeNodeImageModel.model.id)
          ? 'images/edits'
          : 'images/generations'
      const images: Awaited<ReturnType<typeof generateRemoteImages>> = []
      let stoppedError: unknown = null
      // A requested 2×/3×/4× batch is intentionally billed as up to that many
      // single-image requests. Each slot is sent once, sequentially, and the first
      // failure stops the remaining queue so unsupported gateways cannot keep charging.
      while (images.length < generationCount) {
        try {
          if (controller.signal.aborted) throw new DOMException('Generation interrupted', 'AbortError')
          const remaining = generationCount - images.length
          const batch = await generateRemoteImages({
            baseUrl: activeNodeImageModel.connection.baseUrl,
            apiKey: activeNodeImageModel.connection.apiKey,
            model: activeNodeImageModel.model.id,
          }, {
            prompt,
            count: 1,
            referenceImages,
            aspectRatio: activeImageAspectRatio,
            resolution: activeImageResolution,
            detail: activeImageDetail,
            signal: controller.signal,
            captureAdminLog: (log) => captureGenerationAdminLog(log, {
              prompt: promptText,
              modelName: activeNodeImageModel.model.name,
              connectionName: activeNodeImageModel.connection.name,
              projectId: generationOrigin.projectId,
            }),
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
      await patchCanvasNodesAtOrigin(generationOrigin, (current) => current.map((node) => {
        if (node.id !== generationNodeId) return node
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
            status: stoppedError
              ? (stoppedError instanceof DOMException && stoppedError.name === 'AbortError'
                  ? (generationTaskStopReasonRef.current.get(taskKey) === 'paused' ? '已暂停' : '已停止')
                  : '生成失败')
              : '已完成',
          },
        }
      }))
      const records = await archiveGenerationRecords(newVariants.map((variant): GenerationRecord => ({
        id: `history-${variant.id}`,
        createdAt: new Date().toISOString(),
        prompt,
        model: activeNodeImageModel.model.name,
        imageUrl: variant.url,
        fileName: variant.fileName,
        projectId: generationOrigin.projectId,
      })))
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
        modelId: activeNodeImageModel.model.id,
        modelName: activeNodeImageModel.model.name,
        connectionName: activeNodeImageModel.connection.name,
        requestedCount: generationCount,
        outputCount: images.length,
        preview: `${activeImageAspectRatio} · ${activeImageResolution} · ${IMAGE_DETAIL_LABELS[activeImageDetail]} · 参考图 ${referenceImages.length} 张 · ${requestMode}`,
      }, generationOrigin.projectId)
      if (stoppedError && !(stoppedError instanceof DOMException && stoppedError.name === 'AbortError')) {
        appendOutputHistory({
          kind: 'image',
          status: 'failed',
          prompt: promptText,
          modelId: activeNodeImageModel.model.id,
          modelName: activeNodeImageModel.model.name,
          connectionName: activeNodeImageModel.connection.name,
          requestedCount: generationCount - images.length,
          outputCount: 0,
          preview: `参考图 ${referenceImages.length} 张 · ${requestMode}`,
          error: toOutputHistoryError(stoppedError),
        }, generationOrigin.projectId)
      }
      setToastMessage(stoppedError
        ? stoppedError instanceof DOMException && stoppedError.name === 'AbortError'
          ? `${generationTaskStopReasonRef.current.get(taskKey) === 'paused' ? '任务已暂停' : '任务已停止'}${images.length ? `；已保留 ${images.length} 张成功结果` : ''}`
          : `生成失败，已停止后续请求${images.length ? `；已保留 ${images.length} 张成功结果` : ''}`
        : `已生成 ${images.length} 张图像`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        const stoppedStatus = generationTaskStopReasonRef.current.get(taskKey) === 'paused' ? '已暂停' : '已停止'
        await patchCanvasNodesAtOrigin(generationOrigin, (current) => current.map((node) => node.id === generationNodeId
          ? { ...node, data: { ...node.data, status: stoppedStatus } }
          : node))
        return
      }
      const historyError = toOutputHistoryError(error)
      const attemptedReferenceCount = requestedReferenceUrls.length
      const attemptedRequestMode = /^https?:\/\/(?:grsaiapi\.com|grsai\.dakka\.com\.cn)(?:\/|$)/i.test(activeNodeImageModel.connection.baseUrl.trim())
        ? 'api/generate + api/result'
        : attemptedReferenceCount > 0 && /(?:gpt-image|chatgpt-image)/i.test(activeNodeImageModel.model.id)
          ? 'images/edits'
          : 'images/generations'
      await patchCanvasNodesAtOrigin(generationOrigin, (current) => current.map((node) => node.id === generationNodeId
        ? { ...node, data: { ...node.data, status: '生成失败' } }
        : node))
      appendOutputHistory({
        kind: 'image',
        status: 'failed',
        prompt: promptText,
        modelId: activeNodeImageModel.model.id,
        modelName: activeNodeImageModel.model.name,
        connectionName: activeNodeImageModel.connection.name,
        requestedCount: generationCount,
        outputCount: 0,
        preview: `参考图 ${attemptedReferenceCount} 张 · ${attemptedRequestMode}`,
        error: historyError,
      }, generationOrigin.projectId)
      setToastMessage(historyError.summary)
    } finally {
      finishGenerationTask(taskKey)
    }
  }

  useEffect(() => {
    if (!autoGenerateNodeId || activeGenerationNode?.id !== autoGenerateNodeId) return
    setAutoGenerateNodeId(null)
    void generateFromActiveImageNode()
  }, [autoGenerateNodeId, activeGenerationNode?.id])

  const agentImageCandidates: AgentImageReference[] = nodes.flatMap((node) => {
    if ((node.data.kind !== 'image' && node.data.kind !== 'upload') || !node.data.imageUrl) return []
    return [{ nodeId: node.id, name: getNodeDisplayTitle(node.data), url: node.data.imageUrl }]
  })

  const resolveAgentContextReferences = (content: string, explicitReferences: AgentImageReference[]) => {
    const explicitContexts: AgentContextReference[] = explicitReferences.map((reference) => ({
      ...reference,
      kind: 'image',
    }))
    const hasContextualPointer = /(?:上面|前面|刚才|之前|上一(?:张|段|个|版)|那个|这个|它|其|图\s*\d+|图片\s*\d+|参考图\s*\d+|logo|标志|图标|海报|文案|文字|标题|脚本|提案)/i.test(content)
    if (!hasContextualPointer) return { imageReferences: explicitReferences, contextReferences: explicitContexts }

    const nodeContexts = [...nodes].reverse().flatMap((node): AgentContextReference[] => {
      if ((node.data.kind === 'image' || node.data.kind === 'upload') && node.data.imageUrl) {
        return [{ nodeId: node.id, name: getNodeDisplayTitle(node.data), kind: 'image', url: node.data.imageUrl }]
      }
      if (node.data.kind === 'text') {
        const text = (node.data.body || node.data.promptText || '').trim()
        if (text) return [{ nodeId: node.id, name: getNodeDisplayTitle(node.data), kind: 'text', excerpt: text.slice(0, 180) }]
      }
      return []
    })
    const recentMessageImages = [...agentMessages].reverse().flatMap((message) => [...(message.references ?? [])].reverse())
    const recentPlanImages = [...agentPlans].reverse().flatMap((plan) => [...(plan.references ?? [])].reverse())
    const selectedContexts = selectedNodeIds.flatMap((id) => nodeContexts.filter((reference) => reference.nodeId === id))
    const orderedImages = Array.from(new Map([...recentMessageImages, ...recentPlanImages, ...agentImageCandidates.slice().reverse()].map((reference) => [reference.nodeId, reference])).values())
    const orderedContexts = Array.from(new Map([...selectedContexts, ...nodeContexts].map((reference) => [reference.nodeId, reference])).values())
    const ordinal = content.match(/(?:参考图|图片|图)\s*([1-9]\d*)/i)
    let resolved: AgentContextReference | undefined
    let reason = ''
    if (ordinal) {
      const index = Number(ordinal[1]) - 1
      const numberedSource = [...agentMessages].reverse().find((message) => message.references?.length)?.references
        ?? [...agentPlans].reverse().find((plan) => plan.references?.length)?.references
      const match = numberedSource?.[index]
      if (match) {
        resolved = { ...match, kind: 'image' }
        reason = `匹配“${ordinal[0]}”`
      }
    }
    if (!resolved && /(?:logo|标志|图标)/i.test(content)) {
      const match = orderedContexts.find((reference) => /(?:logo|标志|图标)/i.test(`${reference.name} ${reference.excerpt ?? ''}`))
      if (match) {
        resolved = match
        reason = '按名称/内容匹配 logo'
      }
    }
    if (!resolved && /(?:文案|文字|标题|脚本|提案|上一段)/i.test(content)) {
      resolved = orderedContexts.find((reference) => reference.kind === 'text')
      reason = resolved ? '匹配最近的文本节点' : ''
    }
    if (!resolved && /(?:图|图片|海报|上一张)/i.test(content)) {
      const match = orderedImages[0]
      if (match) {
        resolved = { ...match, kind: 'image' }
        reason = '匹配最近提及的图片'
      }
    }
    if (!resolved && /(?:上面|前面|刚才|之前|那个|这个|它|其)/i.test(content)) {
      const recentReferencedImage = orderedImages.find((reference) => recentMessageImages.some((item) => item.nodeId === reference.nodeId) || recentPlanImages.some((item) => item.nodeId === reference.nodeId))
      resolved = selectedContexts.length === 1
        ? selectedContexts[0]
        : recentReferencedImage
          ? { ...recentReferencedImage, kind: 'image' }
          : nodeContexts.length === 1
            ? nodeContexts[0]
            : undefined
      reason = resolved ? (selectedContexts.length === 1 ? '匹配当前选中节点' : recentReferencedImage ? '匹配最近提及的对象' : '画布中唯一可关联对象') : ''
    }
    if (!resolved || explicitContexts.some((reference) => reference.nodeId === resolved?.nodeId)) {
      return { imageReferences: explicitReferences, contextReferences: explicitContexts }
    }
    const autoContext = { ...resolved, autoResolved: true, resolutionReason: reason }
    const contextReferences = [...explicitContexts, autoContext]
    const imageReferences = autoContext.kind === 'image' && autoContext.url
      ? [...explicitReferences, { nodeId: autoContext.nodeId, name: autoContext.name, url: autoContext.url, autoResolved: true, resolutionReason: reason }]
      : explicitReferences
    return { imageReferences, contextReferences }
  }

  const locateAgentCanvasNode = (nodeId: string) => {
    const node = nodes.find((item) => item.id === nodeId)
    if (!node) {
      setToastMessage('对应的画布节点已不存在')
      return
    }
    setNodes((current) => current.map((item) => ({ ...item, selected: item.id === nodeId })))
    setActiveEditorNodeId(null)
    setActiveImageNodeId(null)
    setActiveGenerationNodeId(node.data.kind === 'image' ? nodeId : null)
    setExpandedEditorNodeId(null)
    window.requestAnimationFrame(() => {
      void fitCanvas({ nodes: [{ id: nodeId }], padding: 0.65, maxZoom: 1.05, duration: reduceMotion ? 0 : 320 })
      measureNodeOverlay(nodeId)
    })
  }

  const createAgentUploadedReference = (reference: Omit<AgentImageReference, 'nodeId'>): AgentImageReference => {
    const nodeId = `agent-upload-${crypto.randomUUID()}`
    const center = screenToFlowPosition({ x: Math.max(320, (window.innerWidth - (agentOpen ? 420 : 0)) / 2), y: window.innerHeight / 2 })
    setNodes((current) => [...current, {
      id: nodeId,
      type: 'disy',
      position: { x: center.x - 130, y: center.y - 110 },
      data: { kind: 'upload', title: reference.name, body: '', fileName: reference.name, imageUrl: reference.url },
    }])
    setToastMessage('参考图已加入画布和 Agent 对话')
    return { ...reference, nodeId }
  }

  const sendAgentMessage = async (content: string, invocationText = content, messageReferences = agentReferences) => {
    const [connectionId, modelId] = agentTextModelKey.split('::')
    const selection = enabledTextModels.find((item) => item.connection.id === connectionId && item.model.id === modelId)
    if (!selection) {
      setToastMessage('请先为 Agent 选择对话模型')
      setApiOpen(true)
      return
    }
    setAgentOpen(true)
    setAgentCanvasPicking(false)
    const resolvedContext = resolveAgentContextReferences(content, messageReferences)
    messageReferences = resolvedContext.imageReferences
    const resolvedContextReferences = resolvedContext.contextReferences
    const agentReferenceCount = messageReferences.length
    if (agentReferenceCount > 16) {
      setToastMessage(`Agent 参考图最多 16 张，当前共 ${agentReferenceCount} 张`)
      return
    }
    const sentReferences = messageReferences.map((reference) => ({ ...reference }))
    const styleInvocation = resolveStylePresets(stylePresets, invocationText)
    const invokedStylePresets = styleInvocation.matchedPresets.map((preset) => ({
      id: preset.id,
      name: preset.name,
      keyword: preset.keyword.trim(),
      references: preset.references.map((reference) => ({ ...reference })),
    }))
    const invokedStyleReferences = styleInvocation.references.map((reference) => ({ ...reference }))
    const styleInvocationWords = invokedStylePresets.map((preset) => preset.keyword)
    const explicitPlanCount = getRequestedAgentPlanCount(invocationText)
    if (explicitPlanCount !== null && explicitPlanCount > 20) {
      setToastMessage('单次最多提供 20 个独立方案，请减少方案数量后重试')
      return
    }
    const directImagePlanRequested = messageRequestsDirectImagePlan(invocationText)
    const hasImageConversationContext = sentReferences.length > 0
      || agentMessages.slice(-6).some((message) => Boolean(message.references?.length))
      || agentPlans.some((plan) => plan.status === 'proposed' || plan.status === 'ready')
    const requestedPlanCount = explicitPlanCount ?? (directImagePlanRequested ? 1 : 3)
    const expectsImagePlans = messageExpectsImagePlans(invocationText)
      || (directImagePlanRequested && hasImageConversationContext)
    const availableStyleKeywords = stylePresets
      .filter((preset) => preset.enabled && preset.references.length && preset.keyword.trim())
      .map((preset) => `${preset.name}：“${preset.keyword.trim()}”`)
    const userMessage: AgentMessage = { id: `agent-message-${crypto.randomUUID()}`, role: 'user', content, createdAt: new Date().toISOString(), references: sentReferences }
    const nextMessages = [...agentMessages, userMessage]
    agentRequestRef.current?.abort()
    const controller = new AbortController()
    const requestVersion = ++agentRequestVersionRef.current
    agentRequestRef.current = controller
    setAgentMessages(nextMessages)
    setAgentBusy(true)
    try {
      const images = await Promise.all(sentReferences.map((reference) => prepareReferenceImageForRequest(reference.url, controller.signal)))
      const transcript = nextMessages.slice(-12).map((message) => `${message.role === 'user' ? '用户' : 'Disy'}：${message.role === 'assistant' ? normalizeAgentMessageContent(message.content) : message.content}`).join('\n')
      const resolvedContextGuide = resolvedContextReferences.length
        ? `系统已为本轮解析出这些上下文对象：${resolvedContextReferences.map((reference) => `${reference.kind === 'image' ? '图片' : '文本'}“${reference.name}”${reference.excerpt ? `（内容摘要：${reference.excerpt}）` : ''}${reference.autoResolved ? `，自动关联依据：${reference.resolutionReason}` : ''}`).join('；')}。必须按这些对象理解用户指代；如语义仍不唯一，在 reply 中追问，不要自行替换成其他对象。`
        : '本轮没有解析出明确的上下文对象；遇到“那个/它/上面”等无法唯一落到对象的指代时，必须先追问。'
      const agentReferenceGuide = shouldAppendReferenceGuide({
        modelId: selection.model.id,
        baseUrl: selection.connection.baseUrl,
        isImageGeneration: false,
      })
        ? buildNumberedReferenceGuide(sentReferences)
        : ''
      const numberedUserRequest = numberAgentReferenceMentions(content, sentReferences)
      const referenceUsageGuide = sentReferences.length
        ? `本次多图任务的用户原始要求如下，必须逐字理解图像角色，并把关系明确写入每个 imagePlans.prompt；不得把待修复主体、风格参考、构图参考或其他用途互换：\n${numberedUserRequest}`
        : ''
      const orchestrationGuide = `你不是只负责生图的助手，而是创作流程的总控。先识别用户的目标属于脚本/文案、设计提案、图像、视频或混合任务。只要缺少会影响结果的关键信息，先用 1 到 3 个简洁问题逐步澄清：目标受众、交付物、风格、素材、时长/规格与优先级；不要一次抛出冗长问卷。用户说“写脚本”时，先确认题材、平台、时长、人物和结构，再给大纲，确认后再给分场/镜头/台词；用户说“设计提案”时，先确认品牌目标、受众、场景与约束，再给可选方向；用户说“视频”时，先确认时长、平台、画幅、节奏与素材，再规划脚本、分镜、画面与声音。信息已足够时，按内容类型给出明确下一步：文本内容应结构化、可直接放入文本节点；图像才提出 imagePlans；视频先拆为脚本、分镜、素材和生成任务，暂不假装视频已生成。不要为了凑方案而在信息不足时直接生成。`
      const textNodeGuide = `文本节点有严格门槛：需求澄清、创作方向、大纲提案、用户尚未确认的草稿都只能放在 reply 中，绝对不要返回 textNode。只有用户已经明确选择或确认方向，并且你已产出一份完整、整合、可直接交付的最终脚本/文案/提案正文时，才返回 textNode。textNode 只能有一个，content 必须是完整交付物，不能是追问、方案列表或解释。`
      const directPlanGuide = directImagePlanRequested
        ? '用户本次明确不要再选择多个方案。若上下文中的画面目标已经足够清楚，直接把用户要求整合成唯一一项 imagePlans，供界面创建待确认卡；不要再追问创作方向，也不要返回多个备选。仍然不得直接声称已经生图。'
        : '用户未明确跳过方案选择时，按正常流程提出可选方向。'
      const instruction = `你是 Disy 创意画布助手。请和用户中文对话、脑暴。${orchestrationGuide} ${textNodeGuide} ${directPlanGuide} 禁止直接生成图像，也禁止声称图片已经生成；用户明确表达想生成图像时，必须先提出 imagePlans，等待用户在界面选择方案并逐一点击确认后才能生图。严格只返回 JSON，不要 Markdown：{"reply":"自然对话回复；文本/脚本请用清晰标题、列表与可复制内容组织","textNode":{"title":"仅最终交付物标题","content":"仅最终整合正文"},"imagePlans":[{"label":"方案一","prompt":"只描述这个方向、可直接用于生图的完整中文提示词","aspectRatio":"1:1","resolution":"1K","detail":"medium","count":1}]}。不满足最终文本交付条件时必须省略 textNode。本次如果需要生图，imagePlans 必须恰好返回 ${requestedPlanCount} 项：用户明确要求了方案数量时严格遵循；${directImagePlanRequested ? '用户要求跳过多方案时只返回一个可确认方案' : '未明确数量时默认三个方案'}。每个方向必须是独立项目，禁止把多个方向的关键词合并进同一个 prompt。count 只表示同一方案生成几张变体，不表示方案数量。如果不需要生图，省略 imagePlans。用户提到图1、图片1或参考图1时，都表示下方编号中的同一张图片；每份方案必须保留用户指定的图片编号及其用途，不得交换顺序。${resolvedContextGuide}${referenceUsageGuide ? `\n\n${referenceUsageGuide}` : ''}\n\n${agentReferenceGuide || '本次对话没有参考图。'}\n\n${styleInvocationWords.length ? `用户本次已调用风格预设：${invokedStylePresets.map((preset) => `${preset.name}（${preset.keyword}）`).join('、')}，确认卡会自动附带对应风格图。` : availableStyleKeywords.length ? `可用风格预设为：${availableStyleKeywords.join('；')}。仅当用户本次消息包含对应调用词时才附带风格图。` : '项目未设置可用的风格调用词。'}\n\n${transcript}`
      let raw = await generateRemoteText({ baseUrl: selection.connection.baseUrl, apiKey: selection.connection.apiKey, model: selection.model.id }, instruction, { referenceImages: images, signal: controller.signal })
      if (controller.signal.aborted || requestVersion !== agentRequestVersionRef.current) return
      let parsed = parseAgentReply(raw)
      let parsedPlans = parsed.imagePlans ?? (parsed.imagePlan ? [parsed.imagePlan] : [])
      if ((expectsImagePlans || parsedPlans.length > 0) && parsedPlans.length !== requestedPlanCount) {
        raw = await generateRemoteText(
          { baseUrl: selection.connection.baseUrl, apiKey: selection.connection.apiKey, model: selection.model.id },
          `${instruction}\n\n你上一次返回了 ${parsedPlans.length} 个方案，数量不符合要求。请重新返回恰好 ${requestedPlanCount} 个彼此独立的 imagePlans。`,
          { referenceImages: images, signal: controller.signal },
        )
        if (controller.signal.aborted || requestVersion !== agentRequestVersionRef.current) return
        const corrected = parseAgentReply(raw)
        const correctedPlans = corrected.imagePlans ?? (corrected.imagePlan ? [corrected.imagePlan] : [])
        parsed = corrected
        parsedPlans = correctedPlans
      }
      if ((expectsImagePlans || parsedPlans.length > 0) && parsedPlans.length !== requestedPlanCount) {
        throw new Error(`Agent 未能返回要求的 ${requestedPlanCount} 个方案，请重试一次`)
      }
      const assistantMessage: AgentMessage = {
        id: `agent-message-${crypto.randomUUID()}`,
        role: 'assistant',
        content: parsed.reply || '我已经整理好了。',
        createdAt: new Date().toISOString(),
      }
      setAgentMessages((current) => [...current, assistantMessage])
      parsedPlans = parsedPlans.slice(0, requestedPlanCount).map((draft) => ({
        ...draft,
        prompt: ensureAgentPlanReferenceContext(draft.prompt, numberedUserRequest, sentReferences),
      }))
      if (parsedPlans.length) {
        const [imageConnectionId, imageModelId] = agentImageModelKey.split('::')
        const createdAt = new Date().toISOString()
        const needsChoice = parsedPlans.length > 1
        setAgentPlans((current) => [...current, ...parsedPlans.map((draft, index): AgentImagePlan => ({
          id: `agent-plan-${crypto.randomUUID()}`,
          status: needsChoice ? 'proposed' : 'ready',
          label: draft.label || `方案${index + 1}`,
          prompt: draft.prompt,
          referenceNodeIds: sentReferences.map((item) => item.nodeId),
          references: sentReferences,
          contextReferences: resolvedContextReferences,
          invokedStyleReferences,
          styleInvocationWord: styleInvocationWords.length ? styleInvocationWords.join('、') : undefined,
          invokedStylePresets,
          aspectRatio: agentImageDefaults.aspectRatio,
          resolution: agentImageDefaults.resolution,
          detail: agentImageDefaults.detail,
          count: agentImageDefaults.count,
          imageConnectionId,
          imageModelId,
          assistantMessageId: assistantMessage.id,
          createdAt,
        }))])
      }
      if (parsed.textNode) {
        setAgentTextPlans((current) => [...current, {
          id: `agent-text-plan-${crypto.randomUUID()}`,
          status: 'ready',
          title: parsed.textNode!.title,
          content: parsed.textNode!.content,
          contextReferences: resolvedContextReferences,
          assistantMessageId: assistantMessage.id,
          createdAt: new Date().toISOString(),
        }])
      }
      setAgentReferences([])
    } catch (error) {
      if (controller.signal.aborted || requestVersion !== agentRequestVersionRef.current) return
      setAgentMessages((current) => [...current, { id: `agent-message-${crypto.randomUUID()}`, role: 'assistant', content: `这次没有成功：${error instanceof Error ? error.message : '对话请求失败'}`, createdAt: new Date().toISOString() }])
    } finally {
      if (requestVersion === agentRequestVersionRef.current) {
        agentRequestRef.current = null
        setAgentBusy(false)
      }
    }
  }

  const openTransferDialog = (scope: TransferScope) => {
    setTransferScope(scope)
    setTransferOpen(true)
  }

  const importWorkspaceFile = (file: File) => (
    transferScope === 'workspace-append' ? appendImportedProjects(file) : importIntoCurrentProject(file)
  )

  const stopAgentThinking = () => {
    const controller = agentRequestRef.current
    if (!controller || controller.signal.aborted) return
    controller.abort()
    setToastMessage('已中止本次思考，你可以继续调整方向')
  }

  const selectAgentPlanOptions = (groupPlanIds: string[], selectedPlanIds: string[]) => {
    const groupSet = new Set(groupPlanIds)
    const selectedSet = new Set(selectedPlanIds)
    setAgentPlans((current) => current.map((plan) => {
      if (!groupSet.has(plan.id) || (plan.status !== 'proposed' && plan.status !== 'ready')) return plan
      return { ...plan, status: selectedSet.has(plan.id) ? 'ready' as const : 'proposed' as const }
    }))
    setToastMessage(selectedPlanIds.length > 1 ? `已展开 ${selectedPlanIds.length} 个独立方案，请分别确认` : '方案已展开，请确认后生成')
  }

  const confirmAgentPlan = async (planId: string) => {
    if (agentPlanLocksRef.current.has(planId)) return
    const plan = agentPlans.find((item) => item.id === planId)
    if (!plan || plan.status !== 'ready' || !plan.prompt.trim()) return
    if (new Set(plan.referenceNodeIds).size !== plan.referenceNodeIds.length) {
      setToastMessage('方案中存在重复参考图，请重新发起方案')
      return
    }
    const model = enabledImageModels.find((item) => item.connection.id === plan.imageConnectionId && item.model.id === plan.imageModelId)
    if (!model) {
      setToastMessage('这份方案的生图模型不可用，请重新选择')
      return
    }
    const savedReferences = new Map((plan.references ?? []).map((reference) => [reference.nodeId, reference]))
    const references = plan.referenceNodeIds
      .map((nodeId) => savedReferences.get(nodeId) ?? agentImageCandidates.find((item) => item.nodeId === nodeId))
      .filter((item): item is AgentImageReference => Boolean(item))
    if (references.length !== plan.referenceNodeIds.length) {
      setToastMessage('部分参考图已被删除或失效，请重新发起方案')
      return
    }
    const userPlanReferences = references.map((reference) => ({ id: reference.nodeId, name: reference.name, url: reference.url }))
    const userReferenceUrls = new Set(userPlanReferences.map((reference) => reference.url))
    const appendedStyleReferences = uniqueNamedImageReferences((plan.invokedStyleReferences ?? [])
      .map((reference) => ({ id: reference.id, name: reference.name, url: reference.url })))
      .filter((reference) => !userReferenceUrls.has(reference.url))
    const orderedPlanReferences = [...userPlanReferences, ...appendedStyleReferences]
    const referenceUrls = orderedPlanReferences.map((reference) => reference.url)
    const numberedReferenceGuide = shouldAppendReferenceGuide({
      modelId: model.model.id,
      baseUrl: model.connection.baseUrl,
      isImageGeneration: true,
    })
      ? buildNumberedReferenceGuide(orderedPlanReferences)
      : ''
    const requestPrompt = [plan.prompt.trim(), numberedReferenceGuide].filter(Boolean).join('\n\n')
    if (referenceUrls.length > 16) {
      setToastMessage(`参考图最多 16 张，当前共 ${referenceUrls.length} 张`)
      return
    }
    const nodeId = `agent-image-${crypto.randomUUID()}`
    const taskKey = `image:${nodeId}`
    const controller = beginGenerationTask(taskKey)
    if (!controller) return
    agentPlanLocksRef.current.add(planId)
    const origin = { projectId: activeProjectId, canvasId: activeCanvasId, sessionId: agentConversationId }
    const flowPosition = screenToFlowPosition({ x: Math.max(360, window.innerWidth - (agentOpen ? 720 : 420)), y: 230 })
    // Freeze the confirmed card values once. The node geometry, persisted metadata,
    // request payload and history must all describe this exact generation attempt.
    const confirmedOptions = normalizeImageGenerationOptions(plan)
    const { aspectRatio, resolution, detail, count: requestedCount } = confirmedOptions
    const confirmedNodeSize = getImageGenerationNodeSize(aspectRatio)
    const generatedNode: CanvasNode = {
      id: nodeId,
      type: 'disy',
      position: flowPosition,
      style: confirmedNodeSize,
      data: {
        kind: 'image',
        title: '图像',
        body: plan.prompt,
        status: '生成中',
        imageAspectRatio: aspectRatio,
        imageResolution: resolution,
        imageDetail: detail,
        imageModelConnectionId: model.connection.id,
        imageModelId: model.model.id,
        imageModelName: model.model.name,
        referenceImages: orderedPlanReferences.map((reference) => ({ id: reference.id, name: reference.name, url: reference.url })),
        referenceOrder: orderedPlanReferences.map((reference, index) => index < userPlanReferences.length ? `connection-${reference.id}` : reference.id),
      },
    }
    const canvasReferenceIds = new Set(nodes.map((node) => node.id))
    const createdEdges: Edge[] = references
      .filter((reference) => canvasReferenceIds.has(reference.nodeId) && !edges.some((edge) => edge.source === reference.nodeId && edge.target === nodeId))
      .map((reference) => ({ id: `agent-reference-${reference.nodeId}-${nodeId}`, source: reference.nodeId, target: nodeId, type: 'luminous' }))
    const nextPlans = agentPlans.map((item) => item.id === planId ? { ...item, status: 'running' as const, nodeId } : item)
    setAgentPlans((current) => current.map((item) => item.id === planId ? { ...item, status: 'running' as const, nodeId } : item))
    setNodes((current) => current.some((node) => node.id === nodeId) ? current : [...current, generatedNode])
    setEdges((current) => [...current, ...createdEdges.filter((edge) => !current.some((item) => item.id === edge.id))])
    window.requestAnimationFrame(() => updateNodeInternals(nodeId))
    try {
      await saveAgentSession({
          id: origin.sessionId,
          projectId: origin.projectId,
          canvasId: origin.canvasId,
          title: agentMessages[0]?.content.slice(0, 36) || '新的对话',
          messages: agentMessages,
          plans: nextPlans,
          selectedChatModelId: agentTextModelKey,
          selectedImageModelId: agentImageModelKey,
          createdAt: agentMessages[0]?.createdAt ?? new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        })
      const prepared = await Promise.all(referenceUrls.map((url) => prepareReferenceImageForRequest(url, controller.signal)))
      const images: Awaited<ReturnType<typeof generateRemoteImages>> = []
      let stoppedError: unknown = null
      while (images.length < requestedCount) {
        try {
          if (controller.signal.aborted) throw new DOMException('Generation interrupted', 'AbortError')
          const batch = await generateRemoteImages(
            { baseUrl: model.connection.baseUrl, apiKey: model.connection.apiKey, model: model.model.id },
            {
              prompt: requestPrompt,
              count: 1,
              referenceImages: prepared,
              aspectRatio,
              resolution,
              detail,
              signal: controller.signal,
              captureAdminLog: (log) => captureGenerationAdminLog(log, {
                prompt: plan.prompt,
                modelName: model.model.name,
                connectionName: model.connection.name,
                projectId: origin.projectId,
              }),
            },
          )
          if (!batch.length) throw new Error('图像模型没有返回图片')
          images.push(batch[0])
        } catch (error) {
          stoppedError = error
          break
        }
      }
      if (!images.length) throw stoppedError ?? new Error('图像模型没有返回图片')
      const createdAt = new Date().toISOString()
      const variants: ImageVariant[] = images.map((image, index) => ({ id: `variant-${crypto.randomUUID()}`, url: image.url, fileName: `disy-agent-${Date.now()}-${index + 1}.png`, createdAt, revisedPrompt: image.revisedPrompt || plan.prompt }))
      const wasInterrupted = stoppedError instanceof DOMException && stoppedError.name === 'AbortError'
      const partialFailure = stoppedError && !wasInterrupted ? toOutputHistoryError(stoppedError) : null
      const completedStatus = wasInterrupted
        ? (generationTaskStopReasonRef.current.get(taskKey) === 'paused' ? '已暂停' : '已停止')
        : partialFailure ? '生成失败' : '已完成'
      await patchCanvasNodesAtOrigin(origin, (current) => current.map((node) => node.id === nodeId ? {
        ...node,
        style: { ...node.style, ...confirmedNodeSize },
        data: {
          ...node.data,
          imageUrl: variants[0].url,
          fileName: variants[0].fileName,
          imageVariants: variants,
          activeImageVariantId: variants[0].id,
          imageAspectRatio: aspectRatio,
          imageResolution: resolution,
          imageDetail: detail,
          generationError: partialFailure?.summary,
          status: completedStatus,
        },
      } : node))
      await patchAgentPlansAtOrigin(origin, (current) => current.map((item) => item.id === planId ? {
        ...item,
        status: wasInterrupted ? 'cancelled' : partialFailure ? 'failed' : 'completed',
        nodeId,
        collapsed: true,
        error: partialFailure?.summary,
      } : item))
      const historyRecords = await archiveGenerationRecords(variants.map((variant): GenerationRecord => ({
        id: `history-${variant.id}`,
        createdAt,
        prompt: plan.prompt,
        model: model.model.name,
        imageUrl: variant.url,
        fileName: variant.fileName,
        projectId: origin.projectId,
      })))
      setGenerationHistory((current) => [...current, ...historyRecords])
      appendOutputHistory({ kind: 'image', status: 'success', prompt: plan.prompt, modelId: model.model.id, modelName: model.model.name, connectionName: model.connection.name, requestedCount, outputCount: images.length, preview: `Agent 确认生成 · ${aspectRatio} · ${resolution} · ${IMAGE_DETAIL_LABELS[detail]} · 参考图 ${prepared.length} 张` }, origin.projectId)
      if (partialFailure) {
        appendOutputHistory({
          kind: 'image',
          status: 'failed',
          prompt: plan.prompt,
          modelId: model.model.id,
          modelName: model.model.name,
          connectionName: model.connection.name,
          requestedCount: requestedCount - images.length,
          outputCount: 0,
          preview: `Agent 后续生成失败 · ${aspectRatio} · ${resolution} · 已保留 ${images.length} 张成功图片`,
          error: partialFailure,
        }, origin.projectId)
      }
      setToastMessage(stoppedError
        ? `${wasInterrupted ? completedStatus : '后续生成已停止'}；已保留 ${images.length} 张成功图片`
        : `Agent 已生成 ${images.length} 张图片`)
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        const stoppedStatus = generationTaskStopReasonRef.current.get(taskKey) === 'paused' ? '已暂停' : '已停止'
        await patchCanvasNodesAtOrigin(origin, (current) => current.map((node) => node.id === nodeId ? { ...node, data: { ...node.data, status: stoppedStatus } } : node))
        await patchAgentPlansAtOrigin(origin, (current) => current.map((item) => item.id === planId ? { ...item, status: 'cancelled', nodeId } : item))
        return
      }
      const historyError = toOutputHistoryError(error)
      const failureReason = historyError.summary || '图像生成服务暂时不可用'
      await patchCanvasNodesAtOrigin(origin, (current) => current.map((node) => node.id === nodeId ? {
        ...node,
        style: { ...node.style, ...confirmedNodeSize },
        data: {
          ...node.data,
          imageAspectRatio: aspectRatio,
          imageResolution: resolution,
          imageDetail: detail,
          status: '生成失败',
          generationError: failureReason,
        },
      } : node))
      await patchAgentPlansAtOrigin(origin, (current) => current.map((item) => item.id === planId ? { ...item, status: 'failed', nodeId, error: failureReason } : item))
      appendOutputHistory({
        kind: 'image',
        status: 'failed',
        prompt: plan.prompt,
        modelId: model.model.id,
        modelName: model.model.name,
        connectionName: model.connection.name,
        requestedCount,
        outputCount: 0,
        preview: `Agent 确认生成 · ${aspectRatio} · ${resolution} · ${IMAGE_DETAIL_LABELS[detail]} · 参考图 ${referenceUrls.length} 张`,
        error: historyError,
      }, origin.projectId)
      setToastMessage(failureReason)
    } finally {
      agentPlanLocksRef.current.delete(planId)
      finishGenerationTask(taskKey)
    }
  }

  const shellWidth = shellRef.current?.clientWidth ?? window.innerWidth
  const nodeCenterX = nodeOverlayRect ? nodeOverlayRect.left + nodeOverlayRect.width / 2 : shellWidth / 2
  const nodeEditorWidth = Math.max(260, Math.min(680, shellWidth - 32))
  const nodeEditorCenterX = Math.max(
    16 + nodeEditorWidth / 2,
    Math.min(nodeCenterX, shellWidth - 16 - nodeEditorWidth / 2),
  )
  // Keep every contextual layer physically attached to its node while the
  // canvas pans. They may leave the viewport with the node, but never flip or
  // clamp to a browser edge and become visually detached.
  const nodeEditorTop = nodeOverlayRect ? nodeOverlayRect.top + nodeOverlayRect.height + 14 : 16
  const filteredWorkspaceProjects = workspaceProjects.filter((project) => !projectSearch.trim()
    || project.name.toLowerCase().includes(projectSearch.trim().toLowerCase()))
  const normalizedNodeSearch = nodeSearchQuery.trim().toLocaleLowerCase()
  const nodeSearchResults = nodes.filter((node) => {
    if (!normalizedNodeSearch) return true
    const searchable = [node.data.title, node.data.body, node.data.promptText, node.data.fileName, node.data.status]
      .filter((value): value is string => typeof value === 'string')
      .join(' ')
      .toLocaleLowerCase()
    return searchable.includes(normalizedNodeSearch)
  })
  const sortedHomeProjects = [...filteredWorkspaceProjects].sort((left, right) => {
    const { key, direction } = projectHomeSort
    const result = key === 'name'
      ? left.name.localeCompare(right.name, 'zh-CN')
      : left[key].localeCompare(right[key])
    return direction === 'asc' ? result : -result
  })
  const toggleProjectHomeSort = (key: 'name' | 'createdAt' | 'updatedAt') => {
    setProjectHomeSort((current) => current.key === key
      ? { key, direction: current.direction === 'asc' ? 'desc' : 'asc' }
      : { key, direction: key === 'name' ? 'asc' : 'desc' })
  }
  const latestProjectCoverById = new Map<string, GenerationRecord>()
  generationHistory.forEach((record) => {
    const projectId = record.projectId ?? CURRENT_PROJECT_ID
    const current = latestProjectCoverById.get(projectId)
    if (!current || record.createdAt > current.createdAt) latestProjectCoverById.set(projectId, record)
  })
  const activeTaskCountByProjectId = new Map<string, number>()
  activeGenerationTaskKeys.forEach((taskKey) => {
    const projectId = generationTaskProjectIdsRef.current.get(taskKey)
    if (projectId) activeTaskCountByProjectId.set(projectId, (activeTaskCountByProjectId.get(projectId) ?? 0) + 1)
  })
  const getProjectNodeCount = (projectId: string) => {
    const persisted = persistedProjectContent[projectId]
    if (projectId !== activeProjectId) return persisted?.nodeCount ?? 0
    return Math.max(0, (persisted?.nodeCount ?? 0) - (persisted?.activeCanvasNodeCount ?? 0) + nodes.length)
  }
  const getProjectProcessCount = (projectId: string) => {
    const generationCount = activeTaskCountByProjectId.get(projectId) ?? 0
    return generationCount || (agentBusy && projectId === activeProjectId ? 1 : 0)
  }

  useGSAP(() => {
    if (!projectHomeOpen || !projectHomeContentRef.current) return
    const targets = projectHomeContentRef.current.querySelectorAll('.project-home-card, .project-home-list-row')
    if (!targets.length) return
    gsap.fromTo(targets, {
      autoAlpha: reduceMotion ? 1 : 0,
      y: reduceMotion ? 0 : 14,
      scale: reduceMotion ? 1 : projectHomeView === 'grid' ? .975 : 1,
    }, {
      autoAlpha: 1,
      y: 0,
      scale: 1,
      duration: reduceMotion ? 0 : .38,
      stagger: reduceMotion ? 0 : .045,
      ease: 'power2.out',
      overwrite: 'auto',
      clearProps: 'transform,opacity,visibility',
    })
  }, { scope: projectHomeContentRef, dependencies: [projectHomeOpen, projectSearch, projectHomeSort, projectHomeView, workspaceProjects.length], revertOnUpdate: true })

  const selectedGroupNode = selectedNodeIds.length === 1
    ? nodes.find((node) => node.id === selectedNodeIds[0] && node.data.kind === 'group')
    : undefined

  const renderedEdges = useMemo(() => {
    const nodeById = new Map(nodes.map((node) => [node.id, node]))
    const collapsedParentByNodeId = new Map<string, string>()
    nodes.forEach((node) => {
      if (!node.parentId) return
      const parent = nodeById.get(node.parentId)
      if (parent?.data.kind === 'group' && parent.data.groupCollapsed) {
        collapsedParentByNodeId.set(node.id, parent.id)
      }
    })

    const absolutePositionById = new Map<string, { x: number; y: number }>()
    const getAbsolutePosition = (nodeId: string, visiting = new Set<string>()): { x: number; y: number } => {
      const cached = absolutePositionById.get(nodeId)
      if (cached) return cached
      const node = nodeById.get(nodeId)
      if (!node || visiting.has(nodeId)) return { x: 0, y: 0 }
      visiting.add(nodeId)
      const parentPosition = node.parentId ? getAbsolutePosition(node.parentId, visiting) : { x: 0, y: 0 }
      const position = { x: parentPosition.x + node.position.x, y: parentPosition.y + node.position.y }
      absolutePositionById.set(nodeId, position)
      visiting.delete(nodeId)
      return position
    }
    const getRenderedNodeSize = (nodeId: string) => {
      const node = nodeById.get(nodeId)
      if (!node) return { width: 1, height: 1 }
      const styleWidth = typeof node.style?.width === 'number' ? node.style.width : Number.parseFloat(String(node.style?.width ?? ''))
      const styleHeight = typeof node.style?.height === 'number' ? node.style.height : Number.parseFloat(String(node.style?.height ?? ''))
      return {
        width: node.measured?.width || (Number.isFinite(styleWidth) ? styleWidth : node.data.kind === 'group' && node.data.groupCollapsed ? 210 : 275),
        height: node.measured?.height || (Number.isFinite(styleHeight) ? styleHeight : node.data.kind === 'group' && node.data.groupCollapsed ? 132 : 126),
      }
    }
    const getNodeCenter = (nodeId: string) => {
      const position = getAbsolutePosition(nodeId)
      const size = getRenderedNodeSize(nodeId)
      return { x: position.x + size.width / 2, y: position.y + size.height / 2 }
    }
    const getGroupProxyHandle = (groupId: string, facingNodeId: string, type: 'source' | 'target') => {
      const groupCenter = getNodeCenter(groupId)
      const facingCenter = getNodeCenter(facingNodeId)
      const groupSize = getRenderedNodeSize(groupId)
      const dx = facingCenter.x - groupCenter.x
      const dy = facingCenter.y - groupCenter.y
      const horizontalWeight = Math.abs(dx) / Math.max(groupSize.width, 1)
      const verticalWeight = Math.abs(dy) / Math.max(groupSize.height, 1)
      const side = horizontalWeight >= verticalWeight
        ? (dx >= 0 ? 'right' : 'left')
        : (dy >= 0 ? 'bottom' : 'top')
      return `group-${type}-${side}`
    }

    const visiblePairs = new Set<string>()
    return edges.flatMap((edge) => {
      const sourceGroupId = collapsedParentByNodeId.get(edge.source)
      const targetGroupId = collapsedParentByNodeId.get(edge.target)

      // Connections completely contained by the same folded group add visual
      // noise and have no useful destination while its children are hidden.
      if (sourceGroupId && targetGroupId && sourceGroupId === targetGroupId) return []

      const source = sourceGroupId ?? edge.source
      const target = targetGroupId ?? edge.target
      if (source === target) return []

      const sourceHandle = sourceGroupId
        ? getGroupProxyHandle(sourceGroupId, target, 'source')
        : edge.sourceHandle
      const targetHandle = targetGroupId
        ? getGroupProxyHandle(targetGroupId, source, 'target')
        : edge.targetHandle

      const remapped = Boolean(sourceGroupId || targetGroupId)
      if (remapped) {
        const pairKey = `${source}:${sourceHandle ?? ''}->${target}:${targetHandle ?? ''}`
        if (visiblePairs.has(pairKey)) return []
        visiblePairs.add(pairKey)
      }

      return [{
        ...edge,
        source,
        target,
        sourceHandle,
        targetHandle,
      }]
    })
  }, [edges, nodes])

  const handleSelectionChange = useCallback(({ nodes: selectedNodes, edges: selectedEdges }: { nodes: CanvasNode[]; edges: Edge[] }) => {
    const ids = selectedNodes.map((node) => node.id)
    latestSelectedNodeIdsRef.current = ids
    latestSelectedEdgeIdsRef.current = selectedEdges.map((edge) => edge.id)
    setSelectedNodeIds(ids)
    if (!ids.length) setMarqueeSelectionCommitted(false)
    const groupAndChildSelectedTogether = selectedNodes.some((node) => Boolean(node.parentId && ids.includes(node.parentId)))
    if (ids.length > 1 && !groupAndChildSelectedTogether) {
      setActiveEditorNodeId(null)
      setActiveImageNodeId(null)
      setActiveGenerationNodeId(null)
      setExpandedEditorNodeId(null)
    }
    if (!selectedNodes.some((node) => node.data.kind === 'group')) {
      setGroupColorMenuOpen(false)
      setGroupIconMenuOpen(false)
    }
  }, [])

  const handleSelectionStart = useCallback(() => {
    setMarqueeSelectionCommitted(false)
  }, [])

  const handleSelectionEnd = useCallback(() => {
    window.requestAnimationFrame(() => {
      setMarqueeSelectionCommitted(latestSelectedNodeIdsRef.current.length > 0)
    })
  }, [])

  const multipleNodeToolbarAllowed = marqueeSelectionCommitted && selectedNodeIds.length > 1
  const selectionToolbarAllowed = multipleNodeToolbarAllowed || Boolean(selectedGroupNode)
  const automaticPerformanceMode = nodes.length >= 28

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
        left: (left + right) / 2,
        top: top - 12,
      })
    })

    return () => window.cancelAnimationFrame(frame)
  }, [canvasViewport, canvasZoom, isNodeDragging, nodes, selectedNodeIds, selectionToolbarAllowed])

  const getNodeSize = (node: CanvasNode) => {
    const styleWidth = typeof node.style?.width === 'number' ? node.style.width : Number.parseFloat(String(node.style?.width ?? ''))
    const styleHeight = typeof node.style?.height === 'number' ? node.style.height : Number.parseFloat(String(node.style?.height ?? ''))
    return {
      width: node.measured?.width || (Number.isFinite(styleWidth) ? styleWidth : node.data.kind === 'upload' ? 260 : 275),
      height: node.measured?.height || (Number.isFinite(styleHeight) ? styleHeight : node.data.kind === 'upload' ? 230 : 126),
    }
  }

  const confirmAgentTextPlan = (planId: string) => {
    const plan = agentTextPlans.find((item) => item.id === planId)
    if (!plan || plan.status !== 'ready' || !plan.content.trim()) return
    const nodeId = createAgentTextNode(plan.content, plan.title)
    if (!nodeId) {
      setToastMessage('文本节点创建失败，请重试')
      return
    }
    setAgentTextPlans((current) => current.map((item) => item.id === planId ? { ...item, status: 'completed', nodeId } : item))
    setAgentMessages((current) => current.map((message) => message.id === plan.assistantMessageId
      ? { ...message, textNode: { title: plan.title, content: plan.content, nodeId } }
      : message))
    setToastMessage('文本已确认并加入画布')
  }

  const reconcileNodeGroupMembership = (nodeId: string, droppedPosition: { x: number; y: number }) => {
    const liveNodes = getNodes()
    const draggedNode = liveNodes.find((node) => node.id === nodeId)
    if (!draggedNode || draggedNode.data.kind === 'group') return false
    const previousParent = draggedNode.parentId
      ? liveNodes.find((node) => node.id === draggedNode.parentId && node.data.kind === 'group')
      : undefined
    const absolutePosition = getInternalNode(nodeId)?.internals.positionAbsolute ?? (previousParent
      ? { x: previousParent.position.x + droppedPosition.x, y: previousParent.position.y + droppedPosition.y }
      : droppedPosition)
    const draggedSize = getNodeSize(draggedNode)
    const dropCenter = {
      x: absolutePosition.x + draggedSize.width / 2,
      y: absolutePosition.y + draggedSize.height / 2,
    }
    const targetGroup = liveNodes
      .filter((node) => node.data.kind === 'group' && !node.parentId && !node.data.groupCollapsed)
      .map((group) => ({ group, size: getNodeSize(group) }))
      .filter(({ group, size }) => (
        dropCenter.x >= group.position.x
        && dropCenter.x <= group.position.x + size.width
        && dropCenter.y >= group.position.y
        && dropCenter.y <= group.position.y + size.height
      ))
      .sort((left, right) => left.size.width * left.size.height - right.size.width * right.size.height)[0]?.group
    if (!targetGroup && !previousParent) return false
    if (targetGroup?.id === previousParent?.id) return false

    setNodes((current) => {
      const nextParentId = targetGroup?.id
      const next = current.map((item) => item.id === nodeId ? {
        ...item,
        parentId: nextParentId,
        extent: undefined,
        position: targetGroup
          ? { x: absolutePosition.x - targetGroup.position.x, y: absolutePosition.y - targetGroup.position.y }
          : absolutePosition,
      } : item)
      let ordered = next
      if (nextParentId) {
        const child = next.find((item) => item.id === nodeId)
        const withoutChild = next.filter((item) => item.id !== nodeId)
        const parentIndex = withoutChild.findIndex((item) => item.id === nextParentId)
        if (child && parentIndex >= 0) {
          withoutChild.splice(parentIndex + 1, 0, child)
          ordered = withoutChild
        }
      }
      return ordered.map((item) => item.data.kind === 'group' ? {
        ...item,
        data: { ...item.data, groupNodeCount: ordered.filter((candidate) => candidate.parentId === item.id).length },
      } : item)
    })
    setToastMessage(targetGroup ? '节点已加入分组' : '节点已移出分组')
    window.requestAnimationFrame(() => {
      updateNodeInternals(nodeId)
      if (previousParent) updateNodeInternals(previousParent.id)
      if (targetGroup) updateNodeInternals(targetGroup.id)
    })
    return true
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
        groupFolderColor: 'linear-gradient(135deg, #70e8f1 0%, #70b5ff 36%, #a793ff 68%, #f0a8d3 100%)',
        groupAccentColor: '#78b7ef',
        groupIcon: 'folder',
        groupCollapsed: false,
        groupNodeCount: selected.length,
      },
    }

    setNodes((current) => [
      groupNode,
      ...current.map((node) => selected.some((item) => item.id === node.id)
        ? {
            ...node,
            parentId: groupId,
            extent: undefined,
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

  useEffect(() => {
    const onGroupShortcut = (event: KeyboardEvent) => {
      if (!(event.ctrlKey || event.metaKey) || event.key.toLowerCase() !== 'g') return
      const target = event.target
      if (target instanceof HTMLElement && target.closest('input, textarea, [contenteditable="true"]')) return
      event.preventDefault()
      groupSelectedNodes()
    }
    window.addEventListener('keydown', onGroupShortcut)
    return () => window.removeEventListener('keydown', onGroupShortcut)
  }, [groupSelectedNodes])

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
            hidden: false,
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

  const setSelectedGroupAppearance = (surface: string, accent: string) => {
    if (!selectedGroupNode) return
    setNodes((current) => current.map((node) => node.id === selectedGroupNode.id
      ? { ...node, data: { ...node.data, groupColor: surface, groupAccentColor: accent } }
      : node))
    setGroupColorMenuOpen(false)
  }

  const setSelectedGroupIcon = (icon: GroupIconKey) => {
    if (!selectedGroupNode) return
    setNodes((current) => current.map((node) => node.id === selectedGroupNode.id
      ? { ...node, data: { ...node.data, groupIcon: icon } }
      : node))
    setGroupIconMenuOpen(false)
  }

  const setGroupCollapsed = useCallback((groupId: string, collapsed: boolean) => {
    setNodes((current) => {
      const group = current.find((node) => node.id === groupId && node.data.kind === 'group')
      if (!group || Boolean(group.data.groupCollapsed) === collapsed) return current
      const children = current.filter((node) => node.parentId === groupId)
      const currentSize = getNodeSize(group)
      const previewUrls = Array.from(new Set(children
        .filter((node) => (node.data.kind === 'image' || node.data.kind === 'upload') && node.data.imageUrl)
        .map((node) => node.data.imageUrl as string)))
        .slice(0, 3)
      return current.map((node) => {
        if (node.id === groupId) {
          return {
            ...node,
            width: collapsed ? 210 : node.data.groupExpandedWidth || 560,
            height: collapsed ? 132 : node.data.groupExpandedHeight || 420,
            measured: collapsed ? { width: 210, height: 132 } : undefined,
            style: collapsed
              ? { ...node.style, width: 210, height: 132 }
              : {
                  ...node.style,
                  width: node.data.groupExpandedWidth || 560,
                  height: node.data.groupExpandedHeight || 420,
                },
            data: {
              ...node.data,
              groupCollapsed: collapsed,
              groupIcon: node.data.groupIcon || 'folder',
              groupAccentColor: node.data.groupAccentColor || '#78b7ef',
              groupNodeCount: children.length,
              groupPreviewUrls: collapsed ? previewUrls : node.data.groupPreviewUrls,
              ...(collapsed ? {
                groupExpandedWidth: currentSize.width,
                groupExpandedHeight: currentSize.height,
              } : {}),
            },
          }
        }
        if (node.parentId !== groupId) return node
        return { ...node, hidden: collapsed, selected: false }
      })
    })
    setGroupColorMenuOpen(false)
    setGroupIconMenuOpen(false)
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => updateNodeInternals(groupId))
    })
    setToastMessage(collapsed ? '编组已折叠，双击卡片可展开' : '编组已展开')
  }, [setNodes, updateNodeInternals])

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

  const addSelectedNodesToAgentConversation = () => {
    const selectedReferences = getSelectedNodesWithGroupChildren().flatMap((node): AgentImageReference[] => {
      if ((node.data.kind !== 'image' && node.data.kind !== 'upload') || !node.data.imageUrl) return []
      return [{ nodeId: node.id, name: getNodeDisplayTitle(node.data), url: node.data.imageUrl }]
    })
    const uniqueReferences = Array.from(new Map(selectedReferences.map((reference) => [reference.nodeId, reference])).values())
    if (!uniqueReferences.length) {
      setToastMessage('选区中没有已生成或已上传的图片')
      return
    }

    // The composer is unmounted while the panel is closed, so its inline chips
    // do not survive a close. Treat a toolbar action that reopens it as a fresh
    // draft instead of filtering against stale reference state.
    const currentReferences = agentOpen ? agentReferences : []
    const existingIds = new Set(currentReferences.map((reference) => reference.nodeId))
    const newReferences = uniqueReferences.filter((reference) => !existingIds.has(reference.nodeId))
    const availableSlots = Math.max(0, 16 - currentReferences.length)
    const acceptedReferences = newReferences.slice(0, availableSlots)

    if (!agentOpen) setAgentReferences([])
    setAgentOpen(true)
    setAgentCanvasPicking(false)
    if (!acceptedReferences.length) {
      setToastMessage(newReferences.length ? '对话参考图最多 16 张' : '选中的图片已在当前对话中')
      return
    }

    setAgentPendingReferences(acceptedReferences)
    const skippedCount = uniqueReferences.length - acceptedReferences.length
    setToastMessage(skippedCount > 0
      ? `已加入 ${acceptedReferences.length} 张图片，另有 ${skippedCount} 张重复或超出上限`
      : `已将 ${acceptedReferences.length} 张图片加入对话`)
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

    void commitSavedAssets([...savedAssets, asset], '组合已加入资产库')
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

  const saveImageUrlToAssets = (imageUrl: string, fileName: string, title = fileName) => {
    const node: CanvasNode = {
      id: `preview-asset-${crypto.randomUUID()}`,
      type: 'disy',
      position: { x: 0, y: 0 },
      data: { kind: 'image', title, body: '', imageUrl, fileName, status: '已完成' },
    }
    saveNodeToAssets(node)
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
      return commitSavedAssets(nextAssets, `已上传 ${uploadedAssets.length} 个资产`)
    }).catch((error) => setToastMessage(`资产上传失败：${error instanceof Error ? error.message : '文件读取失败'}`))
  }

  const deleteAsset = (assetId: string) => {
    const nextAssets = savedAssets.filter((asset) => asset.id !== assetId)
    void commitSavedAssets(nextAssets, '资产已删除')
    if (selectedAssetId === assetId) setSelectedAssetId(null)
    setSelectedAssetIds((current) => current.filter((id) => id !== assetId))
    if (libraryPreview?.kind === 'asset' && libraryPreview.id === assetId) setLibraryPreview(null)
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
    void commitSavedAssets(nextAssets, `已删除 ${assetIds.length} 个资产`)
    setSelectedAssetIds([])
    if (selectedAssetId && idSet.has(selectedAssetId)) setSelectedAssetId(null)
    if (libraryPreview?.kind === 'asset' && idSet.has(libraryPreview.id)) setLibraryPreview(null)
  }

  const moveAssetToFolder = (assetId: string, folderId: string | null) => {
    const nextAssets = savedAssets.map((asset) => asset.id === assetId ? { ...asset, folderId } : asset)
    void commitSavedAssets(nextAssets, folderId ? '资产已移动到文件夹' : '资产已移至未归档')
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
    const deleted = generationHistory.find((record) => record.id === recordId)
    if (deleted?.mediaId) {
      const objectUrl = historyMediaObjectUrlsRef.current.get(deleted.mediaId)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      historyMediaObjectUrlsRef.current.delete(deleted.mediaId)
      void deleteHistoryMedia(deleted.mediaId)
    }
    const nextHistory = generationHistory.filter((record) => record.id !== recordId)
    localStorage.setItem(GENERATION_HISTORY_KEY, JSON.stringify(nextHistory))
    setGenerationHistory(nextHistory)
    setSelectedHistoryIds((current) => current.filter((id) => id !== recordId))
    if (libraryPreview?.kind === 'history' && libraryPreview.id === recordId) setLibraryPreview(null)
    setToastMessage('历史记录已删除')
  }

  const deleteHistoryBatch = (recordIds: string[]) => {
    const idSet = new Set(recordIds)
    generationHistory.forEach((record) => {
      if (!idSet.has(record.id) || !record.mediaId) return
      const objectUrl = historyMediaObjectUrlsRef.current.get(record.mediaId)
      if (objectUrl) URL.revokeObjectURL(objectUrl)
      historyMediaObjectUrlsRef.current.delete(record.mediaId)
      void deleteHistoryMedia(record.mediaId)
    })
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
  const libraryPageSize = 60
  const assetLibraryTotalPages = Math.max(1, Math.ceil(filteredAssets.length / libraryPageSize))
  const pagedAssets = filteredAssets.slice((assetLibraryPage - 1) * libraryPageSize, assetLibraryPage * libraryPageSize)
  const groupedAssets = Array.from(pagedAssets.reduce((groups, asset) => {
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

  const currentGenerationHistory = generationHistory.filter((record) => record.projectId ? record.projectId === activeProjectId : activeProjectId === CURRENT_PROJECT_ID)
  const currentOutputHistory = outputHistory.filter((record) => record.projectId ? record.projectId === activeProjectId : activeProjectId === CURRENT_PROJECT_ID)
  const filteredHistory = currentGenerationHistory.filter((record) => {
    const query = generationHistorySearch.trim().toLowerCase()
    return !query || `${record.prompt} ${record.model} ${record.fileName}`.toLowerCase().includes(query)
  })
  const generationHistoryTotalPages = Math.max(1, Math.ceil(filteredHistory.length / libraryPageSize))
  const pagedHistory = filteredHistory.slice((generationHistoryPage - 1) * libraryPageSize, generationHistoryPage * libraryPageSize)
  const groupedHistory = Array.from(pagedHistory.reduce((groups, record) => {
    const date = new Date(record.createdAt)
    const key = Number.isNaN(date.getTime())
      ? '未知日期'
      : date.toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' }).replaceAll('/', '-')
    const current = groups.get(key) ?? []
    current.push(record)
    groups.set(key, current)
    return groups
  }, new Map<string, GenerationRecord[]>()).entries()).reverse()
  useEffect(() => { setAssetLibraryPage(1) }, [activeAssetFolderId, assetSearch, assetScope])
  useEffect(() => { setGenerationHistoryPage(1) }, [activeProjectId, generationHistorySearch])
  useEffect(() => { if (assetLibraryPage > assetLibraryTotalPages) setAssetLibraryPage(assetLibraryTotalPages) }, [assetLibraryPage, assetLibraryTotalPages])
  useEffect(() => { if (generationHistoryPage > generationHistoryTotalPages) setGenerationHistoryPage(generationHistoryTotalPages) }, [generationHistoryPage, generationHistoryTotalPages])
  const outputFailureCount = currentOutputHistory.filter((record) => record.status === 'failed').length
  const filteredOperatorLogs = operatorLogs.filter((log) => {
    const query = outputHistorySearch.trim().toLowerCase()
    if (!query) return true
    return [log.taskId, log.model, log.modelName, log.prompt, log.provider, log.resultJson]
      .some((value) => value?.toLowerCase().includes(query))
  })
  const filteredOutputHistory = currentOutputHistory.filter((record) => {
    if (outputHistoryFilter === 'ops') return false
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
    <div ref={shellRef} className={`disy-shell ${agentOpen ? 'has-agent-open' : ''} ${automaticPerformanceMode ? 'is-performance-mode' : ''} ${isNodeDragging ? 'is-node-dragging' : ''}`}>
      <AnimatePresence>
        {projectHomeOpen && (
          <motion.section className="project-home" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
            <header className="project-home-header">
              <div className="project-home-brand"><img src="/logo-light.png" alt="DisyLab" /></div>
              <nav><button className="is-active">个人</button></nav>
              <div className="project-home-actions">
                <label className="project-home-search"><Search size={16} /><input value={projectSearch} onChange={(event) => setProjectSearch(event.target.value)} placeholder="搜索" /></label>
                <button className={`project-home-select-all ${projectHomeSelectionMode ? 'is-active' : ''}`} disabled={!sortedHomeProjects.length} onClick={() => {
                  const allIds = sortedHomeProjects.map((project) => project.id)
                  const allSelected = allIds.every((id) => selectedProjectIds.includes(id))
                  setProjectHomeSelectionMode(!allSelected)
                  setSelectedProjectIds(allSelected ? [] : allIds)
                }}><Check size={15} />{projectHomeSelectionMode ? '取消全选' : '全选'}</button>
                {projectHomeSelectionMode && selectedProjectIds.length > 0 && <button className="project-home-batch-delete" onClick={() => void removeProjects(selectedProjectIds)}><Trash2 size={15} />批量删除 ({selectedProjectIds.length})</button>}
                <button className={`project-home-icon ${projectHomeView === 'list' ? 'is-active' : ''}`} onClick={() => setProjectHomeView((view) => view === 'grid' ? 'list' : 'grid')} aria-label={projectHomeView === 'grid' ? '切换到列表视图' : '切换到宫格视图'} title={projectHomeView === 'grid' ? '列表视图' : '宫格视图'}>{projectHomeView === 'grid' ? <List size={18} /> : <Grid3X3 size={17} />}</button>
                <button className="project-home-icon" onClick={() => openTransferDialog('workspace-append')} aria-label="导入/导出项目" title="导入/导出"><ArrowUpDown size={18} /></button>
                <button
                  className={`project-home-api ${apiConfigured ? 'is-configured' : ''}`}
                  onClick={openApiSettings}
                  aria-label={apiConfigured ? '管理 API 配置' : '配置 API'}
                  title={apiConfigured ? '管理 API 配置' : '配置 API'}
                >
                  <KeyRound size={15} />
                  <span>{apiConfigured ? 'API 已配置' : '配置 API'}</span>
                </button>
              </div>
            </header>
            <div ref={projectHomeContentRef} className="project-home-content">
              {projectHomeView === 'grid' ? <div className="project-home-grid" onContextMenu={(event) => {
                event.preventDefault()
                setProjectContextMenu({
                  x: Math.max(12, Math.min(event.clientX, window.innerWidth - 230)),
                  y: Math.max(12, Math.min(event.clientY, window.innerHeight - 140)),
                })
              }}>
                <button className="project-home-card project-home-new" onClick={() => void createNewProject()} onContextMenu={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  setProjectContextMenu({
                    x: Math.max(12, Math.min(event.clientX, window.innerWidth - 230)),
                    y: Math.max(12, Math.min(event.clientY, window.innerHeight - 140)),
                  })
                }}><span><Plus size={25} /></span><strong>新建项目</strong></button>
                {sortedHomeProjects.map((project, index) => {
                  const cover = latestProjectCoverById.get(project.id)
                  const isSelected = selectedProjectIds.includes(project.id)
                  const isRenaming = projectRename?.id === project.id && projectRename.source === 'home'
                  const nodeCount = getProjectNodeCount(project.id)
                  const processCount = getProjectProcessCount(project.id)
                  return <article className={`project-home-card ${isSelected ? 'is-selected' : ''}`} key={project.id} onClick={() => {
                    if (projectHomeSelectionMode) { setSelectedProjectIds((current) => current.includes(project.id) ? current.filter((id) => id !== project.id) : [...current, project.id]); return }
                    if (isRenaming) return
                    setCreateProjectOpen(false); void openWorkspaceCanvas(project.activeCanvasId, project.id).then(() => setProjectHomeOpen(false))
                  }} onContextMenu={(event) => {
                    event.preventDefault()
                    event.stopPropagation()
                    setSelectedProjectIds([project.id])
                    setProjectHomeSelectionMode(false)
                    setProjectContextMenu({
                      x: Math.max(12, Math.min(event.clientX, window.innerWidth - 230)),
                      y: Math.max(12, Math.min(event.clientY, window.innerHeight - 176)),
                      projectId: project.id,
                    })
                  }}>
                    {projectHomeSelectionMode && <button className="project-home-select" aria-label={`${isSelected ? '取消选择' : '选择'}项目 ${project.name}`} onClick={(event) => { event.stopPropagation(); setSelectedProjectIds((current) => current.includes(project.id) ? current.filter((id) => id !== project.id) : [...current, project.id]) }}>{isSelected && <Check size={14} />}</button>}
                    <button className="project-home-rename" aria-label={`重命名项目 ${project.name}`} title="重命名项目" onClick={(event) => { event.stopPropagation(); setProjectRename({ id: project.id, draft: project.name, source: 'home' }) }}><Pencil size={14} /></button>
                    <button className="project-home-delete" aria-label={`删除项目 ${project.name}`} title="删除项目" onClick={(event) => { event.stopPropagation(); void removeProject(project.id) }}><Trash2 size={15} /></button>
                    <div className={`project-home-cover cover-${index % 4}`}>
                      {cover ? <img src={cover.imageUrl} alt="" /> : <div className="cover-orbit"><i /><i /><i /></div>}
                      {(nodeCount > 0 || processCount > 0) && <div className="project-home-statuses">
                        {processCount > 0 && <span className="project-status-badge is-running"><i />进行中{processCount > 1 ? ` ${processCount}` : ''}</span>}
                        {nodeCount > 0 && <span className="project-status-badge is-content"><Box size={11} />{nodeCount} 个节点</span>}
                      </div>}
                    </div>
                    <div className="project-home-meta">{isRenaming ? <input autoFocus value={projectRename.draft} maxLength={48} onClick={(event) => event.stopPropagation()} onChange={(event) => setProjectRename({ ...projectRename, draft: event.target.value })} onBlur={() => void commitProjectRename(project.id, projectRename.draft)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setProjectRename(null) }} /> : <strong>{project.name}</strong>}<small>{project.canvasIds.length} 张画布{nodeCount > 0 ? ` · ${nodeCount} 个节点` : ''} · 编辑于 {formatRelativeTime(project.updatedAt)}</small></div>
                  </article>
                })}
              </div> : <div className="project-home-list" role="table" aria-label="项目列表">
                <div className="project-home-list-head" role="row"><span>预览</span><button onClick={() => toggleProjectHomeSort('name')}>名称 {projectHomeSort.key === 'name' ? (projectHomeSort.direction === 'asc' ? '↑' : '↓') : ''}</button><span>类型</span><span>内容</span><button onClick={() => toggleProjectHomeSort('createdAt')}>创建时间 {projectHomeSort.key === 'createdAt' ? (projectHomeSort.direction === 'asc' ? '↑' : '↓') : ''}</button><button onClick={() => toggleProjectHomeSort('updatedAt')}>最近更新 {projectHomeSort.key === 'updatedAt' ? (projectHomeSort.direction === 'asc' ? '↑' : '↓') : ''}</button></div>
                {sortedHomeProjects.map((project, index) => {
                  const cover = latestProjectCoverById.get(project.id)
                  const isSelected = selectedProjectIds.includes(project.id)
                  const isRenaming = projectRename?.id === project.id && projectRename.source === 'home'
                  const nodeCount = getProjectNodeCount(project.id)
                  const processCount = getProjectProcessCount(project.id)
                  return <div className={`project-home-list-row ${isSelected ? 'is-selected' : ''}`} role="row" tabIndex={0} key={project.id} onClick={() => {
                    if (projectHomeSelectionMode) { setSelectedProjectIds((current) => current.includes(project.id) ? current.filter((id) => id !== project.id) : [...current, project.id]); return }
                    if (isRenaming) return
                    setCreateProjectOpen(false); void openWorkspaceCanvas(project.activeCanvasId, project.id).then(() => setProjectHomeOpen(false))
                  }} onContextMenu={(event) => {
                    event.preventDefault()
                    setSelectedProjectIds([project.id])
                    setProjectHomeSelectionMode(false)
                    setProjectContextMenu({
                      x: Math.max(12, Math.min(event.clientX, window.innerWidth - 230)),
                      y: Math.max(12, Math.min(event.clientY, window.innerHeight - 176)),
                      projectId: project.id,
                    })
                  }}>
                    {projectHomeSelectionMode && <button className="project-home-list-select" aria-label={`${isSelected ? '取消选择' : '选择'}项目 ${project.name}`} onClick={(event) => { event.stopPropagation(); setSelectedProjectIds((current) => current.includes(project.id) ? current.filter((id) => id !== project.id) : [...current, project.id]) }}>{isSelected && <Check size={13} />}</button>}
                    <span className={`project-home-list-preview cover-${index % 4}`}>{cover ? <img src={cover.imageUrl} alt="" /> : <span className="project-list-orbit" />}</span>{isRenaming ? <input className="project-home-list-rename-input" autoFocus value={projectRename.draft} maxLength={48} onClick={(event) => event.stopPropagation()} onChange={(event) => setProjectRename({ ...projectRename, draft: event.target.value })} onBlur={() => void commitProjectRename(project.id, projectRename.draft)} onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur(); if (event.key === 'Escape') setProjectRename(null) }} /> : <strong>{project.name}</strong>}<span>项目</span><span className="project-home-list-content">{processCount > 0 && <span className="project-status-badge is-running"><i />进行中{processCount > 1 ? ` ${processCount}` : ''}</span>}{nodeCount > 0 ? <span className="project-status-badge is-content"><Box size={11} />{nodeCount} 个节点</span> : <em>空项目</em>}</span><time>{formatProjectDate(project.createdAt)}</time><span>编辑于 {formatRelativeTime(project.updatedAt)}</span>
                    <button className="project-home-list-rename" aria-label={`重命名项目 ${project.name}`} title="重命名项目" onClick={(event) => { event.stopPropagation(); setProjectRename({ id: project.id, draft: project.name, source: 'home' }) }}><Pencil size={14} /></button>
                    <button className="project-home-list-delete" aria-label={`删除项目 ${project.name}`} title="删除项目" onClick={(event) => { event.stopPropagation(); void removeProject(project.id) }}><Trash2 size={15} /></button>
                  </div>
                })}
                {!sortedHomeProjects.length && <div className="project-home-list-empty">没有匹配的项目</div>}
              </div>}
            </div>
          </motion.section>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {transferProgress && <motion.div className="transfer-progress-hud" role="status" aria-live="polite" initial={{ opacity: 0, y: 18, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .98 }}>
          <div className="transfer-progress-icon"><LoaderCircle size={18} className="is-spinning" /></div>
          <div><strong>项目数据处理中</strong><span>{transferProgress}</span><div className="transfer-progress-track"><i /></div></div>
          <em>请勿关闭页面</em>
        </motion.div>}
      </AnimatePresence>
      <main className="canvas-area">
        <ActiveGenerationNodesContext.Provider value={activeGeneratingNodeIds}>
        <ImagePreviewOpenContext.Provider value={openNodeImagePreview}>
          <ImageToolOpenContext.Provider value={openImageTool}>
          <ImageGalleryOpenContext.Provider value={setImageGalleryNodeId}>
            <NodeTextUpdateContext.Provider value={updateNodeBody}>
              <NodeTitleUpdateContext.Provider value={updateNodeTitle}>
              <GroupCollapseContext.Provider value={setGroupCollapsed}>
              <NodeExtensionMenuContext.Provider value={openNodeExtensionMenu}>
          <ReactFlow
          nodes={nodes}
          edges={renderedEdges}
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
            if (agentCanvasPicking) {
              const imageUrl = (node.data.kind === 'image' || node.data.kind === 'upload') ? node.data.imageUrl : undefined
              if (!imageUrl) {
                setToastMessage('请选择已经生成或上传完成的图片')
                return
              }
              const reference = { nodeId: node.id, name: getNodeDisplayTitle(node.data), url: imageUrl }
              setAgentPendingReferences([reference])
              setAgentCanvasPicking(false)
              return
            }
            if (canvasReferencePickerNodeId) {
              if (node.id === canvasReferencePickerNodeId) {
                setToastMessage('请选择画布中的其他图片')
                return
              }
              const hasTextReference = node.data.kind === 'text' && Boolean(node.data.body.trim())
              const hasImageReference = (node.data.kind === 'upload' || node.data.kind === 'image') && Boolean(node.data.imageUrl)
              if (!hasTextReference && !hasImageReference) {
                setToastMessage('请选择有内容的文本或已经上传/生成的图片')
                return
              }
              if (connectionCreatesCycle(node.id, canvasReferencePickerNodeId)) {
                setToastMessage('该连接会形成循环引用')
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
              setToastMessage('已加入参考素材，可继续选择')
              return
            }
            setMarqueeSelectionCommitted(false)
            closeAllMenus()
            setModelMenuOpen(false)
            setImageModelMenuOpen(false)
            setImageParameterMenuOpen(false)
            setImageMentionOpen(false)
            setTextMentionOpen(false)
            setQuantityMenuOpen(false)
            setExpandedEditorNodeId(null)
            setIsNodeDragging(false)
            setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })))
            setSelectedNodeIds([node.id])
            setActiveEditorNodeId(node.data.kind === 'text' ? node.id : null)
            setActiveImageNodeId(node.data.kind === 'upload' && node.data.imageUrl ? node.id : null)
            setActiveGenerationNodeId(node.data.kind === 'image' ? node.id : null)
            window.requestAnimationFrame(() => measureNodeOverlay(node.id))
          }}
          onNodeDragStart={(event, node) => {
            setIsNodeDragging(true)
            if (node.parentId && node.extent === 'parent') {
              setNodes((current) => current.map((item) => item.id === node.id ? { ...item, extent: undefined } : item))
            }
            if (!event.altKey || node.data.kind === 'group' || altDragDuplicateRef.current) return
            const duplicateId = `${node.data.kind}-alt-duplicate-${crypto.randomUUID()}`
            altDragDuplicateRef.current = {
              originalId: node.id,
              duplicateId,
              originalPosition: { ...node.position },
            }
            const stationaryDuplicate = duplicateCanvasNode(node, duplicateId, { ...node.position }, false)
            setNodes((current) => [...current, stationaryDuplicate])
          }}
          onNodeDragStop={(_, node) => {
            setIsNodeDragging(false)
            const altDuplicate = altDragDuplicateRef.current
            if (altDuplicate?.originalId === node.id) {
              const droppedPosition = { ...node.position }
              setNodes((current) => current.map((item) => {
                if (item.id === altDuplicate.originalId) {
                  return { ...item, position: altDuplicate.originalPosition, selected: false, dragging: false }
                }
                if (item.id === altDuplicate.duplicateId) {
                  return { ...item, position: droppedPosition, selected: true, dragging: false }
                }
                return { ...item, selected: false }
              }))
              setActiveEditorNodeId(node.data.kind === 'text' ? altDuplicate.duplicateId : null)
              setActiveImageNodeId(node.data.kind === 'upload' && node.data.imageUrl ? altDuplicate.duplicateId : null)
              setActiveGenerationNodeId(node.data.kind === 'image' ? altDuplicate.duplicateId : null)
              setExpandedEditorNodeId(null)
              altDragDuplicateRef.current = null
              window.requestAnimationFrame(() => measureNodeOverlay(altDuplicate.duplicateId))
              setToastMessage('已通过 Alt 拖拽创建节点副本')
              return
            }
            altDragDuplicateRef.current = null
            if (reconcileNodeGroupMembership(node.id, node.position)) return
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
            if (event.dataTransfer.types.includes('application/x-disy-asset') || event.dataTransfer.types.includes('application/x-disy-prompt-case') || Array.from(event.dataTransfer.items).some((item) => item.kind === 'file')) {
              event.preventDefault()
              event.dataTransfer.dropEffect = 'copy'
            }
          }}
          onDrop={(event) => {
            const promptCasePayload = event.dataTransfer.getData('application/x-disy-prompt-case')
            if (promptCasePayload) {
              event.preventDefault()
              closeAllMenus()
              try {
                const item = JSON.parse(promptCasePayload) as PromptLibraryCase
                const flowPosition = screenToFlowPosition({ x: event.clientX, y: event.clientY })
                addPromptCaseImage(item, flowPosition)
              } catch {
                setToastMessage('案例参考图读取失败，请从详情中点击加入画布')
              }
              return
            }
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
            setCanvasViewport((current) =>
              Math.abs(current.x - viewport.x) > 0.25 || Math.abs(current.y - viewport.y) > 0.25
                ? { x: viewport.x, y: viewport.y }
                : current,
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
          onlyRenderVisibleElements={automaticPerformanceMode}
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
              </NodeExtensionMenuContext.Provider>
              </GroupCollapseContext.Provider>
              </NodeTitleUpdateContext.Provider>
            </NodeTextUpdateContext.Provider>
          </ImageGalleryOpenContext.Provider>
          </ImageToolOpenContext.Provider>
        </ImagePreviewOpenContext.Provider>
        </ActiveGenerationNodesContext.Provider>

        <AnimatePresence>
          {imageTool && (() => {
            const source = nodes.find((node) => node.id === imageTool.nodeId)
            const sourceUrl = source?.data.imageUrl
            if (!source || !sourceUrl) return null
            const cutoutBusy = Boolean(cutoutProgress && !cutoutProgress.failed)
            const setGuide = (axis: 'vertical' | 'horizontal', index: number, value: number) => setGridGuides((current) => ({ ...current, [axis]: current[axis].map((guide, guideIndex) => guideIndex === index ? value : guide).sort((a, b) => a - b) }))
            const applyGridPreset = (columns: number, rows = columns) => {
              const evenlySpaced = (count: number) => Array.from({ length: Math.max(0, count - 1) }, (_, index) => (index + 1) * 100 / count)
              setCustomGrid({ columns, rows })
              setGridGuides({ vertical: evenlySpaced(columns), horizontal: evenlySpaced(rows) })
            }
            const applyExpandRatio = (ratio: typeof expandRatio) => {
              setExpandRatio(ratio)
              if (ratio === 'original') {
                setExpandSize(imageToolSourceSize)
                return
              }
              if (ratio === 'custom') return
              const [widthRatio, heightRatio] = ratio.split(':').map(Number)
              const longestEdge = Math.max(expandSize.width, expandSize.height, 1024)
              if (widthRatio >= heightRatio) setExpandSize({ width: longestEdge, height: Math.round(longestEdge * heightRatio / widthRatio) })
              else setExpandSize({ width: Math.round(longestEdge * widthRatio / heightRatio), height: longestEdge })
            }
            const startExpandDrag = (side: keyof typeof expandInsets, event: React.PointerEvent<HTMLButtonElement>) => { const plane = event.currentTarget.closest('.image-tool-image-plane')!; const move = (moveEvent: PointerEvent) => { const rect = plane.getBoundingClientRect(); const value = side === 'left' ? (moveEvent.clientX - rect.left) / rect.width * 100 : side === 'right' ? (rect.right - moveEvent.clientX) / rect.width * 100 : side === 'top' ? (moveEvent.clientY - rect.top) / rect.height * 100 : (rect.bottom - moveEvent.clientY) / rect.height * 100; setExpandInsets((current) => ({ ...current, [side]: Math.round(Math.min(60, Math.max(-80, value))) })) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true }) }
            const createImageEditTask = (title: string, prompt: string) => { const id = `image-edit-${crypto.randomUUID()}`; const nodeSize = getImageGenerationNodeSize('auto'); setNodes((current) => [...current.map((node) => ({ ...node, selected: false })), { id, type: 'disy', selected: true, position: { x: source.position.x + 330, y: source.position.y + 24 }, style: nodeSize, data: { kind: 'image', title, body: prompt, promptText: prompt, referenceImageUrl: sourceUrl, referenceImageName: getNodeDisplayTitle(source.data), imageAspectRatio: 'auto', status: '待生成', generationSourceNodeId: source.id } }]); setEdges((current) => [...current, { id: `edge-${crypto.randomUUID()}`, source: source.id, target: id, type: 'luminous' }]); setActiveImageNodeId(null); setActiveGenerationNodeId(id); setAutoGenerateNodeId(id); setImageTool(null); setToastMessage(`正在执行${title}…`) }
            const addLocalEditMark = (event: React.PointerEvent<HTMLDivElement>) => {
              if (imageTool.mode !== 'local-edit' || localEditMarks.length >= 5 || event.button !== 0) return
              const image = event.currentTarget.querySelector(':scope > img')
              if (!(image instanceof HTMLImageElement)) return
              const rect = image.getBoundingClientRect()
              if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) return
              const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100))
              const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100))
              setLocalEditMarks((current) => current.length >= 5 ? current : [...current, { id: crypto.randomUUID(), x, y, prompt: '' }])
            }
            return <motion.div className="image-tool-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => { if (!cutoutBusy) setImageTool(null) }}>
              <motion.section className={`image-tool-dialog mode-${imageTool.mode}`} initial={{ opacity: 0, y: 18, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .98 }} onMouseDown={(event) => event.stopPropagation()}>
                <header><div><span>{imageTool.mode === 'grid' ? <Grid3X3 size={17} /> : imageTool.mode === 'expand' ? <Expand size={17} /> : imageTool.mode === 'studio' ? <Lightbulb size={17} /> : imageTool.mode === 'local-edit' ? <MessageCircle size={17} /> : <Scissors size={17} />}</span><div><strong>{imageTool.mode === 'grid' ? '自由宫格切分' : imageTool.mode === 'expand' ? '自由区域扩图' : imageTool.mode === 'studio' ? '打光' : imageTool.mode === 'local-edit' ? '评论修改' : '免费本地抠图'}</strong><small>{imageTool.mode === 'grid' ? '拖动辅助线定义每一张输出图片' : imageTool.mode === 'expand' ? '拖动画布边界，编辑画面延展提示词' : imageTool.mode === 'studio' ? '在左侧光场拖动光源，调整亮度、色温与轮廓光' : imageTool.mode === 'local-edit' ? '点击图片添加修改意见，最多 5 条' : '主体识别将在本机执行，不上传原图'}</small></div></div><button type="button" disabled={cutoutBusy} onClick={() => setImageTool(null)} aria-label="关闭"><X size={17} /></button></header>
                <div className="image-tool-content">
                  <div className={`image-tool-stage mode-${imageTool.mode}`}>
                    <div className="image-tool-image-plane" onPointerDown={addLocalEditMark} style={{ aspectRatio: imageTool.mode === 'expand' ? `${expandSize.width} / ${expandSize.height}` : `${imageToolSourceSize.width} / ${imageToolSourceSize.height}`, ...(imageTool.mode === 'local-edit' ? { width: `min(100%, ${Math.max(1, Math.round(500 * imageToolSourceSize.width / imageToolSourceSize.height))}px)` } : {}) }}>
                      <img src={sourceUrl} alt="编辑预览" />
                      {imageTool.mode === 'grid' && <>{gridGuides.vertical.map((guide, index) => <i key={`v-${index}`} className="image-guide is-vertical" style={{ left: `${guide}%` }} onPointerDown={(event) => { const stage = event.currentTarget.parentElement!; const move = (moveEvent: PointerEvent) => { const next = Math.min(95, Math.max(5, (moveEvent.clientX - stage.getBoundingClientRect().left) / stage.getBoundingClientRect().width * 100)); setGuide('vertical', index, next) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true }) }} />)}{gridGuides.horizontal.map((guide, index) => <i key={`h-${index}`} className="image-guide is-horizontal" style={{ top: `${guide}%` }} onPointerDown={(event) => { const stage = event.currentTarget.parentElement!; const move = (moveEvent: PointerEvent) => { const next = Math.min(95, Math.max(5, (moveEvent.clientY - stage.getBoundingClientRect().top) / stage.getBoundingClientRect().height * 100)); setGuide('horizontal', index, next) }; window.addEventListener('pointermove', move); window.addEventListener('pointerup', () => window.removeEventListener('pointermove', move), { once: true }) }} />)}</>}
                      {imageTool.mode === 'expand' && <div className="expand-boundary" style={{ inset: `${expandInsets.top}% ${expandInsets.right}% ${expandInsets.bottom}% ${expandInsets.left}%` }}><button className="expand-handle top" onPointerDown={(event) => startExpandDrag('top', event)} /><button className="expand-handle right" onPointerDown={(event) => startExpandDrag('right', event)} /><button className="expand-handle bottom" onPointerDown={(event) => startExpandDrag('bottom', event)} /><button className="expand-handle left" onPointerDown={(event) => startExpandDrag('left', event)} /></div>}
                      {imageTool.mode === 'studio' && <div className="lighting-three-shell"><div className="lighting-three-tabs"><button className={lightingView === 'perspective' ? 'is-active' : ''} onClick={() => setLightingView('perspective')}>透视</button><button className={lightingView === 'front' ? 'is-active' : ''} onClick={() => setLightingView('front')}>正面</button></div><Suspense fallback={<div className="lighting-three-loading"><LoaderCircle className="is-spinning" size={20} />正在载入三维光场…</div>}><LightingSpherePreview imageUrl={sourceUrl} yaw={studioLighting.yaw} pitch={studioLighting.pitch} intensity={studioLighting.intensity} temperatureK={studioLighting.temperatureK} view={lightingView} onChange={(yaw, pitch) => setStudioLighting((current) => ({ ...current, yaw, pitch }))} /></Suspense><span className="lighting-three-label">主光源</span><button type="button" className="lighting-three-reset" onClick={() => setStudioLighting({ yaw: 0, pitch: 0, intensity: 50, temperatureK: 5600, fill: true, rim: false, rimStrength: 20 })}>↻ 重置</button><em>水平 {studioLighting.yaw}° · 垂直 {studioLighting.pitch}°</em></div>}
                      {imageTool.mode === 'local-edit' && <div className="local-edit-overlay">{localEditMarks.map((mark, index) => <span key={mark.id} className="local-edit-pin" style={{ left: `${mark.x}%`, top: `${mark.y}%` }} onPointerDown={(event) => event.stopPropagation()}>{index + 1}</span>)}</div>}
                    </div>
                  </div>
                  {imageTool.mode === 'grid' ? <div className="image-tool-controls">
                    <p>选择预设后仍可拖动青色辅助线微调。</p>
                    <div className="grid-preset-list">{[2, 3, 4, 5].map((size) => <button key={size} type="button" className={customGrid.columns === size && customGrid.rows === size ? 'is-selected' : ''} onClick={() => applyGridPreset(size)}><Grid3X3 size={14} /><span>{size * size} 宫格</span><small>{size} × {size}</small></button>)}</div>
                    <div className="custom-grid-fields"><strong>自定义裁切</strong><label>列数<input type="number" min="1" max="10" value={customGrid.columns} onChange={(event) => applyGridPreset(Math.min(10, Math.max(1, Number(event.target.value))), customGrid.rows)} /></label><span>×</span><label>行数<input type="number" min="1" max="10" value={customGrid.rows} onChange={(event) => applyGridPreset(customGrid.columns, Math.min(10, Math.max(1, Number(event.target.value))))} /></label></div>
                    <div className="guide-actions"><button type="button" onClick={() => setGridGuides((current) => ({ ...current, vertical: [...current.vertical, 50].sort((a, b) => a - b) }))}>+ 竖线</button><button type="button" onClick={() => setGridGuides((current) => ({ ...current, horizontal: [...current.horizontal, 50].sort((a, b) => a - b) }))}>+ 横线</button></div>
                  </div> : imageTool.mode === 'expand' ? <div className="image-tool-controls">
                    <strong className="control-title">目标比例</strong>
                    <div className="expand-ratio-list">{(['original', '1:1', '4:3', '16:9', '3:4', '9:16'] as const).map((ratio) => <button key={ratio} type="button" className={expandRatio === ratio ? 'is-selected' : ''} onClick={() => applyExpandRatio(ratio)}>{ratio === 'original' ? '原比例' : ratio}</button>)}</div>
                    <div className="expand-size-fields"><strong>具体尺寸</strong><label><input type="number" min="64" max="8192" value={expandSize.width} onChange={(event) => { setExpandRatio('custom'); setExpandSize((current) => ({ ...current, width: Math.min(8192, Math.max(64, Number(event.target.value))) })) }} /><small>宽 px</small></label><span>×</span><label><input type="number" min="64" max="8192" value={expandSize.height} onChange={(event) => { setExpandRatio('custom'); setExpandSize((current) => ({ ...current, height: Math.min(8192, Math.max(64, Number(event.target.value))) })) }} /><small>高 px</small></label></div>
                    <label className="expand-prompt-label">延展提示词<textarea value={expandPrompt} onChange={(event) => setExpandPrompt(event.target.value)} /></label>
                    <div className="inset-fields"><small>负值表示向原图外侧扩展，可直接拖动画框四边。</small>{(['top', 'right', 'bottom', 'left'] as const).map((side) => <label key={side}>{({ top: '上', right: '右', bottom: '下', left: '左' } as const)[side]} <input type="range" min="-80" max="60" value={expandInsets[side]} onChange={(event) => setExpandInsets((current) => ({ ...current, [side]: Number(event.target.value) }))} /><b>{expandInsets[side]}%</b></label>)}</div>
                  </div> : imageTool.mode === 'studio' ? <div className="image-tool-controls studio-controls">
                    <section className="lighting-global"><strong>全局</strong><label><span>亮度</span><input type="range" min="10" max="100" value={studioLighting.intensity} onChange={(event) => setStudioLighting((current) => ({ ...current, intensity: Number(event.target.value) }))} /><b>{studioLighting.intensity}%</b></label><label><span>色温</span><input type="range" min="3200" max="7600" step="100" value={studioLighting.temperatureK} onChange={(event) => setStudioLighting((current) => ({ ...current, temperatureK: Number(event.target.value) }))} /><b>{studioLighting.temperatureK}K</b></label></section>
                    <section><strong>主光源</strong><div className="studio-presets">{[['左侧', -90, 15], ['顶部', 0, 75], ['右侧', 90, 15], ['前方', 0, 10], ['底部', 0, -60], ['后方', 180, 15]].map(([label, yaw, pitch]) => <button key={String(label)} className={studioLighting.yaw === Number(yaw) && studioLighting.pitch === Number(pitch) ? 'is-selected' : ''} onClick={() => setStudioLighting((current) => ({ ...current, yaw: Number(yaw), pitch: Number(pitch) }))}>{label}</button>)}</div></section>
                    <section className="lighting-rim"><div><strong>轮廓光</strong><button type="button" className={studioLighting.rim ? 'is-on' : ''} onClick={() => setStudioLighting((current) => ({ ...current, rim: !current.rim }))}><i /></button></div>{studioLighting.rim && <label><span>强度</span><input type="range" min="5" max="80" value={studioLighting.rimStrength} onChange={(event) => setStudioLighting((current) => ({ ...current, rimStrength: Number(event.target.value) }))} /><b>{studioLighting.rimStrength}%</b></label>}</section>
                    <div className="lighting-prompt-preview"><small>打光提示</small><p>{`主光水平 ${studioLighting.yaw}°，垂直 ${studioLighting.pitch}°，亮度 ${studioLighting.intensity}%，色温 ${studioLighting.temperatureK}K${studioLighting.rim ? `，轮廓光 ${studioLighting.rimStrength}%` : ''}`}</p></div>
                  </div> : imageTool.mode === 'local-edit' ? <div className="image-tool-controls local-edit-controls">
                    <div className="local-edit-heading"><strong>评论列表</strong><span>{localEditMarks.length} / 5</span></div>
                    <p>点击左侧图片需要修改的位置，再为对应编号填写修改要求。</p>
                    <div className="local-edit-comment-list">{localEditMarks.map((mark, index) => <label key={mark.id}><b>{index + 1}</b><textarea autoFocus={index === localEditMarks.length - 1} value={mark.prompt} placeholder="描述这个位置要怎么修改…" onPointerDown={(event) => event.stopPropagation()} onChange={(event) => setLocalEditMarks((current) => current.map((item) => item.id === mark.id ? { ...item, prompt: event.target.value } : item))} /><button type="button" aria-label={`删除评论 ${index + 1}`} onPointerDown={(event) => event.stopPropagation()} onClick={() => setLocalEditMarks((current) => current.filter((item) => item.id !== mark.id))}><X size={14} /></button></label>)}</div>
                    {!localEditMarks.length && <div className="local-edit-empty"><MessageCircle size={20} /><strong>在图片上添加评论</strong><span>点击任意位置，最多添加 5 条</span></div>}
                    {localEditMarks.length >= 5 && <small className="local-edit-limit">已达到 5 条评论上限</small>}
                  </div> : <div className="image-tool-controls cutout-info"><p>本机后台运行 MIT 许可的通用主体模型；首次下载后会缓存，不消耗 API 积分，也不会上传原图。</p><small>适合人像、商品主体；复杂毛发建议生成后检查边缘。</small>{cutoutProgress && <div className="cutout-progress-panel" role="status" aria-live="polite"><div><LoaderCircle className="is-spinning" size={15} /><strong>{cutoutProgress.stage}</strong><b>{typeof cutoutProgress.progress === 'number' ? `${Math.round(cutoutProgress.progress)}%` : ''}</b></div><span><i style={{ width: `${cutoutProgress.progress ?? 8}%` }} /></span>{cutoutProgress.detail && <small>{cutoutProgress.detail}</small>}<em>处理完成前窗口会保持打开，随后自动生成并连接结果节点。</em></div>}</div>}
                </div>
                <footer><button type="button" disabled={cutoutBusy} onClick={() => setImageTool(null)}>取消</button>{imageTool.mode === 'grid' ? <button type="button" className="is-primary" onClick={() => void applyGridCut()}><Crop size={15} />切分为 {((gridGuides.vertical.length + 1) * (gridGuides.horizontal.length + 1))} 张</button> : imageTool.mode === 'expand' ? <button type="button" className="is-primary" onClick={() => { const extensionGuide = `扩展区域：上 ${Math.max(0, -expandInsets.top)}%，右 ${Math.max(0, -expandInsets.right)}%，下 ${Math.max(0, -expandInsets.bottom)}%，左 ${Math.max(0, -expandInsets.left)}%。`; createImageEditTask('自由扩图', `${expandPrompt.trim()}\n目标输出尺寸：${expandSize.width} × ${expandSize.height}px。\n${extensionGuide}`) }}><Expand size={15} />立即扩图</button> : imageTool.mode === 'studio' ? <button type="button" className="is-primary" onClick={() => { const direction = studioLighting.yaw > 135 || studioLighting.yaw < -135 ? '后方逆光' : studioLighting.yaw > 45 ? '右侧光' : studioLighting.yaw < -45 ? '左侧光' : studioLighting.pitch > 45 ? '顶部光' : studioLighting.pitch < -35 ? '底部光' : '前方光'; createImageEditTask('打光', `保持原图主体、构图、材质、文字和身份完全一致，仅重设光线：${direction}，主光水平 ${studioLighting.yaw}°，垂直 ${studioLighting.pitch}°，全局亮度 ${studioLighting.intensity}%，色温 ${studioLighting.temperatureK}K${studioLighting.rim ? `，增加 ${studioLighting.rimStrength}% 轮廓光` : ''}。光影自然、曝光准确，不改变产品形状、画面内容与视角。`) }}><Sparkles size={15} />生成图片</button> : imageTool.mode === 'local-edit' ? <button type="button" className="is-primary" disabled={!localEditMarks.length || localEditMarks.some((mark) => !mark.prompt.trim())} onClick={() => createImageEditTask('评论修改', `按编号仅修改以下点位：\n${localEditMarks.map((mark, index) => `${index + 1}. 点位(${Math.round(mark.x)}%,${Math.round(mark.y)}%)：${mark.prompt.trim()}`).join('\n')}\n点位之外的像素、主体、构图、光线与尺寸保持不变，不要重绘其他区域。`)}><Sparkles size={15} />立即修改</button> : <button type="button" className="is-primary" disabled={cutoutBusy} onClick={() => applyLocalCutout()}>{cutoutBusy ? <LoaderCircle className="is-spinning" size={15} /> : <Scissors size={15} />}{cutoutBusy ? '处理中…' : cutoutProgress?.failed ? '重新尝试' : '开始本地抠图'}</button>}</footer>
              </motion.section>
            </motion.div>
          })()}
        </AnimatePresence>

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
              ref={selectionToolbarRef}
              className={`selection-action-toolbar nowheel ${selectedGroupNode ? 'is-group-toolbar' : ''}`}
              style={{ left: selectionToolbarRect.left, top: selectionToolbarRect.top }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onPointerDown={(event) => event.stopPropagation()}
              onWheelCapture={(event) => {
                event.preventDefault()
                event.stopPropagation()
              }}
            >
              {selectedGroupNode ? (
                <>
                  {selectedGroupNode.data.groupCollapsed && <div className="group-icon-control">
                    <button
                      type="button"
                      aria-label="选择编组图标"
                      title="类型图标"
                      onClick={() => {
                        setGroupIconMenuOpen((open) => !open)
                        setGroupColorMenuOpen(false)
                      }}
                    >
                      <GroupTypeIcon icon={selectedGroupNode.data.groupIcon} size={15} />
                      <span>图标</span>
                    </button>
                    <AnimatePresence>
                      {groupIconMenuOpen && (
                        <motion.div
                          className="group-icon-palette"
                          initial={{ opacity: 0, y: 6, scale: 0.96 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, y: 5, scale: 0.97 }}
                        >
                          {GROUP_ICON_OPTIONS.map((option) => (
                            <button
                              key={option.key}
                              type="button"
                              className={selectedGroupNode.data.groupIcon === option.key ? 'is-selected' : ''}
                              aria-label={option.label}
                              title={option.label}
                              onClick={() => setSelectedGroupIcon(option.key)}
                            ><GroupTypeIcon icon={option.key} size={16} /></button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>}
                  <div className="group-color-control">
                    <button
                      type="button"
                      aria-label="选择分组背景颜色"
                      title="背景颜色"
                      onClick={() => {
                        setGroupColorMenuOpen((open) => !open)
                        setGroupIconMenuOpen(false)
                      }}
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
                            { label: '品牌渐变', surface: 'linear-gradient(135deg, #70e8f1 0%, #70b5ff 36%, #a793ff 68%, #f0a8d3 100%)', accent: '#8ab9ff' },
                            { label: '石墨', surface: 'rgba(72, 76, 73, .20)', accent: '#858b87' },
                            { label: '天空蓝', surface: 'rgba(65, 126, 178, .24)', accent: '#78b7ef' },
                            { label: '樱花粉', surface: 'rgba(177, 78, 126, .24)', accent: '#f08fbd' },
                            { label: '薰衣草', surface: 'rgba(116, 87, 180, .24)', accent: '#ad94ef' },
                            { label: '珊瑚橙', surface: 'rgba(176, 102, 57, .24)', accent: '#e9a06d' },
                            { label: '青柠绿', surface: 'rgba(66, 137, 91, .24)', accent: '#81cb96' },
                          ].map((option) => (
                            <button
                              key={option.label}
                              type="button"
                              aria-label={option.label}
                              title={option.label}
                              className={selectedGroupNode.data.groupAccentColor === option.accent ? 'is-selected' : ''}
                              style={{ background: option.accent }}
                              onClick={() => setSelectedGroupAppearance(option.surface, option.accent)}
                            />
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  <button type="button" onClick={() => setGroupCollapsed(selectedGroupNode.id, !selectedGroupNode.data.groupCollapsed)}>
                    {selectedGroupNode.data.groupCollapsed ? <Maximize2 size={15} /> : <Minus size={15} />}
                    <span>{selectedGroupNode.data.groupCollapsed ? '展开' : '折叠'}</span>
                  </button>
                  {!selectedGroupNode.data.groupCollapsed && <>
                    <button type="button" onClick={arrangeSelectedGroupAsGrid}>
                      <Grid3X3 size={15} /><span>宫格布局</span>
                    </button>
                    <button type="button" disabled title="下一阶段开放">
                      <PanelsTopLeft size={15} /><span>创建模板</span>
                    </button>
                  </>}
                  <span className="selection-toolbar-divider" />
                  <button type="button" onClick={ungroupSelectedNode}>
                    <Unlink2 size={15} /><span>解组</span>
                  </button>
                  <button type="button" aria-label="整组下载" title="整组下载" onClick={() => void downloadSelectedImages()}>
                    <Download size={15} />
                  </button>
                  <button type="button" onClick={saveSelectedNodesToAssets}>
                    <Library size={15} /><span>加入资产库</span>
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={addSelectedNodesToAgentConversation}>
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
            <AnimatePresence initial={false}>
              {!agentOpen && <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}><WelcomeAgentComposer
                textModels={enabledTextModels.map(({ connection, model }) => ({ key: `${connection.id}::${model.id}`, name: model.name, connectionName: connection.name }))}
                imageModels={enabledImageModels.map(({ connection, model }) => ({ key: `${connection.id}::${model.id}`, name: model.name, connectionName: connection.name }))}
                textModelKey={agentTextModelKey}
                imageModelKey={agentImageModelKey}
                onTextModelChange={setAgentTextModelKey}
                onImageModelChange={(key) => { setAgentImageModelKey(key); const [connectionId = '', modelId = ''] = key.split('::'); setAgentPlans((current) => current.map((plan) => plan.status === 'running' || plan.status === 'completed' ? plan : { ...plan, imageConnectionId: connectionId, imageModelId: modelId })) }}
                onVideoUnavailable={() => setToastMessage('视频生成功能暂未开放，敬请期待')}
                onSend={(message) => void sendAgentMessage(message, message)}
                busy={agentBusy}
              /></motion.div>}
            </AnimatePresence>
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
          accept="image/png,image/jpeg,image/webp"
          multiple
          aria-label="为图像生成节点上传参考图片"
          onChange={(event) => {
            const files = Array.from(event.target.files ?? [])
            const nodeId = generationReferenceNodeIdRef.current
            if (files.length && nodeId) void addReferenceFilesToNode(nodeId, files)
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
          aria-label={`打开输出历史，共 ${currentOutputHistory.length} 条`}
        >
          {generationLoading ? <LoaderCircle size={14} className="is-spinning" /> : <History size={14} />}
          <span>{generationLoading ? `正在生成 ${activeGenerationTaskKeys.size}/${MAX_CONCURRENT_GENERATION_TASKS}` : '输出历史'}</span>
          <small>{currentOutputHistory.length}</small>
          {outputFailureCount > 0 && <em>{outputFailureCount} 项失败</em>}
        </button>

        <div className="floating-chrome top-left-cluster canvas-identity-cluster">
          <button className={`brand-chip brand-only ${projectMenuOpen ? 'is-active' : ''}`} aria-label="打开项目菜单" aria-expanded={projectMenuOpen} onClick={() => setProjectMenuOpen((open) => !open)}>
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
              className="canvas-name-display canvas-identity-button"
              title="单击切换画布，双击编辑名称"
              onClick={() => setCanvasSwitcherOpen((open) => !open)}
              onDoubleClick={() => {
                setCanvasNameDraft(canvasName)
                setCanvasNameEditing(true)
              }}
            >
              <span><small>{projectName}</small><strong>{canvasName}</strong></span>
              <ChevronRight size={13} className={canvasSwitcherOpen ? 'is-open' : ''} />
            </button>
          )}
          <button className="canvas-quick-create" aria-label="新建画布" title="在当前项目中新建画布" onClick={() => void addCanvasToCurrentProject()}>
            <Plus size={15} /><span>画布</span>
          </button>
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
          {projectMenuOpen && (
            <motion.section className="project-brand-menu" initial={{ opacity: 0, y: -6, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5, scale: .98 }}>
              <button className="project-brand-menu-primary" onClick={() => {
                void saveCanvasState(canvasName, true).finally(() => {
                  setProjectMenuOpen(false)
                  setProjectHomeOpen(true)
                })
              }}><ChevronLeft size={15} /><span>返回工作空间</span></button>
              <div className="project-brand-menu-section"><small>项目</small>
                <button onClick={() => { setProjectMenuOpen(false); setCanvasSwitcherOpen(true); setProjectRename({ id: activeProjectId, draft: projectName, source: 'switcher' }) }}><Pencil size={14} /><span>重命名</span></button>
                <button onClick={() => { setProjectMenuOpen(false); void createNewProject() }}><Plus size={15} /><span>新建项目</span></button>
                <button onClick={() => { setProjectMenuOpen(false); setSelectedProjectIds([]); setProjectOpen(true) }}><Folder size={14} /><span>管理项目</span></button>
              </div>
              <button className="project-brand-menu-danger" onClick={() => { setProjectMenuOpen(false); void removeProject(activeProjectId) }}><Trash2 size={14} /><span>删除当前项目</span></button>
            </motion.section>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {canvasSwitcherOpen && (
            <motion.section className="canvas-switcher-menu" initial={{ opacity: 0, y: -5, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -4, scale: .98 }}>
              <header className="canvas-switcher-header">
                <div className="canvas-switcher-project-title">
                  {projectRename?.id === activeProjectId && projectRename.source === 'switcher' ? <>
                    <input
                      autoFocus
                      value={projectRename.draft}
                      maxLength={48}
                      aria-label="编辑项目名称"
                      onChange={(event) => setProjectRename({ ...projectRename, draft: event.target.value })}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter') void commitProjectRename(projectRename.id, projectRename.draft)
                        if (event.key === 'Escape') {
                          event.stopPropagation()
                          setProjectRename(null)
                        }
                      }}
                    />
                    <button type="button" aria-label="确认项目名称" onClick={() => void commitProjectRename(projectRename.id, projectRename.draft)}><Check size={13} /></button>
                    <button type="button" aria-label="取消项目重命名" onClick={() => setProjectRename(null)}><X size={13} /></button>
                  </> : <>
                    <span><strong>{projectName}</strong><small>{workspaceCanvases.length} 张画布</small></span>
                    <button type="button" aria-label="重命名当前项目" title="重命名项目" onClick={() => setProjectRename({ id: activeProjectId, draft: projectName, source: 'switcher' })}><Pencil size={12} /></button>
                  </>}
                </div>
                <label className="card-scale-control" title="调整画布卡片大小"><input aria-label="调整画布卡片大小" type="range" min="0.8" max="1.4" step="0.1" value={canvasCardScale} onChange={(event) => setCanvasCardScale(Number(event.target.value))} /></label>
              </header>
              <div className="canvas-switcher-list">
                {workspaceCanvases.map((canvas) => <div key={canvas.id} className={`canvas-switcher-row ${canvas.id === activeCanvasId ? 'is-active' : ''}`} style={{ '--canvas-card-scale': canvasCardScale } as React.CSSProperties}><button className={`canvas-switcher-item ${canvas.id === activeCanvasId ? 'is-active' : ''}`} onClick={() => void openWorkspaceCanvas(canvas.id)}>
                  <span className={`canvas-switcher-preview ${getCanvasPreviewUrl(canvas) ? 'has-image' : 'is-empty'}`}>
                    {getCanvasPreviewUrl(canvas) ? <img src={getCanvasPreviewUrl(canvas)} alt="" /> : <PanelsTopLeft size={16} />}
                  </span>
                  <span><strong>{canvas.name}</strong><small>{(canvas.nodes as unknown[]).length} 个节点</small></span>
                  {canvas.id === activeCanvasId && <Check size={14} />}
                </button><button className="canvas-switcher-delete" aria-label={`删除画布 ${canvas.name}`} title={workspaceCanvases.length <= 1 ? '项目至少保留一张画布' : '删除画布'} disabled={workspaceCanvases.length <= 1} onClick={() => void removeCanvas(canvas.id)}><Trash2 size={13} /></button></div>)}
              </div>
              <footer><button className="canvas-switcher-create" onClick={() => void addCanvasToCurrentProject()}><Plus size={15} />新建画布</button></footer>
            </motion.section>
          )}
        </AnimatePresence>

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
                      <strong>风格设定</strong>
                      <p>创建多个独立预设；在 Agent 对话或画布提示词中输入调用词，即可同时调用对应风格。</p>
                    </div>
                    <button
                      type="button"
                      className="style-preset-create"
                      disabled={projectSettingsLocked}
                      onClick={() => setStylePresets((current) => [...current, {
                        id: `style-preset-${crypto.randomUUID()}`,
                        name: `风格预设 ${current.length + 1}`,
                        keyword: '',
                        enabled: false,
                        collapsed: false,
                        references: [],
                      }])}
                    ><Plus size={13} />新建预设</button>
                  </div>

                  <div className="style-preset-list">
                    {stylePresets.map((preset) => <section className={`style-preset-card ${preset.collapsed ? 'is-collapsed' : ''}`} key={preset.id}>
                      <header className="style-preset-card-header">
                        <button
                          type="button"
                          className="style-preset-collapse"
                          aria-label={preset.collapsed ? `展开 ${preset.name}` : `折叠 ${preset.name}`}
                          onClick={() => setStylePresets((current) => current.map((item) => item.id === preset.id ? { ...item, collapsed: !item.collapsed } : item))}
                        ><ChevronRight size={14} /></button>
                        <input
                          className="style-preset-name"
                          value={preset.name}
                          maxLength={32}
                          disabled={projectSettingsLocked}
                          aria-label="风格预设名称"
                          onChange={(event) => setStylePresets((current) => current.map((item) => item.id === preset.id ? { ...item, name: event.target.value } : item))}
                          onBlur={() => setStylePresets((current) => current.map((item, index) => item.id === preset.id ? { ...item, name: item.name.trim() || `风格预设 ${index + 1}` } : item))}
                        />
                        <button
                          type="button"
                          role="switch"
                          aria-checked={preset.enabled}
                          className={`style-reference-switch ${preset.enabled ? 'is-on' : ''}`}
                          disabled={projectSettingsLocked}
                          onClick={() => setStylePresets((current) => current.map((item) => item.id === preset.id ? { ...item, enabled: !item.enabled } : item))}
                        ><span>启用</span><i /></button>
                        <button
                          type="button"
                          className="style-preset-delete"
                          aria-label={`删除 ${preset.name}`}
                          disabled={projectSettingsLocked}
                          onClick={() => {
                            if (preset.references.length) {
                              setDeleteConfirm({ kind: 'style-preset', presetId: preset.id, label: `${preset.name}（含 ${preset.references.length} 张参考图）` })
                              return
                            }
                            setStylePresets((current) => current.filter((item) => item.id !== preset.id))
                          }}
                        ><Trash2 size={13} /></button>
                      </header>
                      {!preset.collapsed && <div className="style-preset-card-body">
                        <label className="style-invocation-field">
                          <span>
                            <strong>风格调用词</strong>
                            <small>Agent 对话和画布生图提示词均可使用。</small>
                          </span>
                          <input
                            type="text"
                            value={preset.keyword}
                            maxLength={24}
                            disabled={projectSettingsLocked}
                            placeholder="例如：Disy"
                            aria-label={`${preset.name}调用词`}
                            onChange={(event) => setStylePresets((current) => current.map((item) => item.id === preset.id ? { ...item, keyword: event.target.value } : item))}
                          />
                        </label>
                        {!!preset.references.length && <div className="style-reference-list">
                          {preset.references.map((reference, index) => (
                            <div className={`style-reference-preview ${preset.enabled ? '' : 'is-disabled'}`} key={reference.id}>
                              <img src={reference.url} alt={`${preset.name}参考图 ${index + 1}`} draggable={false} />
                              <div className="style-reference-meta">
                                <strong title={reference.name}>{reference.name}</strong>
                                <small>{!preset.enabled ? `参考图 ${index + 1}/5 · 已停用` : `参考图 ${index + 1}/5 · 调用词触发`}</small>
                                <div>
                                  <button
                                    type="button"
                                    disabled={projectSettingsLocked}
                                    onClick={() => {
                                      styleReferenceUploadTargetRef.current = { presetId: preset.id, referenceId: reference.id }
                                      styleReferenceInputRef.current?.click()
                                    }}
                                  >替换</button>
                                  <button
                                    type="button"
                                    className="is-danger"
                                    disabled={projectSettingsLocked}
                                    onClick={() => setDeleteConfirm({ kind: 'style-reference', id: reference.id, presetId: preset.id, label: reference.name })}
                                  >移除</button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>}
                        {preset.references.length < 5 && <button
                          className="style-reference-upload"
                          disabled={projectSettingsLocked}
                          onClick={() => {
                            styleReferenceUploadTargetRef.current = { presetId: preset.id }
                            styleReferenceInputRef.current?.click()
                          }}
                        >
                          <ImagePlus size={16} />
                          {preset.references.length ? `继续上传（${preset.references.length}/5）` : '上传风格参考图（最多 5 张）'}
                        </button>}
                      </div>}
                    </section>)}
                    {!stylePresets.length && <div className="style-preset-empty">
                      <Sparkles size={15} />
                      <span><strong>还没有风格预设</strong><small>点击“新建预设”创建第一组风格设定。</small></span>
                    </div>}
                  </div>
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
          multiple
          aria-label="上传项目风格参考图"
          onChange={async (event) => {
            const files = Array.from(event.target.files ?? []).filter((file) => file.type.startsWith('image/'))
            const target = styleReferenceUploadTargetRef.current
            styleReferenceUploadTargetRef.current = null
            const targetPreset = target ? stylePresets.find((preset) => preset.id === target.presetId) : undefined
            const remaining = target?.referenceId ? 1 : Math.max(0, 5 - (targetPreset?.references.length ?? 5))
            const acceptedFiles = files.slice(0, remaining)
            event.target.value = ''
            if (!target || !targetPreset || !acceptedFiles.length) return
            try {
              const uploaded = await Promise.all(acceptedFiles.map((file) => new Promise<StyleReferenceRecord>((resolve, reject) => {
                const reader = new FileReader()
                reader.onload = () => typeof reader.result === 'string'
                  ? resolve({ id: `style-${crypto.randomUUID()}`, name: file.name, url: reader.result })
                  : reject(new Error('图片读取失败'))
                reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
                reader.readAsDataURL(file)
              })))
              setStylePresets((current) => current.map((preset) => {
                if (preset.id !== target.presetId) return preset
                return {
                  ...preset,
                  enabled: preset.enabled,
                  references: target.referenceId
                    ? preset.references.map((reference) => reference.id === target.referenceId ? { ...uploaded[0], id: reference.id } : reference)
                    : [...preset.references, ...uploaded].slice(0, 5),
                }
              }))
              if (!target.referenceId && files.length > remaining) setToastMessage(`每个预设最多上传 5 张，已添加前 ${acceptedFiles.length} 张`)
            } catch {
              setToastMessage('风格参考图读取失败，请重新选择')
            }
          }}
        />

        <div className="floating-chrome top-right-cluster">
          <button
            type="button"
            className="chrome-icon-button"
            aria-label="导入项目"
            title="导入项目或画布备份"
            disabled={transferBusy}
            onClick={() => openTransferDialog('project-replace')}
          >
            <Upload size={16} />
          </button>
          <button
            type="button"
            className="chrome-icon-button"
            aria-label="导出项目"
            title="选择导出全部工作区或当前项目"
            disabled={transferBusy}
            onClick={() => openTransferDialog('project-replace')}
          >
            <Download size={16} />
          </button>
          <button
            ref={apiButtonRef}
            className={`api-chip ${apiConfigured ? 'configured' : ''}`}
            onClick={openApiSettings}
          >
            <KeyRound size={15} />
            {apiConfigured ? 'API 已配置' : '配置 API'}
          </button>
        </div>

        <nav className="floating-chrome tool-rail" aria-label="画布工具">
          <button
            ref={nodeMenuButtonRef}
            className="rail-primary"
            aria-label="添加"
            data-tooltip="添加"
            onClick={openNodeMenuFromButton}
          >
            <Plus size={22} />
          </button>
          <button
            aria-label="画布/项目"
            data-tooltip="画布/项目"
            onClick={() => setProjectOpen(true)}
          >
            <PanelsTopLeft size={18} />
          </button>
          <button
            data-node-search-trigger
            className={nodeSearchOpen ? 'is-active' : ''}
            aria-label="搜索节点"
            data-tooltip="搜索节点"
            onClick={() => { setNodeSearchOpen((open) => !open); setNodeSearchQuery('') }}
          >
            <Search size={18} />
          </button>
          <button
            className={promptLibraryOpen ? 'is-active' : ''}
            aria-label="提示库"
            data-tooltip="提示库"
            onClick={() => setPromptLibraryOpen(true)}
          >
            <BookOpen size={18} />
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
          <button aria-label="设置" data-tooltip="设置" onClick={openApiSettings}>
            <Settings2 size={18} />
          </button>
          <button className={`rail-avatar ${agentOpen ? 'is-active' : ''}`} aria-label="Disy 与您对话" data-tooltip="Disy 与您对话" aria-expanded={agentOpen} aria-controls="disy-agent-panel" onClick={() => { setAgentOpen((open) => !open); setAgentCanvasPicking(false) }}>
            <img src="/disy-logo.png" alt="" />
          </button>
        </nav>

        <AnimatePresence>
          {nodeSearchOpen && <motion.section className="node-search-panel" initial={{ opacity: 0, x: -8, scale: .98 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: -6, scale: .98 }}>
            <header><div><Search size={15} /><strong>搜索节点</strong></div><button aria-label="关闭搜索节点" onClick={() => setNodeSearchOpen(false)}><X size={16} /></button></header>
            <label><Search size={14} /><input autoFocus value={nodeSearchQuery} placeholder="搜索名称、内容或文件名" onChange={(event) => setNodeSearchQuery(event.target.value)} /></label>
            <div className="node-search-results">
              {nodeSearchResults.map((node) => <button key={node.id} onClick={() => {
                const size = getNodeSize(node)
                setNodes((current) => current.map((item) => ({ ...item, selected: item.id === node.id })))
                setSelectedNodeIds([node.id])
                setCenter(node.position.x + size.width / 2, node.position.y + size.height / 2, { zoom: Math.max(canvasZoom, .85), duration: reduceMotion ? 0 : 320 })
                setNodeSearchOpen(false)
              }}><span className={`node-search-kind is-${node.data.kind}`}>{node.data.kind === 'group' ? <Box size={13} /> : node.data.kind === 'text' ? <Type size={13} /> : <FileImage size={13} />}</span><span><strong>{getNodeDisplayTitle(node.data)}</strong><small>{node.data.body || node.data.fileName || (node.data.kind === 'group' ? '分组' : '无附加内容')}</small></span></button>)}
              {!nodeSearchResults.length && <div className="node-search-empty"><Search size={20} /><span>没有找到匹配节点</span></div>}
            </div>
            <footer>{nodeSearchResults.length} / {nodes.length} 个节点</footer>
          </motion.section>}
        </AnimatePresence>

        <button
          type="button"
          className="help-launcher"
          aria-label="打开快捷键大全和使用指南"
          data-tooltip="快捷键大全 · 使用指南"
          onClick={() => setHelpOpen(true)}
        >
          <CircleHelp size={21} />
        </button>

        <AnimatePresence>
          {helpOpen && (
            <motion.div className="modal-backdrop help-center-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onMouseDown={() => setHelpOpen(false)}>
              <motion.section
                className="help-center-modal"
                role="dialog"
                aria-modal="true"
                aria-label="快捷键大全和使用指南"
                initial={{ opacity: 0, y: 14, scale: .98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: .985 }}
                onMouseDown={(event) => event.stopPropagation()}
              >
                <header className="help-center-header">
                  <div><span><CircleHelp size={18} /></span><div><strong>Disy 使用指南</strong><small>让灵感在画布上自由连接</small></div></div>
                  <button type="button" aria-label="关闭使用指南" onClick={() => setHelpOpen(false)}><X size={18} /></button>
                </header>
                <div className="help-center-scroll">
                  <section className="help-guide-section">
                    <div className="help-section-heading"><BookOpen size={15} /><div><strong>从想法到图像</strong><small>四步完成一次可追溯的创作</small></div></div>
                    <div className="help-guide-grid">
                      {[
                        ['01', '放入素材', '双击空白处，添加文字、图片或图像生成节点。'],
                        ['02', '建立关系', '连线或在节点编辑器中选择参考图，图1、图2按当前顺序识别。'],
                        ['03', '确认方案', '和 Disy Agent 对话；多方案先选择，再逐一确认，不会直接扣费。'],
                        ['04', '沉淀结果', '生成结果保留在节点版本、生成历史与输出历史中。'],
                      ].map(([step, title, detail]) => <article key={step}><span>{step}</span><div><strong>{title}</strong><p>{detail}</p></div></article>)}
                    </div>
                  </section>
                  <section className="help-shortcut-section">
                    <div className="help-section-heading"><Keyboard size={15} /><div><strong>快捷键大全</strong><small>输入框聚焦时保留系统文字快捷键</small></div></div>
                    <div className="help-shortcut-grid">
                      {[
                        ['Ctrl + Z', '撤销画布操作'],
                        ['Ctrl + Shift + Z / Ctrl + Y', '重做画布操作'],
                        ['Ctrl + C / Ctrl + V', '复制、粘贴节点或系统图片'],
                        ['Ctrl + G', '将选中的节点打组'],
                        ['Alt + 拖拽', '创建独立节点副本'],
                        ['Delete / Backspace', '删除选中的节点或连线'],
                        ['Ctrl + S', '立即保存当前画布'],
                        ['Ctrl + 滚轮', '缩放画布'],
                        ['双击空白处', '快速添加节点'],
                        ['右键', '打开节点或画布菜单'],
                        ['Esc', '关闭当前弹窗或菜单'],
                      ].map(([keys, action]) => <div key={keys}><kbd>{keys}</kbd><span>{action}</span></div>)}
                    </div>
                  </section>
                  <aside className={`help-performance-note ${automaticPerformanceMode ? 'is-active' : ''}`}>
                    <Sparkles size={15} />
                    <div><strong>{automaticPerformanceMode ? '画布性能模式已自动开启' : '画布性能模式会自动开启'}</strong><small>节点达到 28 个后，Disy 会减少不可见节点和高开销光效渲染；无需修改浏览器设置。</small></div>
                  </aside>
                </div>
              </motion.section>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {agentOpen && (
            <motion.div className="agent-panel-motion" initial={{ opacity: 0, x: 28 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 28 }}>
              <AgentPanel
                messages={agentMessages}
                plans={agentPlans}
                textPlans={agentTextPlans}
                references={agentReferences}
                pendingReferences={agentPendingReferences}
                candidates={agentImageCandidates}
                conversations={agentConversationOptions.length ? agentConversationOptions : [{ id: agentConversationId, title: '新的对话', updatedAt: new Date().toISOString() }]}
                activeConversationId={agentConversationId}
                textModels={enabledTextModels.map(({ connection, model }) => ({ key: `${connection.id}::${model.id}`, name: model.name, connectionName: connection.name }))}
                imageModels={enabledImageModels.map(({ connection, model }) => ({ key: `${connection.id}::${model.id}`, name: model.name, connectionName: connection.name }))}
                aspectOptions={IMAGE_ASPECT_OPTIONS.map(({ value, label }) => ({ value, label }))}
                resolutionOptions={(['1K', '2K', '4K'] as ImageResolution[]).map((value) => ({ value, label: value }))}
                detailOptions={(Object.keys(IMAGE_DETAIL_LABELS) as ImageDetail[]).map((value) => ({ value, label: IMAGE_DETAIL_LABELS[value] }))}
                textModelKey={agentTextModelKey}
                imageModelKey={agentImageModelKey}
                imageDefaults={agentImageDefaults}
                busy={agentBusy}
                onStop={stopAgentThinking}
                onClose={() => { setAgentOpen(false); setAgentCanvasPicking(false) }}
                onNewConversation={beginNewAgentConversation}
                onDeleteConversation={() => void deleteCurrentAgentConversation()}
                onSelectConversation={(id) => void selectAgentConversation(id)}
                onTextModelChange={setAgentTextModelKey}
                onImageModelChange={(key) => { setAgentImageModelKey(key); const [connectionId = '', modelId = ''] = key.split('::'); setAgentPlans((current) => current.map((plan) => plan.status === 'running' || plan.status === 'completed' ? plan : { ...plan, imageConnectionId: connectionId, imageModelId: modelId })) }}
                onImageDefaultsChange={(patch) => {
                  const normalizedPatch = {
                    ...(patch.aspectRatio ? { aspectRatio: patch.aspectRatio as ImageAspectRatio } : {}),
                    ...(patch.resolution ? { resolution: patch.resolution as ImageResolution } : {}),
                    ...(patch.detail ? { detail: patch.detail as ImageDetail } : {}),
                    ...(typeof patch.count === 'number' ? { count: patch.count } : {}),
                  }
                  setAgentImageDefaults((current) => ({ ...current, ...normalizedPatch }))
                  // The settings control is shared by the pending confirmation cards.
                  // Keep those cards live so a 9:16 selection cannot generate from a stale 1:1 draft.
                  setAgentPlans((current) => current.map((plan) => (
                    plan.status === 'proposed' || plan.status === 'ready'
                      ? { ...plan, ...normalizedPatch }
                      : plan
                  )))
                }}
                onVideoUnavailable={() => setToastMessage('视频生成功能暂未开放，敬请期待')}
                onReferencesChange={setAgentReferences}
                onCreateUploadedReference={createAgentUploadedReference}
                onUploadNotice={setToastMessage}
                onPendingReferenceConsumed={() => setAgentPendingReferences([])}
                onPickFromCanvas={() => { setAgentCanvasPicking((active) => !active); setToastMessage(agentCanvasPicking ? '已结束画布选图' : '请在画布上点击图片，完成后再次点击“画布选择”') }}
                onSend={(message, invocationText, references) => void sendAgentMessage(message, invocationText, references)}
                onPlanChange={(id, patch) => setAgentPlans((current) => current.map((plan) => plan.id === id && plan.status === 'ready' ? { ...plan, ...patch } : plan))}
                onSelectPlanOptions={selectAgentPlanOptions}
                onConfirmPlan={(id) => void confirmAgentPlan(id)}
                onCancelPlan={(id) => setAgentPlans((current) => current.map((plan) => plan.id === id ? { ...plan, status: 'proposed' } : plan))}
                onRemovePlanContextReference={(id, nodeId) => setAgentPlans((current) => current.map((plan) => plan.id === id ? {
                  ...plan,
                  contextReferences: (plan.contextReferences ?? []).filter((reference) => reference.nodeId !== nodeId),
                  referenceNodeIds: plan.referenceNodeIds.filter((referenceId) => referenceId !== nodeId),
                  references: (plan.references ?? []).filter((reference) => reference.nodeId !== nodeId),
                } : plan))}
                onTextPlanChange={(id, patch) => setAgentTextPlans((current) => current.map((plan) => plan.id === id && plan.status === 'ready' ? { ...plan, ...patch } : plan))}
                onConfirmTextPlan={confirmAgentTextPlan}
                onCancelTextPlan={(id) => setAgentTextPlans((current) => current.map((plan) => plan.id === id ? { ...plan, status: 'cancelled' } : plan))}
                onRemoveTextPlanContextReference={(id, nodeId) => setAgentTextPlans((current) => current.map((plan) => plan.id === id ? { ...plan, contextReferences: (plan.contextReferences ?? []).filter((reference) => reference.nodeId !== nodeId) } : plan))}
                onLocateCanvasNode={locateAgentCanvasNode}
              />
            </motion.div>
          )}
        </AnimatePresence>

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
              {nodeMenu.connectionSourceId ? '引用该节点生成' : '添加到画布'}
            </div>
            {!nodeMenu.connectionSourceId && nodeClipboard && (
              <>
                <button onClick={() => {
                  pasteClipboardNode({ position: { x: nodeMenu.flowX - 30, y: nodeMenu.flowY - 30 } })
                  closeNodeMenu()
                }}>
                  <Copy size={16} />
                  <span><strong>粘贴节点</strong><small>放到右键位置</small></span>
                </button>
                <div className="context-divider" />
              </>
            )}
            <button onClick={() => createNode('text')}>
              <Type size={16} />
              <span><strong>文本</strong><small>{nodeMenu.connectionSourceId ? '引用来源生成文本' : '记录灵感与提示词'}</small></span>
            </button>
            <button className={nodeMenu.connectionSourceId ? 'is-primary' : undefined} onClick={() => createNode('image')}>
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
              <span>复制到剪贴板</span><kbd>Ctrl C</kbd>
            </button>
            <button onClick={duplicateContextNode}>
              <span>复制节点副本</span><kbd>Alt 拖拽</kbd>
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

        {projectContextMenu && (
          <motion.div
            role="menu"
            aria-label="项目操作"
            className="node-context-menu project-context-menu"
            style={{ left: projectContextMenu.x, top: projectContextMenu.y }}
            initial={{ opacity: 0, scale: 0.96, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            onPointerDown={(event) => event.stopPropagation()}
            onContextMenu={(event) => event.preventDefault()}
          >
            {projectContextMenu.projectId && <button onClick={() => {
              setProjectContextMenu(null)
              void copyProjectToClipboard(projectContextMenu.projectId!)
            }}>
              <span>复制项目</span><kbd>Ctrl C</kbd>
            </button>}
            <button disabled={!projectClipboard} onClick={() => {
              setProjectContextMenu(null)
              void pasteProjectFromClipboard()
            }}>
              <span>{projectClipboard ? `粘贴“${projectClipboard.name}”` : '粘贴项目'}</span><kbd>Ctrl V</kbd>
            </button>
            {projectContextMenu.projectId && <>
              <div className="context-divider" />
              <button onClick={() => {
                setProjectContextMenu(null)
                void openWorkspaceCanvas(
                  workspaceProjects.find((item) => item.id === projectContextMenu.projectId)?.activeCanvasId ?? activeCanvasId,
                  projectContextMenu.projectId,
                ).then(() => setProjectHomeOpen(false))
              }}>
                <span>打开项目</span>
              </button>
            </>}
          </motion.div>
        )}

        <AnimatePresence>
          {activeImageNode && nodeOverlayRect && !isNodeDragging && !previewImageNode && (
            <motion.div
              className="node-quick-toolbar image-node-quick-toolbar nodrag nowheel"
              style={{
                left: Math.min(window.innerWidth - 320, Math.max(320, nodeOverlayRect.left + nodeOverlayRect.width / 2)),
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
              <button type="button" onClick={() => openImageTool(activeImageNode.id, 'grid')} title="自由宫格切分"><Grid3X3 size={14} /><span>宫格切分</span></button>
              <button type="button" onClick={() => openImageTool(activeImageNode.id, 'expand')} title="自由区域扩图"><Expand size={14} /><span>自由扩图</span></button>
              <button type="button" onClick={() => openImageTool(activeImageNode.id, 'studio')} title="打光"><Lightbulb size={14} /><span>打光</span></button>
              <button type="button" onClick={() => openImageTool(activeImageNode.id, 'local-edit')} title="评论修改"><MessageCircle size={14} /><span>评论修改</span></button>
              <button type="button" onClick={() => openImageTool(activeImageNode.id, 'cutout')} title="免费本地抠图"><Scissors size={14} /><span>去背景</span></button>
              <span className="quick-toolbar-divider" />
              <button type="button" onClick={() => void downloadSelectedImages([activeImageNode])}><Download size={14} /><span>下载</span></button>
              <button type="button" onClick={() => saveNodeToAssets(activeImageNode)}><Library size={14} /><span>加入资产库</span></button>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {activeGenerationNode && nodeOverlayRect && !isNodeDragging && (
            <motion.div
              className={`node-quick-toolbar ${activeGenerationNode.data.imageUrl ? 'image-node-quick-toolbar' : 'image-generation-upload-toolbar'} nodrag nowheel`}
              style={{
                left: activeGenerationNode.data.imageUrl
                  ? Math.min(window.innerWidth - 320, Math.max(320, nodeEditorCenterX))
                  : nodeEditorCenterX,
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
                  <button type="button" onClick={() => openImageTool(activeGenerationNode.id, 'grid')} title="自由宫格切分"><Grid3X3 size={14} /><span>宫格切分</span></button>
                  <button type="button" onClick={() => openImageTool(activeGenerationNode.id, 'expand')} title="自由区域扩图"><Expand size={14} /><span>自由扩图</span></button>
                  <button type="button" onClick={() => openImageTool(activeGenerationNode.id, 'studio')} title="打光"><Lightbulb size={14} /><span>打光</span></button>
                  <button type="button" onClick={() => openImageTool(activeGenerationNode.id, 'local-edit')} title="评论修改"><MessageCircle size={14} /><span>评论修改</span></button>
                  <button type="button" onClick={() => openImageTool(activeGenerationNode.id, 'cutout')} title="免费本地抠图"><Scissors size={14} /><span>去背景</span></button>
                  <span className="quick-toolbar-divider" />
                  <button type="button" onClick={() => void downloadSelectedImages([activeGenerationNode])}><Download size={14} /><span>下载</span></button>
                  <button type="button" onClick={() => saveNodeToAssets(activeGenerationNode)}><Library size={14} /><span>加入资产库</span></button>
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
                  <button type="button" className="image-preview-action" onClick={() => void downloadImageUrl(previewImage.url, previewImage.fileName)}><Download size={16} /><span>下载</span></button>
                  <button type="button" className="image-preview-action" onClick={() => saveImageUrlToAssets(previewImage.url, previewImage.fileName, previewImageNode ? getNodeDisplayTitle(previewImageNode.data) : previewImage.fileName)}><Library size={16} /><span>加入资产库</span></button>
                  <span className="image-preview-toolbar-divider" />
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
                  <button type="button" className="library-gallery-action" onClick={() => void downloadImageUrl(activeLibraryPreview.url, activeLibraryPreview.fileName)}><Download size={15} /><span>下载</span></button>
                  <button type="button" className="library-gallery-action" disabled={libraryPreview.kind === 'asset'} title={libraryPreview.kind === 'asset' ? '该图片已在资产库' : '加入资产库'} onClick={() => saveImageUrlToAssets(activeLibraryPreview.url, activeLibraryPreview.fileName)}><Library size={15} /><span>{libraryPreview.kind === 'asset' ? '已在资产库' : '加入资产库'}</span></button>
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
                  <div className="image-variant-gallery-actions">
                    <label className="image-variant-size-control" title="调整缩略图大小">
                      <Minus size={12} />
                      <input
                        type="range"
                        min="120"
                        max="360"
                        step="10"
                        value={imageGalleryThumbnailSize}
                        aria-label="候选图片缩放"
                        onChange={(event) => setImageGalleryThumbnailSize(Number(event.target.value))}
                      />
                      <Plus size={12} />
                    </label>
                    <button type="button" aria-label="关闭图片选择" onClick={() => setImageGalleryNodeId(null)}><X size={17} /></button>
                  </div>
                </header>
                <div
                  className="image-variant-gallery-grid"
                  style={{ '--variant-thumbnail-size': `${imageGalleryThumbnailSize}px` } as React.CSSProperties}
                  onWheel={(event) => {
                    if (!event.ctrlKey && !event.metaKey) return
                    event.preventDefault()
                    setImageGalleryThumbnailSize((current) => Math.max(120, Math.min(360, current - Math.sign(event.deltaY) * 20)))
                  }}
                >
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
                left: nodeEditorCenterX,
                top: nodeEditorTop,
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
                <div
                  className={`image-editor-reference-row reference-drop-zone ${referenceDropTargetNodeId === activeGenerationNode.id ? 'is-drop-active' : ''}`}
                  onDragEnter={(event) => handleReferenceDragOver(event, activeGenerationNode.id)}
                  onDragOver={(event) => handleReferenceDragOver(event, activeGenerationNode.id)}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) setReferenceDropTargetNodeId(null)
                  }}
                  onDrop={(event) => handleReferenceDrop(event, activeGenerationNode.id)}
                >
                  <span className="reference-drop-hint"><Upload size={15} />松开以添加参考图</span>
                  <div
                    className="image-reference-thumbnails"
                    onWheel={(event) => {
                      event.stopPropagation()
                      event.currentTarget.scrollLeft += event.deltaY || event.deltaX
                    }}
                  >
                    {activeGenerationReferences.map((reference) => {
                      const isImageReference = activeImageReferences.some((item) => item.id === reference.id)
                      return <button
                        type="button"
                        key={reference.id}
                        draggable={isImageReference}
                        className={`image-reference-thumbnail ${(reference.selected || activeGenerationNode.data.body.includes(reference.mention)) ? 'is-mentioned' : ''} ${reference.source === 'current' && !reference.selected ? 'is-disabled' : ''} ${('kind' in reference && reference.kind === 'text' && !reference.text?.trim()) || (!('kind' in reference) && reference.source === 'connection' && !reference.url) ? 'is-disabled' : ''} ${draggedImageReferenceId === reference.id ? 'is-dragging' : ''} ${imageReferenceDropTargetId === reference.id ? 'is-drop-target' : ''}`}
                        title={isImageReference ? `${reference.name} · 拖拽调整顺序，点击插入引用` : `${reference.name} · 点击插入引用`}
                        onMouseDown={(event) => {
                          if (!isImageReference) event.preventDefault()
                        }}
                        onDragStart={(event) => {
                          if (!isImageReference) return
                          event.stopPropagation()
                          event.dataTransfer.effectAllowed = 'move'
                          event.dataTransfer.setData('application/x-disy-reference-order', reference.id)
                          setDraggedImageReferenceId(reference.id)
                        }}
                        onDragOver={(event) => {
                          if (!isImageReference || !draggedImageReferenceId || draggedImageReferenceId === reference.id) return
                          event.preventDefault()
                          event.stopPropagation()
                          event.dataTransfer.dropEffect = 'move'
                          setImageReferenceDropTargetId(reference.id)
                        }}
                        onDrop={(event) => {
                          if (!isImageReference) return
                          event.preventDefault()
                          event.stopPropagation()
                          const sourceId = event.dataTransfer.getData('application/x-disy-reference-order') || draggedImageReferenceId
                          if (sourceId) reorderImageReferences(sourceId, reference.id)
                        }}
                        onDragEnd={() => {
                          setDraggedImageReferenceId(null)
                          setImageReferenceDropTargetId(null)
                        }}
                        onMouseEnter={(event) => {
                          if (!('kind' in reference) || reference.kind !== 'text' || !reference.text?.trim()) return
                          const rect = event.currentTarget.getBoundingClientRect()
                          setTextReferencePreview({
                            name: reference.name,
                            text: reference.text,
                            left: Math.min(rect.left, window.innerWidth - 300),
                            bottom: window.innerHeight - rect.top + 8,
                          })
                        }}
                        onMouseLeave={() => setTextReferencePreview(null)}
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
                        {reference.url
                          ? <img src={reference.url} alt={reference.name} />
                          : <span className="reference-text-thumbnail"><Type size={13} /></span>}
                        <span className="image-reference-name" title={reference.name}>{selectedImageReferenceNumberById.has(reference.id) ? `图${selectedImageReferenceNumberById.get(reference.id)} · ` : ''}{compactReferenceName(reference.name)}{reference.source === 'current' ? (reference.selected ? ' · 默认参考' : ' · 已关闭') : ''}</span>
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
                    })}
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
                    references={activeGenerationReferences}
                    onChange={handleImagePromptChange}
                    onRemoveToken={(start, end) => {
                      const nodeId = activeGenerationNode.id
                      const removedMention = activeGenerationNode.data.body.slice(start, end)
                      const removedReference = activeGenerationReferences.find((reference) => reference.mention === removedMention)
                      setNodes((current) => current.map((node) => {
                        if (node.id !== nodeId) return node
                        const body = node.data.body
                        const nextBody = `${body.slice(0, start)}${body.slice(end)}`
                        if (!removedReference) return { ...node, data: { ...node.data, promptText: undefined, body: nextBody } }
                        if (removedReference.source === 'current') return { ...node, data: { ...node.data, promptText: undefined, body: nextBody, useCurrentImageAsReference: false } }
                        if (removedReference.source === 'manual') return { ...node, data: {
                          ...node.data,
                          promptText: undefined,
                          body: nextBody,
                          referenceImages: (node.data.referenceImages ?? []).filter((reference) => reference.id !== removedReference.id),
                          referenceOrder: (node.data.referenceOrder ?? []).filter((id) => id !== removedReference.id),
                        } }
                        return { ...node, data: { ...node.data, promptText: undefined, body: nextBody } }
                      }))
                      if (removedReference?.source === 'connection' && removedReference.sourceNodeId) {
                        setEdges((current) => current.map((edge) => edge.source === removedReference.sourceNodeId && edge.target === nodeId
                          ? { ...edge, data: { ...edge.data, referenceSelected: false } }
                          : edge))
                      }
                      window.requestAnimationFrame(() => imagePromptEditorRef.current?.focusAt(start))
                    }}
                    onBlur={() => {
                      setImageMentionOpen(false)
                      setImageMentionRange(null)
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
                        <div className="image-mention-heading"><span>@ 引用参考素材</span><small>{filteredImageMentionReferences.length} 个可用</small></div>
                        {filteredImageMentionReferences.map((reference, index) => (
                          <button type="button" key={reference.id} className={imageMentionIndex === index ? 'is-selected' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => selectImageMention(reference)}>
                            {reference.url
                              ? <img src={reference.url} alt="" />
                              : <span className="reference-text-thumbnail"><Type size={13} /></span>}
                            <span><strong>@{reference.name}</strong><small>{reference.name}</small></span>
                            <em>{reference.source === 'connection' ? (reference.url ? '来自图片连线' : '来自文本连线') : '手动上传'}</em>
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
                            <button type="button" onClick={() => { setImageModelMenuOpen(false); openApiSettings() }} title="管理 API 连接">
                              <Settings2 size={13} />
                            </button>
                          </div>
                          {enabledImageModels.map(({ connection, model }, index) => (<div className="editor-model-option-wrap" key={`${connection.id}-${model.id}`}>
                            {groupImageModelsByProvider && (index === 0 || enabledImageModels[index - 1]?.connection.id !== connection.id) && <div className="editor-model-provider"><span>{connection.name}</span><small>{enabledImageModels.filter((item) => item.connection.id === connection.id).length} 个模型</small></div>}
                            <button
                              type="button"
                              className={displayedActiveNodeImageModel?.connection.id === connection.id && displayedActiveNodeImageModel.model.id === model.id ? 'is-selected' : ''}
                              onClick={() => {
                                saveApiSettings({ ...apiSettings, selectedImageModel: { connectionId: connection.id, modelId: model.id } })
                                if (activeGenerationNode) {
                                  setNodes((current) => current.map((node) => node.id === activeGenerationNode.id
                                    ? { ...node, data: { ...node.data, imageModelConnectionId: connection.id, imageModelId: model.id, imageModelName: model.name } }
                                    : node))
                                }
                                setImageModelMenuOpen(false)
                              }}
                            >
                              <ModelBrandBadge name={model.name} image />
                              <span><strong>{model.name}</strong></span>
                              {displayedActiveNodeImageModel?.connection.id === connection.id && displayedActiveNodeImageModel.model.id === model.id && <Check size={14} />}
                            </button>
                          </div>))}
                          {!enabledImageModels.length && <p>{hasCatalogImageModels ? '已获取到图像模型，但尚未启用，请到 API 设置中勾选。' : '还没有图像模型，请先到 API 设置中获取并启用。'}</p>}
                        </motion.div>
                      )}
                    </AnimatePresence>
                    <button
                      type="button"
                      className="editor-model-empty"
                      title={activeGenerationNode?.data.imageModelName || displayedActiveNodeImageModel?.model.name || '选择图像模型'}
                      onClick={() => {
                        setImageParameterMenuOpen(false)
                        setQuantityMenuOpen(false)
                        if (enabledImageModels.length) setImageModelMenuOpen((open) => !open)
                        else openApiSettings()
                      }}
                    >
                      <ModelBrandBadge name={activeGenerationNode?.data.imageModelName || displayedActiveNodeImageModel?.model.name} image />
                      <span>{activeGenerationNode?.data.imageModelName || displayedActiveNodeImageModel?.model.name || (hasCatalogImageModels ? '图像模型尚未启用' : '配置并启用图像模型')}</span>
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
                    <div className="generation-run-control">
                      <AnimatePresence>
                        {activeImageGenerationRunning && generationControlMenuNodeId === activeGenerationNode.id && (
                          <motion.div className="generation-control-menu" initial={{ opacity: 0, y: 5, scale: .96 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: .96 }}>
                            <button type="button" onClick={() => interruptGenerationTask(activeGenerationNode.id, 'paused')}><Pause size={13} />暂停任务</button>
                            <button type="button" className="is-stop" onClick={() => interruptGenerationTask(activeGenerationNode.id, 'stopped')}><X size={13} />停止任务</button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                      <button
                        className="editor-generate-button image-generate-button"
                        aria-label={activeImageGenerationRunning ? '暂停或停止生成任务' : '生成图像'}
                        title={activeImageGenerationRunning ? '暂停或停止' : '生成图像'}
                        onClick={() => activeImageGenerationRunning
                          ? setGenerationControlMenuNodeId((current) => current === activeGenerationNode.id ? null : activeGenerationNode.id)
                          : void generateFromActiveImageNode()}
                      >
                        {activeImageGenerationRunning ? <Pause size={17} /> : <ArrowUp size={17} strokeWidth={2.2} />}
                      </button>
                    </div>
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
                left: nodeEditorCenterX,
                top: nodeEditorTop,
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
                <div
                  className={`image-editor-reference-row text-editor-reference-row reference-drop-zone ${referenceDropTargetNodeId === activeTextNode.id ? 'is-drop-active' : ''}`}
                  onDragEnter={(event) => handleReferenceDragOver(event, activeTextNode.id)}
                  onDragOver={(event) => handleReferenceDragOver(event, activeTextNode.id)}
                  onDragLeave={(event) => {
                    if (!event.currentTarget.contains(event.relatedTarget as globalThis.Node | null)) setReferenceDropTargetNodeId(null)
                  }}
                  onDrop={(event) => handleReferenceDrop(event, activeTextNode.id)}
                >
                    <span className="reference-drop-hint"><Upload size={15} />松开以添加参考图</span>
                    <div className="image-reference-thumbnails">
                      {activeTextReferences.map((reference) => (
                        <button
                          type="button"
                          key={reference.id}
                          className={`image-reference-thumbnail ${(reference.selected || (activeTextNode.data.promptText ?? '').includes(reference.mention)) ? 'is-mentioned' : ''} ${(reference.kind === 'text' ? !reference.text?.trim() : !reference.url) ? 'is-disabled' : ''}`}
                          title={(reference.kind === 'text' ? !reference.text?.trim() : !reference.url) ? `${reference.name} · 来源内容暂不可用` : `${reference.name} · 点击插入引用`}
                          onMouseDown={(event) => event.preventDefault()}
                          onMouseEnter={(event) => {
                            if (reference.kind !== 'text' || !reference.text?.trim()) return
                            const rect = event.currentTarget.getBoundingClientRect()
                            setTextReferencePreview({
                              name: reference.name,
                              text: reference.text,
                              left: Math.min(rect.left, window.innerWidth - 300),
                              bottom: window.innerHeight - rect.top + 8,
                            })
                          }}
                          onMouseLeave={() => setTextReferencePreview(null)}
                          onClick={() => selectTextMention(reference)}
                        >
                          {reference.url
                            ? <img src={reference.url} alt={reference.name} />
                            : <span className="reference-text-thumbnail"><Type size={13} /></span>}
                          <span className="image-reference-name" title={reference.name}>{compactReferenceName(reference.name)}</span>
                          <span
                            className="reference-remove"
                            role="button"
                            aria-label={`移除 ${reference.name} 并断开连接`}
                            onClick={(event) => {
                              event.stopPropagation()
                              removeTextReference(reference)
                            }}
                          ><X size={9} /></span>
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="add-image-reference-button"
                      title="上传本地参考图片"
                      onClick={() => {
                        generationReferenceNodeIdRef.current = activeTextNode.id
                        generationReferenceInputRef.current?.click()
                      }}
                    ><Upload size={15} /></button>
                    <button
                      type="button"
                      className="add-image-reference-button"
                      title="从画布选择参考素材"
                      onClick={() => {
                        setCanvasReferencePickerNodeId(activeTextNode.id)
                        setTextMentionOpen(false)
                      }}
                    ><Plus size={15} /></button>
                  </div>
                <div className="image-prompt-field text-prompt-field">
                  <AtomicPromptEditor
                    key={activeTextNode.id}
                    ref={textPromptEditorRef}
                    value={activeTextNode.data.promptText ?? ''}
                    references={activeTextReferences}
                    ariaLabel="文本模型指令"
                    placeholder="描述希望文本模型完成的任务，按 @ 引用节点"
                    onChange={handleTextPromptChange}
                    onRemoveToken={(start, end) => {
                      const promptText = activeTextNode.data.promptText ?? ''
                      const removedMention = promptText.slice(start, end)
                      const removedReference = activeTextReferences.find((reference) => reference.mention === removedMention)
                      updateActiveTextNode(`${promptText.slice(0, start)}${promptText.slice(end)}`)
                      if (removedReference) {
                        setEdges((current) => current.map((edge) => edge.source === removedReference.sourceNodeId && edge.target === activeTextNode.id
                          ? { ...edge, data: { ...edge.data, referenceSelected: false } }
                          : edge))
                      }
                      window.requestAnimationFrame(() => textPromptEditorRef.current?.focusAt(start))
                    }}
                    onBlur={() => {
                      setTextMentionOpen(false)
                      setTextMentionRange(null)
                    }}
                    onKeyDown={(event) => {
                      event.stopPropagation()
                      if (textMentionOpen && filteredTextMentionReferences.length) {
                        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                          event.preventDefault()
                          const direction = event.key === 'ArrowDown' ? 1 : -1
                          setTextMentionIndex((current) => (current + direction + filteredTextMentionReferences.length) % filteredTextMentionReferences.length)
                          return
                        }
                        if (event.key === 'Enter' || event.key === 'Tab') {
                          event.preventDefault()
                          selectTextMention(filteredTextMentionReferences[textMentionIndex] ?? filteredTextMentionReferences[0])
                          return
                        }
                      }
                      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
                        event.preventDefault()
                        void generateFromActiveTextNode()
                      }
                      if (event.key === 'Escape') {
                        if (textMentionOpen) setTextMentionOpen(false)
                        else setActiveEditorNodeId(null)
                      }
                    }}
                  />
                  <AnimatePresence>
                    {textMentionOpen && (
                      <motion.div className="image-mention-menu" initial={{ opacity: 0, y: 5, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 4, scale: .98 }}>
                        <div className="image-mention-heading"><span>@ 引用节点</span><small>{filteredTextMentionReferences.length} 个可用</small></div>
                        {filteredTextMentionReferences.map((reference, index) => (
                          <button type="button" key={reference.id} className={textMentionIndex === index ? 'is-selected' : ''} onMouseDown={(event) => event.preventDefault()} onClick={() => selectTextMention(reference)}>
                            {reference.url
                              ? <img src={reference.url} alt="" />
                              : <span className="reference-text-thumbnail"><Type size={13} /></span>}
                            <span><strong>@{reference.name}</strong><small>{reference.name}</small></span>
                            <em>{reference.kind === 'image' ? '图片参考' : '文本参考'}</em>
                          </button>
                        ))}
                        {!filteredTextMentionReferences.length && <p>没有匹配的引用</p>}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
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
                            <button type="button" onClick={() => { setModelMenuOpen(false); openApiSettings() }} title="管理 API 连接">
                              <Settings2 size={13} />
                            </button>
                          </div>
                          {enabledTextModels.map(({ connection, model }, index) => (<div className="editor-model-option-wrap" key={`${connection.id}-${model.id}`}>
                            {groupTextModelsByProvider && (index === 0 || enabledTextModels[index - 1]?.connection.id !== connection.id) && <div className="editor-model-provider"><span>{connection.name}</span><small>{enabledTextModels.filter((item) => item.connection.id === connection.id).length} 个模型</small></div>}
                            <button
                              type="button"
                              className={selectedTextModel?.connection.id === connection.id && selectedTextModel.model.id === model.id ? 'is-selected' : ''}
                              onClick={() => {
                                saveApiSettings({ ...apiSettings, selectedTextModel: { connectionId: connection.id, modelId: model.id } })
                                setModelMenuOpen(false)
                              }}
                            >
                              <ModelBrandBadge name={model.name} />
                              <span><strong>{model.name}</strong></span>
                              {selectedTextModel?.connection.id === connection.id && selectedTextModel.model.id === model.id && <Check size={14} />}
                            </button>
                          </div>))}
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
                      onClick={() => enabledTextModels.length ? setModelMenuOpen((open) => !open) : openApiSettings()}
                    >
                      <ModelBrandBadge name={selectedTextModel?.model.name} />
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
                      title={activeTextGenerationRunning ? '正在生成' : '生成文本'}
                      disabled={activeTextGenerationRunning}
                      onClick={() => void generateFromActiveTextNode()}
                    >
                      {activeTextGenerationRunning ? <LoaderCircle size={17} className="is-spinning" /> : <ArrowUp size={17} strokeWidth={2.2} />}
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
          {textReferencePreview && (
            <motion.aside
              className="text-reference-hover-preview"
              style={{ left: Math.max(12, textReferencePreview.left), bottom: textReferencePreview.bottom }}
              initial={{ opacity: 0, y: 6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 4, scale: 0.98 }}
            >
              <strong>{textReferencePreview.name}</strong>
              <p>{textReferencePreview.text}</p>
              <span>@Text</span>
            </motion.aside>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(transferProgress || toastMessage) && (
            <motion.div
              className={`canvas-toast ${activeTextNode ? 'with-editor' : ''} ${transferProgress ? 'is-progress' : ''}`}
              role="status"
              initial={{ opacity: 0, y: 8, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 6, scale: 0.98 }}
            >
              <span className={`toast-dot ${transferProgress ? 'is-busy' : ''}`} />
              {transferProgress || toastMessage}
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <AnimatePresence>
        {outputHistoryOpen && (
          <motion.div className="output-history-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => {
            if (outputHistoryFilter === 'ops') lockOperatorView()
            setOutputHistoryOpen(false)
          }}>
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
                <div><History size={18} /><h2 id="output-history-title">输出历史</h2><span>共 {currentOutputHistory.length} 条</span></div>
                <div>
                  {currentOutputHistory.length > 0 && <button type="button" className="output-history-clear" onClick={() => { setOutputHistory((current) => current.filter((record) => record.projectId ? record.projectId !== activeProjectId : activeProjectId !== CURRENT_PROJECT_ID)); setExpandedOutputErrorId(null) }}>清空当前项目记录</button>}
                  <button type="button" aria-label="关闭输出历史" onClick={() => {
                    if (outputHistoryFilter === 'ops') lockOperatorView()
                    setOutputHistoryOpen(false)
                  }}><X size={18} /></button>
                </div>
              </header>
              <div className="output-history-toolbar">
                <div className="output-history-tabs">
                  {([
                    ['all', '全部'],
                    ['text', '文本'],
                    ['image', '图像'],
                    ['failed', `失败 ${outputFailureCount || ''}`],
                    ['ops', operatorUnlocked ? '运维日志' : '···'],
                  ] as Array<[typeof outputHistoryFilter, string]>).map(([value, label]) => (
                    <button
                      type="button"
                      key={value}
                      className={outputHistoryFilter === value ? 'is-active' : ''}
                      onClick={() => selectOutputHistoryFilter(value)}
                    >{label}</button>
                  ))}
                </div>
                <label className="output-history-search"><Search size={14} /><input className="allow-text-select" value={outputHistorySearch} placeholder={outputHistoryFilter === 'ops' ? '搜索任务 ID / 结果' : '搜索提示词、模型或错误'} onChange={(event) => setOutputHistorySearch(event.target.value)} /></label>
              </div>
              <div className="output-history-content">
                {outputHistoryFilter === 'ops' ? (
                  !operatorUnlocked ? (
                    <div className="operator-gate">
                      <Lock size={22} />
                      <strong>受限区域</strong>
                      <span>仅授权运维可查看任务请求与结果数据，用于画布未回写时的人工找回。</span>
                      <form
                        className="operator-gate-form"
                        onSubmit={(event) => {
                          event.preventDefault()
                          void submitOperatorGate()
                        }}
                      >
                        <input
                          className="allow-text-select"
                          type="password"
                          autoComplete="off"
                          spellCheck={false}
                          placeholder="通行凭证"
                          value={operatorPassDraft}
                          onChange={(event) => {
                            setOperatorPassDraft(event.target.value)
                            setOperatorGateError('')
                          }}
                        />
                        <button type="submit">进入</button>
                      </form>
                      {operatorGateError && <em>{operatorGateError}</em>}
                    </div>
                  ) : (
                    <>
                      <div className="operator-log-toolbar">
                        <span>本机运维日志 · {filteredOperatorLogs.length} 条（GRS AI / APIYI / GPTGod 等均可找回结果）</span>
                        <button
                          type="button"
                          onClick={() => {
                            lockOperatorView()
                            setOutputHistoryFilter('all')
                          }}
                        ><Unlock size={13} />退出运维</button>
                      </div>
                      {filteredOperatorLogs.length ? (
                        <div className="operator-log-table allow-text-select">
                          <div className="operator-log-head">
                            <span>任务 ID</span>
                            <span>服务商</span>
                            <span>模型</span>
                            <span>耗时</span>
                            <span>结果</span>
                            <span>提示词</span>
                            <span>操作</span>
                          </div>
                          {filteredOperatorLogs.map((log) => {
                            const resultUrls = (log.resultUrls?.length ? log.resultUrls : extractImageUrlsFromAdminResult(log.resultJson))
                              .filter(Boolean)
                            const expanded = expandedOperatorLogId === log.id
                            return (
                              <article key={log.id} className={`operator-log-row ${log.resultType === 'failed' ? 'is-failed' : ''}`}>
                                <code title={log.taskId || '—'}>{log.taskId || '—'}</code>
                                <span title={log.connectionName || log.provider}>{log.provider}</span>
                                <span>{log.modelName || log.model}</span>
                                <span>{Math.max(1, Math.round(log.durationMs / 1000))}s</span>
                                <em>{log.resultType === 'success' ? '成功' : '失败'}</em>
                                <p title={log.prompt}>{log.prompt}</p>
                                <div className="operator-log-actions">
                                  <button type="button" title="复制结果数据" onClick={() => void navigator.clipboard.writeText(log.resultJson)}><Copy size={12} />结果</button>
                                  <button type="button" title="复制请求参数" onClick={() => void navigator.clipboard.writeText(log.requestJson)}><Copy size={12} />请求</button>
                                  <button type="button" onClick={() => setExpandedOperatorLogId(expanded ? null : log.id)}>{expanded ? '收起' : '展开'}</button>
                                </div>
                                {expanded && (
                                  <div className="operator-log-detail">
                                    <div>
                                      <strong>请求参数 · {log.provider}{log.connectionName ? ` · ${log.connectionName}` : ''}</strong>
                                      <pre>{log.requestJson}</pre>
                                    </div>
                                    <div>
                                      <strong>结果数据</strong>
                                      <pre>{log.resultJson}</pre>
                                      {resultUrls.length > 0 && (
                                        <div className="operator-log-urls">
                                          <p className="operator-log-url-tip">结果图 URL 约 2 小时后失效（各服务商临时链均适用），请尽快下载或写回画布</p>
                                          {resultUrls.map((url) => (
                                            <div key={url} className="operator-log-url-row">
                                              <a href={url} target="_blank" rel="noreferrer">{url.startsWith('data:') ? `[内嵌图片 data URL · ${url.length} 字符]` : url}</a>
                                              <button type="button" title="复制图片 URL" onClick={() => void navigator.clipboard.writeText(url)}><Copy size={12} /></button>
                                            </div>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                              </article>
                            )
                          })}
                        </div>
                      ) : (
                        <div className="output-history-empty"><History size={30} /><strong>还没有运维日志</strong><span>任意服务商（GRS AI、APIYI、GPTGod 等）的图像/文本生成成功或失败后都会写入，便于管理员找回结果数据。</span></div>
                      )}
                    </>
                  )
                ) : filteredOutputHistory.length ? filteredOutputHistory.map((record) => {
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
                            {record.kind === 'image' && record.error.category === 'network' && (
                              <div className="output-recovery-actions">
                                <span>{record.recoveredCount ? `已找回 ${record.recoveredCount} 张` : '先到服务商任务/消费记录下载已生成图片'}</span>
                                <label>
                                  <Upload size={13} />导入找回图片
                                  <input
                                    type="file"
                                    accept="image/*"
                                    multiple
                                    onChange={(event) => {
                                      const files = Array.from(event.currentTarget.files ?? [])
                                      event.currentTarget.value = ''
                                      void recoverOutputImages(record, files)
                                    }}
                                  />
                                </label>
                              </div>
                            )}
                            <AnimatePresence>
                              {expandedOutputErrorId === record.id && (
                                <motion.div className="output-error-detail" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}>
                                  <div><code>{record.error.detail}</code><button type="button" title="复制详细错误" onClick={() => void navigator.clipboard.writeText(record.error!.detail).then(() => { internalNodePastePreferredRef.current = false })}><Copy size={13} /></button></div>
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
                  <div className="output-history-empty"><History size={30} /><strong>{currentOutputHistory.length ? '没有匹配的输出记录' : '当前项目暂时没有输出记录'}</strong><span>同一项目的所有画布会共享这里的生成记录。</span></div>
                )}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <PromptLibraryPanel
        open={promptLibraryOpen}
        onClose={() => setPromptLibraryOpen(false)}
        onUsePrompt={addPromptCaseNode}
        onAddImage={addPromptCaseImage}
      />

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
                <div className="library-page-control"><button disabled={assetLibraryPage <= 1} onClick={() => setAssetLibraryPage((page) => page - 1)}><ChevronLeft size={14} /></button><span>{assetLibraryPage} / {assetLibraryTotalPages}</span><button disabled={assetLibraryPage >= assetLibraryTotalPages} onClick={() => setAssetLibraryPage((page) => page + 1)}><ChevronRight size={14} /></button></div>
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
                                {previewUrl ? <img src={previewUrl} alt="" draggable={false} loading="lazy" decoding="async" /> : (
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
                <div><h2 id="generation-history-title">生成历史</h2><span>{currentGenerationHistory.length}</span></div>
                <div className="asset-library-size-control">
                  <span>缩略图</span><Minus size={14} />
                  <input type="range" min="96" max="190" step="2" value={historyThumbnailSize} aria-label="调整历史缩略图大小" onChange={(event) => setHistoryThumbnailSize(Number(event.target.value))} />
                  <Plus size={14} />
                  <button type="button" aria-label="关闭生成历史" onClick={() => setGenerationHistoryOpen(false)}><X size={17} /></button>
                </div>
              </header>
              <div className="asset-library-toolbar history-toolbar">
                <div className="asset-library-tabs"><button type="button" className="is-active">{projectName} · 全部画布</button></div>
                <label className="asset-library-search"><Search size={15} /><input value={generationHistorySearch} placeholder="搜索提示词、模型或文件名" onChange={(event) => setGenerationHistorySearch(event.target.value)} /></label>
                <div className="library-page-control"><button disabled={generationHistoryPage <= 1} onClick={() => setGenerationHistoryPage((page) => page - 1)}><ChevronLeft size={14} /></button><span>{generationHistoryPage} / {generationHistoryTotalPages}</span><button disabled={generationHistoryPage >= generationHistoryTotalPages} onClick={() => setGenerationHistoryPage((page) => page + 1)}><ChevronRight size={14} /></button></div>
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
                            <img
                              src={record.imageUrl}
                              alt={record.prompt}
                              draggable={false}
                              loading="lazy"
                              decoding="async"
                              onLoad={() => {
                                setBrokenHistoryIds((current) => current.includes(record.id) ? current.filter((id) => id !== record.id) : current)
                                ensureHistoryRecordArchived(record)
                              }}
                              onError={() => setBrokenHistoryIds((current) => current.includes(record.id) ? current : [...current, record.id])}
                            />
                            {brokenHistoryIds.includes(record.id) && (
                              <div className="history-image-broken" draggable={false} onClick={(event) => event.stopPropagation()}>
                                <Info size={16} />
                                <span>原图片链接已失效</span>
                                <label>
                                  <Upload size={12} />重新上传
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(event) => {
                                      const file = event.currentTarget.files?.[0]
                                      event.currentTarget.value = ''
                                      if (file) void repairGenerationHistoryImage(record, file)
                                    }}
                                  />
                                </label>
                              </div>
                            )}
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
                    if (deleteConfirm.kind === 'style-reference') {
                      setStylePresets((current) => current.map((preset) => preset.id === deleteConfirm.presetId
                        ? { ...preset, references: preset.references.filter((reference) => reference.id !== deleteConfirm.id) }
                        : preset))
                    }
                    if (deleteConfirm.kind === 'style-preset') {
                      setStylePresets((current) => current.filter((preset) => preset.id !== deleteConfirm.presetId))
                    }
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
        {createProjectOpen && (
          <motion.div className="create-project-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => !createProjectBusy && setCreateProjectOpen(false)}>
            <motion.form className="create-project-dialog" initial={{ opacity: 0, y: 14, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: .98 }} onClick={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); void confirmCreateProject() }}>
              <header><div><small>NEW PROJECT</small><h2>创建新项目</h2><p>设置项目名称和初始画布数量，创建完成后保留在当前页面。</p></div><button type="button" aria-label="关闭" disabled={createProjectBusy} onClick={() => setCreateProjectOpen(false)}><X size={18} /></button></header>
              <label className="create-project-name-field"><span>项目名称</span><input autoFocus maxLength={48} value={createProjectName} placeholder="输入项目名称" onChange={(event) => setCreateProjectName(event.target.value)} /></label>
              <div className="create-project-count-field"><div><span>初始画布</span><small>后续仍可在项目中继续添加</small></div><div className="create-project-stepper"><button type="button" disabled={createProjectCanvasCount <= 1 || createProjectBusy} onClick={() => setCreateProjectCanvasCount((count) => Math.max(1, count - 1))}><Minus size={15} /></button><strong>{createProjectCanvasCount}</strong><button type="button" disabled={createProjectCanvasCount >= 20 || createProjectBusy} onClick={() => setCreateProjectCanvasCount((count) => Math.min(20, count + 1))}><Plus size={15} /></button></div></div>
              <div className="create-project-presets"><span>快速选择</span><div>{[1, 2, 3, 5, 10].map((count) => <button type="button" key={count} className={createProjectCanvasCount === count ? 'is-active' : ''} onClick={() => setCreateProjectCanvasCount(count)}>{count} 张</button>)}</div></div>
              <footer><button type="button" disabled={createProjectBusy} onClick={() => setCreateProjectOpen(false)}>取消</button><button type="submit" className="create-project-confirm" disabled={!createProjectName.trim() || createProjectBusy}>{createProjectBusy ? <><LoaderCircle size={15} className="is-spinning" />正在创建</> : <><Plus size={15} />创建项目</>}</button></footer>
            </motion.form>
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
            onClick={() => {
              setProjectRename((current) => current?.source === 'modal' ? null : current)
              setProjectOpen(false)
            }}
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
                  <span>{workspaceProjects.length}</span>
                </div>
                <button className="project-close" aria-label="关闭项目窗口" onClick={() => {
                  setProjectRename((current) => current?.source === 'modal' ? null : current)
                  setProjectOpen(false)
                }}>
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
                <button
                  className="project-toolbar-icon"
                  aria-label="导入/导出"
                  title="导入/导出"
                  disabled={transferBusy}
                  onClick={() => openTransferDialog('workspace-append')}
                >
                  <ArrowUpDown size={16} />
                </button>
                <label className="card-scale-control project-card-scale" title="调整项目卡片大小"><Grid3X3 size={14} /><input type="range" min="0.8" max="1.35" step="0.05" value={projectCardScale} onChange={(event) => setProjectCardScale(Number(event.target.value))} /></label>
                <button className="project-select-all" disabled={!workspaceProjects.length} onClick={() => setSelectedProjectIds((current) => current.length === workspaceProjects.length ? [] : workspaceProjects.map((project) => project.id))}>
                  <Check size={15} />{selectedProjectIds.length === workspaceProjects.length && workspaceProjects.length ? '取消全选' : '全选'}
                </button>
                {selectedProjectIds.length > 0 && <button className="project-batch-delete" onClick={() => void removeProjects(selectedProjectIds)}><Trash2 size={15} />删除选中 ({selectedProjectIds.length})</button>}
                <button className="project-create-button" onClick={() => void createNewProject()}>
                  <Plus size={16} />
                  新建
                </button>
              </div>

              <div className="project-grid" style={{ '--project-card-width': `${Math.round(260 * projectCardScale)}px`, '--project-card-height': `${Math.round(205 * projectCardScale)}px` } as React.CSSProperties}>
                <button className="project-card project-new-card" onClick={() => void createNewProject()}>
                  <span className="project-new-icon"><Plus size={20} /></span>
                  <strong>新建项目</strong>
                </button>
                {filteredWorkspaceProjects.map((project) => {
                  const isCurrent = project.id === activeProjectId
                  const projectCanvases = isCurrent ? workspaceCanvases : []
                  const cover = latestProjectCoverById.get(project.id)
                  const isRenaming = projectRename?.id === project.id && projectRename.source === 'modal'
                  const isSelected = selectedProjectIds.includes(project.id)
                  return <div key={project.id} className={`project-card-wrap ${isCurrent ? 'is-current' : ''} ${isSelected ? 'is-selected' : ''}`}>
                    <button className="project-card-select" aria-label={`${isSelected ? '取消选择' : '选择'}项目 ${project.name}`} aria-pressed={isSelected} onClick={() => setSelectedProjectIds((current) => current.includes(project.id) ? current.filter((id) => id !== project.id) : [...current, project.id])}>{isSelected && <Check size={13} />}</button>
                    <button className={`project-card ${isCurrent ? 'is-current' : ''}`} onClick={() => {
                      if (isRenaming) return
                      void openWorkspaceCanvas(project.activeCanvasId, project.id).then(() => setProjectOpen(false)).catch(() => setToastMessage('项目打开失败'))
                    }}>
                      <div className={`project-preview ${cover ? 'has-cover' : ''}`}>
                        <span className="preview-node preview-node-one" />
                        <span className="preview-node preview-node-two" />
                        <span className="preview-edge" />
                        <span className="preview-node preview-node-three" />
                        {cover && <img className="project-cover-image" src={cover.imageUrl} alt={`${project.name} 最新生成图片`} onError={(event) => event.currentTarget.remove()} />}
                      </div>
                      <div className="project-card-meta">
                        <strong>{project.name}</strong>
                        {isCurrent && <span className="current-project-badge">当前</span>}
                        <small>{project.canvasIds.length} 张画布{isCurrent ? ` · ${projectCanvases.reduce((sum, canvas) => sum + (canvas.nodes as unknown[]).length, 0)} 个节点` : ''}</small>
                      </div>
                    </button>
                    {isRenaming ? <div className="project-card-rename-form" onPointerDown={(event) => event.stopPropagation()}>
                      <input
                        autoFocus
                        value={projectRename.draft}
                        maxLength={48}
                        aria-label={`编辑项目 ${project.name} 名称`}
                        onChange={(event) => setProjectRename({ ...projectRename, draft: event.target.value })}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter') void commitProjectRename(project.id, projectRename.draft)
                          if (event.key === 'Escape') {
                            event.stopPropagation()
                            setProjectRename(null)
                          }
                        }}
                      />
                      <button type="button" aria-label="确认项目名称" onClick={() => void commitProjectRename(project.id, projectRename.draft)}><Check size={13} /></button>
                      <button type="button" aria-label="取消项目重命名" onClick={() => setProjectRename(null)}><X size={13} /></button>
                    </div> : <>
                      <button className="project-card-rename" aria-label={`重命名项目 ${project.name}`} title="重命名项目" onClick={() => setProjectRename({ id: project.id, draft: project.name, source: 'modal' })}><Pencil size={13} /></button>
                      <button className="project-card-delete" aria-label={`删除项目 ${project.name}`} title="删除项目" onClick={() => void removeProject(project.id)}><Trash2 size={14} /></button>
                    </>}
                  </div>
                })}
                {!filteredWorkspaceProjects.length && (
                  <div className="project-empty-search">没有找到匹配的项目</div>
                )}
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <input ref={workspaceImportInputRef} className="image-file-input" type="file" accept=".json,.disy" aria-label="导入完整 Disy 项目" onChange={(event) => {
        const file = event.target.files?.[0]
        if (file) {
          void importWorkspaceFile(file).catch((error) => setToastMessage(error instanceof Error ? error.message : '项目导入失败'))
        }
        event.target.value = ''
      }} />

      <AnimatePresence>
        {transferOpen && (
          <motion.div
            className="transfer-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => !transferBusy && setTransferOpen(false)}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="transfer-dialog-title"
              className="transfer-modal"
              initial={{ opacity: 0, y: 14, scale: .985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: .985 }}
              onClick={(event) => event.stopPropagation()}
            >
              <header className="transfer-modal-header">
                <div>
                  <h2 id="transfer-dialog-title">导入 / 导出</h2>
                  <span>{transferScope === 'workspace-append' ? '导入会添加为独立项目，不会覆盖现有内容' : '项目内导入会替换当前项目，其他项目不受影响'}（不含 API Key）</span>
                </div>
                <button type="button" aria-label="关闭导入导出" disabled={transferBusy} onClick={() => setTransferOpen(false)}><X size={18} /></button>
              </header>

              <button
                type="button"
                className={`transfer-dropzone ${transferDropActive ? 'is-active' : ''}`}
                disabled={transferBusy}
                onClick={() => workspaceImportInputRef.current?.click()}
                onDragEnter={(event) => {
                  event.preventDefault()
                  setTransferDropActive(true)
                }}
                onDragOver={(event) => {
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'copy'
                  setTransferDropActive(true)
                }}
                onDragLeave={(event) => {
                  const related = event.relatedTarget
                  if (related instanceof globalThis.Node && event.currentTarget.contains(related)) return
                  setTransferDropActive(false)
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  setTransferDropActive(false)
                  const file = event.dataTransfer.files?.[0]
                  if (!file) return
                  void importWorkspaceFile(file).catch((error) => setToastMessage(error instanceof Error ? error.message : '项目导入失败'))
                }}
              >
                <Upload size={28} />
                <strong>{transferScope === 'workspace-append' ? '导入为独立项目' : '导入并替换当前项目'}</strong>
                <span>拖拽 `.disy` / `.json` 到此处，或点击选择文件</span>
                <em>{transferScope === 'workspace-append' ? '可重复导入同一个项目包，每次都会创建新的独立项目' : '当前项目为空时直接导入；有内容时会先询问备份，并在不备份时二次确认'}</em>
              </button>

              {hasImportBackup && <div className="transfer-export-card">
                <div>
                  <strong>恢复导入前版本</strong>
                  <span>本机保留了最近一次导入前的完整恢复点，可一键还原项目、画布、历史与图片</span>
                </div>
                <button
                  type="button"
                  className="transfer-export-button"
                  disabled={transferBusy}
                  onClick={() => void restoreLastImportBackup()}
                >
                  <History size={16} />
                  立即恢复
                </button>
              </div>}

              <div className="transfer-export-card">
                <div>
                  <strong>导出全部工作区</strong>
                  <span>包含全部项目、画布、历史、会话与资产库；适合完整备份或换机</span>
                </div>
                <button
                  type="button"
                  className="transfer-export-button"
                  disabled={transferBusy}
                  onClick={() => void exportWholeWorkspace({ scope: 'workspace' }).catch((error) => {
                    if (!transferProgress) setToastMessage(error instanceof Error ? error.message : '完整导出失败')
                  })}
                >
                  <Download size={16} />
                  导出全部
                </button>
              </div>

              <div className="transfer-export-card">
                <div>
                  <strong>仅导出当前项目</strong>
                  <span>包含“{projectName}”及其全部画布、历史、会话与共享资产资料</span>
                </div>
                <button
                  type="button"
                  className="transfer-export-button"
                  disabled={transferBusy}
                  onClick={() => void exportWholeWorkspace({ scope: 'project' }).catch((error) => {
                    if (!transferProgress) setToastMessage(error instanceof Error ? error.message : '当前项目导出失败')
                  })}
                >
                  <Download size={16} />
                  导出当前
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {apiOpen && (
          <motion.div
            className={`modal-backdrop ${projectHomeOpen ? 'project-home-api-backdrop' : ''}`}
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
                    const usable = isConnectionUsable(connection)
                    return (
                      <div
                        key={connection.id}
                        className={`api-connection-card ${editingConnectionId === connection.id ? 'is-active' : ''} ${usable ? '' : 'is-disabled'}`}
                      >
                        <button
                          type="button"
                          className="api-connection-main"
                          onClick={() => selectApiConnection(connection)}
                        >
                          <span className={`api-connection-dot ${usable && connection.apiKey ? 'is-online' : ''}`} />
                          <span><strong>{connection.name}</strong><small>{connection.models.length ? `${enabledCount}/${connection.models.length} 个模型已启用` : (connection.disconnected ? '已断开' : '尚未获取模型')}</small></span>
                        </button>
                        <button
                          type="button"
                          className={`api-connection-power ${usable ? 'is-on' : ''}`}
                          aria-label={usable ? `停用 ${connection.name}` : `启用 ${connection.name}`}
                          title={usable ? '点击停用该连接' : '点击启用该连接'}
                          onClick={() => toggleConnectionEnabled(connection.id)}
                        >
                          <Power size={13} />
                        </button>
                      </div>
                    )
                  })}
                  {!apiSettings.connections.length && <p>添加第一条连接后，再单独获取它的模型。</p>}
                </aside>

                <section className="api-connection-detail">
                  <div className="api-detail-title">
                    <div className="api-detail-heading"><strong>{editingConnectionId === 'new' ? '新建连接' : apiDraft.name || 'API 连接'}</strong><span>{editingConnectionId === 'new' ? '配置一个新的 OpenAI 兼容接口' : '编辑连接与启用模型'}</span></div>
                    {editingConnectionId !== 'new' && (
                      <div className="api-detail-actions">
                        {apiSettings.connections.find((connection) => connection.id === editingConnectionId)?.disconnected ? (
                          <>
                            <span className="api-connection-status is-offline"><i />已断开</span>
                            <button type="button" className="api-link-action is-reconnect" onClick={reconnectCurrentApiConnection}><PlugZap size={13} />重新连接</button>
                          </>
                        ) : (
                          <>
                            <span className="api-connection-status is-online"><i />已连接</span>
                            <button type="button" className="api-link-action is-disconnect" onClick={disconnectCurrentApiConnection}><Unplug size={13} />断开连接</button>
                          </>
                        )}
                        <button type="button" className="api-icon-button is-danger" title="删除连接" aria-label="删除连接" onClick={removeCurrentApiConnection}><Trash2 size={13} /></button>
                      </div>
                    )}
                  </div>

                  {editingConnectionId !== 'new' && apiSettings.connections.find((connection) => connection.id === editingConnectionId)?.disconnected && (
                    <div className="api-disconnected-banner">
                      <Unplug size={15} />
                      <span><strong>当前连接已断开</strong>节点中不会显示此连接的模型。API Key 与模型目录仍保留，点击右上角「重新连接」即可恢复。</span>
                    </div>
                  )}

                  {editingConnectionId === 'new' && <div className="api-provider-presets">
                    <div><strong>从常用厂商开始</strong><span>自动填写连接名称与接口地址</span></div>
                    <div>{API_PROVIDER_PRESETS.map((preset) => (
                      <button type="button" key={preset.id} className={apiDraft.baseUrl === preset.baseUrl ? 'is-active' : ''} onClick={() => applyApiProviderPreset(preset)}>
                        <b>{preset.name.slice(0, 2)}</b>
                        <span><strong>{preset.name}</strong><small>{preset.detail}</small></span>
                      </button>
                    ))}</div>
                  </div>}

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
                      <span className="api-key-input-wrap">
                        <input ref={apiKeyInputRef} value={apiDraft.apiKey} onChange={(event) => setApiDraft((draft) => ({ ...draft, apiKey: event.target.value }))} type={apiKeyVisible ? 'text' : 'password'} placeholder="sk-••••••••••••••••" autoComplete="off" />
                        <button type="button" className="api-key-visibility" aria-label={apiKeyVisible ? '隐藏 API Key' : '显示 API Key'} title={apiKeyVisible ? '隐藏 API Key' : '显示 API Key'} onClick={() => setApiKeyVisible((visible) => !visible)}>
                          {apiKeyVisible ? <EyeOff size={16} /> : <Eye size={16} />}
                        </button>
                      </span>
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

                  <footer className="api-manager-footer">
                    <span className="secure-note"><KeyRound size={14} />API Key 只保留在当前标签页会话</span>
                    <div className="modal-buttons">
                      {apiConfigured && <button className="clear-button" onClick={() => { clearApiSettings(); beginNewApiConnection() }}>清除全部</button>}
                      <button className="connect-button" onClick={() => void saveApi()}>保存当前连接 <ArrowUpRight size={15} /></button>
                    </div>
                  </footer>
                </section>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <AnimatePresence>
        {apiAlert && (
          <motion.div className="api-alert-backdrop" role="alertdialog" aria-modal="true" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setApiAlert(null)}>
            <motion.div className="api-alert-dialog" initial={{ y: 12, opacity: 0, scale: .98 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 12, opacity: 0, scale: .98 }} onClick={(event) => event.stopPropagation()}>
              <div className="api-alert-icon"><Info size={22} /></div>
              <div><strong>API 连接未通过</strong><p>{apiAlert}</p></div>
              <button type="button" onClick={() => setApiAlert(null)}>知道了</button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export default App
