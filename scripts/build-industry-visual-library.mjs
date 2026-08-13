import sharp from 'sharp'
import { createHash } from 'node:crypto'
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const catalogPath = join(root, 'public/prompt-library/catalog.json')
const outputDir = join(root, 'public/prompt-library/industry')
const sourceDir = join(root, 'scripts/industry-source')
await mkdir(outputDir, { recursive: true })

const source = (name) => join(sourceDir, `${name}.source`)
const local = (name) => join(root, 'scripts', name)
const officialShiqi = 'https://www.shiqi.top/portfolio.html'

const branded = [
  { key:'tiger-welcome', file:source('tiger-welcome'), title:'老虎证券新客开户奖励主视觉', topic:'券商拉新活动', sourceUrl:'https://www.itiger.com/hk/hans/market/promotion#迎新开户赏', sourceLabel:'老虎证券官方优惠与活动', prompt:'设计券商新客开户运营主视觉，以太空探索意象承载成长主题，突出核心奖励、开户门槛、截止日期与行动按钮；黑金品牌体系，信息清晰，合规说明完整。' },
  { key:'tiger-transfer', file:source('tiger-transfer'), title:'老虎证券转仓奖励活动页', topic:'资产转仓活动', sourceUrl:'https://www.itiger.com/hk/hans/market/promotion#老虎转仓礼', sourceLabel:'老虎证券官方优惠与活动', prompt:'设计证券资产转仓活动横幅，以高级金属材质和聚光灯表现价值感，突出奖励金额、活动期限、转仓入口和规则说明；黑金主色，克制专业。' },
  { key:'tiger-referral', file:source('tiger-referral'), title:'老虎证券好友邀请运营横幅', topic:'好友邀请增长', sourceUrl:'https://www.itiger.com/hk/hans/market/promotion#邀好友拎大礼', sourceLabel:'老虎证券官方优惠与活动', prompt:'设计券商好友邀请活动横幅，以灯光装置隐喻邀请与连接，突出双方奖励、完成步骤、活动期限和合规条款；深色背景配品牌金，层级明确。' },
  { key:'futu-manual', file:local('ref-futu-page.png'), title:'富途牛牛活动中心使用说明', topic:'活动中心功能说明', sourceUrl:'https://www.futuhk.com/cn/manual/topic11_89', sourceLabel:'富途证券官方使用手册', prompt:'设计投资平台活动中心说明页，清楚展示入口位置、活动列表、奖励领取与记录查询路径；使用步骤截图、编号标注和简明中文说明，保持金融产品可信感。' },
  { key:'futu-activity', file:local('ref-futu-activity.webp'), title:'富途牛牛活动中心首页', topic:'金融活动聚合页', sourceUrl:'https://www.futuhk.com/cn/manual/topic11_89#活动中心首页', sourceLabel:'富途证券官方使用手册', prompt:'设计金融应用活动中心首页，包含精选活动横幅、任务入口、奖励状态和活动分类；以品牌橙为重点色，卡片层级清晰，适配移动端快速浏览。' },
  { key:'futu-list', file:local('ref-futu-list.webp'), title:'富途牛牛活动列表界面', topic:'活动列表与状态', sourceUrl:'https://www.futuhk.com/cn/manual/topic11_89#活动列表', sourceLabel:'富途证券官方使用手册', prompt:'设计投资应用活动列表界面，明确区分进行中、待完成、已结束与奖励可领取状态；每张卡片展示标题、期限、进度和主操作，信息密度高但易扫读。' },
  { key:'shiqi-35', file:source('shiqi-35'), title:'Viki 原创角色设定', topic:'3D角色IP设定', sourceUrl:`${officialShiqi}#work-35`, sourceLabel:'士气集团官方作品页 · Zowei', prompt:'创作一套有鲜明轮廓的3D角色IP设定，包含英雄姿态、表情、服装材质、角色标志与中英文标题；画面像成熟潮玩品牌角色提案，避免性化表达。' },
  { key:'shiqi-40', file:source('shiqi-40'), title:'小蜗机车概念设计', topic:'生物机械载具', sourceUrl:`${officialShiqi}#work-40`, sourceLabel:'士气集团官方作品页 · 王可Koko', prompt:'将蜗牛形态与轻型机车融合为圆润友好的3D概念载具，清楚表达壳体、座舱、轮组和灯光关系；使用柔和摄影棚背景与产品级材质。' },
  { key:'shiqi-49', file:source('shiqi-49'), title:'士气风格乒乓球拍', topic:'运动产品IP视觉', sourceUrl:`${officialShiqi}#work-49`, sourceLabel:'士气集团官方作品页 · 除圆', prompt:'设计高能量运动产品KV，将乒乓球拍、球、几何轨迹和拟人化小角色组合，使用橙蓝撞色与紧凑信息模块，兼具潮玩感和商业发布感。' },
  { key:'shiqi-51', file:source('shiqi-51'), title:'士气玩具制造角色视觉', topic:'潮玩角色品牌视觉', sourceUrl:`${officialShiqi}#work-51`, sourceLabel:'士气集团官方作品页 · 林超黑', prompt:'设计原创潮玩角色品牌海报，以工业工装、护目镜和夸张比例建立角色记忆点，配合编号、制造标识和深色背景；质感精细但不堆砌元素。' },
  { key:'shiqi-54', file:source('shiqi-54'), title:'士气大学实验室视觉', topic:'创意教育运营海报', sourceUrl:`${officialShiqi}#work-54`, sourceLabel:'士气集团官方作品页 · 林超黑', prompt:'设计创意教育品牌运营海报，以实验室、机械伙伴和学习装备组成叙事场景，突出课程名称、学习模块与报名入口；整体有趣、专业、可传播。' },
  { key:'shiqi-60', file:source('shiqi-60'), title:'士气家用飞行器', topic:'未来交通产品概念', sourceUrl:`${officialShiqi}#work-60`, sourceLabel:'士气集团官方作品页 · Joker', prompt:'设计一台体积紧凑的未来家用飞行器，将柔软云朵、透明座舱与高可信机械结构结合；使用干净浅蓝背景、柔和阴影和产品概念渲染语言。' },
  { key:'shiqi-61', file:source('shiqi-61'), title:'出马系列·梅花式 PLUM', topic:'东方幻想角色雕塑', sourceUrl:`${officialShiqi}#work-61`, sourceLabel:'士气集团官方作品页 · 小田仙人', prompt:'创作东方幻想主题的3D角色雕塑，将骑乘者、鹿形伙伴与传统器物融合；强调动态剪影、雕塑细节和克制金棕色材质，避免猎奇与媚俗。' },
  { key:'shiqi-63', file:source('shiqi-63'), title:'精神牌精油产品世界观', topic:'虚构产品与装置设计', sourceUrl:`${officialShiqi}#work-63`, sourceLabel:'士气集团官方作品页 · 233', prompt:'为虚构精油品牌设计一套工业化产品世界观，包含运输箱、容器、机械臂、配件与识别系统；深色摄影棚光，橙色结构重点，高级硬表面渲染。' },
  { key:'shiqi-69', file:source('shiqi-69'), title:'士气四足运货机器人', topic:'工业机器人产品渲染', sourceUrl:`${officialShiqi}#work-69`, sourceLabel:'士气集团官方作品页 · 清和', prompt:'设计四足运货机器人商业渲染，明确承重平台、关节、传感器与货箱结构，并用人物尺度说明体量；中性背景、真实机械材质、产品发布级灯光。' },
  { key:'shiqi-78', file:source('shiqi-78'), title:'TUKKI 潮玩设计', topic:'潮玩产品展示', sourceUrl:`${officialShiqi}#work-78`, sourceLabel:'士气集团官方作品页 · 孙楂卷', prompt:'设计原创潮玩角色产品展示，以清晰正面造型、底座、标志道具和包装语言构成完整品牌画面；色彩活泼但控制在三种主色以内。' },
]

