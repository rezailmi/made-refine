// @vitest-environment node

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { describe, expect, it } from 'vitest'

const root = process.cwd()

function getPackedFiles(): string[] {
  const output = execSync('npm pack --dry-run --json', {
    cwd: root,
    encoding: 'utf8',
  })
  const parsed = JSON.parse(output) as Array<{ files: Array<{ path: string }> }>
  return parsed[0]?.files?.map((file) => file.path) ?? []
}

describe('npm package portability', () => {
  it('ships required runtime artifacts in npm pack output', () => {
    const files = getPackedFiles()
    expect(files).toEqual(
      expect.arrayContaining([
        'dist/index.js',
        'dist/index.mjs',
        'dist/index.d.ts',
        'dist/utils.js',
        'dist/utils.mjs',
        'dist/styles.css',
        'dist/preload/preload.js',
        'dist/vite.mjs',
        'dist/vite.d.ts',
        'dist/babel.cjs',
        'README.md',
        'LICENSE',
      ]),
    )
  })

  it('loads built cjs/esm/vite entrypoints', async () => {
    const cjsPath = path.join(root, 'dist/index.js')
    const esmPath = path.join(root, 'dist/index.mjs')
    const vitePath = path.join(root, 'dist/vite.mjs')

    expect(existsSync(cjsPath)).toBe(true)
    expect(existsSync(esmPath)).toBe(true)
    expect(existsSync(vitePath)).toBe(true)

    const require = createRequire(import.meta.url)
    const cjs = require(cjsPath) as { DirectEdit?: unknown }
    expect(typeof cjs.DirectEdit).toBe('function')

    const esm = await import(pathToFileURL(esmPath).href) as { DirectEdit?: unknown }
    expect(typeof esm.DirectEdit).toBe('function')

    const vite = await import(pathToFileURL(vitePath).href) as { madeRefine?: () => unknown }
    expect(typeof vite.madeRefine).toBe('function')
  })

  it('bundles css text directly in runtime bundle (no raw import path leaks)', () => {
    const bundle = readFileSync(path.join(root, 'dist/index.js'), 'utf8')
    expect(bundle).toContain('data-direct-edit-host')
    expect(bundle).not.toContain('?raw')
    expect(bundle).not.toContain('../dist/styles.css')
  })

  it('injects preload script and source markers through the Vite plugin in dev mode', async () => {
    const { madeRefine } = await import(pathToFileURL(path.join(root, 'dist/vite.mjs')).href) as {
      madeRefine: () => {
        configResolved?: (config: unknown) => void
        transformIndexHtml?: { handler: (html: string) => string | Promise<string> }
        transform?: (code: string, id: string) => { code: string; map: null } | null
      }
    }

    const plugin = madeRefine()
    plugin.configResolved?.({
      command: 'serve',
      root: path.join(root, 'dev'),
    })

    const htmlResult = await plugin.transformIndexHtml?.handler('<html><head></head><body></body></html>')
    expect(htmlResult).toContain('/@fs/')
    expect(htmlResult).toContain('/preload/preload.js')

    const transformed = plugin.transform?.('<div>\n  <button>Hi</button>\n</div>', path.join(root, 'dev/App.tsx'))
    expect(transformed).not.toBeNull()
    expect(transformed?.code).toContain('data-direct-edit-source="App.tsx:1:1"')
    expect(transformed?.code).toContain('data-direct-edit-source="App.tsx:2:3"')
  })
})
