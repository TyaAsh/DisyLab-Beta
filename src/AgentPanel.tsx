/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
import { Fragment, useEffect, useId, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent, type ReactNode } from 'react'
import { ArrowUp, Check, ChevronDown, Download, FileText, Focus, ImagePlus, ImageUp, KeyRound, LoaderCircle, Maximize2, MessageCircle, MousePointer2, Plus, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'
import { compactReferenceName, normalizeAgentMessageContent, type AgentContextReference, type AgentImagePlan, type AgentImageReference, type AgentMessage, type AgentTextPlan } from './agent'

export type AgentModelOption = { key: string; name: string; connectionName: string }
export type AgentConversationOption = { id: string; title: string; updatedAt: string }

const AGENT_PANEL_WIDTH_KEY = 'disylab.agent-panel-width'
const AGENT_PANEL_RESIZE_BREAKPOINT = 721
const AGENT_PANEL_DEFAULT_WIDTH = 420

function getAgentPanelMaxWidth() {
  return Math.min(window.innerWidth - 24, AGENT_PANEL_DEFAULT_WIDTH + Math.floor(window.innerWidth * .2))
}

function getInitialAgentPanelWidth() {
  const saved = Number(window.localStorage.getItem(AGENT_PANEL_WIDTH_KEY))
  if (window.innerWidth < AGENT_PANEL_RESIZE_BREAKPOINT) return AGENT_PANEL_DEFAULT_WIDTH
  const maximum = getAgentPanelMaxWidth()
  const preferred = Number.isFinite(saved) && saved > 0 ? saved : AGENT_PANEL_DEFAULT_WIDTH
  return Math.min(maximum, Math.max(AGENT_PANEL_DEFAULT_WIDTH, preferred))
}

type ModelBrand = 'openai' | 'gemini' | 'claude' | 'doubao' | 'jimeng' | 'google' | 'generic'
type SelectOption = { value: string; label: string; brand?: ModelBrand }

const brandMeta: Record<ModelBrand, { label: string; glyph: string; color: string; background: string }> = {
  openai: { label: 'OpenAI', glyph: '◎', color: '#e8f3ef', background: 'rgba(90, 145, 128, .2)' },
  gemini: { label: 'Gemini', glyph: '✦', color: '#9fc5ff', background: 'rgba(68, 119, 216, .2)' },
  claude: { label: 'Claude', glyph: 'C', color: '#e8b994', background: 'rgba(181, 102, 55, .2)' },
  doubao: { label: '豆包', glyph: '豆', color: '#a9b8ff', background: 'rgba(92, 104, 224, .2)' },
  jimeng: { label: '即梦', glyph: '即', color: '#f1a8dc', background: 'rgba(203, 72, 161, .2)' },
  google: { label: 'Google', glyph: 'G', color: '#9fcbff', background: 'rgba(65, 133, 221, .2)' },
  generic: { label: 'AI 模型', glyph: 'AI', color: '#b8c1cb', background: 'rgba(126, 139, 153, .16)' },
}

function getModelBrand(name: string): ModelBrand {
  const normalized = name.toLowerCase().replace(/[\s_-]+/g, '')
  if (/gpt|openai|dall|sora/.test(normalized)) return 'openai'
  if (/gemini/.test(normalized)) return 'gemini'
  if (/claude|anthropic/.test(normalized)) return 'claude'
  if (/即梦|jimeng|dreamina|seedream|seedance/.test(normalized)) return 'jimeng'
  if (/豆包|doubao/.test(normalized)) return 'doubao'
  if (/nanobanana|imagen|google/.test(normalized)) return 'google'
  return 'generic'
}

const brandMarkStyle: CSSProperties = {
  width: 20,
  height: 20,
  flex: '0 0 20px',
  borderRadius: 7,
  display: 'inline-grid',
  placeItems: 'center',
  fontSize: 8,
  fontWeight: 800,
  lineHeight: 1,
  letterSpacing: '-.02em',
}

function ModelBrandMark({ brand }: { brand: ModelBrand }) {
  const meta = brandMeta[brand]
  return (
    <span
      aria-hidden="true"
      title={meta.label}
      style={{ ...brandMarkStyle, color: meta.color, background: meta.background }}
    >
      {meta.glyph}
    </span>
  )
}

function AgentSelect({ ariaLabel, value, placeholder, options, icon, onChange, className = '' }: {
  ariaLabel: string
  value: string
  placeholder: string
  options: SelectOption[]
  icon: ReactNode
  onChange: (value: string) => void
  className?: string
}) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const menuId = useId()
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  useEffect(() => {
    if (!open) return
    const optionButtons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
    const selectedIndex = Math.max(0, options.findIndex((option) => option.value === value))
    window.requestAnimationFrame(() => optionButtons?.[selectedIndex]?.focus())
  }, [open, value])

  const moveOptionFocus = (direction: 1 | -1) => {
    const optionButtons = [...(menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]') ?? [])]
    if (!optionButtons.length) return
    const currentIndex = optionButtons.indexOf(document.activeElement as HTMLButtonElement)
    optionButtons[(currentIndex + direction + optionButtons.length) % optionButtons.length]?.focus()
  }

  const selectedBrand = selected?.brand

  return (
    <div ref={rootRef} className={`agent-custom-select ${className} ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="agent-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((current) => !current)}
        onKeyDown={(event) => {
          if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault()
            setOpen(true)
          }
        }}
      >
        <span className="agent-select-icon" style={{ width: 20, display: 'inline-grid', placeItems: 'center' }}>
          {selectedBrand ? <ModelBrandMark brand={selectedBrand} /> : icon}
        </span>
        <span className={`agent-select-value ${selected ? '' : 'is-placeholder'}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={14} className="agent-select-chevron" />
      </button>
      {open && (
        <div
          ref={menuRef}
          id={menuId}
          className="agent-select-menu"
          role="listbox"
          aria-label={`${ariaLabel}选项`}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              setOpen(false)
              rootRef.current?.querySelector<HTMLButtonElement>('.agent-select-trigger')?.focus()
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
              event.preventDefault()
              moveOptionFocus(event.key === 'ArrowDown' ? 1 : -1)
            } else if (event.key === 'Home' || event.key === 'End') {
              event.preventDefault()
              const optionButtons = menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="option"]')
              optionButtons?.[event.key === 'Home' ? 0 : optionButtons.length - 1]?.focus()
            }
          }}
        >
          {options.length ? options.map((option) => (
            <button
              type="button"
              role="option"
              aria-selected={option.value === value}
              className={option.value === value ? 'is-selected' : ''}
              key={option.value}
              onClick={() => {
                onChange(option.value)
                setOpen(false)
                window.requestAnimationFrame(() => rootRef.current?.querySelector<HTMLButtonElement>('.agent-select-trigger')?.focus())
              }}
            >
              <span style={{ minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 }}>
                {option.brand && <ModelBrandMark brand={option.brand} />}
                <strong style={{ minWidth: 0 }}>{option.label}</strong>
              </span>
              {option.value === value && <Check size={14} />}
            </button>
          )) : <p>暂无可用选项</p>}
        </div>
      )}
    </div>
  )
}

