import { useCallback, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { AlertTriangle, Info, X } from 'lucide-react'

type DialogOptions = {
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
}

type DialogState = DialogOptions & { mode: 'confirm' | 'alert' }

export function useProjectDialog() {
  const [dialog, setDialog] = useState<DialogState | null>(null)
  const resolverRef = useRef<((value: boolean) => void) | null>(null)

  const settle = useCallback((value: boolean) => {
    resolverRef.current?.(value)
    resolverRef.current = null
    setDialog(null)
  }, [])

  const confirm = useCallback((options: DialogOptions) => new Promise<boolean>((resolve) => {
    resolverRef.current?.(false)
    resolverRef.current = resolve
    setDialog({ ...options, mode: 'confirm' })
  }), [])

  const alert = useCallback((options: Omit<DialogOptions, 'cancelLabel'>) => new Promise<void>((resolve) => {
    resolverRef.current?.(false)
    resolverRef.current = () => resolve()
    setDialog({ ...options, mode: 'alert' })
  }), [])

  const dialogNode = <AnimatePresence>
    {dialog && <motion.div className="project-dialog-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => settle(false)}>
      <motion.section role="dialog" aria-modal="true" aria-labelledby="project-dialog-title" className={`project-dialog ${dialog.danger ? 'is-danger' : ''}`} initial={{ opacity: 0, y: 12, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 8, scale: .985 }} onClick={(event) => event.stopPropagation()}>
        <header>
          <span>{dialog.danger ? <AlertTriangle size={17} /> : <Info size={17} />}</span>
          <button type="button" aria-label="关闭" onClick={() => settle(false)}><X size={16} /></button>
        </header>
        <h3 id="project-dialog-title">{dialog.title}</h3>
        <p>{dialog.message}</p>
        <footer>
          {dialog.mode === 'confirm' && <button type="button" onClick={() => settle(false)}>{dialog.cancelLabel ?? '取消'}</button>}
          <button type="button" className={dialog.danger ? 'is-danger' : 'is-primary'} onClick={() => settle(true)}>{dialog.confirmLabel ?? (dialog.mode === 'alert' ? '知道了' : '确认')}</button>
        </footer>
      </motion.section>
    </motion.div>}
  </AnimatePresence>

  return { confirm, alert, dialogNode }
}
