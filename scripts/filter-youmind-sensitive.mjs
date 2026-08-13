import fs from 'node:fs/promises'
import path from 'node:path'

const excluded = new Set([
  'youmind-gpt-31327', 'youmind-gpt-31312', 'youmind-nano-30693',
  'youmind-nano-31265', 'youmind-nano-31256', 'youmind-nano-31160',
  'youmind-nano-30943', 'youmind-nano-30804', 'youmind-nano-30695',
  'youmind-nano-30544', 'youmind-gpt-31326', 'youmind-gpt-31236',
])
const catalogPath = path.resolve('public/prompt-library/catalog.json')
const catalog = JSON.parse(await fs.readFile(catalogPath, 'utf8'))
const removed = catalog.cases.filter((item) => excluded.has(item.id))
catalog.cases = catalog.cases.filter((item) => !excluded.has(item.id))
catalog.totalCases = catalog.cases.length
await fs.writeFile(catalogPath, `${JSON.stringify(catalog)}\n`, 'utf8')
const stillReferenced = new Set([...catalog.cases, ...(catalog.industryCases || [])].map((item) => item.image))
for (const item of removed) {
  if (stillReferenced.has(item.image)) continue
  try { await fs.unlink(path.join('public', item.image.replace(/^\//, ''))) } catch {}
}
console.log(`Removed ${removed.length} visually sensitive YouMind cases; ${catalog.cases.length} remain`)
