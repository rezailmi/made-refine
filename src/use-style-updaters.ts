import * as React from 'react'
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
  SessionEdit,
} from './types'
import {
  getAllComputedStyles,
  getComputedBorderStyles,
  getComputedColorStyles,
  getComputedBoxShadow,
  getOriginalInlineStyles,
  getElementLocator,
  getElementInfo,
  formatPropertyValue,
  propertyToCSSMap,
  borderRadiusPropertyToCSSMap,
  borderPropertyToCSSMap,
  flexPropertyToCSSMap,
  sizingPropertyToCSSMap,
  typographyPropertyToCSSMap,
  sizingValueToCSS,
  colorPropertyToCSSMap,
  parseColorValue,
} from './utils'
import { formatColorValue } from './ui/color-utils'

export interface StyleUpdaterOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  pushUndo: (entry: UndoEntry) => void
  setState: React.Dispatch<React.SetStateAction<DirectEditState>>
  sessionEditsRef?: React.MutableRefObject<Map<HTMLElement, SessionEdit>>
  removedSessionEditsRef?: React.MutableRefObject<WeakSet<HTMLElement>>
  syncSessionItemCount?: () => void
}

const BORDER_SIDE_PROPS = [
  { cssProperty: 'border-top-color', styleKey: 'borderTopStyle', widthKey: 'borderTopWidth', colorKey: 'borderTopColor' },
  { cssProperty: 'border-right-color', styleKey: 'borderRightStyle', widthKey: 'borderRightWidth', colorKey: 'borderRightColor' },
  { cssProperty: 'border-bottom-color', styleKey: 'borderBottomStyle', widthKey: 'borderBottomWidth', colorKey: 'borderBottomColor' },
  { cssProperty: 'border-left-color', styleKey: 'borderLeftStyle', widthKey: 'borderLeftWidth', colorKey: 'borderLeftColor' },
] as const

function toColorKey(color: ColorValue): string {
  return `${color.hex.toUpperCase()}:${Math.round(color.alpha)}`
}

function parseVisibleColor(raw: string, fallbackCurrentColor?: string): ColorValue | null {
  const trimmed = raw.trim()
  if (!trimmed || trimmed === 'transparent' || trimmed === 'none') return null
  const resolved = trimmed.toLowerCase() === 'currentcolor'
    ? (fallbackCurrentColor ?? trimmed)
    : trimmed
  const parsed = parseColorValue(resolved)
  return parsed.alpha > 0 ? parsed : null
}

function hasOwnText(node: Element): boolean {
  return Array.from(node.childNodes).some((child) => (
    child.nodeType === Node.TEXT_NODE && (child.textContent ?? '').trim().length > 0
  ))
}

function collectMatchingColorProperties(root: HTMLElement, target: ColorValue): Map<HTMLElement, Set<string>> {
  const matches = new Map<HTMLElement, Set<string>>()
  const targetKey = toColorKey(target)
  const nodes = [root, ...Array.from(root.querySelectorAll('*'))]

  for (const node of nodes) {
    if (!(node instanceof Element) || !node.isConnected) continue

    const computed = window.getComputedStyle(node)
    const currentTextColor = computed.color
    const nodeMatches = new Set<string>()
    const addIfMatch = (cssProperty: string, raw: string, fallbackCurrentColor?: string) => {
      const parsed = parseVisibleColor(raw, fallbackCurrentColor)
      if (parsed && toColorKey(parsed) === targetKey) {
        nodeMatches.add(cssProperty)
      }
    }

    addIfMatch('background-color', computed.backgroundColor)

    if (hasOwnText(node)) {
      addIfMatch('color', currentTextColor)
    }

    for (const side of BORDER_SIDE_PROPS) {
      const borderStyle = computed[side.styleKey]
      const borderWidth = parseFloat(computed[side.widthKey])
      if (borderStyle !== 'none' && borderWidth > 0) {
        addIfMatch(side.cssProperty, computed[side.colorKey], currentTextColor)
      }
    }

    if (computed.outlineStyle !== 'none' && parseFloat(computed.outlineWidth) > 0) {
      addIfMatch('outline-color', computed.outlineColor, currentTextColor)
    }

    if (node instanceof SVGGraphicsElement) {
      const fillColor = parseVisibleColor(computed.getPropertyValue('fill'), currentTextColor)
        ?? parseVisibleColor(node.getAttribute('fill') ?? '', currentTextColor)
      const strokeColor = parseVisibleColor(computed.getPropertyValue('stroke'), currentTextColor)
        ?? parseVisibleColor(node.getAttribute('stroke') ?? '', currentTextColor)

      if (fillColor && toColorKey(fillColor) === targetKey) {
        nodeMatches.add('fill')
      }
      if (strokeColor && toColorKey(strokeColor) === targetKey) {
        nodeMatches.add('stroke')
      }
    }

    if (nodeMatches.size > 0) {
      matches.set(node as HTMLElement, nodeMatches)
    }
  }

  return matches
}

