import { afterEach, describe, expect, it } from 'vitest'
import {
  buildColorTokenIndexFromVariables,
  collectThemeVariables,
  colorClassToVarName,
  invalidateColorTokenIndex,
  looksLikeColor,
  resolveTokenColor,
  resolveVarChain,
  tokenForColorClass,
  tokenForColorValue,
  tokenFromCssValue,
  typographyTokenForProperty,
  varForClassRule,
  type ThemeVariable,
} from './design-tokens'
import { parseColorValue } from './color'

// ---- collectThemeVariables (DOM-backed) ----

describe('collectThemeVariables', () => {
  const injected: HTMLStyleElement[] = []

  function injectStyle(css: string): HTMLStyleElement {
    const el = document.createElement('style')
    el.textContent = css
    document.head.appendChild(el)
    injected.push(el)
    return el
  }

  afterEach(() => {
    for (const el of injected.splice(0)) el.remove()
  })

  it('collects --* declarations from :root with scope "base"', () => {
    injectStyle(':root{--color-primary:#3B82F6;--color-blue-500:#3B82F6;--brand:rgb(10 20 30)}')
    const vars = collectThemeVariables(document)
    const byName = new Map(vars.map((v) => [v.name, v]))
    expect(byName.get('--color-primary')?.scope).toBe('base')
    expect(byName.get('--color-blue-500')?.scope).toBe('base')
    expect(byName.get('--brand')?.scope).toBe('base')
    expect(byName.get('--color-primary')?.rawValue).toBe('#3B82F6')
  })

  it('marks root-like dark declarations with scope "dark"', () => {
    // The Step 1 ROOT_SELECTOR_RE only treats :root / :host(...) / html segments
    // as root-like, so dark scope is detected when the dark hint co-occurs with a
    // root-like selector (here :host([data-theme="dark"]) — the Shadow-DOM form).
    injectStyle(':host([data-theme="dark"]){--color-primary:#111}')
    const vars = collectThemeVariables(document)
    const entry = vars.find((v) => v.name === '--color-primary' && v.rawValue === '#111')
    expect(entry?.scope).toBe('dark')
  })

  it('skips a bare .dark{} block (not root-like under ROOT_SELECTOR_RE)', () => {
    // Documents the actual behavior of the verbatim Step 1 code: a standalone
    // `.dark` selector is not root-like, so its declarations are not collected.
    injectStyle('.dark{--only-in-dark:#abcdef}')
    const vars = collectThemeVariables(document)
    expect(vars.find((v) => v.name === '--only-in-dark')).toBeUndefined()
  })

  it('marks prefers-color-scheme: dark media declarations as "dark"', () => {
    injectStyle('@media (prefers-color-scheme: dark){:root{--color-primary:#222}}')
    const vars = collectThemeVariables(document)
    const entry = vars.find((v) => v.name === '--color-primary' && v.rawValue === '#222')
    expect(entry?.scope).toBe('dark')
  })

  it('does NOT collect --* from non-root selectors', () => {
    injectStyle('.btn{--x:#fff}')
    const vars = collectThemeVariables(document)
    expect(vars.find((v) => v.name === '--x')).toBeUndefined()
  })
})

// ---- resolveVarChain (pure) ----

describe('resolveVarChain', () => {
  it('walks an alias chain to the terminal literal', () => {
    const byName = new Map<string, string>([
      ['--color-primary', 'var(--color-blue-500)'],
      ['--color-blue-500', '#3B82F6'],
    ])
    expect(resolveVarChain('--color-primary', byName)).toEqual([
      '--color-primary',
      '--color-blue-500',
      '#3B82F6',
    ])
  })

  it('terminates on cycles without hanging', () => {
    const byName = new Map<string, string>([
      ['--a', 'var(--b)'],
      ['--b', 'var(--a)'],
    ])
    const chain = resolveVarChain('--a', byName)
    expect(chain).toEqual(['--a', '--b'])
  })

  it('returns [name] when the alias target is missing', () => {
    const byName = new Map<string, string>([['--a', 'var(--missing)']])
    expect(resolveVarChain('--a', byName)).toEqual(['--a', '--missing'])
  })
})