const verticalSpecs = [
  [519,'高端香水影棚摄影','产品摄影','透明玻璃、液体折射、植物道具与柔和渐变背景，突出瓶身细节和品牌留白'],
  [449,'机械腕表技术渲染板','产品渲染','用主视觉、微距结构、材质标注、爆炸图和参数区呈现精密工业产品'],
  [370,'概念家具研发提案','工业设计','包含正侧视图、材料方案、结构拆解、人体尺度和空间应用效果'],
  [190,'咖啡机电商产品页','产品电商','以白底英雄图、功能特写、操作步骤、容量参数和生活方式场景构成长详情页'],
  [381,'精品公寓室内氛围板','室内渲染','用客厅主视角、材质样板、灯光时段、软装细节和轴测布局表达完整空间概念'],
  [411,'极简地标建筑视觉','建筑渲染','清晰建筑体块、真实材料、环境尺度、自然光影和克制排版，避免夸张科幻造型'],
  [331,'城市文旅空间导览','城市设计','以地标、街区动线、公共空间和文化节点组成可读性强的城市导览视觉'],
  [177,'新能源汽车智能座舱','车机中控','深色横向中控屏，包含导航、车辆状态、空调、媒体、能耗与驾驶辅助，保证驾驶可读性'],
  [261,'AI视频创作工作台','生产力UI','桌面端三栏结构，包含素材、时间线、预览、参数和任务状态，强调高效工作流'],
  [243,'企业级界面设计系统','设计系统','展示颜色、字号、间距、按钮、表单、数据卡、导航和深浅主题组件规范'],
  [387,'流媒体内容首页','内容平台UI','大幅推荐区、内容分类、继续观看、个性化列表和多端适配的沉浸式首页'],
  [475,'异形包装结构提案','包装设计','包装展开图、结构折线、组装步骤、货架效果和运输保护说明并列展示'],
  [438,'珠宝微距商业广告','产品摄影','高级珠宝微距、金属高光、宝石折射、微缩场景和克制品牌文案'],
  [373,'精品食品品牌英雄图','食品摄影','真实食材纹理、冷暖灯光、产地信息、包装组合和高端餐饮氛围'],
  [301,'机器人产品功能长图','科技产品','产品英雄图、核心结构、传感器标注、应用场景、技术参数和购买信息'],
]

