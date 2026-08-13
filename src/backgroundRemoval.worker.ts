import { pipeline, RawImage, type ProgressInfo } from '@huggingface/transformers'

type StartMessage = { type: 'start'; source: string }

const workerScope = self as unknown as {
  postMessage: (message: unknown) => void
  onmessage: ((event: MessageEvent<StartMessage>) => void) | null
}

function report(stage: string, progress?: number, detail?: string) {
  workerScope.postMessage({ type: 'progress', stage, progress, detail })
}

workerScope.onmessage = async (event: MessageEvent<StartMessage>) => {
  if (event.data.type !== 'start') return
  try {
    report('正在准备本地抠图模型', 0)
    const segmenter = await pipeline('image-segmentation', 'studioludens/birefnet-lite-512', {
      device: 'wasm',
      progress_callback: (info: ProgressInfo) => {
        const value = 'progress' in info && typeof info.progress === 'number'
          ? Math.max(0, Math.min(100, info.progress))
          : undefined
        const file = 'file' in info && typeof info.file === 'string' ? info.file.split('/').pop() : undefined
        report(info.status === 'ready' ? '模型加载完成' : '正在下载并加载模型', value, file)
      },
    })
    report('正在自动识别主体', 100)
    const segments = await segmenter(event.data.source)
    const foreground = segments[0]
    if (!foreground?.mask) throw new Error('模型没有返回主体遮罩')
    report('正在生成透明 PNG', 100)
    const original = await RawImage.read(event.data.source)
    const mask = foreground.mask.width === original.width && foreground.mask.height === original.height
      ? foreground.mask
      : await foreground.mask.resize(original.width, original.height)
    const result = original.rgba().putAlpha(mask.grayscale())
    const blob = await result.toBlob('image/png') as Blob
    workerScope.postMessage({ type: 'complete', blob })
  } catch (error) {
    workerScope.postMessage({ type: 'error', message: error instanceof Error ? error.message : String(error) })
  }
}

export {}
