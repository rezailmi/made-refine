import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { useMeasurement } from './use-measurement'

// Mock elementFromPointWithoutOverlays — jsdom doesn't support elementFromPoint
vi.mock('./utils', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./utils')>()
  return {
    ...actual,
    elementFromPointWithoutOverlays: () => null,
  }
})

function keydown(key: string, options?: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, ...options }))
}

function keyup(key: string, options?: KeyboardEventInit) {
  window.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true, ...options }))
}

function makeElement(): HTMLElement {
  const el = document.createElement('div')
  const parent = document.createElement('div')
  parent.appendChild(el)
  document.body.appendChild(parent)
  return el
}

describe('useMeasurement', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    vi.useRealTimers()
  })

  it('is inactive when no element is provided', () => {
    const { result } = renderHook(() => useMeasurement(null))
    expect(result.current.isActive).toBe(false)
  })

  it('activates when Alt is held with a selected element', () => {
    const el = makeElement()
    const { result } = renderHook(() => useMeasurement(el))

    act(() => keydown('Alt'))

    expect(result.current.isActive).toBe(true)
  })

  it('deactivates when Alt is released', () => {
    const el = makeElement()
    const { result } = renderHook(() => useMeasurement(el))

    act(() => keydown('Alt'))
    expect(result.current.isActive).toBe(true)

    act(() => keyup('Alt'))
    expect(result.current.isActive).toBe(false)
  })

  it('does not activate for non-Alt keys', () => {
    const el = makeElement()
    const { result } = renderHook(() => useMeasurement(el))

    act(() => keydown('Shift'))

    expect(result.current.isActive).toBe(false)
  })

  it('uses capture phase for keydown/keyup listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const el = makeElement()
    renderHook(() => useMeasurement(el))

    const keydownCall = addSpy.mock.calls.find(([type]) => type === 'keydown')
    const keyupCall = addSpy.mock.calls.find(([type]) => type === 'keyup')
    expect(keydownCall?.[2]).toBe(true)
    expect(keyupCall?.[2]).toBe(true)
  })

  it('ignores transient blur immediately after Alt press', () => {
    vi.useFakeTimers()
    const el = makeElement()
    const { result } = renderHook(() => useMeasurement(el))

    act(() => {
      keydown('Alt')
      // Blur fires within the grace period (simulates macOS menu bar activation)
      window.dispatchEvent(new Event('blur'))
    })

    expect(result.current.isActive).toBe(true)
  })

  it('resets on blur that occurs after the grace period', () => {
    vi.useFakeTimers()
    const el = makeElement()
    const { result } = renderHook(() => useMeasurement(el))

    act(() => keydown('Alt'))
    expect(result.current.isActive).toBe(true)

    act(() => {
      vi.advanceTimersByTime(250)
      window.dispatchEvent(new Event('blur'))
    })

    expect(result.current.isActive).toBe(false)
  })

  it('resets on visibility change', () => {
    const el = makeElement()
    const { result } = renderHook(() => useMeasurement(el))

    act(() => keydown('Alt'))
    expect(result.current.isActive).toBe(true)

    act(() => {
      Object.defineProperty(document, 'hidden', { value: true, configurable: true })
      document.dispatchEvent(new Event('visibilitychange'))
    })

    expect(result.current.isActive).toBe(false)

    // Restore
    Object.defineProperty(document, 'hidden', { value: false, configurable: true })
  })

  it('cleans up listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const el = makeElement()
    const { unmount } = renderHook(() => useMeasurement(el))
    unmount()

    const types = removeSpy.mock.calls.map(([type]) => type)
    expect(types).toContain('keydown')
    expect(types).toContain('keyup')
    expect(types).toContain('blur')
  })
})
