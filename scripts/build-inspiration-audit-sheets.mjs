import sharp from 'sharp'
import { mkdir, readFile } from 'node:fs/promises'
import { join } from 'node:path'

const catalog = JSON.parse(await readFile('public/prompt-library/catalog.json', 'utf8'))
const outputDir = '.tmp/inspiration-audit'
await mkdir(outputDir, { recursive: true })

const cellWidth = 260
const cellHeight = 310
const columns = 5
const rows = 4

for (let page = 0; page < Math.ceil(catalog.cases.length / (columns * rows)); page += 1) {
  const items = catalog.cases.slice(page * columns * rows, (page + 1) * columns * rows)
  const composites = []
  for (const [index, item] of items.entries()) {
    const x = (index % columns) * cellWidth
    const y = Math.floor(index / columns) * cellHeight
    const imagePath = join('public', item.image.replace(/^\//, ''))
    const thumbnail = await sharp(imagePath).rotate().resize({ width: 240, height: 248, fit: 'contain', background: '#171918' }).png().toBuffer()
    const label = Buffer.from(`<svg width="240" height="48" xmlns="http://www.w3.org/2000/svg"><rect width="240" height="48" fill="#111312"/><text x="8" y="17" fill="#8fc7ff" font-size="12" font-family="Arial">${item.id.replace('local-reference-', '')}</text><text x="8" y="37" fill="white" font-size="14" font-family="Microsoft YaHei,Arial">${item.title.replaceAll('&', '&amp;')}</text></svg>`)
    composites.push({ input: thumbnail, left: x + 10, top: y + 6 }, { input: label, left: x + 10, top: y + 256 })
  }
  const destination = join(outputDir, `sheet-${page + 1}.jpg`)
  await sharp({ create: { width: columns * cellWidth, height: rows * cellHeight, channels: 3, background: '#0b0d0c' } }).composite(composites).jpeg({ quality: 90 }).toFile(destination)
  console.log(destination)
}
