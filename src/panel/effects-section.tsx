import * as React from 'react'
import { SimpleSelect } from '../ui/simple-select'
import { NumberInput } from './shared'
import type { EffectsProperties, EffectsPropertyKey } from '../types'

interface EffectsSectionProps {
  effects: EffectsProperties
  elementInfo: { isImageElement: boolean }
  onUpdate: (key: EffectsPropertyKey, value: number | string) => void
}

const OBJECT_FIT_OPTIONS = [
  { value: 'fill', label: 'Fill' },
  { value: 'contain', label: 'Contain' },
  { value: 'cover', label: 'Cover' },
  { value: 'none', label: 'None' },
  { value: 'scale-down', label: 'Scale down' },
]

export function EffectsSection({ effects, elementInfo, onUpdate }: EffectsSectionProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <span className="w-16 shrink-0 text-xs text-muted-foreground">Opacity</span>
        <div className="relative flex-1">
          <NumberInput
            value={effects.opacity}
            onValueChange={(value) =>
              onUpdate('opacity', Math.min(100, Math.max(0, Math.round(value))))
            }
            min={0}
            max={100}
            className="h-7 pr-7 text-xs tabular-nums"
          />
          <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
            %
          </span>
        </div>
      </div>

      {elementInfo.isImageElement && (
        <div className="flex items-center gap-2">
          <span className="w-16 shrink-0 text-xs text-muted-foreground">Object fit</span>
          <div className="flex-1">
            <SimpleSelect
              value={effects.objectFit}
              onValueChange={(value) => onUpdate('objectFit', value)}
              options={OBJECT_FIT_OPTIONS}
              label={
                OBJECT_FIT_OPTIONS.find((option) => option.value === effects.objectFit)?.label ??
                effects.objectFit
              }
              triggerClassName="w-full"
              popupMinWidth="130px"
              itemClassName="relative flex cursor-default select-none items-center rounded-md py-2 pl-7 pr-2 text-xs outline-none hover:bg-muted hover:text-foreground data-[highlighted]:bg-muted data-[highlighted]:text-foreground"
            />
          </div>
        </div>
      )}
    </div>
  )
}
