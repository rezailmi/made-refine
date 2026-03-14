import * as React from 'react'
import type { MeasurementLine } from './types'
import { calculateParentMeasurements, calculateElementMeasurements, elementFromPointWithoutOverlays } from './utils'

export interface UseMeasurementResult {
  isActive: boolean
  hoveredElement: HTMLElement | null
  measurements: MeasurementLine[]
  mousePosition: { x: number; y: number } | null
}

const INITIAL_STATE = {
  hoveredElement: null as HTMLElement | null,
  measurements: [] as MeasurementLine[],
}

export function useMeasurement(selectedElement: HTMLElement | null): UseMeasurementResult {
  const [altHeld, setAltHeld] = React.useState(false)
  const [state, setState] = React.useState(INITIAL_STATE)
  const [mousePosition, setMousePosition] = React.useState<{ x: number; y: number } | null>(null)
  const rafRef = React.useRef<number | null>(null)
  const mousePositionRef = React.useRef<{ x: number; y: number } | null>(null)
  const altPressedAtRef = React.useRef(0)

  const getElementBelow = React.useCallback((x: number, y: number): HTMLElement | null => {
    const element = elementFromPointWithoutOverlays(x, y)
    if (element?.closest('[data-direct-edit-host]')) return null
    return element
  }, [])

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Alt') {
        e.preventDefault()
        altPressedAtRef.current = Date.now()
        setAltHeld(true)
      }
    }

    function handleKeyUp(e: KeyboardEvent) {
      if (e.key === 'Alt') {
        setAltHeld(false)
        setState(INITIAL_STATE)
      }
    }

    function reset() {
      setAltHeld(false)
      setState(INITIAL_STATE)
    }

    function handleBlur() {
      // On macOS, pressing Option/Alt can briefly activate the browser menu bar,
      // causing a transient blur event that would incorrectly reset the state.
      if (Date.now() - altPressedAtRef.current < 200) return
      reset()
    }

    function handleVisibilityChange() {
      if (document.hidden) reset()
    }

    // Capture phase so the handler fires before any stopPropagation() in
    // the host app (e.g. Tauri webview), consistent with other keyboard
    // listeners in the codebase.
    window.addEventListener('keydown', handleKeyDown, true)
    window.addEventListener('keyup', handleKeyUp, true)
    window.addEventListener('blur', handleBlur)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('keydown', handleKeyDown, true)
      window.removeEventListener('keyup', handleKeyUp, true)
      window.removeEventListener('blur', handleBlur)
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [])

  React.useEffect(() => {
    if (!altHeld || !selectedElement) {
      setState(INITIAL_STATE)
      return
    }

    const target = selectedElement

    function updateMeasurements() {
      const pos = mousePositionRef.current

      if (!pos) {
        setState({
          hoveredElement: null,
          measurements: calculateParentMeasurements(target),
        })
        return
      }

      const element = getElementBelow(pos.x, pos.y)
      const isValidHover =
        element &&
        element !== target &&
        element !== document.body &&
        element !== document.documentElement

      if (isValidHover) {
        const isAncestor = element.contains(target)
        setState({
          hoveredElement: element,
          measurements: isAncestor
            ? calculateParentMeasurements(target, element)
            : calculateElementMeasurements(target, element),
        })
      } else {
        setState({
          hoveredElement: null,
          measurements: calculateParentMeasurements(target),
        })
      }
    }

    function handleMouseMove(e: MouseEvent) {
      mousePositionRef.current = { x: e.clientX, y: e.clientY }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }

      rafRef.current = requestAnimationFrame(() => {
        setMousePosition(mousePositionRef.current)
        updateMeasurements()
        rafRef.current = null
      })
    }

    updateMeasurements()
    window.addEventListener('mousemove', handleMouseMove)

    return () => {
      window.removeEventListener('mousemove', handleMouseMove)
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current)
      }
    }
  }, [altHeld, selectedElement, getElementBelow])

  return {
    isActive: altHeld && selectedElement !== null,
    hoveredElement: state.hoveredElement,
    measurements: state.measurements,
    mousePosition: altHeld ? mousePosition : null,
  }
}
