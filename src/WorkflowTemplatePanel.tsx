import { useEffect, useMemo, useRef, useState, type CSSProperties, type ChangeEvent } from 'react'
import { useGSAP } from '@gsap/react'
import { gsap } from 'gsap'
import { ArrowRight, Check, ChevronDown, Download, Pencil, Plus, Search, Shapes, Sparkles, Trash2, Upload, X } from 'lucide-react'
import { useProjectDialog } from './ProjectDialog'

gsap.registerPlugin(useGSAP)

export type WorkflowTemplateNode = {
  id: string
  type: 'disy'
  position: { x: number; y: number }
  style?: { width?: number; height?: number }
  data: Record<string, unknown> & { kind: 'text' | 'image' | 'upload' | 'video'; title: string }
}

export type WorkflowTemplateEdge = {
  id: string
  source: string
  target: string
  type: 'luminous'
}

export type WorkflowTemplate = {
  id: string
  title: string
  description: string
  category: string
  tags: string[]
  accent: string
  nodes: WorkflowTemplateNode[]
  edges: WorkflowTemplateEdge[]
  userDefined?: boolean
}

const TEXT_PRODUCTION_RULES = `请直接输出可供下游节点使用的最终内容，不解释思考过程。使用明确的主体、场景、动作、镜头、光线、色彩和材质描述。先建立并持续复用“一致性指纹”：人物固定姓名、年龄、脸型、五官锚点、发型、体型、服装层级和标志道具；IP固定头身比、轮廓、配色、表情器官和材质；产品固定尺寸比例、结构、包装、Logo面、接口与材质；场景固定平面关系、建筑位置、动线、主色和光源方向。连续镜头只允许改变当前节点明确要求的动作、景别、机位和时间进度。`
const IMAGE_PRODUCTION_RULES = `制作规范：电影级商业成片或统一设定的高完成度视觉。参考优先级必须严格执行：人物/IP/产品/场景母版是身份与结构的最高事实来源，上一镜头只负责动作、构图和连续状态，风格参考只控制色彩、材质与渲染，不得覆盖主体身份和产品结构。主体脸部、头身比、发型、服装、标志物、包装、Logo面、接口、环境建筑、空间关系、主色调、材质和光源方向必须继承全部上游参考；只改变本节点明确要求的动作、景别和机位。禁止随机换脸、换装、改变IP轮廓、篡改包装文字结构、改变产品孔位、建筑布局或画风，禁止增加无关角色、文字、水印、Logo、拼贴边框和分镜编号；避免塑料皮肤、过度锐化、肢体畸形、手指错误、重复物体和 AI 感。`

const text = (id: string, title: string, body: string, x: number, y: number): WorkflowTemplateNode => ({
  id, type: 'disy', position: { x, y }, style: { width: 250, height: 180 },
  data: { kind: 'text', title, body: `${body}\n\n${TEXT_PRODUCTION_RULES}`, promptText: `${body}\n\n${TEXT_PRODUCTION_RULES}` },
})
const upload = (id: string, title: string, x: number, y: number): WorkflowTemplateNode => ({
  id, type: 'disy', position: { x, y }, style: { width: 250, height: 220 },
  data: { kind: 'upload', title, body: '请上传参考图片' },
})
const image = (id: string, title: string, body: string, x: number, y: number, ratio = '1:1'): WorkflowTemplateNode => ({
  id, type: 'disy', position: { x, y }, style: { width: 280, height: 300 },
  data: { kind: 'image', title, body: `${body}\n\n${IMAGE_PRODUCTION_RULES}`, promptText: `${body}\n\n${IMAGE_PRODUCTION_RULES}`, status: '待生成', imageAspectRatio: ratio, imageResolution: '2K', imageDetail: 'high' },
})
const video = (id: string, title: string, body: string, x: number, y: number, duration = '6s'): WorkflowTemplateNode => ({
  id, type: 'disy', position: { x, y }, style: { width: 300, height: 240 },
  data: { kind: 'video', title, body, promptText: body, status: '视频生成即将开放', videoDuration: duration, videoPlaceholder: true },
})
const edge = (source: string, target: string): WorkflowTemplateEdge => ({ id: `edge-${source}-${target}`, source, target, type: 'luminous' })

