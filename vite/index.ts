import type { Plugin, ResolvedConfig } from 'vite'
import path from 'path'
import { createRequire } from 'module'

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
      if (id.includes('made-refine')) return null

      const projectRoot = config.root
      const relativePath = path.relative(projectRoot, id)

      let line = 1
      let lastIndex = 0
      const result = code.replace(/<([a-z][a-zA-Z0-9]*)\b/g, (match, _tag, offset) => {
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
