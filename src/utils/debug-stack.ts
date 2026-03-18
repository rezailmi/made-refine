export type ParsedStackFrame = {
  functionName?: string
  fileName?: string
  lineNumber?: number
  columnNumber?: number
  source?: string
  isServer?: boolean
}

const STACK_SOURCE_FILE_EXTENSION_REGEX = /\.(jsx|tsx|ts|js)$/
const STACK_BUNDLED_FILE_PATTERN_REGEX =
  /(\.min|bundle|chunk|vendor|vendors|runtime|polyfill|polyfills)\.(js|mjs|cjs)$|(chunk|bundle|vendor|vendors|runtime|polyfill|polyfills|framework|app|main|index)[-_.][A-Za-z0-9_-]{4,}\.(js|mjs|cjs)$|[\da-f]{8,}\.(js|mjs|cjs)$|[-_.][\da-f]{20,}\.(js|mjs|cjs)$|\/dist\/|\/build\/|\/.next\/|\/out\/|\/node_modules\/|\.webpack\.|\.vite\.|\.turbopack\./i
const FIREFOX_SAFARI_STACK_REGEXP = /(^|@)\S+:\d+/
const SAFARI_NATIVE_CODE_REGEXP = /^(eval@)?(\[native code\])?$/
const SERVER_FRAME_MARKER = '(at Server)'

const STACK_INTERNAL_SCHEME_PREFIXES = [
  'rsc://',
  'about://React/',
  'React/Server/',
  'file:///',
  'webpack://',
  'webpack-internal://',
  'node:',
  'turbopack://',
  '/app-pages-browser/',
] as const

function formatOwnerDebugStack(stack: string): string {
  if (!stack) return ''

  const lines = stack.split('\n')
  const filtered: string[] = []

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (trimmed === 'Error: react-stack-top-frame') continue
    if (
      trimmed.includes('react_stack_bottom_frame') ||
      trimmed.includes('react-stack-bottom-frame')
    ) {
      continue
    }
    filtered.push(line)
  }

  if (filtered.length > 0 && filtered[0].includes('fakeJSXCallSite')) {
    filtered.shift()
  }

  return filtered.join('\n')
}

function extractStackLocation(urlLike: string): [string, number | undefined, number | undefined] {
  if (!urlLike.includes(':')) return [urlLike, undefined, undefined]

  const isWrappedLocation = urlLike.startsWith('(') && /:\d+\)$/.test(urlLike)
  const sanitizedResult = isWrappedLocation ? urlLike.slice(1, -1) : urlLike
  const parts = /(.+?)(?::(\d+))?(?::(\d+))?$/.exec(sanitizedResult)
  if (!parts) return [sanitizedResult, undefined, undefined]

  return [
    parts[1],
    parts[2] !== undefined ? Number(parts[2]) : undefined,
    parts[3] !== undefined ? Number(parts[3]) : undefined,
  ]
}

