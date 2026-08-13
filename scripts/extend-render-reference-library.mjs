import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const catalogPath = join(root, 'public/prompt-library/catalog.json')
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))

// Curated one by one. Deliberately excludes revealing portraits, generic filler,
// duplicate references already used by the branded/vertical collections, and
// cases whose image does not clearly support the title.
const productIds = [
  517, 516, 485, 470, 462, 455, 454, 441, 424, 365,
  358, 327, 265, 264, 237, 194, 192, 189, 178, 150,
  142, 494, 386, 367, 333, 332, 310, 503, 444, 406,
  378, 459, 453, 417, 478, 487, 477, 419, 447, 407,
  380, 222, 218, 160, 469,
]

const sceneIds = [
  493, 448, 422, 413, 395, 394, 392, 390, 329, 324,
  238, 224, 182, 489, 369, 274, 211, 11, 515, 511,
  497, 474, 464, 445, 433, 431, 401, 298, 286, 278,
  307, 304, 279, 418, 230, 229, 223, 220, 53, 29,
  414, 472, 408, 450, 440,
]

const existingWithoutRenderExpansion = (catalog.industryCases || []).filter(
  (item) => !String(item.id).startsWith('industry-product-render-') && !String(item.id).startsWith('industry-scene-render-'),
)
const occupiedImages = new Set(existingWithoutRenderExpansion.map((item) => item.image))

const getCase = (id) => {
  const item = catalog.cases.find((candidate) => candidate.id === id)
  if (!item) throw new Error(`Missing curated source case ${id}`)
  if (occupiedImages.has(item.image)) throw new Error(`Curated image is already used by an industry card: case ${id}`)
  occupiedImages.add(item.image)
  return item
}

const cleanTitle = (title) => String(title).replace(/\s+/g, ' ').trim()
const productPrompt = (item) => `以“${cleanTitle(item.title)}”参考图为品质与构图基准，为[产品名称]制作一张可直接用于商业提案的产品渲染。准确呈现产品比例、结构、材质、接缝、倒角与品牌留白，使用可控摄影棚布光、真实接触阴影和克制反射；主视觉清楚，必要时补充微距细节、功能拆解或包装组合。整体高级、可信、不过度堆砌，不复制参考图中的商标和专有文案。画幅、主色、产品名称与卖点均可编辑。`
const scenePrompt = (item) => `以“${cleanTitle(item.title)}”参考图为空间语言与氛围基准，为[项目名称]制作一张高完成度场景/建筑渲染。明确建筑或空间体块、尺度、动线、材质交界、家具与环境关系，采用符合时段的自然光和物理正确阴影；保留可读的前景、中景、远景层次与真实生活细节。整体克制、专业、有高级感，不复制参考图中的地标商标和专有文字。地点、建筑类型、时段、天气、材质与镜头均可编辑。`

const toIndustry = (item, index, kind) => ({
  id: `industry-${kind === 'product' ? 'product-render' : 'scene-render'}-${String(index + 1).padStart(2, '0')}`,
  title: cleanTitle(item.title),
  image: item.image,
  // Use the unique gallery anchor as the canonical audit URL. The original
  // creator URL remains visible in the source label where available.
  sourceUrl: item.githubUrl || item.sourceUrl,
  sourceLabel: item.sourceLabel ? `${item.sourceLabel} · 公开案例归档` : '公开案例归档',
  category: kind === 'product' ? '产品渲染' : '场景与建筑渲染',
  styles: kind === 'product' ? ['产品', '渲染', '商业'] : ['场景', '建筑', '渲染'],
  scenes: kind === 'product' ? ['商业', '工业设计'] : ['建筑', '空间设计'],
  featured: false,
  industry: true,
  prompt: kind === 'product' ? productPrompt(item) : scenePrompt(item),
})

const productCases = productIds.map((id, index) => toIndustry(getCase(id), index, 'product'))
const sceneCases = sceneIds.map((id, index) => toIndustry(getCase(id), index, 'scene'))
catalog.industryCases = [...existingWithoutRenderExpansion, ...productCases, ...sceneCases]
await writeFile(catalogPath, JSON.stringify(catalog), 'utf8')

console.log(`Render references: ${productCases.length} product + ${sceneCases.length} scene/architecture`)
