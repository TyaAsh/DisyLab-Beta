import fs from 'node:fs'
import path from 'node:path'

const catalogPath = path.resolve('public/prompt-library/catalog.json')
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'))

const includesAny = (text, words) => words.some((word) => text.includes(word))
const unique = (values) => [...new Set(values.filter(Boolean))]
const idNumber = (item) => Number(String(item.id).match(/(\d+)$/)?.[1] || 0)
const inRanges = (value, ranges) => ranges.some(([start, end = start]) => value >= start && value <= end)

function visualSystemFor(item) {
  const id = idNumber(item)
  if (inRanges(id, [[5, 7], [14, 15], [18], [21], [24], [27], [30], [33, 34], [44], [46, 47], [49, 54], [56, 58], [63], [67], [71, 72], [74, 75], [77, 78]])) return 'mascot'
  if (inRanges(id, [[8, 12], [20], [23], [26], [28], [31, 32], [41, 42], [45]])) return 'photo-graphic'
  if (inRanges(id, [[55], [59, 62], [64, 66], [68, 70], [73], [76]])) return 'cinematic-character'
  return 'product-cg'
}

function extractScene(item) {
  const nano = String(item.nanoPrompt || item.prompt || '')
  const nanoMatch = nano.match(/^生成一张[^：]*：([\s\S]*?)。严格执行/)
  if (nanoMatch?.[1]?.trim()) return nanoMatch[1].trim().replace(/[。；]+$/, '')
  const prompt = String(item.gptImage2Prompt || item.nanoPrompt || item.prompt || '')
  const enrichedMatch = prompt.match(/核心画面：([\s\S]*?)。严格保持主体数量/)
  if (enrichedMatch?.[1]?.trim()) return enrichedMatch[1].trim().replace(/[。；]+$/, '')
  const match = prompt.match(/画面复现：([\s\S]*?)(?:。\n\n|\n\n构图|\n\n环境|$)/)
  if (match?.[1]?.trim()) return match[1].trim().replace(/[。；]+$/, '')
  return prompt.replace(/^生成一张[^：]*：/, '').split('。严格执行')[0].trim().replace(/[。；]+$/, '')
}

function environmentFor(scene, category) {
  const details = []
  if (includesAny(scene, ['宇宙', '太空', '星空', '地球'])) details.push('深黑宇宙纵深中布置稀疏星尘、地球弧面与薄层大气辉光，远景亮度受控，不能抢夺主体')
  if (includesAny(scene, ['舞台', '演唱会', '射灯', '观众'])) details.push('真实大型舞台空间，包含桁架、逆光灯阵、薄雾体积光与前景观众剪影，舞台地面具有轻微反射')
  if (includesAny(scene, ['餐厅', '厨房', '咖啡'])) details.push('可辨识但适度虚化的商业室内空间，保留桌面、吊灯与纵深层次，背景人物只作为环境尺度参照')
  if (includesAny(scene, ['城市', '高楼', '建筑', '街道'])) details.push('现代城市或建筑空间按真实尺度建立，透视线汇聚准确，空气透视将远景压低一个对比层级')
  if (includesAny(scene, ['工业', '机械', '废墟', '岩洞', '岩壁'])) details.push('粗粝工业或岩石场景具有真实尺度、尘雾和接触阴影，背景结构服务于主体轮廓，不堆砌无关零件')
  if (includesAny(scene, ['摄影棚', '纯色背景', '纯黑', '白底', '渐变背景', '极简'])) details.push('无缝摄影棚背景或干净色纸背景，墙地转角不可见，只用渐变和落地阴影建立空间')
  if (includesAny(scene, ['界面', 'HUD', '数据', '行情', '网格'])) details.push('数字界面以半透明分层悬浮在主体前后，信息密度由近到远递减，发光元素不得污染主体肤色与材质颜色')
  if (!details.length) details.push(category === '人物海报' ? '专业人像摄影棚与简化布景结合，背景保留明确纵深但不出现无关道具' : '搭建克制、可落地的商业影棚环境，以地面接触阴影、背景渐变和少量空间雾建立层次')
  return unique(details).join('；')
}

