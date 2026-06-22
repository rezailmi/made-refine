/**
 * Attribution roundtrip tests (plan 035, Step 9.2)
 *
 * For each CSS property/value pair that stylesToTailwind maps to a utility
 * class, assert that attributeClassesForProperty(prop, [class]).matchedClasses
 * includes that class.  This pins attribution against stylesToTailwind so that
 * adding an emitted utility without a matching attribution entry fails CI.
 */
import { describe, expect, it } from 'vitest'
import { stylesToTailwind } from '../utils'
import { attributeClassesForProperty } from './tailwind-attribution'

/** Assert that attributeClassesForProperty(prop,[cls]) reports cls as matched. */
function assertRoundtrip(prop: string, value: string) {
  const cls = stylesToTailwind({ [prop]: value })
  if (!cls) {
    throw new Error(
      `stylesToTailwind emitted nothing for ${prop}:${value} — fix the emission or remove this test`
    )
  }
  const { matchedClasses } = attributeClassesForProperty(prop, [cls])
  expect(matchedClasses, `${prop}:${value} → '${cls}' not attributed back to ${prop}`).toContain(
    cls
  )
}

describe('stylesToTailwind ↔ attributeClassesForProperty roundtrip', () => {
  it('padding', () => assertRoundtrip('padding', '16px'))
  it('padding-top', () => assertRoundtrip('padding-top', '8px'))
  it('margin', () => assertRoundtrip('margin', '8px'))
  it('margin-left', () => assertRoundtrip('margin-left', '4px'))
  it('gap', () => assertRoundtrip('gap', '8px'))
  it('width', () => assertRoundtrip('width', '100%'))
  it('border-width (all)', () => assertRoundtrip('border-width', '2px'))
  it('border-top-width', () => assertRoundtrip('border-top-width', '2px'))
  it('border-radius', () => assertRoundtrip('border-radius', '4px'))
  it('background-color', () => assertRoundtrip('background-color', '#FF0000'))
  it('background-color via bg-red-500 class round trips to background-color', () => {
    // bg-* is attributed to both 'background-color' and 'background'
    const { matchedClasses } = attributeClassesForProperty('background-color', ['bg-red-500'])
    expect(matchedClasses).toContain('bg-red-500')
  })
  it('background shorthand — bg-* attributed to background property', () => {
    // A bg-* class should also attribute to the background shorthand property
    const { matchedClasses } = attributeClassesForProperty('background', ['bg-red-500'])
    expect(matchedClasses).toContain('bg-red-500')
  })
  it('font-size', () => assertRoundtrip('font-size', '16px'))
  it('font-weight', () => assertRoundtrip('font-weight', '700'))
  it('opacity', () => assertRoundtrip('opacity', '50%'))
  it('overflow', () => assertRoundtrip('overflow', 'hidden'))
  it('object-fit', () => assertRoundtrip('object-fit', 'cover'))
  it('flex-wrap', () => assertRoundtrip('flex-wrap', 'wrap'))
  it('display (flex)', () => assertRoundtrip('display', 'flex'))
  it('flex-direction', () => assertRoundtrip('flex-direction', 'row'))
})
