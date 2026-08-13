import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const outputDir = join(root, 'public/prompt-library/industry')
const cacheDir = join(root, 'scripts/industry-source')
const catalogPath = join(root, 'public/prompt-library/catalog.json')
const api = 'https://www.shiqijituan.com:8989/imageAndVideo/selectImageAndVideoByPage'
const portfolio = 'https://www.shiqi.top/portfolio.html'
await mkdir(outputDir, { recursive: true })
await mkdir(cacheDir, { recursive: true })

const titleById = new Map(Object.entries({
  30:'山系露营装备概念',31:'Ho_oK 个人形象 2.0',32:'MAGIC MAIMAI 奇妙麦麦',33:'A TOY GUN 玩具造型',34:'兔子玩偶成长叙事',35:'Viki 角色设计',36:'GADGET TRIAL PAPA',37:'黑猫关怀装置',38:'兽耳元气男生设定',39:'YOUR BOY & MY GIRL',40:'小蜗机车',41:'蘑菇小屋',42:'西域舞女',43:'三人造型设计',44:'机械生物体',46:'血肉机械玄学体',47:'螺丝武士',48:'CyBER SRGB 运动团体',49:'士气乒乓球拍',50:'异常能量勘测钟',51:'士气玩具制造',52:'山魈基因突变工程',53:'Angel 天使角色',54:'士气大学实验室',55:'异鸟',56:'DoLaimi 室内迷思',58:'Stubbornness · Struggle · Survival',59:'Mr.Bone 太空计划',60:'士气家用飞行器',61:'出马系列 · 梅花式 PLUM',62:'次元穿梭机',63:'精神牌精油',64:"A Robot's Journey",65:'士气运动计划',66:'卡拉尔 Kalaer',67:'YOUR BOY & MY GIRL 系列',68:'泛用型仪容整备枪',69:'士气四足运货机器人',70:'元素机器人',71:'巨斧安保团',75:'士气狗奶托',76:'士气卡丁车',77:'TICK',78:'TUKKI 潮玩设计',79:'09号巡航摩托车',80:'上岸的第一条鱼',81:'春天发生器',82:'设计师创作流程',83:'赛博钟馗',84:'Head in the Clouds',85:'泛用性超渡仪',86:'异常能力勘测锚',87:'Animal 载具',88:'士气情人道具',89:'正装异能',90:'Snake',91:'唯梦绮行',92:'唯梦',93:'森林木人',94:'OOTD Sharing',95:'工业菩提',96:'OOTD',97:'龟兔后传',
}).map(([id, title]) => [Number(id), title]))

const response = await fetch(api, {
  method: 'POST',
  headers: { 'content-type': 'application/json;charset=utf-8' },
  body: JSON.stringify({ type: 8, pageIndex: 1, pageSize: 100 }),
})
if (!response.ok) throw new Error(`士气作品接口请求失败：${response.status}`)
const payload = await response.json()
const works = payload?.data?.list || []

// 人工审核排除：暴露/性暗示主题、情侣道具、舞女等；另排除空标题和明显不适合作为生产参考的条目。
const excludedIds = new Set([31, 38, 39, 42, 43, 46, 48, 53, 67, 88, 94, 96, 97])
const safeWorks = works
  .map((item) => ({ ...item, title: titleById.get(item.id) || `士气创意作品 ${item.id}`, authorName: '士气众创作者' }))
  .filter((item) => item.title && !excludedIds.has(item.id))
  .sort((a, b) => a.sort - b.sort || a.id - b.id)
  .slice(0, 50)

if (safeWorks.length < 50) throw new Error(`安全官方案例不足 50 条，目前 ${safeWorks.length} 条`)

const promptFor = (title, index) => {
  const directions = [
    '以成熟3D角色与潮玩品牌语言呈现，强调独特剪影、表情、服装和标志道具',
    '以产品概念渲染语言呈现，明确结构、功能分区、材质和真实尺度关系',
    '以品牌运营主视觉语言呈现，建立清晰标题层级、核心图形和可延展识别系统',
    '以世界观场景渲染语言呈现，组织前中后景、叙事线索、环境材质与电影感灯光',
    '以创意装置与IP联名语言呈现，兼顾艺术表达、商业落地、包装与社交传播',
  ]
  return `围绕「${title}」创作一套高级创意视觉，${directions[index % directions.length]}。画面保持克制、专业、细节可信，控制主色数量，避免低俗、性暗示与猎奇表达；参考图仅用于构图、材质和品质基准，不复制原有文字、Logo或角色版权元素。`
}

const seen = new Map()
const cases = []
for (let index = 0; index < safeWorks.length; index += 1) {
  const item = safeWorks[index]
  const key = `shiqi-official-${item.id}`
  const rawPath = join(cacheDir, `${key}.source`)
  const imagePath = join(outputDir, `${key}.webp`)
  let bytes
  try { bytes = await readFile(rawPath) } catch {
    const imageResponse = await fetch(encodeURI(item.url), { headers: { referer: portfolio } })
    if (!imageResponse.ok) throw new Error(`下载作品 ${item.id} 失败：${imageResponse.status}`)
    bytes = Buffer.from(await imageResponse.arrayBuffer())
    await writeFile(rawPath, bytes)
  }
  await sharp(bytes).rotate().resize({ width: 360, height: 360, fit: 'inside', withoutEnlargement: true }).webp({ quality: 47, effort: 6 }).toFile(imagePath)
  const pixels = await sharp(imagePath).resize(64, 64, { fit: 'contain', background: '#000' }).removeAlpha().raw().toBuffer()
  const hash = createHash('sha256').update(pixels).digest('hex')
  if (seen.has(hash)) throw new Error(`士气官方案例图片重复：${item.id} / ${seen.get(hash)}`)
  seen.set(hash, item.id)
  cases.push({
    id: `industry-shiqi-${item.id}`,
    title: item.title,
    image: `/prompt-library/industry/${key}.webp`,
    sourceUrl: `${portfolio}#work-${item.id}`,
    sourceLabel: `士气集团官方作品页 · ${item.authorName}`,
    category: '士气集团官方案例',
    styles: ['3D', '品牌', 'IP', '创意视觉'],
    scenes: ['商业', '运营', '创意产业'],
    featured: false,
    industry: true,
    prompt: promptFor(item.title, index),
  })
}

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
catalog.industryCases = [
  ...(catalog.industryCases || []).filter((item) => item.category !== '士气集团官方案例' && !String(item.sourceLabel || '').startsWith('士气集团官方作品页')),
  ...cases,
]
await writeFile(catalogPath, JSON.stringify(catalog), 'utf8')
await writeFile(join(cacheDir, 'shiqi-official-index.json'), JSON.stringify(safeWorks.map(({ id, title, authorName, url, sort }) => ({ id, title, authorName, url, sort })), null, 2), 'utf8')
const activeFiles = new Set(cases.map((item) => item.image.split('/').at(-1)))
for (const file of await readdir(outputDir)) {
  if (file.startsWith('shiqi-official-') && !activeFiles.has(file)) await rm(join(outputDir, file), { force: true })
}
console.log(`士气集团官方案例：${cases.length} 条，图片与来源均独立。`)
