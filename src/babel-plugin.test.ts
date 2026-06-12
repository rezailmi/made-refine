// @vitest-environment node

import { createRequire } from 'node:module'
import { describe, expect, it } from 'vitest'

const require = createRequire(import.meta.url)
const directEditSourcePlugin = require('../babel/index.cjs')

/** Minimal types stub — visitor tests never invoke the visitor body, stubs suffice. */
const typeStub = {
  isJSXIdentifier: () => false,
  isJSXAttribute: () => false,
  jsxAttribute: () => ({}),
  jsxIdentifier: () => ({}),
  stringLiteral: () => ({}),
}

function makeApi(activeEnv: string) {
  return {
    types: typeStub,
    env: (name: string) => name === activeEnv,
  }
}

describe('directEditSourcePlugin', () => {
  it('returns a JSXOpeningElement visitor when env is development', () => {
    const { visitor } = directEditSourcePlugin(makeApi('development'))
    expect(typeof visitor.JSXOpeningElement).toBe('function')
  })

  it('returns an empty visitor when env is production', () => {
    const { visitor } = directEditSourcePlugin(makeApi('production'))
    expect(visitor).toEqual({})
  })

  it('returns an empty visitor when env is test (snapshot-pollution case)', () => {
    const { visitor } = directEditSourcePlugin(makeApi('test'))
    expect(visitor).toEqual({})
  })

  it('returns a JSXOpeningElement visitor when api has no env function (legacy backwards-compat)', () => {
    const { visitor } = directEditSourcePlugin({ types: typeStub })
    expect(typeof visitor.JSXOpeningElement).toBe('function')
  })
})
