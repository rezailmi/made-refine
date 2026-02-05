import { DirectEditProvider } from './provider'
import { DirectEditPanel } from './panel'
import { DirectEditToolbar } from './toolbar'

export function DirectEdit() {
  return (
    <DirectEditProvider>
      <DirectEditPanel />
      <DirectEditToolbar />
    </DirectEditProvider>
  )
}
