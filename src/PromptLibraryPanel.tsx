import { useEffect, useMemo, useState, type DragEvent } from 'react'
import { ArrowUpRight, BookOpen, Check, ChevronLeft, ChevronRight, Copy, GripVertical, ImagePlus, Plus, Search, Upload, X } from 'lucide-react'

export type PromptLibraryCase = {
  id: number | string
  title: string
  image: string
  sourceLabel?: string
  sourceUrl?: string
  prompt: string
  category: string
  styles: string[]
  scenes: string[]
  featured: boolean
  template?: boolean
  industry?: boolean
  githubUrl?: string
}

type PromptCatalog = {
  totalCases: number
  categories: string[]
  styles: string[]
  scenes: string[]
  cases: PromptLibraryCase[]
  templates?: PromptLibraryCase[]
  industryCases?: PromptLibraryCase[]
}

const categoryLabels: Record<string, string> = {
  'UI & Interfaces': 'UI 与界面', 'Charts & Infographics': '图表与信息可视化',
  'Posters & Typography': '海报与排版', 'Products & E-commerce': '商品与电商',
  'Brand & Logos': '品牌与标志', 'Architecture & Spaces': '建筑与空间',
  'Photography & Realism': '摄影与写实', 'Illustration & Art': '插画与艺术',
  'Characters & People': '人物与角色', 'Scenes & Storytelling': '场景与叙事',
  'History & Classical Themes': '历史与古风', 'Documents & Publishing': '文档与出版物',
  'Other Use Cases': '其他应用',
}
const styleLabels: Record<string, string> = { '3D': '3D', Architecture: '建筑', Brand: '品牌', Character: '角色', Characters: '人物', Charts: '图表', Classical: '古典', Documents: '文档', History: '历史', Illustration: '插画', Infographic: '信息图', 'Other Use Cases': '其他应用', Photography: '摄影', Poster: '海报', Product: '商品', Products: '商品', Realistic: '写实', Scenes: '场景', UI: '界面' }
const sceneLabels: Record<string, string> = { Commerce: '商业', Creative: '创意', Education: '教育', Fashion: '时尚', Food: '食品饮品', History: '历史', Social: '社媒', Story: '叙事', Tech: '科技', Travel: '旅行' }
const PAGE_SIZE = 24
const CUSTOM_CASES_KEY = 'disy-prompt-library-custom-v1'

const readCustomCases = (): PromptLibraryCase[] => {
  try { return JSON.parse(localStorage.getItem(CUSTOM_CASES_KEY) || '[]') as PromptLibraryCase[] } catch { return [] }
}

