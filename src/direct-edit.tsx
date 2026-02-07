import { DirectEditProvider } from './provider'
import { DirectEditPanel } from './panel'
import { DirectEditToolbar } from './toolbar'
import { Rulers } from './rulers-overlay'

export function DirectEdit() {
  return (
    <DirectEditProvider>
      <DirectEditPanel />
      <DirectEditToolbar />
      <Rulers />
    </DirectEditProvider>
  )
}