const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'character-sheet', title: '角色设定三视图', category: '角色设计', accent: '#9d8cff',
    description: '角色设定与风格参考合成标准正侧背三视图。',
    tags: ['角色', '三视图', '设定'],
    nodes: [text('brief', '角色圣经', '角色名“闻舟”，29 岁废土机械师，窄长脸、右眉骨旧伤、黑色寸头；穿褪色靛蓝工装夹克、灰色连帽衫、旧皮工具腰带与沙色工装靴。性格克制警觉，标志道具为黄铜机械臂终端。请扩写固定的脸部、体型、服装正侧背细节、标准配色和不可变更项。', 0, 0), upload('style', '风格参考', 0, 230), image('result', '角色三视图', '基于参考文本与图1风格，生成同一角色正面、侧面、背面三视图拼板，白底，无文字水印。', 360, 90, '16:9')],
    edges: [edge('brief', 'result'), edge('style', 'result')],
  },
  {
    id: 'brief-poster', title: 'Brief 到海报', category: '营销设计', accent: '#70b5ff',
    description: '从一句营销目标扩写文案，再生成可提案海报。',
    tags: ['海报', '文案', '营销'],
    nodes: [text('brief', '原始 Brief', '产品：零糖冷萃咖啡液；受众：25–35 岁一线城市上班族；核心卖点：30 秒即溶、零糖、独立便携；传播场景：夏季通勤与办公室午后。请输出一条核心策略、三组主标题/副标题/CTA，并选择最适合海报的一组。', 0, 0), text('copy', '海报文案', '基于上游 Brief 选择最有记忆点的一组，润色成可直接排版的中文文案：主标题 8 字内、副标题 20 字内、CTA 6 字内，并给出字号层级和留白建议。', 330, 0), image('poster', '海报成稿', '根据参考文案设计高完成度竖版商业海报：透明冰杯中的深琥珀冷萃位于视觉中心，冷凝水珠清晰，钴蓝到冰青渐变背景，硬朗无衬线中文排版，右上预留品牌 Logo，底部放 CTA。', 660, 0, '3:4')],
    edges: [edge('brief', 'copy'), edge('copy', 'poster')],
  },
  {
    id: 'product-backgrounds', title: '产品双背景', category: '电商视觉', accent: '#62d9b0',
    description: '一张产品图并行生成白底主图和生活方式场景图。',
    tags: ['产品', '白底', '场景'],
    nodes: [upload('product', '产品实拍', 0, 80), text('scene', '场景描述', '北欧木质桌面，窗边自然光，浅景深，生活感静物摄影。', 0, 340), image('white', '白底主图', '图1产品，纯白背景，居中，柔和阴影，电商主图规范。', 360, 0), image('sceneOut', '场景图', '保留图1产品形态和材质，替换为参考文本描述的场景。', 360, 340, '4:5')],
    edges: [edge('product', 'white'), edge('product', 'sceneOut'), edge('scene', 'sceneOut')],
  },
  {
    id: 'style-transfer', title: '双参考风格迁移', category: '图像创作', accent: '#ff9fce',
    description: '内容图控制构图，风格图控制色调笔触，再串联精修。',
    tags: ['风格迁移', '双参考', '精修'],
    nodes: [upload('content', '内容图', 0, 0), upload('style', '风格图', 0, 270), image('transfer', '风格迁移', '图1控制主体与构图，图2控制色调、笔触与光影，保持图1构图不变。', 350, 100), image('polish', '精修输出', '在图1基础上提升细节、对比度与清晰度，去除生成瑕疵。', 700, 100)],
    edges: [edge('content', 'transfer'), edge('style', 'transfer'), edge('transfer', 'polish')],
  },
  {
    id: 'three-directions', title: '一题三案探索', category: '创意探索', accent: '#ffbd70',
    description: '一个创意方向并行生成广角、中景和特写三套方案。',
    tags: ['三方案', '并行', '概念'],
    nodes: [text('direction', '创意方向', '主题：近未来重庆雨夜；主角：穿透明雨衣的年轻女快递员；氛围：孤独但有生命力；视觉：潮湿混凝土、密集高架、中文霓虹、蓝紫主色与少量暖黄窗口；摄影：35mm 电影胶片、真实街拍、低饱和、高动态范围。输出一段所有方案共享的固定视觉圣经。', 0, 170), image('wide', '方案 A · 广角', '近未来重庆雨夜广角建立镜头，年轻女快递员骑电动车穿过多层高架下方，人物较小，湿地反射蓝紫霓虹，24mm 低机位，强调垂直城市尺度。', 350, 0, '16:9'), image('medium', '方案 B · 中景', '同一女快递员、同一透明雨衣与电动车，中景侧向跟拍，她在红灯前停下擦拭护目镜，背景中文霓虹虚化，50mm，自然雨滴与车灯反射。', 350, 330, '16:9'), image('close', '方案 C · 特写', '同一女快递员面部特写，透明兜帽边缘挂满雨珠，蓝色霓虹照亮左脸、暖黄车灯勾勒右侧轮廓，85mm 浅景深，疲惫但坚定。', 700, 170, '3:4')],
    edges: [edge('direction', 'wide'), edge('direction', 'medium'), edge('direction', 'close')],
  },
  {
    id: 'brand-mascot', title: '品牌 IP 吉祥物', category: '品牌设计', accent: '#b394ff',
    description: '品牌 Brief 逐步转化为完整视觉概念和吉祥物定稿。',
    tags: ['IP', '吉祥物', '品牌'],
    nodes: [text('brand', '品牌 Brief', '品牌：儿童益智 App“小星星”；受众：6–10 岁儿童与家长；价值观：好奇、耐心、主动探索；调性：温暖、安全、聪明但不说教；品牌色：星光黄 #FFD35A、夜空蓝 #243B73；禁用：尖牙、武器、复杂写实毛发、荧光刺眼配色。输出可执行的吉祥物设计 Brief。', 0, 0), text('concept', '吉祥物概念', '基于品牌 Brief 设计“星仔”：一只圆润的小型星际水獭，2.5 头身，深蓝连体探索服、黄色星形胸章、透明小头盔；固定眼睛、耳朵、尾巴、配色比例，补充正面动作、三种表情和 App 内三个应用场景。', 330, 0), image('mascot', '吉祥物定稿', '根据参考文本生成“星仔”生产级全身立绘：正面站立、挥手、友好微笑，2.5 头身，深蓝探索服和黄色星形胸章，柔和 3D 卡通材质，纯白背景，完整四肢与尾巴。', 660, 0, '3:4')],
    edges: [edge('brand', 'concept'), edge('concept', 'mascot')],
  },
  {
    id: 'ecommerce-set', title: '电商主图套装', category: '电商视觉', accent: '#66d7e8',
    description: '由产品原图生成白底、生活方式和材质细节三类物料。',
    tags: ['电商', '套图', '产品'],
    nodes: [upload('product', '产品原图', 0, 170), image('hero', '白底主图', '图1产品，纯白底，居中，均匀柔光，无额外道具。', 350, 0), image('lifestyle', '场景生活方式', '图1产品置入现代生活场景，自然光，产品清晰可辨。', 350, 340, '4:5'), image('detail', '细节特写', '以图1产品为依据，呈现材质与工艺微距特写，浅景深。', 700, 0)],
    edges: [edge('product', 'hero'), edge('product', 'lifestyle'), edge('hero', 'detail')],
  },
  {
    id: 'storyboard', title: '角色一致性四格故事板', category: '内容创作', accent: '#f58f8f',
    description: '先生成角色与场景视觉母版，再让每个镜头持续引用母版和前序镜头。',
    tags: ['分镜', '角色母版', '连续性'],
    nodes: [
      text('script', '剧本与连续性圣经', `把故事整理为四个连续镜头。固定主角为“林夏”：26 岁中国女性，鹅蛋脸、短黑发、左眼下浅痣，米白风衣、深蓝针织衫、棕色邮差包。固定场景为雨夜旧城区便利店，青绿色荧光灯与街外暖橙路灯形成冷暖对比。逐镜头输出：叙事任务、可见动作、情绪、景别、机位、35mm/50mm/85mm 镜头建议、光线延续和必须保持的道具位置。`, 0, 120),
      image('master', '角色与场景母版', `根据参考文本制作一张生产级视觉设定板：同一画面包含林夏正面半身、左侧全身、右侧三分之二侧面，以及便利店收银台、玻璃门、货架的环境色彩小样。所有人物必须是同一个人、同一套服装；写实电影摄影，细腻胶片颗粒，青橙冷暖光，纯视觉画面，不生成任何文字标签。`, 330, 120, '16:9'),
      image('shot1', '镜头 1 · 建立', `严格使用图1中的林夏与便利店。雨夜旧城区便利店外部广角建立镜头，林夏推开玻璃门进入，湿润街面反射暖橙路灯，店内青绿色荧光灯照出她的米白风衣轮廓；35mm，视线高度，人物位于右侧三分线。`, 680, 0, '16:9'),
      image('shot2', '镜头 2 · 行动', `图1是角色与场景母版，图2是上一镜头。保持林夏身份、服装、便利店布局和青橙光线完全一致。中景侧拍，林夏走向饮料柜，右手握棕色邮差包肩带，回头看向玻璃门外；50mm，轻微手持感，动作连续。`, 680, 340, '16:9'),
      image('shot3', '镜头 3 · 反应', `图1是角色母版，图2是上一镜头。保持同一林夏与同一环境。85mm 面部近景，她透过饮料柜玻璃反射看到门外模糊人影，眼神警觉，左眼下浅痣清晰，冷色柜灯照脸，背景暖橙散景。`, 1030, 0, '16:9'),
      image('shot4', '镜头 4 · 收束', `图1是角色母版，图2是上一镜头。保持人物、服装、道具、便利店空间与色彩连续。肩后中广景，林夏站在收银台旁看向关闭的玻璃门，棕色邮差包仍在左肩，门外雨势加大；50mm，克制悬疑，稳定构图。`, 1030, 340, '16:9'),
    ],
    edges: [edge('script', 'master'), edge('master', 'shot1'), edge('master', 'shot2'), edge('shot1', 'shot2'), edge('master', 'shot3'), edge('shot2', 'shot3'), edge('master', 'shot4'), edge('shot3', 'shot4')],
  },
  {
    id: 'brand-kit', title: 'Logo 物料延展', category: '品牌设计', accent: '#7fc994',
    description: '上传 Logo 与品牌信息，同时生成名片和社媒 Banner。',
    tags: ['Logo', '名片', 'Banner'],
    nodes: [upload('logo', '品牌 Logo', 0, 60), text('info', '品牌信息', '品牌：青禾设计；Slogan：让灵感落地；主色：森林绿 #2D6A4F；辅色：米白 #F4F1E8；联系人：林青 / design@qinghe.com / 138-0000-0000；品牌性格：克制、自然、专业。输出名片与社媒头图统一的排版和材质规范。', 0, 330), image('card', '名片设计', '图1 Logo 加参考文本信息，设计双面名片实拍 mockup：米白棉质纸、森林绿烫印、左对齐瑞士网格、充足留白，正面 Logo 与 Slogan，背面联系人信息。', 360, 0, '16:9'), image('banner', '社媒 Banner', '图1 Logo 为主视觉，森林绿到深墨绿的低调渐变背景，加入抽象叶片纸张纹理，Slogan“让灵感落地”位于左侧安全区，适配宽幅社媒头图。', 360, 340, '21:9')],
    edges: [edge('logo', 'card'), edge('logo', 'banner'), edge('info', 'card'), edge('info', 'banner')],
  },
  {
    id: 'iterate-polish', title: '生成精修扩图链', category: '图像创作', accent: '#8fb8ff',
    description: '从初始创意依次完成概念稿、细节精修和宽幅延展。',
    tags: ['精修', '扩图', '迭代'],
    nodes: [text('idea', '初始创意', '超现实主义电影画面：一只半透明巨型水母漂浮在被苔藓覆盖的南方古城上空，傍晚暴雨刚停，金色斜阳穿过水母身体，在青石街道形成流动焦散；街上只有一名撑红伞的孩子仰望。色彩为青绿、旧墙灰和克制金色，35mm 胶片摄影，宁静而神秘。', 0, 0), image('draft', '概念初稿', '根据参考文本生成电影概念稿：16:9 宽画幅，古城街巷形成纵深引导线，巨型水母占天空上半部，红伞孩子位于下方三分之一，金色焦散连接两者，构图与尺度关系优先。', 330, 0, '16:9'), image('polish', '细节精修', '在图1基础上保持所有主体位置和尺度不变，精修水母半透明组织、雨后青石反光、旧墙苔藓、空气水汽和金色焦散，恢复自然动态范围，去除边缘融合与肢体瑕疵。', 680, 0, '16:9'), image('expand', '宽幅延展', '以图1为中心向左右自然扩展为 21:9，左侧补全古城屋檐和湿润电线，右侧延展远山与低云；水母、红伞孩子、光源方向、透视和胶片色彩完全不变。', 1030, 0, '21:9')],
    edges: [edge('idea', 'draft'), edge('draft', 'polish'), edge('polish', 'expand')],
  },
  {
    id: 'zombie-scavenger', title: '丧尸清道夫 · 五镜工业流程', category: '工业化短片', accent: '#d6a35f',
    description: '角色母版与环境母版双锁定，按抵达、检查、扰动、引导、结尾连续生产五个镜头。',
    tags: ['丧尸清道夫', '五镜', '电影短片'],
    nodes: [
      text('bible', '制作圣经与镜头表', `短片名《黄沙清道夫》。固定主角：身高 165cm 的复古机器人清道夫，圆柱旧铜头、单眼红色镜头、沙绿色工装连体服、橙色反光背心、右腰旧工具包、黑色金属靴；固定坐骑：拼装修补的机械鸵鸟，长活塞腿、红色旧皮鞍；固定世界：黄沙覆盖的美国西南废弃小镇、破损红色汽车旅馆招牌、废弃加油站、夕阳逆光、低饱和赭石和青灰色；风格：真人实景质感、黑色幽默、无血腥、35mm 西部片。输出五镜连续性表：抵达、检查、扰动、引导、安静结尾，逐镜标明动作、景别、镜头、运镜、光线、角色与道具连续项。`, 0, 180),
      image('character', '角色母版', `制作机器人清道夫与机械鸵鸟的生产级角色设定板：机器人正面全身、左侧全身、背面全身，机械鸵鸟三分之二侧面；旧铜头、单眼红光、沙绿工装、橙色反光背心、工具包与金属靴全部一致；中性灰背景，真实旧金属划痕与沙尘，不要文字。`, 340, 0, '16:9'),
      image('world', '环境母版', `制作黄沙废弃小镇的环境母版：同一空间中明确远处破损红色汽车旅馆招牌、中部双油泵加油站、右侧维修间、废弃巴士与沙丘公路的位置；夕阳从画面左后方照射，低饱和赭石、尘土灰、少量褪色红，真人实景勘景照片质感，无人物。`, 340, 360, '16:9'),
      image('arrival', '镜头 1 · 抵达', `图1为角色母版，图2为环境母版。夕阳宽幅远景，机器人清道夫骑机械鸵鸟从画面右侧进入黄沙公路，人物保持较小剪影，红色汽车旅馆招牌在远处闪烁，鸵鸟活塞腿扬起薄沙尘；24mm 固定机位，慢节奏西部片。`, 700, 0, '16:9'),
      image('inspect', '镜头 2 · 检查', `图1角色母版、图2环境母版、图3上一镜头。废弃加油站外中景跟拍，机器人从机械鸵鸟下来，用单眼红光扫描破损价格牌，再从右腰工具包拿出小型清洁喷枪；鸵鸟在背景啄旧报纸；50mm 平滑跟拍。`, 1050, 0, '16:9'),
      image('disturb', '镜头 3 · 扰动', `持续使用角色与环境母版及上一镜头。机器人身后过肩镜头，三只行动缓慢的丧尸出现在维修间附近废弃汽车之间；机器人清洁动作停在一半，轻微歪头，冷静地放下两个橙色警示锥；无血腥，稳定 50mm。`, 1400, 0, '16:9'),
      image('guide', '镜头 4 · 引导', `持续使用同一机器人、机械鸵鸟、加油站空间和夕阳光线。横向跟拍，机器人拖着咔嗒作响的金属垃圾车穿过前场，引导缓慢丧尸走向打开车门的废弃巴士；机械鸵鸟小跑跟随，35mm 平滑移动。`, 1750, 0, '16:9'),
      image('ending', '镜头 5 · 安静结尾', `持续使用全部母版和上一镜头。安静终镜：机器人站在布满灰尘的橱窗前，在玻璃上擦出一个小透明圆；玻璃后是穿褪色红裙的塑料模特，单眼红光变得柔和，机械鸵鸟在身后等待，远处丧尸虚化移动；85mm 克制近景，夕阳尘埃漂浮。`, 2100, 0, '16:9'),
    ],
    edges: [edge('bible', 'character'), edge('bible', 'world'), edge('character', 'arrival'), edge('world', 'arrival'), edge('character', 'inspect'), edge('world', 'inspect'), edge('arrival', 'inspect'), edge('character', 'disturb'), edge('world', 'disturb'), edge('inspect', 'disturb'), edge('character', 'guide'), edge('world', 'guide'), edge('disturb', 'guide'), edge('character', 'ending'), edge('world', 'ending'), edge('guide', 'ending')],
  },
  {
    id: 'tvc-production', title: '产品 TVC · 四镜标准流程', category: '工业化短片', accent: '#6bc7d8',
    description: '锁定产品、布光与摄影规范，输出开场、功能、材质和英雄镜头。',
    tags: ['TVC', '产品广告', '四镜'],
    nodes: [
      upload('product', '产品标准图', 0, 40),
      text('treatment', 'TVC 导演阐述', `产品：银灰色无线降噪耳机；广告主题“让喧嚣退后”；场景：深灰吸音室与镜面水台；色彩：石墨黑、银灰、单一电光蓝；灯光：左后方硬轮廓光、正面大面积柔光；摄影：微距探针镜头与 50mm 产品摄影；节奏：开场静默、功能展示、材质高潮、英雄收束。输出四镜 shot list，固定产品比例、按键、接口和 Logo 位置。`, 0, 320),
      image('look', '产品视觉母版', `图1是产品标准图。生成耳机在深灰镜面水台上的英雄定妆照：产品三分之二侧面，银灰金属与黑色软包材质准确，左后方电光蓝轮廓光，正面柔光，镜面只有轻微倒影，85mm 产品摄影。`, 350, 160, '16:9'),
      image('shot1', '镜头 1 · 静默开场', `图1产品标准图、图2视觉母版。全黑空间中一束窄蓝光从左向右扫过耳机外轮廓，耳机静置镜面水台，画面只逐步显露银灰边缘；85mm，极简高端，深黑层次丰富。`, 700, 0, '16:9'),
      image('shot2', '镜头 2 · 降噪功能', `保持同一耳机与布光。50mm 正侧面中近景，耳机周围可视化的细密声波纹理从混乱逐渐变为平静并消失，产品本身不移动，电光蓝仅作为功能提示。`, 1050, 0, '16:9'),
      image('shot3', '镜头 3 · 材质微距', `严格继承产品母版。100mm 微距探针镜头掠过金属转轴、磨砂耳罩与精密麦克风孔，水台上细小水珠被轮廓光点亮，准确展示真实接口与工艺，不改变结构。`, 1400, 0, '16:9'),
      image('shot4', '镜头 4 · 英雄收束', `使用同一产品与视觉母版。耳机回到三分之二英雄角度，背景由深黑渐变至石墨灰，一条电光蓝水平光线在产品后方形成稳定视觉锚点，右侧留出品牌文案安全区。`, 1750, 0, '16:9'),
    ],
    edges: [edge('product', 'look'), edge('treatment', 'look'), edge('product', 'shot1'), edge('look', 'shot1'), edge('product', 'shot2'), edge('shot1', 'shot2'), edge('product', 'shot3'), edge('shot2', 'shot3'), edge('product', 'shot4'), edge('look', 'shot4'), edge('shot3', 'shot4')],
  },
  {
    id: 'short-drama-production', title: '真人短剧 · 六镜连续性流程', category: '工业化短片', accent: '#b68cff',
    description: '演员定妆、场景母版、轴线规则与六镜覆盖，适合短剧关键场次。',
    tags: ['短剧', '真人一致性', '六镜'],
    nodes: [
      upload('castA', '演员 A 定妆照', 0, 0), upload('castB', '演员 B 定妆照', 0, 270),
      text('scene', '场次通告与连续性', `场次：凌晨两点的医院急诊走廊。演员 A“周医生”：34 岁女性，白大褂、藏蓝手术服、低马尾、银色腕表；演员 B“陈默”：38 岁男性，黑色湿夹克、灰色衬衫、右手缠白纱布。空间：左侧护士站、右侧蓝色塑料椅、尽头绿色出口灯；主光为顶部冷白荧光，窗外雨水提供弱蓝光。剧情：陈默要求查看妹妹病历，周医生拒绝，两人争执后陈默递出关键证据。遵守 180 度轴线，输出建立镜头、A 单人、B 单人、双人中景、证据特写、反应收束六镜。`, 330, 130),
      image('master', '双演员与场景母版', `图1演员 A、图2演员 B。制作同一医院走廊中的双人定妆母版：周医生在左、陈默在右，完整保留两人脸部身份与服装；背景明确护士站、蓝椅和绿色出口灯；冷白顶光与弱蓝雨光，写实电视剧摄影。`, 680, 130, '16:9'),
      image('s1', '镜头 1 · 建立', `使用双演员与场景母版。医院走廊广角建立镜头，周医生站在左侧护士站外，陈默从右侧走近，两人隔三米对视；24mm，固定机位，明确空间与轴线。`, 1030, 0, '16:9'),
      image('s2', '镜头 2 · 周医生', `图1母版、图2上一镜头。周医生越肩近景，保持低马尾、白大褂与银色腕表，她压低声音拒绝请求，眼神疲惫但坚定；陈默肩膀虚化在右前景，85mm。`, 1380, 0, '16:9'),
      image('s3', '镜头 3 · 陈默', `保持同一轴线和光线。陈默反打近景，黑色湿夹克与右手白纱布不变，雨水仍在肩部，克制愤怒地看向周医生；周医生肩膀虚化在左前景，85mm。`, 1730, 0, '16:9'),
      image('s4', '镜头 4 · 双人争执', `保持两位演员、服装、空间道具和 180 度轴线。50mm 双人中景，陈默向前半步，周医生没有后退，护士站在左后方，绿色出口灯位于画面深处。`, 2080, 0, '16:9'),
      image('s5', '镜头 5 · 证据特写', `严格延续上一镜头。100mm 手部特写，陈默缠白纱布的右手把一枚旧录音笔放到护士站台面，周医生戴银色腕表的左手进入画面但尚未触碰；冷白顶光。`, 2430, 0, '16:9'),
      image('s6', '镜头 6 · 反应收束', `使用母版与上一镜头。周医生面部近景，她低头看录音笔后抬眼望向陈默，坚定表情出现细微动摇；左眼高光、低马尾、服装与背景出口灯位置完全连续，85mm 缓慢推近感。`, 2780, 0, '16:9'),
    ],
    edges: [edge('castA', 'master'), edge('castB', 'master'), edge('scene', 'master'), edge('master', 's1'), edge('master', 's2'), edge('s1', 's2'), edge('master', 's3'), edge('s2', 's3'), edge('master', 's4'), edge('s3', 's4'), edge('master', 's5'), edge('s4', 's5'), edge('master', 's6'), edge('s5', 's6')],
  },
  {
    id: 'studio-portrait-set', title: '棚拍人像 · 四套布光组照', category: '棚拍人像', accent: '#e8b38b',
    description: '用人物定妆照锁定身份，生成蝴蝶光、伦勃朗光、彩色轮廓光和全身时尚照。',
    tags: ['棚拍', '人像', '布光'],
    nodes: [
      upload('portrait', '人物定妆照', 0, 100),
      text('art', '棚拍视觉规范', `拍摄对象：32 岁东亚女性创意总监；造型：黑色利落短发、自然裸妆、哑光黑高领针织衫、银色细耳环；背景：无缝中灰影棚纸；摄影：中画幅商业人像、自然皮肤纹理、低饱和。统一禁止磨皮、改变脸型、年龄、发型、耳环和服装。四套布光分别为正面蝴蝶光、45 度伦勃朗光、蓝红双轮廓光、柔光箱全身时尚照。`, 0, 370),
      image('master', '身份与造型母版', `图1为人物定妆照。生成中性棚拍身份母版：正面胸像、左侧面、右侧三分之二侧面并列，同一黑色短发、裸妆、黑高领与银色耳环，中灰背景，85mm，中画幅自然肤质。`, 350, 180, '16:9'),
      image('butterfly', '蝴蝶光美妆肖像', `图1身份母版。正面头肩肖像，大型柔光箱位于镜头正上方，鼻下形成轻微对称蝴蝶影，下方白色反光板提亮眼窝；100mm，f/8，中灰背景，皮肤真实。`, 700, 0, '3:4'),
      image('rembrandt', '伦勃朗情绪肖像', `图1身份母版。人物身体微转 30 度，主光从左前方 45 度高位照射，右脸形成清晰但柔和的三角光，黑旗控制溢光；85mm，深灰背景，克制编辑感。`, 700, 350, '3:4'),
      image('gel', '彩色轮廓光肖像', `图1身份母版。正面冷静表情，左后方钴蓝轮廓光、右后方暗红轮廓光，正面极弱柔光保留真实肤色，黑色背景，发丝边缘清晰，85mm。`, 1050, 0, '3:4'),
      image('full', '全身时尚棚拍', `图1身份母版。人物全身站姿，黑色高领搭配同色阔腿裤，右手自然插袋，左脚轻微向前；大型八角柔光箱左前方，白色无缝背景带浅灰落地阴影，50mm。`, 1050, 350, '3:4'),
    ],
    edges: [edge('portrait', 'master'), edge('art', 'master'), edge('master', 'butterfly'), edge('master', 'rembrandt'), edge('master', 'gel'), edge('master', 'full')],
  },
  {
    id: 'short-drama-dialogue', title: '都市短剧 · 对话反打流程', category: '工业化短片', accent: '#cf8fa8',
    description: '双演员定妆、空间轴线和八镜覆盖，适合情绪对话场次。',
    tags: ['短剧', '反打', '对话'],
    nodes: [
      upload('woman', '女主定妆照', 0, 0), upload('man', '男主定妆照', 0, 260),
      text('script', '场次剧本与轴线表', `场次：冬夜 23:40 的高层公寓厨房。女主许宁，30 岁，灰色羊绒开衫、白色背心、低马尾；男主顾川，33 岁，深棕大衣、黑衬衫、左手婚戒。剧情：顾川回家发现桌上的辞职信，许宁承认即将离开城市；冲突从克制到爆发，再归于沉默。固定空间：岛台在中央、落地窗在右后方、冰箱在左、暖色吊灯为主光、窗外冷蓝城市光为辅。严格遵守 180 度轴线，输出八镜对话覆盖表和每镜可见动作。`, 330, 130),
      image('master', '双人厨房母版', `图1女主、图2男主。生成两人在高层公寓厨房中的双人定妆母版：许宁在岛台左侧，顾川在右侧，服装身份严格匹配；暖吊灯与冷蓝窗光，岛台、辞职信、玻璃水杯位置明确，写实都市短剧。`, 680, 130, '16:9'),
      image('establish', '镜头 1 · 双人建立', `使用母版。35mm 双人中广景，许宁背靠岛台左侧，顾川刚走到右侧，辞职信位于两人之间，暖吊灯形成情绪中心，窗外冷蓝城市虚化。`, 1030, 0, '16:9'),
      image('womanClose', '镜头 2 · 女主近景', `图1母版、图2上一镜头。许宁越肩近景，低马尾与灰开衫不变，她低头看水杯后说出离开的决定；顾川深棕大衣肩膀虚化在右前景，85mm。`, 1380, 0, '16:9'),
      image('manClose', '镜头 3 · 男主反打', `保持轴线。顾川越肩近景，左手婚戒可见，他先看辞职信再抬眼，压住愤怒；许宁灰开衫肩膀虚化在左前景，85mm，冷蓝窗光勾边。`, 1730, 0, '16:9'),
      image('insert', '镜头 4 · 辞职信插入', `延续空间。100mm 台面特写，顾川戴婚戒的左手压住辞职信一角，许宁的透明水杯位于后景，暖灯倒影在纸面，文字不必可读。`, 2080, 0, '16:9'),
      image('conflict', '镜头 5 · 冲突双人', `同一两人和厨房。50mm 双人中景，顾川把辞职信推向许宁，许宁没有伸手，二人隔岛台对峙；暖吊灯仍居中，动作方向严格连续。`, 2430, 0, '16:9'),
      image('ending', '镜头 6 · 沉默收束', `同一身份、服装和空间。许宁独自站在落地窗前背对镜头，顾川在远处厨房虚焦停住，辞职信仍在岛台；50mm 缓慢拉远感，暖冷光分隔两人。`, 2780, 0, '16:9'),
    ],
    edges: [edge('woman', 'master'), edge('man', 'master'), edge('script', 'master'), edge('master', 'establish'), edge('master', 'womanClose'), edge('establish', 'womanClose'), edge('master', 'manClose'), edge('womanClose', 'manClose'), edge('master', 'insert'), edge('manClose', 'insert'), edge('master', 'conflict'), edge('insert', 'conflict'), edge('master', 'ending'), edge('conflict', 'ending')],
  },
  {
    id: 'environment-concept', title: '场景概念 · 世界观套图', category: '场景设计', accent: '#79c6a7',
    description: '先锁定地图、材质和光线，再输出建立、室内、细节与气氛变化。',
    tags: ['场景', '世界观', '概念设计'],
    nodes: [
      text('world', '世界观与空间圣经', `项目：海水退去后的“潮汐图书馆”。地点是一座建在旧海床上的粗野主义公共建筑，主体为盐蚀混凝土、氧化铜屋顶和巨型圆形天窗；内部保存被海水浸泡后修复的书籍。空间固定关系：南侧长坡道通向主入口，中庭圆形天窗正下方是浅水池，西侧双层书架，北侧修复工作间。色彩为盐白、混凝土灰、氧化铜绿；天气为暴雨后清晨，低云间有一束冷金色阳光。输出场景材质、地图关系、尺度锚点和不可变更项。`, 0, 160),
      image('master', '场景总母版', `根据参考文本制作生产级环境设定板：左侧为建筑鸟瞰与入口长坡道，右上为中庭圆形天窗和浅水池，右下为西侧双层书架与北侧修复工作间；统一盐蚀混凝土、氧化铜与冷金晨光，无人物、无文字。`, 350, 160, '16:9'),
      image('exterior', '外景建立镜头', `图1场景母版。24mm 低机位宽幅外景，旧海床龟裂纹理延伸至潮汐图书馆南侧长坡道，粗野主义主体和氧化铜屋顶完整可见，暴雨后低云裂开冷金色晨光。`, 700, 0, '16:9'),
      image('atrium', '中庭主空间', `图1场景母版。20mm 室内广角，从主入口看向中庭，圆形天窗正下方浅水池反射冷金光，西侧双层书架在左，北侧工作间玻璃墙在远处，空间关系准确。`, 700, 350, '16:9'),
      image('detail', '材质细节镜头', `继承场景母版。85mm 建筑细节，盐霜在粗糙混凝土接缝处结晶，氧化铜排水链滴落雨水，修复书籍透过工作间玻璃形成柔和背景，真实材质。`, 1050, 0, '16:9'),
      image('night', '夜间气氛版本', `严格保持图1建筑与空间布局，仅将时间改为蓝调时刻。中庭水池下方暖色地灯亮起，圆形天窗呈深蓝天空，西侧书架有克制暖光，外部旧海床保持冷色，无结构变化。`, 1050, 350, '16:9'),
    ],
    edges: [edge('world', 'master'), edge('master', 'exterior'), edge('master', 'atrium'), edge('master', 'detail'), edge('master', 'night')],
  },
  {
    id: 'beauty-tvc', title: '美妆 TVC · 液体质感五镜', category: 'TVC 广告', accent: '#ef9bb5',
    description: '锁定包装与液体材质，完成成分、肤感、产品和品牌收束镜头。',
    tags: ['美妆', '液体', 'TVC'],
    nodes: [
      upload('pack', '产品包装标准图', 0, 30),
      text('creative', '美妆创意脚本', `产品：透明磨砂玻璃瓶装精华，淡粉色液体，银色泵头；核心成分：玻尿酸与山茶花；卖点：轻盈补水、不黏腻；视觉主题“清晨第一滴露水”；色彩：珍珠白、柔粉、少量银色；背景：高键白色水面与半透明亚克力；摄影：100mm 微距、探针镜头、120fps 慢动作质感。输出五镜：露珠开场、成分意象、液体肤感、包装英雄、Logo 安全区收束。`, 0, 310),
      image('master', '包装与液体母版', `图1产品包装标准图。生成高键美妆产品母版：透明磨砂玻璃瓶、淡粉液体、银色泵头结构与比例完全准确，瓶身放在珍珠白水面，柔粉渐变背景，两侧大型柔光箱形成细长高光。`, 350, 150, '3:4'),
      image('drop', '镜头 1 · 露珠开场', `图1包装母版。100mm 极微距，一滴透明露珠悬在山茶花瓣尖端，珍珠白背景，露珠中折射淡粉色产品瓶轮廓，柔和高键光，真实表面张力。`, 700, 0, '16:9'),
      image('ingredient', '镜头 2 · 成分意象', `保持柔粉与珍珠白视觉。半透明玻尿酸凝胶丝带在白色水面缓慢展开，山茶花瓣从画面上方落下，银色微光粒子克制点缀，100mm 微距，无产品结构变形。`, 1050, 0, '16:9'),
      image('texture', '镜头 3 · 液体肤感', `延续母版色彩。淡粉精华液滴落在真实手背，迅速铺展成轻薄水膜，没有油腻反光；健康自然皮肤纹理清晰，探针微距，柔光均匀。`, 1400, 0, '16:9'),
      image('hero', '镜头 4 · 包装英雄', `图1包装标准图、图2母版。产品瓶从浅水中稳定升起，底部形成一圈克制涟漪，银色泵头与磨砂玻璃高光准确，淡粉液体通透，三分之二英雄角度。`, 1750, 0, '16:9'),
      image('end', '镜头 5 · 品牌收束', `使用同一包装。产品瓶居中静置于半透明亚克力台，左后方山茶花虚化，珍珠白到柔粉渐变背景，右侧留出品牌 Logo、产品名与卖点三行文案安全区；高键商业美妆成片。`, 2100, 0, '16:9'),
    ],
    edges: [edge('pack', 'master'), edge('creative', 'master'), edge('master', 'drop'), edge('master', 'ingredient'), edge('drop', 'ingredient'), edge('master', 'texture'), edge('ingredient', 'texture'), edge('pack', 'hero'), edge('master', 'hero'), edge('hero', 'end')],
  },
  {
    id: 'myriad-demons-chronicle', title: '万妖图录 · 东方志怪七镜', category: '工业化模板', accent: '#bd5b4a',
    description: '妖物图鉴、镇妖人和古城场景三重母版，生产一支完整东方志怪短片。',
    tags: ['东方志怪', '妖怪图鉴', '七镜'],
    nodes: [
      text('lore', '妖物档案与七镜脚本', `片名《雾隐录：灯笼魇》。时代为架空晚唐，地点是被雨雾笼罩的山城“栖霞镇”。镇妖人沈砚：28 岁中国男性，清瘦长脸、右眉断痕、黑发高束，穿旧玄青圆领袍、暗红护腕，背负桃木匣。妖物“灯笼魇”：由褪色红灯笼、湿漉漉黑发和六条竹骨节足组成，灯纸内只有一只金色竖瞳，不得变成人脸。情节依次为入城、异灯、现形、追逐、结印、封匣、余烬。固定青黑雨夜、朱红灯火、宣纸纤维与写实电影材质，输出七镜动作、景别、机位及连续性表。`, 0, 110),
      image('bestiary', '妖物图鉴母版', `根据档案生成灯笼魇生产级图鉴：同一个妖物的正面、侧面、背面与蜷缩形态；褪色红灯笼躯干、湿黑长发、六条竹骨节足、灯纸内唯一金色竖瞳，旧宣纸背景，无文字、无人脸、无新增器官。`, 340, 0, '16:9'),
      image('hunter', '镇妖人母版', `根据档案生成沈砚全身正面、侧面与面部近景，同一清瘦长脸、右眉断痕、黑发高束、旧玄青圆领袍、暗红护腕和桃木匣；写实唐风，不仙侠华服，不改变年龄。`, 340, 350, '16:9'),
      image('world', '栖霞镇场景母版', `生成栖霞镇雨夜环境母版：层叠黑瓦木楼、窄石阶、临街灯笼铺、山雾和排水沟；青黑环境光与朱红灯火，写实电影置景，固定街道转角、牌楼与灯笼铺空间关系。`, 690, 175, '16:9'),
      image('s1', '镜头 1 · 雾中入城', `图1沈砚、图2栖霞镇。24mm 低机位建立镜头，沈砚背桃木匣走过牌楼进入雨雾山城，玄青袍下摆被雨打湿，远处灯笼铺呈朱红光点。`, 1040, 0, '16:9'),
      image('s2', '镜头 2 · 异灯窥视', `图1妖物、图2沈砚、图3上一镜头。85mm 视线匹配，沈砚停在石阶上抬头，一只外形严格匹配母版的灯笼魇倒挂在屋檐，金色竖瞳隔湿发窥视。`, 1390, 0, '16:9'),
      image('s3', '镜头 3 · 妖物现形', `保持妖物结构与街道布局。35mm 倾斜机位，灯笼魇六条竹骨足撑开落到石阶，湿发甩出雨水；沈砚从桃木匣抽出黄纸符，动作方向连续。`, 1740, 0, '16:9'),
      image('s4', '镜头 4 · 巷道追逐', `同一沈砚、妖物与栖霞镇。28mm 侧向跟拍，灯笼魇沿窄巷墙面疾行，沈砚踩过积水追赶，朱红灯影在青黑湿地拉成长线，不新增妖怪。`, 2090, 0, '16:9'),
      image('s5', '镜头 5 · 雨中结印', `50mm 中近景，沈砚在灯笼铺前双手结印，右眉断痕、暗红护腕和玄青袍准确；黄纸符被雨水打湿但亮起克制金光，灯笼魇位于后景。`, 2440, 0, '16:9'),
      image('s6', '镜头 6 · 封入木匣', `35mm 俯拍，灯笼魇化为红黑烟丝被吸入打开的桃木匣，六条竹骨足逐步收拢，沈砚单膝跪地压住匣盖，街道和道具位置连续。`, 2790, 0, '16:9'),
      image('s7', '镜头 7 · 灯火余烬', `85mm 收束特写，桃木匣已关闭，匣缝透出一线朱红光；沈砚沾雨的手按在匣盖，背景灯笼铺恢复寂静，一只普通灯笼轻晃，克制留白。`, 3140, 0, '16:9'),
    ],
    edges: [edge('lore', 'bestiary'), edge('lore', 'hunter'), edge('lore', 'world'), edge('hunter', 's1'), edge('world', 's1'), edge('bestiary', 's2'), edge('hunter', 's2'), edge('s1', 's2'), edge('bestiary', 's3'), edge('s2', 's3'), edge('world', 's4'), edge('s3', 's4'), edge('hunter', 's5'), edge('s4', 's5'), edge('bestiary', 's6'), edge('s5', 's6'), edge('s6', 's7')],
  },
  {
    id: 'kpop-mv-production', title: 'K-pop MV · 三造型九镜', category: '工业化模板', accent: '#8d72ff',
    description: '艺人身份、三套造型和主舞台锁定，覆盖舞蹈、叙事与 Beauty 镜头。',
    tags: ['K-pop', 'MV', '舞蹈'],
    nodes: [
      upload('artist', '艺人身份参考', 0, 0),
      text('concept', 'MV 概念与镜头表', `单曲《NEON ORBIT》，四人女子组合，视觉主题“凌晨两点的失重地铁”。造型 A：银灰机能制服与黑色长靴；造型 B：深蓝亮片礼服；造型 C：白色运动套装配钴蓝线条。主舞台为废弃地铁站，镜面黑地板、环形 LED、钴蓝与品红灯光。九镜覆盖：舞台建立、四人齐舞、主唱近景、轨道叙事、低机位舞蹈、成员 Beauty、造型转场、高潮群舞、定格收束。固定四人脸型、发色、身高顺序和每套服装，不得交换成员特征。`, 0, 280),
      image('master', '组合与三造型母版', `图1为艺人身份参考。生成四名成员身份与造型母版，每人依次展示 A 银灰机能、B 深蓝亮片、C 白色运动三套全身造型；脸、发色、身高顺序严格一致，纯灰背景，无文字。`, 350, 130, '16:9'),
      image('stage', '主舞台母版', `根据概念生成废弃地铁站主舞台：镜面黑地板、两侧旧站台、中央环形 LED、远处隧道，钴蓝主光与品红轮廓光；24mm 对称构图，无人物。`, 700, 130, '16:9'),
      image('danceWide', '镜头 1 · 群舞建立', `图1组合母版、图2舞台。四名成员穿造型 A，在环形 LED 前完成同步舞蹈定格，24mm 正面对称广角，成员顺序不变，完整四肢，镜面地板有清晰倒影。`, 1050, 0, '16:9'),
      image('vocal', '镜头 2 · 主唱推进', `保持主唱身份与造型 A。50mm 稳定器从中景推进到胸像，她直视镜头演唱，其他三人在钴蓝灯下虚化，品红轮廓光勾勒发丝。`, 1400, 0, '16:9'),
      image('track', '镜头 3 · 轨道叙事', `同一主唱换造型 B，独自走在停运轨道中央，深蓝亮片礼服与湿润轨枕反光，隧道远处白光形成剪影，35mm 侧后方跟拍。`, 1750, 0, '16:9'),
      image('lowDance', '镜头 4 · 低机位齐舞', `四名成员恢复造型 A 和固定顺序。18mm 极低机位，舞蹈动作向镜头延伸，环形 LED 呈倾斜光轨，人物比例自然，不出现多余肢体。`, 2100, 0, '16:9'),
      image('beauty', '镜头 5 · Beauty 特写', `图1身份母版。指定主唱造型 B 的 100mm 面部 Beauty 特写，真实妆面、银色眼线、深蓝亮片肩部可见，钴蓝眼神光与柔和品红背景散景。`, 2450, 0, '16:9'),
      image('finale', '镜头 6 · 高潮收束', `四名成员换造型 C，在同一主舞台完成高潮群舞终止动作；顶部白光倾泻，钴蓝线条服装与环形 LED 呼应，24mm 正面宽幅，右上保留片名安全区。`, 2800, 0, '16:9'),
    ],
    edges: [edge('artist', 'master'), edge('concept', 'master'), edge('concept', 'stage'), edge('master', 'danceWide'), edge('stage', 'danceWide'), edge('master', 'vocal'), edge('danceWide', 'vocal'), edge('master', 'track'), edge('vocal', 'track'), edge('master', 'lowDance'), edge('stage', 'lowDance'), edge('track', 'lowDance'), edge('master', 'beauty'), edge('lowDance', 'beauty'), edge('master', 'finale'), edge('stage', 'finale'), edge('beauty', 'finale')],
  },
  {
    id: 'fashion-editorial', title: '时尚杂志 · 封面内页套组', category: '工业化模板', accent: '#d4bc72',
    description: '锁定模特与高级成衣，输出封面、跨页、Beauty、配饰及目录页底图。',
    tags: ['杂志', '时尚', 'Editorial'],
    nodes: [
      upload('model', '模特定妆参考', 0, 40), upload('look', '服装与配饰参考', 0, 300),
      text('brief', '杂志视觉 Brief', `刊物主题《新秩序 / NEW ORDER》，秋季建筑特刊。模特穿结构化炭灰羊毛长外套、象牙白衬衫、银色几何耳饰；场景为清水混凝土美术馆，锐利斜阳与大面积硬阴影；影像参考 1990 年代极简主义时装摄影，中画幅胶片、低饱和灰褐色。输出封面、双页跨页、面部 Beauty、配饰细节、目录页底图五张；固定模特身份、服装结构和耳饰，不生成实际文字，仅预留排版安全区。`, 340, 160),
      image('master', '模特与造型母版', `图1模特、图2服装配饰。生成同一模特正面全身、侧面全身与胸像造型母版：炭灰结构长外套、象牙白衬衫、银色几何耳饰比例准确，中性灰背景。`, 690, 160, '16:9'),
      image('cover', '杂志封面', `图1母版。竖版封面底图，模特正面站在清水混凝土墙前，锐利斜阳切过面部与外套，85mm，顶部和左右边缘保留刊名及标题安全区，无实际文字。`, 1040, 0, '3:4'),
      image('spread', '双页跨页', `同一模特与造型。横版跨页构图，模特位于右页三分线，左页展示美术馆巨大混凝土楼梯和硬阴影，50mm，中缝区域无重要主体，左侧保留长文安全区。`, 1040, 350, '16:9'),
      image('beauty', 'Beauty 内页', `图1母版。100mm 面部近景，银色几何耳饰完整，斜阳只照亮一只眼和颧骨，自然皮肤纹理、极简灰褐背景，右侧保留小标题区域。`, 1390, 0, '3:4'),
      image('detail', '配饰细节页', `图1母版。100mm 微距，模特手指轻触炭灰外套翻领，银色耳饰在背景散景中呼应；羊毛织纹、衬衫纤维和金属拉丝材质清晰，无手指错误。`, 1390, 350, '3:4'),
      image('contents', '目录页底图', `同一美术馆与造型。模特作为小比例人物走过远处混凝土廊道，大面积墙面硬阴影构成抽象几何，竖版，左侧 60% 留作目录排版，无实际文字。`, 1740, 160, '3:4'),
    ],
    edges: [edge('model', 'master'), edge('look', 'master'), edge('brief', 'master'), edge('master', 'cover'), edge('master', 'spread'), edge('master', 'beauty'), edge('master', 'detail'), edge('master', 'contents')],
  },
].sort((a, b) => {
  const priority = ['myriad-demons-chronicle', 'kpop-mv-production', 'fashion-editorial', 'studio-portrait-set', 'short-drama-production', 'short-drama-dialogue', 'tvc-production', 'beauty-tvc', 'environment-concept', 'zombie-scavenger']
  const aIndex = priority.indexOf(a.id)
  const bIndex = priority.indexOf(b.id)
  return (aIndex < 0 ? priority.length : aIndex) - (bIndex < 0 ? priority.length : bIndex)
})

