import type { ReactComponentFrame } from '../types'

declare global {
  interface Window {
    __DIRECT_EDIT_DEVTOOLS__?: {
      getFiberForElement: (element: HTMLElement) => unknown | null
      hasHook?: boolean
    }
  }
}

// Accesses React fiber internals to find the component stack. This is an undocumented
// API that could change between React versions, but is a common pattern for dev tools.
// Returns an empty array gracefully if React internals are unavailable.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getFiberForElement(element: HTMLElement): any | null {
  if (typeof window !== 'undefined') {
    const devtools = window.__DIRECT_EDIT_DEVTOOLS__
    if (devtools?.getFiberForElement) {
      const fiber = devtools.getFiberForElement(element)
      if (fiber) return fiber as any
    }
  }

  const fiberKey = Object.keys(element).find(
    (key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$')
  )

  if (!fiberKey) return null
  return (element as any)[fiberKey] || null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSourceFromFiber(fiber: any):
  | {
      fileName?: string
      lineNumber?: number
      columnNumber?: number
    }
  | null {
  const debugSource = fiber?._debugSource
  if (debugSource?.fileName) return debugSource

  const owner = fiber?._debugOwner
  const ownerPending = owner?.pendingProps?.__source
  if (ownerPending?.fileName) return ownerPending

  const ownerMemo = owner?.memoizedProps?.__source
  if (ownerMemo?.fileName) return ownerMemo

  const pending = fiber?.pendingProps?.__source
  if (pending?.fileName) return pending

  const memo = fiber?.memoizedProps?.__source
  if (memo?.fileName) return memo

  return null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFrame(fiber: any): ReactComponentFrame | null {
  const type = fiber?.type
  if (typeof type !== 'function' && typeof type !== 'object') return null

  const name = type?.displayName || type?.name || null
  if (!name || name === 'Fragment') return null

  const frame: ReactComponentFrame = { name }
  const source = getSourceFromFiber(fiber)
  if (source?.fileName) {
    frame.file = source.fileName
    if (typeof source.lineNumber === 'number') {
      frame.line = source.lineNumber
    }
    if (typeof source.columnNumber === 'number') {
      frame.column = source.columnNumber
    }
  }

  return frame
}

function shouldIncludeFrame(
  frame: ReactComponentFrame,
  lastFrame: ReactComponentFrame | null
): boolean {
  if (!lastFrame) return true
  if (frame.name !== lastFrame.name) return true
  if (!lastFrame.file && frame.file) return true
  if (lastFrame.file && frame.file && lastFrame.line == null && frame.line != null) return true
  if (
    lastFrame.file &&
    frame.file &&
    lastFrame.line != null &&
    frame.line != null &&
    lastFrame.column == null &&
    frame.column != null
  ) {
    return true
  }
  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getOwnerStack(fiber: any): ReactComponentFrame[] {
  const frames: ReactComponentFrame[] = []
  let current = fiber
  let lastFrame: ReactComponentFrame | null = null

  while (current) {
    const frame = buildFrame(current)
    if (frame && shouldIncludeFrame(frame, lastFrame)) {
      frames.push(frame)
      lastFrame = frame
    }
    current = current._debugOwner
  }

  return frames
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRenderStack(fiber: any): ReactComponentFrame[] {
  const frames: ReactComponentFrame[] = []
  let current = fiber
  let lastFrame: ReactComponentFrame | null = null

  while (current) {
    const frame = buildFrame(current)
    if (frame && shouldIncludeFrame(frame, lastFrame)) {
      frames.push(frame)
      lastFrame = frame
    }
    current = current.return
  }

  return frames
}

export function getReactComponentStack(element: HTMLElement): ReactComponentFrame[] {
  const fiber = getFiberForElement(element)
  if (!fiber) return []

  const ownerStack = getOwnerStack(fiber)
  if (ownerStack.length > 0) {
    return ownerStack
  }

  return getRenderStack(fiber)
}
