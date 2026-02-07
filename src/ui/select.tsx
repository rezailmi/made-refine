import { Select as SelectPrimitive } from '@base-ui/react/select'
import { usePortalContainer } from '../portal-container'

const Select = SelectPrimitive.Root
const SelectTrigger = SelectPrimitive.Trigger
const SelectValue = SelectPrimitive.Value
const SelectIcon = SelectPrimitive.Icon

function SelectPortal(props: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Portal>) {
  const container = usePortalContainer()
  return <SelectPrimitive.Portal container={container} {...props} />
}

function SelectPositioner(props: React.ComponentPropsWithoutRef<typeof SelectPrimitive.Positioner>) {
  return <SelectPrimitive.Positioner {...props} style={{ pointerEvents: 'auto', ...props.style }} />
}
const SelectPopup = SelectPrimitive.Popup
const SelectItem = SelectPrimitive.Item
const SelectItemIndicator = SelectPrimitive.ItemIndicator
const SelectItemText = SelectPrimitive.ItemText

export {
  Select,
  SelectTrigger,
  SelectValue,
  SelectIcon,
  SelectPortal,
  SelectPositioner,
  SelectPopup,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
}
