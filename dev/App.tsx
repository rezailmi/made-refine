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

const colorPalettes = {
  gray: ['#f9fafb','#f3f4f6','#e5e7eb','#d1d5db','#9ca3af','#6b7280','#4b5563','#374151','#1f2937','#111827'],
  blue: ['#eff6ff','#dbeafe','#bfdbfe','#93c5fd','#60a5fa','#3b82f6','#2563eb','#1d4ed8','#1e40af','#1e3a8a'],
  emerald: ['#ecfdf5','#d1fae5','#a7f3d0','#6ee7b7','#34d399','#10b981','#059669','#047857','#065f46','#064e3b'],
  amber: ['#fffbeb','#fef3c7','#fde68a','#fcd34d','#fbbf24','#f59e0b','#d97706','#b45309','#92400e','#78350f'],
  rose: ['#fff1f2','#ffe4e6','#fecdd3','#fda4af','#fb7185','#f43f5e','#e11d48','#be123c','#9f1239','#881337'],
}

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
const reproductionChecklist = [
  'Scroll this card to the bottom so the inner list is far below the fold.',
  'Toggle canvas mode and click "Fit to viewport".',
  'Confirm the full reproduction content is visible in canvas view.',
  'Exit canvas mode and confirm the inner scroller returns to normal behavior.',
  'Toggle this checklist off/on to verify the playground control state.',
] as const

