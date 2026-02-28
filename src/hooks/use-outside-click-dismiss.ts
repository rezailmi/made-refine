import { useEffect, useRef, type RefObject } from 'react'

/**
 * Dismisses a popover/overlay when the user clicks outside of it.
 * Uses `composedPath()` for Shadow DOM compatibility.
 * Delays the listener by one `requestAnimationFrame` to avoid
 * catching the opening click.
 */
export function useOutsideClickDismiss(
  isOpen: boolean,
  onClose: () => void,
  refs: RefObject<HTMLElement | null>[],
): void {
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  const refsRef = useRef(refs)
  refsRef.current = refs

  useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(e: PointerEvent) {
      const path = e.composedPath()
      for (const ref of refsRef.current) {
        if (ref.current && path.includes(ref.current)) return
      }
      onCloseRef.current()
    }

    const raf = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handlePointerDown)
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen])
}
