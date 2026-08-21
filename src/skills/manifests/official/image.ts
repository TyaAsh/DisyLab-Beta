import type { SkillManifest } from '../../types'

const make = (slug: string, name: string, description: string, prompt: string, aspectRatio = '1:1', kind: SkillManifest['kind'] = 'image', execution: SkillManifest['execution'] = 'configured'): SkillManifest => ({
  id: `official.${slug}`, slug, version: '1.0.0', name, description, kind, execution, source: 'official', enabled: true,
  parameters: [
    { name: 'subject', label: '主体与要求', type: 'string', required: true, bind: 'prompt' },
    { name: 'aspectRatio', label: '画幅', type: 'enum', enum: ['1:1', '9:16', '16:9', '3:4', '4:3'], default: aspectRatio, bind: 'aspectRatio' },
  ], inputs: [{ name: 'references', type: 'image', multiple: true }], output: { name: 'image', type: 'image' },
  template: { prompt }, capability: { supportedModes: ['text2image', 'image_reference'], allowedModelCapabilities: ['image'] }, createdAt: 0, updatedAt: 0,
})

export const OFFICIAL_IMAGE_SKILLS: SkillManifest[] = [
  make('storyboard-comic', '漫画分镜素材工厂', '区块守恒、A/B/C 布局、构图确认与素材生产。', `{{subject}}\n\n将内容整理为漫画故事板。保持每个“区块/小标签/正文/要点”连续且顺序不变，不擅自编号。先给出 A 手册对开、B 竖向长图、C 折线阅读三种零成本布局建议；布局确认后只制作一张构图粗稿。正式文字保留为可编辑安全区，不烤入图片；未明确确认前不得批量生成角色、道具、场景和背景素材。`, '9:16', 'storyboard_comic'),
  {
    ...make('photo-abstract-editorial', '摄影抽象编辑画', '保留参考照片，并从其空间与色彩关系派生极简编辑面板。', `{{subject}}\n\n以用户上传的参考照片作为唯一事实来源，制作一张竖向编辑作品。上部完整、忠实地保留原摄影区域，仅允许等比缩放或必要的轻微裁切，禁止重画、扩图、滤镜化或替换内容。下部使用平整的暖象牙色留白面板，从照片中提炼 3–6 个关键关系：主体尺度、方向轴线、间距、遮挡、明暗层级、色彩角色与负空间；用一类主视觉标记和最多两类辅助标记重新组织这些关系，形成稀疏的抽象记忆，而不是缩略图、描摹、图标或完整插画。颜色只从照片提取，不添加无来源装饰。照片与面板直接衔接，不使用边框、阴影、胶带或样机效果。面板只放一个基于画面事实创作的 2–5 词英文衬线标题；除此之外不出现日期、标签、Logo、水印或说明文字。`, '3:4'),
    capability: { supportedModes: ['image_reference'], requiresReference: true, allowedModelCapabilities: ['image'] },
  },
  make('multi-angle-nine-grid', '多机位九宫格', '同一主体的九种机位和景别探索。', `{{subject}}\n\n制作 3×3 多机位九宫格：正面平视、左右前 45°、左右侧面、背面、俯拍、低机位和细节近景。主体身份、结构、服装、材质、时间和光源一致，仅改变机位与景别。无文字、编号和水印。`, '1:1', 'image', 'instant'),
  make('story-four-panel', '剧情推演四宫格', '四个连续画面推进事件和情绪。', `{{subject}}\n\n制作 2×2 连续剧情四宫格：建立情境、触发事件、反应转折、结果悬念。角色、服装、空间、道具与光线连续，每格只推进一个动作；不生成文字、编号和水印。`),
  make('face-three-view', '角色脸部三视图', '正面、侧面和三分之二侧面身份基准。', `{{subject}}\n\n制作同一角色脸部三视图：正面、严格侧面、三分之二侧面。固定年龄、脸型、五官、肤色、发际线、发型和标志特征；中性表情、统一焦段与布光。`, '16:9', 'image', 'instant'),
  make('character-design-sheet', '角色设定图', '全身三视图、表情、服装与道具设定板。', `{{subject}}\n\n制作角色设定板：正侧背全身、三分之二动态姿态、关键表情、服装分层和标志道具。所有视图保持身份、头身比、服装结构、配色与材质一致。`, '16:9'),
  make('scene-design-sheet', '场景设定图', '全景、关键区域、空间关系与光线设定。', `{{subject}}\n\n制作同一场景设定板：主全景、反向视角、关键区域近景、空间关系、主要材质与光线变化。固定建筑位置、动线、地标、主色和光源。`, '16:9'),
  make('product-design-sheet', '产品设定图', '产品多视图、结构、材质与细节设定。', `{{subject}}\n\n制作产品设定板：正侧背、顶底、三分之二英雄角度、接口与材质微距。严格固定比例、轮廓、包装、Logo 面、孔位、按键和材质。`, '16:9'),
  make('continuity-board-25', '25 宫格连贯分镜', '高密度连续动作与镜头推进接触表。', `{{subject}}\n\n制作 5×5 连贯分镜接触表。相邻画面动作、轴线与空间方向连续；身份、服装、道具、布局和光线一致，远中近景与细节有节奏变化。无文字、编号和水印。`),
  { ...make('cinematic-lighting-grade', '电影级光影校正', '保留构图，仅重塑光线、色温与层次。', `{{subject}}\n\n严格保持原图主体、构图、姿势、结构、背景和透视不变，只校正主光、补光、轮廓光、曝光层次、色温和真实材质。禁止新增删除物体或改变五官、文字与 Logo。`, '1:1', 'image', 'instant'), capability: { supportedModes: ['image_reference'], requiresReference: true, allowedModelCapabilities: ['image'] } },
]
