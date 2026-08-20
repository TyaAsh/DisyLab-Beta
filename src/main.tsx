/*!
 * Copyright (c) 2026 DisyLab. All rights reserved.
 * Proprietary source-available software under LicenseRef-DisyLab-Proprietary.
 * Unauthorized commercial use, redistribution, white-labeling, relicensing,
 * or removal of this copyright notice is prohibited.
 * Repository: https://github.com/TyaAsh/DisyLab-Canvas
 * SPDX-FileCopyrightText: 2026 DisyLab
 * SPDX-License-Identifier: LicenseRef-DisyLab-Proprietary
 */
import { Component, StrictMode, type ErrorInfo, type ReactNode } from 'react'
import { createRoot } from 'react-dom/client'
import { ReactFlowProvider } from '@xyflow/react'
import App from './App'
import { installProductionSourceShield } from './sourceShield'
import './styles.css'
import './theme-custom.css'

// Chromium can emit this benign layout warning while React Flow measures a
// rapidly changing canvas. Vite treats window errors as fatal HMR overlays,
// which turns a recoverable warning into a full-screen black error layer.
window.addEventListener('error', (event) => {
  const message = event.message || (event.error instanceof Error ? event.error.message : '')
  if (/ResizeObserver loop (completed with undelivered notifications|limit exceeded)/i.test(message)) {
    event.preventDefault()
    event.stopImmediatePropagation()
  }
}, true)

installProductionSourceShield()

class AppErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('DisyLab render failed', error, info)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <main className="app-crash-fallback">
        <strong>DisyLab 加载失败</strong>
        <span>页面运行时遇到异常，请重新加载后继续。</span>
        <button type="button" onClick={() => window.location.reload()}>重新加载</button>
      </main>
    )
  }
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <ReactFlowProvider>
        <App />
      </ReactFlowProvider>
    </AppErrorBoundary>
  </StrictMode>,
)
