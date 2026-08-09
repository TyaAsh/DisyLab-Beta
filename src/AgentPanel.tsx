import { Fragment, useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowUp, Check, ChevronDown, ChevronsUp, Focus, ImagePlus, ImageUp, LoaderCircle, MessageCircle, MousePointer2, Plus, SlidersHorizontal, Sparkles, Trash2, X } from 'lucide-react'
import type { AgentImagePlan, AgentImageReference, AgentMessage } from './agent'

export type AgentModelOption = { key: string; name: string; connectionName: string }
export type AgentConversationOption = { id: string; title: string; updatedAt: string }

type SelectOption = { value: string; label: string; detail?: string }

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
  const selected = options.find((option) => option.value === value)

  useEffect(() => {
    if (!open) return
    const close = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  return (
    <div ref={rootRef} className={`agent-custom-select ${className} ${open ? 'is-open' : ''}`}>
      <button
        type="button"
        className="agent-select-trigger"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((current) => !current)}
      >
        <span className="agent-select-icon">{icon}</span>
        <span className={`agent-select-value ${selected ? '' : 'is-placeholder'}`}>{selected?.label ?? placeholder}</span>
        <ChevronDown size={14} className="agent-select-chevron" />
      </button>
      {open && (
        <div className="agent-select-menu" role="listbox" aria-label={`${ariaLabel}选项`}>
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
              }}
            >
              <span><strong>{option.label}</strong>{option.detail && <small>{option.detail}</small>}</span>
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
  references: AgentImageReference[]
  pendingReference: AgentImageReference | null
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
  busy: boolean
  onClose: () => void
  onNewConversation: () => void
  onDeleteConversation: () => void
  onSelectConversation: (id: string) => void
  onTextModelChange: (key: string) => void
  onImageModelChange: (key: string) => void
  onReferencesChange: (references: AgentImageReference[]) => void
  onCreateUploadedReference: (reference: Omit<AgentImageReference, 'nodeId'>) => AgentImageReference
  onPendingReferenceConsumed: () => void
  onPickFromCanvas: () => void
  onSend: (message: string, invocationText: string) => void
  onPlanChange: (id: string, patch: Partial<Pick<AgentImagePlan, 'prompt' | 'aspectRatio' | 'resolution' | 'detail' | 'count'>>) => void
  onConfirmPlan: (id: string) => void
  onCancelPlan: (id: string) => void
  onLocateCanvasNode: (nodeId: string) => void
}

export function AgentPanel(props: Props) {
  const [mentionOpen, setMentionOpen] = useState(false)
  const [offscreenReadyIds, setOffscreenReadyIds] = useState<string[]>([])
  const [highlightPlanId, setHighlightPlanId] = useState<string | null>(null)
  const [activeReadyPlanId, setActiveReadyPlanId] = useState<string | null>(null)
  const [parametersOpen, setParametersOpen] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const uploadInputRef = useRef<HTMLInputElement>(null)
  const messagesRef = useRef<HTMLDivElement>(null)
  const planRefs = useRef(new Map<string, HTMLElement>())
  const pinnedToBottomRef = useRef(true)
  const highlightTimerRef = useRef<number | null>(null)
  const savedRangeRef = useRef<Range | null>(null)
  const parameterToolRef = useRef<HTMLDivElement>(null)
  const readyPlanIdsRef = useRef<string[]>([])
  const readyPlans = props.plans.filter((plan) => plan.status === 'ready')
  const activeReadyPlan = readyPlans.find((plan) => plan.id === activeReadyPlanId) ?? readyPlans[readyPlans.length - 1]

  useEffect(() => {
    const previousIds = readyPlanIdsRef.current
    const nextIds = readyPlans.map((plan) => plan.id)
    const newestAddedId = [...nextIds].reverse().find((id) => !previousIds.includes(id))
    readyPlanIdsRef.current = nextIds
    if (!readyPlans.length) {
      setActiveReadyPlanId(null)
      setParametersOpen(false)
      return
    }
    if (newestAddedId || !readyPlans.some((plan) => plan.id === activeReadyPlanId)) {
      setActiveReadyPlanId(newestAddedId ?? readyPlans[readyPlans.length - 1].id)
    }
  }, [activeReadyPlanId, props.plans])
  useEffect(() => {
    if (!parametersOpen) return
    const closeOnOutside = (event: PointerEvent) => {
      if (!parameterToolRef.current?.contains(event.target as Node)) setParametersOpen(false)
    }
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setParametersOpen(false)
    }
    document.addEventListener('pointerdown', closeOnOutside)
    window.addEventListener('keydown', closeOnEscape)
    return () => {
      document.removeEventListener('pointerdown', closeOnOutside)
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [parametersOpen])

  const getEditorText = () => {
    const editor = editorRef.current
    if (!editor) return ''
    const clone = editor.cloneNode(true) as HTMLElement
    clone.querySelectorAll<HTMLElement>('.agent-inline-reference').forEach((chip) => {
      const id = chip.dataset.referenceId
      const reference = props.references.find((item) => item.nodeId === id)
      chip.replaceWith(document.createTextNode(reference ? ` @${reference.name} ` : ' '))
    })
    return clone.innerText.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const getInvocationText = () => {
    const editor = editorRef.current
    if (!editor) return ''
    const clone = editor.cloneNode(true) as HTMLElement
    clone.querySelectorAll('.agent-inline-reference').forEach((chip) => chip.replaceWith(document.createTextNode(' ')))
    return clone.innerText.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim()
  }
  const rememberSelection = () => {
    const selection = window.getSelection()
    const editor = editorRef.current
    if (!selection || !selection.rangeCount || !editor?.contains(selection.anchorNode)) return
    savedRangeRef.current = selection.getRangeAt(0).cloneRange()
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
  const createChip = (reference: AgentImageReference) => {
    const chip = document.createElement('span')
    chip.className = 'agent-inline-reference'
    chip.contentEditable = 'false'
    chip.dataset.referenceId = reference.nodeId
    const image = document.createElement('img')
    image.src = reference.url
    image.alt = ''
    const label = document.createElement('b')
    label.textContent = reference.name
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
  const syncReferencesFromEditor = () => {
    const ids = Array.from(editorRef.current?.querySelectorAll<HTMLElement>('[data-reference-id]') ?? []).map((node) => node.dataset.referenceId).filter(Boolean) as string[]
    props.onReferencesChange(props.references.filter((reference) => ids.includes(reference.nodeId)))
  }
  const addReference = (reference: AgentImageReference) => {
    restoreSelection()
    clearMentionTrigger()
    if (!props.references.some((item) => item.nodeId === reference.nodeId)) {
      props.onReferencesChange([...props.references, reference])
    }
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
  const uploadReference = (file: File) => {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result !== 'string') return
      addReference(props.onCreateUploadedReference({
        name: file.name,
        url: reader.result,
      }))
    }
    reader.readAsDataURL(file)
  }
  useEffect(() => {
    if (!props.pendingReference) return
    addReference(props.pendingReference)
    props.onPendingReferenceConsumed()
  }, [props.pendingReference])
  useEffect(() => {
    const container = messagesRef.current
    if (!container) return
    const update = () => {
      pinnedToBottomRef.current = container.scrollHeight - container.scrollTop - container.clientHeight < 72
      const bounds = container.getBoundingClientRect()
      const hidden = props.plans
        .filter((plan) => plan.status === 'ready')
        .filter((plan) => {
          const element = planRefs.current.get(plan.id)
          if (!element) return true
          const rect = element.getBoundingClientRect()
          return rect.bottom <= bounds.top + 6 || rect.top >= bounds.bottom - 6
        })
        .map((plan) => plan.id)
      setOffscreenReadyIds((current) => current.length === hidden.length && current.every((id, index) => id === hidden[index]) ? current : hidden)
    }
    const frame = window.requestAnimationFrame(update)
    const observer = new ResizeObserver(update)
    observer.observe(container)
    planRefs.current.forEach((element) => observer.observe(element))
    container.addEventListener('scroll', update, { passive: true })
    window.addEventListener('resize', update)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      container.removeEventListener('scroll', update)
      window.removeEventListener('resize', update)
    }
  }, [props.messages, props.plans])
  useEffect(() => {
    const container = messagesRef.current
    if (!container || !pinnedToBottomRef.current) return
    const frame = window.requestAnimationFrame(() => container.scrollTo({ top: container.scrollHeight, behavior: 'smooth' }))
    return () => window.cancelAnimationFrame(frame)
  }, [props.messages.length, props.plans.length, props.busy])
  useEffect(() => () => {
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current)
  }, [])
  const locatePendingPlan = () => {
    const planId = offscreenReadyIds[0]
    if (!planId) return
    setActiveReadyPlanId(planId)
    planRefs.current.get(planId)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
    setHighlightPlanId(planId)
    if (highlightTimerRef.current !== null) window.clearTimeout(highlightTimerRef.current)
    highlightTimerRef.current = window.setTimeout(() => setHighlightPlanId(null), 1800)
  }
  const submit = () => {
    const value = getEditorText()
    if (!value || props.busy) return
    props.onSend(value, getInvocationText())
    if (editorRef.current) editorRef.current.innerHTML = ''
    setMentionOpen(false)
  }
  const setPlanRef = (planId: string, element: HTMLElement | null) => {
    if (element) planRefs.current.set(planId, element)
    else planRefs.current.delete(planId)
  }
  const renderPlan = (plan: AgentImagePlan) => {
    const statusLabel = plan.status === 'ready' ? '待确认' : plan.status === 'running' ? '生成中' : plan.status === 'completed' ? '已完成' : plan.status === 'cancelled' ? '已取消' : '失败'
    const isCompact = plan.status === 'completed' || plan.status === 'cancelled'
    const disabled = plan.status !== 'ready'
    if (isCompact) {
      return (
        <button
          type="button"
          ref={(element) => setPlanRef(plan.id, element)}
          key={plan.id}
          className={`agent-plan-card is-${plan.status} is-collapsed ${highlightPlanId === plan.id ? 'is-locate-highlight' : ''}`}
          disabled={!plan.nodeId}
          onClick={() => plan.nodeId && props.onLocateCanvasNode(plan.nodeId)}
        >
          <span><ImagePlus size={15} /><strong>{plan.status === 'completed' ? '图像已生成' : '图像方案已取消'}</strong></span>
          <span className="agent-plan-collapsed-meta">{plan.aspectRatio} · {plan.resolution} · {plan.count} 张</span>
          {plan.nodeId && <span className="agent-plan-locate"><Focus size={14} />定位画布</span>}
        </button>
      )
    }
    return (
      <section
        ref={(element) => setPlanRef(plan.id, element)}
        className={`agent-plan-card is-${plan.status} ${activeReadyPlan?.id === plan.id ? 'is-parameter-target' : ''} ${highlightPlanId === plan.id ? 'is-locate-highlight' : ''}`}
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
        <div className="agent-plan-summary"><SlidersHorizontal size={12} />{plan.aspectRatio} · {plan.resolution} · {props.detailOptions.find((option) => option.value === plan.detail)?.label ?? plan.detail} · {plan.count} 张</div>
        {!!plan.referenceNodeIds.length && <div className="agent-plan-references">{plan.referenceNodeIds.map((nodeId) => {
          const reference = plan.references?.find((item) => item.nodeId === nodeId) || props.candidates.find((item) => item.nodeId === nodeId) || props.references.find((item) => item.nodeId === nodeId)
          return reference ? <button type="button" className="agent-plan-reference" key={nodeId} onClick={() => props.onLocateCanvasNode(reference.nodeId)}><img src={reference.url} alt="" /><span>{reference.name}</span><Focus size={12} /></button> : null
        })}</div>}
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
  const messageIds = new Set(props.messages.map((message) => message.id))
  const plansByMessage = new Map<string, AgentImagePlan[]>()
  props.plans.forEach((plan) => {
    if (!plan.assistantMessageId || !messageIds.has(plan.assistantMessageId)) return
    plansByMessage.set(plan.assistantMessageId, [...(plansByMessage.get(plan.assistantMessageId) ?? []), plan])
  })
  const orphanPlans = props.plans.filter((plan) => !plan.assistantMessageId || !messageIds.has(plan.assistantMessageId))
  return (
    <aside id="disy-agent-panel" className="agent-panel" aria-label="Disy 对话 Agent">
      <header className="agent-panel-header">
        <div className="agent-panel-title"><img className="agent-panel-logo" src="/disy-logo.png" alt="" /><span><strong>Disy Agent</strong><small>和你一起构思，并在确认后生成</small></span></div>
        <button className="agent-panel-close" onClick={props.onClose} title="关闭"><X size={17} /></button>
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
      <div className="agent-panel-messages-wrap">
        <div className="agent-panel-messages" ref={messagesRef}>
          {!props.messages.length && <div className="agent-empty"><span><Sparkles size={19} /></span><strong>今天想创造什么？</strong><p>聊灵感、梳理画面，或让我准备一份可确认的图像方案。</p></div>}
          {props.messages.map((message) => <Fragment key={message.id}>
            <article className={`agent-message is-${message.role}`}>
              <p>{message.content}</p>
              {!!message.references?.length && <div className="agent-message-references">{message.references.map((reference) => <button type="button" key={reference.nodeId} onClick={() => props.onLocateCanvasNode(reference.nodeId)} title="定位到画布节点"><img src={reference.url} alt="" /><span>{reference.name}</span><Focus size={12} /></button>)}</div>}
            </article>
            {(plansByMessage.get(message.id) ?? []).map(renderPlan)}
          </Fragment>)}
          {props.busy && <div className="agent-thinking"><LoaderCircle size={14} className="is-spinning" /> 正在构思…</div>}
          {orphanPlans.map(renderPlan)}
        </div>
        {!!offscreenReadyIds.length && <button type="button" className="agent-pending-locate" onClick={locatePendingPlan} title="定位待确认的图像方案"><ChevronsUp size={16} /><span>{offscreenReadyIds.length}</span></button>}
      </div>
      <div className="agent-panel-composer">
        <div className="agent-composer-box">
          <div className="agent-composer-reference-bar">
            <button type="button" onMouseDown={rememberSelection} onClick={props.onPickFromCanvas} title="从画布选择参考图" aria-label="从画布选择参考图"><MousePointer2 size={15} /><span>画布选图</span></button>
            <button type="button" onMouseDown={rememberSelection} onClick={() => uploadInputRef.current?.click()} title="从本地上传参考图" aria-label="从本地上传参考图"><ImageUp size={15} /><span>上传参考图</span></button>
            <input
              ref={uploadInputRef}
              className="agent-reference-upload-input"
              type="file"
              accept="image/*"
              aria-label="上传 Agent 参考图"
              onChange={(event) => {
                const file = event.target.files?.[0]
                if (file) uploadReference(file)
                event.target.value = ''
              }}
            />
          </div>
          <div
            className="agent-composer-input"
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            data-placeholder="和 Disy 对话，输入 @ 引用画布图片，或上传参考图"
            onInput={() => {
              rememberSelection()
              const text = getEditorText()
              setMentionOpen(/@[^\s@]*$/.test(text))
              syncReferencesFromEditor()
            }}
            onKeyUp={rememberSelection}
            onMouseUp={rememberSelection}
            onBlur={rememberSelection}
            onClick={(event) => {
              const target = event.target
              if (target instanceof HTMLButtonElement) {
                target.closest('.agent-inline-reference')?.remove()
                syncReferencesFromEditor()
              }
            }}
            onKeyDown={(event) => {
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
              options={props.textModels.map((model) => ({ value: model.key, label: model.name, detail: model.connectionName }))}
              icon={<MessageCircle size={14} />}
              onChange={props.onTextModelChange}
            />
            <AgentSelect
              className="agent-model-select"
              ariaLabel="生图模型"
              value={props.imageModelKey}
              placeholder="选择生图模型"
              options={props.imageModels.map((model) => ({ value: model.key, label: model.name, detail: model.connectionName }))}
              icon={<ImagePlus size={14} />}
              onChange={props.onImageModelChange}
            />
          </div>
          <footer className="agent-composer-footer">
            <div className="agent-composer-tools">
              {activeReadyPlan && <div className="agent-parameter-tool" ref={parameterToolRef}>
                <button
                  type="button"
                  className={`agent-parameter-trigger ${parametersOpen ? 'is-open' : ''}`}
                  title="设置当前待确认方案参数"
                  aria-label="设置当前待确认方案参数"
                  aria-expanded={parametersOpen}
                  onClick={() => setParametersOpen((open) => !open)}
                >
                  <SlidersHorizontal size={15} />
                  <span>{activeReadyPlan.aspectRatio} · {activeReadyPlan.resolution} · {activeReadyPlan.count} 张</span>
                  {readyPlans.length > 1 && <em>{readyPlans.findIndex((plan) => plan.id === activeReadyPlan.id) + 1}/{readyPlans.length}</em>}
                </button>
                {parametersOpen && <div className="agent-parameter-popover">
                  <header><span><SlidersHorizontal size={14} />生成参数</span><small>{activeReadyPlan.aspectRatio} · {activeReadyPlan.resolution} · {activeReadyPlan.count} 张</small></header>
                  <div className="agent-plan-control is-ratio">
                    <span>比例</span>
                    <div>{props.aspectOptions.map((option) => <button type="button" className={activeReadyPlan.aspectRatio === option.value ? 'is-selected' : ''} key={option.value} onClick={() => props.onPlanChange(activeReadyPlan.id, { aspectRatio: option.value })}>{option.label}</button>)}</div>
                  </div>
                  <div className="agent-plan-control">
                    <span>清晰度</span>
                    <div>{props.resolutionOptions.map((option) => <button type="button" className={activeReadyPlan.resolution === option.value ? 'is-selected' : ''} key={option.value} onClick={() => props.onPlanChange(activeReadyPlan.id, { resolution: option.value })}>{option.label}</button>)}</div>
                  </div>
                  <div className="agent-plan-control">
                    <span>画质</span>
                    <div>{props.detailOptions.map((option) => <button type="button" className={activeReadyPlan.detail === option.value ? 'is-selected' : ''} key={option.value} onClick={() => props.onPlanChange(activeReadyPlan.id, { detail: option.value })}>{option.label}</button>)}</div>
                  </div>
                  <div className="agent-plan-control">
                    <span>数量</span>
                    <div>{[1, 2, 3, 4].map((count) => <button type="button" className={activeReadyPlan.count === count ? 'is-selected' : ''} key={count} onClick={() => props.onPlanChange(activeReadyPlan.id, { count })}>{count} 张</button>)}</div>
                  </div>
                </div>}
              </div>}
            </div>
            <button className="agent-send-button" disabled={props.busy} onClick={submit}><ArrowUp size={17} /></button>
          </footer>
        </div>
      </div>
    </aside>
  )
}
