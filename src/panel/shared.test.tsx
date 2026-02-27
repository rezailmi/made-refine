import * as React from 'react'
import { fireEvent, render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { SectionNav, type SectionKey } from './shared'

function createSectionRefs(): Record<SectionKey, React.RefObject<HTMLDivElement | null>> {
  return {
    layout: React.createRef<HTMLDivElement>(),
    radius: React.createRef<HTMLDivElement>(),
    border: React.createRef<HTMLDivElement>(),
    shadow: React.createRef<HTMLDivElement>(),
    fill: React.createRef<HTMLDivElement>(),
    colors: React.createRef<HTMLDivElement>(),
    text: React.createRef<HTMLDivElement>(),
  }
}

describe('SectionNav', () => {
  it('consumes wheel events to scroll horizontally when tabs overflow', () => {
    const sectionRefs = createSectionRefs()
    const scrollEl = document.createElement('div')
    const scrollRef = { current: scrollEl } as React.RefObject<HTMLDivElement | null>

    const { container } = render(
      <SectionNav
        scrollRef={scrollRef}
        activeSection="layout"
        showColors={true}
        showText={true}
        sectionRefs={sectionRefs}
      />,
    )

    const nav = container.querySelector('[data-direct-edit="section-nav"]') as HTMLElement
    expect(nav).not.toBeNull()

    Object.defineProperty(nav, 'scrollWidth', { configurable: true, value: 420 })
    Object.defineProperty(nav, 'clientWidth', { configurable: true, value: 140 })
    Object.defineProperty(nav, 'scrollLeft', { configurable: true, writable: true, value: 0 })

    fireEvent.wheel(nav, { deltaY: 36 })
    expect(nav.scrollLeft).toBe(36)
  })
})
