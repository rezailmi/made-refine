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
        const preloadScript = `<script src="/@fs/${path.dirname(require.resolve('made-refine'))}/dist/preload/preload.js"></script>`
        return html.replace('<head>', `<head>\n    ${preloadScript}`)
      },
    },
  }
}

// Babel plugin path for @vitejs/plugin-react integration:
// babel: { plugins: [require.resolve('made-refine/babel')] }

export default madeRefine
