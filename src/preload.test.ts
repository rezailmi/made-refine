// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest'

declare global {
  interface Window {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: any
  }
}

// Build a minimal fake fiber tree helper
function makeFiberEl(el: HTMLElement) {
  return { stateNode: el, child: null, sibling: null, return: null }
}

function makeFakeRoot(rootFiber: object) {
  return { current: rootFiber }
}

beforeEach(() => {
  delete window.__REACT_DEVTOOLS_GLOBAL_HOOK__
  delete window.__DIRECT_EDIT_DEVTOOLS__
  vi.resetModules()
})

describe('preload fiber index', () => {
  it('test 1: lookup after commit returns host fiber', async () => {
    // preload.ts is a side-effect module (not an ES module with exports)
    // We import it for its side effects
    await import('./preload')
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__
    expect(hook).toBeDefined()

    const el = document.createElement('div')
    const fiber = makeFiberEl(el)
    const fakeRoot = makeFakeRoot(fiber)

    const id = hook.inject({})
    hook.onCommitFiberRoot(id, fakeRoot)

    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = window.__DIRECT_EDIT_DEVTOOLS__!.getFiberForElement(el)
    expect(result).toBe(fiber)
  })

  it('test 2: unknown element returns null', async () => {
    await import('./preload')
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__

    const el = document.createElement('div')
    const fiber = makeFiberEl(el)
    const fakeRoot = makeFakeRoot(fiber)

    const id = hook.inject({})
    hook.onCommitFiberRoot(id, fakeRoot)

    const unknownEl = document.createElement('span')
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    const result = window.__DIRECT_EDIT_DEVTOOLS__!.getFiberForElement(unknownEl)
    expect(result).toBeNull()
  })

  it('test 3: re-commit reflects new tree', async () => {
    await import('./preload')
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__

    const elX = document.createElement('div')
    const fiberX = makeFiberEl(elX)
    const fakeRoot = makeFakeRoot(fiberX)

    const id = hook.inject({})
    hook.onCommitFiberRoot(id, fakeRoot)

    // Verify X is indexed
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(window.__DIRECT_EDIT_DEVTOOLS__!.getFiberForElement(elX)).toBe(fiberX)

    // Now mutate the root: current points to a new tree with Y, not X
    const elY = document.createElement('section')
    const fiberY = makeFiberEl(elY)
    // Mutate the same root object's current pointer
    ;(fakeRoot as any).current = fiberY

    // Re-commit the mutated root
    hook.onCommitFiberRoot(id, fakeRoot)

    // Y should be found, X should no longer be indexed
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(window.__DIRECT_EDIT_DEVTOOLS__!.getFiberForElement(elY)).toBe(fiberY)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(window.__DIRECT_EDIT_DEVTOOLS__!.getFiberForElement(elX)).toBeNull()
  })

  it('test 5: laziness — tree walk does NOT happen on commit, only on lookup', async () => {
    await import('./preload')
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__

    const el = document.createElement('div')
    let accessCount = 0
    const fiberNode = { stateNode: el, child: null, sibling: null, return: null }
    // Use a getter on `current` to count tree-walk accesses
    const fakeRoot = {
      get current() {
        accessCount++
        return fiberNode
      },
    }

    const id = hook.inject({})

    // Do an initial lookup to clear the dirty flag from startup
    // (the index is dirty=true at module load — do one lookup to prime it)
    hook.onCommitFiberRoot(id, fakeRoot)
    accessCount = 0 // reset after the forced first rebuild triggered by startup dirty flag + prior lookup

    // Reset by doing a lookup (clears dirty flag)
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    window.__DIRECT_EDIT_DEVTOOLS__!.getFiberForElement(el)
    const countAfterLookup = accessCount
    accessCount = 0

    // Now commit again — should NOT trigger tree walk (just sets dirty flag)
    hook.onCommitFiberRoot(id, fakeRoot)
    const countAfterCommit = accessCount

    // Tree walk should NOT happen on commit alone
    expect(countAfterCommit).toBe(0)

    // But SHOULD happen on next getFiberForElement call
    accessCount = 0
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    window.__DIRECT_EDIT_DEVTOOLS__!.getFiberForElement(el)
    expect(accessCount).toBeGreaterThan(0)

    void countAfterLookup // used for clarity but not asserted against
  })

  it('test 4: wrapHook path — indexes elements AND calls original stub', async () => {
    const originalOnCommit = vi.fn()
    // Pre-set hook before import so wrapHook path is triggered
    window.__REACT_DEVTOOLS_GLOBAL_HOOK__ = {
      inject: () => 1,
      onCommitFiberRoot: originalOnCommit,
    }

    await import('./preload')

    // After import, the hook should have been wrapped
    const hook = window.__REACT_DEVTOOLS_GLOBAL_HOOK__

    const el = document.createElement('div')
    const fiber = makeFiberEl(el)
    const fakeRoot = makeFakeRoot(fiber)

    hook.onCommitFiberRoot(1, fakeRoot, 'extraArg')

    // Should index elements
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    expect(window.__DIRECT_EDIT_DEVTOOLS__!.getFiberForElement(el)).toBe(fiber)
    // Should also call the original stub
    expect(originalOnCommit).toHaveBeenCalledWith(1, fakeRoot, 'extraArg')
  })
})