const CATEGORIES = ['精选工业化', '角色与 IP', '商业电商', '影视 / TVC 广告', '品牌与 KV', '视觉场景'] as const
const STORAGE_KEY = 'disylab.workflow-templates.v2'
type StoredWorkflowTemplates = { custom: WorkflowTemplate[]; overrides: WorkflowTemplate[]; hidden: string[] }
type EditorNode = { id: string; kind: 'text' | 'image' | 'upload' | 'video'; title: string; prompt: string }
type EditorDraft = { id?: string; sourceId?: string; title: string; description: string; category: string; tags: string; accent: string; nodes: EditorNode[] }

const CATEGORY_BY_ID: Record<string, string> = {
  'character-sheet': '角色与 IP', 'brand-mascot': '角色与 IP', 'studio-portrait-set': '角色与 IP',
  'product-backgrounds': '商业电商', 'ecommerce-set': '商业电商',
  storyboard: '影视分镜', 'zombie-scavenger': '精选工业化', 'tvc-production': '精选工业化',
  'short-drama-production': '精选工业化', 'short-drama-dialogue': '影视分镜', 'beauty-tvc': '精选工业化',
  'myriad-demons-chronicle': '精选工业化', 'kpop-mv-production': '精选工业化',
  'brief-poster': '品牌与 KV', 'brand-kit': '品牌与 KV', 'fashion-editorial': '品牌与 KV',
  'style-transfer': '场景与视觉', 'three-directions': '场景与视觉',
  'iterate-polish': '场景与视觉', 'environment-concept': '场景与视觉',
}

const productionTemplate = (
  id: string, title: string, category: string, description: string, tags: string[],
  brief: string, outputs: Array<[string, string, string, string?]>, options?: { uploadTitle?: string; accent?: string },
): WorkflowTemplate => {
  const nodes: WorkflowTemplateNode[] = []
  if (options?.uploadTitle) nodes.push(upload('reference', options.uploadTitle, 0, 0))
  nodes.push(text('brief', '生产 Brief 与一致性规范', brief, 0, options?.uploadTitle ? 270 : 80))
  outputs.forEach(([idSuffix, nodeTitle, prompt, ratio], index) => {
    nodes.push(image(idSuffix, nodeTitle, prompt, 360 + index * 350, index % 2 ? 340 : 0, ratio ?? '16:9'))
  })
  const firstOutput = outputs[0]?.[0]
  const edges = firstOutput ? [edge('brief', firstOutput), ...(options?.uploadTitle ? [edge('reference', firstOutput)] : [])] : []
  outputs.slice(1).forEach(([idSuffix], index) => {
    edges.push(edge(outputs[index][0], idSuffix))
    edges.push(edge('brief', idSuffix))
    if (options?.uploadTitle) edges.push(edge('reference', idSuffix))
  })
  return { id, title, category, description, tags, accent: options?.accent ?? '#8f9cff', nodes, edges }
}

const commercialKvTemplate = (
  id: string,
  title: string,
  description: string,
  brief: string,
  sketchPrompt: string,
  colorPrompt: string,
  renderPrompt: string,
  finalPrompt: string,
  accent: string,
): WorkflowTemplate => ({
  id,
  title,
  category: '品牌与 KV',
  description,
  tags: ['商业KV', '线稿控图', 'C4D渲染'],
  accent,
  nodes: [
    upload('brandAssets', '品牌 / 产品 / IP 资产', 0, 0),
    text('brief', '商业策略与画面 Brief', brief, 0, 280),
    image('sketch', '构图线稿', sketchPrompt, 350, 120, '16:9'),
    upload('colorReference', '配色与插画风格参考', 700, 0),
    image('colorScript', '彩色气氛稿', colorPrompt, 700, 320, '16:9'),
    upload('renderReference', 'C4D 材质渲染参考', 1050, 0),
    image('materialTest', '材质与灯光测试', renderPrompt, 1050, 320, '16:9'),
    image('cleanKv', '无字商业主视觉', finalPrompt, 1400, 120, '16:9'),
    image('portraitKv', '竖版 KV 成片', '严格沿用图1最终主视觉的角色、产品、门店、材质与灯光，重构为3:4竖版；顶部和右侧保留品牌标题、联名标识、活动时间地点安全区，不生成错误文字。', 1750, 0, '3:4'),
    image('landscapeKv', '横版 KV 成片', '严格沿用图1最终主视觉，输出16:9横版商业KV；主体位于左中部，右侧保留主标题、卖点、搜索框与CTA安全区，品牌色和C4D材质完全一致。', 1750, 350, '16:9'),
  ],
  edges: [
    edge('brandAssets', 'sketch'), edge('brief', 'sketch'),
    edge('sketch', 'colorScript'), edge('colorReference', 'colorScript'),
    edge('colorScript', 'materialTest'), edge('renderReference', 'materialTest'),
    edge('brandAssets', 'cleanKv'), edge('sketch', 'cleanKv'), edge('colorScript', 'cleanKv'),
    edge('materialTest', 'cleanKv'), edge('cleanKv', 'portraitKv'), edge('cleanKv', 'landscapeKv'),
  ],
})

