import { useEffect, useRef } from 'react'

/**
 * Listens for scroll/resize/canvas-change on window.
 * Callers must trigger their own update when observed data changes
 * (e.g., when the target element changes). To conditionally skip
 * updates, guard inside the callback.
 */
export function useViewportEvents(callback: () => void): void {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  useEffect(() => {
    const handler = () => callbackRef.current()

    handler()

    window.addEventListener('scroll', handler, true)
    window.addEventListener('resize', handler)
    window.addEventListener('direct-edit-canvas-change', handler)

    return () => {
      window.removeEventListener('scroll', handler, true)
      window.removeEventListener('resize', handler)
      window.removeEventListener('direct-edit-canvas-change', handler)
    }
  }, [])
}
