import * as React from 'react'
import { createDefaultShadowLayer, parseShadowLayers, serializeShadowLayers, type EditableShadowLayer } from '../shadow-utils'
import { NumberInput, Tip, CollapsibleSection } from './shared'
import { ColorInput } from './fill-section'
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
        <ColorInput
          id={`shadow-color-${index}`}
          value={layer.color}
          onChange={(color) => onChange({ ...layer, color })}
          className="flex-1"
        />
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
