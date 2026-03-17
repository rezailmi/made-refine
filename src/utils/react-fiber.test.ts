import { describe, expect, it } from 'vitest'
import {
  isComponentPrimitivePath,
  getComponentProps,
  getCallSiteSource,
  deriveDefinitionSource,
  classifyComponentFiber,
} from './react-fiber'

describe('isComponentPrimitivePath', () => {
  it('matches /components/ui/ paths', () => {
    expect(isComponentPrimitivePath('src/components/ui/button.tsx')).toBe(true)
    expect(isComponentPrimitivePath('/project/src/components/ui/input.tsx')).toBe(true)
  })

  it('matches /ui/primitives/ paths', () => {
    expect(isComponentPrimitivePath('src/ui/primitives/select.tsx')).toBe(true)
  })

  it('matches /design-system/ paths', () => {
    expect(isComponentPrimitivePath('packages/design-system/button.tsx')).toBe(true)
  })

  it('matches npm UI library packages', () => {
    expect(isComponentPrimitivePath('node_modules/@radix-ui/react-dialog/dist/index.mjs')).toBe(true)
    expect(isComponentPrimitivePath('node_modules/@base-ui/react/Button.js')).toBe(true)
    expect(isComponentPrimitivePath('node_modules/@chakra-ui/react/dist/button.js')).toBe(true)
    expect(isComponentPrimitivePath('node_modules/@headlessui/react/dist/headlessui.esm.js')).toBe(true)
    expect(isComponentPrimitivePath('node_modules/@mantine/core/esm/Button.js')).toBe(true)
    expect(isComponentPrimitivePath('node_modules/@mui/material/Button/Button.js')).toBe(true)
    expect(isComponentPrimitivePath('node_modules/@ark-ui/react/dist/index.js')).toBe(true)
  })

  it('excludes framework internals', () => {
    expect(isComponentPrimitivePath('node_modules/react/cjs/react.development.js')).toBe(false)
    expect(isComponentPrimitivePath('node_modules/react-dom/cjs/react-dom.development.js')).toBe(false)
    expect(isComponentPrimitivePath('node_modules/next/dist/client/page-loader.js')).toBe(false)
    expect(isComponentPrimitivePath('node_modules/scheduler/cjs/scheduler.development.js')).toBe(false)
  })

  it('does not match broad /components/ paths (app-level)', () => {
    expect(isComponentPrimitivePath('src/components/dashboard/revenue-chart.tsx')).toBe(false)
    expect(isComponentPrimitivePath('src/components/auth/login-form.tsx')).toBe(false)
  })

  it('does not match random app files', () => {
    expect(isComponentPrimitivePath('src/app/page.tsx')).toBe(false)
    expect(isComponentPrimitivePath('src/routes/home.tsx')).toBe(false)
    expect(isComponentPrimitivePath('src/lib/utils.ts')).toBe(false)
  })

  it('normalizes backslashes', () => {
    expect(isComponentPrimitivePath('src\\components\\ui\\button.tsx')).toBe(true)
  })
})

describe('getComponentProps', () => {
  it('returns filtered props excluding framework keys', () => {
    const fiber = {
      memoizedProps: {
        variant: 'primary',
        size: 'lg',
        className: 'btn-primary',
        style: { color: 'red' },
        children: 'Click me',
        ref: {},
        key: 'btn-1',
        render: () => null,
      },
    }
    const props = getComponentProps(fiber)
    expect(props).toEqual({ variant: 'primary', size: 'lg' })
  })

  it('excludes data-* attributes', () => {
    const fiber = {
      memoizedProps: {
        href: '/path',
        'data-testid': 'my-button',
        'data-state': 'open',
      },
    }
    const props = getComponentProps(fiber)
    expect(props).toEqual({ href: '/path' })
  })

  it('serializes functions as [function]', () => {
    const fiber = {
      memoizedProps: {
        onClick: () => {},
        variant: 'default',
      },
    }
    const props = getComponentProps(fiber)
    expect(props).toEqual({ onClick: '[function]', variant: 'default' })
  })

  it('serializes React elements as [element]', () => {
    const fiber = {
      memoizedProps: {
        icon: { $$typeof: Symbol.for('react.element'), type: 'svg', props: {} },
        label: 'Submit',
      },
    }
    const props = getComponentProps(fiber)
    expect(props).toEqual({ icon: '[element]', label: 'Submit' })
  })

  it('handles circular references safely', () => {
    const circular: Record<string, unknown> = { name: 'test' }
    circular.self = circular
    const fiber = {
      memoizedProps: {
        config: circular,
        label: 'ok',
      },
    }
    const props = getComponentProps(fiber)
    expect(props).toEqual({ config: '[object]', label: 'ok' })
  })

  it('skips Symbol values', () => {
    const fiber = {
      memoizedProps: {
        [Symbol('internal')]: 'hidden',
        type: Symbol.for('card'),
        visible: true,
      },
    }
    const props = getComponentProps(fiber)
    // Symbol keys won't be iterated by Object.entries
    // Symbol values are skipped by serializePropValue
    expect(props).toEqual({ visible: true })
  })

  it('returns empty object for null/undefined fiber', () => {
    expect(getComponentProps(null)).toEqual({})
    expect(getComponentProps(undefined)).toEqual({})
  })

  it('falls back to pendingProps', () => {
    const fiber = {
      pendingProps: {
        variant: 'outline',
        disabled: true,
      },
    }
    const props = getComponentProps(fiber)
    expect(props).toEqual({ variant: 'outline', disabled: true })
  })
})

