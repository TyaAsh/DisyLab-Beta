import { useEffect, useId, useMemo, useState, type DragEvent } from 'react'
import { ArrowUpRight, BookOpen, Check, ChevronDown, ChevronLeft, ChevronRight, Copy, GripVertical, ImagePlus, Plus, Search, Settings2, Trash2, Upload, X } from 'lucide-react'

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

const PAGE_SIZE = 24
const CUSTOM_CASES_KEY = 'disy-prompt-library-custom-v1'
const HIDDEN_CASES_KEY = 'disy-prompt-library-hidden-v1'
const CUSTOM_CATEGORIES_KEY = 'disy-prompt-library-categories-v1'
const CATEGORY_SETTINGS_KEY = 'disy-prompt-library-category-settings-v1'
const SYSTEM_CATEGORIES = ['金融科技', '视觉案例']

const readCustomCases = (): PromptLibraryCase[] => {
  try { return JSON.parse(localStorage.getItem(CUSTOM_CASES_KEY) || '[]') as PromptLibraryCase[] } catch { return [] }
}
const readStringList = (key: string): string[] => {
  try { const value = JSON.parse(localStorage.getItem(key) || '[]'); return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [] } catch { return [] }
}
const readCategorySettings = (): { hidden: string[]; names: Record<string, string> } => {
  try {
    const value = JSON.parse(localStorage.getItem(CATEGORY_SETTINGS_KEY) || '{}') as { hidden?: unknown; names?: unknown }
    return { hidden: Array.isArray(value.hidden) ? value.hidden.filter((item): item is string => typeof item === 'string') : [], names: value.names && typeof value.names === 'object' ? value.names as Record<string, string> : {} }
  } catch { return { hidden: [], names: {} } }
}
const saveCustomCases = (items: PromptLibraryCase[]) => localStorage.setItem(CUSTOM_CASES_KEY, JSON.stringify(items))

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
  const [selected, setSelected] = useState<PromptLibraryCase | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const [page, setPage] = useState(1)
  const [customCases, setCustomCases] = useState<PromptLibraryCase[]>(readCustomCases)
  const [hiddenCaseIds, setHiddenCaseIds] = useState<string[]>(() => readStringList(HIDDEN_CASES_KEY))
  const [customCategories, setCustomCategories] = useState<string[]>(() => readStringList(CUSTOM_CATEGORIES_KEY))
  const [categorySettings, setCategorySettings] = useState(readCategorySettings)
  const [creatorOpen, setCreatorOpen] = useState(false)
  const [categoryManagerOpen, setCategoryManagerOpen] = useState(false)
  const [editingCategory, setEditingCategory] = useState<string | null>(null)
  const [categoryDraft, setCategoryDraft] = useState('')
  const [pendingDeleteCategory, setPendingDeleteCategory] = useState<string | null>(null)
  const [draft, setDraft] = useState({ title: '', prompt: '', category: '', image: '' })
  const [creatorCategoryOpen, setCreatorCategoryOpen] = useState(false)
  const creatorCategoryMenuId = useId()

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
    const sourceItems = [...(catalog.cases || []), ...(catalog.industryCases || []), ...customCases]
    return sourceItems.filter((item) => {
      if (hiddenCaseIds.includes(String(item.id))) return false
      if (category !== 'all' && item.category !== category) return false
      if (!normalized) return true
      return [item.title, item.prompt, item.sourceLabel, item.category]
        .filter(Boolean).some((value) => String(value).toLocaleLowerCase().includes(normalized))
    })
  }, [catalog, category, customCases, hiddenCaseIds, query])
  const categories = useMemo(() => [...SYSTEM_CATEGORIES, ...Array.from(new Set([...customCategories, ...customCases.map((item) => item.category)])).filter((value) => value && !SYSTEM_CATEGORIES.includes(value))], [customCategories, customCases])
  const visibleCategories = useMemo(() => categories.filter((value) => !categorySettings.hidden.includes(value)), [categories, categorySettings.hidden])
  const totalPages = Math.max(1, Math.ceil(results.length / PAGE_SIZE))
  const pageCases = useMemo(() => results.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE), [page, results])

  useEffect(() => { setPage(1); setSelected(null) }, [category, query])
  useEffect(() => { if (page > totalPages) setPage(totalPages) }, [page, totalPages])

  if (!open) return null

  const beginDrag = (event: DragEvent, item: PromptLibraryCase) => {
    event.dataTransfer.effectAllowed = 'copy'
    event.dataTransfer.setData('application/x-disy-prompt-case', JSON.stringify(item))
    event.dataTransfer.setData('text/plain', item.prompt)
  }

  const deleteCase = (item: PromptLibraryCase) => {
    if (!window.confirm(`确认从灵感案例中删除「${item.title}」吗？此操作仅影响当前浏览器，可在刷新数据后恢复公共案例。`)) return
    if (String(item.id).startsWith('custom-')) {
      const next = customCases.filter((current) => current.id !== item.id)
      saveCustomCases(next); setCustomCases(next)
    } else {
      const next = Array.from(new Set([...hiddenCaseIds, String(item.id)]))
      localStorage.setItem(HIDDEN_CASES_KEY, JSON.stringify(next)); setHiddenCaseIds(next)
    }
    setSelected(null)
  }

  const deleteCategory = (value: string) => {
    const nextSettings = { ...categorySettings, hidden: Array.from(new Set([...categorySettings.hidden, value])) }
    localStorage.setItem(CATEGORY_SETTINGS_KEY, JSON.stringify(nextSettings)); setCategorySettings(nextSettings)
    if (category === value) setCategory('all')
  }

  const renameCategory = (value: string) => {
    const nextName = categoryDraft.trim()
    if (!nextName) return
    const nextSettings = { ...categorySettings, names: { ...categorySettings.names, [value]: nextName } }
    localStorage.setItem(CATEGORY_SETTINGS_KEY, JSON.stringify(nextSettings)); setCategorySettings(nextSettings)
    setEditingCategory(null); setCategoryDraft('')
  }

  const categoryName = (value: string) => categorySettings.names[value] || value

  return (
    <div className="prompt-library-backdrop" onMouseDown={onClose} onDragEnter={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy' }} onDrop={(event) => { event.preventDefault(); const payload = event.dataTransfer.getData('application/x-disy-prompt-case'); if (payload) onAddImage(JSON.parse(payload) as PromptLibraryCase) }}>
      <section className="prompt-library-panel" role="dialog" aria-modal="true" aria-labelledby="prompt-library-title" onMouseDown={(event) => event.stopPropagation()} onDragOver={(event) => { event.preventDefault(); event.stopPropagation(); event.dataTransfer.dropEffect = 'copy' }} onDrop={(event) => event.stopPropagation()}>
        <header className="prompt-library-header">
          <div className="prompt-library-heading"><span><BookOpen size={18} /></span><div><h2 id="prompt-library-title">提示库</h2><small>{catalog ? `${catalog.totalCases} 个灵感案例` : '正在加载案例'}</small></div></div>
          <div className="prompt-header-actions"><button type="button" className="prompt-create-button" onClick={() => { setCreatorCategoryOpen(false); setCreatorOpen(true) }}><Plus size={14} />添加我的案例</button><button type="button" aria-label="关闭提示库" onClick={onClose}><X size={18} /></button></div>
        </header>

          <div className="prompt-library-search-row">
          <div className="prompt-library-view-tabs"><span>灵感案例</span><b>{results.length}</b></div>
          <label><Search size={15} /><input autoFocus value={query} placeholder="搜索案例、风格或 Prompt" onChange={(event) => setQuery(event.target.value)} /></label>
          <span>{results.length} 个匹配</span>
        </div>

        <div className="prompt-library-filter-strip">
          <div><strong>分类</strong><div className="prompt-filter-chips"><button className={category === 'all' ? 'is-active' : ''} onClick={() => setCategory('all')}>全部</button>{visibleCategories.map((value) => <button key={value} className={category === value ? 'is-active' : ''} onClick={() => setCategory(value)}>{categoryName(value)}</button>)}<button className={`prompt-category-manage-trigger ${categoryManagerOpen ? 'is-open' : ''}`} onClick={() => { setCategoryManagerOpen((open) => !open); setEditingCategory(null); setPendingDeleteCategory(null) }}><Settings2 size={12} />管理分类</button></div></div>
          {categoryManagerOpen && <div className="prompt-category-manager"><header><div><strong>管理分类</strong><small>改名或移除筛选项，案例仍保留在“全部”中</small></div><button type="button" aria-label="关闭分类管理" onClick={() => setCategoryManagerOpen(false)}><X size={14} /></button></header><div className="prompt-category-manager-list">{categories.map((value) => { const hidden = categorySettings.hidden.includes(value); const editing = editingCategory === value; const confirming = pendingDeleteCategory === value; return <div className={`prompt-category-manager-row ${hidden ? 'is-hidden' : ''}`} key={value}><span className="prompt-category-status" />{editing ? <input autoFocus value={categoryDraft} onChange={(event) => setCategoryDraft(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') renameCategory(value); if (event.key === 'Escape') setEditingCategory(null) }} /> : <div><strong>{categoryName(value)}</strong><small>{hidden ? '已从筛选中移除' : '正在使用'}</small></div>}{confirming ? <div className="prompt-category-confirm"><span>确定移除？</span><button onClick={() => setPendingDeleteCategory(null)}>取消</button><button className="is-danger" onClick={() => { deleteCategory(value); setPendingDeleteCategory(null) }}>移除</button></div> : hidden ? <button className="prompt-category-restore" onClick={() => { const nextSettings = { ...categorySettings, hidden: categorySettings.hidden.filter((item) => item !== value) }; localStorage.setItem(CATEGORY_SETTINGS_KEY, JSON.stringify(nextSettings)); setCategorySettings(nextSettings) }}>恢复</button> : <div className="prompt-category-row-actions">{editing ? <><button onClick={() => setEditingCategory(null)}>取消</button><button className="is-primary" onClick={() => renameCategory(value)}>保存</button></> : <><button onClick={() => { setEditingCategory(value); setCategoryDraft(categoryName(value)); setPendingDeleteCategory(null) }}>重命名</button><button className="is-danger" onClick={() => { setPendingDeleteCategory(value); setEditingCategory(null) }}>移除</button></>}</div>}</div> })}</div></div>}
        </div>

        <div className={`prompt-library-content ${selected ? 'has-detail' : ''}`}>
          <div className="prompt-case-grid">
            {error && <div className="prompt-library-state"><BookOpen size={28} /><strong>{error}</strong></div>}
            {!catalog && !error && <div className="prompt-library-state"><span className="prompt-library-spinner" /><strong>正在载入压缩案例图…</strong></div>}
            {catalog && !results.length && <div className="prompt-library-state"><Search size={28} /><strong>没有找到匹配案例</strong><span>试试减少筛选条件</span></div>}
            {pageCases.map((item) => (
              <article key={item.id} className={`prompt-case-card ${selected?.id === item.id ? 'is-selected' : ''}`} draggable onDragStart={(event) => beginDrag(event, item)} onClick={() => setSelected(item)}>
                <div className="prompt-case-image"><img loading="lazy" decoding="async" src={item.image} alt={item.title} /><button type="button" className="prompt-case-remove" title="从灵感案例移除" onClick={(event) => { event.stopPropagation(); deleteCase(item) }}><Trash2 size={13} /></button></div>
                <div className="prompt-case-copy"><strong>{item.title}</strong><small>{categoryName(item.category)}</small><p>{item.prompt}</p></div>
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
            <div className="prompt-detail-title"><div><small>{selected.industry ? '行业灵感' : selected.sourceLabel === '我的创作' ? '我的创作' : `CASE ${selected.id}`}</small><h3>{selected.title}</h3></div><div className="prompt-detail-title-actions">{selected.sourceUrl && <a href={selected.sourceUrl} target="_blank" rel="noreferrer" title="查看原始来源"><ArrowUpRight size={16} /></a>}<button type="button" title="从灵感案例移除" onClick={() => deleteCase(selected)}><Trash2 size={15} /></button></div></div>
            <div className="prompt-detail-tags"><span>{selected.category}</span></div>
            <div className="prompt-detail-prompt"><div><strong>Prompt</strong><button onClick={async () => { await navigator.clipboard.writeText(selected.prompt); setCopied(true); window.setTimeout(() => setCopied(false), 1400) }}>{copied ? <Check size={13} /> : <Copy size={13} />}{copied ? '已复制' : '复制'}</button></div><p>{selected.prompt}</p></div>
            <div className="prompt-detail-actions"><button onClick={() => onUsePrompt(selected)}><BookOpen size={15} />一键复刻同款</button><button onClick={() => onAddImage(selected)}><ImagePlus size={15} />加入画布</button></div>
            <footer>案例来自 <a href={selected.sourceUrl || selected.githubUrl} target="_blank" rel="noreferrer">{selected.sourceLabel || '原项目收录来源'}</a>。使用前请自行确认原作者授权。</footer>
          </aside>}
        </div>
      </section>
      {creatorOpen && <div className="prompt-creator-backdrop" onMouseDown={() => setCreatorOpen(false)}><form className="prompt-creator-dialog" onMouseDown={(event) => event.stopPropagation()} onSubmit={(event) => {
        event.preventDefault()
        if (!draft.title.trim() || !draft.prompt.trim() || !draft.image) return
        const selectedCategory = draft.category.trim() || '未分类'
        const item: PromptLibraryCase = { id: `custom-${crypto.randomUUID()}`, title: draft.title.trim(), prompt: draft.prompt.trim(), image: draft.image, category: selectedCategory, styles: [], scenes: [], featured: false, sourceLabel: '我的创作' }
        const next = [item, ...customCases]
        try {
          saveCustomCases(next); setCustomCases(next)
          if (!SYSTEM_CATEGORIES.includes(selectedCategory) && !customCategories.includes(selectedCategory)) { const nextCategories = [...customCategories, selectedCategory]; localStorage.setItem(CUSTOM_CATEGORIES_KEY, JSON.stringify(nextCategories)); setCustomCategories(nextCategories) }
          setSelected(item); setCreatorOpen(false); setDraft({ title: '', prompt: '', category: '', image: '' })
        } catch { setError('本地空间不足，请减少自定义案例或使用更小的参考图') }
      }}><header><div><small>MY PROMPT</small><h3>添加我的案例</h3></div><button type="button" onClick={() => setCreatorOpen(false)}><X size={17} /></button></header><label className="prompt-upload-field">{draft.image ? <img src={draft.image} alt="参考图预览" /> : <><Upload size={20} /><strong>上传参考图</strong><small>会自动压缩为最长边 640px WebP</small></>}<input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (file) void compressReference(file).then((image) => setDraft((current) => ({ ...current, image }))) }} /></label><label>案例名称<input value={draft.title} onChange={(event) => setDraft((current) => ({ ...current, title: event.target.value }))} /></label><label>Prompt<textarea value={draft.prompt} onChange={(event) => setDraft((current) => ({ ...current, prompt: event.target.value }))} /></label><div className="prompt-creator-fields"><label>分类（支持自建）<div className={`prompt-category-select ${creatorCategoryOpen ? 'is-open' : ''}`}><div><input role="combobox" aria-expanded={creatorCategoryOpen} aria-controls={creatorCategoryMenuId} aria-autocomplete="list" value={draft.category} placeholder="选择或输入新分类" onFocus={() => setCreatorCategoryOpen(true)} onKeyDown={(event) => { if (event.key === 'Escape') setCreatorCategoryOpen(false); if (event.key === 'ArrowDown') setCreatorCategoryOpen(true) }} onChange={(event) => { setDraft((current) => ({ ...current, category: event.target.value })); setCreatorCategoryOpen(true) }} /><button type="button" aria-label="展开分类" aria-expanded={creatorCategoryOpen} onClick={() => setCreatorCategoryOpen((value) => !value)}><ChevronDown size={14} /></button></div>{creatorCategoryOpen && <div id={creatorCategoryMenuId} className="prompt-category-select-menu" role="listbox">{categories.map((value) => <button type="button" role="option" aria-selected={draft.category === value} className={draft.category === value ? 'is-selected' : ''} key={value} onMouseDown={(event) => event.preventDefault()} onClick={() => { setDraft((current) => ({ ...current, category: value })); setCreatorCategoryOpen(false) }}><span>{categoryName(value)}</span>{draft.category === value && <Check size={13} />}</button>)}</div>}</div></label></div><footer><button type="button" onClick={() => setCreatorOpen(false)}>取消</button><button type="submit" disabled={!draft.title.trim() || !draft.prompt.trim() || !draft.image}>保存到灵感案例</button></footer></form></div>}
    </div>
  )
}
