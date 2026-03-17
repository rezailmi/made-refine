import * as React from 'react'
import { PortalContainerProvider, usePortalContainer } from './portal-container'
import type {
  DirectEditState,
  SpacingPropertyKey,
  BorderRadiusPropertyKey,
  BorderPropertyKey,
  BorderProperties,
  FlexPropertyKey,
  SizingPropertyKey,
  TypographyPropertyKey,
  CSSPropertyValue,
  SizingValue,
  SizingChangeOptions,
  ColorPropertyKey,
  ColorValue,
  UndoEntry,
  ActiveTool,
  Theme,
  BorderStyleControlPreference,
  SessionEdit,
  SessionItem,
  SelectElementOptions,
  SelectElementsOptions,
  CanvasElementKind,
} from './types'
import type { MoveInfo } from './use-move'
import { useStyleUpdaters } from './use-style-updaters'
import { useSessionManager } from './use-session-manager'
import { useTextAndComments } from './use-text-and-comments'
import { useAgentComms } from './use-agent-comms'
import { useKeyboardShortcuts } from './use-keyboard-shortcuts'
import { useCanvas } from './use-canvas'

export interface DirectEditActionsContextValue {
  selectElement: (element: HTMLElement, options?: SelectElementOptions) => void
  selectElements: (elements: HTMLElement[], options?: SelectElementsOptions) => void
  toggleElementSelection: (element: HTMLElement) => void
  clearSelection: () => void
  selectParent: () => void
  selectChild: () => void
  closePanel: () => void
  updateSpacingProperty: (key: SpacingPropertyKey, value: CSSPropertyValue) => void
  updateBorderRadiusProperty: (key: BorderRadiusPropertyKey, value: CSSPropertyValue) => void
  updateBorderProperty: (key: BorderPropertyKey, value: BorderProperties[BorderPropertyKey]) => void
  updateBorderProperties: (changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>) => void
  updateRawCSS: (properties: Record<string, string>) => void
  updateFlexProperty: (key: FlexPropertyKey, value: string) => void
  toggleFlexLayout: () => void
  updateSizingProperties: (
    changes: Partial<Record<SizingPropertyKey, SizingValue>>,
    options?: SizingChangeOptions
  ) => void
  updateSizingProperty: (key: SizingPropertyKey, value: SizingValue) => void
  updateColorProperty: (key: ColorPropertyKey, value: ColorValue) => void
  replaceSelectionColor: (from: ColorValue, to: ColorValue) => void
  updateTypographyProperty: (key: TypographyPropertyKey, value: CSSPropertyValue | string) => void
  resetToOriginal: () => void
  exportEdits: () => Promise<boolean>
  toggleEditMode: () => void
  undo: () => void
  handleMoveComplete: (element: HTMLElement, moveInfo: MoveInfo | null) => void
  setActiveTool: (tool: ActiveTool) => void
  setTheme: (theme: Theme) => void
  setBorderStyleControlPreference: (preference: BorderStyleControlPreference) => void
  addComment: (element: HTMLElement, clickPosition: { x: number; y: number }) => void
  updateCommentText: (id: string, text: string) => void
  submitCommentDraft: (id: string, text: string) => string | null
  addCommentReply: (id: string, text: string) => void
  deleteComment: (id: string) => void
  exportComment: (id: string) => Promise<boolean>
  canSendEditToAgent: (snapshot?: {
    selectedElement: HTMLElement | null
    elementInfo: DirectEditState['elementInfo']
    pendingStyles: Record<string, string>
  }) => boolean
  sendEditToAgent: () => Promise<boolean>
  sendAllSessionItemsToAgent: () => Promise<boolean>
  sendCommentToAgent: (id: string) => Promise<boolean>
  setActiveCommentId: (id: string | null) => void
  getSessionEdits: () => SessionEdit[]
  getSessionItems: () => SessionItem[]
  exportAllEdits: () => Promise<boolean>
  clearSessionEdits: () => void
  removeSessionEdit: (element: HTMLElement) => void
  startTextEditing: (element: HTMLElement) => void
  commitTextEditing: () => void
  groupSelection: () => void
  insertElement: (kind: CanvasElementKind) => void
  toggleCanvas: () => void
  setCanvasZoom: (zoom: number) => void
  fitCanvasToViewport: () => void
  zoomCanvasTo100: () => void
}

export interface DirectEditStateContextValue extends DirectEditState {
  agentAvailable: boolean
  sessionEditCount: number
  multiSelectContextCount: number
}

