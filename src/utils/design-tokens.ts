import type { ColorValue } from '../types'
import { parseColorValue } from './color'
import { attributeClassesForProperty } from './tailwind-attribution'

export interface ThemeVariable {
  /** Custom property name including the leading dashes, e.g. '--color-primary'. */
  name: string
  /** Declared value as written, e.g. 'var(--color-blue-500)' or 'oklch(...)' or '#3B82F6'. */
  rawValue: string
  /** Which color scheme the declaration targets. */
  scope: 'base' | 'dark'
  /** The selector text of the rule it came from (for debugging). */
  selector: string
}

// Selectors we treat as "root-like" — where global design tokens live.
const ROOT_SELECTOR_RE = /(^|,)\s*(:root|:host(\([^)]*\))?|html)\s*(,|$)/i
// Dark-scope hints in a selector (shadcn `.dark`, data-theme, prefers-color-scheme handled via media).
const DARK_SELECTOR_RE = /\.dark\b|\[data-theme=["']?dark["']?\]|:host\(\[data-theme=["']?dark["']?\]\)/i

function scopeForSelector(selector: string, inDarkMedia: boolean): 'base' | 'dark' {
  if (inDarkMedia) return 'dark'
  return DARK_SELECTOR_RE.test(selector) ? 'dark' : 'base'
}

function collectFromRuleList(
  rules: CSSRuleList,
  out: ThemeVariable[],
  inDarkMedia: boolean,
): void {
  for (const rule of Array.from(rules)) {
    // Style rule: read --* declarations if its selector is root-like.
    if (rule instanceof CSSStyleRule) {
      if (!ROOT_SELECTOR_RE.test(rule.selectorText)) continue
      const scope = scopeForSelector(rule.selectorText, inDarkMedia)
      const style = rule.style
      for (let i = 0; i < style.length; i++) {
        const prop = style.item(i)
        if (!prop.startsWith('--')) continue
        out.push({
          name: prop,
          rawValue: style.getPropertyValue(prop).trim(),
          scope,
          selector: rule.selectorText,
        })
      }
      continue
    }
    // @media — descend; flag dark when the query mentions prefers-color-scheme: dark.
    if (rule instanceof CSSMediaRule) {
      const isDark = /prefers-color-scheme\s*:\s*dark/i.test(rule.conditionText || rule.media.mediaText)
      collectFromRuleList(rule.cssRules, out, inDarkMedia || isDark)
      continue
    }
    // @layer (Tailwind v4 wraps theme in `@layer theme`) and @supports — descend.
    // Use duck-typing for CSSLayerBlockRule (not in all TS lib versions).
    const maybeGrouping = rule as CSSRule & { cssRules?: CSSRuleList }
    if (maybeGrouping.cssRules && typeof maybeGrouping.cssRules.length === 'number') {
      collectFromRuleList(maybeGrouping.cssRules, out, inDarkMedia)
    }
  }
}

export function collectThemeVariables(doc: Document = document): ThemeVariable[] {
  const out: ThemeVariable[] = []
  for (const sheet of Array.from(doc.styleSheets)) {
    let rules: CSSRuleList
    try {
      rules = sheet.cssRules // throws for cross-origin sheets
    } catch {
      continue
    }
    collectFromRuleList(rules, out, false)
  }
  return out
}

/** True for terminal values that name a CSS color (not a channel fragment like '0 0% 100%'). */
export function looksLikeColor(value: string): boolean {
  const v = value.trim().toLowerCase()
  if (!v) return false
  if (v.startsWith('#')) return true
  if (/^(rgb|rgba|hsl|hsla|oklch|oklab|lab|lch|color|hwb)\s*\(/.test(v)) return true
  // Named colors and keywords we accept; reject bare numbers/channels.
  if (/^[a-z]+$/.test(v) && v !== 'none' && v !== 'transparent') return true
  if (v === 'transparent') return true
  return false
}

const VAR_REF_RE = /^var\(\s*(--[\w-]+)\s*(?:,\s*(.*))?\)$/

/**
 * Walk the var() alias chain for `name` textually, returning the ordered list of
 * token names visited and the terminal literal value (last element is the literal,
 * earlier elements are '--name' tokens). Returns [] if name is unknown.
 * Guards against cycles.
 */
export function resolveVarChain(name: string, byName: Map<string, string>): string[] {
  const chain: string[] = []
  const seen = new Set<string>()
  let current: string | null = name
  while (current && current.startsWith('--')) {
    if (seen.has(current)) break // cycle guard
    seen.add(current)
    chain.push(current)
    const raw = byName.get(current)
    if (raw == null) break
    const m = raw.trim().match(VAR_REF_RE)
    if (m) {
      current = m[1] // follow the alias
    } else {
      chain.push(raw.trim()) // terminal literal
      current = null
    }
  }
  return chain
}

/** Resolve a token to a ColorValue via textual chain walk + parseColorValue. Null if not a color. */
export function resolveTokenColor(name: string, byName: Map<string, string>): ColorValue | null {
  const chain = resolveVarChain(name, byName)
  if (chain.length === 0) return null
  const terminal = chain[chain.length - 1]
  if (terminal.startsWith('--')) return null // unresolved alias (target missing)
  if (!looksLikeColor(terminal)) return null
  const parsed = parseColorValue(terminal)
  // parseColorValue never throws but returns black for unparseable input; the
  // looksLikeColor guard above already filters channel fragments.
  return parsed
}

export interface ColorTokenEntry {
  name: string // '--color-primary'
  value: ColorValue // resolved terminal color
  rawValue: string // declared value (may be a var alias)
  scope: 'base' | 'dark'
}

export interface ColorTokenIndex {
  byName: Map<string, ColorTokenEntry>
  /** 'HEX:ALPHA' -> token names, best (most semantic) first. */
  byColor: Map<string, string[]>
}

function colorKey(c: ColorValue): string {
  return `${c.hex}:${c.alpha}`
}

// Lower rank sorts first in reverse lookup. Semantic names beat palette names
// (e.g. --color-primary before --color-blue-500), shorter beats longer.
const PALETTE_RE = /^--color-[a-z]+-\d+$/
export function tokenPreferenceRank(name: string): number {
  if (name.startsWith('--color-') && !PALETTE_RE.test(name)) return 0
  if (PALETTE_RE.test(name)) return 1
  if (name.startsWith('--color-')) return 2
  return 3
}

export function buildColorTokenIndexFromVariables(vars: ThemeVariable[]): ColorTokenIndex {
  const byNameRaw = new Map<string, string>()
  // Base scope wins for the default index; last declaration wins on duplicates.
  for (const v of vars) {
    if (v.scope === 'base') byNameRaw.set(v.name, v.rawValue)
  }
  // If a token only exists in dark scope, still index it.
  for (const v of vars) {
    if (!byNameRaw.has(v.name)) byNameRaw.set(v.name, v.rawValue)
  }

  const byName = new Map<string, ColorTokenEntry>()
  for (const [name, rawValue] of byNameRaw) {
    const value = resolveTokenColor(name, byNameRaw)
    if (!value) continue
    const scope = vars.find((v) => v.name === name)?.scope ?? 'base'
    byName.set(name, { name, value, rawValue, scope })
  }

  const byColor = new Map<string, string[]>()
  for (const entry of byName.values()) {
    const key = colorKey(entry.value)
    const list = byColor.get(key) ?? []
    list.push(entry.name)
    byColor.set(key, list)
  }
  for (const [key, list] of byColor) {
    list.sort((a, b) => tokenPreferenceRank(a) - tokenPreferenceRank(b) || a.length - b.length)
    byColor.set(key, list)
  }

  return { byName, byColor }
}

// ---- Cached live entry point (browser) ----
let cachedIndex: ColorTokenIndex | null = null

export function getColorTokenIndex(doc: Document = document): ColorTokenIndex {
  if (cachedIndex) return cachedIndex
  cachedIndex = buildColorTokenIndexFromVariables(collectThemeVariables(doc))
  return cachedIndex
}

export function invalidateColorTokenIndex(): void {
  cachedIndex = null
}

// Utility prefixes whose argument is a color token name.
const COLOR_CLASS_PREFIXES = ['bg', 'text', 'border', 'outline', 'ring', 'fill', 'stroke', 'from', 'via', 'to', 'decoration', 'divide', 'accent', 'caret', 'shadow']

/**
 * Map a single Tailwind color class to its CSS variable name.
 *   bg-primary        -> --color-primary
 *   text-foreground   -> --color-foreground
 *   bg-blue-500       -> --color-blue-500
 *   bg-primary/50     -> --color-primary  (opacity modifier stripped)
 *   bg-[var(--brand)] -> --brand
 *   bg-[#fff]         -> null (arbitrary literal, no token)
 * Returns null for classes that don't carry a token.
 */
export function colorClassToVarName(cls: string): string | null {
  // strip leading '!' important and any variant prefixes (handled by caller, but be safe)
  const base = cls.replace(/^!/, '')
  // strip opacity modifier: split on '/' that is not inside brackets
  const slash = base.indexOf('/')
  const noOpacity = slash > -1 && !base.includes('[') ? base.slice(0, slash) : base

  const dash = noOpacity.indexOf('-')
  if (dash === -1) return null
  const prefix = noOpacity.slice(0, dash)
  if (!COLOR_CLASS_PREFIXES.includes(prefix)) return null
  const rest = noOpacity.slice(dash + 1)

  // Arbitrary value: bg-[var(--brand)] or bg-[#fff]
  if (rest.startsWith('[') && rest.endsWith(']')) {
    const inner = rest.slice(1, -1)
    const m = inner.match(/^var\(\s*(--[\w-]+)\s*(?:,.*)?\)$/)
    return m ? m[1] : null
  }
  if (!/^[a-z]/.test(rest)) return null
  return `--color-${rest}`
}

/**
 * Given a CSS property + the element's class list, return the bound color token
 * name, verified to exist in `index`. Uses class attribution to pick the right class.
 */
export function tokenForColorClass(
  cssProperty: string,
  classList: string[],
  index: ColorTokenIndex,
): string | null {
  const { matchedClasses } = attributeClassesForProperty(cssProperty, classList)
  for (const cls of matchedClasses) {
    const varName = colorClassToVarName(cls)
    if (varName && index.byName.has(varName)) return varName
  }
  return null
}

/** Reverse-map a resolved color to the best matching token name (fallback path). */
export function tokenForColorValue(value: ColorValue, index: ColorTokenIndex): string | null {
  const list = index.byColor.get(`${value.hex}:${value.alpha}`)
  return list && list.length > 0 ? list[0] : null
}

/**
 * Resolve a color token for display: prefer the class binding, fall back to value.
 * Returns the var name or null.
 */
export function resolveColorToken(
  cssProperty: string,
  classList: string[],
  value: ColorValue,
  index: ColorTokenIndex = getColorTokenIndex(),
): string | null {
  return tokenForColorClass(cssProperty, classList, index) ?? tokenForColorValue(value, index)
}

/** Extract the variable name from a CSS value like `var(--color-primary)` (or with a fallback). */
export function tokenFromCssValue(cssValue: string | undefined | null): string | null {
  if (!cssValue) return null
  const m = cssValue.trim().match(/^var\(\s*(--[\w-]+)\s*(?:,.*)?\)$/)
  return m ? m[1] : null
}

/** Ordered alias chain for the popover, e.g. ['--color-primary','--color-blue-500','#3B82F6']. */
export function getTokenAliasChain(name: string, doc: Document = document): string[] {
  const vars = collectThemeVariables(doc)
  const byName = new Map<string, string>()
  for (const v of vars) if (v.scope === 'base' || !byName.has(v.name)) byName.set(v.name, v.rawValue)
  return resolveVarChain(name, byName)
}

/**
 * Return the Tailwind utility class on the element that sets `cssProperty`, or null.
 *   font-size      -> 'text-base' | 'text-lg' | null
 *   font-weight    -> 'font-semibold' | null
 *   line-height    -> 'leading-7' | null
 *   letter-spacing -> 'tracking-tight' | null
 * Only returns base (non-variant) classes — variant matches are ignored here.
 */
export function typographyTokenForProperty(cssProperty: string, classList: string[]): string | null {
  const { matchedClasses } = attributeClassesForProperty(cssProperty, classList)
  return matchedClasses.length > 0 ? matchedClasses[0] : null
}
