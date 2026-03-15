function tryRestoreFocus(element: Element | null) {
  if (!(element instanceof HTMLElement)) return
  try {
    element.focus({ preventScroll: true })
  } catch {
    try {
      element.focus()
    } catch {}
  }
}

export async function copyText(text: string): Promise<boolean> {
  const nav = (globalThis as { navigator?: Navigator }).navigator
  const clipboard = nav?.clipboard
  const clipboardWrite = clipboard?.writeText
  if (typeof clipboardWrite === 'function') {
    try {
      await clipboardWrite.call(clipboard, text)
      return true
    } catch {}
  }

  if (typeof document === 'undefined') return false
  if (typeof document.execCommand !== 'function') return false
  const body = document.body
  if (!body) return false

  const activeElement = document.activeElement
  const selection = typeof window !== 'undefined' ? window.getSelection() : null
  const previousRange = selection && selection.rangeCount > 0
    ? selection.getRangeAt(0).cloneRange()
    : null

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.top = '0'
  textarea.style.left = '0'
  textarea.style.width = '1px'
  textarea.style.height = '1px'
  textarea.style.opacity = '0'
  textarea.style.pointerEvents = 'none'
  body.appendChild(textarea)

  let copied = false
  try {
    try {
      textarea.focus({ preventScroll: true })
    } catch {
      textarea.focus()
    }
    textarea.select()
    textarea.setSelectionRange(0, textarea.value.length)
    copied = document.execCommand('copy')
  } catch {
    copied = false
  } finally {
    textarea.remove()
    if (selection) {
      selection.removeAllRanges()
      if (previousRange) {
        selection.addRange(previousRange)
      }
    }
    tryRestoreFocus(activeElement)
  }

  return copied
}
