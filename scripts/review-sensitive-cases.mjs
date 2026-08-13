import sharp from 'sharp'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ids = [505, 492, 467, 465, 463, 451, 414, 412, 399, 382, 349, 328, 326, 321, 317, 305, 284, 272, 240, 224, 221, 200, 199, 198, 187, 35]
const catalog = JSON.parse(await readFile(new URL('../public/prompt-library/catalog.json', import.meta.url), 'utf8'))
const cells = []
for (const id of ids) {
  const item = catalog.cases.find((value) => value.id === id)
  if (!item) continue
  const image = await sharp(fileURLToPath(new URL(`../public${item.image}`, import.meta.url))).resize(180, 150, { fit: 'contain', background: '#111' }).png().toBuffer()
  const caption = await sharp({ create: { width: 180, height: 30, channels: 4, background: '#191c1a' } }).composite([{ input: Buffer.from(`<svg width="180" height="30"><text x="8" y="20" fill="white" font-size="13">${id} ${item.title.replaceAll('&', '&amp;').slice(0, 14)}</text></svg>`) }]).png().toBuffer()
  cells.push(await sharp({ create: { width: 180, height: 180, channels: 4, background: '#111' } }).composite([{ input: image, top: 0, left: 0 }, { input: caption, top: 150, left: 0 }]).png().toBuffer())
}
const columns = 5
const rows = Math.ceil(cells.length / columns)
await sharp({ create: { width: columns * 180, height: rows * 180, channels: 4, background: '#0b0d0c' } }).composite(cells.map((input, index) => ({ input, left: index % columns * 180, top: Math.floor(index / columns) * 180 }))).png().toFile(fileURLToPath(new URL('../sensitive-review.png', import.meta.url)))
