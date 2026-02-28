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
  unit: 'px' | 'rem' | '%' | 'em' | 'vh' | 'vw' | ''
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

export type BorderStyle =
  | 'none'
  | 'hidden'
  | 'dotted'
  | 'dashed'
  | 'solid'
  | 'double'
  | 'groove'
  | 'ridge'
  | 'inset'
  | 'outset'

export interface BorderProperties {
  borderTopStyle: BorderStyle
  borderTopWidth: CSSPropertyValue
  borderRightStyle: BorderStyle
  borderRightWidth: CSSPropertyValue
  borderBottomStyle: BorderStyle
  borderBottomWidth: CSSPropertyValue
  borderLeftStyle: BorderStyle
  borderLeftWidth: CSSPropertyValue
}

export interface ColorValue {
  hex: string // 6-character hex without # (e.g., "DDDDDD")
  alpha: number // 0-100 percentage
  raw: string // Original CSS value
}

export interface ColorProperties {
  backgroundColor: ColorValue
  color: ColorValue // text color
  borderColor: ColorValue
  outlineColor: ColorValue
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

export type ActiveTool = 'select' | 'comment'

export type Theme = 'light' | 'dark' | 'system'
export type BorderStyleControlPreference = 'label' | 'icon'

export interface CommentReply {
  text: string
  createdAt: number
}

export interface Comment {
  id: string
  element: HTMLElement
  locator: ElementLocator
  clickPosition: { x: number; y: number }
  relativePosition: { x: number; y: number }
  text: string
  createdAt: number
  replies: CommentReply[]
}

export interface DirectEditState {
  isOpen: boolean
  selectedElement: HTMLElement | null
  elementInfo: ElementInfo | null
  computedSpacing: SpacingProperties | null
  computedBorderRadius: BorderRadiusProperties | null
  computedBorder: BorderProperties | null
  computedFlex: FlexProperties | null
  computedSizing: SizingProperties | null
  computedColor: ColorProperties | null
  computedBoxShadow: string | null
  computedTypography: TypographyProperties | null
  originalStyles: Record<string, string>
  pendingStyles: Record<string, string>
  editModeActive: boolean
  activeTool: ActiveTool
  theme: Theme
  borderStyleControlPreference: BorderStyleControlPreference
  comments: Comment[]
  activeCommentId: string | null
  textEditingElement: HTMLElement | null
  canvas: { active: boolean; zoom: number; panX: number; panY: number }
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

export type SizingChangePhase = 'start' | 'update' | 'end'

export interface SizingChangeOptions {
  transactionId?: string
  phase?: SizingChangePhase
}

export type SpacingPropertyKey = keyof SpacingProperties
export type BorderRadiusPropertyKey = keyof BorderRadiusProperties
export type BorderPropertyKey = keyof BorderProperties
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
  originalPreviousSibling: HTMLElement | null
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

export interface UndoEditEntry {
  type: 'edit'
  element: HTMLElement
  properties: Array<{ cssProperty: string; previousValue: string | null }>
}

export interface UndoSelectionEntry {
  type: 'selection'
  previousElement: HTMLElement | null
  previousOriginalStyles: Record<string, string>
  previousPendingStyles: Record<string, string>
}

export interface UndoMoveEntry {
  type: 'move'
  element: HTMLElement
  originalParent: HTMLElement
  originalNextSibling: HTMLElement | null
  previousSessionMove: SessionEdit['move']
  previousPositionStyles?: Array<{ cssProperty: string; previousValue: string | null }>
}

export interface UndoTextEditEntry {
  type: 'textEdit'
  element: HTMLElement
  originalText: string
  previousText: string
}

export type UndoEntry = UndoEditEntry | UndoSelectionEntry | UndoMoveEntry | UndoTextEditEntry

export interface Guideline {
  id: string
  orientation: 'horizontal' | 'vertical'
  position: number // page-absolute px
}

export interface SessionEdit {
  element: HTMLElement
  locator: ElementLocator
  originalStyles: Record<string, string>
  pendingStyles: Record<string, string>
  move: {
    fromParentName: string
    toParentName: string
    fromSiblingBefore: string | null
    fromSiblingAfter: string | null
    toSiblingBefore: string | null
    toSiblingAfter: string | null
    fromParentSelector?: string | null
    toParentSelector?: string | null
    fromSiblingBeforeSelector?: string | null
    fromSiblingAfterSelector?: string | null
    toSiblingBeforeSelector?: string | null
    toSiblingAfterSelector?: string | null
    fromParentSource?: DomSourceLocation | null
    toParentSource?: DomSourceLocation | null
    fromSiblingBeforeSource?: DomSourceLocation | null
    fromSiblingAfterSource?: DomSourceLocation | null
    toSiblingBeforeSource?: DomSourceLocation | null
    toSiblingAfterSource?: DomSourceLocation | null
    mode?: 'free' | 'reorder' | 'position'
    fromParentDisplay?: string
    toParentDisplay?: string
    fromParentLayout?: 'flex' | 'grid' | 'block' | 'other'
    toParentLayout?: 'flex' | 'grid' | 'block' | 'other'
    fromIndex?: number
    toIndex?: number
    positionDelta?: { x: number; y: number }
    appliedLeft?: string
    appliedTop?: string
    // Visual intent
    visualDelta?: { x: number; y: number }
    // Parent flex/grid context
    fromFlexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse'
    toFlexDirection?: 'row' | 'row-reverse' | 'column' | 'column-reverse'
    fromGap?: string
    toGap?: string
    fromChildCount?: number
    toChildCount?: number
  } | null
  textEdit: {
    originalText: string
    newText: string
  } | null
}

export interface AnchorRef {
  name: string
  selector: string | null
  source: DomSourceLocation | null
}

export interface PlacementRef {
  before: AnchorRef | null
  after: AnchorRef | null
  description: string
}

export type MoveClassification = 'existing_layout_move' | 'layout_refactor'

export interface LayoutPrescription {
  recommendedSystem: 'flex' | 'grid'
  intentPatterns: string[]
  refactorSteps: string[]
  styleSteps: string[]
  itemSteps: string[]
}

export interface MoveOperation {
  operationId: string
  classification: MoveClassification
  interactionMode: 'free' | 'reorder' | 'position'
  subject: AnchorRef
  from: {
    parent: AnchorRef
    placement: PlacementRef
  }
  to: {
    parent: AnchorRef
    placement: PlacementRef
  }
  visualDelta?: { x: number; y: number }
  layoutPrescription?: LayoutPrescription
  confidence: 'high' | 'medium' | 'low'
  reasons: string[]
}

export type MoveIntent = MoveOperation

export interface MovePlan {
  operations: MoveOperation[]
  affectedContainers: AnchorRef[]
  orderingConstraints: string[]
  notes: string[]
}

export type SessionItem =
  | { type: 'edit'; edit: SessionEdit }
  | { type: 'comment'; comment: Comment }
