import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const catalog = JSON.parse(await readFile(join(root, 'public/prompt-library/catalog.json'), 'utf8'))
const collections = [catalog.cases || [], catalog.templates || [], catalog.industryCases || []]
const industryUrls = new Map()
const industryImages = new Map()
const chinesePattern = /[\u3400-\u9fff]/

for (const [collectionIndex, items] of collections.entries()) {
  const ids = new Set()
  for (const item of items) {
    if (ids.has(item.id)) throw new Error(`Duplicate id in collection ${collectionIndex}: ${item.id}`)
    ids.add(item.id)
    if (collectionIndex !== 2) continue
    if (!item.image) throw new Error(`Industry case has no image: ${item.id}`)
    const imagePath = join(root, 'public', item.image.replace(/^\//, ''))
    await access(imagePath)
    if (!item.sourceUrl) throw new Error(`Industry case has no source URL: ${item.id}`)
    if (!item.prompt || !chinesePattern.test(item.prompt)) throw new Error(`Industry case needs an editable Chinese prompt: ${item.id}`)
    if (industryUrls.has(item.sourceUrl)) throw new Error(`Duplicate industry source URL: ${item.id} / ${industryUrls.get(item.sourceUrl)}`)
    industryUrls.set(item.sourceUrl, item.id)
    const pixels = await sharp(imagePath).resize(64, 64, { fit:'contain', background:'#000' }).removeAlpha().raw().toBuffer()
    const digest = createHash('sha256').update(pixels).digest('hex')
    if (industryImages.has(digest)) throw new Error(`Duplicate industry reference image: ${item.id} / ${industryImages.get(digest)}`)
    industryImages.set(digest, item.id)
  }
}

const fintechCount = (catalog.industryCases || []).filter((item) => item.category === '\u91d1\u878d\u79d1\u6280\u8fd0\u8425').length
const productRenderCount = (catalog.industryCases || []).filter((item) => item.category === '产品渲染').length
const sceneRenderCount = (catalog.industryCases || []).filter((item) => item.category === '场景与建筑渲染').length
if (productRenderCount < 45) throw new Error(`Product render references below quality floor: ${productRenderCount}/45`)
if (sceneRenderCount < 45) throw new Error(`Scene/architecture references below quality floor: ${sceneRenderCount}/45`)
if (fintechCount < 50) throw new Error(`Fintech operation references below quality floor: ${fintechCount}/50`)

console.log(`Prompt library OK: ${catalog.cases.length} cases, ${(catalog.templates || []).length} templates, ${(catalog.industryCases || []).length} unique industry cases`)
console.log(`Render coverage: ${productRenderCount} product, ${sceneRenderCount} scene/architecture`)
console.log(`Fintech operation coverage: ${fintechCount}`)
