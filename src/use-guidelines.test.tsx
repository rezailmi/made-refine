import { act, renderHook, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    vi.restoreAllMocks()
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

  it('can start dragging an existing guideline and update position', async () => {
    localStorage.setItem(
      'direct-edit-guidelines',
      JSON.stringify([{ id: 'gl-1', orientation: 'vertical', position: 40 }]),
    )

    const { result } = renderHook(() => useGuidelines(true))

    await waitFor(() => {
      expect(result.current.guidelines).toHaveLength(1)
    })
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

  it('deletes an existing guideline when dropped inside ruler zone', async () => {
    localStorage.setItem(
      'direct-edit-guidelines',
      JSON.stringify([{ id: 'gl-2', orientation: 'horizontal', position: 80 }]),
    )

    const { result } = renderHook(() => useGuidelines(true))

    await waitFor(() => {
      expect(result.current.guidelines).toHaveLength(1)
    })

    act(() => {
      result.current.startDrag('gl-2')
    })

    act(() => {
      dispatchPointerEvent('pointerup', { y: 10 })
    })

    expect(result.current.guidelines).toHaveLength(0)
    expect(result.current.activeGuideline).toBeNull()
  })

  it('does not write an empty snapshot before hydration completes', async () => {
    const stored = [{ id: 'gl-hydrate', orientation: 'vertical', position: 42 }]
    const store = new Map<string, string>()
    const writes: Array<[string, string]> = []
    const storageMock: Storage = {
      getItem: (key) => store.get(key) ?? null,
      setItem: (key, value) => {
        const serialized = String(value)
        writes.push([key, serialized])
        store.set(key, serialized)
      },
      removeItem: (key) => {
        store.delete(key)
      },
      clear: () => {
        store.clear()
      },
      key: (index) => Array.from(store.keys())[index] ?? null,
      get length() {
        return store.size
      },
    }

    vi.stubGlobal('localStorage', storageMock)
    try {
      localStorage.setItem('direct-edit-guidelines', JSON.stringify(stored))
      writes.length = 0

      renderHook(() => useGuidelines(true))

      await waitFor(() => {
        const guidelineWrites = writes.filter(([key]) => key === 'direct-edit-guidelines')
        expect(guidelineWrites.length).toBeGreaterThan(0)
      })

      const guidelineWrites = writes.filter(([key]) => key === 'direct-edit-guidelines')
      expect(guidelineWrites[0]?.[1]).toBe(JSON.stringify(stored))
      expect(guidelineWrites.some(([, value]) => value === '[]')).toBe(false)
    } finally {
      vi.unstubAllGlobals()
    }
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

  it('reads initial visibility from localStorage', async () => {
    localStorage.setItem('direct-edit-rulers-visible', 'false')
    const { result } = renderHook(() => useRulersVisible())
    await waitFor(() => {
      expect(result.current[0]).toBe(false)
    })
  })
})