export function useStyleUpdaters({
  stateRef,
  pushUndo,
  setState,
  sessionEditsRef,
  removedSessionEditsRef,
  syncSessionItemCount,
}: StyleUpdaterOptions) {
  const sizingTransactionRef = React.useRef<{
    id: string
    element: HTMLElement
    undoPushed: boolean
    snapshot: Array<{ cssProperty: string; previousValue: string | null }>
  } | null>(null)

  React.useEffect(() => () => { sizingTransactionRef.current = null }, [])

  const beginSizingTransaction = React.useCallback((element: HTMLElement, transactionId: string) => {
    sizingTransactionRef.current = {
      id: transactionId,
      element,
      undoPushed: false,
      snapshot: (['width', 'height'] as const).map((key) => {
        const cssProperty = sizingPropertyToCSSMap[key]
        return {
          cssProperty,
          previousValue: element.style.getPropertyValue(cssProperty) || null,
        }
      }),
    }
  }, [])

  const endSizingTransaction = React.useCallback((transactionId?: string) => {
    const current = sizingTransactionRef.current
    if (!current) return
    if (transactionId && current.id !== transactionId) return
    sizingTransactionRef.current = null
  }, [])

  const updateSpacingProperty = React.useCallback(
    (key: SpacingPropertyKey, value: CSSPropertyValue) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = propertyToCSSMap[key]
      const cssValue = formatPropertyValue(value)

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, cssValue)

      setState((prev) => ({
        ...prev,
        computedSpacing: prev.computedSpacing
          ? {
              ...prev.computedSpacing,
              [key]: value,
            }
          : null,
        pendingStyles: {
          ...prev.pendingStyles,
          [cssProperty]: cssValue,
        },
      }))
    },
    [pushUndo]
  )

  const updateBorderRadiusProperty = React.useCallback(
    (key: BorderRadiusPropertyKey, value: CSSPropertyValue) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = borderRadiusPropertyToCSSMap[key]
      const cssValue = formatPropertyValue(value)

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, cssValue)

      setState((prev) => ({
        ...prev,
        computedBorderRadius: prev.computedBorderRadius
          ? {
              ...prev.computedBorderRadius,
              [key]: value,
            }
          : null,
        pendingStyles: {
          ...prev.pendingStyles,
          [cssProperty]: cssValue,
        },
      }))
    },
    [pushUndo]
  )

  const updateBorderProperty = React.useCallback(
    (key: BorderPropertyKey, value: BorderProperties[BorderPropertyKey]) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = borderPropertyToCSSMap[key]
      const cssValue = typeof value === 'string' ? value : formatPropertyValue(value)

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, cssValue)

      const border = getComputedBorderStyles(el)
      const color = getComputedColorStyles(el)

      setState((prev) => ({
        ...prev,
        computedBorder: border,
        computedColor: color,
        pendingStyles: {
          ...prev.pendingStyles,
          [cssProperty]: cssValue,
        },
      }))
    },
    [pushUndo]
  )

  const updateBorderProperties = React.useCallback(
    (changes: Array<[BorderPropertyKey, BorderProperties[BorderPropertyKey]]>) => {
      const el = stateRef.current.selectedElement
      if (!el || changes.length === 0) return

      const properties: Array<{ cssProperty: string; previousValue: string | null }> = []
      const pendingUpdates: Record<string, string> = {}

      for (const [key, value] of changes) {
        const cssProperty = borderPropertyToCSSMap[key]
        const cssValue = typeof value === 'string' ? value : formatPropertyValue(value)

        const previousValue = el.style.getPropertyValue(cssProperty) || null
        properties.push({ cssProperty, previousValue })

        el.style.setProperty(cssProperty, cssValue)
        pendingUpdates[cssProperty] = cssValue
      }

      pushUndo({ type: 'edit', element: el, properties })

      const border = getComputedBorderStyles(el)
      const color = getComputedColorStyles(el)
      const boxShadow = getComputedBoxShadow(el)

      setState((prev) => ({
        ...prev,
        computedBorder: border,
        computedColor: color,
        computedBoxShadow: boxShadow,
        pendingStyles: {
          ...prev.pendingStyles,
          ...pendingUpdates,
        },
      }))
    },
    [pushUndo]
  )

  const updateRawCSS = React.useCallback(
    (properties: Record<string, string>) => {
      const el = stateRef.current.selectedElement
      if (!el || Object.keys(properties).length === 0) return

      const undoProperties: Array<{ cssProperty: string; previousValue: string | null }> = []
      const pendingUpdates: Record<string, string> = {}

      const entries = Object.entries(properties)

      // Snapshot all previous values before any mutations
      for (const [cssProperty] of entries) {
        const previousValue = el.style.getPropertyValue(cssProperty) || null
        undoProperties.push({ cssProperty, previousValue })
      }

      // Apply removals first: setting a shorthand (e.g. "background") to ""
      // clears all its longhands, so removals must precede additions to avoid
      // wiping out longhand values (e.g. "background-color") set in this batch.
      for (const [cssProperty, cssValue] of entries) {
        if (cssValue === '') {
          el.style.removeProperty(cssProperty)
        }
      }
      for (const [cssProperty, cssValue] of entries) {
        if (cssValue !== '') {
          el.style.setProperty(cssProperty, cssValue)
        }
        pendingUpdates[cssProperty] = cssValue
      }

      pushUndo({ type: 'edit', element: el, properties: undoProperties })

      const border = getComputedBorderStyles(el)
      const color = getComputedColorStyles(el)
      const boxShadow = getComputedBoxShadow(el)

      setState((prev) => ({
        ...prev,
        computedBorder: border,
        computedColor: color,
        computedBoxShadow: boxShadow,
        pendingStyles: {
          ...prev.pendingStyles,
          ...pendingUpdates,
        },
      }))
    },
    [pushUndo]
  )

  const updateFlexProperty = React.useCallback(
    (key: FlexPropertyKey, value: string) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = flexPropertyToCSSMap[key]

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, value)

      setState((prev) => ({
        ...prev,
        computedFlex: prev.computedFlex
          ? {
              ...prev.computedFlex,
              [key]: value,
            }
          : null,
        pendingStyles: {
          ...prev.pendingStyles,
          [cssProperty]: value,
        },
      }))
    },
    [pushUndo]
  )

  const toggleFlexLayout = React.useCallback(() => {
    const current = stateRef.current
    const element = current.selectedElement
    if (!element) return

    const flexProps = ['display', 'flex-direction', 'justify-content', 'align-items'] as const
    const properties = flexProps.map((cssProperty) => ({
      cssProperty,
      previousValue: element.style.getPropertyValue(cssProperty) || null,
    }))

    pushUndo({ type: 'edit', element, properties })

    const isCurrentlyFlex = current.elementInfo?.isFlexContainer ?? false

    if (isCurrentlyFlex) {
      for (const cssProperty of flexProps) {
        element.style.removeProperty(cssProperty)
      }
    } else {
      element.style.setProperty('display', 'flex')
    }

    const computed = getAllComputedStyles(element)
    const elementInfo = getElementInfo(element)

    const newPending = { ...current.pendingStyles }
    if (isCurrentlyFlex) {
      for (const cssProperty of flexProps) {
        delete newPending[cssProperty]
      }
    } else {
      newPending['display'] = 'flex'
    }

    setState((prev) => ({
      ...prev,
      computedFlex: computed.flex,
      computedSpacing: computed.spacing,
      computedBorderRadius: computed.borderRadius,
      computedSizing: computed.sizing,
      elementInfo,
      pendingStyles: newPending,
    }))
  }, [pushUndo])

  const updateSizingProperties = React.useCallback(
    (
      changes: Partial<Record<SizingPropertyKey, SizingValue>>,
      options?: SizingChangeOptions
    ) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      if (sizingTransactionRef.current && sizingTransactionRef.current.element !== el) {
        sizingTransactionRef.current = null
      }

      const transactionId = options?.transactionId
      const phase = options?.phase

      if (phase === 'start' && transactionId) {
        beginSizingTransaction(el, transactionId)
      }

      const requestedKeys = (Object.keys(changes) as SizingPropertyKey[]).filter((key) => changes[key] !== undefined)

      const effectiveChanges: Array<{
        key: SizingPropertyKey
        value: SizingValue
        cssProperty: string
        cssValue: string
      }> = []

      const undoProperties: Array<{ cssProperty: string; previousValue: string | null }> = []

      for (const key of requestedKeys) {
        const value = changes[key]
        if (!value) continue

        const cssProperty = sizingPropertyToCSSMap[key]
        const cssValue = sizingValueToCSS(value)
        const previousValue = el.style.getPropertyValue(cssProperty) || null
        if (previousValue === cssValue) continue

        effectiveChanges.push({ key, value, cssProperty, cssValue })
        undoProperties.push({ cssProperty, previousValue })
      }

      if (effectiveChanges.length > 0) {
        if (transactionId) {
          const current = sizingTransactionRef.current
          if (!current || current.id !== transactionId || current.element !== el) {
            beginSizingTransaction(el, transactionId)
          }

          const transaction = sizingTransactionRef.current
          if (transaction && !transaction.undoPushed) {
            pushUndo({ type: 'edit', element: el, properties: transaction.snapshot })
            transaction.undoPushed = true
          }
        } else {
          pushUndo({ type: 'edit', element: el, properties: undoProperties })
        }

        const computedSizingPatch: Partial<Record<SizingPropertyKey, SizingValue>> = {}
        const pendingUpdates: Record<string, string> = {}

        for (const change of effectiveChanges) {
          el.style.setProperty(change.cssProperty, change.cssValue)
          computedSizingPatch[change.key] = change.value
          pendingUpdates[change.cssProperty] = change.cssValue
        }

        setState((prev) => ({
          ...prev,
          computedSizing: prev.computedSizing
            ? {
                ...prev.computedSizing,
                ...computedSizingPatch,
              }
            : null,
          pendingStyles: {
            ...prev.pendingStyles,
            ...pendingUpdates,
          },
        }))
      }

      if (phase === 'end') {
        endSizingTransaction(transactionId)
      }
    },
    [beginSizingTransaction, endSizingTransaction, pushUndo]
  )

  const updateSizingProperty = React.useCallback(
    (key: SizingPropertyKey, value: SizingValue) => {
      updateSizingProperties({ [key]: value })
    },
    [updateSizingProperties]
  )

  const updateColorProperty = React.useCallback(
    (key: ColorPropertyKey, value: ColorValue) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = colorPropertyToCSSMap[key]
      const cssValue = formatColorValue(value)

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, cssValue)

      setState((prev) => ({
        ...prev,
        computedColor: prev.computedColor
          ? {
              ...prev.computedColor,
              [key]: value,
            }
          : null,
        pendingStyles: {
          ...prev.pendingStyles,
          [cssProperty]: cssValue,
        },
      }))
    },
    [pushUndo]
  )

  const replaceSelectionColor = React.useCallback(
    (from: ColorValue, to: ColorValue) => {
      const root = stateRef.current.selectedElement
      if (!root) return

      const matches = collectMatchingColorProperties(root, from)
      if (matches.size === 0) return

      const cssValue = formatColorValue(to)
      const rootPendingUpdates: Record<string, string> = {}
      let hasSessionChanges = false

      for (const [element, properties] of matches.entries()) {
        const undoProperties: Array<{ cssProperty: string; previousValue: string | null }> = []
        const pendingUpdates: Record<string, string> = {}

        for (const cssProperty of properties) {
          const previousValue = element.style.getPropertyValue(cssProperty) || null
          if (previousValue === cssValue) continue
          undoProperties.push({ cssProperty, previousValue })
          element.style.setProperty(cssProperty, cssValue)
          pendingUpdates[cssProperty] = cssValue
        }

        if (undoProperties.length === 0) continue
        pushUndo({ type: 'edit', element, properties: undoProperties })

        if (element === root) {
          Object.assign(rootPendingUpdates, pendingUpdates)
        }

        if (sessionEditsRef) {
          removedSessionEditsRef?.current.delete(element)
          const existing = sessionEditsRef.current.get(element)
          const mergedPending = {
            ...(existing?.pendingStyles ?? {}),
            ...pendingUpdates,
          }

          sessionEditsRef.current.set(element, {
            element,
            locator: existing?.locator ?? getElementLocator(element),
            originalStyles: existing?.originalStyles ?? getOriginalInlineStyles(element),
            pendingStyles: mergedPending,
            move: existing?.move ?? null,
            textEdit: existing?.textEdit ?? null,
          })
          hasSessionChanges = true
        }
      }

      const border = getComputedBorderStyles(root)
      const color = getComputedColorStyles(root)
      const boxShadow = getComputedBoxShadow(root)

      setState((prev) => ({
        ...prev,
        computedBorder: border,
        computedColor: color,
        computedBoxShadow: boxShadow,
        pendingStyles: {
          ...prev.pendingStyles,
          ...rootPendingUpdates,
        },
      }))

      if (hasSessionChanges) {
        syncSessionItemCount?.()
      }
    },
    [pushUndo, removedSessionEditsRef, sessionEditsRef, setState, stateRef, syncSessionItemCount]
  )

  const updateTypographyProperty = React.useCallback(
    (key: TypographyPropertyKey, value: CSSPropertyValue | string) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = typographyPropertyToCSSMap[key]
      const cssValue = typeof value === 'string' ? value : formatPropertyValue(value)

      if (key === 'textVerticalAlign') {
        const prevDisplay = el.style.getPropertyValue('display') || null
        const prevAlignItems = el.style.getPropertyValue('align-items') || null
        pushUndo({
          type: 'edit',
          element: el,
          properties: [
            { cssProperty: 'display', previousValue: prevDisplay },
            { cssProperty: 'align-items', previousValue: prevAlignItems },
          ],
        })

        const computed = window.getComputedStyle(el)
        const isInline = computed.display === 'inline' || computed.display === 'inline-block'
        const displayValue = isInline ? 'inline-flex' : 'flex'
        el.style.setProperty('display', displayValue)
        el.style.setProperty('align-items', cssValue)
      } else {
        const previousValue = el.style.getPropertyValue(cssProperty) || null
        pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

        el.style.setProperty(cssProperty, cssValue)
      }

      setState((prev) => {
        let displayValue = 'flex'
        if (key === 'textVerticalAlign' && el) {
          const computed = window.getComputedStyle(el)
          const isInline = computed.display === 'inline-flex' || prev.pendingStyles.display === 'inline-flex'
          displayValue = isInline ? 'inline-flex' : 'flex'
        }

        return {
          ...prev,
          computedTypography: prev.computedTypography
            ? {
                ...prev.computedTypography,
                [key]: value,
              }
            : null,
          pendingStyles: {
            ...prev.pendingStyles,
            ...(key === 'textVerticalAlign'
              ? { display: displayValue, 'align-items': cssValue }
              : { [cssProperty]: cssValue }),
          },
        }
      })
    },
    [pushUndo]
  )

  return {
    updateSpacingProperty,
    updateBorderRadiusProperty,
    updateBorderProperty,
    updateBorderProperties,
    updateRawCSS,
    updateFlexProperty,
    toggleFlexLayout,
    updateSizingProperties,
    updateSizingProperty,
    updateColorProperty,
    replaceSelectionColor,
    updateTypographyProperty,
  }
}