type Props = {
  messages: AgentMessage[]
  plans: AgentImagePlan[]
  textPlans: AgentTextPlan[]
  references: AgentImageReference[]
  pendingReferences: AgentImageReference[]
  candidates: AgentImageReference[]
  conversations: AgentConversationOption[]
  activeConversationId: string
  textModels: AgentModelOption[]
  imageModels: AgentModelOption[]
  aspectOptions: SelectOption[]
  resolutionOptions: SelectOption[]
  detailOptions: SelectOption[]
  textModelKey: string
  imageModelKey: string
  imageDefaults: { aspectRatio: string; resolution: string; detail: string; count: number }
  busy: boolean
  agentOnly: boolean
  onStop: () => void
  onClose: () => void
  onOpenApiSettings: () => void
  onDownloadImage: (url: string, fileName: string) => void
  onNewConversation: () => void
  onDeleteConversation: () => void
  onSelectConversation: (id: string) => void
  onTextModelChange: (key: string) => void
  onImageModelChange: (key: string) => void
  onImageDefaultsChange: (patch: Partial<{ aspectRatio: string; resolution: string; detail: string; count: number }>) => void
  onVideoUnavailable: () => void
  onReferencesChange: (references: AgentImageReference[]) => void
  onCreateUploadedReference: (reference: Omit<AgentImageReference, 'nodeId'>) => AgentImageReference
  onUploadNotice: (message: string) => void
  onPendingReferenceConsumed: () => void
  onPickFromCanvas: () => void
  onSend: (message: string, invocationText: string, references: AgentImageReference[]) => void
  onPlanChange: (id: string, patch: Partial<Pick<AgentImagePlan, 'prompt' | 'aspectRatio' | 'resolution' | 'detail' | 'count'>>) => void
  onSelectPlanOptions: (groupPlanIds: string[], selectedPlanIds: string[]) => void
  onConfirmPlan: (id: string) => void
  onCancelPlan: (id: string) => void
  onRemovePlanContextReference: (planId: string, nodeId: string) => void
  onTextPlanChange: (id: string, patch: Partial<Pick<AgentTextPlan, 'title' | 'content'>>) => void
  onConfirmTextPlan: (id: string) => void
  onCancelTextPlan: (id: string) => void
  onRemoveTextPlanContextReference: (planId: string, nodeId: string) => void
  onLocateCanvasNode: (nodeId: string) => void
}

