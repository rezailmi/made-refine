import React from 'react'
import { DirectEdit } from '../src/index'

// Base UI default color tokens (from base-ui.com examples)
const gray = {
  50: 'var(--color-gray-50, #f9fafb)',
  100: 'var(--color-gray-100, #f3f4f6)',
  200: 'var(--color-gray-200, #e5e7eb)',
  300: 'var(--color-gray-300, #d1d5db)',
  500: 'var(--color-gray-500, #6b7280)',
  600: 'var(--color-gray-600, #4b5563)',
  900: 'var(--color-gray-900, #111827)',
}
const blue = 'var(--color-blue, #3b82f6)'

export default function App() {
  return (
    <>
      <DirectEdit />
      <div style={{ fontFamily: 'system-ui, sans-serif', color: gray[900], padding: 32, maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>made-refine dev</h1>
        <p style={{ color: gray[600], marginBottom: 32, fontSize: 14, lineHeight: 1.5 }}>
          Press{' '}
          <kbd style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', padding: '2px 6px', backgroundColor: gray[50], border: `1px solid ${gray[200]}`, borderRadius: '0.375rem' }}>⌘.</kbd>
          {' '}to toggle edit mode. Click any element to inspect and edit styles.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>
          <Card title="Typography">
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Heading Two</h2>
            <h3 style={{ fontSize: 18, fontWeight: 500, marginBottom: 8, color: gray[600] }}>Subheading text</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: gray[600], marginBottom: 8 }}>
              Body text for testing typography editing. Resize, recolor, and restyle this paragraph.
            </p>
            <p style={{ fontSize: 12, color: gray[500] }}>Caption text</p>
          </Card>

          <Card title="Spacing & Layout">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
              <Box>A</Box>
              <Box>B</Box>
              <Box>C</Box>
            </div>
            <div style={{ padding: 12, border: `1px dashed ${gray[200]}` }}>
              <div style={{ padding: 8, border: `1px dashed ${gray[200]}`, fontSize: 13, color: gray[500], textAlign: 'center' }}>
                Nested padding
              </div>
            </div>
          </Card>

          <Card title="Colors">
            <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
              {[gray[900], gray[500], gray[200], gray[100], gray[50]].map((c, i) => (
                <div key={i} style={{ width: 32, height: 32, borderRadius: '0.375rem', background: c, border: `1px solid ${gray[200]}` }} />
              ))}
            </div>
            <div style={{ padding: 12, backgroundColor: gray[900], color: gray[50], borderRadius: '0.375rem', fontSize: 14 }}>
              Dark surface
            </div>
          </Card>

          <Card title="Borders & Radius">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              <div style={{ width: 40, height: 40, borderRadius: 0, border: `2px solid ${gray[900]}` }} />
              <div style={{ width: 40, height: 40, borderRadius: '0.375rem', border: `2px solid ${gray[900]}` }} />
              <div style={{ width: 40, height: 40, borderRadius: 20, border: `2px solid ${gray[900]}` }} />
            </div>
            <div style={{ display: 'flex' }}>
              {['Left', 'Mid', 'Right'].map((label, i) => (
                <div
                  key={label}
                  style={{
                    flex: 1,
                    padding: '6px 0',
                    fontSize: 14,
                    fontWeight: 500,
                    textAlign: 'center',
                    border: `1px solid ${gray[200]}`,
                    marginLeft: i > 0 ? -1 : 0,
                    backgroundColor: i === 1 ? gray[900] : gray[50],
                    color: i === 1 ? gray[50] : gray[900],
                    borderRadius: i === 0 ? '0.375rem 0 0 0.375rem' : i === 2 ? '0 0.375rem 0.375rem 0' : 0,
                  }}
                >
                  {label}
                </div>
              ))}
            </div>
          </Card>

          <Card title="Flex Layout">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 14px', backgroundColor: gray[900], borderRadius: '0.375rem', marginBottom: 12 }}>
              <span style={{ fontSize: 14, fontWeight: 600, color: gray[50] }}>Logo</span>
              <div style={{ display: 'flex', gap: 12 }}>
                {['Home', 'About', 'Blog'].map((l) => (
                  <span key={l} style={{ fontSize: 14, color: gray[500] }}>{l}</span>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, padding: 16, border: `1px solid ${gray[200]}`, borderRadius: '0.375rem' }}>
              <span style={{ fontSize: 14, fontWeight: 500 }}>Centered</span>
              <span style={{ fontSize: 13, color: gray[500] }}>Column layout</span>
            </div>
          </Card>

          <Card title="Sizing">
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 12 }}>
              <div style={{ width: 80, padding: 8, border: `1px solid ${gray[200]}`, borderRadius: '0.375rem', fontSize: 13, color: gray[500] }}>Fixed</div>
              <div style={{ flex: 1, padding: 8, border: `1px solid ${gray[200]}`, borderRadius: '0.375rem', fontSize: 13, color: gray[500] }}>Fill</div>
              <div style={{ padding: 8, border: `1px solid ${gray[200]}`, borderRadius: '0.375rem', fontSize: 13, color: gray[500] }}>Fit</div>
            </div>
            <div style={{ height: 8, backgroundColor: gray[200], borderRadius: '0.375rem', overflow: 'hidden' }}>
              <div style={{ width: '65%', height: 8, backgroundColor: gray[900], borderRadius: '0.375rem' }} />
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: `1px solid ${gray[200]}`, borderRadius: '0.5rem', padding: 20, backgroundColor: gray[50] }}>
      <div style={{ fontSize: 14, fontWeight: 500, marginBottom: 16, color: gray[900] }}>{title}</div>
      {children}
    </div>
  )
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 44, height: 44, borderRadius: '0.375rem', background: gray[100], display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 500, fontSize: 14, color: gray[900] }}>
      {children}
    </div>
  )
}
