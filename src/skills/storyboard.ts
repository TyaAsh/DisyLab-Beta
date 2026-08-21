export type ComicLayout = 'spread' | 'vertical' | 'zigzag'
export type ComicStyle = '2d' | '3d' | 'hybrid'
export type ComicWorkflowStatus = 'content_review' | 'layout_pending' | 'composition_generating' | 'composition_review' | 'asset_generation' | 'completed'

export type ComicWorkflowState = {
  skillKey: string
  content: string
  layout?: ComicLayout
  style: ComicStyle
  aspectRatio: string
  status: ComicWorkflowStatus
  updatedAt: number
}

export const COMIC_LAYOUTS: Array<{ id: ComicLayout; name: string; detail: string }> = [
  { id: 'spread', name: 'A · 手册对开', detail: '双主区块对照，信息均衡，适合横向叙事。' },
  { id: 'vertical', name: 'B · 竖向长图', detail: '英雄格开场，向下连续阅读，适合社媒长图。' },
  { id: 'zigzag', name: 'C · 折线阅读', detail: '图文左右交替，节奏活跃，适合剧情转折。' },
]

export function buildCompositionPrompt(state: ComicWorkflowState) {
  const layout = COMIC_LAYOUTS.find((item) => item.id === state.layout)?.name ?? '自动布局'
  const style = state.style === '2d' ? '2D 插画' : state.style === '3d' ? '3D 渲染' : '2D+3D 混合风'
  return `${state.content}\n\n【已确认的漫画构图任务】\n切割骨架：${layout}\n版面风格：${style}\n画幅：${state.aspectRatio}\n生成一张完整的低成本构图粗稿。严格保持区块顺序，同一区块的小标签、正文和要点连续，不拆散、不重排、不添加数字编号。每格明确镜头、主体、情绪、场景与文字安全区；文字只用抽象占位，不生成可读正文。此阶段不得生成独立素材包。`
}

export function buildAssetPrompt(state: ComicWorkflowState) {
  return `${state.content}\n\n【已确认构图后的素材包任务】\n沿用已确认构图的角色、场景、镜头关系、${state.style === 'hybrid' ? '2D+3D 混合' : state.style.toUpperCase()}风格和 ${state.aspectRatio} 画幅。生成可复用素材包：角色/主体、关键表情与姿势、道具、纯场景和背景元素；保持结构与配色一致。不要生成最终排版、边框、数字编号、可读文字或水印，为后续可编辑文字层保留空间。`
}
