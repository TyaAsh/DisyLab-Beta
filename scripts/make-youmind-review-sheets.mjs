import fs from 'node:fs/promises'
import path from 'node:path'
import sharp from 'sharp'

const catalog = JSON.parse(await fs.readFile('public/prompt-library/catalog.json', 'utf8'))
const cases = catalog.cases || []
const columns = 6
const rows = 8
const cellWidth = 170
const cellHeight = 150
await fs.mkdir('scripts/youmind-review', { recursive: true })
for (let offset = 0; offset < cases.length; offset += columns * rows) {
  const page = cases.slice(offset, offset + columns * rows)
  const composites = []
  for (let index = 0; index < page.length; index += 1) {
    const item = page[index]
    const input = path.join('public', item.image.replace(/^\//, ''))
    const thumb = await sharp(input).resize(150, 112, { fit: 'contain', background: '#111' }).jpeg({ quality: 72 }).toBuffer()
    const x = (index % columns) * cellWidth + 10
    const y = Math.floor(index / columns) * cellHeight + 8
    composites.push({ input: thumb, left: x, top: y })
    const label = Buffer.from(`<svg width="150" height="24"><rect width="150" height="24" fill="#111"/><text x="3" y="16" fill="white" font-size="10" font-family="Arial">${String(item.id).replace(/[&<>]/g, '')}</text></svg>`)
    composites.push({ input: label, left: x, top: y + 114 })
  }
  await sharp({ create: { width: columns * cellWidth, height: rows * cellHeight, channels: 3, background: '#181818' } })
    .composite(composites).jpeg({ quality: 80 }).toFile(`scripts/youmind-review/sheet-${offset / (columns * rows) + 1}.jpg`)
}