function parseV8StackLine(line: string): ParsedStackFrame | null {
  let currentLine = line
  if (currentLine.includes('(eval ')) {
    currentLine = currentLine
      .replace(/eval code/g, 'eval')
      .replace(/(\(eval at [^()]*)|(,.*$)/g, '')
  }

  let sanitizedLine = currentLine
    .replace(/^\s+/, '')
    .replace(/\(eval code/g, '(')
    .replace(/^.*?\s+/, '')
  const locationMatch = sanitizedLine.match(/ (\(.+\)$)/)
  if (locationMatch) {
    sanitizedLine = sanitizedLine.replace(locationMatch[0], '')
  }

  const [fileName, lineNumber, columnNumber] = extractStackLocation(
    locationMatch ? locationMatch[1] : sanitizedLine
  )
  const functionName = locationMatch && sanitizedLine ? sanitizedLine : undefined
  if (fileName === 'eval' || fileName === '<anonymous>') {
    return {
      functionName,
    }
  }

  return {
    functionName,
    fileName,
    lineNumber,
    columnNumber,
    source: currentLine,
    isServer: currentLine.includes(SERVER_FRAME_MARKER) || fileName.startsWith('rsc://'),
  }
}

function parseFFOrSafariStackLine(line: string): ParsedStackFrame | null {
  let currentLine = line
  if (currentLine.includes(' > eval')) {
    currentLine = currentLine.replace(
      / line (\d+)(?: > eval line \d+)* > eval:\d+:\d+/g,
      ':$1'
    )
  }

  const trimmed = currentLine.trim()
  if (!trimmed || SAFARI_NATIVE_CODE_REGEXP.test(trimmed)) {
    return null
  }

  if (!trimmed.includes('@') && !trimmed.includes(':')) {
    return {
      functionName: trimmed,
      source: currentLine,
      isServer: trimmed.includes(SERVER_FRAME_MARKER),
    }
  }

  const atIndex = trimmed.lastIndexOf('@')
  if (atIndex === -1) {
    return null
  }
  const maybeFunctionName = trimmed.slice(0, atIndex)
  const location = trimmed.slice(atIndex + 1)
  const [fileName, lineNumber, columnNumber] = extractStackLocation(location)

  return {
    functionName: maybeFunctionName || undefined,
    fileName,
    lineNumber,
    columnNumber,
    source: currentLine,
    isServer: currentLine.includes(SERVER_FRAME_MARKER) || fileName.startsWith('rsc://'),
  }
}

function parseInStackLine(line: string): ParsedStackFrame | null {
  const functionName = line
    .replace(/^\s*in\s+/, '')
    .replace(/\s*\(at .*\)$/, '')
    .trim()
  if (!functionName) return null

  return {
    functionName,
    source: line,
    isServer: line.includes(SERVER_FRAME_MARKER),
  }
}

function parseDebugStack(stack: string): ParsedStackFrame[] {
  const frames: ParsedStackFrame[] = []
  for (const rawLine of stack.split('\n')) {
    if (FIREFOX_SAFARI_STACK_REGEXP.test(rawLine)) {
      const parsed = parseFFOrSafariStackLine(rawLine)
      if (parsed) frames.push(parsed)
      continue
    }

    if (/^\s*at\s+/.test(rawLine)) {
      const parsed = parseV8StackLine(rawLine)
      if (parsed) frames.push(parsed)
      continue
    }

    if (/^\s*in\s+/.test(rawLine)) {
      const parsed = parseInStackLine(rawLine)
      if (parsed) frames.push(parsed)
    }
  }

  return frames
}

export function normalizeStackFileName(fileName: string): string {
  if (!fileName) return ''

  let normalized = fileName
  const isHttpUrl = normalized.startsWith('http://') || normalized.startsWith('https://')
  if (isHttpUrl) {
    try {
      normalized = new URL(normalized).pathname
    } catch {
      // Fall through and use the original string.
    }
  }

  let didStripPrefix = true
  while (didStripPrefix) {
    didStripPrefix = false
    for (const prefix of STACK_INTERNAL_SCHEME_PREFIXES) {
      if (normalized.startsWith(prefix)) {
        normalized = normalized.slice(prefix.length)
        if (prefix === 'file:///') {
          normalized = `/${normalized.replace(/^\/+/, '')}`
        }
        didStripPrefix = true
        break
      }
    }
  }

  normalized = normalized
    .replace(/^\/\(app-pages-browser\)\//, '/')
    .replace(/^\/\.\//, '/')
    .replace(/^\.\//, '')

  const queryIndex = normalized.indexOf('?')
  if (queryIndex !== -1) {
    normalized = normalized.slice(0, queryIndex)
  }

  return normalized
}

function isSourceStackFile(fileName: string): boolean {
  const normalizedFileName = normalizeStackFileName(fileName)
  if (!normalizedFileName) return false
  if (!STACK_SOURCE_FILE_EXTENSION_REGEX.test(normalizedFileName)) return false
  return !STACK_BUNDLED_FILE_PATTERN_REGEX.test(normalizedFileName)
}

type EnrichedServerFrame = {
  fileName: string
  lineNumber?: number
  columnNumber?: number
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildFunctionNameToRscFramesMap(fiber: any): Map<string, EnrichedServerFrame[]> {
  const functionNameToRscFrames = new Map<string, EnrichedServerFrame[]>()
  const visited = new Set<any>()
  let current = fiber

  while (current && !visited.has(current)) {
    visited.add(current)
    const rawStack = current?._debugStack?.stack
    const stack = typeof rawStack === 'string' ? formatOwnerDebugStack(rawStack) : ''
    if (stack) {
      const frames = parseDebugStack(stack)
      for (const frame of frames) {
        if (!frame.functionName || !frame.fileName) continue
        if (!frame.fileName.startsWith('rsc://')) continue

        const normalized = normalizeStackFileName(frame.fileName)
        if (!normalized) continue

        const existing = functionNameToRscFrames.get(frame.functionName) ?? []
        const duplicate = existing.some(
          (candidate) =>
            candidate.fileName === normalized &&
            candidate.lineNumber === frame.lineNumber &&
            candidate.columnNumber === frame.columnNumber
        )
        if (!duplicate) {
          existing.push({
            fileName: normalized,
            lineNumber: frame.lineNumber,
            columnNumber: frame.columnNumber,
          })
          functionNameToRscFrames.set(frame.functionName, existing)
        }
      }
    }

    current = current._debugOwner ?? current.return ?? null
  }

  return functionNameToRscFrames
}

function enrichServerFrame(
  frame: ParsedStackFrame,
  functionNameToRscFrames: Map<string, EnrichedServerFrame[]>,
  functionNameToUsageIndex: Map<string, number>,
): ParsedStackFrame {
  if (!frame.functionName) return frame

  const available = functionNameToRscFrames.get(frame.functionName)
  if (!available) return frame

  const usageIndex = functionNameToUsageIndex.get(frame.functionName) ?? 0
  const resolved = available[usageIndex % available.length]
  functionNameToUsageIndex.set(frame.functionName, usageIndex + 1)

  return {
    ...frame,
    fileName: resolved.fileName,
    lineNumber: resolved.lineNumber,
    columnNumber: resolved.columnNumber,
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getSourceFromDebugStack(fiber: any):
  | {
      fileName?: string
      lineNumber?: number
      columnNumber?: number
    }
  | null {
  const rawStack = fiber?._debugStack?.stack
  if (typeof rawStack !== 'string' || rawStack.length === 0) {
    return null
  }

  const formattedStack = formatOwnerDebugStack(rawStack)
  if (!formattedStack) return null

  const stackFrames = parseDebugStack(formattedStack)
  const functionNameToRscFrames = buildFunctionNameToRscFramesMap(fiber)
  const functionNameToUsageIndex = new Map<string, number>()

  for (const frame of stackFrames) {
    const maybeEnriched = frame.isServer
      ? enrichServerFrame(frame, functionNameToRscFrames, functionNameToUsageIndex)
      : frame
    if (!maybeEnriched.fileName) continue

    const normalizedFileName = normalizeStackFileName(maybeEnriched.fileName)
    if (!normalizedFileName) continue

    if (isSourceStackFile(normalizedFileName)) {
      return {
        fileName: normalizedFileName,
        lineNumber: maybeEnriched.lineNumber,
        columnNumber: maybeEnriched.columnNumber,
      }
    }
  }

  return null
}
