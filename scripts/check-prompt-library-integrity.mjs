import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const root = fileURLToPath(new URL('..', import.meta.url))
const catalog = JSON.parse(await readFile(join(root, 'public/prompt-library/catalog.json'), 'utf8'))
const expectedCategories = ['金融科技', '人物海报', '角色设计', '3D视觉']
const requiredGptSections = ['核心画面：', '造型语言：', '渲染风格：', '环境与空间：', '材质与表面：', '灯光与阴影：', '镜头与景深：', '色彩与后期：', '排版与文字：', '禁止项：']

if (catalog.totalCases !== (catalog.cases || []).length || catalog.totalCases === 0) throw new Error('The local inspiration library case count is invalid')
if (JSON.stringify(catalog.categories) !== JSON.stringify(expectedCategories)) throw new Error('Unexpected public categories')
if ((catalog.styles || []).length || (catalog.scenes || []).length || (catalog.templates || []).length || (catalog.industryCases || []).length) throw new Error('The inspiration library contains unexpected filters or collections')

for (const item of catalog.cases) {
  if (!expectedCategories.includes(item.category)) throw new Error(`Unsupported category: ${item.category}`)
  if (!/^\/prompt-library\/local\/local-\d+\.(?:jpg|png)$/.test(item.image)) throw new Error(`Unexpected local image path: ${item.image}`)
  if (!item.nanoPrompt?.includes('可直接用于文生图') || !item.nanoPrompt?.includes('如同时上传参考图')) throw new Error(`Nano prompt is not dual-mode: ${item.id}`)
  if (!item.gptImage2Prompt?.includes('仅凭本提示词即可文生图') || !item.gptImage2Prompt?.includes('若同时上传参考图')) throw new Error(`GPT Image 2 prompt is not dual-mode: ${item.id}`)
  if (requiredGptSections.some((section) => !item.gptImage2Prompt.includes(section))) throw new Error(`GPT Image 2 prompt is missing a structured section: ${item.id}`)
  for (const section of requiredGptSections) {
    if (item.gptImage2Prompt.split(section).length !== 2) throw new Error(`GPT Image 2 prompt contains a duplicate section (${section}): ${item.id}`)
  }
  if (item.gptImage2Prompt.length < 800) throw new Error(`GPT Image 2 prompt is insufficiently detailed: ${item.id}`)
  if (/\b(?:WebP|webp)\b/.test(`${item.nanoPrompt}\n${item.gptImage2Prompt}`)) throw new Error(`Unexpected WebP instruction: ${item.id}`)
}

console.log(`Inspiration library OK: ${catalog.totalCases} local references · ${catalog.totalCases * 2} model prompts · ${expectedCategories.join(' / ')}`)