export interface DirectEditContextValue extends DirectEditStateContextValue, DirectEditActionsContextValue {}

const DirectEditStateContext = React.createContext<DirectEditStateContextValue | null>(null)
const DirectEditActionsContext = React.createContext<DirectEditActionsContextValue | null>(null)

export function useDirectEditState(): DirectEditStateContextValue {
  const context = React.useContext(DirectEditStateContext)
  if (!context) {
    throw new Error('useDirectEditState must be used within a DirectEditProvider')
  }
  return context
}

export function useDirectEditActions(): DirectEditActionsContextValue {
  const context = React.useContext(DirectEditActionsContext)
  if (!context) {
    throw new Error('useDirectEditActions must be used within a DirectEditProvider')
  }
  return context
}

export function useDirectEdit(): DirectEditContextValue {
  const state = useDirectEditState()
  const actions = useDirectEditActions()
  return React.useMemo(() => ({ ...state, ...actions }), [state, actions])
}

class DirectEditErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean }
> {
  state = { hasError: false }

  static getDerivedStateFromError() {
    return { hasError: true }
  }

  componentDidCatch(error: unknown) {
    console.error('[made-refine] internal error:', error)
  }

  render() {
    if (this.state.hasError) return null
    return this.props.children
  }
}

interface DirectEditProviderProps {
  children: React.ReactNode
}

const BORDER_STYLE_CONTROL_PREFERENCE_KEY = 'direct-edit-border-style-control'
const CANVAS_ACTIVE_KEY = 'direct-edit-canvas-active'

function getCanvasPreference(): boolean {
  if (typeof window === 'undefined') return true
  try {
    return localStorage.getItem(CANVAS_ACTIVE_KEY) !== 'false'
  } catch {}
  return true
}

function saveCanvasPreference(active: boolean) {
  try { localStorage.setItem(CANVAS_ACTIVE_KEY, String(active)) } catch {}
}
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? React.useEffect : React.useLayoutEffect

function getInitialTheme(): Theme {
  if (typeof window === 'undefined') return 'system'
  try {
    const theme = localStorage.getItem('direct-edit-theme')
    if (theme === 'light' || theme === 'dark' || theme === 'system') {
      return theme
    }
  } catch {}
  return 'system'
}

function getInitialBorderStyleControlPreference(): BorderStyleControlPreference {
  if (typeof window === 'undefined') return 'icon'
  try {
    const borderPref = localStorage.getItem(BORDER_STYLE_CONTROL_PREFERENCE_KEY)
    if (borderPref === 'label' || borderPref === 'icon') {
      return borderPref
    }
  } catch {}
  return 'icon'
}

