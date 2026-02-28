import * as React from 'react'
import { renderHook, act } from '@testing-library/react'
import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest'
import { useOutsideClickDismiss } from './use-outside-click-dismiss'

describe('useOutsideClickDismiss', () => {
  let rafCallback: FrameRequestCallback | null = null

  beforeEach(() => {
    rafCallback = null
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation((cb) => {
      rafCallback = cb
      return 1
    })
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(() => {
      rafCallback = null
    })
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not attach listener when closed', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const onClose = vi.fn()
    const ref = { current: document.createElement('div') }

    renderHook(() => useOutsideClickDismiss(false, onClose, [ref]))

    expect(addSpy).not.toHaveBeenCalledWith('pointerdown', expect.any(Function))
  })

  it('attaches listener after RAF when open', () => {
    const addSpy = vi.spyOn(document, 'addEventListener')
    const onClose = vi.fn()
    const ref = { current: document.createElement('div') }

    renderHook(() => useOutsideClickDismiss(true, onClose, [ref]))

    // Not yet attached — waiting for RAF
    expect(addSpy).not.toHaveBeenCalledWith('pointerdown', expect.any(Function))

    // Flush RAF
    act(() => { rafCallback?.(0) })

    expect(addSpy).toHaveBeenCalledWith('pointerdown', expect.any(Function))
  })

  it('does not fire onClose for inside click', () => {
    const onClose = vi.fn()
    const el = document.createElement('div')
    document.body.appendChild(el)
    const ref = { current: el }

    renderHook(() => useOutsideClickDismiss(true, onClose, [ref]))
    act(() => { rafCallback?.(0) })

    // Simulate pointer down inside the ref element
    const event = new PointerEvent('pointerdown', { bubbles: true, composed: true })
    Object.defineProperty(event, 'composedPath', {
      value: () => [el, document.body, document],
    })
    act(() => { document.dispatchEvent(event) })

    expect(onClose).not.toHaveBeenCalled()
    document.body.removeChild(el)
  })

  it('fires onClose for outside click', () => {
    const onClose = vi.fn()
    const el = document.createElement('div')
    const ref = { current: el }

    renderHook(() => useOutsideClickDismiss(true, onClose, [ref]))
    act(() => { rafCallback?.(0) })

    const event = new PointerEvent('pointerdown', { bubbles: true, composed: true })
    Object.defineProperty(event, 'composedPath', {
      value: () => [document.body, document],
    })
    act(() => { document.dispatchEvent(event) })

    expect(onClose).toHaveBeenCalledTimes(1)
  })

  it('cleans up on unmount', () => {
    const removeSpy = vi.spyOn(document, 'removeEventListener')
    const cancelSpy = vi.mocked(window.cancelAnimationFrame)
    const onClose = vi.fn()
    const ref = { current: document.createElement('div') }

    const { unmount } = renderHook(() => useOutsideClickDismiss(true, onClose, [ref]))
    unmount()

    // Either cancelAnimationFrame was called or removeEventListener was called
    const cleaned = cancelSpy.mock.calls.length > 0 ||
      removeSpy.mock.calls.some(([type]) => type === 'pointerdown')
    expect(cleaned).toBe(true)
  })
})
