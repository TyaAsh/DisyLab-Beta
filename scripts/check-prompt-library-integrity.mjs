import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { access, readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const catalog = JSON.parse(await readFile(join(root, 'public/prompt-library/catalog.json'), 'utf8'))
const cases = catalog.cases || []
const urls = new Map()
const images = new Map()
const chinesePattern = /[\u3400-\u9fff]/

if ((catalog.industryCases || []).length) throw new Error('Industry cases must be merged into the inspiration collection')
if ((catalog.templates || []).length) throw new Error('Prompt templates must not be published')
if (JSON.stringify(catalog.categories) !== JSON.stringify(['金融科技', '视觉案例'])) throw new Error('Unexpected public categories')
if ((catalog.styles || []).length) throw new Error('Style filters must not be published')

const ids = new Set()
for (const item of cases) {
  if (ids.has(item.id)) throw new Error(`Duplicate inspiration id: ${item.id}`)
  ids.add(item.id)
  if (!item.image) throw new Error(`Inspiration case has no image: ${item.id}`)
  const imagePath = join(root, 'public', item.image.replace(/^\//, ''))
  await access(imagePath)
  if (!item.sourceUrl) throw new Error(`Inspiration case has no source URL: ${item.id}`)
  if (!item.prompt || !chinesePattern.test(item.prompt)) throw new Error(`Inspiration case needs an editable Chinese prompt: ${item.id}`)
  if (urls.has(item.sourceUrl)) throw new Error(`Duplicate source URL: ${item.id} / ${urls.get(item.sourceUrl)}`)
  urls.set(item.sourceUrl, item.id)
  const pixels = await sharp(imagePath).resize(64, 64, { fit: 'contain', background: '#000' }).removeAlpha().raw().toBuffer()
  const digest = createHash('sha256').update(pixels).digest('hex')
  if (images.has(digest)) throw new Error(`Duplicate reference image: ${item.id} / ${images.get(digest)}`)
  images.set(digest, item.id)
}

const fintechCount = cases.filter((item) => item.category === '金融科技').length
const visualCount = cases.filter((item) => item.category === '视觉案例').length
if (fintechCount < 50) throw new Error(`Fintech inspiration below quality floor: ${fintechCount}/50`)
if (visualCount < 155) throw new Error(`Visual inspiration below quality floor: ${visualCount}/155`)
if (cases.length !== fintechCount + visualCount) throw new Error('Inspiration cases use an unsupported category')

console.log(`Prompt library OK: ${cases.length} inspiration cases, no templates or separate industry collection`)
console.log(`Coverage: ${fintechCount} fintech, ${visualCount} visual cases`)
