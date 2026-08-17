/*! Copyright (c) 2026 DisyLab. All rights reserved. */
import { ChevronDown, Crosshair, Download, Layers3, MessageCircle, Pause, Play, RefreshCw, Upload } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { buildAnimatedSvg, buildStaticSvg, DEFAULT_SVG_MOTION, downloadAnimatedSvg, getSvgMotionLayers, sanitizeSvgSource, SVG_MOTION_EASINGS, SVG_MOTION_PRESETS, svgToDataUrl, type SvgMotionSettings } from './svgMotion'

type Props = { title: string; sourceSvg?: string; sourceName?: string; settings?: SvgMotionSettings; onChange: (patch: { sourceSvg?: string; sourceName?: string; settings?: SvgMotionSettings }) => void; onNotice: (message: string) => void }
const ANCHORS = [0, 50, 100]

export default function SvgMotionNode({ title, sourceSvg, sourceName, settings: storedSettings, onChange, onNotice }: Props) {
  const settings = useMemo(() => ({ ...DEFAULT_SVG_MOTION, ...storedSettings }), [storedSettings])
  const [playing, setPlaying] = useState(true)
  const [previewKey, setPreviewKey] = useState(0)
  const [playhead, setPlayhead] = useState(0)
  const [instruction, setInstruction] = useState('')
  const [layerMenuOpen, setLayerMenuOpen] = useState(false)
  const layers = useMemo(() => getSvgMotionLayers(sourceSvg), [sourceSvg])
  const animatedSvg = useMemo(() => buildAnimatedSvg(sourceSvg, settings), [sourceSvg, settings])
  const previewUrl = useMemo(() => svgToDataUrl(playing ? animatedSvg : buildStaticSvg(sourceSvg)), [animatedSvg, playing, previewKey, sourceSvg])
  const totalMs = settings.durationMs + settings.delayMs
  const updateSettings = (patch: Partial<SvgMotionSettings>) => onChange({ settings: { ...settings, ...patch } })

  useEffect(() => {
    if (!playing) return
    const startedAt = performance.now()
    let frame = 0
    const tick = (now: number) => {
      const elapsed = now - startedAt
      setPlayhead(settings.loop ? elapsed % Math.max(1, totalMs) : Math.min(elapsed, totalMs))
      if (settings.loop || elapsed < totalMs) frame = requestAnimationFrame(tick)
    }
    frame = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(frame)
  }, [playing, previewKey, settings.loop, totalMs])

  const restart = () => { setPlaying(true); setPlayhead(0); setPreviewKey((value) => value + 1) }
  const importSvg = async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.svg') && file.type !== 'image/svg+xml') return onNotice('请选择 SVG 文件')
    if (file.size > 2_000_000) return onNotice('SVG 文件请控制在 2MB 以内')
    try {
      const safe = sanitizeSvgSource(await file.text())
      onChange({ sourceSvg: safe, sourceName: file.name, settings: { ...settings, targetLayerId: 'all' } })
      restart(); onNotice('SVG 已导入，已识别可动画图层')
    } catch (error) { onNotice(error instanceof Error ? error.message : 'SVG 导入失败') }
  }

  const applyInstruction = () => {
    const text = instruction.trim(); if (!text) return
    const patch: Partial<SvgMotionSettings> = {}
    if (/呼吸/.test(text)) patch.preset = 'breathe'; else if (/弹|跳/.test(text)) patch.preset = 'bounce'; else if (/漂浮|浮动|悬浮/.test(text)) patch.preset = 'float'; else if (/旋转|转圈/.test(text)) patch.preset = 'spin'; else if (/描边|写出|画出/.test(text)) patch.preset = 'draw'
    if (/慢一点|更慢/.test(text)) patch.durationMs = Math.min(6000, Math.round(settings.durationMs * 1.3 / 100) * 100)
    if (/快一点|更快/.test(text)) patch.durationMs = Math.max(400, Math.round(settings.durationMs * .75 / 100) * 100)
    if (/轻微|小一点|弱一点/.test(text)) patch.amplitude = Math.max(2, Math.round(settings.amplitude * .65))
    if (/明显|大一点|强一点/.test(text)) patch.amplitude = Math.min(60, Math.round(settings.amplitude * 1.45))
    if (/不要循环|只播一次|不循环/.test(text)) patch.loop = false; else if (/循环|一直/.test(text)) patch.loop = true
    const seconds = text.match(/(\d+(?:\.\d+)?)\s*秒/); if (seconds) patch.durationMs = Math.max(400, Math.min(6000, Number(seconds[1]) * 1000))
    if (!Object.keys(patch).length) return onNotice('暂未识别，可试试“呼吸慢一点，幅度轻微并循环”')
    updateSettings(patch); setInstruction(''); restart(); onNotice('文字指令已应用到当前动效')
  }

  return <div className="svg-motion-node-body nodrag nowheel">
    <div className={`svg-motion-preview ${playing ? '' : 'is-paused'}`}><img key={previewKey} src={previewUrl} alt={`${title} 动效预览`} draggable={false} /><div className="svg-motion-preview-actions"><button type="button" title={playing ? '暂停' : '播放'} onClick={() => setPlaying((value) => !value)}>{playing ? <Pause size={13} /> : <Play size={13} />}</button><button type="button" title="重新播放" onClick={restart}><RefreshCw size={13} /></button><button type="button" title="下载 SVG" onClick={() => void downloadAnimatedSvg(animatedSvg, sourceName?.replace(/\.svg$/i, '-animated.svg') || `${title || 'disy-motion'}.svg`)}><Download size={13} /></button></div></div>
    <div className="svg-motion-timeline"><div><span>00:00</span><i style={{ width: `${Math.min(100, settings.delayMs / Math.max(1, totalMs) * 100)}%` }} /><b style={{ left: `${Math.min(100, playhead / Math.max(1, totalMs) * 100)}%` }} /><span>{(totalMs / 1000).toFixed(1)}s</span></div><label><span>延迟</span><input type="range" min="0" max="2000" step="100" value={settings.delayMs} onChange={(event) => updateSettings({ delayMs: Number(event.target.value) })} /><b>{(settings.delayMs / 1000).toFixed(1)}s</b></label></div>
    <div className="svg-motion-presets" aria-label="动效预设">{SVG_MOTION_PRESETS.map((preset) => <button type="button" key={preset.value} className={settings.preset === preset.value ? 'is-active' : ''} title={preset.description} onClick={() => { updateSettings({ preset: preset.value }); restart() }}>{preset.label}</button>)}</div>
    <div className="svg-motion-layer-tools"><div className="svg-motion-select"><button type="button" className={layerMenuOpen ? 'is-open' : ''} onClick={() => setLayerMenuOpen((open) => !open)}><Layers3 size={12} /><span>{settings.targetLayerId === 'all' ? '全部图层' : layers.find((layer) => layer.id === settings.targetLayerId)?.name || '全部图层'}</span><ChevronDown size={12} /></button>{layerMenuOpen && <div className="svg-motion-select-menu"><button type="button" className={settings.targetLayerId === 'all' ? 'is-selected' : ''} onClick={() => { updateSettings({ targetLayerId: 'all' }); setLayerMenuOpen(false) }}><span>全部图层</span><small>整体动画</small></button>{layers.map((layer) => <button type="button" key={layer.id} className={settings.targetLayerId === layer.id ? 'is-selected' : ''} onClick={() => { updateSettings({ targetLayerId: layer.id }); setLayerMenuOpen(false) }}><span>{layer.name}</span><small>{layer.tag}</small></button>)}</div>}</div><div className="svg-motion-anchor"><span><Crosshair size={11} />锚点</span><div>{ANCHORS.flatMap((y) => ANCHORS.map((x) => <button type="button" key={`${x}-${y}`} aria-label={`锚点 ${x} ${y}`} className={settings.anchorX === x && settings.anchorY === y ? 'is-active' : ''} onClick={() => updateSettings({ anchorX: x, anchorY: y })} />))}</div></div></div>
    <div className="svg-motion-controls"><label><span>时长 <b>{(settings.durationMs / 1000).toFixed(1)}s</b></span><input type="range" min="400" max="6000" step="100" value={settings.durationMs} onChange={(event) => updateSettings({ durationMs: Number(event.target.value) })} /></label><label><span>幅度 <b>{settings.amplitude}</b></span><input type="range" min="2" max="60" step="1" value={settings.amplitude} onChange={(event) => updateSettings({ amplitude: Number(event.target.value) })} /></label><div className="svg-motion-easing-row"><span>曲线</span><div className="svg-motion-easing-chips">{SVG_MOTION_EASINGS.map((item) => <button type="button" key={item.value} className={settings.easing === item.value ? 'is-active' : ''} title={item.curve === 'linear' ? '匀速运动' : '贝塞尔曲线'} onClick={() => updateSettings({ easing: item.value as SvgMotionSettings['easing'] })}>{item.label}</button>)}</div></div><div className="svg-motion-row svg-motion-actions-row"><label className="svg-motion-loop"><input type="checkbox" checked={settings.loop} onChange={(event) => updateSettings({ loop: event.target.checked })} />循环</label><label className="svg-motion-upload"><Upload size={12} />换 SVG<input type="file" accept="image/svg+xml,.svg" onChange={(event) => { const file = event.target.files?.[0]; if (file) void importSvg(file); event.target.value = '' }} /></label></div></div>
    <div className="svg-motion-instruction"><MessageCircle size={13} /><input value={instruction} placeholder="例如：呼吸慢一点，幅度轻微并循环" onChange={(event) => setInstruction(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') applyInstruction() }} /><button type="button" onClick={applyInstruction}>应用</button></div>
  </div>
}
