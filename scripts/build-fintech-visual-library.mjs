import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const sourceDir = join(root, 'scripts', 'industry-source')
const outputDir = join(root, 'public', 'prompt-library', 'industry')
const catalogPath = join(root, 'public', 'prompt-library', 'catalog.json')
await mkdir(outputDir, { recursive:true })

const tiger = JSON.parse(await readFile(join(sourceDir, 'tiger-campaigns.json'), 'utf8'))
const tigerChinese = [
  '转仓奖励与高价值礼赠活动','联名借记卡碎股返现活动','季度交易挑战赛主视觉','多市场新客欢迎礼包','交易竞技场与数码奖品活动','融资融券免佣体验活动','交易能力分层成长计划','美股期权费率权益页','期货交易任务奖励活动','出行品牌联名卡活动','借记卡好友推荐现金奖励','杠杆与反向产品教育活动','交易托管费减免公告','借记卡生活方式权益集合','澳洲市场新客费率礼遇','港区新客太空主题奖励','好友邀请双向奖励活动','新西兰新客零费率计划','邀请码权益规则说明',
]
const moomooNumbers = [1,2,3,4,5,9,10,11,12,14,15,16,17,18,22,23,24,25,26,30,31,32,33,34,35,36,37,39,42,43,44]
const moomooTitles = [
  '线下投资体验店空间运营','CHESS 托管资质立体徽章','迎新活动信息承载横幅','活动规则分隔与进度视觉','账户安全金锁权益图标','品牌黑金开场横幅','会员身份暗金品牌标识','迎新任务说明信息卡','分步任务白底说明组件','五次抽奖机会奖励卡','十五次抽奖机会奖励卡','三十次抽奖机会奖励卡','分档入金奖励阶梯图','社交分享额外八次奖励','费率权益场景过渡横幅','三十天零佣金权益券','卡券与金币会员权益KV','闲置资金收益主题KV','转仓现金券礼盒KV','线下门店地图导览','交易金额与费率对照表','竞品费率对比信息表','澳洲热门交易应用横幅','五星投资平台奖章','五星休闲投资平台奖章','五星活跃投资平台奖章','金融平台行业奖项徽章','会员权益升级运营横幅','纳斯达克上市资质背书','纽交所全球合作伙伴背书','CHESS 托管资质页脚背书',
]
if (moomooNumbers.length !== moomooTitles.length) throw new Error('Moomoo metadata mismatch')

const compress = async (input, key, background='#151515') => {
  const output = join(outputDir, `${key}.webp`)
  await sharp(input).rotate().resize({width:360,height:240,fit:'contain',background}).flatten({background}).webp({quality:46,effort:6}).toFile(output)
  return `/prompt-library/industry/${key}.webp`
}
const basePrompt = (topic, brand) => `参考图的构图与信息组织，为[可替换金融科技品牌]设计「${topic}」运营视觉。保留${brand}案例中清晰的主标题、权益数字、任务条件、行动入口与风险说明层级，改用自有品牌色、图形资产和文案；画面专业、可信、易扫读，适配网页横幅与移动端活动卡。不得承诺收益，不使用夸张涨幅、稳赚暗示或未经授权的商标。`

const finance = []
for (let index=0; index<tiger.length; index+=1) {
  const item = tiger[index]
  const key = `fintech-tiger-${item.market}-${item.id}`
  finance.push({
    id:`industry-fintech-tiger-${index+1}`, title:`老虎证券 · ${tigerChinese[index]}`,
    image:await compress(join(sourceDir, `tiger-${item.market}-${item.id}.source`),key,'#111111'),
    sourceUrl:item.sourceUrl, sourceLabel:`老虎证券 ${item.market.toUpperCase()} 官方活动`, category:'金融科技运营',
    styles:['金融科技','运营视觉','品牌'], scenes:['商业','增长运营'], featured:index<4, industry:true,
    prompt:basePrompt(tigerChinese[index],'官方活动'),
  })
}
for (let index=0; index<moomooNumbers.length; index+=1) {
  const number=moomooNumbers[index]
  const topic=moomooTitles[index]
  const key=`fintech-moomoo-au-${String(number).padStart(2,'0')}`
  finance.push({
    id:`industry-fintech-moomoo-${index+1}`, title:`moomoo · ${topic}`,
    image:await compress(join(sourceDir,`moomoo-au-${String(number).padStart(2,'0')}.source`),key,number===9||number===10||number===39?'#111111':'#f5f1e9'),
    sourceUrl:`https://www.moomoo.com/au/events/welcome_rewards#visual-${number}`,
    sourceLabel:'moomoo Australia 官方迎新活动', category:'金融科技运营',
    styles:['金融科技','运营视觉','信息设计'], scenes:['商业','增长运营'], featured:index<3, industry:true,
    prompt:basePrompt(topic,'moomoo 官方'),
  })
}

if (finance.length !== 50) throw new Error(`Expected 50 finance cases, got ${finance.length}`)
const urlMap=new Map(), hashMap=new Map()
for (const item of finance) {
  if (urlMap.has(item.sourceUrl)) throw new Error(`Duplicate finance URL: ${item.sourceUrl}`)
  urlMap.set(item.sourceUrl,item.id)
  const pixels=await sharp(join(root,'public',item.image.slice(1))).resize(64,64,{fit:'contain',background:'#000'}).removeAlpha().raw().toBuffer()
  const hash=createHash('sha256').update(pixels).digest('hex')
  if (hashMap.has(hash)) throw new Error(`Duplicate finance image: ${item.id} / ${hashMap.get(hash)}`)
  hashMap.set(hash,item.id)
}

// Re-read at write time so concurrently added Shiqi / rendering collections survive.
const catalog=JSON.parse(await readFile(catalogPath,'utf8'))
const others=(catalog.industryCases || []).filter((item)=>item.category!=='金融科技运营')
catalog.industryCases=[...finance,...others]
await writeFile(catalogPath,JSON.stringify(catalog), 'utf8')
console.log(`Financial technology library: ${finance.length} unique cases; preserved ${others.length} other industry cases`)
