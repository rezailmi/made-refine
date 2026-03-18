import type { ReactComponentFrame, DomSourceLocation } from '../types'

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
function getOwnerStack(fiber: any): { frames: ReactComponentFrame[]; nearestComponentFiber: any | null } {
  const frames: ReactComponentFrame[] = []
  let current = fiber
  let lastFrame: ReactComponentFrame | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nearestComponentFiber: any | null = null

  while (current) {
    const frame = buildFrame(current)
    if (frame && shouldIncludeFrame(frame, lastFrame)) {
      frames.push(frame)
      lastFrame = frame
      if (!nearestComponentFiber) {
        nearestComponentFiber = current
      }
    }
    current = current._debugOwner
  }

  return { frames, nearestComponentFiber }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getRenderStack(fiber: any): { frames: ReactComponentFrame[]; nearestComponentFiber: any | null } {
  const frames: ReactComponentFrame[] = []
  let current = fiber
  let lastFrame: ReactComponentFrame | null = null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let nearestComponentFiber: any | null = null

  while (current) {
    const frame = buildFrame(current)
    if (frame && shouldIncludeFrame(frame, lastFrame)) {
      frames.push(frame)
      lastFrame = frame
      if (!nearestComponentFiber) {
        nearestComponentFiber = current
      }
    }
    current = current.return
  }

  return { frames, nearestComponentFiber }
}

export interface ReactComponentInfo {
  frames: ReactComponentFrame[]
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  nearestComponentFiber: any | null
  /** Source file of the host element's own fiber (_debugSource) — points to the component definition file */
  elementSourceFile?: string
}

export function getReactComponentInfo(element: HTMLElement): ReactComponentInfo {
  const fiber = getFiberForElement(element)
  if (!fiber) return { frames: [], nearestComponentFiber: null }

  const elementSource = getSourceFromFiber(fiber)
  const elementSourceFile = elementSource?.fileName || undefined

  const ownerResult = getOwnerStack(fiber)
  if (ownerResult.frames.length > 0) {
    return { ...ownerResult, elementSourceFile }
  }

  return { ...getRenderStack(fiber), elementSourceFile }
}

export function getReactComponentStack(element: HTMLElement): ReactComponentFrame[] {
  return getReactComponentInfo(element).frames
}

// --- Component props extraction ---

const EXCLUDED_PROP_KEYS = new Set([
  'className', 'style', 'children', 'ref', 'key', 'render',
])

function serializePropValue(value: unknown): unknown {
  if (typeof value === 'function') return '[function]'
  if (typeof value === 'symbol') return undefined
  if (value === undefined) return undefined
  if (value !== null && typeof value === 'object') {
    // React elements have $$typeof
    if ('$$typeof' in value) return '[element]'
    try {
      JSON.stringify(value)
      return value
    } catch {
      return '[object]'
    }
  }
  return value
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getComponentProps(fiber: any): Record<string, unknown> {
  const props = fiber?.memoizedProps ?? fiber?.pendingProps
  if (!props || typeof props !== 'object') return {}

  const result: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(props)) {
    if (EXCLUDED_PROP_KEYS.has(key)) continue
    if (key.startsWith('data-')) continue
    const serialized = serializePropValue(value)
    if (serialized !== undefined) {
      result[key] = serialized
    }
  }
  return result
}

// --- Source location helpers ---

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCallSiteSource(fiber: any): DomSourceLocation | null {
  const source = fiber?._debugSource
  if (source?.fileName) {
    return {
      file: source.fileName,
      line: typeof source.lineNumber === 'number' ? source.lineNumber : undefined,
      column: typeof source.columnNumber === 'number' ? source.columnNumber : undefined,
    }
  }
  const pending = fiber?.pendingProps?.__source
  if (pending?.fileName) {
    return {
      file: pending.fileName,
      line: typeof pending.lineNumber === 'number' ? pending.lineNumber : undefined,
      column: typeof pending.columnNumber === 'number' ? pending.columnNumber : undefined,
    }
  }
  return null
}

export function deriveDefinitionSource(
  frames: ReactComponentFrame[],
): DomSourceLocation | null {
  for (const frame of frames) {
    if (frame.file && isComponentPrimitivePath(frame.file)) {
      return { file: frame.file, line: frame.line, column: frame.column }
    }
  }
  return null
}

// --- Component primitive classification ---

const PRIMITIVE_PATH_PATTERNS = [
  /(?:^|\/)components\/ui\//,
  /(?:^|\/)ui\/primitives\//,
  /(?:^|\/)design-system\//,
]

const PRIMITIVE_NPM_PATTERNS = [
  /@base-ui\//,
  /@radix-ui\//,
  /@headlessui\//,
  /@chakra-ui\//,
  /@mantine\//,
  /@mui\//,
  /@ark-ui\//,
]

// Match only top-level framework packages (e.g., node_modules/react/ but not @base-ui/react/)
const FRAMEWORK_EXCLUSION_PATTERNS = [
  /node_modules\/react\//,
  /node_modules\/react-dom\//,
  /node_modules\/next\/dist\//,
  /node_modules\/scheduler\//,
  /node_modules\/react-server\//,
]

export function isComponentPrimitivePath(filePath: string): boolean {
  const normalized = filePath.replace(/\\/g, '/')

  for (const pattern of FRAMEWORK_EXCLUSION_PATTERNS) {
    if (pattern.test(normalized)) return false
  }

  // Check npm UI library patterns first (they're in node_modules)
  for (const pattern of PRIMITIVE_NPM_PATTERNS) {
    if (pattern.test(normalized)) return true
  }

  for (const pattern of PRIMITIVE_PATH_PATTERNS) {
    if (pattern.test(normalized)) return true
  }

  return false
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function classifyComponentFiber(fiber: any, frames: ReactComponentFrame[], elementSourceFile?: string): { isComponentPrimitive: boolean } {
  // Check the host element's own source first — for component primitives,
  // this points to the file where the component renders its host elements.
  // This check runs before the fiber null guard because elementSourceFile
  // comes from the host element's _debugSource, not the component fiber.
  if (elementSourceFile && isComponentPrimitivePath(elementSourceFile)) {
    return { isComponentPrimitive: true }
  }

  if (!fiber) return { isComponentPrimitive: false }

  const callSite = getCallSiteSource(fiber)
  if (callSite?.file && isComponentPrimitivePath(callSite.file)) {
    return { isComponentPrimitive: true }
  }

  for (const frame of frames) {
    if (frame.file && isComponentPrimitivePath(frame.file)) {
      return { isComponentPrimitive: true }
    }
  }

  // Fallback: detect pre-compiled npm package components.
  // If the host element has no _debugSource (elementSourceFile is undefined)
  // but the component fiber has _debugSource (called from dev-transformed user code),
  // the component renders pre-compiled JSX — typical of npm UI packages whose
  // source isn't processed by the React dev transform.
  if (!elementSourceFile && fiber._debugSource) {
    return { isComponentPrimitive: true }
  }

  return { isComponentPrimitive: false }
}
