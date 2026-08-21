import { useEffect, useMemo, useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, FileUp, FolderUp, Grid3X3, Search, Settings2, Sparkles, Trash2, X, Zap } from 'lucide-react'
import { importSkillFile } from '../skills/importExport'
import { listSkills, officialSkills } from '../skills/registry'
import { deleteUserSkillManifest, saveUserSkillManifest } from '../skills/storage'
import type { SkillManifest } from '../skills/types'

type Props = { open: boolean; kind?: 'image' | 'text'; onClose: () => void; onApply: (skill: SkillManifest) => void; onNotice: (message: string) => void }

export function ImageSkillMenu({ open, kind = 'image', onClose, onApply, onNotice }: Props) {
  const [skills, setSkills] = useState<SkillManifest[]>(officialSkills)
  const [query, setQuery] = useState('')
  const [manage, setManage] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const folderRef = useRef<HTMLInputElement>(null)
  const accepts = (item: SkillManifest) => kind === 'text' ? item.kind === 'text' : item.kind === 'image' || item.kind === 'storyboard_comic'
  const refresh = () => listSkills().then((items) => setSkills(items.filter(accepts))).catch(() => setSkills(officialSkills.filter(accepts)))
  useEffect(() => { if (open) void refresh() }, [open])
  const shown = useMemo(() => skills.filter((skill) => `${skill.name} ${skill.description}`.toLowerCase().includes(query.trim().toLowerCase())), [query, skills])

  const upload = async (files: FileList | null) => {
    if (!files?.length) return
    let imported = 0
    const errors: string[] = []
    for (const file of Array.from(files)) {
      if (!/\.json$/i.test(file.name)) continue
      try { await saveUserSkillManifest(await importSkillFile(file)); imported += 1 } catch (error) { errors.push(error instanceof Error ? error.message : `${file.name} 导入失败`) }
    }
    await refresh()
    onNotice(errors.length ? `已导入 ${imported} 个；${errors[0]}` : `已安全导入 ${imported} 个 Skill`)
  }

  if (!open) return null
  const panel = <div className="image-skill-popover nodrag nowheel" onPointerDown={(event) => event.stopPropagation()} onWheel={(event) => event.stopPropagation()}>
    <header><button type="button" onClick={() => manage ? setManage(false) : onClose()}>{manage ? <ChevronLeft size={16} /> : <X size={16} />}</button><div><strong>{manage ? '管理 Skill' : `${kind === 'text' ? '文本' : '图像'} Skill`}</strong><small>{manage ? '查看、导入和删除用户 Skill' : '选择后由 Skill 自动执行任务'}</small></div></header>
    {manage ? <>
      <section className="image-skill-upload-grid">
        <button type="button" onClick={() => folderRef.current?.click()}><FolderUp size={20} /><span><b>上传 Skill 文件夹</b><small>批量读取安全 Manifest</small></span></button>
        <button type="button" onClick={() => fileRef.current?.click()}><FileUp size={20} /><span><b>上传 Skill 文件</b><small>.disy-skill.json / .json</small></span></button>
      </section>
      <div className="image-skill-manage-list"><label>已上传 Skill</label>{skills.filter((item) => item.source === 'user').map((skill) => <div key={`${skill.id}@${skill.version}`}><span><b>{skill.name}</b><small>{skill.slug} · v{skill.version}</small></span><button type="button" title="删除" onClick={async () => { await deleteUserSkillManifest(skill); await refresh(); onNotice(`已删除 ${skill.name}`) }}><Trash2 size={15} /></button></div>)}{!skills.some((item) => item.source === 'user') && <p>尚未上传自定义 Skill</p>}</div>
    </> : <>
      <div className="image-skill-search"><Search size={15} /><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="搜索 Skill" autoFocus /></div>
      <div className="image-skill-list">{shown.map((skill) => <button type="button" key={`${skill.id}@${skill.version}`} onClick={() => onApply(skill)}><i>{skill.execution === 'instant' ? <Zap size={17} /> : skill.slug.includes('grid') || skill.slug.includes('panel') || skill.slug.includes('board') ? <Grid3X3 size={17} /> : <Sparkles size={17} />}</i><span><b>{skill.name}</b><small>{skill.description}</small></span><em className={`skill-mode-badge is-${skill.execution}`}>{skill.execution === 'instant' ? '⚡ 直接执行' : '◫ 配置后执行'}</em><em>{skill.source === 'user' ? '我的' : '内置'}</em><ChevronRight size={14} /></button>)}</div>
      <button type="button" className="image-skill-manage-entry" onClick={() => setManage(true)}><Settings2 size={17} /><span><b>管理 Skill</b><small>上传、查看或删除自定义 Skill</small></span><ChevronRight size={15} /></button>
    </>}
    <input ref={fileRef} hidden type="file" accept=".json,.disy-skill.json" onChange={(e) => { void upload(e.target.files); e.target.value = '' }} />
    <input ref={folderRef} hidden type="file" multiple {...({ webkitdirectory: '', directory: '' } as React.InputHTMLAttributes<HTMLInputElement>)} onChange={(e) => { void upload(e.target.files); e.target.value = '' }} />
  </div>
  return panel
}
