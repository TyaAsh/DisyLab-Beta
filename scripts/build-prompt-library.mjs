import { mkdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const root = process.cwd()
const sourceRoot = path.join(root, '.tmp-prompt-source')
const sourceImageRoot = path.join(sourceRoot, 'data', 'images')
const outputRoot = path.join(root, 'public', 'prompt-library')
const outputImageRoot = path.join(outputRoot, 'images')
const source = JSON.parse(await readFile(path.join(sourceRoot, 'data', 'cases.json'), 'utf8'))
const excludedIds = new Set([505, 492, 467, 465, 463, 509, 468, 451, 328, 326, 321, 305, 284, 282, 277, 272, 255, 240, 221, 217, 214, 207, 202, 200, 199, 198, 187, 146, 330, 288, 257, 256, 249, 127, 80, 79])
const genericTitle = /^(图像生成案例图|主题海报版式设计|建筑空间场景图|建筑空间场景渲染|界面交互设计图|信息图可视化设计|应用界面样机图|插画艺术创作图|插画艺术风格创作|人物角色设定图|写实摄影风格图|电商商品展示设计|品牌视觉识别图)$/

await mkdir(outputImageRoot, { recursive: true })

const cases = []
for (const item of source.cases) {
  if (excludedIds.has(Number(item.id)) || genericTitle.test(item.title)) continue
  const sourceName = String(item.image || '').split('/').pop()
  if (!sourceName) continue
  const outputName = `case-${item.id}.webp`
  try {
    await sharp(path.join(sourceImageRoot, sourceName))
      .rotate()
      .resize({ width: 360, height: 360, fit: 'inside', withoutEnlargement: true })
      .webp({ quality: 50, effort: 6, smartSubsample: true })
      .toFile(path.join(outputImageRoot, outputName))
  } catch (error) {
    console.warn(`Skipping image ${sourceName}: ${error instanceof Error ? error.message : String(error)}`)
    continue
  }
  cases.push({
    id: item.id,
    title: item.title,
    image: `/prompt-library/images/${outputName}`,
    sourceLabel: item.sourceLabel,
    sourceUrl: item.sourceUrl,
    prompt: item.prompt,
    category: item.category,
    styles: item.styles || [],
    scenes: item.scenes || [],
    featured: Boolean(item.featured),
    githubUrl: item.githubUrl,
  })
}

await writeFile(path.join(outputRoot, 'catalog.json'), JSON.stringify({
  repository: source.repository,
  totalCases: cases.length,
  categories: source.categories,
  styles: source.styles,
  scenes: source.scenes,
  cases,
}), 'utf8')

console.log(`Prompt library: ${cases.length} cases written to ${outputRoot}`)
