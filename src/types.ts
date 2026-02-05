export interface ElementInfo {
  tagName: string
  id: string | null
  classList: string[]
  isFlexContainer: boolean
  isFlexItem: boolean
  isTextElement: boolean
  parentElement: HTMLElement | null
  hasChildren: boolean
}

export interface ReactComponentFrame {
  name: string
  file?: string
  line?: number
  column?: number
}

export interface DomSourceLocation {
  file: string
  line?: number
  column?: number
}

export interface ElementLocator {
  reactStack: ReactComponentFrame[]
  domSelector: string
  domContextHtml: string
  targetHtml: string
  textPreview: string
  tagName: string
  id: string | null
  classList: string[]
  domSource?: DomSourceLocation
}

export interface CSSPropertyValue {
  numericValue: number
  unit: 'px' | 'rem' | '%' | 'em' | ''
  raw: string
}

export interface SpacingProperties {
  paddingTop: CSSPropertyValue
  paddingRight: CSSPropertyValue
  paddingBottom: CSSPropertyValue
  paddingLeft: CSSPropertyValue
  marginTop: CSSPropertyValue
  marginRight: CSSPropertyValue
  marginBottom: CSSPropertyValue
  marginLeft: CSSPropertyValue
  gap: CSSPropertyValue
}

export interface BorderRadiusProperties {
  borderTopLeftRadius: CSSPropertyValue
  borderTopRightRadius: CSSPropertyValue
  borderBottomRightRadius: CSSPropertyValue
  borderBottomLeftRadius: CSSPropertyValue
}

export interface ColorValue {
  hex: string // 6-character hex without # (e.g., "DDDDDD")
  alpha: number // 0-100 percentage
  raw: string // Original CSS value
}

export interface ColorProperties {
  backgroundColor: ColorValue
  color: ColorValue // text color
}

export type ColorPropertyKey = keyof ColorProperties

export interface FlexProperties {
  display: string
  flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse'
  justifyContent: string
  alignItems: string
}

export interface TypographyProperties {
  fontFamily: string
  fontWeight: string
  fontSize: CSSPropertyValue
  lineHeight: CSSPropertyValue
  letterSpacing: CSSPropertyValue
  textAlign: 'left' | 'center' | 'right' | 'justify' | 'start' | 'end'
  textVerticalAlign: 'flex-start' | 'center' | 'flex-end'
}

export interface DirectEditState {
  isOpen: boolean
  selectedElement: HTMLElement | null
  elementInfo: ElementInfo | null
  computedSpacing: SpacingProperties | null
  computedBorderRadius: BorderRadiusProperties | null
  computedFlex: FlexProperties | null
  computedSizing: SizingProperties | null
  computedColor: ColorProperties | null
  computedTypography: TypographyProperties | null
  originalStyles: Record<string, string>
  pendingStyles: Record<string, string>
  editModeActive: boolean
}

export type SizingMode = 'fixed' | 'fill' | 'fit'

export interface SizingValue {
  mode: SizingMode
  value: CSSPropertyValue
}

export interface SizingProperties {
  width: SizingValue
  height: SizingValue
}

export type SpacingPropertyKey = keyof SpacingProperties
export type BorderRadiusPropertyKey = keyof BorderRadiusProperties
export type FlexPropertyKey = keyof FlexProperties
export type SizingPropertyKey = keyof SizingProperties
export type TypographyPropertyKey = keyof TypographyProperties

export interface MeasurementLine {
  direction: 'horizontal' | 'vertical'
  x1: number
  y1: number
  x2: number
  y2: number
  distance: number
  labelPosition: { x: number; y: number }
}

export interface MeasurementState {
  isActive: boolean
  hoveredElement: HTMLElement | null
  parentMeasurements: MeasurementLine[]
  elementMeasurements: MeasurementLine[]
}

export interface DragState {
  isDragging: boolean
  draggedElement: HTMLElement | null
  originalParent: HTMLElement | null
  originalNextSibling: HTMLElement | null
  ghostPosition: { x: number; y: number }
  dragOffset: { x: number; y: number }
}

export interface DropTarget {
  container: HTMLElement
  insertBefore: HTMLElement | null
  flexDirection: 'row' | 'row-reverse' | 'column' | 'column-reverse'
}

export interface DropIndicator {
  x: number
  y: number
  width: number
  height: number
}
