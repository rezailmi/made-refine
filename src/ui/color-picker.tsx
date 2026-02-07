import * as React from 'react'
import { Popover } from '@base-ui/react/popover'
import { usePortalContainer } from '../portal-container'
import type { ColorValue } from '../types'
import {
  hexToRgb,
  rgbToHex,
  rgbToHsv,
  hsvToRgb,
  rgbToHsl,
  hslToRgb,
  formatColorValue,
} from './color-utils'

function ColorPickerPortal(props: React.ComponentPropsWithoutRef<typeof Popover.Portal>) {
  const container = usePortalContainer()
  return <Popover.Portal container={container} {...props} />
}

interface ColorPickerGroupContextValue {
  activePickerId: string | null
  setActivePickerId: (id: string | null) => void
}

const ColorPickerGroupContext = React.createContext<ColorPickerGroupContextValue | null>(null)

export function ColorPickerGroup({ children }: { children: React.ReactNode }) {
  const [activePickerId, setActivePickerId] = React.useState<string | null>(null)
  return (
    <ColorPickerGroupContext.Provider value={{ activePickerId, setActivePickerId }}>
      {children}
    </ColorPickerGroupContext.Provider>
  )
}

function useDrag(onMove: (x: number, y: number, rect: DOMRect) => void) {
  const ref = React.useRef<HTMLDivElement>(null)

  const handlePointerEvent = React.useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      const el = ref.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const x = Math.max(0, Math.min(e.clientX - rect.left, rect.width))
      const y = Math.max(0, Math.min(e.clientY - rect.top, rect.height))
      onMove(x, y, rect)
    },
    [onMove]
  )

  const onPointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault()
      ref.current?.setPointerCapture(e.pointerId)
      handlePointerEvent(e)
    },
    [handlePointerEvent]
  )

  const onPointerMove = React.useCallback(
    (e: React.PointerEvent) => {
      if (e.buttons === 0) return
      handlePointerEvent(e)
    },
    [handlePointerEvent]
  )

  return { ref, onPointerDown, onPointerMove }
}

interface SaturationValueAreaProps {
  hue: number
  saturation: number
  value: number
  onChange: (s: number, v: number) => void
}

function SaturationValueArea({ hue, saturation, value, onChange }: SaturationValueAreaProps) {
  const drag = useDrag((x, _y, rect) => {
    onChange((x / rect.width) * 100, (1 - _y / rect.height) * 100)
  })

  return (
    <div
      ref={drag.ref}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      className="relative h-[150px] flex-1 cursor-crosshair rounded-sm"
      style={{ backgroundColor: `hsl(${hue}, 100%, 50%)` }}
    >
      <div className="pointer-events-none absolute inset-0 rounded-sm" style={{ background: 'linear-gradient(to right, #fff, transparent)' }} />
      <div className="pointer-events-none absolute inset-0 rounded-sm" style={{ background: 'linear-gradient(to bottom, transparent, #000)' }} />
      <div
        className="pointer-events-none absolute size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
        style={{ left: `${saturation}%`, top: `${100 - value}%` }}
      />
    </div>
  )
}

interface VerticalSliderProps {
  value: number
  max: number
  background: string
  onChange: (value: number) => void
  checkerboard?: boolean
}

function VerticalSlider({ value, max, background, onChange, checkerboard }: VerticalSliderProps) {
  const drag = useDrag((_x, y, rect) => {
    onChange((y / rect.height) * max)
  })

  const pct = (value / max) * 100

  return (
    <div
      ref={drag.ref}
      onPointerDown={drag.onPointerDown}
      onPointerMove={drag.onPointerMove}
      className="relative w-4 cursor-pointer rounded-sm"
      style={
        checkerboard
          ? {
              backgroundImage:
                'conic-gradient(#ccc 25%, #fff 25% 50%, #ccc 50% 75%, #fff 75%)',
              backgroundSize: '8px 8px',
            }
          : undefined
      }
    >
      <div className="pointer-events-none absolute inset-0 rounded-sm" style={{ background }} />
      <div
        className="pointer-events-none absolute left-1/2 h-2 w-full -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-white shadow-[0_0_0_1px_rgba(0,0,0,0.3)]"
        style={{ top: `${pct}%` }}
      />
    </div>
  )
}

function NumericInput({
  label,
  value,
  max,
  onChange,
}: {
  label: string
  value: number
  max: number
  onChange: (v: number) => void
}) {
  const [local, setLocal] = React.useState(Math.round(value).toString())

  React.useEffect(() => {
    setLocal(Math.round(value).toString())
  }, [value])

  return (
    <div className="flex items-center gap-1">
      <span className="w-3 text-[10px] text-muted-foreground">{label}</span>
      <input
        type="text"
        value={local}
        onChange={(e) => {
          setLocal(e.target.value)
          const n = parseInt(e.target.value)
          if (!isNaN(n) && n >= 0 && n <= max) onChange(n)
        }}
        onBlur={() => setLocal(Math.round(value).toString())}
        className="h-6 w-9 rounded border border-input bg-transparent px-1 text-center text-[11px] tabular-nums outline-none"
      />
    </div>
  )
}

