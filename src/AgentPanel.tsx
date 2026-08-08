import { useEffect, useRef, useState } from 'react'
import { ArrowUp, Check, ChevronDown, ImagePlus, LoaderCircle, MessageCircle, MousePointer2, Plus, Sparkles, X } from 'lucide-react'
import type { AgentImagePlan, AgentImageReference, AgentMessage } from './agent'

export type AgentModelOption = { key: string; name: string; connectionName: string }
export type AgentConversationOption = { id: string; title: string; updatedAt: string }

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
  onPendingReferenceConsumed: () => void
  onPickFromCanvas: () => void
  onSend: (message: string) => void
  onPlanChange: (id: string, prompt: string) => void
  onConfirmPlan: (id: string) => void
  onCancelPlan: (id: string) => void
}

export function AgentPanel(props: Props) {
  const [mentionOpen, setMentionOpen] = useState(false)
  const editorRef = useRef<HTMLDivElement>(null)
  const savedRangeRef = useRef<Range | null>(null)

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
  useEffect(() => {
    if (!props.pendingReference) return
    addReference(props.pendingReference)
    props.onPendingReferenceConsumed()
  }, [props.pendingReference])
  const submit = () => {
    const value = getEditorText()
    if (!value || props.busy) return
    props.onSend(value)
    if (editorRef.current) editorRef.current.innerHTML = ''
    setMentionOpen(false)
  }
  return (
    <aside id="disy-agent-panel" className="agent-panel" aria-label="Disy 对话 Agent">
      <header className="agent-panel-header">
        <div className="agent-panel-title"><img className="agent-panel-logo" src="/disy-logo.png" alt="" /><span><strong>Disy Agent</strong><small>和你一起构思，并在确认后生成</small></span></div>
        <div><button className="agent-panel-close" onClick={props.onNewConversation} title="新对话"><Plus size={16} /></button><button className="agent-panel-close" onClick={props.onClose} title="关闭"><X size={17} /></button></div>
      </header>
      <div className="agent-conversation-row">
        <label className="agent-conversation-select" title="选择对话">
          <MessageCircle size={14} />
          <select aria-label="选择 Agent 对话" value={props.activeConversationId} onChange={(event) => props.onSelectConversation(event.target.value)}>
            {props.conversations.map((conversation) => <option key={conversation.id} value={conversation.id}>{conversation.title}</option>)}
          </select>
          <ChevronDown size={14} />
        </label>
        <button type="button" className="agent-new-chat-button" onClick={props.onNewConversation} title="新建对话"><Plus size={15} /></button>
        <button type="button" className="agent-delete-chat-button" onClick={props.onDeleteConversation} title="删除当前对话"><X size={15} /></button>
      </div>
      <div className="agent-panel-models">
        <label className="agent-model-select" title="对话模型"><MessageCircle size={14} /><select aria-label="对话模型" value={props.textModelKey} onChange={(event) => props.onTextModelChange(event.target.value)}><option value="">选择对话模型</option>{props.textModels.map((model) => <option key={model.key} value={model.key}>{model.name}</option>)}</select></label>
        <label className="agent-model-select" title="生图模型"><ImagePlus size={14} /><select aria-label="生图模型" value={props.imageModelKey} onChange={(event) => props.onImageModelChange(event.target.value)}><option value="">选择生图模型</option>{props.imageModels.map((model) => <option key={model.key} value={model.key}>{model.name}</option>)}</select></label>
      </div>
      <div className="agent-panel-messages">
        {!props.messages.length && <div className="agent-empty"><span><Sparkles size={19} /></span><strong>今天想创造什么？</strong><p>聊灵感、梳理画面，或让我准备一份可确认的图像方案。</p></div>}
        {props.messages.map((message) => <article key={message.id} className={`agent-message is-${message.role}`}><p>{message.content}</p></article>)}
        {props.busy && <div className="agent-thinking"><LoaderCircle size={14} className="is-spinning" /> 正在构思…</div>}
        {props.plans.map((plan) => <section className={`agent-plan-card is-${plan.status}`} key={plan.id}>
          <header><span><ImagePlus size={15} />图像生成确认</span><em>{plan.status === 'ready' ? '待确认' : plan.status === 'running' ? '生成中' : plan.status === 'completed' ? '已完成' : plan.status === 'cancelled' ? '已取消' : '失败'}</em></header>
          <textarea value={plan.prompt} disabled={plan.status !== 'ready'} onChange={(event) => props.onPlanChange(plan.id, event.target.value)} aria-label="编辑图像方案提示词" />
          <div className="agent-plan-meta"><span>{plan.aspectRatio}</span><span>{plan.resolution}</span><span>{plan.count} 张</span></div>
          {!!plan.referenceNodeIds.length && <div className="agent-plan-references">{plan.referenceNodeIds.map((nodeId) => {
            const reference = props.candidates.find((item) => item.nodeId === nodeId) || props.references.find((item) => item.nodeId === nodeId)
            return reference ? <span className="agent-plan-reference" key={nodeId}><img src={reference.url} alt="" />{reference.name}</span> : null
          })}</div>}
          {plan.error && <p className="agent-plan-error">{plan.error}</p>}
          {plan.status === 'ready' && <footer className="agent-plan-actions"><button onClick={() => props.onCancelPlan(plan.id)}>取消</button><button className="agent-plan-confirm" onClick={() => props.onConfirmPlan(plan.id)}><Check size={15} />确认生图</button></footer>}
        </section>)}
      </div>
      <div className="agent-panel-composer">
        <div className="agent-composer-box">
          <div
            className="agent-composer-input"
            ref={editorRef}
            contentEditable
            role="textbox"
            aria-multiline="true"
            data-placeholder="和 Disy 对话，输入 @ 引用画布图片"
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
          <footer className="agent-composer-footer"><div className="agent-composer-tools"><button onMouseDown={rememberSelection} onClick={props.onPickFromCanvas} title="从画布选择图片"><MousePointer2 size={16} /></button></div><button className="agent-send-button" disabled={props.busy} onClick={submit}><ArrowUp size={17} /></button></footer>
        </div>
      </div>
    </aside>
  )
}
