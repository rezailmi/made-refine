/* eslint-disable @typescript-eslint/no-explicit-any */

type Fiber = {
  child?: Fiber | null
  sibling?: Fiber | null
  stateNode?: unknown
  return?: Fiber | null
  _debugOwner?: Fiber | null
  _debugSource?: {
    fileName?: string
    lineNumber?: number
    columnNumber?: number
  }
  pendingProps?: { __source?: unknown }
  memoizedProps?: { __source?: unknown }
}

type FiberRoot = {
  current?: Fiber | null
}

type DevToolsHook = {
  supportsFiber?: boolean
  inject?: (renderer: unknown) => number
  onCommitFiberRoot?: (rendererId: number, root: FiberRoot, ...args: unknown[]) => void
  onCommitFiberUnmount?: (rendererId: number, fiber: Fiber, ...args: unknown[]) => void
  getFiberRoots?: (rendererId: number) => Set<FiberRoot>
}

const fiberRoots = new Map<number, Set<FiberRoot>>()
let elementToFiber = new WeakMap<HTMLElement, Fiber>()

function ensureRootSet(rendererId: number): Set<FiberRoot> {
  let set = fiberRoots.get(rendererId)
  if (!set) {
    set = new Set<FiberRoot>()
    fiberRoots.set(rendererId, set)
  }
  return set
}

function rebuildIndex() {
  elementToFiber = new WeakMap<HTMLElement, Fiber>()
  for (const roots of fiberRoots.values()) {
    for (const root of roots) {
      const current = root?.current
      if (!current) continue
      indexFiberTree(current)
    }
  }
}

function indexFiberTree(root: Fiber) {
  const stack: Fiber[] = [root]
  while (stack.length > 0) {
    const node = stack.pop()
    if (!node) continue

    const stateNode = node.stateNode as { nodeType?: number } | undefined
    if (stateNode && stateNode.nodeType === 1) {
      elementToFiber.set(stateNode as HTMLElement, node)
    }

    if (node.child) stack.push(node.child)
    if (node.sibling) stack.push(node.sibling)
  }
}

function getFiberForElement(element: HTMLElement): Fiber | null {
  return elementToFiber.get(element) ?? null
}

function createHook(): DevToolsHook {
  let rendererId = 0

  const hook: DevToolsHook = {
    supportsFiber: true,
    inject(renderer) {
      rendererId += 1
      const id = rendererId
      void renderer
      ensureRootSet(id)
      return id
    },
    onCommitFiberRoot(id, root) {
      const roots = ensureRootSet(id)
      roots.add(root)
      rebuildIndex()
    },
    onCommitFiberUnmount() {
      // Rebuild on next commit; unmount does not include the root reference.
    },
    getFiberRoots(id) {
      return ensureRootSet(id)
    },
  }

  return hook
}

function wrapHook(existing: DevToolsHook) {
  const originalInject = existing.inject?.bind(existing)
  const originalCommit = existing.onCommitFiberRoot?.bind(existing)
  const originalUnmount = existing.onCommitFiberUnmount?.bind(existing)

  existing.supportsFiber = true

  existing.inject = (renderer) => {
    const id = originalInject ? originalInject(renderer) : 1
    ensureRootSet(id)
    return id
  }

  existing.onCommitFiberRoot = (id, root, ...args) => {
    const roots = ensureRootSet(id)
    roots.add(root)
    rebuildIndex()
    if (originalCommit) {
      originalCommit(id, root, ...args)
    }
  }

  existing.onCommitFiberUnmount = (id, fiber, ...args) => {
    if (originalUnmount) {
      originalUnmount(id, fiber, ...args)
    }
  }

  if (!existing.getFiberRoots) {
    existing.getFiberRoots = (id) => ensureRootSet(id)
  }
}

function installHook() {
  if (typeof window === 'undefined') return
  const globalWindow = window as Window & {
    __REACT_DEVTOOLS_GLOBAL_HOOK__?: DevToolsHook
    __DIRECT_EDIT_DEVTOOLS__?: { getFiberForElement: (element: HTMLElement) => Fiber | null; hasHook: boolean }
  }

  if (globalWindow.__DIRECT_EDIT_DEVTOOLS__?.hasHook) return

  const existing = globalWindow.__REACT_DEVTOOLS_GLOBAL_HOOK__
  if (existing) {
    wrapHook(existing)
  } else {
    globalWindow.__REACT_DEVTOOLS_GLOBAL_HOOK__ = createHook()
  }

  globalWindow.__DIRECT_EDIT_DEVTOOLS__ = {
    getFiberForElement,
    hasHook: true,
  }
}

installHook()