function materialFor(scene, category, item) {
  const details = []
  const visualSystem = visualSystemFor(item)
  const stylizedCharacter = visualSystem === 'mascot' || visualSystem === 'cinematic-character' || includesAny(scene, ['夸张3D', '吉祥物', '卡通', '软陶', '玩偶', '小虎', '小牛', '兔子', '圆头'])
  if (stylizedCharacter) details.push('角色采用手工软陶、哑光树脂与高端软胶结合的定格动画工艺：皮肤和面部是细腻微颗粒哑光，不出现真人毛孔；眼睛、牙齿、鼻尖和局部徽章使用克制清漆高光，衣料保留微缩模型纤维')
  if (includesAny(scene, ['毛绒', '毛发', '长毛'])) details.push('毛发按簇状生长并保留长短变化，轮廓有细碎逆光，避免塑料片状毛发和过度蓬松')
  if (includesAny(scene, ['金属', '硬币', '金币', '镀铬', '银色', '金色'])) details.push('金属区分拉丝、喷砂和镜面镀层：边缘高光连续，凹刻区域更暗，保留微细划痕与真实粗糙度变化')
  if (includesAny(scene, ['玻璃', '透明', '水晶', '亚克力'])) details.push('透明体具备正确折射、厚度、边缘色散与内部反射，接触面有焦散，不能像半透明塑料')
  if (includesAny(scene, ['手机', '手表', '屏幕', '终端'])) details.push('消费电子使用阳极氧化金属中框、低反射玻璃屏与精密倒角，屏幕黑位纯净，UI光只产生克制的局部反射')
  if (includesAny(scene, ['霓虹', '发光', '光管', '能量管', '光环'])) details.push('自发光结构具有实体外壳、半透明扩散层与高亮核心，辉光强度随距离自然衰减，并在邻近材质上产生对应颜色的反射')
  if (includesAny(scene, ['西装', '衬衫', '服装', '织物', '牛仔', '针织', '披风'])) details.push('服装明确区分精纺羊毛、棉、牛仔或针织纹理，缝线、褶皱和受力方向符合姿态，禁止蜡质布料')
  if (!stylizedCharacter && includesAny(scene, ['人物', '男性', '女性', '女孩', '讲师', '球员', '歌手'])) details.push('皮肤保留毛孔、细小绒毛与自然次表面散射，五官锐利但不过度磨皮，头发以发束和碎发共同塑形')
  if (includesAny(scene, ['岩石', '岩层', '砂岩', '石块'])) details.push('岩石具有颗粒、断面、风化边缘与粉尘沉积，凹处粗糙度更高，不能呈现泡沫或橡胶质感')
  if (includesAny(scene, ['纸', '杂志', '报纸', '贴纸', '报告'])) details.push('纸张保留纤维、折痕、裁切边与轻微套印误差；贴纸有可见厚度和真实翘边')
  if (!details.length) details.push(category === '3D视觉' ? '所有物体使用物理可信的PBR材质，明确区分漫反射、粗糙度、镜面反射和微表面细节' : '主体表面细节真实，材质之间有清楚的粗糙度和反射差异，避免统一塑料感')
  return unique(details).join('；')
}

function shapeLanguageFor(scene, category, item) {
  const visualSystem = visualSystemFor(item)
  if (visualSystem === 'mascot') return '采用高级动画电影式软胶吉祥物体系：大头、短躯干、圆润手脚、简化五官和清楚表情，比例严格跟随核心画面；轮廓像精制品牌玩偶，不能长出真人骨骼、真人五官或真人皮肤，也不能变成普通动物摄影。'
  if (visualSystem === 'photo-graphic') return '采用真实商业摄影与平面设计合成体系：人体比例、面部、服装和动作保持摄影可信度，图形、文字和色块作为独立版式层叠加；禁止卡通化、玩具化、3D塑料脸或改变人物身份气质。'
  if (visualSystem === 'cinematic-character') return item.id === 'local-reference-055'
    ? '采用高端定格动画/软陶电影角色体系：极大的头部与张开的巨口、细长躯干和四肢、夸张手掌、雕塑化长发与络腮胡，动作像动画关键帧；必须是非真人的手工3D角色，禁止生成真人摇滚歌手、普通人体比例或写实皮肤。'
    : '采用电影概念设计与超现实3D角色体系：保留参考主体的非人头部、雕塑化比例、机械/织物/植物结构和略带手工模型感的轮廓；真实光影服务于虚构造型，禁止自动还原成普通真人或普通商品摄影。'
  return '采用高端商业产品CG体系：严格沿用核心画面的几何比例、倒角、部件数量和陈列关系，造型可被真实制造；禁止拟人化、卡通化或擅自改变产品品类。'
}