const EXPANDED_TEMPLATES: WorkflowTemplate[] = [
  {
    id: 'xinpianchang-sci-fi-western-world',
    title: '科幻西部 · 世界观资产生产线',
    category: '精选工业化',
    accent: '#e85d4a',
    description: '按新片场共享画布结构还原：机器人、牛仔、武器、女主、双场景和分镜设计并行汇聚。',
    tags: ['新片场', '科幻西部', '角色资产', '场景分镜'],
    nodes: [
      text('worldBrief', '世界观生产 Brief', '项目为近未来科幻西部短片：家政机器人被改造成荒漠牛仔，与红裙女主穿越废弃度假村和末日商业街。固定写实电影概念设计、暖灰金属、褪色皮革、沙尘青橙色调；所有角色、武器和建筑必须跨节点保持结构一致。', 0, 160),
      image('robotFront', '机器人正面母版', '生成白灰色人形服务机器人正面全身，纤细机械骨架、圆角头罩、胸腔模块和关节结构清晰，中性灰棚拍背景。', 340, 0, '3:4'),
      image('robotBack', '机器人背面母版', '严格沿用图1机器人，生成背面全身，脊柱线缆、电池仓、肩胛和腿部关节与正面结构对应，中性灰背景。', 340, 350, '3:4'),
      image('faceMatrix', '六色表情面罩矩阵', '沿用机器人头部结构，生成红、白、绿、蓝、粉、黄六种发光表情面罩；每格仅改变灯色与简洁情绪符号，外壳比例完全一致。', 690, 0, '1:1'),
      image('cowboyFront', '机器人牛仔正面', '将机器人母版改装为荒漠牛仔：旧黑宽檐帽、深灰披肩、磨损皮革枪套和靴套；机械身体仍可辨识，正面全身，中性棚拍。', 690, 350, '3:4'),
      image('cowboySheet', '牛仔角色资产板', '图1机器人牛仔、图2六色面罩。生成正侧背三视图、六种面罩表情、帽子、披肩、皮革枪套和金属关节材质小样，所有结构一致，无文字。', 1040, 0, '16:9'),
      image('cowboyVariant', '牛仔造型备选板', '沿用同一机器人牛仔，制作一套更轻量的短披肩版本资产板，保留宽檐帽、枪套与机械骨架，并列展示多视图、表情和材质细节。', 1040, 350, '16:9'),
      image('revolver', '科幻左轮武器', '设计与机器人牛仔比例匹配的科幻左轮：长银灰枪管、黑色握把、机械弹巢和磨损边缘，左侧正投影视图，纯灰背景，不增加文字。', 1390, 0, '16:9'),
      upload('womanReference', '女主服装参考', 1390, 350),
      image('womanLook', '红裙女主定妆', '图1服装参考。生成同一年轻女主全身定妆：复古红色短袖收腰连衣裙、红色低跟鞋、深棕短卷发；1950年代轮廓与近未来细节克制融合，灰色棚拍背景。', 1740, 350, '3:4'),
      text('resortBrief', '废弃度假村场景圣经', '场景A：沙漠中的流线型未来度假村，白色弧形混凝土、棕榈树、空泳池、散落遮阳伞与废弃车辆；午后强烈日光、风沙和褪色青橙色，固定主楼、泳池与道路空间关系。', 1740, 0),
      image('resortBoard', '度假村环境探索板', '根据场景圣经生成四格环境概念：泳池广角、主楼入口、道路侧景和棕榈庭院；同一建筑语言、天气、损坏程度与色彩。', 2080, 0, '16:9'),
      image('resortHero', '度假村建立镜头', '沿用图1环境探索，24mm 宽幅建立镜头，废弃泳池位于前景，流线型主楼居中偏右，沙尘覆盖地面，空间结构准确，无人物。', 2430, 0, '16:9'),
      text('streetBrief', '末日街区场景圣经', '场景B：同一世界中的废弃商业街，装饰艺术风格立面、破损橱窗、老式汽车、棕榈树与远处高架；道路有浅水反光，晨间冷灰天光混合残余暖色招牌。', 1740, 700),
      image('streetBoard', '末日街区探索板', '根据场景圣经生成四格街区概念：十字路口、商店立面、积水车道和高架远景；建筑、车辆、天气与损坏程度在四格中连续。', 2080, 700, '16:9'),
      image('streetHero', '末日街区建立镜头', '沿用图1探索板，28mm 街道视平线建立镜头，旧汽车停在左侧，装饰艺术建筑延伸至消失点，积水反射冷暖光，无新增建筑风格。', 2430, 700, '16:9'),
      image('storySketch', '关键场面分镜草图', '结合机器人牛仔、红裙女主、度假村和科幻左轮，生成黑白铅笔分镜：主楼前对峙，角色和建筑位置清楚，16:9 构图，不生成文字。', 2780, 250, '16:9'),
      image('storyBlocking', '分镜走位确认图', '沿用上一张分镜和全部母版，在黑白草图上以红色圈线标记机器人起点、女主位置与行动路径，以绿色框标记主楼目标区域；保持原构图。', 3130, 250, '16:9'),
    ],
    edges: [
      edge('worldBrief', 'robotFront'), edge('worldBrief', 'robotBack'), edge('robotFront', 'faceMatrix'),
      edge('robotFront', 'cowboyFront'), edge('robotBack', 'cowboyFront'), edge('faceMatrix', 'cowboySheet'),
      edge('cowboyFront', 'cowboySheet'), edge('cowboyFront', 'cowboyVariant'), edge('faceMatrix', 'cowboyVariant'),
      edge('cowboySheet', 'revolver'), edge('womanReference', 'womanLook'),
      edge('resortBrief', 'resortBoard'), edge('resortBoard', 'resortHero'),
      edge('streetBrief', 'streetBoard'), edge('streetBoard', 'streetHero'),
      edge('cowboySheet', 'storySketch'), edge('revolver', 'storySketch'), edge('womanLook', 'storySketch'),
      edge('resortHero', 'storySketch'), edge('storySketch', 'storyBlocking'),
    ],
  },
  productionTemplate('live-action-character-bible', '真人角色圣经 · 定妆全案', '角色与 IP', '锁定真人身份、服化道和表演边界，输出可跨镜复用的角色母版。', ['真人', '角色圣经', '定妆'], '角色：程野，36岁中国男性调查记者；长方脸、左眉尾疤痕、短黑发夹少量白发，深灰旧风衣、墨绿衬衫、机械表。请输出脸部生物特征、体型比例、服装分层、道具磨损、五种情绪边界与不可变更项。写实电影选角照，不美化年龄。', [['master', '真人身份母版', '生成同一演员正面胸像、左右三分之二侧面与全身定妆，脸部骨相、疤痕、发际线、风衣层次和机械表完全一致，中性灰摄影棚背景。', '16:9'], ['expression', '表演范围表', '沿用图1同一真人，制作克制微笑、怀疑、压抑愤怒、疲惫、警觉五种头肩表演参考，禁止换脸、换发型、夸张漫画表情。', '16:9']], { accent: '#c59b7c' }),
  productionTemplate('period-character', '古装角色 · 朝代考据设定', '角色与 IP', '从身份与时代考据生成可拍摄的古装角色设定。', ['古装', '考据', '角色'], '角色：北宋汴京女医师，27岁，清瘦鹅蛋脸，黑发低髻，素青交领窄袖衫、灰蓝褙子、麻布药囊。遵循北宋平民服饰结构与天然染色，列出发髻、衣襟、腰带、鞋履、药具和禁用的现代/仙侠元素。', [['sheet', '古装角色三视图', '同一北宋女医师正面、侧面、背面全身设定，服装层级、系带位置、药囊和发髻结构准确，旧宣纸灰背景，无文字。'], ['scene', '时代场景定妆', '沿用图1角色，置于北宋汴京清晨药铺门前，手持竹编药篮，写实电影服化道测试照，35mm，自然阴天光。']], { accent: '#9aab82' }),
  productionTemplate('character-expression-action', '角色表情与动作库', '角色与 IP', '批量建立统一角色的表情、手势与动作姿态资产。', ['表情', '动作', '资产'], '为上传角色建立动画/广告可复用动作库。保持身份、头身比、服装、配色与材质；表情覆盖喜悦、困惑、专注、惊讶、沮丧、坚定；动作覆盖站立、跑步、跳跃、挥手、指向、持物。', [['expression', '六宫格表情库', '图1角色同一机位和光线，六种表情头肩矩阵；眼睛、眉毛、嘴型差异清晰，禁止改变脸型和发型，无文字。'], ['action', '六姿态动作库', '严格沿用图1角色，完整全身六动作矩阵，重心和肢体结构自然，道具只在持物动作出现，纯色背景。']], { uploadTitle: '角色标准图', accent: '#b58cff' }),
  productionTemplate('character-ip-matrix', '人物 IP 内容矩阵', '角色与 IP', '一套人物 IP 延展头像、贴纸、社媒和周边场景。', ['人物IP', '矩阵', '周边'], 'IP 主角“阿步”：圆脸年轻城市漫游者，橙色针织帽、海军蓝夹克、白色斜挎包。固定脸、服装和橙蓝配色，规划头像、九宫格贴纸、社媒封面、钥匙扣包装四类资产及安全区。', [['avatar', 'IP 头像体系', '生成同一阿步正面微笑、侧脸观察、戴耳机三枚圆形头像，统一柔和3D材质。'], ['sticker', '九宫格贴纸', '沿用同一角色制作九种日常情绪动作贴纸，粗白描边、透明感纯色底，不生成文字。'], ['merch', 'IP 周边提案', '将同一角色准确应用于亚克力钥匙扣、帆布袋和盲盒包装的商业陈列照，品牌橙蓝配色统一。']], { accent: '#ff9b63' }),
  {
    id: 'trendy-ip-matrix',
    title: '潮流 IP 矩阵 · 单人与多人',
    category: '角色与 IP',
    accent: '#ff5d8f',
    description: '先锁定统一头身比与C4D材质语言，再分别输出单人 Lookbook 和三人组照，互不串脸。',
    tags: ['潮流IP', '单人', '多人组照', '盲盒人设'],
    nodes: [
      upload('styleRef', '潮流风格参考', 0, 0),
      text('bible', '潮流 IP 一致性圣经', `系列名“CORTIS”。统一设计语言：2.2 头身、球形关节娃娃体型、厚眼睑困倦大眼、短鼻、小嘴、真实发丝与C4D棚拍材质。禁止写实真人脸、禁止改变头身比。三人固定身份，不得互换发型、眼镜和服装：
A 粉发双丸子辫“米柚”：细框眼镜、银色金属长袖、黑色短裙与渔网、厚底靴。
B 红发男主“赤野”：锐利银色墨镜、黑红菱格皮衣、宽腿黑牛仔裤、厚底靴。
C 红白分染双马尾“铃”：链式细框眼镜、黑色项圈、白色半透层叠上衣、泼漆牛仔裤、银黑厚底鞋。
输出不可变更项：头身比、眼型、皮肤搪胶质感、三人各自发色与标志配饰。`, 0, 280),
      image('castA', '单人母版 · 米柚', '图1风格参考。生成米柚单独全身正面、侧面、背面与面部近景：粉发双丸子辫、细框眼镜、银色金属长袖、黑裙渔网、厚底靴；2.2头身、困倦大眼、C4D棚拍，浅灰背景，无其他角色。', 350, 0, '3:4'),
      image('castB', '单人母版 · 赤野', '图1风格参考。生成赤野单独全身正面、侧面、背面与面部近景：鲜红卷发、锐利银色墨镜、黑红菱格皮衣、宽腿黑牛仔裤；同一2.2头身和搪胶皮肤，浅灰背景，无其他角色。', 350, 350, '3:4'),
      image('castC', '单人母版 · 铃', '图1风格参考。生成铃单独全身正面、侧面、背面与面部近景：红白分染双马尾、链式眼镜、黑项圈、白半透上衣、泼漆牛仔裤；同一头身比和眼型，浅灰背景，无其他角色。', 700, 0, '3:4'),
      image('soloHero', '单人英雄 Lookbook', '严格使用图1米柚身份母版。她单独站在高键白棚，右手伸向镜头形成近大远小，粉发、细框眼镜和银色上衣完全一致；85mm商业潮玩摄影，不出现其他人物。', 700, 350, '3:4'),
      image('soloStreet', '单人街头造型', '严格使用图1赤野身份母版。他单独站在水泥台阶，鱼眼低机位，红发、银色墨镜和菱格皮衣不变；真实日光与短影，C4D材质，不新增角色、不换装。', 1050, 0, '3:4'),
      image('trioStudio', '三人棚拍组照', '图1米柚、图2赤野、图3铃。三人同框高键棚拍：米柚左前伸手、赤野居中站直、铃右侧双手交叠；每人发型、眼镜、服装必须分别匹配各自母版，禁止换脸或交换配饰。', 1050, 350, '16:9'),
      image('trioStreet', '三人街头组照', '沿用三人母版。鱼眼屋顶舞台，赤野右前景怒视、米柚左中、铃后景；服装与发色严格对应母版，蓝天与音箱作为环境，不新增第四人。', 1400, 0, '16:9'),
      image('themeParty', '主题变体 · 睡衣派对', '沿用三人身份母版。仅替换为睡衣主题：米柚恐龙睡帽、赤野卷发球衣、铃睡袍；脸、头身比、眼型和发色必须保持，四人矩阵禁止出现，只保留这三人。', 1400, 350, '16:9'),
    ],
    edges: [
      edge('styleRef', 'castA'), edge('bible', 'castA'),
      edge('styleRef', 'castB'), edge('bible', 'castB'),
      edge('styleRef', 'castC'), edge('bible', 'castC'),
      edge('castA', 'soloHero'),
      edge('castB', 'soloStreet'),
      edge('castA', 'trioStudio'), edge('castB', 'trioStudio'), edge('castC', 'trioStudio'),
      edge('castA', 'trioStreet'), edge('castB', 'trioStreet'), edge('castC', 'trioStreet'),
      edge('castA', 'themeParty'), edge('castB', 'themeParty'), edge('castC', 'themeParty'),
    ],
  },
  productionTemplate('tourism-citywalk', '文旅宣传 · 城市漫游 KV', '品牌与 KV', '锁定城市地标、人物和品牌色，输出可投放的文旅主视觉与短视频关键帧。', ['文旅', '城市漫游', 'KV'], '目的地：重庆山城夜游。固定同一28岁女性旅拍者：黑色短发、米白风衣、棕色相机包；固定地标为洪崖洞、长江索道和十八梯石阶。主色暖橙窗光与青蓝江面。不得替换地标建筑或人物身份。输出人物母版、夜景建立、人物融景、竖版旅拍和横版城市KV。', [['traveler', '旅拍人物母版', '生成同一女性旅拍者正面半身、全身和持相机姿态，米白风衣与棕色相机包固定，中性棚拍。'], ['landmark', '地标夜景母版', '洪崖洞层叠吊脚楼、长江索道缆车和十八梯石阶的夜景环境板，暖橙窗光与青蓝江面，无人物。'], ['hero', '人物融景主视觉', '图1人物准确站在图2洪崖洞观景台，风衣和相机包不变，建筑层叠关系准确，竖版，顶部留城市名安全区。', '3:4']], { accent: '#ef8b4a' }),
  productionTemplate('tourism-heritage', '文旅宣传 · 非遗体验片', '影视分镜', '以同一体验者和固定工坊空间，生产非遗手作宣传镜头。', ['文旅', '非遗', '体验'], '项目：景德镇手作青花体验。体验者24岁女性，亚麻围裙、深蓝发带；工坊固定为木桌、拉坯轮、青花颜料碟和窗外竹影。五镜：进门、拉坯、勾线、入窑、成品托起。人物、围裙、器物和工坊布局全程不变。', [['master', '体验者与工坊母版', '同一女性正面定妆与工坊全景，木桌、拉坯轮、青花颜料碟位置固定，自然侧光。'], ['process', '手作五镜连续', '沿用母版生成进门、拉坯、勾线、入窑、托起成品五个关键帧，青花纹样逐步完整，人物身份与工坊不变。'], ['kv', '非遗宣传收束', '她双手托出刚出窑的青花杯，窗外竹影，暖陶土色，右侧留展览与预约信息区。']], { accent: '#3d8f8a' }),
  productionTemplate('product-launch-film', '产品宣传 · 新品发布六镜', '影视分镜', '先锁产品结构，再完成开箱、功能、生活和英雄收束。', ['产品宣传', '发布片', '六镜'], '产品：骨传导运动耳机。锁定耳挂弧度、钛金属梁、充电盒和触控区。六镜：盒盖开启、耳挂特写、佩戴、夜跑使用、防水水珠、桌面英雄。产品结构与Logo面不得变形。', [['master', '耳机结构母版', '图1产品正面、侧面、耳挂弧度、充电盒开合和触控区微距，钛金属梁比例准确。'], ['shots', '发布六镜连续', '沿用母版生成开盒、耳挂特写、佩戴、夜跑、防水、英雄六个关键帧，同一只手与同一副耳机，结构连续。'], ['end', '产品英雄收束', '耳机与充电盒居中立于湿石台，冷蓝轮廓光，左侧留产品名和卖点安全区。']], { uploadTitle: '产品标准图', accent: '#6aa3d8' }),
  productionTemplate('ev-tvc', '纯电 SUV · 家庭出行 TVC', '影视分镜', '锁定车型和家庭角色，覆盖出发、旅途和到达。', ['汽车TVC', '家庭', '纯电'], '车型：白色纯电中型SUV。家庭为父亲、母亲和8岁女儿，固定服装与座椅位置。五镜：车库出发、高速跟拍、后排孩子睡觉、营地开门、车侧英雄。车身腰线、灯组和轮毂不得改变。', [['car', '车型与家庭母版', '图1车辆六面与同一家庭三口定妆，白色车身、灯组和轮毂准确，自然光。'], ['journey', '出行五镜', '沿用车型与人物生成车库、高速、后排、营地开门、车侧英雄五个连续镜头，人物座位和服装不变。']], { uploadTitle: '车辆标准图', accent: '#7f9bb8' }),
  productionTemplate('beauty-serum-tvc', '美妆精华 · 质感六镜 TVC', '影视分镜', '锁定包装和肤感，完成成分、滴落、涂抹和品牌收束。', ['美妆TVC', '精华', '质感'], '产品：金色滴管精华，玻璃方瓶。六镜：瓶身微距、滴管提起、液滴悬浮、手背铺展、面部轻拍、瓶身英雄。瓶型、盖子和金色滴管结构固定，肤质真实。', [['master', '包装与液体母版', '图1方瓶、滴管、金色盖和淡金液体细节，比例准确，高键白背景。'], ['texture', '质感六镜', '沿用包装生成微距、提管、液滴、手背、拍脸、英雄六个关键帧，液体粘稠度连续，瓶身结构不变。']], { uploadTitle: '包装标准图', accent: '#d4b06a' }),
  productionTemplate('new-energy-drink-tvc', '功能饮料 · 运动爆发 TVC', '影视分镜', '锁定罐身与运动员，覆盖开罐、饮用和冲刺。', ['功能饮料', '运动TVC', '爆发'], '产品：霓虹绿功能饮料瘦高罐。运动员为短发男性，黑色压缩衣。五镜：汗手开罐、泡沫喷出、仰头饮用、球场冲刺、罐身英雄。罐身图案、拉环和配色不得重绘。', [['master', '罐身与运动员母版', '图1罐身展开与同一运动员定妆，霓虹绿图案和拉环结构准确。'], ['action', '爆发五镜', '沿用母版生成开罐、泡沫、饮用、冲刺、英雄五个关键帧，罐身朝向和运动员身份连续。']], { uploadTitle: '罐身标准图', accent: '#7dff6a' }),
  productionTemplate('taobao-detail', '淘宝详情页 · 卖点长图', '商业电商', '从商品标准图生成淘宝首屏、利益点和细节长图素材。', ['淘宝', '详情页', '长图'], '产品：可折叠旅行电热水壶。目标用户为差旅人群；核心卖点：600ml、双电压、食品级硅胶、8分钟烧开。输出淘宝详情页结构：首屏利益点、尺寸、折叠步骤、材质、使用场景、参数与售后；文案必须量化，不虚构认证。', [['hero', '淘宝首屏主视觉', '图1产品置于干净旅行酒店桌面，展开与折叠状态并列，竖版首屏，顶部和左侧保留标题/卖点排版区。', '3:4'], ['feature', '功能卖点场景', '严格保持产品结构，展示双电压切换、600ml容量参照和8分钟烧水三个场景化画面，真实产品摄影，不生成文字。', '3:4'], ['detail', '材质细节长图', '产品硅胶折叠层、304不锈钢底盘、插头收纳的微距组合，统一白灰背景和柔光，保留参数标注安全区。', '3:4']], { uploadTitle: '商品标准图', accent: '#ff774f' }),
  productionTemplate('douyin-commerce', '抖音商品卡 · 强钩子素材', '商业电商', '生成适合短视频商品卡的痛点对比与强利益点视觉。', ['抖音', '商品卡', '转化'], '产品：无线除螨仪。前3秒钩子“床垫看着干净，不代表真的干净”；卖点为14000Pa吸力、UV-C、热风除湿、可视尘杯。规划9:16痛点、过程、结果、商品英雄四段，禁止医疗疗效承诺。', [['hook', '3秒痛点钩子', '9:16近景，干净床垫与可视化微尘形成反差，顶部留标题区，下方留字幕安全区，真实家庭卧室。', '9:16'], ['proof', '功能证据镜头', '图1产品贴合床垫工作，透明尘杯和热风出口结构准确，侧光显示吸尘路径，画面保留三条量化卖点区。', '9:16'], ['card', '商品卡英雄图', '产品三分之二角度居中，品牌色深紫渐变，配件整齐陈列，底部为价格与CTA安全区，不生成实际价格。', '9:16']], { uploadTitle: '商品与配件图', accent: '#66c8ff' }),
  productionTemplate('pdd-detail', '拼多多详情 · 直给转化套图', '商业电商', '突出规格、套装内容和价格心智的高信息密度商品图。', ['拼多多', '套装', '转化'], '产品：12件套厨房密封盒。明确尺寸、容量、可叠放、防漏、食品接触材质；输出主图、套装清单、容量对比、收纳前后和密封测试。不得虚构“全网最低”或检测报告。', [['main', '高转化主图', '图1全套12件密封盒整齐阶梯陈列，白底高亮，主体占画面80%，四周留四个短卖点标签区。', '1:1'], ['set', '套装规格清单', '俯拍12件产品按容量从小到大排列，盒盖数量准确，右侧留尺寸参数区，浅灰背景。', '3:4'], ['compare', '收纳前后对比', '同一厨房冰箱上下对比：左侧散乱包装，右侧使用图1密封盒整齐叠放，透视和产品比例真实。', '3:4']], { uploadTitle: '商品套装图', accent: '#ffbd54' }),
  productionTemplate('amazon-listing', 'Amazon Listing · 七图体系', '商业电商', '按 Amazon 逻辑生成白底主图、信息图与生活方式图。', ['Amazon', 'Listing', '跨境'], 'Product: ergonomic laptop stand. Build a seven-image listing plan: compliant white-background hero, dimensions, three benefits, compatibility, foldability, lifestyle, package contents. Keep all claims evidence-based; use concise US-English copy zones and no marketplace badges.', [['hero', 'Amazon 白底主图', 'Exact product from image 1 on pure white, three-quarter view, product fills about 85% of frame, realistic soft shadow, no text, props or badge.', '1:1'], ['infographic', '尺寸与功能信息图', 'Same stand open and folded, clean light-gray background, clear empty callout zones for height, angle, weight and laptop compatibility; structural details accurate.', '1:1'], ['lifestyle', '办公场景利益图', 'Same stand supporting a laptop in a modern home office, eye-level ergonomic posture visible, product unobstructed, right side reserved for three benefit callouts.', '1:1']], { uploadTitle: '产品标准图', accent: '#f4a66b' }),
  productionTemplate('action-storyboard', '动作戏分镜 · 轴线与节奏', '影视分镜', '为追逐与搏斗建立空间、轴线和动作连续性。', ['动作分镜', '轴线', '追逐'], '场景：雨夜停车楼追逐。主角红色机车夹克，追兵黑色雨衣；固定坡道、立柱编号、银色轿车位置。按建立、发现、起跑、跨车、近身阻挡、反击、逃离七拍，逐镜定义动作起止、景别、机位、焦段、运动方向和剪辑接点，遵守180度轴线。', [['map', '动作空间母版', '停车楼俯视空间设定板，明确坡道、立柱、轿车和逃生门位置，雨水与荧光灯统一，无人物。'], ['beat1', '动作镜头组 A', '基于空间母版生成发现、起跑、跨车三个连续关键帧，主角始终向画面右侧移动，服装与雨势一致。'], ['beat2', '动作镜头组 B', '延续上一组生成阻挡、反击、逃生门收束三个关键帧，动作重心合理，无肢体穿插，轴线不跳。']], { accent: '#e66e5e' }),
  productionTemplate('dialogue-storyboard', '对话戏分镜 · 覆盖方案', '影视分镜', '自动规划双人对话的建立、正反打、插入和反应镜头。', ['对话分镜', '正反打', '覆盖'], '场景：清晨空咖啡馆，姐姐交还家门钥匙。姐姐坐窗侧左位、弟弟坐吧台侧右位，钥匙在桌中央；固定暖窗光、座位和视线轴线。输出建立、姐姐近景、弟弟反打、钥匙插入、双人侧面、沉默反应六镜及台词对应动作。', [['master', '双人与轴线母版', '同一咖啡馆内双人定妆，姐姐左、弟弟右，桌面钥匙居中，以箭头感构图明确视线但不生成文字。'], ['coverage', '六镜覆盖分镜', '严格沿用母版，生成建立、姐姐近景、弟弟反打、钥匙特写、双人侧面、弟弟沉默反应六个连续画面，人物视线和手部动作准确。']], { accent: '#bc8fa9' }),
  productionTemplate('product-storyboard', '产品分镜 · 功能演示', '影视分镜', '把卖点拆成清晰可拍的产品功能镜头。', ['产品分镜', '功能', '广告'], '产品：便携榨汁杯。演示顺序：装入水果、旋紧杯盖、双击启动、刀头旋流、倒置随行、开盖饮用、清洗。逐镜列出手部动作、产品朝向、液位变化、镜头焦段、帧率和衔接，确保按钮和Logo方向连续。', [['master', '产品动作母版', '图1产品的正面、背面、杯盖、刀头和按钮细节组合，结构与Logo位置准确，浅灰摄影棚。'], ['board', '七拍功能分镜', '依据母版生成七个可拍关键帧：加料、锁盖、启动、旋流、携带、饮用、冲洗；同一只手与同一产品，液位和水果状态连续。']], { uploadTitle: '产品标准图', accent: '#6bcfc1' }),
  productionTemplate('mobile-kv', '手机 KV · 先定产品再入景', '品牌与 KV', '先锁定手机结构与材质，再生成场景化发布 KV。', ['手机', 'KV', '发布会'], '产品为钛灰色旗舰手机。先锁定镜头模组、按键、边框、天线断点和Logo；创意主题“越过夜色”，场景为黑色火山岩与一束冷蓝月光。输出结构母版、英雄KV、功能近景和横版发布会背景。', [['master', '手机结构母版', '图1手机正面、背面、左右侧边和镜头模组微距，所有孔位与比例准确，中性深灰背景。'], ['hero', '手机发布英雄 KV', '同一手机以三分之二背面立于黑色火山岩，冷蓝月光勾勒钛金属边框，镜头玻璃反射克制，左侧留发布文案区。'], ['wide', '发布会宽屏 KV', '保持手机结构，21:9黑色火山地貌宽景，手机位于右三分之一，蓝色地平光穿过背景，左侧大面积文案安全区。', '21:9']], { uploadTitle: '手机六面标准图', accent: '#74a7ff' }),
  productionTemplate('beverage-kv', '饮品 KV · 包装与液体统一', '品牌与 KV', '锁定瓶身、标签和液体质感，生成冰爽商业 KV。', ['饮品', 'KV', '液体'], '产品：青柠气泡水透明玻璃瓶。严格锁定瓶型、绿色标签、瓶盖和液位；视觉主题“第一口像跳进夏天”，以青柠、冰块、气泡和逆光水花建立清爽感，输出包装母版、竖版KV、横版KV。', [['master', '饮品包装母版', '图1瓶装饮品正背面与标签平铺、瓶盖和玻璃厚度细节，标签文字结构不重绘，白灰背景。'], ['portrait', '饮品竖版 KV', '同一玻璃瓶从碎冰中升起，青柠片和气泡环绕，左后方硬逆光，冷凝水真实，顶部留品牌标题区。', '3:4'], ['landscape', '饮品横版 KV', '同一产品位于右侧冰台，左侧青柠切面与透明水花形成动势，16:9，左侧保留主标题和卖点区。']], { uploadTitle: '包装标准图', accent: '#73dc9a' }),
  productionTemplate('brand-kv-system', '品牌 KV · 角色融景系统', '品牌与 KV', '先生成品牌角色母版，再将同一角色准确融入多场景 KV。', ['品牌KV', '角色融景', 'Campaign'], '品牌：城市骑行平台“飞轮”。品牌角色为银色反光夹克的年轻女骑手；品牌色荧光黄与深海军蓝。先建立真人角色母版，再进入清晨高架、午后街区、夜间江边三场景，固定脸、服装、自行车和品牌色。', [['character', '品牌角色母版', '生成同一女骑手正面、侧面、全身骑姿与头盔细节，银色反光夹克、荧光黄内搭、深蓝公路车一致。'], ['day', '清晨品牌 KV', '同一角色骑行穿过清晨城市高架，低机位侧跟拍，荧光黄与晨光呼应，左侧保留品牌口号区。'], ['night', '夜间品牌 KV', '同一角色和自行车停在江边夜景，深海军蓝主色、荧光黄轮廓光，右侧保留活动信息区。']], { accent: '#d6ec4e' }),
  productionTemplate('campaign-poster-system', '商业海报 · 系列化延展', '品牌与 KV', '从核心策略生成主海报与多尺寸系列延展。', ['海报', 'Campaign', '系列'], '活动：独立书店夜读节，主题“把夜晚翻到下一页”。受众20–35岁城市青年；主视觉为被翻开的书页形成月亮，午夜蓝、纸张米白、单点橙红。输出竖版主海报、方形社媒、横幅；建立统一网格、字号层级和安全区。', [['main', '主视觉海报', '书页在午夜蓝空间中卷曲成新月，纸张纤维真实，一名小比例读者坐在月牙边缘，竖版，顶部标题区、底部时间地点区留白。', '3:4'], ['social', '社媒方图', '沿用图1月牙书页主视觉重构为1:1，主体居中偏上，底部保留活动信息和二维码安全区。', '1:1'], ['banner', '横版活动 Banner', '沿用主视觉扩展为21:9，月牙位于右侧，左侧大面积深蓝留给标题与报名信息。', '21:9']], { accent: '#f38a68' }),
  productionTemplate('product-exploded-view', '产品拆解 · 爆炸结构图', '商业电商', '生成结构准确的分层拆解、材质和装配说明视觉。', ['产品拆解', '结构', '工业设计'], '产品：真无线耳机充电盒。依据上传多角度图拆分上盖、转轴、磁铁、内托、主板、电池、线圈和下壳；规定零件轴向、装配顺序、材质颜色和不可见结构不臆造原则。', [['master', '产品结构确认图', '图1产品外观六面与开合状态，准确复刻接缝、转轴、指示灯和接口，灰色工程背景。'], ['explode', '爆炸结构主图', '沿同一垂直轴分层展示上盖、转轴、磁铁、内托、主板、电池、无线线圈和下壳，间距均匀，零件比例合理，不生成文字。'], ['material', '材质工艺细节', '外壳磨砂塑料、金属转轴、主板焊点和硅胶缓冲件的四格微距，统一工程摄影光线。']], { uploadTitle: '产品多角度图', accent: '#8aa6b8' }),
  productionTemplate('phone-tvc', '手机 TVC · 六镜发布片', '影视分镜', '锁定手机结构并完成材质、影像、性能和英雄收束。', ['手机TVC', '发布片', '六镜'], '钛灰旗舰手机，主题“夜的细节”。六镜：钛边微距、镜头组亮起、夜景人像取景、芯片粒子隐喻、手持防抖、产品英雄。逐镜定义焦段、运镜、光线、转场匹配点，手机孔位和镜头数量不可变化。', [['master', '手机 TVC 母版', '图1手机六面与镜头模组细节，钛灰材质和全部结构准确，深黑摄影棚。'], ['shotsA', '材质与影像三镜', '生成钛边微距、镜头组光扫、夜景人像取景三个连续关键帧，冷蓝光源方向一致。'], ['shotsB', '性能与英雄三镜', '延续母版生成芯片抽象、手持防抖、三分之二英雄收束，最终右侧留品牌文案区。']], { uploadTitle: '手机标准图', accent: '#7fa8d8' }),
  productionTemplate('app-tvc', 'App TVC · 界面到生活场景', '影视分镜', '把 App 核心操作转化为界面特写与真人使用镜头。', ['App TVC', 'UI', '生活方式'], 'App：个人财务管理“简账”。核心路径：导入账单、自动分类、预算预警、月度洞察。五镜采用手机UI特写与真人通勤/咖啡店场景交替；保持同一用户、手机和界面组件，所有金额使用演示数据。', [['ui', 'App 界面母版', '依据产品说明设计导入、分类、预算、洞察四个深色模式界面，统一组件、字号和青绿色强调色，手机框结构一致。'], ['story', 'App 使用五镜', '同一年轻用户在地铁导入账单、咖啡店查看分类、收到预算预警、夜间看月报、轻松收束五个关键帧；UI屏幕清晰且方向连续。'], ['end', 'App 品牌收束', '手机居中展示月度洞察页，背景为抽象青绿色数据轨迹，右侧预留Logo、Slogan与下载按钮安全区。']], { accent: '#67d4b0' }),
  productionTemplate('milk-tea-tvc', '奶茶 TVC · 门店现制五镜', '影视分镜', '覆盖原料、萃茶、摇制、加料和成品英雄镜头。', ['奶茶TVC', '现制', '美食'], '产品：桂花乌龙奶茶。五镜：干桂花落入茶叶、热水萃取、鲜奶与茶汤交汇、手摇冰块、透明杯成品。固定琥珀茶色、乳白、桂花金；门店器具和杯贴一致，真实食品摄影，不使用不自然黏稠液体。', [['master', '杯型与原料母版', '图1杯型、杯贴、吸管、桂花、乌龙茶叶与鲜奶材质板，包装比例准确，暖白背景。'], ['process', '现制过程四镜', '依次生成桂花落茶、热水萃取、奶茶交汇、手摇冰块四个微距关键帧，液体状态逐步连续。'], ['hero', '奶茶成品英雄镜头', '同一透明杯奶茶置于浅木台，杯壁冷凝水与顶部桂花清晰，午后逆光，右侧留门店活动文案区。']], { uploadTitle: '杯型与品牌贴纸', accent: '#d4a55f' }),
  productionTemplate('bottled-drink-tvc', '瓶装饮品 TVC · 冰爽六镜', '影视分镜', '围绕包装、开盖、气泡、饮用与冰爽收束生产广告镜头。', ['瓶装饮品TVC', '冰爽', '六镜'], '产品：柚子气泡茶PET瓶。六镜：冰层裂开、瓶身滚入、瓶盖开启、气泡微距、年轻人饮用、冰台英雄。严格保持瓶型、标签、液位和瓶盖颜色；主色冰青与柚子黄，120fps慢动作质感。', [['master', '瓶装包装母版', '图1瓶装饮品正背面、瓶盖、标签和液体颜色细节，结构准确，高键灰背景。'], ['motion', '开盖与气泡镜头组', '生成冰层裂开、瓶身滚入、瓶盖开启、气泡上升四个连续关键帧，标签朝向连续，液体物理真实。'], ['hero', '饮用与英雄收束', '同一年轻人在户外饮用后切到产品立于碎冰和柚子切片之间，逆光水雾，左侧文案安全区。']], { uploadTitle: '包装标准图', accent: '#79d9dd' }),
  productionTemplate('sports-campaign', '运动广告 · 力量节奏片', '影视分镜', '以运动员身份和动作阶段锁定高速商业镜头。', ['运动广告', '动作', 'Campaign'], '项目：城市夜跑鞋广告。运动员为短发女性，黑色压缩服，荧光绿跑鞋；场景依次为起跑线、隧道、雨后街道、天桥冲刺。六镜覆盖系鞋带、起跑、落地微距、侧跟、呼吸特写、城市英雄，固定跑姿方向和鞋款结构。', [['master', '运动员与鞋款母版', '图1跑鞋与同一女运动员正侧全身、跑姿和鞋底细节，黑绿配色统一，暗灰背景。'], ['action', '高速动作四镜', '沿用母版生成系鞋带、爆发起跑、鞋底落地水花、隧道侧跟四个关键帧，动作解剖准确，运动方向一致。'], ['final', '运动品牌英雄图', '同一运动员在天桥冲刺后停于城市晨光前，荧光绿跑鞋清晰，低机位24mm，左上品牌口号安全区。']], { uploadTitle: '跑鞋与运动员参考', accent: '#b8ef52' }),
  productionTemplate('ip-promo-film', 'IP 宣传片 · 世界观六镜', '影视分镜', '建立 IP 角色、世界与叙事任务，输出宣传片关键镜头。', ['IP宣传', '世界观', '六镜'], 'IP“云团邮差”：圆润白色云朵生物，蓝色邮差帽、红色小包；世界为漂浮岛屿邮局。剧情六拍：醒来、接信、穿云、遇风暴、送达、夕阳返航。固定角色比例、帽包位置、岛屿建筑和柔和3D动画材质。', [['character', 'IP 角色母版', '云团邮差正面、侧面、背面和三种表情，蓝帽红包位置固定，柔和3D材质，纯色背景。'], ['world', '漂浮邮局母版', '漂浮岛屿、木质邮局、云轨与远处灯塔的空间设定，清晨蓝金色，无角色。'], ['story', '六镜宣传分镜', '结合角色和世界母版生成醒来、接信、穿云、风暴、送达、返航六个连续关键帧，比例和光线随时间合理变化。']], { accent: '#8ecbf0' }),
  productionTemplate('brand-film', '品牌广告 · 价值观叙事', '影视分镜', '把品牌价值转化为真人故事、产品接触点和品牌收束。', ['品牌广告', '叙事', 'TVC'], '品牌：可持续户外服“远岭”，价值“修好它，再出发”。60秒故事：父亲修补旧冲锋衣，女儿穿它完成首次徒步，山顶合影呼应旧照片。输出八镜，固定父女身份、旧衣补丁、背包和山路天气；产品只自然出现，不硬性堆Logo。', [['cast', '父女与服装母版', '父亲与成年女儿同框定妆，旧墨绿冲锋衣左肘补丁、背包和登山鞋清晰，写实自然光。'], ['storyA', '品牌故事前四镜', '生成旧照片、父亲缝补、女儿接过衣服、清晨出发四个连续关键帧，家庭暖光过渡到山野冷光。'], ['storyB', '品牌故事后四镜', '延续身份与服装生成攀登、风雨互助、山顶合影、旧照片与新照片呼应收束，最后留品牌口号安全区。']], { accent: '#8ab27b' }),
  productionTemplate('virtual-human-host', '虚拟人 · 品牌主持人全案', '角色与 IP', '建立可跨直播、短视频和海报复用的虚拟主持人身份资产。', ['虚拟人', '数字主持', '品牌IP'], '虚拟主持人“澄澄”：26岁东亚女性数字人，鹅蛋脸、黑色齐肩直发、左耳银色几何耳饰；穿珍珠白短西装与雾蓝内搭。定位为科技消费品牌主持人，气质可信、清晰、亲和。固定面部骨相、发型、服装、耳饰与声线性格，输出身份圣经、口播动作边界和直播/短视频/海报使用规范。', [['master', '虚拟人身份母版', '生成澄澄正面胸像、左右三分之二侧面、全身与标准微笑，同一脸部、发型、白色短西装和银耳饰，中性科技摄影棚。'], ['expression', '口播表情动作库', '沿用同一虚拟人，生成欢迎、解释、强调、倾听、惊喜、收束六种口播表情与上半身手势，眼神始终看向镜头。'], ['channel', '三渠道应用板', '将同一虚拟人分别应用于9:16直播间、16:9产品发布视频和3:4品牌海报，身份、服装与品牌雾蓝色统一。']], { accent: '#73cde0' }),
  productionTemplate('virtual-influencer-matrix', '虚拟偶像 · 内容运营矩阵', '角色与 IP', '从虚拟偶像母版扩展日常内容、联名和舞台物料。', ['虚拟偶像', '内容矩阵', '联名'], '虚拟偶像“NOVA”：银紫渐变短发、琥珀眼、黑银街头夹克、星轨胸针。内容矩阵覆盖日常自拍、舞台造型、品牌联名、节日问候和粉丝贴纸；固定脸、发型、胸针与黑银紫色，不在不同渠道改变渲染材质。', [['master', '虚拟偶像设定板', '生成NOVA正侧背全身、面部近景、星轨胸针与服装材质板，半写实高完成度3D，深灰背景。'], ['social', '社媒九宫格', '同一NOVA在练舞室、咖啡店、录音棚、后台四种日常空间生成九宫格内容，服装可换但脸、发色与胸针保持一致。'], ['campaign', '品牌联名主视觉', '同一NOVA与透明银紫耳机产品同框，舞台光轨背景，竖版KV，顶部品牌联名标题区与底部发售信息区留白。']], { accent: '#a987ff' }),
  productionTemplate('comic-character-bible', '漫画角色 · 连载设定圣经', '角色与 IP', '锁定漫画角色线稿、配色、表情和服装，支持长期连载。', ['漫画', '角色设定', '连载'], '都市悬疑漫画主角“周弈”：31岁男法医，窄脸、单眼皮、右手虎口旧伤，深灰衬衫与黑色实验外套。画风为克制写实日漫线条、低饱和赛璐璐上色。输出头身比例、脸部锚点、正侧背、十二表情、六动作、常服与工作服，定义不可变更项。', [['sheet', '漫画角色三视图', '同一周弈正侧背全身，线条粗细、脸部比例、旧伤、工作服结构和配色一致，纯浅灰背景。'], ['expression', '十二表情与六动作', '沿用角色母版生成十二宫格表情和站立、蹲下检视、取证、奔跑、回头、持文件六动作，禁止改变画风。'], ['color', '服装配色与道具板', '同一角色常服、工作服、手套、证物箱和工作证材质色板，无文字说明，统一低饱和赛璐璐。']], { accent: '#8398ad' }),
  productionTemplate('webtoon-episode', '竖屏条漫 · 一话生产流程', '影视分镜', '从剧本节拍生成角色一致的竖屏条漫分格与封面。', ['条漫', 'Webtoon', '分格'], '一话主题“最后一班电梯”：女主林朔加班后进入空电梯，楼层按钮自行亮起不存在的13层。规划24格：日常建立、异常累积、电梯停顿、门开悬念；固定女主短发、米色衬衫、黑色托特包和冷白办公楼空间。定义长短格节奏、对白气泡安全区和每次悬念翻屏点。', [['master', '条漫角色场景母版', '生成林朔正侧全身、五种表情，以及电梯内外、办公走廊和13层黑暗入口环境设定，统一竖屏条漫画风。'], ['panelsA', '前十二格分镜', '沿用母版生成加班离开、进入电梯、按钮异常到首次停顿的12格竖屏分镜，角色服装、包和电梯按钮位置连续，无实际对白文字。', '9:16'], ['panelsB', '后十二格与话尾', '延续上一组生成电梯震动、灯灭、13层门开和女主回头的12格分镜，最后使用超长黑暗竖格制造翻页悬念。', '9:16']], { accent: '#806f91' }),
  {
    id: 'grid-manga-page',
    title: '宫格漫画 · 四六九格连载页',
    category: '影视分镜',
    accent: '#6b7c93',
    description: '先锁定角色与场景母版，再按四格、六格、九格输出同一话的印刷页，格子之间保持身份和空间连续。',
    tags: ['宫格漫画', '四格', '六格', '九格'],
    nodes: [
      text('script', '一话节拍与分格表', `都市悬疑短篇《值班室的灯》。主角周弈：31岁男法医，窄脸、单眼皮、右手虎口旧伤，深灰衬衫、黑色实验外套。配角值班护士陈棠：27岁，低马尾、浅蓝护士服。场景固定为夜间医院值班室：左侧文件柜、中央金属桌、右侧感应门、天花板一盏冷白灯。画风为克制写实日漫线稿加低饱和赛璐璐。节拍：四格建立日常，六格发现异常，九格门开悬念。禁止在后续格子中换脸、换装或改动值班室家具位置。不生成对白文字，只预留气泡安全区。`, 0, 160),
      image('cast', '角色与场景母版', '根据节拍表生成周弈正侧全身、陈棠正侧全身，以及夜间值班室全景：文件柜、金属桌、感应门和冷白顶灯位置明确；统一日漫画风，浅灰背景，无分格、无文字。', 350, 160, '16:9'),
      image('fourGrid', '四格页 · 日常建立', '严格使用图1角色与值班室。输出一张完整四宫格漫画页，2×2等分，从左上到右下依次为：周弈推门进入、他坐到金属桌前、陈棠递来文件夹、顶灯轻微闪烁。同一夜、同一服装、同一家具布局，黑白到低饱和上色，预留对白气泡区，不写实际文字。', 700, 0, '3:4'),
      image('sixGrid', '六格页 · 异常累积', '图1是角色场景母版，图2是上一页四格。输出一张完整六宫格页，2×3，从左上到右下：周弈打开文件夹、陈棠看向感应门、门缝漏出红光、周弈右手按住旧伤、灯管爆闪、两人同时抬头。人物身份、服装和值班室结构必须连续，不新增角色。', 700, 350, '3:4'),
      image('nineGrid', '九格页 · 门开悬念', '图1母版，图2上一页六格。输出一张完整九宫格页，3×3：门把手转动、门缝扩大、冷白灯熄灭、周弈半身剪影、陈棠后退、红光铺满地面、门完全打开、黑暗走廊、最后一格只留门框与一只模糊手影。角色脸、发型、服装和空间关系严格继承，最后一格允许大面积留黑，不生成文字。', 1050, 160, '3:4'),
      image('cover', '单话封面', '沿用全部角色与值班室母版。竖版封面：周弈位于右三分线回头，陈棠虚化在感应门前，冷白灯与一线红光对撞；顶部留标题区，底部留话数区，不生成实际文字。', 1400, 160, '3:4'),
    ],
    edges: [
      edge('script', 'cast'),
      edge('cast', 'fourGrid'),
      edge('cast', 'sixGrid'), edge('fourGrid', 'sixGrid'),
      edge('cast', 'nineGrid'), edge('sixGrid', 'nineGrid'),
      edge('cast', 'cover'), edge('nineGrid', 'cover'),
    ],
  },
  productionTemplate('live-action-composite', '实景合成广告 · 人物与产品融景', '场景与视觉', '匹配透视、光线和接触关系，生成可信实景商业合成图。', ['实景合成', '产品植入', '广告图'], '任务：将上传跑鞋与运动员分别融入雨后城市天桥实拍。先分析地平线、消失点、主光方向、色温、地面粗糙度和反射；保持人物身份、跑鞋结构与Logo方向。输出清洁背景、人物产品合成、阴影反射检查和横竖版广告成片。', [['plate', '实景光线分析板', '图1实景保持构图，提取地平线、主光、反射和可站立区域的视觉分析版本，不生成文字，仅用克制辅助线。'], ['composite', '人物产品实景合成', '图1运动员、图2跑鞋融入雨后天桥，脚底接触、湿地反射、环境遮挡和冷暖光准确，35mm低机位。'], ['campaign', '横竖版合成广告', '沿用合成结果输出16:9横版和9:16竖版两种构图，人物与跑鞋比例不变，分别预留品牌口号和CTA安全区。']], { uploadTitle: '人物、产品与实景参考', accent: '#70b8a5' }),
  productionTemplate('live-action-vfx-video', '实景合成视频 · 首尾帧与运动设计', '影视分镜', '生产可用于图生视频的干净底板、首尾帧和逐镜运动预演。', ['实景视频', 'VFX', '首尾帧'], '15秒汽车城市广告：上传同一车辆与隧道实景。四镜为车辆驶入、侧向并行、灯带变形成品牌光轨、出口英雄收束。锁定车身结构、车漆、轮毂、道路透视与光源；逐镜规范镜头运动、主体运动、时长、速度曲线、遮挡和反射连续性，供下游视频模型直接执行。', [['clean', '实景干净底板', '移除原场景车辆与临时杂物，保留隧道结构、灯带、道路纹理和真实光影，16:9高动态范围。'], ['framesA', '镜头一二首尾帧', '同一车辆准确合成到隧道驶入与侧向并行两镜，各输出首尾状态组合，轮胎方向、车身反射和运动方向连续。'], ['framesB', '镜头三四首尾帧', '延续车辆与隧道，生成灯带化为品牌光轨以及驶出隧道英雄收束的首尾帧，最终右侧留品牌区。'], ['motion', '四镜运动预演板', '根据全部首尾帧生成四格视频运动预演板，以画面内运动轨迹和速度感表现推轨、侧跟、光轨变形、驶出收束；车辆结构与光线连续，不生成文字。', '16:9']], { uploadTitle: '车辆与实景素材', accent: '#5d9fd4' }),
  productionTemplate('fintech-broker-campaign', '金融科技 · 全球投资品牌 Campaign', '品牌与 KV', '适用于富途、长桥、老虎、Robinhood 类券商的可信品牌视觉。', ['金融科技', '券商', 'Campaign'], '虚构券商品牌“NorthBridge”，核心价值为全球市场、透明工具、理性决策。受众25–40岁自主投资者。视觉避免暴富、金币雨和收益承诺，采用真实城市生活、克制深绿/石墨色、清晰数据界面。输出品牌角色、跨市场KV、风险教育海报和多端渠道物料。', [['persona', '投资者人物母版', '生成同一东亚女性产品经理在家中书房、通勤列车和咖啡店三场景，真实自然，不展示奢侈消费或夸张喜悦。'], ['kv', '全球市场品牌 KV', '同一人物位于城市清晨窗边，手机显示虚构多市场自选界面，背景用克制时区光带连接纽约、香港和新加坡，右侧留品牌文案区。'], ['risk', '理性投资教育海报', '深绿石墨背景，抽象波动曲线与安全边界网格，人物冷静查看风险提示，竖版，保留“投资有风险”合规区，不生成收益数字。']], { accent: '#45b88c' }),
  productionTemplate('fintech-product-demo', '交易 App · 产品功能演示片', '影视分镜', '把行情、自选、下单和风险管理转化为合规产品演示镜头。', ['交易App', '产品演示', '合规'], '虚构交易App“NorthBridge”。六镜路径：查看全球行情、添加自选、阅读公司数据、设置限价单、确认风险提示、查看组合分散度。所有股票名称、价格和收益均为明显演示数据；UI结构跨镜一致，不展示保证收益。输出界面母版、手持交互关键帧、桌面端联动和品牌收束。', [['ui', '交易 App 界面母版', '生成行情、自选、公司详情、限价单、风险确认和组合分析六个统一深色模式界面，翠绿仅用于中性强调，不用满屏涨幅。'], ['interaction', '移动端六镜交互', '同一用户、同一手机依次完成六步操作，屏幕方向、手指落点和UI状态严格连续，真实办公与通勤场景交替。'], ['desktop', '多端联动收束', '笔记本组合分析与手机自选列表同屏，虚构数据一致，石墨桌面，左侧留产品价值文案区和合规脚注区。']], { accent: '#4fc39d' }),
  productionTemplate('automotive-launch', '汽车行业 · 新车上市全案', '品牌与 KV', '覆盖车辆结构母版、动态KV、座舱、功能和上市物料。', ['汽车', '上市', '行业垂直'], '车型：曜石蓝纯电猎装车。锁定前后灯组、轮毂、车身腰线、充电口和内饰；核心卖点为长途舒适、智能座舱与旅行装载。输出六面母版、海岸公路动态KV、内饰座舱、后备厢生活方式和发布会宽屏。', [['master', '车辆六面结构母版', '图1车辆正前、正后、左右侧、前后四分之三和轮毂灯组微距，曜石蓝车漆与全部结构准确。'], ['drive', '海岸公路动态 KV', '同一车辆沿清晨海岸公路行驶，低机位侧前跟拍，轮毂有真实运动模糊，车身结构不变，左侧留发布文案。'], ['interior', '智能座舱与旅行场景', '同一车型座舱屏幕、方向盘、座椅材质与后备厢露营装载组合，结构真实，不凭空增加屏幕和座位。']], { uploadTitle: '车辆标准图', accent: '#537b9e' }),
  productionTemplate('real-estate-campaign', '地产行业 · 项目价值全景', '品牌与 KV', '从建筑母版输出区位、立面、样板间、生活方式和主KV。', ['地产', '建筑', '行业垂直'], '项目：滨水低密度公寓“澜庭”。固定总图、楼栋数量、立面材料、阳台与景观轴线；价值为步行滨水、自然采光和社区共享庭院。不得虚构周边地标、交通时间或交付标准。输出鸟瞰、入口、样板间、庭院生活和横竖版KV。', [['master', '建筑与总图母版', '图1总图和建筑参考生成同一项目鸟瞰、主入口、滨水立面与共享庭院四格，楼栋关系和材料一致。'], ['interior', '样板间生活方式', '同一项目内90平方米客餐厅，落地窗朝向滨水景观，木石材质克制，真实家庭午后生活，不夸大空间尺度。'], ['kv', '地产主视觉 KV', '黄昏滨水视角呈现同一建筑群，庭院与室内暖光亮起，竖版与横版组合，天空和水面留标题及合规信息区。']], { uploadTitle: '项目总图与建筑参考', accent: '#a79c7e' }),
  productionTemplate('education-course-launch', '教育行业 · 课程发布矩阵', '品牌与 KV', '围绕教师可信度、课程方法和学习场景生产招生物料。', ['教育', '课程', '行业垂直'], '课程：面向高中生的“物理可视化实验课”。核心价值为把抽象力学变成可观察实验；固定同一教师、实验桌、蓝黄品牌色和器材。输出教师形象、三种实验场景、课程封面、短视频关键帧和家长说明页底图；不承诺提分结果。', [['teacher', '教师品牌形象', '生成同一35岁中国男教师正面半身、讲解手势、实验操作和倾听姿态，深蓝衬衫、黄色安全护目镜，真实教室。'], ['lesson', '实验课程场景组', '同一教师演示碰撞小车、单摆和气垫导轨三个实验，器材结构与学生安全距离准确。'], ['launch', '课程发布物料', '教师与实验器材组成3:4课程封面、1:1社媒图和16:9直播预告底图，统一蓝黄网格，保留标题、课时与合规区。']], { accent: '#f0c653' }),
  productionTemplate('healthcare-service', '医疗健康 · 服务解释视觉', '品牌与 KV', '以准确、克制和隐私安全的方式解释医疗服务流程。', ['医疗健康', '服务设计', '行业垂直'], '虚构远程心脏康复服务“安心程”。用户为术后恢复期中年人，流程为设备连接、每日测量、医生查看趋势、视频随访、异常联系。视觉真实温和，不展示诊断结论、不夸大疗效、不暴露个人健康数据。', [['cast', '患者与医生母版', '生成同一52岁男性用户居家状态与同一40岁女医生诊室状态，服装、设备与空间固定，表情平静可信。'], ['journey', '服务流程五步图', '沿用人物母版生成连接设备、每日测量、医生查看虚构趋势、视频随访和客服联系五个场景，界面仅用演示数据。'], ['campaign', '医疗服务品牌物料', '患者在窗边轻度康复运动，医生界面作为克制小画面关联，蓝绿色柔和品牌视觉，留隐私、适用范围和咨询入口区域。']], { accent: '#65b9b2' }),
  productionTemplate('restaurant-launch', '餐饮行业 · 新品上市内容包', '商业电商', '覆盖菜品英雄图、制作过程、门店场景和渠道物料。', ['餐饮', '新品', '行业垂直'], '新品：炭烤味噌鸡腿饭。固定陶瓷碗、鸡腿切片数量、溏心蛋、米饭和腌菜位置；卖点为炭火香、现烤和自制味噌酱。输出俯拍菜单图、45度英雄图、制作过程、外卖平台方图和门店海报，不生成虚假价格。', [['hero', '菜品双机位英雄图', '同一份鸡腿饭输出90度俯拍和45度近景，鸡腿切片、溏心蛋、米饭和腌菜位置一致，暖色餐饮摄影。'], ['process', '制作过程三镜', '同一食材依次展示刷味噌酱、炭火烤制、切片装碗，火候和食物状态连续，真实蒸汽与油脂。'], ['channel', '菜单与外卖渠道套图', '沿用菜品英雄图生成1:1外卖主图、3:4门店海报和16:9电子菜单底图，统一暖红与米白品牌色。']], { accent: '#d9824c' }),
  productionTemplate('b2b-saas-campaign', 'B2B SaaS · 产品价值叙事', '品牌与 KV', '将复杂软件能力转化为角色、界面、流程和销售物料。', ['B2B', 'SaaS', '行业垂直'], '产品：制造业设备运维平台“PulseOps”。角色为工厂设备经理，痛点为停机响应慢、巡检分散；价值为设备地图、异常工单、预测维护和管理报告。固定工厂空间、同一经理与蓝绿色产品UI，避免不真实全自动工厂。', [['ui', 'SaaS 产品界面母版', '生成设备地图、异常列表、工单详情、趋势分析和周报五个统一桌面端界面，虚构设备名与数据，蓝绿色组件一致。'], ['story', '客户价值四场景', '同一设备经理在控制室发现异常、手机派单、现场确认、会议复盘四场景，界面状态和工厂设备连续。'], ['sales', '销售演示物料', '设备经理、工厂与产品界面组成16:9解决方案封面、3:4案例海报和1:1社媒图，留价值主张、三项能力与CTA安全区。']], { accent: '#55b7aa' }),
  commercialKvTemplate(
    'sneaker-ip-popup-kv',
    '运动鞋 × IP · 快闪店商业 KV',
    '先锁定鞋款与IP，再以鱼眼近景和快闪店空间生成高冲击商业主视觉。',
    '虚构运动鞋品牌“RUNNER”与蓝色刺猬IP联名。画面任务：IP店员从鞋盒中向镜头递出珊瑚红跑鞋，背景为联名快闪店；广角鱼眼、近大远小、黄色底栏与蓝色手绘装饰。固定鞋面裁片、鞋底、Logo方向、IP脸部和手套结构。',
    '根据品牌资产绘制黑白构图线稿：打开的鞋盒和跑鞋占前景55%，IP店员居中后景，门店货架和联名海报形成透视；明确鱼眼畸变、手臂动作、标题区和底栏，不上色。',
    '严格在线稿轮廓内填色：跑鞋珊瑚红、IP钴蓝、门店暖灰、底栏高饱和黄；参考上传风格控制色块与描边，不改变主体比例、透视和手部位置。',
    '沿用彩稿构图，参考C4D图只迁移毛发、皮革、纸盒、织物和店铺灯光材质；测试IP蓝色短毛、鞋面磨砂皮革、纸盒纤维、暖顶光与冷轮廓光。',
    '合并全部上游参考输出高完成度C4D商业KV：鱼眼24mm，IP店员向镜头递出鞋盒跑鞋，产品绝对清晰，快闪店真实陈列，右侧留大标题区，底部黄色活动信息栏。',
    '#f26a4f',
  ),
  commercialKvTemplate(
    'mascot-cafe-store-kv',
    '品牌 IP · 咖啡门店开业 KV',
    '以吉祥物、招牌杯和门店建筑形成可爱但商业完成度高的开业主视觉。',
    '虚构咖啡品牌“M Standee”，橙色圆形咖啡豆吉祥物与白色小狗IP。场景为阳光街角木质咖啡门店，一只巨大白杯化为门店装置，杯口探出可颂角色。配色奶油白、咖啡棕、橙色与植物绿。',
    '绘制门店开业KV黑白线稿：右侧木质门店，左侧巨大咖啡杯装置形成主视觉，橙色IP与白色小狗在入口迎宾；保留左上标题区和底部搜索栏，透视准确。',
    '按参考插画填色，保持线稿不变：奶油白杯体、深咖啡描边、橙色吉祥物、木棕门店和高明度绿植；阳光方向从右上进入，色彩温暖清爽。',
    '参考C4D渲染建立绒布IP、陶瓷杯、烘焙可颂、木材、玻璃和植物材质，测试柔和太阳光、环境反弹光和轻微景深，不塑料化。',
    '输出童话感但真实可落地的C4D门店KV：IP角色与巨大杯装置互动，品牌门店完整可见，材质细腻、日光温暖，左上和底部保留开业传播信息区。',
    '#e79642',
  ),
  commercialKvTemplate(
    'convenience-food-ip-kv',
    '便利店 × 食品 IP · 动态事件 KV',
    '用夸张近景、食物流体和IP店员构建强事件感联名广告。',
    '虚构便利店“DAY&NIGHT”与饭团新品联名。两名圆角机器人IP为店员，前景饭团包装被抛向镜头，蛋黄与酱汁形成弧形飞溅；背景便利店招牌和入口清晰。主色蓝白橙，动作夸张但食品物理可信。',
    '绘制16:9鱼眼线稿：右侧大机器人捂耳惊讶，左侧小机器人伸手接住飞来的饭团，食物与酱汁弧线从左上穿过，门店入口作为后景锚点；保留左下活动区。',
    '参考风格对线稿填色：便利店蓝白、机器人黑灰与橙色围巾、饭团米白、蛋黄金黄；强烈逆光爆点位于左上，阴影方向一致。',
    '使用C4D参考完成机器人磨砂外壳、针织围巾、饭团颗粒、海苔、流体酱汁、玻璃门店和晨光体积雾材质测试。',
    '输出高冲击C4D商业KV：饭团和酱汁定格飞行，两名IP反应生动，鱼眼空间真实，门店品牌可识别但不生成乱码，底部保留日期、地址和搜索框区域。',
    '#f58232',
  ),
  commercialKvTemplate(
    'beverage-mascot-kv',
    '鲜果饮品 × 吉祥物 · 冰爽 KV',
    '从杯型、吉祥物和门店资产出发，生产高饱和冰爽饮品联名主视觉。',
    '虚构鲜果饮品“QooQ”与蓝色水滴猫IP。超大透明杯橙汁位于左前景，IP从右侧抱住杯子，背景为明亮水果门店；杯贴、吸管、杯型、冰块和果肉必须准确。主色橙、天蓝与少量苹果绿。',
    '黑白构图线稿：超大饮品杯占画面左侧45%，蓝色IP位于右中部拥抱杯身，后景水果篮与饮品台形成层次；预留右上标题和底部活动栏。',
    '按参考风格填色并锁定杯贴：橙汁高饱和橙、IP清透天蓝、门店暖木色、苹果绿色点缀；不改变杯体透视、角色拥抱动作和水果位置。',
    '参考C4D风格测试透明PET杯、冰块折射、果肉气泡、冷凝水、IP短绒毛、水果蜡质和门店暖光；杯中液体必须真实通透。',
    '输出冰爽C4D饮品商业KV：大杯橙汁与蓝色IP近距离互动，冷凝水和冰块清晰，背景门店有真实景深，右上留联名标题区，底部留门店信息。',
    '#47aef0',
  ),
  commercialKvTemplate(
    'collectible-toy-launch-kv',
    '潮玩 IP · 新系列发售 KV',
    '以线稿锁定角色群像和包装，再用C4D参考统一搪胶、毛绒与透明材质。',
    '虚构潮玩系列“夜航俱乐部”，包含月兔、星熊和灯塔鸟三名IP。新品为盲盒与12厘米公仔；场景为漂浮夜航站台，深蓝、月光黄、珊瑚红配色。画面需要角色群像、包装、系列符号和发售安全区。',
    '绘制群像KV线稿：月兔居中前景，星熊与灯塔鸟分列两侧，盲盒包装位于右前景，漂浮站台与月亮构成圆形背景；明确角色遮挡和标题留白。',
    '参考上传风格完成色稿：深蓝夜空、月光黄轮廓、珊瑚红小面积强调；三名角色和包装配色严格继承资产，保持线稿轮廓。',
    '根据C4D参考分别测试搪胶哑光、短绒毛、半透明翅膀、纸盒覆膜和月光体积雾，统一角色比例和光源方向。',
    '输出收藏级C4D潮玩KV：三IP站在漂浮月台，包装清晰完整，材质差异明确，月光形成品牌圆环，左上留系列名、右下留发售日期和渠道区。',
    '#756de0',
  ),
  commercialKvTemplate(
    'beauty-ip-popup-kv',
    '美妆 × IP · 沉浸式快闪 KV',
    '把美妆包装、IP装置和沉浸门店整合为高级C4D联名视觉。',
    '虚构润唇品牌“BLOOM”与白色花瓣兔IP联名。产品为淡粉磨砂管身与银色盖；场景为花瓣形快闪店，IP作为巨型迎宾装置，产品穿插于半透明花瓣与镜面水台。色彩珍珠白、柔粉、银色。',
    '绘制快闪KV线稿：花瓣建筑拱门居中，巨型兔IP位于左侧屋顶，产品管身在右前景放大，门店内部与镜面水台形成纵深；保留上方联名标识区。',
    '严格按线稿填入珍珠白、柔粉和银色，参考风格控制高键色调与少量暖阳；产品、IP和建筑轮廓不变，避免粉色过曝。',
    '参考C4D图测试IP细绒、磨砂包装、银色拉丝、半透明花瓣树脂、镜面水台和柔和日光，产品边缘与Logo面保持清楚。',
    '输出高级高键C4D美妆联名KV：花瓣快闪店、巨型IP和放大产品形成三层空间，材质轻盈真实，顶部与右下保留联名标题、地址和日期区。',
    '#ef9fb7',
  ),
]

