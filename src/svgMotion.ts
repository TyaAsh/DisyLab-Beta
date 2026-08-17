/*! Copyright (c) 2026 DisyLab. All rights reserved. */
import disyLogoLightSvg from './assets/disy-logo-light.svg?raw'

export type SvgMotionPreset = 'breathe' | 'bounce' | 'float' | 'spin' | 'draw'
export type SvgMotionEasing = 'soft' | 'snappy' | 'spring' | 'linear'

export type SvgMotionSettings = {
  preset: SvgMotionPreset
  durationMs: number
  delayMs: number
  amplitude: number
  easing: SvgMotionEasing
  loop: boolean
  targetLayerId: string
  anchorX: number
  anchorY: number
}

export type SvgMotionLayer = { id: string; name: string; tag: string }

export const DEFAULT_SVG_MOTION: SvgMotionSettings = {
  preset: 'breathe',
  durationMs: 1800,
  delayMs: 0,
  amplitude: 12,
  easing: 'soft',
  loop: true,
  targetLayerId: 'all',
  anchorX: 50,
  anchorY: 50,
}

export const SVG_MOTION_PRESETS: Array<{ value: SvgMotionPreset; label: string; description: string }> = [
  { value: 'breathe', label: '呼吸', description: '适合角色待机与品牌标志' },
  { value: 'bounce', label: '弹跳', description: '适合按钮反馈与强调' },
  { value: 'float', label: '漂浮', description: '适合角色、贴纸与图标' },
  { value: 'spin', label: '旋转', description: '适合加载、光环与徽章' },
  { value: 'draw', label: '描边', description: '适合 Logo 与线稿出现' },
]

export const SVG_MOTION_EASINGS: Array<{ value: SvgMotionEasing; label: string; curve: string }> = [
  { value: 'soft', label: '柔和', curve: 'cubic-bezier(.22,1,.36,1)' },
  { value: 'snappy', label: '利落', curve: 'cubic-bezier(.16,1,.3,1)' },
  { value: 'spring', label: '微弹', curve: 'cubic-bezier(.34,1.56,.64,1)' },
  { value: 'linear', label: '匀速', curve: 'linear' },
]

const SAMPLE_SVG = disyLogoLightSvg
  .replace(/(<svg\b[^>]*>)/i, '$1<g id="disylab-brand" aria-label="DisyLab Logo">')
  .replace(/<\/svg>\s*$/i, '</g></svg>')

export function sanitizeSvgSource(source: string) {
  const parser = new DOMParser()
  const documentNode = parser.parseFromString(source, 'image/svg+xml')
  const root = documentNode.documentElement
  if (root.nodeName.toLowerCase() !== 'svg' || documentNode.querySelector('parsererror')) throw new Error('不是有效的 SVG 文件')
  root.querySelectorAll('script,foreignObject,iframe,object,embed,audio,video').forEach((node) => node.remove())
  root.querySelectorAll('*').forEach((element) => {
    Array.from(element.attributes).forEach((attribute) => {
      const name = attribute.name.toLowerCase()
      const value = attribute.value.trim()
      if (name.startsWith('on') || ((name === 'href' || name === 'xlink:href') && !value.startsWith('#') && !value.startsWith('/') && !value.startsWith('data:image/'))) {
        element.removeAttribute(attribute.name)
      }
    })
  })
  Array.from(root.children)
    .filter((element) => !['defs', 'style', 'title', 'desc', 'metadata'].includes(element.tagName.toLowerCase()))
    .forEach((element, index) => {
      const currentId = element.getAttribute('data-disy-layer') || element.getAttribute('id') || `layer-${index + 1}`
      element.setAttribute('data-disy-layer', currentId.replace(/[^a-zA-Z0-9_-]/g, '-'))
    })
  root.removeAttribute('width')
  root.removeAttribute('height')
  root.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
  return new XMLSerializer().serializeToString(root)
}

export function getSvgMotionLayers(source?: string): SvgMotionLayer[] {
  const safe = sanitizeSvgSource(source || SAMPLE_SVG)
  const root = new DOMParser().parseFromString(safe, 'image/svg+xml').documentElement
  return Array.from(root.children)
    .filter((element) => !['defs', 'style', 'title', 'desc', 'metadata'].includes(element.tagName.toLowerCase()))
    .map((element, index) => ({
      id: element.getAttribute('data-disy-layer') || `layer-${index + 1}`,
      name: element.getAttribute('aria-label') || element.getAttribute('data-name') || element.getAttribute('id') || `图层 ${index + 1}`,
      tag: element.tagName.toLowerCase(),
    }))
}