function renderingStyleFor(scene, item) {
  const id = idNumber(item)
  const visualSystem = visualSystemFor(item)
  if (item.id === 'local-reference-055') return '定格动画电影级软陶渲染，接近高预算黏土动画长片：保留手工雕塑的轻微不规则、哑光软陶微颗粒、模型服装纤维和逐帧姿态张力；使用柔和路径追踪全局光照与真实摄影棚景深，绝不使用真人摄影、游戏写实角色或光滑通用CG皮肤。'
  if (inRanges(id, [[60], [76]])) return '微缩实体模型摄影风格：材质带手工制作痕迹、细小灰尘和尺度感，使用近距离微距镜头、浅景深与柔和自然光；画面应像真实搭建后拍摄，而不是干净无瑕的程序化模型。'
  if (id === 65) return '当代织物雕塑装置的超写实3D渲染：强调布料纤维、缝线、软垫压痕与皮肤连接处，使用正面博物馆式柔光和干净纯色背景，呈现怪诞但精致的艺术品摄影质感。'
  if (id === 64) return '风格化3D动画短片渲染：简化但可信的城市体块、清楚的角色剪影、柔和运动模糊与动画电影式暖色日光；画面像高预算运动品牌CG短片的关键帧，不要变成真人极限运动照片。'
  if (inRanges(id, [[59], [61, 62], [66], [68, 70], [73]])) return '电影概念设计级超现实3D渲染，接近 Unreal Engine 离线电影帧与高端角色雕刻：高精度几何、物理可信材质、路径追踪全局光照、克制体积雾与电影镜头；保留设计化比例和手工质感，不能退化为普通真人摄影。'
  if (visualSystem === 'mascot') return 'Blender Cycles / C4D 风格的动画电影级软胶角色渲染：圆润倒角、柔和全局光照、细腻接触阴影、哑光软胶主体与局部清漆高光；画面像成熟品牌吉祥物KV，不是廉价塑料玩具、真人套装或二维插画。'
  if (visualSystem === 'product-cg') return includesAny(scene, ['霓虹', '发光', '科技', '金融', '手机', '金属', '玻璃'])
    ? 'Cinema 4D + Octane/Redshift 式高端商业产品渲染：路径追踪全局光照、精准金属与玻璃反射、干净倒角高光、受控霓虹辉光和低噪点暗部；保持广告棚拍的克制与精确，禁止廉价游戏贴图或过曝光污染。'
    : '高端离线产品CG渲染：物理正确的粗糙度、折射、接触阴影与全局光照，边缘抗锯齿干净，采样充分且无噪点；结果应像专业产品摄影而不是默认材质预览。'
  return '真实商业摄影与高级平面合成，不把人物整体转成3D；仅对界面、图形或产品道具使用匹配现场光线的CG合成，并统一颗粒、焦距、阴影和色彩响应。'
}

function lightingFor(scene) {
  if (includesAny(scene, ['黑金', '深黑', '夜间', '暗红', '昏暗'])) return '低调布光：主光从画面指定方向切入，冷暖轮廓光分离主体与深色背景；黑位保留细节，发光体附近有受控辉光和体积雾，不可整片死黑或霓虹溢色。'
  if (includesAny(scene, ['白底', '明亮', '浅色', '米白', '摄影棚'])) return '高调棚拍：大面积柔光箱形成干净渐变高光，反方向用弱填充保留体积，脚下接触阴影柔和但清晰；白色区域不过曝，材质高光不剪切。'
  if (includesAny(scene, ['日光', '自然光', '城市', '户外'])) return '自然光遵循明确太阳方向，天空光填充阴影，主体边缘获得轻微暖色轮廓光；环境反射与人物/物体朝向一致。'
  return '三点式商业布光：45度主光塑造体积，弱填充保留暗部材质，窄轮廓光勾勒外形；阴影软硬与光源尺寸一致，地面必须出现可信接触阴影。'
}