const compressReference = (file: File) => new Promise<string>((resolve, reject) => {
  const image = new Image()
  const url = URL.createObjectURL(file)
  image.onload = () => {
    const scale = Math.min(1, 640 / Math.max(image.naturalWidth, image.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(image.naturalWidth * scale)); canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
    canvas.getContext('2d')?.drawImage(image, 0, 0, canvas.width, canvas.height)
    URL.revokeObjectURL(url)
    resolve(canvas.toDataURL('image/webp', .7))
  }
  image.onerror = () => { URL.revokeObjectURL(url); reject(new Error('image')); }; image.src = url
})

type Props = {
  open: boolean
  onClose: () => void
  onUsePrompt: (item: PromptLibraryCase) => void
  onAddImage: (item: PromptLibraryCase) => void
}

export function PromptLibraryPanel({ open, onClose, onUsePrompt, onAddImage }: Props) {
  const [catalog, setCatalog] = useState<PromptCatalog | null>(null)
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const [style, setStyle] = useState('all')
  const [selected, setSelected] = useState<PromptLibraryCase | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [customCases, setCustomCases] = useState<PromptLibraryCase[]>(readCustomCases)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [libraryView, setLibraryView] = useState<'cases' | 'templates' | 'industry' | 'mine'>('cases')
  const [draft, setDraft] = useState({ title: '', prompt: '', category: '', styles: '', scenes: '', image: '' })

  useEffect(() => {
    if (!open || catalog) return
    fetch('/prompt-library/catalog.json')
      .then((response) => { if (!response.ok) throw new Error(String(response.status)); return response.json() })
      .then((data: PromptCatalog) => setCatalog(data))
      .catch(() => setError('提示库加载失败，请刷新后重试'))
  }, [catalog, open])

  const results = useMemo(() => {
    if (!catalog) return []
    const normalized = query.trim().toLocaleLowerCase()
    const sourceItems = libraryView === 'templates' ? (catalog.templates || []) : libraryView === 'industry' ? (catalog.industryCases || []) : libraryView === 'mine' ? customCases : catalog.cases
    return sourceItems.filter((item) => {
      if (category !== 'all' && item.category !== category) return false
      if (style !== 'all' && !item.styles.includes(style)) return false
      if (!normalized) return true
      return [item.title, item.prompt, item.sourceLabel, item.category, ...item.styles, ...item.scenes]
        .filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(normalized))
    })
  }, [catalog, category, customCases, libraryView, query, style])
  const categories = useMemo(() => Array.from(new Set([...(catalog?.categories || []), ...(catalog?.industryCases || []).map((item) => item.category), ...customCases.map((item) => item.category).filter(Boolean)])), [catalog, customCases])
  const styles = useMemo(() => Array.from(new Set([...(catalog?.styles || []), ...(catalog?.industryCases || []).flatMap((item) => item.styles), ...customCases.flatMap((item) => item.styles)])), [catalog, customCases])
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const pageCases = useMemo(() => results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [page, results])

  useEffect(() => { setPage(1); setSelected(null) }, [category, libraryView, query, style])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  if (!open) return null

  const beginDrag = (event: DragEvent, item: PromptLibraryCase) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-disy-prompt-case', JSON.stringify(item))
    event.dataTransfer.setData('text/plain', item.prompt)
  }

  return (
    <div className="prompt-library-backdrop" onMouseDown={onClose} onDragEnter={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDrop={(event) => { event.preventDefault(); const payload = event.dataTransfer.getData('application/x-disy-prompt-case'); if (payload) onAddImage(JSON.parse(payload) as PromptLibraryCase) }}>
      <section className="prompt-library-panel" role="dialog" aria-modal="true" aria-labelledby="prompt-library-title" onMouseDown={(event) => event.stopPropagation()} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy' }} onDrop={(event) => event.stopPropagation()}>
        <header className="prompt-library-header">
          <div className="prompt-library-heading"><span><BookOpen size={18} /></span><div><h2 id="prompt-library-title">提示库</h2><small>{catalog ? `${catalog.totalCases} 个灵感案例` : '正在加载案例'}</small></div></div>
          <div className="prompt-header-actions"><button type="button" className="prompt-create-button" onClick={() => setCreatorOpen(true)}><Plus size={14} />添加我的案例</button><button type="button" aria-label="关闭提示库" onClick={onClose}><X size={18} /></button></div>
        </header>

          <div className="prompt-library-search-row">
          <nav className="prompt-library-view-tabs"><button className={libraryView === 'cases' ? 'is-active' : ''} onClick={() => setLibraryView('cases')}>灵感案例</button><button className={libraryView === 'industry' ? 'is-active' : ''} onClick={() => setLibraryView('industry')}>行业灵感 <b>{catalog?.industryCases?.length || 0}</b></button><button className={libraryView === 'mine' ? 'is-active' : ''} onClick={() => setLibraryView('mine')}>我的创作 <b>{customCases.length}</b></button></nav>
          <label><Search size={15} /><input autoFocus value={query} placeholder="搜索案例、风格或 Prompt" onChange={(event) => setQuery(event.target.value)} /></label>
          <span>{results.length} 个匹配</span>
        </div>

        <div className="prompt-library-filter-strip">
          <div><strong>分类</strong><div className="prompt-filter-chips"><button className={category === 'all' ? 'is-active' : ''} onClick={() => setCategory('all')}>全部</button>{categories.map((value) => <button key={value} className={category === value ? 'is-active' : ''} onClick={() => setCategory(value)}>{categoryLabels[value] || value}</button>)}</div></div>
          <div><strong>风格</strong><div className="prompt-filter-chips"><button className={style === 'all' ? 'is-active' : ''} onClick={() => setStyle('all')}>全部</button>{styles.map((value) => <button key={value} className={style === value ? 'is-active' : ''} onClick={() => setStyle(value)}>{styleLabels[value] || value}</button>)}</div></div>
        </div>

        <div className={`prompt-library-content ${selected ? 'has-detail' : ''}`}>
          <div className="prompt-case-grid">
            {error && <div className="prompt-library-state"><BookOpen size={28} /><strong>{error}</strong></div>}
            {!catalog && !error && <div className="prompt-library-state"><span className="prompt-library-spinner" /><strong>正在载入压缩案例图…</strong></div>}
            {catalog && !results.length && <div className="prompt-library-state"><Search size={28} /><strong>没有找到匹配案例</strong><span>试试减少筛选条件</span></div>}
            {pageCases.map((item) => (
              <article key={item.id} className={`prompt-case-card ${selected?.id === item.id ? 'is-selected' : ''}`} draggable onDragStart={(event) => beginDrag(event, item)} onClick={() => setSelected(item)}>
                <div className="prompt-case-image"><img loading="lazy" decoding="async" src={item.image} alt={item.title} /><span><GripVertical size={12} />拖入画布</span></div>
                <div className="prompt-case-copy"><strong>{item.title}</strong><small>{categoryLabels[item.category] || item.category}</small><p>{item.prompt}</p></div>
              </article>
            ))}
            {results.length > PAGE_SIZE && <nav className="prompt-pagination" aria-label="提示库分页">
              <button type="button" disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))}><ChevronLeft size={14} />上一页</button>
              <span>第 <strong>{page}</strong> / {totalPages} 页 · 本页 {pageCases.length} 个</span>
              <button type="button" disabled={page >= totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>下一页<ChevronRight size={14} /></button>
            </nav>}
          </div>

          {selected && <aside className="prompt-case-detail" draggable onDragStart={(event) => beginDrag(event, selected)}>
            <div className="prompt-detail-image" draggable onDragStart={(event) => beginDrag(event, selected)}><img src={selected.image} alt={selected.title} /><span><GripVertical size={13} />拖动参考图到画布</span></div>
            <div className="prompt-detail-title"><div><small>{selected.template ? '工业模板' : selected.industry ? '行业视觉' : `CASE ${selected.id}`}</small><h3>{selected.title}</h3></div>{selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer" title="查看原始来源"><ArrowUpRight size={16} /></a>}</div>
            <div className="prompt-detail-tags"><span>{categoryLabels[selected.category] || selected.category}</span>{selected.styles.map((tag) => <span key={`style-${tag}`}>{styleLabels[tag] || tag}</span>)}{selected.scenes.map((tag) => <span key={`scene-${tag}`}>{sceneLabels[tag] || tag}</span>)}</div>
            <div className="prompt-detail-prompt"><div><strong>Prompt</strong><button onClick={async () => { await navigator.clipboard.writeText(selected.prompt); setCopied(true); window.setTimeout(() => setCopied(false), 1400) }}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '已复制' : '复制'}</button></div><p>{selected.prompt}</p></div>
            <div className="prompt-detail-actions"><button onClick={() => onUsePrompt(selected)}><BookOpen size={15} />写入提示词节点</button><button onClick={() => onAddImage(selected)}><ImagePlus size={15} />加入画布</button></div>
            <footer>案例来自 <a href={selected.sourceUrl || selected.githubUrl} target="_blank" rel="noreferrer">{selected.sourceLabel || '原项目收录来源'}</a>。使用前请自行确认原作者授权。</footer>
          </aside>}
        </div>
      </section>
      {creatorOpen && <div className="prompt-creator-backdrop" onMouseDown={() => setCreatorOpen(false)}><form className="prompt-creator-dialog" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => { event.preventDefault(); if (!draft.title.trim() || !draft.prompt.trim() || !draft.image) return; const item: PromptLibraryCase = { id: `custom-${crypto.randomUUID()}`, title: draft.title.trim(), prompt: draft.prompt.trim(), image: draft.image, category: draft.category.trim() || '我的创作', styles: draft.styles.split(/[,，]/).map((value) => value.trim()).filter(Boolean), scenes: draft.scenes.split(/[,，]/).map((value) => value.trim()).filter(Boolean), featured: false, sourceLabel: '我的创作' }; const next = [item, ...customCases]; try { localStorage.setItem(CUSTOM_CASES_KEY, JSON.stringify(next)); setCustomCases(next); setSelected(item); setCreatorOpen(false); setDraft({ title: '', prompt: '', category: '', styles: '', scenes: '', image: '' }) } catch { setError('本地空间不足，请减少自定义案例或使用更小的参考图') } }}><header><div><small>MY PROMPT</small><h3>添加我的案例</h3></div><button type="button" onClick={() => setCreatorOpen(false)}><X size={17} /></button></header><label className="prompt-upload-field">{draft.image ? <img src={draft.image} alt="参考图预览" /> : <><Upload size={20} /><strong>上传参考图</strong><small>会自动压缩为最长边 640px WebP</small></>}<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void compressReference(file).then((image) => setDraft((current) => ({ ...current, image }))) }} /></label><label>案例名称<input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Prompt<textarea value={draft.prompt} onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))} /></label><div className="prompt-creator-fields"><label>分类（可新建）<input value={draft.category} placeholder="如：产品摄影" onChange={(event) => setDraft((current) => ({ ...current, category: event.target.value }))} /></label><label>风格（逗号分隔）<input value={draft.styles} placeholder="如：极简，写实" onChange={(event) => setDraft((current) => ({ ...current, styles: event.target.value }))} /></label><label>场景（逗号分隔）<input value={draft.scenes} placeholder="如：商业，社媒" onChange={(event) => setDraft((current) => ({ ...current, scenes: event.target.value }))} /></label></div><footer><button type="button" onClick={() => setCreatorOpen(false)}>取消</button><button type="submit" disabled={!draft.title.trim() || !draft.prompt.trim() || !draft.image}>保存到提示库</button></footer></form></div>}
    </div>
  )
}