const catalog = JSON.parse(await readFile(catalogPath, 'utf8'))
const compress = async (input, key) => {
  const output = join(outputDir, `${key}.webp`)
  await sharp(input).rotate().resize({ width:360, height:360, fit:'inside', withoutEnlargement:true }).webp({ quality:47, effort:6 }).toFile(output)
  return `/prompt-library/industry/${key}.webp`
}

const brandedCases = []
for (let index = 0; index < branded.length; index += 1) {
  const item = branded[index]
  brandedCases.push({ id:`industry-brand-${index + 1}`, title:item.title, image:await compress(item.file, item.key), sourceUrl:item.sourceUrl, sourceLabel:item.sourceLabel, category:item.key.startsWith('shiqi')?'品牌与创意产业':'金融科技运营', styles:item.key.startsWith('shiqi')?['3D','品牌','IP']:['界面','信息图','品牌'], scenes:['商业','运营'], featured:false, industry:true, prompt:item.prompt })
}

const verticalCases = verticalSpecs.map(([caseId,title,topic,description], index) => {
  const reference = catalog.cases.find((item) => item.id === caseId)
  if (!reference) throw new Error(`Missing vertical reference case ${caseId}`)
  return { id:`industry-vertical-${index + 1}`, title, image:reference.image, sourceUrl:reference.sourceUrl || reference.githubUrl, sourceLabel:reference.sourceLabel || '公开案例来源', category:'专业垂直视觉', styles:['产品','建筑','界面','渲染'], scenes:['商业','工业设计'], featured:false, industry:true, prompt:`为[可替换品牌/项目]设计「${topic}」成品视觉。${description}。\n要求：高级、克制、真实材质与专业信息层级；参考图仅用于构图与品质，不复制 Logo、商标和专有文案；输出高保真中文视觉。` }
})

const nextCases = [...brandedCases, ...verticalCases]
const seenUrls = new Map()
const seenHashes = new Map()
for (const item of nextCases) {
  if (!item.sourceUrl) throw new Error(`${item.id} has no source URL`)
  if (seenUrls.has(item.sourceUrl)) throw new Error(`Duplicate source URL: ${item.id} / ${seenUrls.get(item.sourceUrl)}`)
  seenUrls.set(item.sourceUrl, item.id)
  const imagePath = join(root, 'public', item.image.replace(/^\//, ''))
  const normalizedPixels = await sharp(imagePath).resize(64, 64, { fit:'contain', background:'#000' }).removeAlpha().raw().toBuffer()
  const digest = createHash('sha256').update(normalizedPixels).digest('hex')
  if (seenHashes.has(digest)) throw new Error(`Duplicate reference image: ${item.id} / ${seenHashes.get(digest)}`)
  seenHashes.set(digest, item.id)
}

catalog.industryCases = nextCases
await writeFile(catalogPath, JSON.stringify(catalog), 'utf8')

const used = new Set(branded.map((item) => `${item.key}.webp`))
for (const file of ['tiger.webp','futu.webp','futu-ui.webp','futu-list.webp','shiqi.webp']) {
  if (!used.has(file)) await rm(join(outputDir, file), { force:true })
}
const bytes = (await Promise.all([...used].map(async (file) => (await readFile(join(outputDir, file))).byteLength))).reduce((sum,size)=>sum+size,0)
console.log(`Industry library: ${nextCases.length} unique cases (${brandedCases.length} branded + ${verticalCases.length} vertical)`)
console.log(`Compressed branded references: ${used.size} files, ${(bytes / 1024).toFixed(1)} KiB total`)