interface ColorPickerPopoverProps {
  id?: string
  value: ColorValue
  onChange: (value: ColorValue) => void
  children: React.ReactNode
}

export function ColorPickerPopover({ id, value, onChange, children }: ColorPickerPopoverProps) {
  const group = React.useContext(ColorPickerGroupContext)
  const rgb = hexToRgb(value.hex)
  const initialHsv = rgbToHsv(rgb.r, rgb.g, rgb.b)

  const [hsv, setHsv] = React.useState({ h: initialHsv.h, s: initialHsv.s, v: initialHsv.v })
  const [alpha, setAlpha] = React.useState(value.alpha)

  // Track the last hex we synced from to avoid overwriting HSV on our own updates
  const lastSyncedHex = React.useRef(value.hex)

  React.useEffect(() => {
    if (value.hex !== lastSyncedHex.current) {
      const newRgb = hexToRgb(value.hex)
      const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b)
      // Preserve hue when saturation or value is 0 (would lose hue info)
      setHsv((prev) => ({
        h: newHsv.s === 0 || newHsv.v === 0 ? prev.h : newHsv.h,
        s: newHsv.s,
        v: newHsv.v,
      }))
      lastSyncedHex.current = value.hex
    }
    setAlpha(value.alpha)
  }, [value.hex, value.alpha])

  const emitChange = React.useCallback(
    (h: number, s: number, v: number, a: number) => {
      const newRgb = hsvToRgb(h, s, v)
      const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
      lastSyncedHex.current = hex
      onChange({
        hex,
        alpha: a,
        raw: formatColorValue({ hex, alpha: a, raw: '' }),
      })
    },
    [onChange]
  )

  const handleSVChange = (s: number, v: number) => {
    setHsv((prev) => ({ ...prev, s, v }))
    emitChange(hsv.h, s, v, alpha)
  }

  const handleHueChange = (h: number) => {
    setHsv((prev) => ({ ...prev, h }))
    emitChange(h, hsv.s, hsv.v, alpha)
  }

  const handleAlphaChange = (a: number) => {
    const clamped = Math.round(Math.max(0, Math.min(100, (1 - a / 100) * 100)))
    setAlpha(clamped)
    emitChange(hsv.h, hsv.s, hsv.v, clamped)
  }

  // Derived values for display
  const currentRgb = hsvToRgb(hsv.h, hsv.s, hsv.v)
  const currentHsl = rgbToHsl(currentRgb.r, currentRgb.g, currentRgb.b)
  const currentHex = rgbToHex(currentRgb.r, currentRgb.g, currentRgb.b)

  const handleHslChange = (field: 'h' | 's' | 'l', val: number) => {
    const newHsl = { ...currentHsl, [field]: val }
    const newRgb = hslToRgb(newHsl.h, newHsl.s, newHsl.l)
    const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b)
    // Preserve hue in HSV when saturation drops to 0
    setHsv((prev) => ({
      h: field === 'h' ? val : newHsv.s === 0 || newHsv.v === 0 ? prev.h : newHsv.h,
      s: newHsv.s,
      v: newHsv.v,
    }))
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
    lastSyncedHex.current = hex
    onChange({ hex, alpha, raw: formatColorValue({ hex, alpha, raw: '' }) })
  }

  const handleRgbChange = (field: 'r' | 'g' | 'b', val: number) => {
    const newRgb = { ...currentRgb, [field]: val }
    const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b)
    setHsv((prev) => ({
      h: newHsv.s === 0 || newHsv.v === 0 ? prev.h : newHsv.h,
      s: newHsv.s,
      v: newHsv.v,
    }))
    const hex = rgbToHex(newRgb.r, newRgb.g, newRgb.b)
    lastSyncedHex.current = hex
    onChange({ hex, alpha, raw: formatColorValue({ hex, alpha, raw: '' }) })
  }

  const handleHexInput = (input: string) => {
    const cleaned = input.replace('#', '').toUpperCase()
    if (/^[0-9A-F]{6}$/.test(cleaned)) {
      const newRgb = hexToRgb(cleaned)
      const newHsv = rgbToHsv(newRgb.r, newRgb.g, newRgb.b)
      setHsv((prev) => ({
        h: newHsv.s === 0 || newHsv.v === 0 ? prev.h : newHsv.h,
        s: newHsv.s,
        v: newHsv.v,
      }))
      lastSyncedHex.current = cleaned
      onChange({ hex: cleaned, alpha, raw: formatColorValue({ hex: cleaned, alpha, raw: '' }) })
    }
  }

  const handleAlphaInput = (input: string) => {
    const n = parseInt(input)
    if (!isNaN(n) && n >= 0 && n <= 100) {
      setAlpha(n)
      emitChange(hsv.h, hsv.s, hsv.v, n)
    }
  }

  const alphaGradient = `linear-gradient(to bottom, #${currentHex}, transparent)`

  const isControlled = group !== null && id !== undefined
  const isOpen = isControlled ? group.activePickerId === id : undefined
  const handleOpenChange = isControlled
    ? (open: boolean) => { group.setActivePickerId(open ? id : null) }
    : undefined

  // Close on outside click — Shadow DOM breaks base-ui's built-in dismiss
  const popupRef = React.useRef<HTMLDivElement>(null)
  const triggerRef = React.useRef<HTMLButtonElement>(null)
  const onCloseRef = React.useRef<() => void>()
  onCloseRef.current = () => group?.setActivePickerId(null)

  React.useEffect(() => {
    if (!isOpen) return

    function handlePointerDown(e: PointerEvent) {
      const path = e.composedPath()
      if (popupRef.current && path.includes(popupRef.current)) return
      if (triggerRef.current && path.includes(triggerRef.current)) return
      onCloseRef.current?.()
    }

    const raf = requestAnimationFrame(() => {
      document.addEventListener('pointerdown', handlePointerDown)
    })

    return () => {
      cancelAnimationFrame(raf)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [isOpen])

  return (
    <Popover.Root open={isOpen} onOpenChange={handleOpenChange}>
      <Popover.Trigger ref={triggerRef} render={<button type="button" />} className="flex appearance-none items-center border-0 bg-transparent p-0 leading-none">
        {children}
      </Popover.Trigger>
      <ColorPickerPortal>
        <Popover.Positioner side="bottom" align="start" sideOffset={4} className="fixed z-[99999]" style={{ pointerEvents: 'auto' }}>
          <Popover.Popup ref={popupRef} className="w-[260px] rounded-lg border border-input bg-popover p-3 shadow-md">
            {/* Gradient area + sliders */}
            <div className="flex gap-2">
              <SaturationValueArea
                hue={hsv.h}
                saturation={hsv.s}
                value={hsv.v}
                onChange={handleSVChange}
              />
              <VerticalSlider
                value={hsv.h}
                max={360}
                background="linear-gradient(to bottom, #f00 0%, #ff0 17%, #0f0 33%, #0ff 50%, #00f 67%, #f0f 83%, #f00 100%)"
                onChange={handleHueChange}
              />
              <VerticalSlider
                value={(1 - alpha / 100) * 100}
                max={100}
                background={alphaGradient}
                onChange={handleAlphaChange}
                checkerboard
              />
            </div>

            {/* HSL row */}
            <div className="mt-2.5 flex gap-2">
              <NumericInput label="H" value={currentHsl.h} max={360} onChange={(v) => handleHslChange('h', v)} />
              <NumericInput label="S" value={currentHsl.s} max={100} onChange={(v) => handleHslChange('s', v)} />
              <NumericInput label="L" value={currentHsl.l} max={100} onChange={(v) => handleHslChange('l', v)} />
            </div>

            {/* RGB row */}
            <div className="mt-1.5 flex gap-2">
              <NumericInput label="R" value={currentRgb.r} max={255} onChange={(v) => handleRgbChange('r', v)} />
              <NumericInput label="G" value={currentRgb.g} max={255} onChange={(v) => handleRgbChange('g', v)} />
              <NumericInput label="B" value={currentRgb.b} max={255} onChange={(v) => handleRgbChange('b', v)} />
            </div>

            {/* Hex + Alpha row */}
            <div className="mt-1.5 flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground">#</span>
              <HexInput value={currentHex} onChange={handleHexInput} />
              <span className="text-[10px] text-muted-foreground">/</span>
              <AlphaInput value={alpha} onChange={handleAlphaInput} />
              <span className="text-[10px] text-muted-foreground">%</span>
            </div>
          </Popover.Popup>
        </Popover.Positioner>
      </ColorPickerPortal>
    </Popover.Root>
  )
}

function HexInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const [local, setLocal] = React.useState(value)

  React.useEffect(() => {
    setLocal(value)
  }, [value])

  return (
    <input
      type="text"
      value={local}
      onChange={(e) => {
        setLocal(e.target.value.toUpperCase())
        onChange(e.target.value)
      }}
      onBlur={() => setLocal(value)}
      className="h-6 w-[60px] rounded border border-input bg-transparent px-1 font-mono text-[11px] uppercase outline-none"
      maxLength={6}
    />
  )
}

function AlphaInput({ value, onChange }: { value: number; onChange: (v: string) => void }) {
  const [local, setLocal] = React.useState(value.toString())

  React.useEffect(() => {
    setLocal(value.toString())
  }, [value])

  return (
    <input
      type="text"
      value={local}
      onChange={(e) => {
        setLocal(e.target.value)
        onChange(e.target.value)
      }}
      onBlur={() => setLocal(value.toString())}
      className="h-6 w-8 rounded border border-input bg-transparent px-1 text-center text-[11px] tabular-nums outline-none"
      maxLength={3}
    />
  )
}