const REMOVED_TEMPLATE_IDS = new Set([
  'product-backgrounds', 'beauty-tvc', 'short-drama-dialogue', 'beauty-serum-tvc', 'new-energy-drink-tvc', 'milk-tea-tvc',
])
const CATEGORY_RENAMES: Record<string, string> = {
  '影视分镜': '影视 / TVC 广告',
  '场景与视觉': '视觉场景',
}
const VIDEO_WORKFLOW_BRIEF = `视频生成执行规范：
1. 参考优先级：角色/产品/场景母版 > 当前镜头关键帧 > 风格参考 > 文字补充。上游母版是身份与结构的唯一事实来源。
2. 一致性锁定：人物脸型、五官锚点、年龄、发型、体型、服装层级、配饰和标志道具不可变化；IP头身比、轮廓、配色、材质和表情器官不可变化；产品尺寸比例、孔位、按键、接口、Logo面、包装文字结构和材质不可变化；场景建筑、道路、门窗、家具、道具位置、主色和主光方向不可变化。
3. 动态规则：只改变当前镜头明确要求的动作、表情、景别、机位、运镜和时间进度。动作必须有起始状态、运动过程和结束状态，重心、惯性、碰撞、液体、布料、毛发、烟雾、雨雪和反射符合真实物理。
4. 摄影规则：严格执行指定景别、焦段、机位高度、轴线、运动方向和速度曲线；画面稳定，不随机摇晃，不突然变焦，不跳轴，不漂移构图，不改变光源方向。
5. 输出要求：电影级商业成片，16:9，24fps，单镜默认5秒；主体清晰、运动自然、时间连续，可直接进入剪辑。无字幕、无水印、无新增Logo、无镜头编号。
6. 禁止项：禁止换脸、年龄漂移、随机换装、多人串脸、多肢体、多手指、肢体穿插、主体复制、产品变形、Logo重绘、包装文字乱码、建筑漂移、背景闪烁、材质跳变、光线闪烁和无关物体突然出现。`
const VIDEO_TEMPLATE_IDS = new Set([
  'xinpianchang-sci-fi-western-world', 'myriad-demons-chronicle', 'zombie-scavenger', 'kpop-mv-production', 'short-drama-production', 'tvc-production',
  'douyin-commerce', 'restaurant-launch', 'tourism-citywalk', 'virtual-human-host', 'virtual-influencer-matrix',
  'education-course-launch', 'automotive-launch', 'fintech-brand-production', 'fintech-growth-operations',
])
const isVideoWorkflow = (template: WorkflowTemplate) => template.category === '影视 / TVC 广告'
  || VIDEO_TEMPLATE_IDS.has(template.id)
  || template.tags.some((tag) => /视频|TVC|分镜|短片|MV|电影/i.test(tag))
