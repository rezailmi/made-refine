import React from 'react'
import { DirectEdit } from '../src/index'

export default function App() {
  return (
    <>
      <DirectEdit />
      <div style={{ fontFamily: 'system-ui, sans-serif', padding: 32, maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 32, fontWeight: 700, marginBottom: 8 }}>made-refine dev</h1>
        <p style={{ color: '#666', marginBottom: 32 }}>
          Press <kbd style={{ padding: '2px 6px', background: '#f0f0f0', borderRadius: 4, border: '1px solid #ddd' }}>Cmd+.</kbd> to toggle edit mode. Click any element to inspect and edit styles.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 24 }}>
          <Card title="Typography" color="#3b82f6">
            <h2 style={{ fontSize: 24, fontWeight: 600, marginBottom: 4 }}>Heading Two</h2>
            <h3 style={{ fontSize: 20, fontWeight: 500, marginBottom: 4 }}>Heading Three</h3>
            <p style={{ fontSize: 14, lineHeight: 1.6, color: '#444' }}>
              Body text for testing typography editing. Resize, recolor, and restyle this paragraph.
            </p>
          </Card>

          <Card title="Spacing &amp; Layout" color="#10b981">
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Box>A</Box>
              <Box>B</Box>
              <Box>C</Box>
            </div>
          </Card>

          <Card title="Colors" color="#f59e0b">
            <div style={{ display: 'flex', gap: 8 }}>
              {['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6'].map((c) => (
                <div key={c} style={{ width: 36, height: 36, borderRadius: 8, background: c }} />
              ))}
            </div>
          </Card>

          <Card title="Borders &amp; Radius" color="#8b5cf6">
            <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
              <div style={{ width: 48, height: 48, borderRadius: 0, border: '2px solid #8b5cf6' }} />
              <div style={{ width: 48, height: 48, borderRadius: 8, border: '2px solid #8b5cf6' }} />
              <div style={{ width: 48, height: 48, borderRadius: 24, border: '2px solid #8b5cf6' }} />
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

function Card({ title, color, children }: { title: string; color: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid #e5e7eb', borderRadius: 12, padding: 20, background: '#fff' }}>
      <div style={{ fontSize: 12, fontWeight: 600, textTransform: 'uppercase' as const, letterSpacing: 1, color, marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  )
}

function Box({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ width: 48, height: 48, borderRadius: 8, background: '#d1fae5', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, color: '#065f46' }}>
      {children}
    </div>
  )
}
