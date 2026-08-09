/**
 * Production-only deterrents against casual source peeking / copying.
 * This cannot stop a determined user with DevTools — it only raises friction.
 */

export function installProductionSourceShield() {
  if (!import.meta.env.PROD) return

  const block = (event: Event) => {
    event.preventDefault()
  }

  document.addEventListener('contextmenu', block, { capture: true })
  document.addEventListener('dragstart', block, { capture: true })

  document.addEventListener(
    'keydown',
    (event) => {
      const key = event.key.toLowerCase()
      const withMod = event.ctrlKey || event.metaKey
      const isViewSource = withMod && key === 'u'
      const isSave = withMod && key === 's'
      const isDevtools = (event.ctrlKey && event.shiftKey && (key === 'i' || key === 'j' || key === 'c'))
        || key === 'f12'
      const isSelectAllOnRoot = withMod && key === 'a' && event.target === document.body
      if (isViewSource || isSave || isDevtools || isSelectAllOnRoot) {
        event.preventDefault()
        event.stopPropagation()
      }
    },
    { capture: true },
  )

  // Discourage selecting minified asset text from accidental drag on chrome chrome.
  document.documentElement.style.setProperty('-webkit-user-select', 'none')
  document.documentElement.style.setProperty('user-select', 'none')
  const style = document.createElement('style')
  style.textContent = 'input, textarea, [contenteditable="true"], .allow-text-select { -webkit-user-select: text !important; user-select: text !important; }'
  document.head.appendChild(style)
}