const MOTION_NODE_PATTERN = /镜|分镜|故事|动作|交互|过程|演示|首尾帧|动态|口播|场景组|旅拍|发布|Campaign/i
const STATIC_MASTER_PATTERN = /母版|三视图|设定板|资产|结构|界面母版|标准图|质检|清单/i
const buildVideoPrompt = (template: WorkflowTemplate, source: WorkflowTemplateNode, shotIndex: number) => {
  const sourcePrompt = String(source.data.promptText ?? source.data.body ?? '').trim()
  return `【项目】${template.title}
【项目目标】${template.description}
【镜头编号】${shotIndex + 1}
【镜头名称】${source.data.title}

【本镜头必须完成的画面与动作】
${sourcePrompt || `严格依据上游“${source.data.title}”关键帧生成动态镜头，保持画面主体、构图、场景和光线一致。`}

【时间轴】
- 0%–15%：从上游关键帧的稳定状态开始，主体身份、位置、朝向、服装/产品结构和环境布局必须与首帧一致。
- 15%–80%：只执行本镜头指定的核心动作；动作路径清楚，速度有加速、匀速或减速过程，镜头运动与主体运动不得互相打架。
- 80%–100%：自然收束到可剪辑的稳定尾帧，为下一镜头保留动作方向、视线、光线和构图匹配点。

【连续性检查】
- 继承全部上游连接节点；不得只参考最后一张图。
- 保持人物/IP/产品/场景的全部视觉锚点，不补画未定义细节。
- 若上游镜头存在动作、视线、道具状态或环境变化，必须从上一镜结束状态继续，不得重置。
- 同一角色不得换脸、换发型、换服装或改变年龄；同一产品不得改变比例、接口、按键、Logo和包装结构。

【摄影与声音】
- 使用镜头描述中指定的景别、焦段、机位、轴线和运镜；未指定时采用克制稳定的电影摄影，不做无意义环绕。
- 保持主光方向、色温、曝光、景深与上游关键帧一致，禁止闪烁。
- 预留真实环境声、动作音效与转场声音点，不自动生成旁白、音乐和字幕。

【输出与负面约束】
${VIDEO_WORKFLOW_BRIEF}`
}
const enhanceTemplate = (template: WorkflowTemplate): WorkflowTemplate => {
  const category = CATEGORY_RENAMES[CATEGORY_BY_ID[template.id] ?? template.category] ?? (CATEGORY_BY_ID[template.id] ?? template.category)
  const nodes = [...template.nodes]
  const edges = [...template.edges]
  let latestId = nodes.at(-1)?.id
  const append = (node: WorkflowTemplateNode, sourceId = latestId) => {
    if (nodes.some((item) => item.id === node.id)) return
    nodes.push(node)
    if (sourceId) edges.push(edge(sourceId, node.id))
    latestId = node.id
  }
  if (category === '角色与 IP') {
    append(text('usage-matrix', '角色使用矩阵', '定义角色在头像、海报、短视频、直播、表情包、周边与多人同框中的尺寸、服装权限、表情强度、动作边界和品牌露出规则。', nodes.length * 340, 0))
    append(text('continuity-check', '角色一致性质检', '逐项核对脸部锚点、头身比、发型、服装层级、标志道具、表情边界、动作重心与多角色区分；列出通过项、偏差项、返工节点和不可变更项。', nodes.length * 340, 0))
  }
  if (category === '商业电商') {
    append(text('conversion-structure', '转化信息结构', '按“3秒识别商品—核心利益点—可视证据—规格/套装—场景代入—疑虑消除—行动入口”组织素材，并标明每个渠道的首屏优先级。', nodes.length * 340, 0))
    append(text('channel-delivery', '渠道交付与合规检查', '核对商品结构、套装数量、尺寸单位、卖点证据、渠道安全区、主图规则、价格留白、字幕区和禁止绝对化承诺；输出淘宝、抖音、拼多多、Amazon的适配清单。', nodes.length * 340, 0))
  }
  if (category === '品牌与 KV' || category === '视觉场景') {
    append(text('channel-system', '渠道视觉系统', '把核心画面拆为官网首屏、社媒方图、信息流竖版、线下大屏和活动页首屏；逐项规定裁切锚点、文字安全区、CTA区、品牌资产最小尺寸与深浅底适配。', nodes.length * 340, 0))
    append(text('art-direction-qa', '艺术指导与终稿质检', '核对策略主张、资产一致性、构图层级、品牌色、材质、光线、可读性、渠道尺寸、合规脚注和无错误文字要求；输出可投放交付包。', nodes.length * 340, 0))
  }
  const needsVideo = category === '影视 / TVC 广告' || VIDEO_TEMPLATE_IDS.has(template.id)
  if (needsVideo) {
    append(text('motion-spec', '逐镜运动与声音设计', '为每个动态镜头写明首帧、尾帧、时长、景别、焦段、机位、运镜、主体动作、速度曲线、转场匹配点、环境声、音效点和字幕安全区。', nodes.length * 340, 0))
    const motionSources = template.nodes.filter((node) => node.data.kind === 'image' && MOTION_NODE_PATTERN.test(node.data.title) && !STATIC_MASTER_PATTERN.test(node.data.title))
    const sources = motionSources.length ? motionSources : template.nodes.filter((node) => node.data.kind === 'image').slice(-1)
    const videoIds: string[] = []
    sources.forEach((source, index) => {
      const videoId = `video-shot-${index + 1}`
      videoIds.push(videoId)
      append(video(videoId, `视频占位 · ${source.data.title}`, buildVideoPrompt(template, source, index), nodes.length * 340, index % 2 ? 320 : 0), source.id)
    })
    append(video('video-edit-master', '视频占位 · 剪辑合成与多版输出', `【任务】将“${template.title}”的全部视频镜头按原始镜头编号顺序剪辑为完整成片。

【剪辑连续性】
- 逐镜检查人物/IP/产品/场景身份是否一致；发现换脸、换装、结构漂移、光线跳变或背景闪烁时标记返工，不用转场掩盖错误。
- 动作方向、人物视线、道具状态、产品朝向、环境时间和主光方向必须前后衔接。
- 优先使用动作匹配、视线匹配、构图匹配和声音桥；禁止滥用故障、闪白、旋转和无意义缩放转场。

【节奏与声音】
- 根据项目类型建立清晰的开场钩子、信息展开、情绪/功能高潮和品牌收束；保留呼吸点，不把所有镜头等长拼接。
- 统一对白、环境声、动作音效和音乐响度；重要动作设置准确音效点，音乐不得覆盖对白和产品声音。

【交付版本】
- 主版：16:9、24fps，保持原始叙事与完整品牌尾帧。
- 信息流版：9:16，重新构图而非直接裁掉主体；保留字幕、CTA和平台UI安全区。
- 静音字幕版：无声音也能理解核心信息，字幕不遮挡脸、产品、操作手势和合规说明。
- 输出前检查Logo出现时长、CTA、免责声明、字幕错字、黑场、爆音、重复帧和最后一帧稳定性。

${VIDEO_WORKFLOW_BRIEF}`, nodes.length * 340, 0, '30s'))
    videoIds.forEach((videoId) => {
      if (!edges.some((item) => item.source === videoId && item.target === 'video-edit-master')) edges.push(edge(videoId, 'video-edit-master'))
    })
  }
  return { ...template, category, nodes, edges }
}

