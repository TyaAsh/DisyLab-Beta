import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const sourceDir = join(root, 'scripts', 'industry-source')
const markets = ['sg', 'au', 'hk', 'nz']
const decode = (value) => value
  .replaceAll('&quot;', '"').replaceAll('&amp;', '&')
  .replaceAll('&#x27;', "'").replaceAll('&lt;', '<').replaceAll('&gt;', '>')

const campaigns = []
for (const market of markets) {
  const html = decode(await readFile(join(sourceDir, `tiger-${market}.html`), 'utf8'))
  const pieces = html.split('{"materialInfo":').slice(1)
  for (const piece of pieces) {
    const end = piece.indexOf(',"materialSettings"')
    if (end < 0) continue
    try {
      const info = JSON.parse(piece.slice(0, end))
      const image = info.personalizedConfig?.pcImage || info.image
      const title = info.titleTextHint || info.materialName
      const href = info.personalizedConfig?.pcJumpUrl || info.linkAddrLink
      if (!image || !title) continue
      campaigns.push({
        market,
        id: String(info.materialId),
        title: title.replace(/<[^>]+>/g, '').trim(),
        description: String(info.text || '').replace(/<[^>]+>/g, '').trim(),
        image,
        sourceUrl: href || `https://www.itiger.com/${market}/market/promotion#campaign-${info.materialId}`,
      })
    } catch {}
  }
}

const unique = [...new Map(campaigns.map((item) => [`${item.market}-${item.id}`, item])).values()]
await writeFile(join(sourceDir, 'tiger-campaigns.json'), JSON.stringify(unique, null, 2), 'utf8')
if (process.argv.includes('--download')) {
  await Promise.all(unique.map(async (item) => {
    const response = await fetch(item.image)
    if (!response.ok) throw new Error(`${response.status} ${item.image}`)
    await writeFile(join(sourceDir, `tiger-${item.market}-${item.id}.source`), Buffer.from(await response.arrayBuffer()))
  }))
}
console.log(`Extracted ${unique.length} Tiger campaigns`)
console.log(unique.map((item) => `${item.market}\t${item.id}\t${item.title}\t${item.image}`).join('\n'))
