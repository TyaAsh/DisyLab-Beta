import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

const ids = [451, 317]
const catalogUrl = new URL('../public/prompt-library/catalog.json', import.meta.url)
const catalog = JSON.parse(await readFile(catalogUrl, 'utf8'))
const source = JSON.parse(await readFile(new URL('./cases.source.json', import.meta.url), 'utf8'))

for (const id of ids) {
  const item = source.cases.find((value) => value.id === id)
  if (!item || catalog.cases.some((value) => value.id === id)) continue
  const sourceImage = fileURLToPath(new URL(`./case${id}.source.jpg`, import.meta.url))
  const targetImage = fileURLToPath(new URL(`../public/prompt-library/images/case-${id}.webp`, import.meta.url))
  await sharp(sourceImage).rotate().resize({ width: 360, height: 360, fit: 'inside', withoutEnlargement: true }).webp({ quality: 50, effort: 6 }).toFile(targetImage)
  catalog.cases.push({ ...item, image: `/prompt-library/images/case-${id}.webp` })
}
catalog.cases.sort((a, b) => Number(b.id) - Number(a.id))
catalog.totalCases = catalog.cases.length
await writeFile(catalogUrl, JSON.stringify(catalog), 'utf8')
console.log(`Restored approved advertising cases; ${catalog.totalCases} cases remain`)
