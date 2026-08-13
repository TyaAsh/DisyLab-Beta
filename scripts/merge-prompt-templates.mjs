import { readFile, writeFile } from 'node:fs/promises'

const catalogPath = new URL('../public/prompt-library/catalog.json', import.meta.url)
const sourcePath = new URL('./style-library.source.json', import.meta.url)
const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const source = JSON.parse(await readFile(sourcePath, 'utf8'))

catalog.templates = source.templates.map((item) => ({
  id: `template-${item.id}`,
  title: item.title.zh || item.title.en,
  image: `/prompt-library/images/case-${item.exampleCases?.[0] === 330 ? 422 : item.exampleCases?.[0] || 1}.webp`,
  sourceLabel: '工业模板 · awesome-gpt-image-2',
  sourceUrl: `${source.repository}/blob/main/docs/templates.md#${item.anchor}`,
  prompt: [
    `【模板用途】${item.useWhen.zh}`,
    `【需要填写】主题/主体：[填写]；画幅与平台：[填写]；必须出现的文字：[填写]；品牌与色彩：[填写]。`,
    `【结构要求】${item.guidance.zh.join('；')}`,
    `【生成要求】${item.description.zh}；保持信息层级清晰、文字可读、构图可执行。`,
    `【避免】${item.pitfalls.zh.join('；')}`,
  ].join('\n'),
  category: item.category,
  styles: item.styles || [],
  scenes: item.scenes || [],
  tags: item.tags || [],
  featured: false,
  template: true,
}))

await writeFile(catalogPath, JSON.stringify(catalog), 'utf8')
console.log(`Merged ${catalog.templates.length} industrial templates`)