function SizeSelector({ selected = 'md' }: { selected?: string }) {
  return (
    <div style={{ display: 'inline-flex', borderRadius: 6, border: `1px solid ${gray[200]}`, overflow: 'hidden' }}>
      {sizes.map((size, i) => {
        const isSelected = size === selected
        return (
          <div
            key={size}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              borderLeft: i > 0 ? `1px solid ${isSelected ? gray[900] : gray[200]}` : undefined,
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
  const [showReproductionChecklist, setShowReproductionChecklist] = React.useState(true)

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

          {/* Color Palette — below the fold to test scroll container expansion in canvas mode */}
          <div style={card}>
            <div style={sectionLabel}>Color Palette</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(['gray', 'blue', 'emerald', 'amber', 'rose'] as const).map((name) => {
                return (
                  <div key={name}>
                    <div style={{ fontSize: 12, fontWeight: 500, marginBottom: 6, textTransform: 'capitalize' }}>{name}</div>
                    <div style={{ display: 'flex', gap: 4 }}>
                      {colorPalettes[name].map((color, i) => (
                        <div key={i} style={{ width: 40, height: 32, backgroundColor: color, borderRadius: 6, border: `1px solid ${gray[200]}` }} />
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Data Table — more below-the-fold content */}
          <div style={card}>
            <div style={sectionLabel}>Data Table</div>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <thead>
                <tr>
                  {['Name', 'Role', 'Status', 'Activity'].map((h) => (
                    <th key={h} style={{ textAlign: 'left', padding: '8px 12px', borderBottom: `1px solid ${gray[200]}`, fontSize: 12, fontWeight: 600, color: gray[500] }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { name: 'Alice Martin', role: 'Engineer', status: 'Active', activity: '2 min ago' },
                  { name: 'Bob Johnson', role: 'Designer', status: 'Away', activity: '1 hr ago' },
                  { name: 'Carol Williams', role: 'PM', status: 'Active', activity: 'just now' },
                  { name: 'David Brown', role: 'Engineer', status: 'Offline', activity: '3 hrs ago' },
                  { name: 'Eva Garcia', role: 'Designer', status: 'Active', activity: '15 min ago' },
                  { name: 'Frank Lee', role: 'Engineer', status: 'Active', activity: '5 min ago' },
                  { name: 'Grace Kim', role: 'PM', status: 'Away', activity: '30 min ago' },
                  { name: 'Hank Davis', role: 'Engineer', status: 'Active', activity: 'just now' },
                ].map((row) => (
                  <tr key={row.name}>
                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${gray[100]}`, fontWeight: 500 }}>{row.name}</td>
                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${gray[100]}`, color: gray[500] }}>{row.role}</td>
                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${gray[100]}` }}>
                      <span style={{ fontSize: 12, fontWeight: 600, padding: '2px 8px', borderRadius: 9999, backgroundColor: row.status === 'Active' ? '#ecfdf5' : row.status === 'Away' ? '#fffbeb' : gray[100], color: row.status === 'Active' ? '#059669' : row.status === 'Away' ? '#d97706' : gray[500] }}>{row.status}</span>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: `1px solid ${gray[100]}`, color: gray[400], fontSize: 13 }}>{row.activity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Scroll Reproduction — mirrors external nested scroller layouts */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 16 }}>
              <div style={{ ...sectionLabel, marginBottom: 0 }}>Scroll Reproduction</div>
              <button
                type="button"
                onClick={() => setShowReproductionChecklist((prev) => !prev)}
                style={{
                  border: `1px solid ${gray[300]}`,
                  borderRadius: 8,
                  padding: '6px 10px',
                  fontSize: 12,
                  fontWeight: 600,
                  backgroundColor: '#fff',
                  color: gray[700],
                  cursor: 'pointer',
                }}
              >
                {showReproductionChecklist ? 'Hide checklist' : 'Show checklist'}
              </button>
            </div>

            <p style={{ margin: '0 0 12px', color: gray[500], fontSize: 13, lineHeight: 1.5 }}>
              This reproduces the external app shape: clipped shell + nested vertical scroller + deep content.
            </p>

            <div style={{ border: `1px solid ${gray[200]}`, borderRadius: 10, padding: 12, backgroundColor: gray[50], marginBottom: 12 }}>
              <div style={{ fontSize: 12, color: gray[500], marginBottom: 8 }}>
                Outer shell
                <code style={{ marginLeft: 6, fontFamily: 'ui-monospace, monospace', backgroundColor: '#fff', padding: '1px 6px', borderRadius: 4, border: `1px solid ${gray[200]}` }}>
                  overflow: hidden; max-height: 280px;
                </code>
              </div>
              <div style={{ maxHeight: 280, height: 280, overflow: 'hidden', border: `1px solid ${gray[300]}`, borderRadius: 8, backgroundColor: '#fff' }}>
                <div style={{ height: '100%', overflowY: 'auto', padding: 12 }}>
                  <div style={{ position: 'sticky', top: 0, zIndex: 1, backgroundColor: '#fff', borderBottom: `1px solid ${gray[100]}`, paddingBottom: 8, marginBottom: 10 }}>
                    <div style={{ fontSize: 12, fontWeight: 700, color: gray[700] }}>Inner scroller (overflow-y: auto)</div>
                    <div style={{ fontSize: 12, color: gray[400] }}>Long content should still be fully measurable in canvas mode.</div>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {Array.from({ length: 30 }).map((_, i) => (
                      <div key={i} style={{ border: `1px solid ${gray[200]}`, borderRadius: 8, padding: 10, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 600 }}>Repro row {i + 1}</div>
                          <div style={{ fontSize: 12, color: gray[500] }}>Nested content block for canvas measurement validation.</div>
                        </div>
                        <Badge variant={i % 3 === 0 ? 'success' : i % 3 === 1 ? 'warning' : 'muted'}>
                          {i % 3 === 0 ? 'active' : i % 3 === 1 ? 'check' : 'idle'}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {showReproductionChecklist && (
              <div style={{ border: `1px dashed ${gray[300]}`, borderRadius: 10, padding: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: gray[700], marginBottom: 8 }}>Checklist</div>
                <ol style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {reproductionChecklist.map((item) => (
                    <li key={item} style={{ fontSize: 13, color: gray[600], lineHeight: 1.45 }}>{item}</li>
                  ))}
                </ol>
              </div>
            )}
          </div>

          {/* Footer spacer */}
          <div style={{ padding: '24px 0', textAlign: 'center', color: gray[400], fontSize: 12 }}>
            End of playground — this content should be visible when zoomed out in canvas mode
          </div>

        </div>
      </div>
    </>
  )
}
