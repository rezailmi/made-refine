import * as React from 'react'
import { render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { PortalContainerProvider, usePortalContainer } from './portal-container'

function Consumer() {
  const container = usePortalContainer()
  return <div data-testid="portal-ready">{container ? 'ready' : 'empty'}</div>
}

describe('PortalContainerProvider', () => {
  beforeEach(() => {
    document.documentElement.removeAttribute('data-direct-edit-disable-styles')
  })

  afterEach(() => {
    document.documentElement.removeAttribute('data-direct-edit-disable-styles')
    document.body.innerHTML = ''
    document.querySelectorAll('[data-direct-edit-host]').forEach(el => el.remove())
  })

  it('creates a shadow host and container root', async () => {
    render(
      <PortalContainerProvider>
        <Consumer />
      </PortalContainerProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('portal-ready').textContent).toBe('ready')
    })

    const host = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
    expect(host).not.toBeNull()
    expect(host?.shadowRoot).not.toBeNull()
    expect(host?.shadowRoot?.querySelector('[data-direct-edit-root]')).not.toBeNull()
    expect(host?.shadowRoot?.querySelector('style')).not.toBeNull()
  })

  it('cleans up host on unmount', async () => {
    const { unmount } = render(
      <PortalContainerProvider>
        <Consumer />
      </PortalContainerProvider>,
    )

    await waitFor(() => {
      expect(document.querySelector('[data-direct-edit-host]')).not.toBeNull()
    })

    unmount()

    expect(document.querySelector('[data-direct-edit-host]')).toBeNull()
  })

  it('skips inline style injection when disabled via html attribute', async () => {
    document.documentElement.setAttribute('data-direct-edit-disable-styles', '')

    render(
      <PortalContainerProvider>
        <Consumer />
      </PortalContainerProvider>,
    )

    await waitFor(() => {
      expect(screen.getByTestId('portal-ready').textContent).toBe('ready')
    })

    const host = document.querySelector('[data-direct-edit-host]') as HTMLElement | null
    expect(host?.shadowRoot?.querySelector('style')).toBeNull()
    expect(host?.shadowRoot?.querySelector('[data-direct-edit-root]')).not.toBeNull()
  })
})