export function AgentPanel(props: Props) {
  const [mentionOpen, setMentionOpen] = useState(false)
  const [activeReadyPlanId, setActiveReadyPlanId] = useState<string | null>(null)
  const [imageSettingsOpen, setImageSettingsOpen] = useState(false)
  const [mediaKind, setMediaKind] = useState<'choose' | 'image'>('choose')
  const [imageModelChosen, setImageModelChosen] = useState(false)
  const [panelWidth, setPanelWidth] = useState(getInitialAgentPanelWidth)
  const [panelResizing, setPanelResizing] = useState(false)
  const [referenceDropActive, setReferenceDropActive] = useState(false)
  const [previewResult, setPreviewResult] = useState<{ url: string; fileName: string } | null>(null)
  const previewCloseRef = useRef<HTMLButtonElement>(null)
  const previewDialogRef = useRef<HTMLDivElement>(null)
  const previewTriggerRef = useRef<HTMLButtonElement | null>(null)
  const editorRef = useRef<HTMLDivElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const pinnedToBottomRef = useRef(true)
  const savedRangeRef = useRef<Range | null>(null)
  const referenceRegistryRef = useRef(new Map<string, AgentImageReference>())
  const readyPlanIdsRef = useRef<string[]>([])
  const resizeStartRef = useRef({ pointerX: 0, width: AGENT_PANEL_DEFAULT_WIDTH })
  const readyPlans = props.plans.filter((plan) => plan.status === 'ready')
  const activeReadyPlan = readyPlans.find((plan) => plan.id === activeReadyPlanId) ?? readyPlans[readyPlans.length - 1]
  const imageSettingLabel = (options: SelectOption[], value: string) => options.find((option) => option.value === value)?.label ?? value
  const imageSettingsSummary = [
    imageSettingLabel(props.aspectOptions, props.imageDefaults.aspectRatio),
    imageSettingLabel(props.resolutionOptions, props.imageDefaults.resolution),
    imageSettingLabel(props.detailOptions, props.imageDefaults.detail),
    `${props.imageDefaults.count}张`,
  ].join(' · ')

  useEffect(() => {
    if (!previewResult) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setPreviewResult(null)
      if (event.key === 'Tab') {
        const buttons = [...(previewDialogRef.current?.querySelectorAll<HTMLButtonElement>('button') ?? [])]
        if (!buttons.length) return
        const currentIndex = buttons.indexOf(document.activeElement as HTMLButtonElement)
        const nextIndex = event.shiftKey
          ? (currentIndex <= 0 ? buttons.length - 1 : currentIndex - 1)
          : (currentIndex < 0 || currentIndex >= buttons.length - 1 ? 0 : currentIndex + 1)
        event.preventDefault()
        buttons[nextIndex]?.focus()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    window.requestAnimationFrame(() => previewCloseRef.current?.focus())
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      previewTriggerRef.current?.focus()
    }
  }, [previewResult])

  ;[...props.candidates, ...props.references].forEach((reference) => referenceRegistryRef.current.set(reference.nodeId, reference))

  const startPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (window.innerWidth < AGENT_PANEL_RESIZE_BREAKPOINT) return
    const panel = event.currentTarget.closest<HTMLElement>('.agent-panel')
    if (!panel) return
    resizeStartRef.current = { pointerX: event.clientX, width: panel.getBoundingClientRect().width }
    event.currentTarget.setPointerCapture(event.pointerId)
    document.body.style.cursor = 'ew-resize'
    document.body.style.userSelect = 'none'
    setPanelResizing(true)
  }
  const resizePanel = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panelResizing) return
    const maximum = getAgentPanelMaxWidth()
    const minimum = AGENT_PANEL_DEFAULT_WIDTH
    const nextWidth = resizeStartRef.current.width + resizeStartRef.current.pointerX - event.clientX
    setPanelWidth(Math.min(maximum, Math.max(minimum, Math.round(nextWidth))))
  }
  const finishPanelResize = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (!panelResizing) return
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
    document.body.style.cursor = ''
    document.body.style.userSelect = ''
    window.localStorage.setItem(AGENT_PANEL_WIDTH_KEY, String(panelWidth))
    setPanelResizing(false)
  }
  useEffect(() => {
    const clampPanelWidth = () => {
      if (window.innerWidth < AGENT_PANEL_RESIZE_BREAKPOINT) return
      const maximum = getAgentPanelMaxWidth()
      setPanelWidth((current) => Math.min(maximum, Math.max(AGENT_PANEL_DEFAULT_WIDTH, current)))
    }
    window.addEventListener('resize', clampPanelWidth)
    return () => {
      window.removeEventListener('resize', clampPanelWidth)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
  }, [])

  useEffect(() => {
    if (!props.imageModelKey) setImageSettingsOpen(false)
  }, [props.imageModelKey])

  useEffect(() => {
    const previousIds = readyPlanIdsRef.current
    const nextIds = readyPlans.map((plan) => plan.id)
    const newestAddedId = [...nextIds].reverse().find((id) => !previousIds.includes(id))
    readyPlanIdsRef.current = nextIds
    if (!readyPlans.length) {
      setActiveReadyPlanId(null)
      return
    }
    if (newestAddedId || !readyPlans.some((plan) => plan.id === activeReadyPlanId)) {
      setActiveReadyPlanId(newestAddedId ?? readyPlans[readyPlans.length - 1].id)
    }
  }, [activeReadyPlanId, props.plans])

  const getEditorText = () => {
    const editor = editorRef.current
    if (!editor) return ''
    const clone = editor.cloneNode(true) as HTMLElement
    clone.querySelectorAll<HTMLElement>('.agent-inline-reference').forEach((chip) => {
      const id = chip.dataset.referenceId
      const reference = id ? referenceRegistryRef.current.get(id) : undefined
      chip.replaceWith(document.createTextNode(reference ? ` @${reference.name} ` : ' '))
    })
    return clone.innerText
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/[\t\f\v ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  const getInvocationText = () => {
    const editor = editorRef.current
    if (!editor) return ''
    const clone = editor.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.agent-inline-reference').forEach((chip) => chip.replaceWith(document.createTextNode(' ')))
    return clone.innerText
      .replace(/\u00a0/g, ' ')
      .replace(/\r\n?/g, '\n')
      .replace(/[\t\f\v ]+/g, ' ')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }
  const rememberSelection = () => {
    const selection = window.getSelection()
    const editor = editorRef.current
    if (!selection || !selection.rangeCount || !editor?.contains(selection.anchorNode)) return
    savedRangeRef.current = selection.getRangeAt(0).cloneRange()
  }
  const hasTypedMentionTrigger = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount) return false
    const range = selection.getRangeAt(0)
    if (!editor.contains(range.endContainer)) return false
    const prefix = range.cloneRange()
    prefix.selectNodeContents(editor)
    prefix.setEnd(range.endContainer, range.endOffset)
    const holder = document.createElement('div')
    holder.append(prefix.cloneContents())
    holder.querySelectorAll('.agent-inline-reference').forEach((chip) => chip.replaceWith(document.createTextNode(' ')))
    const beforeCaret = holder.innerText.replace(/\u00a0/g, ' ')
    return /@[^\s@]*$/.test(beforeCaret)
  }
  const removeReferenceBeforeCaret = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount) return false
    const range = selection.getRangeAt(0)
    if (!range.collapsed || !editor.contains(range.startContainer)) return false

    let candidate: ChildNode | null = null
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.startContainer as Text
      const beforeCaret = textNode.data.slice(0, range.startOffset)
      if (beforeCaret.trim()) return false
      candidate = textNode.previousSibling
      if (beforeCaret) textNode.deleteData(0, range.startOffset)
    } else {
      candidate = range.startContainer.childNodes.item(range.startOffset - 1)
    }
    while (candidate?.nodeType === Node.TEXT_NODE && !(candidate.textContent ?? '').trim()) candidate = candidate.previousSibling
    const chip = candidate instanceof HTMLElement && candidate.matches('.agent-inline-reference') ? candidate : null
    if (!chip) return false

    const caret = document.createRange()
    caret.setStartBefore(chip)
    caret.collapse(true)
    chip.remove()
    selection.removeAllRanges()
    selection.addRange(caret)
    savedRangeRef.current = caret.cloneRange()
    syncReferencesFromEditor()
    setMentionOpen(false)
    return true
  }
  const hasReferenceAfterCaret = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount) return false
    const range = selection.getRangeAt(0)
    if (!range.collapsed || !editor.contains(range.startContainer)) return false

    let candidate: ChildNode | null = null
    if (range.startContainer.nodeType === Node.TEXT_NODE) {
      const textNode = range.startContainer as Text
      if (textNode.data.slice(range.startOffset).trim()) return false
      candidate = textNode.nextSibling
    } else {
      candidate = range.startContainer.childNodes.item(range.startOffset)
    }
    while (candidate?.nodeType === Node.TEXT_NODE && !(candidate.textContent ?? '').trim()) candidate = candidate.nextSibling
    return candidate instanceof HTMLElement && candidate.matches('.agent-inline-reference')
  }
  const selectionTouchesReference = () => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection?.rangeCount) return false
    const range = selection.getRangeAt(0)
    if (range.collapsed || !editor.contains(range.commonAncestorContainer)) return false
    return Array.from(editor.querySelectorAll('.agent-inline-reference')).some((chip) => range.intersectsNode(chip))
  }
  const restoreSelection = () => {
    const editor = editorRef.current
    editor?.focus()
    const selection = window.getSelection()
    if (!selection) return
    selection.removeAllRanges()
    if (savedRangeRef.current && editor?.contains(savedRangeRef.current.commonAncestorContainer)) {
      selection.addRange(savedRangeRef.current)
      return
    }
    const range = document.createRange()
    range.selectNodeContents(editor!)
    range.collapse(false)
    selection.addRange(range)
  }
  const insertPlainTextAtSelection = (text: string) => {
    const editor = editorRef.current
    const selection = window.getSelection()
    if (!editor || !selection) return

    const range = selection.rangeCount && editor.contains(selection.anchorNode)
      ? selection.getRangeAt(0)
      : (() => {
          const fallback = document.createRange()
          fallback.selectNodeContents(editor)
          fallback.collapse(false)
          return fallback
        })()

    range.deleteContents()
    const lines = text.replace(/\r\n?/g, '\n').split('\n')
    const fragment = document.createDocumentFragment()
    lines.forEach((line, index) => {
      if (index) fragment.append(document.createElement('br'))
      if (line) fragment.append(document.createTextNode(line))
    })
    if (!text) fragment.append(document.createTextNode(''))
    range.insertNode(fragment)
    range.collapse(false)
    selection.removeAllRanges()
    selection.addRange(range)
    savedRangeRef.current = range.cloneRange()
  }
  const createChip = (reference: AgentImageReference) => {
    const chip = document.createElement('span')
    chip.className = 'agent-inline-reference'
    chip.contentEditable = 'false'
    chip.dataset.referenceId = reference.nodeId
    const image = document.createElement('img')
    image.src = reference.url
    image.alt = ''
    const label = document.createElement('b')
    const existingIndex = props.references.findIndex((item) => item.nodeId === reference.nodeId)
    label.textContent = `图${existingIndex >= 0 ? existingIndex + 1 : props.references.length + 1} · ${compactReferenceName(reference.name)}`
    label.title = reference.name
    const remove = document.createElement('button')
    remove.type = 'button'
    remove.setAttribute('aria-label', '移除引用')
    remove.textContent = 'x'
    chip.append(image, label, remove)
    return chip
  }
  const clearMentionTrigger = () => {
    const selection = window.getSelection()
    if (!selection?.rangeCount) return
    const range = selection.getRangeAt(0)
    const textNode = range.startContainer
    if (textNode.nodeType !== Node.TEXT_NODE) return
    const value = textNode.textContent ?? ''
    const before = value.slice(0, range.startOffset)
    const match = before.match(/@[^\s@]*$/)
    if (!match) return
    textNode.textContent = `${value.slice(0, before.length - match[0].length)}${value.slice(range.startOffset)}`
    range.setStart(textNode, before.length - match[0].length)
    range.collapse(true)
    selection.removeAllRanges()
    selection.addRange(range)
  }
  const getEditorReferences = () => {
    const ids = Array.from(editorRef.current?.querySelectorAll<HTMLElement>('[data-reference-id]') ?? []).map((node) => node.dataset.referenceId).filter(Boolean) as string[]
    const seen = new Set<string>()
    return ids
      .filter((id) => {
        if (seen.has(id)) return false
        seen.add(id)
        return true
      })
      .map((id) => referenceRegistryRef.current.get(id))
      .filter((reference): reference is AgentImageReference => Boolean(reference))
  }
  const syncReferencesFromEditor = () => {
    props.onReferencesChange(getEditorReferences())
  }
  const addReference = (reference: AgentImageReference) => {
    referenceRegistryRef.current.set(reference.nodeId, reference)
    restoreSelection()
    clearMentionTrigger()
    const editorReferences = getEditorReferences()
    if (editorReferences.some((item) => item.nodeId === reference.nodeId)) {
      setMentionOpen(false)
      return
    }
    props.onReferencesChange([...editorReferences, reference])
    const selection = window.getSelection()
    if (selection?.rangeCount) {
      const range = selection.getRangeAt(0)
      range.deleteContents()
      range.insertNode(document.createTextNode(' '))
      range.insertNode(createChip(reference))
      range.insertNode(document.createTextNode(' '))
      range.collapse(false)
      selection.removeAllRanges()
      selection.addRange(range)
      savedRangeRef.current = range.cloneRange()
    }
    setMentionOpen(false)
  }
  const uploadReferences = async (files: File[]) => {
    const supported = files.filter((file) => ['image/png', 'image/jpeg', 'image/webp'].includes(file.type))
    const remaining = Math.max(0, 16 - props.references.length)
    if (!supported.length) {
      props.onUploadNotice('仅支持 PNG、JPG/JPEG 和 WebP 图片')
      return
    }
    if (!remaining) {
      props.onUploadNotice('参考图最多 16 张，请先移除部分图片')
      return
    }
    const seenUrls = new Set(props.references.map((reference) => reference.url))
    let added = 0
    let duplicates = 0
    for (const file of supported.slice(0, remaining)) {
      const url = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('图片读取失败'))
        reader.onerror = () => reject(reader.error ?? new Error('图片读取失败'))
        reader.readAsDataURL(file)
      }).catch(() => '')
      if (!url) continue
      if (seenUrls.has(url)) {
        duplicates += 1
        continue
      }
      seenUrls.add(url)
      addReference(props.onCreateUploadedReference({ name: file.name, url }))
      added += 1
    }
    const rejected = files.length - supported.length
    const overLimit = Math.max(0, supported.length - remaining)
    const notes = [rejected ? `${rejected} 个格式不支持` : '', duplicates ? `${duplicates} 张重复` : '', overLimit ? `${overLimit} 张超出上限` : ''].filter(Boolean)
    props.onUploadNotice(added ? `已添加 ${added} 张参考图${notes.length ? `，跳过${notes.join('、')}` : ''}` : `没有添加图片${notes.length ? `：${notes.join('、')}` : ''}`)
  }
  useEffect(() => {
    if (!props.pendingReferences.length) return
    props.pendingReferences.forEach(addReference)
    props.onPendingReferenceConsumed()
  }, [props.pendingReferences])
  useEffect(() => {
    const referenceNumberById = new Map(props.references.map((reference, index) => [reference.nodeId, index + 1]))
    editorRef.current?.querySelectorAll<HTMLElement>('.agent-inline-reference').forEach((chip) => {
      const reference = props.references.find((item) => item.nodeId === chip.dataset.referenceId)
      const number = reference ? referenceNumberById.get(reference.nodeId) : undefined
      const label = chip.querySelector('b')
      if (label && reference && number) {
        label.textContent = `图${number} · ${compactReferenceName(reference.name)}`
        label.title = reference.name
      }
    })
  }, [props.references])
  useEffect(() => {
    const container = messagesRef.current
    if (!container) return
    const update = () => {
      pinnedToBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 72
    }
    update()
    container.addEventListener('scroll', update, { passive: true })
    return () => {
      container.removeEventListener('scroll', update)
    }
  }, [])
  useEffect(() => {
    const container = messagesRef.current
    if (!container) return
    const frame = window.requestAnimationFrame(() => {
      container.scrollTop = container.scrollHeight
      pinnedToBottomRef.current = true
    })
    return () => window.cancelAnimationFrame(frame)
  }, [props.activeConversationId])
  useEffect(() => {
    const container = messagesRef.current
    if (!container || !pinnedToBottomRef.current) return
    const frame = window.requestAnimationFrame(() => container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' }))
    return () => window.cancelAnimationFrame(frame)
  }, [props.messages.length, props.plans.length, props.textPlans.length, props.busy])
  const submit = () => {
    const value = getEditorText()
    if (!value) return
    props.onSend(value, getInvocationText(), getEditorReferences())
    if (editorRef.current) editorRef.current.innerHTML = ''
    setMentionOpen(false)
  }
  const renderPlan = (plan: AgentImagePlan) => {
    const statusLabel = plan.status === 'ready' ? '待确认' : plan.status === 'running' ? '生成中' : plan.status === 'completed' ? '已完成' : plan.status === 'cancelled' ? '已取消' : '失败'
    const isCompact = plan.status === 'completed' || plan.status === 'cancelled' || Boolean(plan.results?.length)
    const disabled = plan.status !== 'ready'
    const displayedContextReferences: AgentContextReference[] = plan.contextReferences?.length
      ? plan.contextReferences
      : (plan.references ?? []).map((reference) => ({ ...reference, kind: 'image' as const }))
    if (isCompact) {
      if (plan.results?.length) {
        return (
          <section key={plan.id} className="agent-plan-card agent-result-card is-completed">
            <header><span><ImagePlus size={15} />{plan.status === 'completed' ? '图像已生成' : '已保留生成结果'}</span><em>{plan.results.length} 张</em></header>
            <div className={`agent-result-grid ${plan.results.length === 1 ? 'is-single' : ''}`}>
              {plan.results.map((result, index) => <figure key={result.id}>
                <button type="button" className="agent-result-preview" onClick={(event) => { previewTriggerRef.current = event.currentTarget; setPreviewResult(result) }} aria-label={`放大查看生成图片 ${index + 1}`}>
                  <img src={result.url} alt={`生成结果 ${index + 1}`} />
                  <span><Maximize2 size={15} />放大</span>
                </button>
                <button type="button" className="agent-result-download" onClick={() => props.onDownloadImage(result.url, result.fileName)}><Download size={14} />保存</button>
              </figure>)}
            </div>
            <footer className="agent-result-meta">
              <span>{plan.aspectRatio} · {plan.resolution}</span>
              {!props.agentOnly && plan.nodeId && <button type="button" onClick={() => props.onLocateCanvasNode(plan.nodeId!)}><Focus size={13} />定位画布</button>}
            </footer>
          </section>
        )
      }
      return (
        <button
          type="button"
          key={plan.id}
          className={`agent-plan-card is-${plan.status} is-collapsed`}
          disabled={!plan.nodeId}
          onClick={() => !props.agentOnly && plan.nodeId && props.onLocateCanvasNode(plan.nodeId)}
        >
          <span><ImagePlus size={15} /><strong>{plan.status === 'completed' ? '图像已生成' : '图像方案已取消'}</strong></span>
          <span className="agent-plan-collapsed-meta">{plan.aspectRatio} · {plan.resolution} · {plan.count} 张</span>
          {!props.agentOnly && plan.nodeId && <span className="agent-plan-locate"><Focus size={14} />定位画布</span>}
        </button>
      )
    }
    return (
      <section
        className={`agent-plan-card is-${plan.status} ${activeReadyPlan?.id === plan.id ? 'is-parameter-target' : ''}`}
        key={plan.id}
        onPointerDown={() => {
          if (plan.status === 'ready') setActiveReadyPlanId(plan.id)
        }}
        onFocusCapture={() => {
          if (plan.status === 'ready') setActiveReadyPlanId(plan.id)
        }}
      >
        <header><span><ImagePlus size={15} />图像生成确认</span><em>{statusLabel}</em></header>
        <textarea value={plan.prompt} disabled={disabled} onChange={(event) => props.onPlanChange(plan.id, { prompt: event.target.value })} aria-label="编辑图像方案提示词" />
        {!!displayedContextReferences.length && renderContextReferences(displayedContextReferences, (nodeId) => props.onRemovePlanContextReference(plan.id, nodeId))}
        {!!(plan.invokedStylePresets?.length || plan.invokedStyleReferences?.length) && <div className="agent-plan-invoked-styles">
          {(plan.invokedStylePresets?.length ? plan.invokedStylePresets : [{
            id: 'legacy-invoked-style',
            name: '风格设定',
            keyword: plan.styleInvocationWord || '',
            references: plan.invokedStyleReferences ?? [],
          }]).map((preset) => <div className="agent-plan-invoked-style" key={preset.id}>
            <span><Sparkles size={12} />{preset.name}{preset.keyword ? ` · ${preset.keyword}` : ''}</span>
            <div>{preset.references.map((reference) => <img src={reference.url} alt={reference.name} title={reference.name} key={reference.id} />)}</div>
          </div>)}
        </div>}
        {plan.error && <p className="agent-plan-error">{plan.error}</p>}
        {plan.status === 'ready' && <footer className="agent-plan-actions"><button type="button" className="agent-plan-cancel" onClick={() => props.onCancelPlan(plan.id)}>取消</button><button type="button" className="agent-plan-confirm" onClick={() => props.onConfirmPlan(plan.id)}><Check size={15} />确认生图</button></footer>}
      </section>
    )
  }
  const renderContextReferences = (references: AgentContextReference[], onRemove?: (nodeId: string) => void) => (
    <div className="agent-plan-context-references">
      <div className="agent-plan-context-heading"><span>关联素材</span>{references.some((reference) => reference.autoResolved) && <em><Sparkles size={11} />Agent 自动关联</em>}</div>
      <div>{references.map((reference, index) => <div className={`agent-plan-context-reference is-${reference.kind}`} key={`${reference.kind}-${reference.nodeId}`}>
        <button type="button" className="agent-context-locate" title={`${reference.name}${reference.resolutionReason ? ` · ${reference.resolutionReason}` : ''}`} onClick={() => props.onLocateCanvasNode(reference.nodeId)}>
          {reference.url ? <img src={reference.url} alt="" /> : <span className="agent-context-text-icon"><FileText size={14} /></span>}
          <span><strong>{reference.kind === 'image' ? `图${index + 1} · ` : ''}{compactReferenceName(reference.name, 14)}</strong>{reference.excerpt && <small>{reference.excerpt}</small>}{reference.autoResolved && <small>{reference.resolutionReason || '根据上下文自动关联'}</small>}</span>
          <Focus size={12} />
        </button>
        {onRemove && <button type="button" className="agent-context-remove" aria-label={`移除关联 ${reference.name}`} title="从本次确认卡移除" onClick={() => onRemove(reference.nodeId)}><X size={12} /></button>}
      </div>)}</div>
    </div>
  )
  const renderTextPlan = (plan: AgentTextPlan) => {
    if (plan.status !== 'ready') return <button type="button" key={plan.id} className={`agent-plan-card agent-text-plan-card is-${plan.status} is-collapsed`} disabled={!plan.nodeId} onClick={() => plan.nodeId && props.onLocateCanvasNode(plan.nodeId)}><span><FileText size={15} /><strong>{plan.status === 'completed' ? '文本已加入画布' : '文本方案已取消'}</strong></span>{plan.nodeId && <span className="agent-plan-locate"><Focus size={14} />定位画布</span>}</button>
    return <section className="agent-plan-card agent-text-plan-card is-ready" key={plan.id}>
      <header><span><FileText size={15} />文本生成确认</span><em>待确认</em></header>
      <input className="agent-text-plan-title" value={plan.title} onChange={(event) => props.onTextPlanChange(plan.id, { title: event.target.value })} aria-label="编辑文本标题" />
      <textarea value={plan.content} onChange={(event) => props.onTextPlanChange(plan.id, { content: event.target.value })} aria-label="编辑最终文本" />
      {!!plan.contextReferences?.length && renderContextReferences(plan.contextReferences, (nodeId) => props.onRemoveTextPlanContextReference(plan.id, nodeId))}
      <footer className="agent-plan-actions"><button type="button" className="agent-plan-cancel" onClick={() => props.onCancelTextPlan(plan.id)}>取消</button><button type="button" className="agent-plan-confirm" onClick={() => props.onConfirmTextPlan(plan.id)}><Check size={15} />确认并加入画布</button></footer>
    </section>
  }
  const renderDirectionChoices = (plans: AgentImagePlan[]) => {
    const selectablePlans = plans.filter((plan) => plan.status === 'proposed' || plan.status === 'ready')
    if (!selectablePlans.length) return null
    const planIds = selectablePlans.map((plan) => plan.id)
    const proposedIds = selectablePlans.filter((plan) => plan.status === 'proposed').map((plan) => plan.id)
    return (
      <section className="agent-plan-choice" key={`choice-${planIds.join('-')}`}>
        <header><span><Sparkles size={14} />选择创作方向</span><em>{selectablePlans.length} 个方案</em></header>
        <p>{proposedIds.length ? '选择你想继续的方向；已展开的方案会保留在下方，取消后可重新选择。' : '所有方向已展开为确认卡；你仍可取消任意一项后重新选择。'}</p>
        <div>
          {selectablePlans.map((plan, index) => {
            const isSelected = plan.status === 'ready'
            return <button
              type="button"
              key={plan.id}
              className={isSelected ? 'is-selected' : ''}
              disabled={isSelected}
              aria-label={isSelected ? `${plan.label || `方案${index + 1}`} 已选择，等待确认` : `选择 ${plan.label || `方案${index + 1}`}`}
              onClick={() => props.onSelectPlanOptions(planIds, [plan.id])}
            >
              <strong>{plan.label || `方案${index + 1}`}</strong>
              <span>{isSelected ? '已选择，等待确认；取消后可回到这里重新选择' : plan.prompt}</span>
            </button>
          })}
          {!!proposedIds.length && <button type="button" className="is-all" onClick={() => props.onSelectPlanOptions(planIds, planIds)}>
            <strong>全部方案</strong>
            <span>为全部 {planIds.length} 个方向分别创建确认卡</span>
          </button>
          }
        </div>
      </section>
    )
  }
  const messageIds = new Set(props.messages.map((message) => message.id))
  const plansByMessage = new Map<string, AgentImagePlan[]>()
  const textPlansByMessage = new Map<string, AgentTextPlan[]>()
  props.plans.forEach((plan) => {
    if (!plan.assistantMessageId || !messageIds.has(plan.assistantMessageId)) return
    plansByMessage.set(plan.assistantMessageId, [...(plansByMessage.get(plan.assistantMessageId) ?? []), plan])
  })
  props.textPlans.forEach((plan) => {
    if (!plan.assistantMessageId || !messageIds.has(plan.assistantMessageId)) return
    textPlansByMessage.set(plan.assistantMessageId, [...(textPlansByMessage.get(plan.assistantMessageId) ?? []), plan])
  })
  const orphanPlans = props.plans.filter((plan) => !plan.assistantMessageId || !messageIds.has(plan.assistantMessageId))
  const orphanTextPlans = props.textPlans.filter((plan) => !plan.assistantMessageId || !messageIds.has(plan.assistantMessageId))
  const renderAttachedPlans = (plans: AgentImagePlan[]) => (
    <>
      {renderDirectionChoices(plans)}
      {plans.filter((plan) => plan.status !== 'proposed' && plan.status !== 'ready').map(renderPlan)}
      {plans.filter((plan) => plan.status === 'ready').map(renderPlan)}
    </>
  )
  return (
    <aside id="disy-agent-panel" className={`agent-panel ${props.agentOnly ? 'is-agent-only' : ''} ${panelResizing ? 'is-resizing' : ''}`} style={{ '--agent-panel-width': `${panelWidth}px` } as CSSProperties} aria-label="Disy 对话 Agent">
      <div className="agent-panel-resize-handle" role="separator" aria-label="调整 Agent 面板宽度" aria-orientation="vertical" onPointerDown={startPanelResize} onPointerMove={resizePanel} onPointerUp={finishPanelResize} onPointerCancel={finishPanelResize}><span /></div>
      <header className="agent-panel-header">
        <div className="agent-panel-title"><img className="agent-panel-logo" src="/disy-logo.png" alt="" /><span><strong>Disy Agent</strong><small>和你一起构思，并在确认后生成</small></span></div>
        <div className="agent-panel-header-actions">
          {props.agentOnly && <button className="agent-panel-api" onClick={props.onOpenApiSettings} title="配置 API"><KeyRound size={16} /><span>API 配置</span></button>}
          {!props.agentOnly && <button className="agent-panel-close" onClick={props.onClose} title="关闭"><X size={17} /></button>}
        </div>
      </header>
      <div className="agent-conversation-row">
        <AgentSelect
          className="agent-conversation-select"
          ariaLabel="选择 Agent 对话"
          value={props.activeConversationId}
          placeholder="选择对话"
          options={props.conversations.map((conversation) => ({ value: conversation.id, label: conversation.title }))}
          icon={<MessageCircle size={14} />}
          onChange={props.onSelectConversation}
        />
        <button type="button" className="agent-new-chat-button" onClick={props.onNewConversation} title="新建对话"><Plus size={15} /></button>
        <button type="button" className="agent-delete-chat-button" onClick={props.onDeleteConversation} title="删除当前对话"><Trash2 size={15} /></button>
      </div>
      {previewResult && <div ref={previewDialogRef} className="agent-result-lightbox" role="dialog" aria-modal="true" aria-label="生成图片预览" onClick={() => setPreviewResult(null)}>
        <header onClick={(event) => event.stopPropagation()}>
          <button type="button" onClick={() => props.onDownloadImage(previewResult.url, previewResult.fileName)}><Download size={16} />保存图片</button>
          <button ref={previewCloseRef} type="button" onClick={() => setPreviewResult(null)} aria-label="关闭预览"><X size={18} /></button>
        </header>
        <img src={previewResult.url} alt="生成图片大图预览" onClick={(event) => event.stopPropagation()} />
      </div>}
      <div className="agent-panel-messages-wrap">
        <div className="agent-panel-messages" ref={messagesRef}>
          {!props.messages.length && <div className="agent-empty"><span><Sparkles size={19} /></span><strong>今天想创造什么？</strong><p>聊灵感、梳理画面，或让我准备一份可确认的图像方案。</p></div>}
          {props.messages.map((message) => <Fragment key={message.id}>
            <article className={`agent-message is-${message.role}`}>
              <p>{message.role === 'assistant' ? normalizeAgentMessageContent(message.content) : message.content}</p>
              {!!message.references?.length && <div className="agent-message-references">{message.references.map((reference, index) => <button type="button" key={reference.nodeId} onClick={() => props.onLocateCanvasNode(reference.nodeId)} title={`${reference.name} · 定位到画布节点`}><img src={reference.url} alt="" /><span>图{index + 1} · {compactReferenceName(reference.name)}</span><Focus size={12} /></button>)}</div>}
              {message.textNode?.nodeId && <button type="button" className="agent-message-to-canvas" onClick={() => props.onLocateCanvasNode(message.textNode!.nodeId!)}><Focus size={13} />查看整合文本节点</button>}
            </article>
            {renderAttachedPlans(plansByMessage.get(message.id) ?? [])}
            {(textPlansByMessage.get(message.id) ?? []).map(renderTextPlan)}
          </Fragment>)}
          {props.busy && <div className="agent-thinking"><LoaderCircle size={14} className="is-spinning" /><span>正在理解你的创作目标...</span></div>}
          {renderAttachedPlans(orphanPlans)}
          {orphanTextPlans.map(renderTextPlan)}
        </div>
      </div>
      <div className="agent-panel-composer">
        <div
          className={`agent-composer-box reference-drop-zone ${referenceDropActive ? 'is-drop-active' : ''}`}
          onDragEnter={(event) => {
            if (!Array.from(event.dataTransfer.items).some((item) => item.kind === 'file')) return
            event.preventDefault()
            event.stopPropagation()
            setReferenceDropActive(true)
          }}
          onDragOver={(event) => {
            if (!Array.from(event.dataTransfer.items).some((item) => item.kind === 'file')) return
            event.preventDefault()
            event.stopPropagation()
            event.dataTransfer.dropEffect = 'copy'
            setReferenceDropActive(true)
          }}
          onDragLeave={(event) => {
            if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setReferenceDropActive(false)
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            setReferenceDropActive(false)
            const files = Array.from(event.dataTransfer.files)
            if (files.length) void uploadReferences(files)
          }}
        >
          <span className="reference-drop-hint"><ImageUp size={15} />松开以添加参考图</span>
          <div
            className="agent-composer-input"
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            data-placeholder="和 Disy 对话，输入 @ 引用画布图片，或上传参考图"
            onInput={() => {
              rememberSelection()
              setMentionOpen(hasTypedMentionTrigger())
              syncReferencesFromEditor()
            }}
            onPaste={(event) => {
              event.preventDefault()
              const plainText = event.clipboardData.getData('text/plain')
              insertPlainTextAtSelection(plainText)
              setMentionOpen(hasTypedMentionTrigger())
              syncReferencesFromEditor()
            }}
            onKeyUp={rememberSelection}
            onMouseUp={rememberSelection}
            onBlur={() => {
              rememberSelection()
              setMentionOpen(false)
            }}
            onClick={(event) => {
              const target = event.target
              if (target instanceof HTMLButtonElement) {
                target.closest('.agent-inline-reference')?.remove()
                syncReferencesFromEditor()
              }
            }}
            onKeyDown={(event) => {
              if (event.key === 'Backspace' && !event.nativeEvent.isComposing && removeReferenceBeforeCaret()) {
                event.preventDefault()
                return
              }
              if (event.key === 'Delete' && (hasReferenceAfterCaret() || selectionTouchesReference())) {
                event.preventDefault()
                return
              }
              if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                event.preventDefault()
                submit()
              }
            }}
          />
          {mentionOpen && <div className="agent-mention-menu">{props.candidates.map((reference) => <button key={reference.nodeId} onMouseDown={(event) => event.preventDefault()} onClick={() => addReference(reference)}><img src={reference.url} alt="" /><span>{reference.name}</span></button>)}{!props.candidates.length && <p>画布上还没有可引用的图片</p>}</div>}
          <div className="agent-composer-models">
            <AgentSelect
              className="agent-model-select"
              ariaLabel="对话模型"
              value={props.textModelKey}
              placeholder="选择对话模型"
              options={props.textModels.map((model) => ({ value: model.key, label: model.name, brand: getModelBrand(model.name) }))}
              icon={<MessageCircle size={14} />}
              onChange={props.onTextModelChange}
            />
            {mediaKind === 'choose' ? <AgentSelect
              className="agent-model-select"
              ariaLabel="选择生成类型"
              value=""
              placeholder="请选择"
              options={[{ value: 'image', label: '图像' }, { value: 'video', label: '视频（暂未开放）' }]}
              icon={<Plus size={14} />}
              onChange={(value) => {
                if (value === 'video') {
                  props.onVideoUnavailable()
                  return
                }
                props.onImageModelChange('')
                setImageModelChosen(false)
                setMediaKind('image')
              }}
            /> : <AgentSelect
              className="agent-model-select"
              ariaLabel="生图模型"
              value={imageModelChosen ? props.imageModelKey : ''}
              placeholder="选择生图模型"
              options={[
                { value: '__choose_type__', label: '返回生成类型' },
                ...props.imageModels.map((model) => ({ value: model.key, label: model.name, brand: getModelBrand(model.name) })),
              ]}
              icon={<ImagePlus size={14} />}
              onChange={(value) => {
                if (value === '__choose_type__') {
                  setMediaKind('choose')
                  setImageModelChosen(false)
                  setImageSettingsOpen(false)
                  return
                }
                props.onImageModelChange(value)
                setImageModelChosen(true)
              }}
            />}
          </div>
          <footer className="agent-composer-footer">
            <div className="agent-composer-reference-bar">
              {!props.agentOnly && <button type="button" onMouseDown={rememberSelection} onClick={props.onPickFromCanvas} title="从画布选择参考图" aria-label="从画布选择参考图"><MousePointer2 size={15} /><span>画布选图</span></button>}
              <button type="button" onMouseDown={rememberSelection} onClick={() => uploadInputRef.current?.click()} title="从本地上传参考图" aria-label="从本地上传参考图"><ImageUp size={15} /><span>上传参考图</span></button>
              {mediaKind === 'image' && imageModelChosen && props.imageModelKey && <button type="button" className={`agent-image-settings-button ${imageSettingsOpen ? 'is-open' : ''}`} onClick={() => setImageSettingsOpen((open) => !open)} title={`图像设置：${imageSettingsSummary}`} aria-label={`图像设置，当前参数：${imageSettingsSummary}`} aria-expanded={imageSettingsOpen}><SlidersHorizontal size={15} /><span>图像设置</span><em>{imageSettingsSummary}</em></button>}
              <input ref={uploadInputRef} className="agent-reference-upload-input" type="file" accept="image/png,image/jpeg,image/webp" multiple aria-label="上传 Agent 参考图" onChange={(event) => { const files = Array.from(event.target.files ?? []); if (files.length) void uploadReferences(files); event.target.value = '' }} />
            </div>
            <div className="agent-composer-actions">
              {props.busy && <button type="button" className="agent-stop-button" onClick={props.onStop} title="中止本次对话" aria-label="中止本次对话"><X size={16} /></button>}
              <button type="button" className="agent-send-button" onClick={submit} title={props.busy ? '发送并调整方向' : '发送'} aria-label={props.busy ? '发送并调整方向' : '发送'}><ArrowUp size={17} /></button>
            </div>
          </footer>
          {imageSettingsOpen && mediaKind === 'image' && imageModelChosen && props.imageModelKey && <div className="agent-image-parameter-popover" role="dialog" aria-label="图像参数">
            <header><strong>图像参数</strong><button type="button" className="agent-parameter-close" onClick={() => setImageSettingsOpen(false)} title="关闭图像参数" aria-label="关闭图像参数"><X size={16} strokeWidth={1.8} /></button></header>
            <div className="agent-image-parameter-section"><span>画质</span><div>{props.detailOptions.map((option) => <button type="button" className={props.imageDefaults.detail === option.value ? 'is-selected' : ''} key={option.value} onClick={() => props.onImageDefaultsChange({ detail: option.value })}>{option.label}</button>)}</div></div>
            <div className="agent-image-parameter-section"><span>清晰度</span><div>{props.resolutionOptions.map((option) => <button type="button" className={props.imageDefaults.resolution === option.value ? 'is-selected' : ''} key={option.value} onClick={() => props.onImageDefaultsChange({ resolution: option.value })}>{option.label}</button>)}</div></div>
            <div className="agent-image-parameter-section is-aspect"><span>比例</span><div>{props.aspectOptions.map((option) => <button type="button" data-aspect={option.value} className={props.imageDefaults.aspectRatio === option.value ? 'is-selected' : ''} key={option.value} onClick={() => props.onImageDefaultsChange({ aspectRatio: option.value })}><i aria-hidden="true" />{option.label}</button>)}</div></div>
            <div className="agent-image-parameter-section"><span>数量</span><div>{[1, 2, 3, 4].map((count) => <button type="button" className={props.imageDefaults.count === count ? 'is-selected' : ''} key={count} onClick={() => props.onImageDefaultsChange({ count })}>{count} 张</button>)}</div></div>
          </div>}
        </div>
      </div>
    </aside>
  )
}
