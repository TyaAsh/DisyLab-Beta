import fs from 'node:fs/promises'
import path from 'node:path'

const cacheDir = path.resolve('scripts/youmind-api')
const rawDir = path.resolve('scripts/youmind-raw')
await fs.mkdir(rawDir, { recursive: true })
const files = (await fs.readdir(cacheDir)).filter((name) => name.endsWith('.json')).sort()
const blocked = /(?:nude|naked|cleavage|breast|boob|lingerie|bikini|swimsuit|underwear|seductive|sexy|erotic|nsfw|fetish|upskirt|female body|curvy body|provocative|sensual|young woman|beautiful woman|attractive woman|female model|anime girl|schoolgirl|girl portrait|woman portrait|袒胸|裸露|内衣|比基尼|泳装|性感|情色|性暗示|凝视女性)/i
const urls = new Set()
for (const file of files) {
  const payload = JSON.parse(await fs.readFile(path.join(cacheDir, file), 'utf8'))
  for (const item of payload.prompts || []) {
    const prompt = `${item.title || ''} ${item.description || ''} ${item.translatedContent || ''} ${item.content || ''}`
    const url = item.mediaThumbnails?.[0] || item.media?.[0]
    if (!url || blocked.test(prompt) || prompt.trim().length < 70) continue
    urls.add(url)
  }
}
const selected = [...urls].slice(0, 760)
const config = selected.flatMap((url) => {
  const filename = new URL(url).pathname.split('/').pop()
  return [`url = "${url}"`, `output = "${path.join(rawDir, filename).replaceAll('\\', '/')}"`]
}).join('\n')
await fs.writeFile('scripts/youmind-curl.config', `${config}\n`, 'utf8')
console.log(`Prepared ${selected.length} unique safe image downloads`)
