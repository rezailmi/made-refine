import * as React from 'react'
// @ts-expect-error - CSS imported as raw text (Vite: ?raw suffix, tsup: esbuild plugin)
import cssText from '../dist/styles.css?raw'

const PortalContainerContext = React.createContext<HTMLElement | null>(null)

export function usePortalContainer() {
  return React.useContext(PortalContainerContext)
}

export function PortalContainerProvider({ children }: { children: React.ReactNode }) {
  const [container, setContainer] = React.useState<HTMLElement | null>(null)

  React.useEffect(() => {
    const disableInlineStyles = document.documentElement.hasAttribute('data-direct-edit-disable-styles')
    const host = document.createElement('div')
    host.setAttribute('data-direct-edit-host', '')
    Object.assign(host.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '2147483646',
      pointerEvents: 'none',
    })

    const shadow = host.attachShadow({ mode: 'open' })
    if (!disableInlineStyles) {
      const style = document.createElement('style')
      style.textContent = cssText
      shadow.appendChild(style)
    }

    const root = document.createElement('div')
    root.setAttribute('data-direct-edit-root', '')
    shadow.appendChild(root)

    document.documentElement.appendChild(host)
    setContainer(root)

    return () => { host.remove() }
  }, [])

  return (
    <PortalContainerContext.Provider value={container}>
      {children}
    </PortalContainerContext.Provider>
  )
}
