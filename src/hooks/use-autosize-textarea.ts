import * as React from 'react'

export function useAutosizeTextarea(
  ref: React.RefObject<HTMLTextAreaElement | null>,
  value: string,
  maxLines = 3,
) {
  React.useLayoutEffect(() => {
    const element = ref.current
    if (!element) return

    const computedStyle = window.getComputedStyle(element)
    const lineHeight = Number.parseFloat(computedStyle.lineHeight)
      || Number.parseFloat(computedStyle.fontSize) * 1.5
      || 18
    const paddingHeight = Number.parseFloat(computedStyle.paddingTop) + Number.parseFloat(computedStyle.paddingBottom)
    const borderHeight = Number.parseFloat(computedStyle.borderTopWidth) + Number.parseFloat(computedStyle.borderBottomWidth)
    const maxHeight = Math.ceil(lineHeight * maxLines + paddingHeight + borderHeight)

    element.style.height = '0px'
    const nextHeight = Math.min(element.scrollHeight, maxHeight)
    element.style.height = `${nextHeight}px`
    element.style.overflowY = element.scrollHeight > maxHeight ? 'auto' : 'hidden'
  }, [maxLines, ref, value])
}
