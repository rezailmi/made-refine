import * as React from 'react'
import { Input } from '../ui/input'
import {
  Tooltip,
  TooltipTrigger,
  TooltipContent,
} from '../ui/tooltip'
import { cn } from '../cn'

export const selectOnFocus = (e: React.FocusEvent<HTMLInputElement>) => e.target.select()

interface NumberInputProps extends Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange' | 'type'> {
  value: number | null
  onValueChange: (value: number) => void
}

export function NumberInput({ value: propValue, onValueChange, ...props }: NumberInputProps) {
  const [localValue, setLocalValue] = React.useState(propValue === null ? '' : String(propValue))

  React.useEffect(() => {
    setLocalValue(propValue === null ? '' : String(propValue))
  }, [propValue])

  return (
    <Input
      {...props}
      type="number"
      value={localValue}
      onChange={(e) => {
        setLocalValue(e.target.value)
        const parsed = parseFloat(e.target.value)
        if (!isNaN(parsed)) onValueChange(parsed)
      }}
      onBlur={() => {
        if (localValue === '' || isNaN(parseFloat(localValue))) {
          setLocalValue(propValue === null ? '' : String(propValue))
        }
      }}
      onFocus={selectOnFocus}
    />
  )
}

export function Tip({ children, label, side = 'top' }: { children: React.ReactElement; label: React.ReactNode; side?: 'top' | 'bottom' | 'left' | 'right' }) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent side={side}>{label}</TooltipContent>
    </Tooltip>
  )
}

interface CollapsibleSectionProps {
  title: string
  actions?: React.ReactNode
  children: React.ReactNode
}

export function CollapsibleSection({ title, actions, children }: CollapsibleSectionProps) {
  return (
    <div>
      <div className="flex w-full items-center justify-between border-b border-border/50 px-3 py-2.5 text-xs font-medium text-foreground">
        <span>{title}</span>
        {actions}
      </div>
      {children != null && <div className="px-3 py-3.5">{children}</div>}
    </div>
  )
}

export type SectionKey = 'layout' | 'radius' | 'border' | 'shadow' | 'colors' | 'text'

export const SECTION_LABELS: Record<SectionKey, string> = {
  layout: 'Layout',
  radius: 'Radius',
  border: 'Border',
  shadow: 'Shadow',
  colors: 'Colors',
  text: 'Text',
}

export function useSectionNav(sectionRefs: Record<SectionKey, React.RefObject<HTMLDivElement | null>>) {
  const scrollRef = React.useRef<HTMLDivElement>(null)
  const [activeSection, setActiveSection] = React.useState<SectionKey>('layout')

  React.useEffect(() => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return

    const handleScroll = () => {
      const keys = Object.keys(sectionRefs) as SectionKey[]
      let closest: SectionKey = 'layout'
      let closestDist = Infinity

      for (const key of keys) {
        const el = sectionRefs[key].current
        if (!el) continue
        const dist = Math.abs(el.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top)
        if (dist < closestDist) {
          closestDist = dist
          closest = key
        }
      }

      setActiveSection(closest)
    }

    scrollEl.addEventListener('scroll', handleScroll, { passive: true })
    return () => scrollEl.removeEventListener('scroll', handleScroll)
  }, [sectionRefs])

  return { scrollRef, activeSection }
}

export function SectionNav({
  scrollRef,
  activeSection,
  showColors,
  showText,
  sectionRefs,
}: {
  scrollRef: React.RefObject<HTMLDivElement | null>
  activeSection: SectionKey
  showColors: boolean
  showText: boolean
  sectionRefs: Record<SectionKey, React.RefObject<HTMLDivElement | null>>
}) {
  const sections: SectionKey[] = ['layout', 'radius', 'border', 'shadow']
  if (showText) sections.push('text')
  if (showColors) sections.push('colors')

  const handleClick = (key: SectionKey) => {
    const scrollEl = scrollRef.current
    if (!scrollEl) return
    if (key === 'layout') {
      scrollEl.scrollTo({ top: 0, behavior: 'smooth' })
      return
    }
    const el = sectionRefs[key].current
    if (!el) return
    const top = el.offsetTop - scrollEl.offsetTop
    scrollEl.scrollTo({ top, behavior: 'smooth' })
  }

  const handleNavWheelCapture = (e: React.WheelEvent<HTMLDivElement>) => {
    const navEl = e.currentTarget
    const maxScrollLeft = navEl.scrollWidth - navEl.clientWidth
    if (maxScrollLeft <= 0) return

    // Keep wheel interaction within the jump-links strip so canvas mode
    // doesn't pan the page while the user is scrolling these tabs.
    e.stopPropagation()

    const delta = Math.abs(e.deltaX) > 0 ? e.deltaX : e.deltaY
    if (delta === 0) return
    e.preventDefault()
    navEl.scrollLeft += delta
  }

  return (
    <div
      data-direct-edit="section-nav"
      className="flex shrink-0 gap-0.5 overflow-x-auto overflow-y-hidden whitespace-nowrap border-b border-border/50 bg-background px-2 py-1 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      onWheelCapture={handleNavWheelCapture}
    >
      {sections.map((key) => (
        <button
          key={key}
          type="button"
          className={cn(
            'shrink-0 rounded-md px-2 py-1 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring',
            activeSection === key
              ? 'bg-muted text-foreground'
              : 'text-muted-foreground hover:text-foreground'
          )}
          onClick={() => handleClick(key)}
        >
          {SECTION_LABELS[key]}
        </button>
      ))}
    </div>
  )
}
