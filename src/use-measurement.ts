import * as React from 'react'
import type { MeasurementLine } from './types'
import { calculateParentMeasurements, calculateElementMeasurements } from './utils'

interface UseMeasurementResult {
  isActive: boolean
  hoveredElement: HTMLElement | null
  measurements: MeasurementLine[]
}

const INITIAL_STATE = {
  hoveredElement: null as HTMLElement | null,
  measurements: [] as MeasurementLine[],
}

export function useMeasurement(selectedElement: HTMLElement | null): UseMeasurementResult {
  const [altHeld, setAltHeld] = React.useState(false)
  const [state, setState] = React.useState(INITIAL_STATE)
  const rafRef = React.useRef<number | null>(null)
  const mousePositionRef = React.useRef<{ x: number; y: number } | null>(null)

  const getElementBelow = React.useCallback((x: number, y: number): HTMLElement | null => {
    const overlays = document.querySelectorAll<HTMLElement>('[data-direct-edit]')

    overlays.forEach((el) => (el.style.pointerEvents = 'none'))
    const element = document.elementFromPoint(x, y) as HTMLElement | null
    overlays.forEach((el) => (el.style.pointerEvents = ''))

    if (element?.closest('[data-direct-edit]')) return null
    return element
  }, [])

  React.useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Alt') {
        e.preventDefault()
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

    function handleVisibilityChange() {
      if (document.hidden) reset()
    }

    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    window.addEventListener('blur', reset)
    document.addEventListener('visibilitychange', handleVisibilityChange)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
      window.removeEventListener('blur', reset)
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
        setState({
          hoveredElement: element,
          measurements: calculateElementMeasurements(target, element),
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
  }
}
