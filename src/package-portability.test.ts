// @vitest-environment node

import { execSync } from 'node:child_process'
import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'
import { beforeAll, describe, expect, it } from 'vitest'

const root = process.cwd()
const requiredDistArtifacts = [
  'dist/index.js',
  'dist/index.mjs',
  'dist/styles.css',
  'dist/preload/preload.js',
  'dist/vite.mjs',
  'dist/vite.d.ts',
  'dist/babel.cjs',
  'dist/mcp.cjs',
] as const

function ensureDistArtifacts() {
  const missing = requiredDistArtifacts.some((relativePath) => !existsSync(path.join(root, relativePath)))
  if (!missing) return
  execSync('bun run build', { cwd: root, stdio: 'pipe' })
}

function getPackedFiles(): string[] {
  const output = execSync('bun pm pack --dry-run', {
    cwd: root,
    encoding: 'utf8',
  })
  return output
    .split('\n')
    .map((line) => line.match(/^packed\s+\S+\s+(.+)$/)?.[1]?.trim())
    .filter((file): file is string => Boolean(file))
}

describe('package portability', () => {
  beforeAll(() => {
    ensureDistArtifacts()
  })

  it('ships required runtime artifacts in bun pack output', () => {
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
        'dist/mcp.cjs',
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

  it('keeps MCP runtime deps bundled in the distributed mcp binary', () => {
    const mcpBundle = readFileSync(path.join(root, 'dist/mcp.cjs'), 'utf8')
    expect(mcpBundle).not.toMatch(/\brequire\((['"])zod\1\)/)
    expect(mcpBundle).not.toMatch(/\brequire\((['"])@modelcontextprotocol\/sdk(?:\/[^'"]*)?\1\)/)
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