describe('getCallSiteSource', () => {
  it('extracts from _debugSource', () => {
    const fiber = {
      _debugSource: {
        fileName: 'src/app/page.tsx',
        lineNumber: 42,
        columnNumber: 5,
      },
    }
    expect(getCallSiteSource(fiber)).toEqual({
      file: 'src/app/page.tsx',
      line: 42,
      column: 5,
    })
  })

  it('falls back to pendingProps.__source', () => {
    const fiber = {
      pendingProps: {
        __source: {
          fileName: 'src/routes/home.tsx',
          lineNumber: 10,
          columnNumber: 3,
        },
      },
    }
    expect(getCallSiteSource(fiber)).toEqual({
      file: 'src/routes/home.tsx',
      line: 10,
      column: 3,
    })
  })

  it('returns null for null/undefined fiber', () => {
    expect(getCallSiteSource(null)).toBeNull()
    expect(getCallSiteSource(undefined)).toBeNull()
  })

  it('returns null when no source available', () => {
    expect(getCallSiteSource({ type: 'div' })).toBeNull()
  })
})

describe('deriveDefinitionSource', () => {
  it('returns the first frame matching a component primitive path', () => {
    const frames = [
      { name: 'Button', file: 'src/components/ui/button.tsx', line: 7, column: 5 },
      { name: 'Page', file: 'src/app/page.tsx', line: 42 },
    ]
    expect(deriveDefinitionSource(frames)).toEqual({
      file: 'src/components/ui/button.tsx',
      line: 7,
      column: 5,
    })
  })

  it('returns null when no frames match component paths', () => {
    const frames = [
      { name: 'AppCard', file: 'src/components/app-card.tsx', line: 10 },
      { name: 'Page', file: 'src/app/page.tsx', line: 42 },
    ]
    expect(deriveDefinitionSource(frames)).toBeNull()
  })

  it('returns null for empty frames', () => {
    expect(deriveDefinitionSource([])).toBeNull()
  })

  it('skips frames without file', () => {
    const frames = [
      { name: 'Button' },
      { name: 'Input', file: 'src/components/ui/input.tsx', line: 3 },
    ]
    expect(deriveDefinitionSource(frames)).toEqual({
      file: 'src/components/ui/input.tsx',
      line: 3,
      column: undefined,
    })
  })
})

describe('classifyComponentFiber', () => {
  it('returns isComponentPrimitive true when element source file matches', () => {
    const fiber = {
      _debugSource: {
        fileName: 'src/app/page.tsx',
        lineNumber: 42,
      },
    }
    expect(classifyComponentFiber(fiber, [], 'src/components/ui/button.tsx').isComponentPrimitive).toBe(true)
  })

  it('returns isComponentPrimitive true when call site matches', () => {
    const fiber = {
      _debugSource: {
        fileName: 'src/components/ui/button.tsx',
        lineNumber: 7,
        columnNumber: 5,
      },
    }
    expect(classifyComponentFiber(fiber, []).isComponentPrimitive).toBe(true)
  })

  it('returns isComponentPrimitive true when reactStack frames match', () => {
    const fiber = {
      _debugSource: {
        fileName: 'src/app/page.tsx',
        lineNumber: 42,
      },
    }
    const frames = [
      { name: 'Button', file: 'src/components/ui/button.tsx', line: 7 },
    ]
    expect(classifyComponentFiber(fiber, frames).isComponentPrimitive).toBe(true)
  })

  it('returns false for app components', () => {
    const fiber = {
      _debugSource: {
        fileName: 'src/app/page.tsx',
        lineNumber: 42,
      },
    }
    const frames = [
      { name: 'AppCard', file: 'src/components/app-card.tsx', line: 10 },
    ]
    expect(classifyComponentFiber(fiber, frames).isComponentPrimitive).toBe(false)
  })

  it('returns false for null fiber', () => {
    expect(classifyComponentFiber(null, []).isComponentPrimitive).toBe(false)
  })
})
