import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { useGuidelines, getStoredGuidelines } from './use-guidelines'
import { useRulersVisible } from './rulers-overlay'

function dispatchPointerEvent(
  type: 'pointermove' | 'pointerup',
  coords: { x?: number; y?: number },
) {
  const event = new Event(type) as PointerEvent
  Object.defineProperty(event, 'clientX', { value: coords.x ?? 0 })
  Object.defineProperty(event, 'clientY', { value: coords.y ?? 0 })
  window.dispatchEvent(event)
}

function resetStorage() {
  const keys = [
    'direct-edit-guidelines',
    'direct-edit-rulers-visible',
  ]
  for (const key of keys) {
    try {
      localStorage.removeItem(key)
    } catch {
      // ignore storage access issues in test envs
    }
  }
}

describe('useGuidelines', () => {
  beforeEach(() => {
    resetStorage()
  })

  afterEach(() => {
    resetStorage()
    document.body.innerHTML = ''
  })

  it('creates, drags, and persists guidelines', async () => {
    const { result } = renderHook(() => useGuidelines(true))

    act(() => {
      result.current.startCreate('horizontal', 120)
    })

    expect(result.current.guidelines).toHaveLength(1)
    expect(result.current.guidelines[0].orientation).toBe('horizontal')
    expect(result.current.isCreating).toBe(true)
    expect(result.current.activeGuideline?.id).toBe(result.current.guidelines[0].id)

    act(() => {
      dispatchPointerEvent('pointermove', { y: 150 })
    })

    expect(result.current.dragPosition).toBe(150)
    expect(result.current.guidelines[0].position).toBe(150)

    act(() => {
      dispatchPointerEvent('pointerup', { y: 150 })
    })

    expect(result.current.activeGuideline).toBeNull()
    expect(result.current.isCreating).toBe(false)
    expect(result.current.dragPosition).toBeNull()

    await waitFor(() => {
      expect(getStoredGuidelines()).toHaveLength(1)
    })
  })

  it('deletes guideline when released inside ruler zone', () => {
    const { result } = renderHook(() => useGuidelines(true))

    act(() => {
      result.current.startCreate('vertical', 60)
    })

    expect(result.current.guidelines).toHaveLength(1)

    act(() => {
      dispatchPointerEvent('pointerup', { x: 10 })
    })

    expect(result.current.guidelines).toHaveLength(0)
    expect(result.current.activeGuideline).toBeNull()
  })

  it('can start dragging an existing guideline and update position', () => {
    localStorage.setItem(
      'direct-edit-guidelines',
      JSON.stringify([{ id: 'gl-1', orientation: 'vertical', position: 40 }]),
    )

    const { result } = renderHook(() => useGuidelines(true))

    expect(result.current.guidelines).toHaveLength(1)
    expect(result.current.guidelines[0].position).toBe(40)

    act(() => {
      result.current.startDrag('gl-1')
    })

    act(() => {
      dispatchPointerEvent('pointermove', { x: 85 })
    })

    expect(result.current.activeGuideline?.id).toBe('gl-1')
    expect(result.current.dragPosition).toBe(85)
    expect(result.current.guidelines[0].position).toBe(85)
  })

  it('deletes an existing guideline when dropped inside ruler zone', () => {
    localStorage.setItem(
      'direct-edit-guidelines',
      JSON.stringify([{ id: 'gl-2', orientation: 'horizontal', position: 80 }]),
    )

    const { result } = renderHook(() => useGuidelines(true))

    expect(result.current.guidelines).toHaveLength(1)

    act(() => {
      result.current.startDrag('gl-2')
    })

    act(() => {
      dispatchPointerEvent('pointerup', { y: 10 })
    })

    expect(result.current.guidelines).toHaveLength(0)
    expect(result.current.activeGuideline).toBeNull()
  })
})

describe('useRulersVisible', () => {
  beforeEach(() => {
    resetStorage()
  })

  it('syncs visibility across instances and persists the toggle', () => {
    const first = renderHook(() => useRulersVisible())
    const second = renderHook(() => useRulersVisible())

    expect(first.result.current[0]).toBe(true)
    expect(second.result.current[0]).toBe(true)

    act(() => {
      first.result.current[1]()
    })

    expect(first.result.current[0]).toBe(false)
    expect(second.result.current[0]).toBe(false)
    expect(localStorage.getItem('direct-edit-rulers-visible')).toBe('false')
  })

  it('reads initial visibility from localStorage', () => {
    localStorage.setItem('direct-edit-rulers-visible', 'false')
    const { result } = renderHook(() => useRulersVisible())
    expect(result.current[0]).toBe(false)
  })
})
