import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// We need to test a fresh store instance each time, so import the class constructor pattern
// The store module exports a singleton, so we'll re-import for each test
function createStore() {
  // Create a fresh EditStore by dynamically importing and accessing internals
  // Since EditStore is not exported, we'll test through the exported singleton API
  // To get isolation, we'll clear state between tests
  return import('./store').then((m) => m.store)
}

// Since we can't easily get fresh instances, let's test the exported singleton
// and work around the singleton pattern
import { store } from './store'
import type { VisualAnnotation } from './types'

function makeAnnotation(overrides: Partial<VisualAnnotation> = {}): VisualAnnotation {
  return {
    id: `test-${Math.random().toString(36).slice(2)}`,
    timestamp: Date.now(),
    status: 'pending',
    type: 'edit',
    element: {
      tagName: 'div',
      id: null,
      classList: [],
      domSelector: 'div',
      targetHtml: '<div></div>',
      textPreview: '',
    },
    source: null,
    reactStack: [],
    changes: [],
    exportMarkdown: '',
    ...overrides,
  } as VisualAnnotation
}

describe('EditStore TTL', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('does not prune recently-resolved annotations', () => {
    const annotation = makeAnnotation({ id: 'ttl-1' })
    store.add(annotation)
    store.updateStatus('ttl-1', 'applied')

    // Advance 1 minute — well within the 5 minute TTL
    vi.advanceTimersByTime(60 * 1000)

    const all = store.getAll()
    expect(all.find((a) => a.id === 'ttl-1')).toBeDefined()
  })

  it('prunes resolved annotations after TTL from resolution time', () => {
    // Create annotation at t=0
    const annotation = makeAnnotation({ id: 'ttl-2' })
    store.add(annotation)

    // Wait 4 minutes, then resolve
    vi.advanceTimersByTime(4 * 60 * 1000)
    store.updateStatus('ttl-2', 'applied')

    // 3 minutes after resolution — within the 5-min window from resolution
    vi.advanceTimersByTime(3 * 60 * 1000)
    expect(store.getAll().find((a) => a.id === 'ttl-2')).toBeDefined()

    // 5+ minutes after resolution — should now be pruned
    vi.advanceTimersByTime(3 * 60 * 1000)
    expect(store.getAll().find((a) => a.id === 'ttl-2')).toBeUndefined()
  })

  it('does not prune pending annotations regardless of age', () => {
    const annotation = makeAnnotation({ id: 'ttl-3' })
    store.add(annotation)

    // Advance 10 minutes — pending items should never be pruned
    vi.advanceTimersByTime(10 * 60 * 1000)

    expect(store.getAll().find((a) => a.id === 'ttl-3')).toBeDefined()
  })

  it('prunes dismissed annotations after TTL from dismissal time', () => {
    const annotation = makeAnnotation({ id: 'ttl-4' })
    store.add(annotation)

    vi.advanceTimersByTime(6 * 60 * 1000)
    store.updateStatus('ttl-4', 'dismissed')

    // Just dismissed — should still be present
    vi.advanceTimersByTime(1000)
    expect(store.getAll().find((a) => a.id === 'ttl-4')).toBeDefined()

    // 5+ minutes after dismissal
    vi.advanceTimersByTime(6 * 60 * 1000)
    expect(store.getAll().find((a) => a.id === 'ttl-4')).toBeUndefined()
  })
})
