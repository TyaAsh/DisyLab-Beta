import sharp from 'sharp'
import { cp, mkdir, readdir, writeFile } from 'node:fs/promises'
import { extname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const sourceDir = 'E:\\资料库'
const destinationDir = join(root, 'public', 'prompt-library', 'local')
const catalogPath = join(root, 'public', 'prompt-library', 'catalog.json')
const allowedExtensions = new Set(['.jpg', '.jpeg', '.png'])
const maxDimension = 1024

const walk = async (directory) => {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name)
    if (entry.isDirectory()) return walk(path)
    return allowedExtensions.has(extname(entry.name).toLowerCase()) ? [path] : []
  }))
  return nested.flat()
}

const threeDIndexes = new Set([1, 2, 3, 4, 11, 13, 16, 17, 22, 25, 29, 35, 36, 37, 39, 40, 43, 48])
const peopleIndexes = new Set([8, 9, 10, 12, 20, 23, 26, 28, 31, 32, 41, 42, 45])
const characterIndexes = new Set([5, 6, 7, 14, 15, 18, 21, 24, 27, 30, 33, 34, 44, 46, 47, 49, 50, 51, 52, 53, 54])

const categoryFor = (index) => threeDIndexes.has(index)
  ? '3D视觉'
  : peopleIndexes.has(index)
    ? '人物海报'
    : characterIndexes.has(index)
      ? '角色设计'
      : '金融科技'

const subjectFor = (category) => ({
  '金融科技': '金融产品界面、数据图形与活动权益信息',
  '人物海报': '人物、产品道具与品牌信息',
  '角色设计': '品牌角色、吉祥物、服装与场景道具',
  '3D视觉': '三维产品、抽象装置、图标与空间光效',
}[category])

const promptFor = (category) => `视觉方向：以参考图的商业视觉语言为基准，创作高级、清晰、可落地的${category}成品图。

主体与元素：围绕${subjectFor(category)}展开；提炼参考图中的核心形状、符号、辅助图形与信息层级，但不复刻原有品牌名称、Logo、人物肖像或版权角色。

构图与层级：延续参考图的画幅比例、主体位置、前中后景关系与留白节奏；标题区、卖点区、行动区层次明确，保证缩略图下仍可快速识别。

色彩与光影：保留参考图的主辅色比例、明暗对比和氛围光方向；使用统一色温与克制的高光，避免杂色与过曝。

材质与质感：准确表现参考图中的金属、玻璃、塑料、纸张、织物或数字界面质感；边缘干净，细节清晰，避免低清噪点、变形文字和生成瑕疵。

文字与规范：所有新文案使用简体中文，品牌、数据、价格与活动规则均用可替换的虚构内容；不作收益承诺，不使用未经授权的商标。`

const main = async () => {
  const files = (await walk(sourceDir)).sort((left, right) => left.localeCompare(right, 'zh-CN'))
  await mkdir(destinationDir, { recursive: true })
  const cases = []

  for (const [zeroIndex, source] of files.entries()) {
    const index = zeroIndex + 1
    const metadata = await sharp(source).rotate().metadata()
    const extension = extname(source).toLowerCase() === '.png' ? 'png' : 'jpg'
    const filename = `local-${String(index).padStart(3, '0')}.${extension}`
    const destination = join(destinationDir, filename)
    const largestEdge = Math.max(metadata.width || 0, metadata.height || 0)
    if (largestEdge > maxDimension) {
      const image = sharp(source).rotate().resize({ width: maxDimension, height: maxDimension, fit: 'inside', withoutEnlargement: true })
      if (extension === 'png') await image.png({ compressionLevel: 9, adaptiveFiltering: true }).toFile(destination)
      else await image.jpeg({ quality: 92, mozjpeg: true }).toFile(destination)
    } else {
      await cp(source, destination)
    }
    const category = categoryFor(index)
    cases.push({
      id: `local-reference-${String(index).padStart(3, '0')}`,
      title: `本地资料参考 ${String(index).padStart(2, '0')}｜${category}`,
      image: `/prompt-library/local/${filename}`,
      sourceLabel: '本地资料库',
      category,
      styles: [],
      scenes: [],
      featured: false,
      prompt: promptFor(category),
    })
  }

  const catalog = {
    repository: '本地资料库',
    totalCases: cases.length,
    categories: ['金融科技', '人物海报', '角色设计', '3D视觉'],
    styles: [],
    scenes: [],
    cases,
    templates: [],
    industryCases: [],
  }
  await writeFile(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')
  console.log(`Imported ${cases.length} local references; max image edge: ${maxDimension}px; output: PNG/JPEG only.`)
}

await main()
