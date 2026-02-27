import * as React from 'react'
import { formatColorValue } from '../ui/color-utils'
import { ColorPickerPopover } from '../ui/color-picker'
import { createDefaultShadowLayer, parseShadowLayers, serializeShadowLayers, type EditableShadowLayer } from '../shadow-utils'
import { NumberInput, Tip, CollapsibleSection } from './shared'
import { Button } from '../ui/button'
import {
  Plus,
  Minus,
} from 'lucide-react'

export function ShadowField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="relative">
      <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">{label}</span>
      <NumberInput
        value={value}
        onValueChange={onChange}
        className="h-7 pl-7 pr-2 text-xs tabular-nums"
      />
    </div>
  )
}

export function ShadowLayerEditor({
  layer,
  index,
  onChange,
  onRemoveLayer,
}: {
  layer: EditableShadowLayer
  index: number
  onChange: (next: EditableShadowLayer) => void
  onRemoveLayer: () => void
}) {
  const [hexInput, setHexInput] = React.useState(layer.color.hex)
  const [alphaInput, setAlphaInput] = React.useState(String(layer.color.alpha))

  React.useEffect(() => {
    setHexInput(layer.color.hex)
    setAlphaInput(String(layer.color.alpha))
  }, [layer.color.hex, layer.color.alpha])

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="grid flex-1 grid-cols-4 gap-2">
          <ShadowField label="X" value={layer.x} onChange={(x) => onChange({ ...layer, x })} />
          <ShadowField label="Y" value={layer.y} onChange={(y) => onChange({ ...layer, y })} />
          <Tip label="Blur">
            <div>
              <ShadowField label="B" value={layer.blur} onChange={(blur) => onChange({ ...layer, blur: Math.max(0, blur) })} />
            </div>
          </Tip>
          <Tip label="Spread">
            <div>
              <ShadowField label="S" value={layer.spread} onChange={(spread) => onChange({ ...layer, spread })} />
            </div>
          </Tip>
        </div>
        <Tip label="Remove shadow layer">
          <Button
            variant="ghost"
            size="icon"
            className="size-7 shrink-0 text-muted-foreground"
            onClick={onRemoveLayer}
          >
            <Minus />
          </Button>
        </Tip>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex h-7 flex-1 items-center rounded-md border-0 bg-muted">
          <div className="ml-1">
            <ColorPickerPopover id={`shadow-color-${index}`} value={layer.color} onChange={(color) => onChange({ ...layer, color })}>
              <div
                className="size-5 cursor-pointer rounded-sm shadow-[inset_0_0_0_1px_rgba(0,0,0,0.1)]"
                style={{ backgroundColor: `#${layer.color.hex}` }}
              />
            </ColorPickerPopover>
          </div>
          <input
            type="text"
            value={hexInput}
            onChange={(event) => {
              const cleaned = event.target.value.replace('#', '').toUpperCase()
              if (!/^[0-9A-F]{0,6}$/.test(cleaned)) return
              setHexInput(cleaned)
              if (cleaned.length === 6) {
                onChange({
                  ...layer,
                  color: {
                    ...layer.color,
                    hex: cleaned,
                    raw: formatColorValue({ ...layer.color, hex: cleaned, raw: '' }),
                  },
                })
              }
            }}
            onBlur={() => setHexInput(layer.color.hex)}
            className="h-full w-[68px] bg-transparent px-2 font-mono text-xs uppercase outline-none"
            maxLength={6}
            placeholder="000000"
          />
          <span className="text-xs text-muted-foreground">/</span>
          <input
            type="number"
            value={alphaInput}
            onChange={(event) => {
              setAlphaInput(event.target.value)
              const parsed = parseInt(event.target.value, 10)
              if (Number.isNaN(parsed)) return
              const clamped = Math.max(0, Math.min(100, parsed))
              onChange({
                ...layer,
                color: {
                  ...layer.color,
                  alpha: clamped,
                  raw: formatColorValue({ ...layer.color, alpha: clamped, raw: '' }),
                },
              })
            }}
            onBlur={() => setAlphaInput(String(layer.color.alpha))}
            className="h-full w-10 bg-transparent px-1 text-center text-xs tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [appearance:textfield]"
            min={0}
            max={100}
          />
          <span className="pr-2 text-xs text-muted-foreground">%</span>
        </div>
        <div className="size-7 shrink-0" />
      </div>
    </div>
  )
}

interface ShadowSectionProps {
  boxShadow?: string
  onSetCSS?: (properties: Record<string, string>) => void
  pendingStyles?: Record<string, string>
}

export function ShadowSection({ boxShadow, onSetCSS, pendingStyles }: ShadowSectionProps) {
  const effectiveShadow = (pendingStyles?.['box-shadow'] ?? boxShadow ?? 'none').trim()
  const parsedLayers = React.useMemo(() => parseShadowLayers(effectiveShadow), [effectiveShadow])
  const [layers, setLayers] = React.useState<EditableShadowLayer[]>(parsedLayers)
  const hasShadow = layers.length > 0

  React.useEffect(() => {
    setLayers(parsedLayers)
  }, [parsedLayers])

  const commitLayers = (nextLayers: EditableShadowLayer[]) => {
    setLayers(nextLayers)
    if (!onSetCSS) return
    onSetCSS({ 'box-shadow': serializeShadowLayers(nextLayers) })
  }

  const updateLayer = (index: number, nextLayer: EditableShadowLayer) => {
    const nextLayers = layers.map((layer, layerIndex) => (layerIndex === index ? nextLayer : layer))
    commitLayers(nextLayers)
  }

  const addLayer = () => {
    const nextLayers = [...layers, createDefaultShadowLayer(layers.length)]
    commitLayers(nextLayers)
  }

  const removeLayer = (index: number) => {
    const nextLayers = layers.filter((_, layerIndex) => layerIndex !== index)
    commitLayers(nextLayers)
  }

  const headerActions = (
    <div className="flex items-center gap-2">
      <Tip label={hasShadow ? 'Add shadow layer' : 'Add shadow'}>
        <Button
          variant="ghost"
          size="icon"
          className="size-7 text-muted-foreground"
          onClick={addLayer}
        >
          <Plus />
        </Button>
      </Tip>
    </div>
  )

  return (
    <CollapsibleSection title="Shadow" actions={headerActions}>
      {hasShadow ? (
        <div className="space-y-2">
          {layers.map((layer, index) => (
            <ShadowLayerEditor
              key={`shadow-layer-${index}`}
              layer={layer}
              index={index}
              onChange={(nextLayer) => updateLayer(index, nextLayer)}
              onRemoveLayer={() => removeLayer(index)}
            />
          ))}
        </div>
      ) : null}
    </CollapsibleSection>
  )
}
