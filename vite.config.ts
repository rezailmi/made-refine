import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'
import type { Plugin } from 'vite'

/**
 * Inline source-location transform for the dev app.
 * Adds data-direct-edit-source attributes to lowercase JSX tags
 * so the DirectEdit panel can locate source files.
 *
 * Adapted from vite/index.ts but avoids the issues with
 * require.resolve('made-refine') and path-based filtering.
 */
function devSourceLocations(): Plugin {
  let root = ''

  return {
    name: 'dev-source-locations',
    enforce: 'pre',
    configResolved(config) {
      root = config.root
    },
    transform(code, id) {
      if (!/\.[jt]sx$/.test(id)) return null
      if (id.includes('node_modules')) return null
      // Only instrument the dev app files, not the library source
      if (!id.startsWith(path.resolve(root))) return null

      const relativePath = path.relative(root, id)

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

export default defineConfig({
  root: 'dev',
  plugins: [
    tailwindcss(),
    devSourceLocations(),
    react(),
  ],
  server: {
    port: 3000,
  },
})
