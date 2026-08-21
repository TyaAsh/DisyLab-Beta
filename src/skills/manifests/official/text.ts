import type { SkillManifest } from '../../types'

const make = (slug: string, name: string, description: string, prompt: string, execution: SkillManifest['execution'], parameters: SkillManifest['parameters'] = []): SkillManifest => ({
  id: `official.${slug}`, slug, version: '1.0.0', name, description, kind: 'text', execution, source: 'official', enabled: true,
  parameters: [{ name: 'subject', label: '原始内容 / 任务', type: 'string', required: true, bind: 'prompt' }, ...parameters],
  inputs: [{ name: 'references', type: 'text', multiple: true }, { name: 'visualReferences', type: 'image', multiple: true }],
  output: { name: 'text', type: 'text' }, template: { prompt },
  capability: { supportedModes: ['text_generation', 'multimodal_understanding'], allowedModelCapabilities: ['text'] }, createdAt: 0, updatedAt: 0,
})

export const OFFICIAL_TEXT_SKILLS: SkillManifest[] = [
  make('copy-polish', '文案精修', '保持原意，直接提升清晰度、节奏与可信度。', `请精修以下文本。保留事实、观点、专有名词与原语言；删除空话和重复，修正病句，让表达自然、具体、有节奏。不要补造信息，只输出可直接使用的成稿。\n\n{{subject}}`, 'instant'),
  make('structured-summary', '结构化摘要', '直接提炼结论、依据、风险与待办。', `请将内容压缩为清晰的结构化摘要：先给一句核心结论，再列关键事实、重要依据、风险或不确定性，以及明确的后续行动。没有依据的项目不要杜撰，保留原语言。\n\n{{subject}}`, 'instant'),
  make('creative-brief', '创意需求整理', '把零散想法整理成可执行的创意 Brief。', `将以下素材整理为可执行的创意 Brief。输出目标、受众、核心信息、必保留元素、禁止项、视觉或语气方向、交付规格和验收标准；把缺失但会影响结果的信息列为“待确认”，不要自行编造。\n\n{{subject}}`, 'configured', [
    { name: 'audience', label: '目标受众', type: 'string', default: '面向实际观看或使用该内容的人群' },
    { name: 'tone', label: '语气', type: 'enum', enum: ['专业克制', '轻松自然', '有冲击力', '温暖可信'], default: '专业克制' },
  ]),
  make('story-outline', '故事与分镜脚本规划', '把主题发展成可继续接图像节点的镜头脚本。', `根据以下主题生成可执行的故事与分镜脚本。先明确叙事目标、人物动机和情绪曲线，再逐镜写景别、机位、动作、场景、光线、对白或旁白及连续性约束。每一镜只推进一个关键动作，输出应能直接交给后续图像 Skill。\n\n{{subject}}`, 'configured', [
    { name: 'length', label: '篇幅', type: 'enum', enum: ['短篇 4–6 镜', '中篇 8–12 镜', '长篇 16–24 镜'], default: '中篇 8–12 镜' },
    { name: 'audience', label: '受众', type: 'string', default: '大众' },
  ]),
  make('tone-rewrite', '语气与受众改写', '按目标受众重写，不改变事实。', `请按指定受众与语气重写以下内容。事实、数字、引用和结论不可改变；调整信息顺序、措辞密度和解释深度，使读者无需额外背景也能理解。只输出成稿。\n\n{{subject}}`, 'configured', [
    { name: 'audience', label: '目标受众', type: 'string', required: true },
    { name: 'tone', label: '目标语气', type: 'enum', enum: ['专业克制', '简洁直接', '亲切易懂', '叙事感', '社交媒体'], default: '简洁直接' },
  ]),
  make('visual-prompt-architect', '视觉提示词设计', '将想法转成可控、可复用的图像生成指令。', `把以下创意转写为生产级图像提示词。按主体与动作、环境与时代、构图与镜头、光线与色彩、材质与细节、连续性约束、禁止项组织；优先保证身份和结构，不堆砌空泛质量词。输出“可直接生成版”和“可调整参数”。\n\n{{subject}}`, 'configured', [
    { name: 'format', label: '输出格式', type: 'enum', enum: ['自然段落', '结构化字段'], default: '结构化字段' },
    { name: 'usage', label: '用途', type: 'enum', enum: ['单张图', '角色设定', '场景设定', '产品视觉', '连续分镜'], default: '单张图' },
  ]),
]