export function DirectEditProvider({ children }: DirectEditProviderProps) {
  const [state, setState] = React.useState<DirectEditState>(() => ({
    isOpen: false,
    selectedElement: null,
    selectedElements: [],
    selectionAnchorElement: null,
    elementInfo: null,
    computedSpacing: null,
    computedBorderRadius: null,
    computedBorder: null,
    computedFlex: null,
    computedSizing: null,
    computedColor: null,
    computedBoxShadow: null,
    computedTypography: null,
    isComponentPrimitive: false,
    originalStyles: {},
    pendingStyles: {},
    editModeActive: false,
    activeTool: 'select',
    theme: getInitialTheme(),
    borderStyleControlPreference: getInitialBorderStyleControlPreference(),
    comments: [],
    activeCommentId: null,
    textEditingElement: null,
    canvas: { active: false, zoom: 1, panX: 0, panY: 0 },
  }))

  const undoStackRef = React.useRef<UndoEntry[]>([])
  const sessionEditsRef = React.useRef<Map<HTMLElement, SessionEdit>>(new Map())
  const removedSessionEditsRef = React.useRef<WeakSet<HTMLElement>>(new WeakSet())
  const [sessionEditCount, setSessionEditCount] = React.useState(0)
  const stateRef = React.useRef(state)
  React.useEffect(() => {
    stateRef.current = state
  })

  const pushUndo = React.useCallback((entry: UndoEntry) => {
    undoStackRef.current.push(entry)
    if (undoStackRef.current.length > 500) {
      undoStackRef.current = undoStackRef.current.slice(-500)
    }
    if (entry.type === 'edit' || entry.type === 'move' || entry.type === 'textEdit') {
      removedSessionEditsRef.current.delete(entry.element)
    }
  }, [])

  const {
    syncSessionItemCount, saveCurrentToSession, selectElement, selectElements, toggleElementSelection,
    clearSelection, selectParent, selectChild,
    resetToOriginal, undo, handleMoveComplete, getSessionEdits, getSessionItems,
    exportAllEdits, exportEdits, removeSessionEdit, clearSessionEdits, groupSelection, insertElement,
  } = useSessionManager({
    stateRef, sessionEditsRef, removedSessionEditsRef, undoStackRef,
    pushUndo, setState, setSessionEditCount,
  })

  const {
    updateSpacingProperty, updateBorderRadiusProperty, updateBorderProperty,
    updateBorderProperties, updateRawCSS, updateFlexProperty, toggleFlexLayout,
    updateSizingProperties, updateSizingProperty, updateColorProperty, replaceSelectionColor, updateTypographyProperty,
  } = useStyleUpdaters({
    stateRef,
    pushUndo,
    setState,
    sessionEditsRef,
    removedSessionEditsRef,
    syncSessionItemCount,
  })

  // Save current element to session when selected element or pending styles change
  React.useEffect(() => {
    if (!state.selectedElement) return
    saveCurrentToSession()
  }, [state.selectedElement, state.pendingStyles, saveCurrentToSession])

  const {
    finalizeTextEditing, toggleEditMode: toggleEditModeBase, startTextEditing, commitTextEditing,
    addComment, updateCommentText, submitCommentDraft, addCommentReply, deleteComment, exportComment, setActiveCommentId,
  } = useTextAndComments({
    stateRef, sessionEditsRef, removedSessionEditsRef,
    pushUndo, syncSessionItemCount, setState,
  })

  const { toggleCanvas, enterCanvas, exitCanvas, setCanvasZoom, fitCanvasToViewport, zoomCanvasTo100 } = useCanvas({
    stateRef, setState,
  })

  const closePanel = React.useCallback(() => {
    setState((prev) => ({
      ...prev,
      isOpen: false,
    }))
  }, [])

  // Wrap toggleEditMode to enter canvas when edit mode turns on, exit when it turns off.
  // Timing note: toggleEditModeBase() only calls setState (async). stateRef is synced
  // from React state in a post-render useEffect, so stateRef.current still holds the
  // pre-toggle values immediately after the call. wasActive and canvas?.active both
  // read the old state intentionally — that's what the branching logic requires.
  const toggleEditMode = React.useCallback(() => {
    const wasActive = stateRef.current.editModeActive
    toggleEditModeBase()
    if (wasActive && stateRef.current.canvas?.active) {
      exitCanvas()
    } else if (!wasActive && getCanvasPreference()) {
      enterCanvas()
    }
    if (wasActive) {
      clearSelection()
      closePanel()
    }
  }, [toggleEditModeBase, stateRef, exitCanvas, enterCanvas, clearSelection, closePanel])

  // Wrap toggleCanvas to persist the preference in localStorage.
  const toggleCanvasWithPreference = React.useCallback(() => {
    const willBeActive = !stateRef.current.canvas.active
    toggleCanvas()
    saveCanvasPreference(willBeActive)
  }, [toggleCanvas, stateRef])

  // Sync session item count when comments change
  React.useEffect(() => {
    syncSessionItemCount(state.comments)
  }, [state.comments, syncSessionItemCount])

  // Click-outside listener for text editing
  React.useEffect(() => {
    const editingElement = state.textEditingElement
    if (!editingElement) return
    const activeEditingElement = editingElement

    function handleMouseDown(e: MouseEvent) {
      const target = e.target
      if (!(target instanceof Node)) return
      if (!activeEditingElement.contains(target)) {
        commitTextEditing()
      }
    }

    // Delay to avoid catching the double-click that started editing
    const rafId = requestAnimationFrame(() => {
      document.addEventListener('mousedown', handleMouseDown, true)
    })

    return () => {
      cancelAnimationFrame(rafId)
      document.removeEventListener('mousedown', handleMouseDown, true)
    }
  }, [state.textEditingElement, commitTextEditing])

  // Block clicks from reaching user app elements during design mode.
  // This is the fallback click guard: when the capture-phase interaction hook
  // (in interaction-overlay.tsx) is active, it stopPropagation's first so this
  // listener never fires. When the hook is inactive (during text editing), this
  // takes over to prevent clicks from reaching the underlying page.
  React.useEffect(() => {
    if (!state.editModeActive) return

    function blockClick(e: MouseEvent) {
      const target = e.target
      if (!(target instanceof Node)) return

      const host = document.querySelector('[data-direct-edit-host]')
      if (host && target === host) return

      if (target instanceof Element && target.closest('[data-direct-edit]')) return

      e.preventDefault()
      e.stopPropagation()
    }

    document.addEventListener('click', blockClick, true)
    return () => document.removeEventListener('click', blockClick, true)
  }, [state.editModeActive])

  // While design mode is active, block native browser navigation/drag behaviors
  // that can interrupt visual editing (history swipe + URL/tab drag).
  React.useEffect(() => {
    if (!state.editModeActive) return

    const docEl = document.documentElement
    const body = document.body
    const previousDocOverscroll = docEl.style.overscrollBehavior
    const previousDocOverscrollX = docEl.style.overscrollBehaviorX
    const previousBodyOverscroll = body.style.overscrollBehavior
    const previousBodyOverscrollX = body.style.overscrollBehaviorX

    docEl.style.overscrollBehavior = 'none'
    docEl.style.overscrollBehaviorX = 'none'
    body.style.overscrollBehavior = 'none'
    body.style.overscrollBehaviorX = 'none'

    function blockNativeDragStart(e: DragEvent) {
      const target = e.target
      if (target instanceof Element && target.closest('[data-direct-edit]')) return
      e.preventDefault()
      e.stopPropagation()
    }

    function getParentAcrossShadowTree(node: Element | null): Element | null {
      if (!node) return null
      if (node.parentElement) return node.parentElement
      const root = node.getRootNode()
      if (root instanceof ShadowRoot) return root.host
      return null
    }

    function findHorizontalScroller(start: Element): HTMLElement | null {
      let current: Element | null = start
      while (current) {
        if (current instanceof HTMLElement) {
          const style = window.getComputedStyle(current)
          const overflowX = style.overflowX || style.overflow
          const scrollableX =
            overflowX === 'auto'
            || overflowX === 'scroll'
            || overflowX === 'overlay'
          const hasHorizontalOverflow = current.scrollWidth > current.clientWidth + 1
          if (scrollableX && hasHorizontalOverflow) return current
        }
        current = getParentAcrossShadowTree(current)
      }
      return null
    }

    function blockHistorySwipeWheel(e: WheelEvent) {
      const target = e.target
      if (!(target instanceof Element)) return

      const absX = Math.abs(e.deltaX)
      const absY = Math.abs(e.deltaY)
      const horizontalIntent = absX > absY || (e.shiftKey && absY > 0)
      if (!horizontalIntent) return

      // Canvas mode should still pan normally.
      if (stateRef.current.canvas.active) return

      // SectionNav owns its own horizontal-only wheel behavior.
      if (target.closest('[data-direct-edit="section-nav"]')) return

      const scroller = findHorizontalScroller(target)
      if (scroller) {
        // Route horizontal intent into the nearest horizontal scroller and
        // prevent browser history-swipe navigation at scroll boundaries.
        const delta = absX > 0 ? e.deltaX : e.deltaY
        if (delta !== 0) {
          e.preventDefault()
          scroller.scrollLeft += delta
        }
        return
      }

      // No horizontal scroller to consume the gesture: block back/forward swipe.
      e.preventDefault()
    }

    document.addEventListener('dragstart', blockNativeDragStart, true)
    window.addEventListener('wheel', blockHistorySwipeWheel, { capture: true, passive: false })

    return () => {
      document.removeEventListener('dragstart', blockNativeDragStart, true)
      window.removeEventListener('wheel', blockHistorySwipeWheel, true)
      docEl.style.overscrollBehavior = previousDocOverscroll
      docEl.style.overscrollBehaviorX = previousDocOverscrollX
      body.style.overscrollBehavior = previousBodyOverscroll
      body.style.overscrollBehaviorX = previousBodyOverscrollX
    }
  }, [state.editModeActive])

  const {
    agentAvailable, canSendEditToAgent, sendEditToAgent, sendCommentToAgent, sendAllSessionItemsToAgent,
  } = useAgentComms({ stateRef, sessionEditsRef, getSessionItems, saveCurrentToSession, removeSessionEdit, deleteComment })

  const setActiveTool = React.useCallback((tool: ActiveTool) => {
    const normalizedTool: ActiveTool = tool === 'comment' ? 'select' : tool
    setState((prev) => ({
      ...prev,
      activeTool: normalizedTool,
    }))
  }, [])

  const setTheme = React.useCallback((theme: Theme) => {
    setState((prev) => ({ ...prev, theme }))
    try { localStorage.setItem('direct-edit-theme', theme) } catch {}
  }, [])

  const setBorderStyleControlPreference = React.useCallback((preference: BorderStyleControlPreference) => {
    setState((prev) => ({ ...prev, borderStyleControlPreference: preference }))
    try { localStorage.setItem(BORDER_STYLE_CONTROL_PREFERENCE_KEY, preference) } catch {}
  }, [])

  useKeyboardShortcuts({
    stateRef, toggleEditMode, toggleFlexLayout, undo,
    commitTextEditing, startTextEditing, closePanel, setState,
    clearSelection, groupSelection, insertElement,
    toggleCanvas: toggleCanvasWithPreference, setCanvasZoom, fitCanvasToViewport, zoomCanvasTo100,
  })

  const multiSelectContextCount = React.useMemo(() => {
    if (state.selectedElements.length <= 1) return 0
    let count = 0
    for (const el of state.selectedElements) {
      if (!sessionEditsRef.current.has(el)) count++
    }
    return count
  }, [state.selectedElements, sessionEditCount])

  const stateContextValue = React.useMemo<DirectEditStateContextValue>(() => ({
    ...state,
    agentAvailable,
    sessionEditCount,
    multiSelectContextCount,
  }), [agentAvailable, state, sessionEditCount, multiSelectContextCount])

  const actionsContextValue = React.useMemo<DirectEditActionsContextValue>(() => ({
    selectElement, selectElements, toggleElementSelection, clearSelection,
    selectParent, selectChild, closePanel,
    updateSpacingProperty, updateBorderRadiusProperty, updateBorderProperty,
    updateBorderProperties, updateRawCSS, updateFlexProperty, toggleFlexLayout,
    updateSizingProperties, updateSizingProperty, updateColorProperty, replaceSelectionColor, updateTypographyProperty,
    resetToOriginal, exportEdits, canSendEditToAgent, sendEditToAgent,
    sendAllSessionItemsToAgent, sendCommentToAgent, toggleEditMode, undo,
    handleMoveComplete, setActiveTool, setTheme, setBorderStyleControlPreference,
    addComment, updateCommentText, submitCommentDraft, addCommentReply, deleteComment, exportComment,
    setActiveCommentId, getSessionEdits, getSessionItems, exportAllEdits,
    clearSessionEdits, removeSessionEdit, startTextEditing, commitTextEditing,
    groupSelection, insertElement,
    toggleCanvas: toggleCanvasWithPreference, setCanvasZoom, fitCanvasToViewport, zoomCanvasTo100,
  }), [
    selectElement, selectElements, toggleElementSelection, clearSelection,
    selectParent, selectChild, closePanel,
    updateSpacingProperty, updateBorderRadiusProperty, updateBorderProperty,
    updateBorderProperties, updateRawCSS, updateFlexProperty, toggleFlexLayout,
    updateSizingProperties, updateSizingProperty, updateColorProperty, replaceSelectionColor, updateTypographyProperty,
    resetToOriginal, exportEdits, canSendEditToAgent, sendEditToAgent,
    sendAllSessionItemsToAgent, sendCommentToAgent, toggleEditMode, undo,
    handleMoveComplete, setActiveTool, setTheme, setBorderStyleControlPreference,
    addComment, updateCommentText, submitCommentDraft, addCommentReply, deleteComment, exportComment,
    setActiveCommentId, getSessionEdits, getSessionItems, exportAllEdits,
    clearSessionEdits, removeSessionEdit, startTextEditing, commitTextEditing,
    groupSelection, insertElement,
    toggleCanvasWithPreference, setCanvasZoom, fitCanvasToViewport, zoomCanvasTo100,
  ])

  return (
    <DirectEditErrorBoundary>
      <PortalContainerProvider>
        <DirectEditStateContext.Provider value={stateContextValue}>
          <DirectEditActionsContext.Provider value={actionsContextValue}>
            <ThemeApplier />
            {children}

          </DirectEditActionsContext.Provider>
        </DirectEditStateContext.Provider>
      </PortalContainerProvider>
    </DirectEditErrorBoundary>
  )
}

function ThemeApplier() {
  const { theme } = useDirectEditState()
  const container = usePortalContainer()

  useIsomorphicLayoutEffect(() => {
    if (!container) return
    const host = (container.getRootNode() as ShadowRoot).host as HTMLElement
    if (theme === 'system') {
      host.removeAttribute('data-theme')
    } else {
      host.setAttribute('data-theme', theme)
    }
  }, [container, theme])

  return null
}
