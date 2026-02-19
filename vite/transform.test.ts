import { afterEach, beforeEach, describe, expect, it } from 'vitest'

// Extract the transform logic for testing by importing the plugin and simulating a transform call
import { madeRefine } from './index'

const bootstrapEnvKeys = [
  'MADE_REFINE_MCP_BOOTSTRAP_URL',
  'VITE_MADE_REFINE_MCP_BOOTSTRAP_URL',
  'NEXT_PUBLIC_MADE_REFINE_MCP_BOOTSTRAP_URL',
] as const

function transform(code: string): string {
  const plugin = madeRefine()
  const hooks = plugin as Record<string, unknown>

  // Simulate configResolved
  const configResolved = hooks.configResolved as (config: unknown) => void
  configResolved({ command: 'serve', root: '/project' })

  // Call transform
  const transformFn = hooks.transform as (code: string, id: string) => { code: string; map: null } | null
  const result = transformFn(code, '/project/src/App.tsx')
  return result?.code ?? code
}

function transformIndexHtml(command: 'serve' | 'build', html = '<html><head></head><body></body></html>'): string {
  const plugin = madeRefine()
  const hooks = plugin as Record<string, unknown>
  const configResolved = hooks.configResolved as (config: unknown) => void
  configResolved({ command, root: '/project' })
  const indexTransform = hooks.transformIndexHtml as { handler: (input: string) => string }
  return indexTransform.handler(html)
}

describe('Vite JSX transform', () => {
  beforeEach(() => {
    for (const key of bootstrapEnvKeys) {
      delete process.env[key]
    }
  })

  afterEach(() => {
    for (const key of bootstrapEnvKeys) {
      delete process.env[key]
    }
  })

  it('injects bootstrap global in dev when env is present', () => {
    process.env.MADE_REFINE_MCP_BOOTSTRAP_URL = 'http://127.0.0.1:9011/v1/bootstrap'

    const html = transformIndexHtml('serve')

    expect(html).toContain('window.__MADE_REFINE_MCP_BOOTSTRAP_URL__')
    expect(html).toContain('http://127.0.0.1:9011/v1/bootstrap')
    expect(html).toContain('/preload/preload.js')
  })

  it('does not inject bootstrap global in dev when env is missing', () => {
    const html = transformIndexHtml('serve')
    expect(html).not.toContain('window.__MADE_REFINE_MCP_BOOTSTRAP_URL__')
  })

  it('does not inject bootstrap global outside dev mode', () => {
    process.env.MADE_REFINE_MCP_BOOTSTRAP_URL = 'http://127.0.0.1:9011/v1/bootstrap'
    const sourceHtml = '<html><head></head><body></body></html>'
    const html = transformIndexHtml('build', sourceHtml)
    expect(html).toBe(sourceHtml)
  })

  it('instruments a simple HTML tag', () => {
    const result = transform('<div className="foo">')
    expect(result).toContain('<div data-direct-edit-source=')
    expect(result).toContain('className="foo"')
  })

  it('handles kebab-case custom elements', () => {
    const result = transform('<my-card />')
    expect(result).toContain('<my-card data-direct-edit-source=')
    // Must NOT split the tag name
    expect(result).not.toMatch(/<my\s.*-card/)
  })

  it('handles multi-segment kebab-case elements', () => {
    const result = transform('<my-super-card />')
    expect(result).toContain('<my-super-card data-direct-edit-source=')
  })

  it('does not instrument tags inside single-quoted strings', () => {
    const code = `const s = '<div class="test">'`
    const result = transform(code)
    expect(result).not.toContain('data-direct-edit-source')
  })

  it('does not instrument tags inside double-quoted strings', () => {
    const code = `const s = "<div class='test'>"`
    const result = transform(code)
    expect(result).not.toContain('data-direct-edit-source')
  })

  it('does not instrument tags inside template literals', () => {
    const code = 'const s = `<div class="test">`'
    const result = transform(code)
    expect(result).not.toContain('data-direct-edit-source')
  })

  it('does not instrument tags inside single-line comments', () => {
    const code = '// <div className="test">'
    const result = transform(code)
    expect(result).not.toContain('data-direct-edit-source')
  })

  it('does not instrument tags inside block comments', () => {
    const code = '/* <div className="test"> */'
    const result = transform(code)
    expect(result).not.toContain('data-direct-edit-source')
  })

  it('instruments real JSX next to a string containing tags', () => {
    const code = `const s = '<div>'; return <span>hello</span>`
    const result = transform(code)
    // The string <div> should not be instrumented
    expect(result).not.toMatch(/<div data-direct-edit-source/)
    // The real JSX <span> should be instrumented
    expect(result).toContain('<span data-direct-edit-source=')
  })

  it('skips non-JSX files', () => {
    const plugin = madeRefine()
    const hooks = plugin as Record<string, unknown>
    const configResolved = hooks.configResolved as (config: unknown) => void
    configResolved({ command: 'serve', root: '/project' })
    const transformFn = hooks.transform as (code: string, id: string) => unknown
    expect(transformFn('<div />', '/project/src/App.ts')).toBeNull()
  })

  it('skips in production mode', () => {
    const plugin = madeRefine()
    const hooks = plugin as Record<string, unknown>
    const configResolved = hooks.configResolved as (config: unknown) => void
    configResolved({ command: 'build', root: '/project' })
    const transformFn = hooks.transform as (code: string, id: string) => unknown
    expect(transformFn('<div />', '/project/src/App.tsx')).toBeNull()
  })
})
