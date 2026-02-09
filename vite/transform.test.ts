import { describe, expect, it } from 'vitest'

// Extract the transform logic for testing by importing the plugin and simulating a transform call
import { madeRefine } from './index'

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

describe('Vite JSX transform', () => {
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