function splitSvg(source: string) {
  const safe = sanitizeSvgSource(source || SAMPLE_SVG)
  const documentNode = new DOMParser().parseFromString(safe, 'image/svg+xml')
  const root = documentNode.documentElement
  const viewBox = root.getAttribute('viewBox') || '0 0 512 512'
  const content = Array.from(root.childNodes).map((node) => new XMLSerializer().serializeToString(node)).join('')
  return { viewBox, content }
}

function motionCss(settings: SvgMotionSettings) {
  const duration = Math.max(240, Math.min(12000, settings.durationMs))
  const amplitude = Math.max(1, Math.min(100, settings.amplitude))
  const ease = SVG_MOTION_EASINGS.find((item) => item.value === settings.easing)?.curve ?? SVG_MOTION_EASINGS[0].curve
  const iteration = settings.loop ? 'infinite' : '1'
  const selector = settings.targetLayerId && settings.targetLayerId !== 'all'
    ? `#motion-target [data-disy-layer="${settings.targetLayerId.replace(/[^a-zA-Z0-9_-]/g, '-')}"]`
    : '#motion-target'
  const common = `transform-box:fill-box;transform-origin:${settings.anchorX}% ${settings.anchorY}%;animation-duration:${duration}ms;animation-delay:${Math.max(0, settings.delayMs)}ms;animation-timing-function:${ease};animation-iteration-count:${iteration};animation-fill-mode:both;`
  if (settings.preset === 'breathe') return `${selector}{${common}animation-name:disy-breathe}@keyframes disy-breathe{0%,100%{transform:scale(1)}50%{transform:scale(${1 + amplitude / 500})}}`
  if (settings.preset === 'bounce') return `${selector}{${common}animation-name:disy-bounce}@keyframes disy-bounce{0%,100%{transform:translateY(0) scale(1)}38%{transform:translateY(-${amplitude}px) scale(1.03,.97)}58%{transform:translateY(0) scale(.98,1.02)}76%{transform:translateY(-${amplitude * .22}px) scale(1)}}`
  if (settings.preset === 'float') return `${selector}{${common}animation-name:disy-float}@keyframes disy-float{0%,100%{transform:translateY(0) rotate(-${amplitude / 12}deg)}50%{transform:translateY(-${amplitude}px) rotate(${amplitude / 12}deg)}}`
  if (settings.preset === 'spin') return `${selector}{${common}animation-name:disy-spin}@keyframes disy-spin{from{transform:rotate(0)}to{transform:rotate(360deg)}}`
  return `${selector} path,${selector} line,${selector} circle,${selector} rect,${selector} polyline,${selector} polygon{stroke-dasharray:1200;stroke-dashoffset:1200;animation:disy-draw ${duration}ms ${ease} ${Math.max(0, settings.delayMs)}ms ${iteration} both}@keyframes disy-draw{0%{stroke-dashoffset:1200;opacity:.18}65%,100%{stroke-dashoffset:0;opacity:1}}`
}

export function buildAnimatedSvg(source: string | undefined, settings: SvgMotionSettings) {
  const { viewBox, content } = splitSvg(source || SAMPLE_SVG)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="512" height="512"><style>${motionCss(settings)}@media (prefers-reduced-motion:reduce){#motion-target,#motion-target *{animation:none!important}}</style><g id="motion-target">${content}</g></svg>`
}

export function buildStaticSvg(source?: string) {
  const { viewBox, content } = splitSvg(source || SAMPLE_SVG)
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}" width="512" height="512">${content}</svg>`
}

export function svgToDataUrl(svg: string) {
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

function blobToDataUrl(blob: Blob) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export async function downloadAnimatedSvg(svg: string, fileName: string) {
  const documentNode = new DOMParser().parseFromString(svg, 'image/svg+xml')
  const localImages = Array.from(documentNode.querySelectorAll('image')).filter((image) => (image.getAttribute('href') || '').startsWith('/'))
  await Promise.all(localImages.map(async (image) => {
    const href = image.getAttribute('href'); if (!href) return
    const response = await fetch(href); if (!response.ok) return
    image.setAttribute('href', await blobToDataUrl(await response.blob()))
  }))
  const portableSvg = new XMLSerializer().serializeToString(documentNode.documentElement)
  const blob = new Blob([portableSvg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = fileName.toLowerCase().endsWith('.svg') ? fileName : `${fileName}.svg`
  anchor.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
