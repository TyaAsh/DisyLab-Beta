import { useEffect, useRef, useState } from 'react'
import { Check, ChevronLeft, Layers3, LoaderCircle, Sparkles, X } from 'lucide-react'
import { COMIC_LAYOUTS, buildAssetPrompt, buildCompositionPrompt, type ComicLayout, type ComicStyle, type ComicWorkflowState } from '../skills/storyboard'
import { GlassSelect } from './GlassSelect'

type Props = {
  open: boolean
  initialContent: string
  initialState?: ComicWorkflowState
  imageUrl?: string
  generating: boolean
  onClose: () => void
  onUpdate: (state: ComicWorkflowState) => void
  onGenerate: (mode: 'composition' | 'assets', prompt: string, state: ComicWorkflowState) => Promise<void>
}

const freshState = (content: string): ComicWorkflowState => ({ skillKey: 'official.storyboard-comic@1.0.0', content, style: 'hybrid', aspectRatio: '9:16', status: 'content_review', updatedAt: Date.now() })

export function StoryboardComicWorkflow({ open, initialContent, initialState, imageUrl, generating, onClose, onUpdate, onGenerate }: Props) {
  const [state, setState] = useState<ComicWorkflowState>(() => initialState ?? freshState(initialContent))
  const panelRef = useRef<HTMLElement>(null)
  const dragRef = useRef<{ pointerId: number; offsetX: number; offsetY: number } | null>(null)
  const [panelPosition, setPanelPosition] = useState<{ x: number; y: number } | null>(null)
  useEffect(() => { if (open) setState(initialState ?? freshState(initialContent)) }, [open])
  if (!open) return null
  const save = (next: ComicWorkflowState) => { setState(next); onUpdate(next) }
  const stage = state.status === 'content_review' ? 0 : state.status === 'layout_pending' ? 1 : state.status === 'composition_generating' || state.status === 'composition_review' ? 2 : 3
  const startComposition = async () => {
    if (!state.layout || generating) return
    const running = { ...state, status: 'composition_generating' as const, updatedAt: Date.now() }
    save(running)
    await onGenerate('composition', buildCompositionPrompt(running), running)
    save({ ...running, status: 'composition_review', updatedAt: Date.now() })
  }
  const approveAndGenerateAssets = async () => {
    if (!imageUrl || generating) return
    const running = { ...state, status: 'asset_generation' as const, updatedAt: Date.now() }
    save(running)
    await onGenerate('assets', buildAssetPrompt(running), running)
    save({ ...running, status: 'completed', updatedAt: Date.now() })
  }
  return <aside ref={panelRef} className="comic-workflow-panel nodrag nowheel" style={panelPosition ? { left: panelPosition.x, top: panelPosition.y, right: 'auto', transform: 'none' } : undefined} onPointerDown={(event) => event.stopPropagation()}>
    <header
      onPointerDown={(event) => {
        if ((event.target as HTMLElement).closest('button')) return
        const rect = panelRef.current?.getBoundingClientRect()
        if (!rect) return
        dragRef.current = { pointerId: event.pointerId, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top }
        setPanelPosition({ x: rect.left, y: rect.top })
        event.currentTarget.setPointerCapture(event.pointerId)
      }}
      onPointerMove={(event) => {
        const drag = dragRef.current
        if (!drag || drag.pointerId !== event.pointerId) return
        const width = panelRef.current?.offsetWidth ?? 460
        const height = panelRef.current?.offsetHeight ?? 680
        setPanelPosition({ x: Math.min(Math.max(8, event.clientX - drag.offsetX), Math.max(8, window.innerWidth - width - 8)), y: Math.min(Math.max(8, event.clientY - drag.offsetY), Math.max(8, window.innerHeight - height - 8)) })
      }}
      onPointerUp={(event) => { if (dragRef.current?.pointerId === event.pointerId) dragRef.current = null }}
      onPointerCancel={() => { dragRef.current = null }}
    ><div><span><Sparkles size={17} /></span><div><small>STORYBOARD SKILL</small><strong>漫画分镜素材工厂</strong></div></div><button type="button" onClick={onClose}><X size={16} /></button></header>
    <nav>{['内容', '骨架', '构图', '素材'].map((label, index) => <span key={label} className={index < stage ? 'is-done' : index === stage ? 'is-active' : ''}><i>{index < stage ? <Check size={11} /> : index + 1}</i>{label}</span>)}</nav>
    <main>
      {stage === 0 && <section className="comic-stage"><div className="comic-stage-title"><small>内容守恒</small><h3>确认区块脚本</h3><p>同一区块的小标签、正文和要点将保持连续，不会重排或自动编号。</p></div><textarea value={state.content} onChange={(event) => save({ ...state, content: event.target.value, updatedAt: Date.now() })} placeholder="粘贴区块、小标签、主要内容、要点和画面要求…" /><div className="comic-field-row"><label>版面风格<GlassSelect ariaLabel="版面风格" value={state.style} options={[{value:'hybrid',label:'2D+3D 混合风'},{value:'2d',label:'2D 风格'},{value:'3d',label:'3D 风格'}]} onChange={(value) => save({ ...state, style: value as ComicStyle, updatedAt: Date.now() })} /></label><label>画幅<GlassSelect ariaLabel="画幅" value={state.aspectRatio} options={['9:16','1:1','16:9','3:4','4:3'].map((ratio) => ({value:ratio,label:ratio}))} onChange={(value) => save({ ...state, aspectRatio: value, updatedAt: Date.now() })} /></label></div></section>}
      {stage === 1 && <section className="comic-stage"><div className="comic-stage-title"><small>零模型成本预览</small><h3>选择切割骨架</h3><p>这里只确定格子、留白和阅读动线，不调用图片模型。</p></div><div className="comic-layout-grid">{COMIC_LAYOUTS.map((layout) => <button type="button" key={layout.id} className={state.layout === layout.id ? 'is-selected' : ''} onClick={() => save({ ...state, layout: layout.id as ComicLayout, updatedAt: Date.now() })}><div className={`comic-wireframe is-${layout.id}`}><i/><i/><i/><i/></div><span><b>{layout.name}</b><small>{layout.detail}</small></span></button>)}</div></section>}
      {stage === 2 && <section className="comic-stage"><div className="comic-stage-title"><small>付费生成 · 单张</small><h3>{state.status === 'composition_review' ? '审核构图粗稿' : '生成构图粗稿'}</h3><p>构图确认以前，不允许进入批量素材生成。</p></div>{imageUrl && state.status === 'composition_review' ? <img className="comic-result-preview" src={imageUrl} alt="构图粗稿" /> : <div className="comic-generation-card"><Sparkles size={28}/><b>{generating ? '正在生成构图粗稿…' : '骨架已经锁定'}</b><small>{generating ? '完成后请检查区块连续性、镜头节奏和文字安全区' : '将调用当前节点已经选择的图像模型，仅生成一张'}</small></div>}</section>}
      {stage === 3 && <section className="comic-stage"><div className="comic-stage-title"><small>确认闸门已通过</small><h3>{state.status === 'completed' ? '素材包已完成' : '生成素材包'}</h3><p>以构图粗稿为参考，生成角色、道具、场景和背景素材，不烤入正式文字。</p></div><div className="comic-generation-card is-assets"><Layers3 size={28}/><b>{generating ? '正在生成素材包…' : state.status === 'completed' ? '结果已写入当前节点版本' : '准备生成 4 个素材结果'}</b><small>所有结果进入当前节点的版本列表与生成历史，可继续拆分和加入资产库。</small></div></section>}
    </main>
    <footer>{stage > 0 && !generating && state.status !== 'completed' ? <button type="button" onClick={() => save({ ...state, status: stage === 1 ? 'content_review' : stage === 2 ? 'layout_pending' : 'composition_review', updatedAt: Date.now() })}><ChevronLeft size={14}/>返回修改</button> : <span/>}<div>{stage === 0 && <button className="is-primary" disabled={!state.content.trim()} onClick={() => save({ ...state, status: 'layout_pending', updatedAt: Date.now() })}>确认内容</button>}{stage === 1 && <button className="is-primary" disabled={!state.layout || generating} onClick={() => void startComposition()}>锁定骨架并自动生成</button>}{stage === 2 && state.status === 'composition_generating' && <button className="is-primary" disabled><LoaderCircle className="is-spinning" size={14}/>自动生成构图中</button>}{stage === 2 && state.status === 'composition_review' && <button className="is-primary" disabled={!imageUrl || generating} onClick={() => void approveAndGenerateAssets()}>确认构图并自动生成素材</button>}{stage === 3 && state.status === 'asset_generation' && <button className="is-primary" disabled><LoaderCircle className="is-spinning" size={14}/>顺序生成素材中</button>}{state.status === 'completed' && <button className="is-primary" onClick={onClose}>完成</button>}</div></footer>
  </aside>
}
