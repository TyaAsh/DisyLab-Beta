import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Play, Sparkles, X } from 'lucide-react'
import type { SkillManifest } from '../skills/types'
import { GlassSelect } from './GlassSelect'

type Value = string | number | boolean
type Props = { skill: SkillManifest | null; initialSubject: string; onClose: () => void; onRun: (skill: SkillManifest, subject: string, values: Record<string, Value>) => void }

export function SkillConfigPanel({ skill, initialSubject, onClose, onRun }: Props) {
  const [subject, setSubject] = useState(initialSubject)
  const [values, setValues] = useState<Record<string, Value>>({})
  const [position, setPosition] = useState({ x: Math.max(12, window.innerWidth - 486), y: 88 })
  const dragRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null)
  useEffect(() => {
    if (!skill) return
    setSubject(initialSubject)
    setValues(Object.fromEntries(skill.parameters.filter((p) => p.bind !== 'prompt' && p.default !== undefined).map((p) => [p.name, p.default as Value])))
  }, [skill, initialSubject])
  const fields = useMemo(() => skill?.parameters.filter((p) => p.bind !== 'prompt') ?? [], [skill])
  if (!skill) return null
  return createPortal(<section className="skill-config-panel nodrag nowheel" style={{ left: position.x, top: position.y }} onPointerDown={(e) => e.stopPropagation()}>
    <header onPointerDown={(event) => {
      if ((event.target as HTMLElement).closest('button')) return
      dragRef.current = { x: event.clientX, y: event.clientY, left: position.x, top: position.y }
      const move = (e: PointerEvent) => { const d = dragRef.current; if (!d) return; setPosition({ x: Math.max(8, Math.min(window.innerWidth - 468, d.left + e.clientX - d.x)), y: Math.max(8, Math.min(window.innerHeight - 160, d.top + e.clientY - d.y)) }) }
      const up = () => { dragRef.current = null; window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
      window.addEventListener('pointermove', move); window.addEventListener('pointerup', up)
    }}><div><span><Sparkles size={17} /></span><div><small>CONFIGURED SKILL</small><strong>{skill.name}</strong></div></div><button type="button" onClick={onClose}><X size={16} /></button></header>
    <main><div className="comic-stage-title"><small>执行前配置</small><h3>补齐任务框架</h3><p>{skill.description} 确认后会自动写入节点并调用当前模型。</p></div>
      <label className="skill-config-subject"><span>{skill.parameters.find((p) => p.bind === 'prompt')?.label ?? '内容'}</span><textarea value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="填写主题、内容、约束和希望得到的结果…" autoFocus /></label>
      <div className="skill-config-fields">{fields.map((field) => <label key={field.name}><span>{field.label}</span>{field.type === 'enum' ? <GlassSelect ariaLabel={field.label} value={String(values[field.name] ?? '')} options={(field.enum ?? []).map((item) => ({ value: item, label: item }))} onChange={(value) => setValues((v) => ({ ...v, [field.name]: value }))} /> : field.type === 'boolean' ? <input type="checkbox" checked={Boolean(values[field.name])} onChange={(e) => setValues((v) => ({ ...v, [field.name]: e.target.checked }))} /> : <input type={field.type === 'number' ? 'number' : 'text'} value={String(values[field.name] ?? '')} onChange={(e) => setValues((v) => ({ ...v, [field.name]: field.type === 'number' ? Number(e.target.value) : e.target.value }))} />}</label>)}</div>
    </main><footer><span>配置后自动执行 · 使用当前节点模型</span><button type="button" disabled={!subject.trim()} onClick={() => onRun(skill, subject.trim(), values)}><Play size={14} />确认并执行</button></footer>
  </section>, document.body)
}
