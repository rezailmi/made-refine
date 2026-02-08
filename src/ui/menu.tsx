import { Menu as MenuPrimitive } from '@base-ui/react/menu'
import { usePortalContainer } from '../portal-container'

const Menu = MenuPrimitive.Root
const MenuTrigger = MenuPrimitive.Trigger

function MenuPortal(props: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Portal>) {
  const container = usePortalContainer()
  return <MenuPrimitive.Portal container={container} {...props} />
}

function MenuPositioner(props: React.ComponentPropsWithoutRef<typeof MenuPrimitive.Positioner>) {
  return <MenuPrimitive.Positioner {...props} style={{ pointerEvents: 'auto', ...props.style }} />
}
const MenuPopup = MenuPrimitive.Popup
const MenuItem = MenuPrimitive.Item

export {
  Menu,
  MenuTrigger,
  MenuPortal,
  MenuPositioner,
  MenuPopup,
  MenuItem,
}
