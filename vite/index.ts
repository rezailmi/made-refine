import type { Plugin, ResolvedConfig } from 'vite'
import path from 'path'
import { createRequire } from 'module'

type Range = [start: number, end: number]

/** Build a sorted list of character ranges that should be skipped (strings, template literals, comments). */
function buildSkipRanges(code: string): Range[] {
  const ranges: Range[] = []
  const len = code.length
  let i = 0

  while (i < len) {
    const ch = code[i]

    // Single-line comment
    if (ch === '/' && code[i + 1] === '/') {
      const start = i
      i += 2
      while (i < len && code[i] !== '\n') i++
      ranges.push([start, i])
      continue
    }

    // Block comment
    if (ch === '/' && code[i + 1] === '*') {
      const start = i
      i += 2
      while (i < len && !(code[i] === '*' && code[i + 1] === '/')) i++
      i += 2 // skip closing */
      ranges.push([start, i])
      continue
    }

    // String literals (single/double quote)
    if (ch === "'" || ch === '"') {
      const start = i
      const quote = ch
      i++
      while (i < len && code[i] !== quote) {
        if (code[i] === '\\') i++ // skip escaped char
        i++
      }
      i++ // skip closing quote
      ranges.push([start, i])
      continue
    }

    // Template literal
    if (ch === '`') {
      const start = i
      i++
      let depth = 1
      while (i < len && depth > 0) {
        if (code[i] === '\\') {
          i += 2
          continue
        }
        if (code[i] === '$' && code[i + 1] === '{') {
          depth++
          i += 2
          continue
        }
        if (code[i] === '}' && depth > 1) {
          depth--
          i++
          continue
        }
        if (code[i] === '`' && depth === 1) {
          depth--
          i++
          continue
        }
        i++
      }
      ranges.push([start, i])
      continue
    }

    i++
  }

  return ranges
}

function isInsideSkipRange(ranges: Range[], offset: number): boolean {
  // Binary search for efficiency
  let lo = 0
  let hi = ranges.length - 1
  while (lo <= hi) {
    const mid = (lo + hi) >>> 1
    const [start, end] = ranges[mid]
    if (offset < start) hi = mid - 1
    else if (offset >= end) lo = mid + 1
    else return true
  }
  return false
}

interface MadeRefineOptions {
  // Future options
}

export function madeRefine(_options?: MadeRefineOptions): Plugin {
  let config: ResolvedConfig

  return {
    name: 'made-refine',
    configResolved(resolvedConfig) {
      config = resolvedConfig
    },
    transformIndexHtml: {
      order: 'pre',
      handler(html) {
        // Only inject in dev mode
        if (config.command !== 'serve') return html

        // Inject preload script at start of <head> (before React loads)
        const require = createRequire(import.meta.url)
        const distDir = path.dirname(require.resolve('made-refine'))
        const preloadScript = `<script src="/@fs/${distDir}/preload/preload.js"></script>`
        return html.replace('<head>', `<head>\n    ${preloadScript}`)
      },
    },
    transform(code, id) {
      if (config.command !== 'serve') return null
      if (!/\.[jt]sx$/.test(id)) return null
      if (id.includes('node_modules')) return null
      const normalizedId = id.replace(/\\/g, '/')
      if (normalizedId.includes('/node_modules/made-refine/')) return null

      const projectRoot = config.root
      const relativePath = path.relative(projectRoot, id)

      const skipRanges = buildSkipRanges(code)
      const tagRe = /<([a-z][a-zA-Z0-9]*(?:-[a-zA-Z0-9]+)*)\b/g

      let line = 1
      let lastIndex = 0
      const result = code.replace(tagRe, (match, _tag, offset) => {
        if (isInsideSkipRange(skipRanges, offset)) return match
        const slice = code.slice(lastIndex, offset)
        line += (slice.match(/\n/g) || []).length
        lastIndex = offset
        const col = offset - code.lastIndexOf('\n', offset)
        return `${match} data-direct-edit-source="${relativePath}:${line}:${col}"`
      })

      return { code: result, map: null }
    },
  }
}

// Babel plugin path for @vitejs/plugin-react integration:
// babel: { plugins: [require.resolve('made-refine/babel')] }

export default madeRefine
