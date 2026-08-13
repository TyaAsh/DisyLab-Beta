import { readFile, unlink, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

// DisyLab editorial policy: exclude sexualized, revealing, voyeuristic, or body-gaze-led cases,
// including photography, illustration, anime, 3D characters, advertising, and UI mockups.
const excludedIds = new Set([505, 492, 467, 465, 463, 509, 468, 451, 328, 326, 321, 305, 284, 282, 277, 272, 255, 240, 221, 217, 214, 207, 202, 200, 199, 198, 187, 146, 330, 288, 257, 256, 249, 127, 80, 79])
const genericTitle = /^(图像生成案例图|主题海报版式设计|建筑空间场景图|建筑空间场景渲染|界面交互设计图|信息图可视化设计|应用界面样机图|插画艺术创作图|插画艺术风格创作|人物角色设定图|写实摄影风格图|电商商品展示设计|品牌视觉识别图)$/
const catalogUrl = new URL('../public/prompt-library/catalog.json', import.meta.url)
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'))

for (const item of catalog.cases) if (genericTitle.test(item.title)) excludedIds.add(Number(item.id))
catalog.cases = catalog.cases.filter((item) => !excludedIds.has(Number(item.id)))
catalog.totalCases = catalog.cases.length
catalog.templates = (catalog.templates || []).map((item) => item.image === '/prompt-library/images/case-330.webp'
  ? { ...item, image: '/prompt-library/images/case-422.webp' }
  : item)

for (const id of excludedIds) {
  try { await unlink(fileURLToPath(new URL(`../public/prompt-library/images/case-${id}.webp`, import.meta.url))) } catch { /* already absent */ }
}

await writeFile(catalogUrl, JSON.stringify(catalog), 'utf8')
console.log(`Excluded ${excludedIds.size} cases; ${catalog.totalCases} remain`)
