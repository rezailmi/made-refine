import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, afterEach } from 'vitest'
import { useViewportEvents } from './use-viewport-events'

describe('useViewportEvents', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('calls callback immediately on mount', () => {
    const callback = vi.fn()
    renderHook(() => useViewportEvents(callback))
    expect(callback).toHaveBeenCalledTimes(1)
  })

  it('attaches scroll, resize, and canvas-change listeners', () => {
    const addSpy = vi.spyOn(window, 'addEventListener')
    const callback = vi.fn()
    renderHook(() => useViewportEvents(callback))

    const calls = addSpy.mock.calls
    expect(calls.some(([type]) => type === 'scroll')).toBe(true)
    expect(calls.some(([type]) => type === 'resize')).toBe(true)
    expect(calls.some(([type]) => type === 'direct-edit-canvas-change')).toBe(true)
  })

  it('removes all listeners on unmount', () => {
    const removeSpy = vi.spyOn(window, 'removeEventListener')
    const callback = vi.fn()
    const { unmount } = renderHook(() => useViewportEvents(callback))
    unmount()

    const calls = removeSpy.mock.calls
    expect(calls.some(([type]) => type === 'scroll')).toBe(true)
    expect(calls.some(([type]) => type === 'resize')).toBe(true)
    expect(calls.some(([type]) => type === 'direct-edit-canvas-change')).toBe(true)
  })

  it('calls the latest callback on scroll', () => {
    const callback1 = vi.fn()
    const callback2 = vi.fn()
    const { rerender } = renderHook(
      ({ cb }) => useViewportEvents(cb),
      { initialProps: { cb: callback1 } },
    )

    callback1.mockClear()
    rerender({ cb: callback2 })

    act(() => {
      window.dispatchEvent(new Event('scroll'))
    })

    expect(callback2).toHaveBeenCalled()
    expect(callback1).not.toHaveBeenCalled()
  })
})