function cameraFor(scene, category) {
  if (includesAny(scene, ['鱼眼', '夸张透视', '巨大', '伸向镜头'])) return '使用18–24mm广角或鱼眼近距离拍摄，透视夸张但主体结构不能变形；焦点锁定最近主体，边缘畸变受控。'
  if (includesAny(scene, ['低机位', '仰拍'])) return '使用24–35mm低机位仰拍，强调力量与纵深；垂直线和人体比例保持可信。'
  if (includesAny(scene, ['微距', '特写', '产品摄影'])) return '使用70–100mm微距/产品镜头，焦点落在品牌识别面和关键材质交界，景深足以保持主体轮廓完整。'
  if (category === '人物海报') return '使用50–85mm商业人像镜头，眼睛精准合焦，人物与背景保持自然景深分离，禁止广角造成面部比例失真。'
  return '使用45–70mm标准商业镜头，透视自然、主体无畸变；焦点覆盖主要信息面，背景仅做轻度景深衰减。'
}

function buildPrompt(item) {
  const scene = extractScene(item)
  const category = item.category || '3D视觉'
  return `生成一张可直接用于商业发布的高精度视觉作品，复刻目标是“${item.title}”。\n\n核心画面：${scene}。严格保持主体数量、动作、朝向、相对大小、遮挡关系、前中后景和原参考图画幅比例，不添加与主题无关的角色或装饰。\n\n造型语言：${shapeLanguageFor(scene, category, item)}\n\n渲染风格：${renderingStyleFor(scene, item)}\n\n环境与空间：${environmentFor(scene, category)}。每个实体必须有明确承托关系、接触点和空间尺度；只有原描述指定的元素允许悬浮，其余物体不得无故漂浮或互相穿模。\n\n材质与表面：${materialFor(scene, category, item)}。微表面细节只在近景可见，既要清晰又不能出现过度锐化、廉价塑料感或统一高光。\n\n灯光与阴影：${lightingFor(scene)}\n\n镜头与景深：${cameraFor(scene, category)}保持参考图的机位高度、视线方向、裁切方式和视觉重心；主体边缘干净，运动物体只允许符合方向的局部动态模糊。\n\n色彩与后期：锁定画面描述中的主色、辅色和明暗比例，采用商业级电影调色；高光有层次、暗部不堵塞、饱和色不溢出，保留细腻胶片颗粒或干净数字质感，不使用一键HDR效果。\n\n排版与文字：严格保留标题区、信息区、按钮区和负空间的位置关系；标题使用可读的虚构中文或英文，占位品牌与Logo必须为无版权设计。文字边缘清楚，不得乱码、错别字、重复字和随机小字。\n\n使用方式：仅凭本提示词即可文生图；若同时上传参考图，则参考图优先约束画幅、构图、主体造型、渲染风格、材质分区、光线方向和阅读顺序，但不要照搬原品牌Logo或受版权保护的角色。\n\n禁止项：水印、低清晰度、涂抹感、塑料皮肤、错误反射、无依据的漂浮物、穿模、重复主体、多余肢体、畸形手指、透视错误、无意义装饰、杂乱背景。`
}

catalog.cases = catalog.cases.map((item) => ({ ...item, gptImage2Prompt: buildPrompt(item) }))
catalog.totalCases = catalog.cases.length
fs.writeFileSync(catalogPath, `${JSON.stringify(catalog, null, 2)}\n`, 'utf8')

const lengths = catalog.cases.map((item) => item.gptImage2Prompt.length)
console.log(`Enriched ${catalog.cases.length} GPT Image 2 prompts · ${Math.min(...lengths)}-${Math.max(...lengths)} chars.`)