// ---- resolveTokenColor (pure) ----

describe('resolveTokenColor', () => {
  it('parses a hex terminal to a ColorValue', () => {
    const byName = new Map<string, string>([['--color-primary', '#3B82F6']])
    expect(resolveTokenColor('--color-primary', byName)).toEqual(parseColorValue('#3B82F6'))
  })

  it('parses an rgb() terminal to a ColorValue', () => {
    const byName = new Map<string, string>([['--brand', 'rgb(10 20 30)']])
    const result = resolveTokenColor('--brand', byName)
    expect(result?.hex).toBe('0A141E')
    expect(result?.alpha).toBe(100)
  })

  it('returns null for a channel fragment (fails looksLikeColor)', () => {
    const byName = new Map<string, string>([['--background', '0 0% 100%']])
    expect(resolveTokenColor('--background', byName)).toBeNull()
  })

  it('returns null when the alias chain ends at a missing token', () => {
    const byName = new Map<string, string>([['--a', 'var(--missing)']])
    expect(resolveTokenColor('--a', byName)).toBeNull()
  })
})

// ---- looksLikeColor (pure) ----

describe('looksLikeColor', () => {
  it('accepts hex, color functions, and named colors', () => {
    expect(looksLikeColor('#3B82F6')).toBe(true)
    expect(looksLikeColor('rgb(1 2 3)')).toBe(true)
    expect(looksLikeColor('oklch(0.5 0.1 200)')).toBe(true)
    expect(looksLikeColor('rebeccapurple')).toBe(true)
    expect(looksLikeColor('transparent')).toBe(true)
  })

  it('rejects empty, none, and channel fragments', () => {
    expect(looksLikeColor('')).toBe(false)
    expect(looksLikeColor('none')).toBe(false)
    expect(looksLikeColor('0 0% 100%')).toBe(false)
  })
})

// ---- buildColorTokenIndexFromVariables (pure) ----

describe('buildColorTokenIndexFromVariables', () => {
  function base(name: string, rawValue: string): ThemeVariable {
    return { name, rawValue, scope: 'base', selector: ':root' }
  }

  it('excludes non-color tokens from byName', () => {
    const index = buildColorTokenIndexFromVariables([
      base('--color-primary', '#3B82F6'),
      base('--spacing', '4px'),
      base('--background', '0 0% 100%'),
    ])
    expect(index.byName.has('--color-primary')).toBe(true)
    expect(index.byName.has('--spacing')).toBe(false)
    expect(index.byName.has('--background')).toBe(false)
  })

  it('reverse lookup ranks semantic tokens before palette tokens', () => {
    const index = buildColorTokenIndexFromVariables([
      base('--color-blue-500', '#3B82F6'),
      base('--color-primary', '#3B82F6'),
    ])
    const list = index.byColor.get('3B82F6:100')
    expect(list?.[0]).toBe('--color-primary')
    expect(list).toContain('--color-blue-500')
  })

  it('resolves alias chains when building the index', () => {
    const index = buildColorTokenIndexFromVariables([
      base('--color-primary', 'var(--color-blue-500)'),
      base('--color-blue-500', '#3B82F6'),
    ])
    expect(index.byName.get('--color-primary')?.value).toEqual(parseColorValue('#3B82F6'))
  })
})

// ---- colorClassToVarName (pure) ----

describe('colorClassToVarName', () => {
  it('maps semantic and palette classes', () => {
    expect(colorClassToVarName('bg-primary')).toBe('--color-primary')
    expect(colorClassToVarName('text-foreground')).toBe('--color-foreground')
    expect(colorClassToVarName('bg-blue-500')).toBe('--color-blue-500')
  })

  it('strips the opacity modifier', () => {
    expect(colorClassToVarName('bg-primary/50')).toBe('--color-primary')
  })

  it('maps arbitrary var() values and rejects arbitrary literals', () => {
    expect(colorClassToVarName('bg-[var(--brand)]')).toBe('--brand')
    expect(colorClassToVarName('bg-[#fff]')).toBeNull()
  })
})