const FINTECH_WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  productionTemplate('fintech-growth-operations', '金融科技 · 全周期视觉运营增长线', '精选工业化', '覆盖拉新、激活、留存、教育、活动与召回的高频金融科技视觉运营生产线。', ['金融科技', '视觉运营', '增长'], '虚构金融科技产品“NorthBridge”。以可信、清晰、克制为原则，围绕新用户开户、首个自选、市场事件、功能教育、会员权益、风险提醒和沉默召回建立周/月度运营体系；所有数据为演示数据，不承诺收益。', [['calendar', '月度运营日历与分层人群', '规划新客、活跃投资者、长期持有者和沉默用户四类人群；列出市场日历、功能发布、教育专题、权益活动、风险节点、渠道、频次与核心指标。'], ['designSystem', '运营视觉组件母版', '建立行情卡、权益卡、任务卡、风险提示、直播预告、课程封面、榜单、弹窗与推送缩略图组件；统一深绿、石墨、暖白与数据可视化规则。'], ['acquisition', '拉新开户 Campaign', '输出信息流9:16、落地页首屏16:9、应用商店截图和邀请海报；主张工具价值与透明体验，保留资格、地区、条款和风险披露区。'], ['activation', '新手激活任务视觉', '设计开户完成、添加首个自选、阅读公司资料、设置价格提醒、完成风险测评五步任务卡与进度反馈；避免游戏化诱导交易。'], ['market', '市场事件运营套图', '围绕财报季、利率决议和交易时段变化，输出日历卡、直播预告、盘前提示、盘后复盘与知识解释图；数据源、时间与时区位置明确。'], ['retention', '留存与召回内容矩阵', '输出周报、组合健康度、功能发现、风险教育和沉默召回五类模板；采用行为价值与知识价值，不用收益刺激和焦虑文案。'], ['measurement', '投放版本与复盘看板', '为每个素材记录人群、渠道、钩子、画幅、版本、曝光、点击、激活和留存指标；建立可替换演示数据的复盘看板。']], { accent: '#48bd91' }),
  productionTemplate('fintech-payment-operations', '支付钱包 · 日常运营视觉系统', '品牌与 KV', '面向支付、数字钱包和生活金融的活动、权益与服务运营。', ['金融科技', '支付', '视觉运营'], '虚构支付钱包“LumaPay”。围绕扫码支付、账单管理、跨境支付、会员权益、安全提醒和节日活动，建立可信且生活化的视觉运营体系；不使用现金堆叠和夸张返利。', [['journey', '支付用户旅程与场景板', '定义通勤、餐饮、商超、线上订阅、旅行和家庭账单六类真实使用场景，固定用户、手机、商户终端和界面状态。'], ['benefit', '权益活动主视觉体系', '输出首页Banner、活动页首屏、权益卡、优惠券、Push缩略图和线下立牌；清楚区分门槛、期限、适用商户和规则区。'], ['trust', '安全与反诈教育视觉', '建立登录保护、异常支付确认、设备管理、反诈提示和客服入口五类信息图；使用清晰严重性层级，不制造恐慌。'], ['seasonal', '节日与跨境运营套图', '输出春节、开学季、旅行季和跨境消费四套可替换主题，保持钱包界面与品牌识别一致，预留汇率、地区与条款说明。']], { accent: '#4bb7d8' }),
  productionTemplate('web3-community-operations', 'Web3 · 社区与产品视觉运营', '品牌与 KV', '覆盖钱包新手教育、协议更新、开发者活动、社区治理与安全提醒。', ['Web3', '视觉运营', '社区'], '虚构Web3产品“OrbitKey”。面向新用户、活跃钱包用户、开发者与社区贡献者，建立产品教育、版本发布、生态合作、黑客松、治理提案和安全预警视觉；不用币价、收益率和空投暴富叙事。', [['onboarding', '钱包新手教育卡组', '输出创建钱包、备份恢复、连接应用、签名确认、权限撤销和资产安全六步卡组；敏感信息使用占位符，风险动作明确高亮。'], ['release', '产品更新与生态合作套图', '为版本发布、协议集成和合作伙伴公告输出官网横幅、社媒方图、线程配图和开发者文档封面，品牌与合作方Logo安全区明确。'], ['community', '社区活动与治理视觉', '输出AMA、Space、黑客松、治理提案和投票提醒模板；时间、时区、主持人、议题、规则和链接位置清晰。'], ['security', '链上安全预警模板', '建立钓鱼提醒、合约授权、假冒账号、异常签名和事件进展五类模板；严重性、影响范围、官方链接与更新时间层级清楚。']], { accent: '#6f9ff4' }),
  productionTemplate('fintech-web3-ecosystem', 'Web3 品牌 · 数字身份与链上生态 KV', '品牌与 KV', '面向钱包、协议与开发者生态。强调可信、透明、可验证，不使用币价上涨、暴富叙事或收益承诺。', ['金融科技', 'Web3', '数字身份'], '虚构品牌“OrbitKey”。建立数字身份、钱包界面、节点网络和开发者控制台视觉资产；采用石墨黑、雾银、可访问的电蓝，所有资产使用演示数据与可替换品牌标识。', [['identity', '数字身份资产母版', '建立匿名化数字身份卡、钱包连接状态、权限层级和抽象头像，信息层级清晰，无真实地址与资产金额。'], ['network', '链上生态主视觉', '以可信的节点网络、跨链路径和开发者工作台形成空间化KV，保留主张、免责声明和CTA安全区。'], ['kit', '多渠道生态交付', '输出16:9官网首屏、3:4活动海报和1:1社媒图；同一品牌色、节点语言、数据层级一致。']], { accent: '#63a8e9' }),
  productionTemplate('fintech-brand-production', '金融科技 · 合规品牌资产生产线', '精选工业化', '从策略、信息架构、界面母版到多渠道物料的工业化金融科技生产线。', ['金融科技', '工业化', 'Campaign'], '虚构金融科技品牌“NorthBridge”。围绕全球市场、透明工具与理性决策，建立品牌规则、投资者场景、UI资产、风险教育和渠道终稿；所有指标均为演示数据。', [['strategy', '策略与合规信息架构', '输出受众、价值主张、信息优先级、禁用承诺、风险披露位置和渠道尺寸规范。'], ['ui', '金融产品界面母版', '建立行情、自选、风险提示、账户概览与教育内容五套统一界面；不展示夸张涨幅或保证收益。'], ['campaign', '品牌 Campaign 成片', '输出官网横幅、应用商店展示和风险教育竖版物料，人物、UI、石墨绿品牌资产持续一致。']], { accent: '#45b88c' }),
  productionTemplate('fintech-tvc-storyboard', '金融科技 TVC · 理性决策产品片', '影视 / TVC 广告', '将可信产品体验转为可拍摄、可生成的视频镜头链路。', ['金融科技', 'TVC', '产品演示'], '30秒金融科技产品片：同一用户在通勤、办公与夜间复盘中使用虚构产品。六镜覆盖市场查看、研究、风险确认、预算、跨端同步和品牌收束；UI、人物、手机、桌面与演示数据严格连续。', [['frames', '六镜首尾帧与连续性板', '为每镜标注景别、焦段、机位、屏幕状态、手部动作、转场匹配点与风险披露安全区。'], ['end', '品牌收束关键帧', '人物和跨端界面处于克制的夜间工作台，石墨绿与柔和城市光，保留品牌主张与合规脚注区域。']], { accent: '#63c59e' }),
]

