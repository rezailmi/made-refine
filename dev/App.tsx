import React from 'react'
import { DirectEdit } from '../src/direct-edit'
import { Avatar, Button, Badge } from './components'

const gray = {
  50: 'var(--color-gray-50, #f9fafb)',
  100: 'var(--color-gray-100, #f3f4f6)',
  200: 'var(--color-gray-200, #e5e7eb)',
  300: 'var(--color-gray-300, #d1d5db)',
  400: 'var(--color-gray-400, #9ca3af)',
  500: 'var(--color-gray-500, #6b7280)',
  600: 'var(--color-gray-600, #4b5563)',
  700: 'var(--color-gray-700, #374151)',
  800: 'var(--color-gray-800, #1f2937)',
  900: 'var(--color-gray-900, #111827)',
}
const emerald = '#10b981'
const rose = '#f43f5e'

const sectionLabel = {
  fontSize: 11,
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: gray[400],
  marginBottom: 16,
}

const card = {
  border: `1px solid ${gray[200]}`,
  borderRadius: 12,
  padding: 24,
  backgroundColor: '#fff',
}

const sizes = ['xs', 'sm', 'md', 'lg', 'xl'] as const

function SizeSelector({ selected = 'md' }: { selected?: string }) {
  return (
    <div style={{ display: 'flex' }}>
      {sizes.map((size, i) => {
        const isSelected = size === selected
        const isFirst = i === 0
        const isLast = i === sizes.length - 1
        return (
          <div
            key={size}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              border: `1px solid ${isSelected ? gray[900] : gray[200]}`,
              borderLeft: i > 0 ? 'none' : undefined,
              borderRadius: isFirst ? '6px 0 0 6px' : isLast ? '0 6px 6px 0' : 0,
              backgroundColor: isSelected ? gray[900] : 'transparent',
              color: isSelected ? '#fff' : gray[500],
            }}
          >
            {size}
          </div>
        )
      })}
    </div>
  )
}

function UserCard({ initials, name, role, count }: { initials: string; name: string; role: string; count: number }) {
  return (
    <div style={{ border: `1px solid ${gray[200]}`, borderRadius: 10, padding: 16 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar initials={initials} size={40} />
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>{name}</div>
          <div style={{ fontSize: 13, color: gray[500] }}>{role}</div>
        </div>
        <div style={{ backgroundColor: rose, color: '#fff', padding: '2px 8px', borderRadius: 9999, fontSize: 12, fontWeight: 600 }}>+{count}</div>
      </div>
    </div>
  )
}

function ComponentsAndSizing() {
  return (
    <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ ...sectionLabel, marginBottom: 0 }}>Components & Sizing</div>
      <UserCard initials="JC" name="Jane Cooper" role="Designer" count={3} />
      <div style={{ display: 'flex', gap: 8 }}>
        <Badge variant="success">Active</Badge>
        <Badge variant="warning">Pending</Badge>
        <Badge variant="muted">Draft</Badge>
      </div>
      <SizeSelector selected="md" />
    </div>
  )
}

export default function App() {
  return (
    <>
      <DirectEdit />
      <div style={{ fontFamily: 'system-ui, sans-serif', color: gray[900], padding: 32, maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>handmade playground</h1>
        <p style={{ color: gray[500], marginBottom: 32, fontSize: 14, lineHeight: 1.5 }}>
          Press{' '}
          <kbd style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', padding: '2px 6px', backgroundColor: gray[100], border: `1px solid ${gray[200]}`, borderRadius: '0.375rem' }}>⌘.</kbd>
          {' '}to toggle edit mode. Click any element to inspect and edit styles.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Layout & Flex */}
          <div style={card}>
            <div style={sectionLabel}>Layout & Flex</div>
            <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 12 }}>Dashboard</div>
            <div style={{ display: 'flex', gap: 12 }}>
              {[
                { label: 'Views', value: '2,847' },
                { label: 'Active', value: '128' },
                { label: 'Growth', value: '+24%' },
              ].map((metric) => (
                <div key={metric.label} style={{ flex: 1, border: `1px solid ${gray[200]}`, borderRadius: 8, padding: 16 }}>
                  <div style={{ fontSize: 12, color: gray[500], marginBottom: 4 }}>{metric.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em', color: metric.label === 'Growth' ? emerald : gray[900] }}>{metric.value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Radius & Style */}
          <div style={card}>
            <div style={sectionLabel}>Radius & Style</div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
              {[
                { name: 'Sharp', radius: 0, px: '0px' },
                { name: 'Subtle', radius: 8, px: '8px' },
                { name: 'Rounded', radius: 16, px: '16px' },
                { name: 'Pill', radius: 26, px: '26px' },
              ].map((r) => (
                <div key={r.name} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 64, height: 48, backgroundColor: gray[900], borderRadius: r.radius }} />
                  <div style={{ fontSize: 13, fontWeight: 500, marginTop: 8 }}>{r.name}</div>
                  <div style={{ fontSize: 11, color: gray[400] }}>{r.px}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="primary">Primary</Button>
              <Button variant="secondary">Secondary</Button>
              <Button variant="ghost">Ghost</Button>
              <Button variant="danger">Danger</Button>
            </div>
          </div>

          {/* Typography & Spacing */}
          <div style={card}>
            <div style={sectionLabel}>Typography & Spacing</div>
            <div style={{ fontSize: 28, fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, marginBottom: 8 }}>The quick brown fox</div>
            <p style={{ fontSize: 14, color: gray[500], lineHeight: 1.5, margin: '0 0 12px' }}>Adjust font sizes, weights, line-height, and letter-spacing</p>
            <div style={{ fontFamily: 'ui-monospace, monospace', fontSize: 11, color: gray[400], marginBottom: 20 }}>Caption · Monospace · 11px</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end' }}>
              {[4, 8, 12, 16, 20, 24, 32, 40, 48].map((token) => (
                <div key={token} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{ width: 28, height: token * 1.2, backgroundColor: gray[200], borderRadius: 3 }} />
                  <div style={{ fontSize: 10, color: gray[400], marginTop: 4 }}>{token}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Components & Sizing */}
          <ComponentsAndSizing />

        </div>
      </div>
    </>
  )
}
