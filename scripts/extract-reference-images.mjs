import { readdir, readFile } from 'node:fs/promises'

for (const file of (await readdir(new URL('.', import.meta.url))).filter((name) => name.startsWith('source-') && name.endsWith('.html'))) {
  const html = await readFile(new URL(file, import.meta.url), 'utf8')
  const urls = [...html.matchAll(/https?:[^"'<>\s]+?(?:\.png|\.jpe?g|\.webp)(?:\?[^"'<>\s]*)?/ig)].map((match) => match[0].replaceAll('&amp;', '&'))
  console.log(`\n${file}: ${new Set(urls).size}`)
  console.log([...new Set(urls)].slice(0, 80).join('\n'))
}