const BUILT_IN_TEMPLATES = [...WORKFLOW_TEMPLATES, ...EXPANDED_TEMPLATES, ...FINTECH_WORKFLOW_TEMPLATES]
  .filter((template) => !REMOVED_TEMPLATE_IDS.has(template.id))
  .map((template, index) => enhanceTemplate({
    ...template,
    category: CATEGORY_BY_ID[template.id] ?? template.category,
    accent: template.accent || ['#8f9cff', '#67d1b4', '#ef9b72'][index % 3],
  })).sort((a, b) => {
  const marketPriority = [
    'fintech-growth-operations', 'tvc-production', 'kpop-mv-production', 'short-drama-production', 'fintech-brand-production', 'xinpianchang-sci-fi-western-world', 'myriad-demons-chronicle',
    'live-action-character-bible', 'trendy-ip-matrix', 'virtual-human-host', 'character-expression-action', 'character-ip-matrix', 'brand-mascot', 'studio-portrait-set',
    'douyin-commerce', 'taobao-detail', 'amazon-listing', 'pdd-detail', 'restaurant-launch', 'ecommerce-set',
    'product-launch-film', 'fintech-product-demo', 'app-tvc', 'phone-tvc', 'sports-campaign', 'brand-film', 'product-storyboard', 'action-storyboard',
    'fintech-broker-campaign', 'fintech-payment-operations', 'fintech-web3-ecosystem', 'web3-community-operations', 'brand-kv-system', 'mobile-kv', 'campaign-poster-system',
    'live-action-composite', 'environment-concept', 'live-action-vfx-video', 'style-transfer', 'three-directions', 'iterate-polish',
  ]
  const categoryRank = (template: WorkflowTemplate) => template.category === '精选工业化' ? 0 : CATEGORIES.indexOf(template.category as typeof CATEGORIES[number]) + 1
  const categoryDifference = categoryRank(a) - categoryRank(b)
  if (categoryDifference) return categoryDifference
  const aIndex = marketPriority.indexOf(a.id)
  const bIndex = marketPriority.indexOf(b.id)
  return (aIndex < 0 ? marketPriority.length : aIndex) - (bIndex < 0 ? marketPriority.length : bIndex)
})

const EMPTY_DRAFT = (): EditorDraft => ({
  title: '', description: '', category: '精选工业化', tags: '', accent: '#8f9cff',
  nodes: [
    { id: crypto.randomUUID(), kind: 'text', title: '制作 Brief', prompt: '' },
    { id: crypto.randomUUID(), kind: 'image', title: '生成结果', prompt: '' },
  ],
})

const readStorage = (): StoredWorkflowTemplates => {
  try {
    const value = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '{}') as Partial<StoredWorkflowTemplates>
    return { custom: Array.isArray(value.custom) ? value.custom : [], overrides: Array.isArray(value.overrides) ? value.overrides : [], hidden: Array.isArray(value.hidden) ? value.hidden : [] }
  } catch { return { custom: [], overrides: [], hidden: [] } }
}

const templateToDraft = (template: WorkflowTemplate): EditorDraft => ({
  id: template.userDefined ? template.id : undefined,
  sourceId: template.userDefined ? undefined : template.id,
  title: template.title, description: template.description, category: template.category,
  tags: template.tags.join(', '), accent: template.accent,
  nodes: template.nodes.map((node) => ({
    id: node.id, kind: node.data.kind, title: node.data.title,
    prompt: String(node.data.promptText ?? node.data.body ?? ''),
  })),
})

const draftToTemplate = (draft: EditorDraft): WorkflowTemplate => {
  const id = draft.id ?? (draft.sourceId ? `override:${draft.sourceId}` : `user:${crypto.randomUUID()}`)
  const nodes = draft.nodes.map((node, index) => {
    const x = index * 340
    if (node.kind === 'upload') return { ...upload(node.id, node.title, x, 0), data: { kind: 'upload' as const, title: node.title, body: node.prompt || '请上传参考图片' } }
    if (node.kind === 'video') return video(node.id, node.title, node.prompt || VIDEO_WORKFLOW_BRIEF, x, 0)
    return node.kind === 'text' ? text(node.id, node.title, node.prompt, x, 0) : image(node.id, node.title, node.prompt, x, 0)
  })
  return {
    id, title: draft.title.trim(), description: draft.description.trim(), category: draft.category,
    tags: draft.tags.split(/[,，]/).map((tag) => tag.trim()).filter(Boolean), accent: draft.accent,
    nodes, edges: nodes.slice(1).map((node, index) => edge(nodes[index].id, node.id)), userDefined: true,
  }
}

type Props = {
  open: boolean
  onClose: () => void
  onApply: (template: WorkflowTemplate) => void
}

function WorkflowCategorySelect({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const close = (event: MouseEvent) => { if (!rootRef.current?.contains(event.target as Node)) setOpen(false) }
    window.addEventListener('mousedown', close)
    return () => window.removeEventListener('mousedown', close)
  }, [])
  return <div className="workflow-category-select" ref={rootRef}>
    <button type="button" className={open ? 'is-open' : ''} aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((current) => !current)} onKeyDown={(event) => { if (event.key === 'Escape') setOpen(false) }}>
      <span>{value}</span><ChevronDown size={14} aria-hidden="true" />
    </button>
    {open && <div role="listbox" aria-label="模板分类">
      {CATEGORIES.map((item) => <button type="button" role="option" aria-selected={item === value} className={item === value ? 'is-selected' : ''} key={item} onClick={() => { onChange(item); setOpen(false) }}>{item}</button>)}
    </div>}
  </div>
}

export function WorkflowTemplatePanel({ open, onClose, onApply }: Props) {
  const { confirm: projectConfirm, alert: projectAlert, dialogNode: projectDialogNode } = useProjectDialog()
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('全部')
  const [storage, setStorage] = useState<StoredWorkflowTemplates>(readStorage)
  const [selectedId, setSelectedId] = useState(BUILT_IN_TEMPLATES[0].id)
  const [draft, setDraft] = useState<EditorDraft | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const backdropRef = useRef<HTMLDivElement>(null)
  const panelRef = useRef<HTMLElement>(null)
  const closingRef = useRef(false)
  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(storage)) }, [storage])

  const { contextSafe } = useGSAP(() => {
    if (!open || !backdropRef.current || !panelRef.current) return
    closingRef.current = false
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (reducedMotion) {
      gsap.set([backdropRef.current, panelRef.current], { autoAlpha: 1, clearProps: 'transform' })
      return
    }
    const cards = gsap.utils.toArray<HTMLElement>('.workflow-template-card').slice(0, 12)
    const timeline = gsap.timeline({ defaults: { ease: 'power3.out' } })
    timeline
      .fromTo(backdropRef.current, { autoAlpha: 0 }, { autoAlpha: 1, duration: .28 })
      .fromTo(panelRef.current, { autoAlpha: 0, y: 24, scale: .975 }, { autoAlpha: 1, y: 0, scale: 1, duration: .52, ease: 'power4.out' }, .03)
      .fromTo('.workflow-library > header > *, .workflow-library-toolbar > *', { autoAlpha: 0, y: 8 }, { autoAlpha: 1, y: 0, duration: .32, stagger: .035 }, .16)
      .fromTo(cards, { autoAlpha: 0, y: 12, scale: .985 }, { autoAlpha: 1, y: 0, scale: 1, duration: .34, stagger: .025, ease: 'power2.out' }, .2)
      .fromTo('.workflow-template-detail', { autoAlpha: 0, x: 10 }, { autoAlpha: 1, x: 0, duration: .36 }, .24)
  }, { scope: backdropRef, dependencies: [open], revertOnUpdate: true })

  const requestClose = contextSafe(() => {
    if (closingRef.current) return
    const backdrop = backdropRef.current
    const panel = panelRef.current
    if (!backdrop || !panel || window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      onClose()
      return
    }
    closingRef.current = true
    gsap.timeline({ onComplete: onClose })
      .to(panel, { autoAlpha: 0, y: 14, scale: .985, duration: .24, ease: 'power2.in' })
      .to(backdrop, { autoAlpha: 0, duration: .18, ease: 'power1.inOut' }, '<.05')
  })

  useEffect(() => {
    if (!open) return
    const closeWithEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      event.preventDefault()
      if (draft) setDraft(null)
      else requestClose()
    }
    window.addEventListener('keydown', closeWithEscape)
    return () => window.removeEventListener('keydown', closeWithEscape)
  }, [draft, open, requestClose])
  const templates = useMemo(() => {
    const overrides = new Map(storage.overrides.map((item) => [item.id.replace(/^override:/, ''), item]))
    const builtIns = BUILT_IN_TEMPLATES
      .filter((item) => !storage.hidden.includes(item.id))
      .map((item) => enhanceTemplate(overrides.get(item.id) ?? item))
    return [...builtIns, ...storage.custom]
  }, [storage])
  const selected = templates.find((item) => item.id === selectedId) ?? templates[0] ?? null
  const results = useMemo(() => templates.filter((item) => {
    if (category !== '全部' && item.category !== category) return false
    const normalized = query.trim().toLowerCase()
    return !normalized || [item.title, item.description, item.category, ...item.tags].some((value) => value.toLowerCase().includes(normalized))
  }), [category, query, templates])
  const saveDraft = () => {
    if (!draft || !draft.title.trim() || !draft.nodes.length) return
    const template = draftToTemplate(draft)
    setStorage((current) => {
      if (draft.sourceId || template.id.startsWith('override:')) {
        return { ...current, overrides: [...current.overrides.filter((item) => item.id !== template.id), template] }
      }
      return { ...current, custom: [...current.custom.filter((item) => item.id !== template.id), template] }
    })
    setSelectedId(template.id)
    setDraft(null)
  }
  const removeTemplate = async (template: WorkflowTemplate) => {
    if (!await projectConfirm({ title: '删除工作流模板？', message: `模板“${template.title}”将从本地模板库移除。`, confirmLabel: '确认删除', danger: true })) return
    const sourceId = template.id.replace(/^override:/, '')
    setStorage((current) => template.userDefined
      ? {
          ...current,
          custom: current.custom.filter((item) => item.id !== template.id),
          overrides: current.overrides.filter((item) => item.id !== template.id),
          hidden: template.id.startsWith('override:') ? [...new Set([...current.hidden, sourceId])] : current.hidden,
        }
      : { ...current, hidden: [...new Set([...current.hidden, template.id])] })
    setSelectedId(BUILT_IN_TEMPLATES[0].id)
  }
  const exportTemplates = () => {
    const blob = new Blob([JSON.stringify({ version: 2, templates }, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `disylab-workflows-${new Date().toISOString().slice(0, 10)}.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }
  const importTemplates = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return
    try {
      const parsed = JSON.parse(await file.text()) as unknown
      const candidates = Array.isArray(parsed) ? parsed : (parsed as { templates?: unknown })?.templates
      if (!Array.isArray(candidates)) throw new Error('JSON 中未找到 templates 数组')
      const valid = candidates.filter((item): item is WorkflowTemplate => {
        if (!item || typeof item !== 'object') return false
        const value = item as Partial<WorkflowTemplate>
        return typeof value.title === 'string' && Array.isArray(value.nodes) && Array.isArray(value.edges)
      }).map((item) => ({
        ...item, id: `user:${crypto.randomUUID()}`, userDefined: true,
        category: CATEGORIES.includes(item.category as typeof CATEGORIES[number]) ? item.category : '精选工业化',
      }))
      if (!valid.length) throw new Error('没有可导入的有效工作流')
      setStorage((current) => ({ ...current, custom: [...current.custom, ...valid] }))
      setSelectedId(valid[0].id)
    } catch (error) { await projectAlert({ title: '工作流导入失败', message: error instanceof Error ? error.message : '导入失败', danger: true }) }
  }
  if (!open) return null

  return <div ref={backdropRef} className="workflow-library-backdrop" onMouseDown={requestClose}>
    <section ref={panelRef} className="workflow-library" onMouseDown={(event) => event.stopPropagation()}>
      <header>
        <div><span><Shapes size={18} /></span><div><small>WORKFLOW LIBRARY</small><h2>工作流模板库</h2></div></div>
        <div className="workflow-header-actions">
          <input ref={importRef} type="file" accept=".json,application/json" hidden onChange={importTemplates} />
          <button type="button" onClick={() => importRef.current?.click()}><Upload size={15} />导入</button>
          <button type="button" onClick={exportTemplates}><Download size={15} />导出</button>
          <button type="button" className="is-primary" onClick={() => setDraft(EMPTY_DRAFT())}><Plus size={15} />新建模板</button>
          <button type="button" aria-label="关闭工作流模板库" onClick={requestClose}><X size={19} /></button>
        </div>
      </header>
      <div className="workflow-library-toolbar">
        <label><Search size={15} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="搜索工作流、场景或标签" /></label>
        <nav>{['全部', ...CATEGORIES].map((item) => <button type="button" className={category === item ? 'is-active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</nav>
      </div>
      <div className="workflow-library-body">
        <div className="workflow-template-grid">
          {results.map((item) => <button type="button" className={`workflow-template-card ${selected?.id === item.id ? 'is-selected' : ''}`} onClick={() => setSelectedId(item.id)} key={item.id}>
            <div className={`workflow-cover-preview ${isVideoWorkflow(item) ? 'is-video' : ''}`} style={{ '--workflow-accent': item.accent, '--workflow-cover': `url(${isVideoWorkflow(item) ? '/workflow-covers/video-storyboard.png' : '/workflow-covers/creative-production.png'})` } as CSSProperties}>
              <div className="workflow-cover-shade" />
              <div className="workflow-cover-meta"><span>{isVideoWorkflow(item) ? 'STORYBOARD' : 'CREATIVE SYSTEM'}</span><b>{item.nodes.length} STEPS</b></div>
            </div>
            <div><small>{item.category}{item.userDefined ? ' · 本地' : ''}</small><strong>{item.title}</strong><p>{item.description}</p><span>{item.nodes.length} 个节点 · {item.edges.length} 条连线</span></div>
          </button>)}
          {!results.length && <div className="workflow-template-empty"><Search size={22} /><strong>没有匹配的工作流</strong><span>换个关键词或分类试试</span></div>}
        </div>
        <aside className="workflow-template-detail">
          {selected ? <>
            <div className="workflow-detail-heading"><span style={{ background: selected.accent }}><Sparkles size={18} /></span><div><small>{selected.category}</small><h3>{selected.title}</h3></div></div>
            <p>{selected.description}</p>
            <div className="workflow-detail-flow">
              {selected.nodes.map((node, index) => <div key={node.id}><span className={`is-${node.data.kind}`}>{index + 1}</span><div><strong>{node.data.title}</strong><small>{node.data.kind === 'upload' ? '上传参考图' : node.data.kind === 'text' ? '文本节点' : node.data.kind === 'video' ? '视频生成占位节点' : '图像生成节点'}</small></div>{index < selected.nodes.length - 1 && <ArrowRight size={13} />}</div>)}
            </div>
            <div className="workflow-detail-tags">{selected.tags.map((tag) => <span key={tag}>#{tag}</span>)}</div>
            <div className="workflow-detail-actions">
              <button type="button" onClick={() => setDraft(templateToDraft(selected))}><Pencil size={14} />编辑</button>
              <button type="button" className="is-danger" onClick={() => removeTemplate(selected)}><Trash2 size={14} />删除</button>
            </div>
            <button type="button" className="workflow-apply" onClick={() => onApply(selected)}><Check size={16} />使用此模板</button>
            <small className="workflow-detail-note">将复制节点与连线到当前画布，不会覆盖现有内容。</small>
          </> : <div className="workflow-template-empty"><Shapes size={25} /><strong>选择一个模板</strong></div>}
        </aside>
      </div>
      {draft && <div className="workflow-editor-backdrop" onMouseDown={() => setDraft(null)}>
        <form className="workflow-editor" onSubmit={(event) => { event.preventDefault(); saveDraft() }} onMouseDown={(event) => event.stopPropagation()}>
          <header><div><small>TEMPLATE EDITOR</small><h3>{draft.sourceId || draft.id ? '编辑工作流模板' : '新建工作流模板'}</h3></div><button type="button" onClick={() => setDraft(null)}><X size={18} /></button></header>
          <div className="workflow-editor-fields">
            <label><span>标题</span><input required value={draft.title} onChange={(event) => setDraft({ ...draft, title: event.target.value })} placeholder="例如：新品发布 KV" /></label>
            <label><span>分类</span><WorkflowCategorySelect value={draft.category} onChange={(category) => setDraft({ ...draft, category })} /></label>
            <label className="is-wide"><span>描述</span><textarea required value={draft.description} onChange={(event) => setDraft({ ...draft, description: event.target.value })} placeholder="说明此工作流解决什么生产任务" /></label>
            <label><span>标签（逗号分隔）</span><input value={draft.tags} onChange={(event) => setDraft({ ...draft, tags: event.target.value })} placeholder="KV, 产品, 商业" /></label>
            <label><span>强调色</span><input type="color" value={draft.accent} onChange={(event) => setDraft({ ...draft, accent: event.target.value })} /></label>
          </div>
          <div className="workflow-editor-node-heading"><div><strong>节点与提示词</strong><small>新建模板按列表顺序自动连接；导入 JSON 可保留完整图结构。</small></div><button type="button" onClick={() => setDraft({ ...draft, nodes: [...draft.nodes, { id: crypto.randomUUID(), kind: 'image', title: '新节点', prompt: '' }] })}><Plus size={14} />添加节点</button></div>
          <div className="workflow-editor-nodes">
            {draft.nodes.map((node, index) => <article key={node.id}>
              <span>{index + 1}</span>
              <div className="workflow-editor-node-fields">
                <select value={node.kind} onChange={(event) => setDraft({ ...draft, nodes: draft.nodes.map((item) => item.id === node.id ? { ...item, kind: event.target.value as EditorNode['kind'] } : item) })}><option value="text">文本节点</option><option value="image">图像节点</option><option value="video">视频占位节点</option><option value="upload">上传节点</option></select>
                <input required value={node.title} onChange={(event) => setDraft({ ...draft, nodes: draft.nodes.map((item) => item.id === node.id ? { ...item, title: event.target.value } : item) })} placeholder="节点标题" />
                <textarea value={node.prompt} onChange={(event) => setDraft({ ...draft, nodes: draft.nodes.map((item) => item.id === node.id ? { ...item, prompt: event.target.value } : item) })} placeholder={node.kind === 'upload' ? '上传说明（可选）' : '输入具体、可执行的生产提示词'} />
              </div>
              <button type="button" aria-label="删除节点" disabled={draft.nodes.length === 1} onClick={() => setDraft({ ...draft, nodes: draft.nodes.filter((item) => item.id !== node.id) })}><Trash2 size={14} /></button>
            </article>)}
          </div>
          <footer><button type="button" onClick={() => setDraft(null)}>取消</button><button type="submit" className="is-primary"><Check size={15} />保存到本地</button></footer>
        </form>
      </div>}
    </section>
    {projectDialogNode}
  </div>
}