// ---- tokenForColorClass (pure, index-backed) ----

describe('tokenForColorClass', () => {
  const index = buildColorTokenIndexFromVariables([
    { name: '--color-primary', rawValue: '#3B82F6', scope: 'base', selector: ':root' },
  ])

  it('returns the bound token for the matching property', () => {
    expect(tokenForColorClass('background-color', ['bg-primary', 'flex'], index)).toBe('--color-primary')
  })

  it('returns null when no class governs the property', () => {
    expect(tokenForColorClass('color', ['bg-primary', 'flex'], index)).toBeNull()
  })
})

// ---- tokenForColorValue (pure, index-backed) ----

describe('tokenForColorValue', () => {
  const index = buildColorTokenIndexFromVariables([
    { name: '--color-primary', rawValue: '#3B82F6', scope: 'base', selector: ':root' },
  ])

  it('returns the token whose value matches', () => {
    expect(tokenForColorValue(parseColorValue('#3B82F6'), index)).toBe('--color-primary')
  })

  it('returns null for an unmatched value', () => {
    expect(tokenForColorValue(parseColorValue('#000000'), index)).toBeNull()
  })
})

// ---- tokenFromCssValue (pure) ----

describe('tokenFromCssValue', () => {
  it('extracts the variable name from a var() value', () => {
    expect(tokenFromCssValue('var(--color-primary)')).toBe('--color-primary')
  })

  it('extracts the variable name when a fallback is present', () => {
    expect(tokenFromCssValue('var(--x, #fff)')).toBe('--x')
  })

  it('returns null for a literal color', () => {
    expect(tokenFromCssValue('#3B82F6')).toBeNull()
  })

  it('returns null for empty or undefined input', () => {
    expect(tokenFromCssValue('')).toBeNull()
    expect(tokenFromCssValue(undefined)).toBeNull()
    expect(tokenFromCssValue(null)).toBeNull()
  })
})

// ---- typographyTokenForProperty (pure) ----

describe('typographyTokenForProperty', () => {
  it('returns the matched utility class per property', () => {
    expect(typographyTokenForProperty('font-size', ['text-base', 'font-semibold'])).toBe('text-base')
    expect(typographyTokenForProperty('font-weight', ['text-base', 'font-semibold'])).toBe('font-semibold')
    expect(typographyTokenForProperty('line-height', ['leading-7'])).toBe('leading-7')
  })

  it('attributes arbitrary values', () => {
    expect(typographyTokenForProperty('font-size', ['text-[17px]'])).toBe('text-[17px]')
  })

  it('returns null when nothing matches', () => {
    expect(typographyTokenForProperty('font-size', [])).toBeNull()
  })
})

// ---- varForClassRule + tokenForColorClass fallback (DOM-backed) ----

describe('varForClassRule', () => {
  const injected: HTMLStyleElement[] = []

  function injectStyle(css: string): HTMLStyleElement {
    const el = document.createElement('style')
    el.textContent = css
    document.head.appendChild(el)
    injected.push(el)
    return el
  }

  afterEach(() => {
    for (const el of injected.splice(0)) el.remove()
    invalidateColorTokenIndex()
  })

  it('recovers the real variable from a generated utility rule', () => {
    injectStyle('.bg-primary{background-color:var(--primary)}')
    expect(varForClassRule('bg-primary', ['background-color'])).toBe('--primary')
  })

  it('returns null when no rule matches', () => {
    expect(varForClassRule('bg-primary', ['background-color'])).toBeNull()
  })

  it('falls back to the recovered var for shadcn @theme inline tokens', () => {
    // Only `--primary` lives in :root (the @theme inline `--color-primary` is not
    // emitted), but the generated utility rule assigns `var(--primary)`.
    injectStyle(':root{--primary:#171717}.bg-primary{background-color:var(--primary)}')
    const index = buildColorTokenIndexFromVariables(collectThemeVariables(document))
    expect(index.byName.has('--color-primary')).toBe(false)
    expect(tokenForColorClass('background-color', ['bg-primary'], index)).toBe('--primary')
  })
})
