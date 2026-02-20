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
  ColorPropertyKey,
  ColorValue,
  UndoEntry,
} from './types'
import {
  getAllComputedStyles,
  getComputedBorderStyles,
  getComputedColorStyles,
  getComputedBoxShadow,
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
} from './utils'
import { formatColorValue } from './ui/color-utils'

export interface StyleUpdaterOptions {
  stateRef: React.MutableRefObject<DirectEditState>
  pushUndo: (entry: UndoEntry) => void
  setState: React.Dispatch<React.SetStateAction<DirectEditState>>
}

export function useStyleUpdaters({ stateRef, pushUndo, setState }: StyleUpdaterOptions) {

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

      for (const [cssProperty, cssValue] of Object.entries(properties)) {
        const previousValue = el.style.getPropertyValue(cssProperty) || null
        undoProperties.push({ cssProperty, previousValue })
        el.style.setProperty(cssProperty, cssValue)
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

  const updateSizingProperty = React.useCallback(
    (key: SizingPropertyKey, value: SizingValue) => {
      const el = stateRef.current.selectedElement
      if (!el) return

      const cssProperty = sizingPropertyToCSSMap[key]
      const cssValue = sizingValueToCSS(value)

      const previousValue = el.style.getPropertyValue(cssProperty) || null
      pushUndo({ type: 'edit', element: el, properties: [{ cssProperty, previousValue }] })

      el.style.setProperty(cssProperty, cssValue)

      setState((prev) => ({
        ...prev,
        computedSizing: prev.computedSizing
          ? {
              ...prev.computedSizing,
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
    updateSizingProperty,
    updateColorProperty,
    updateTypographyProperty,
  }
}
