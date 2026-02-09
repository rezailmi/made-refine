import React from 'react'
import { DirectEdit } from '../src/index'
import { Avatar, Button } from './components'

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
const blue = { 50: '#eff6ff', 500: '#3b82f6', 600: '#2563eb' }
const indigo = '#6366f1'
const emerald = '#10b981'
const amber = '#f59e0b'
const rose = '#f43f5e'
const violet = '#8b5cf6'

export default function App() {
  return (
    <>
      <DirectEdit />
      <div style={{ fontFamily: 'system-ui, sans-serif', color: gray[900], padding: 32, maxWidth: 960, margin: '0 auto' }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 6, letterSpacing: '-0.02em' }}>made-refine dev</h1>
        <p style={{ color: gray[500], marginBottom: 32, fontSize: 14, lineHeight: 1.5 }}>
          Press{' '}
          <kbd style={{ fontSize: 12, fontFamily: 'ui-monospace, monospace', padding: '2px 6px', backgroundColor: gray[100], border: `1px solid ${gray[200]}`, borderRadius: '0.375rem' }}>⌘.</kbd>
          {' '}to toggle edit mode. Click any element to inspect and edit styles.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 16 }}>

          {/* Profile Card */}
          <div style={{ border: `1px solid ${gray[200]}`, borderRadius: 12, padding: 24, backgroundColor: '#fff' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
              <Avatar initials="JD" size={48} />
              <div>
                <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.3 }}>Jane Doe</div>
                <div style={{ fontSize: 13, color: gray[500] }}>Product Designer</div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 1, backgroundColor: gray[200], borderRadius: 8, overflow: 'hidden' }}>
              {[
                { label: 'Projects', value: '24' },
                { label: 'Following', value: '128' },
                { label: 'Followers', value: '2.4k' },
              ].map((stat) => (
                <div key={stat.label} style={{ flex: 1, padding: '10px 0', textAlign: 'center', backgroundColor: gray[50] }}>
                  <div style={{ fontSize: 15, fontWeight: 600, lineHeight: 1.2 }}>{stat.value}</div>
                  <div style={{ fontSize: 11, color: gray[500], marginTop: 2 }}>{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing Card */}
          <div style={{ border: `1px solid ${gray[200]}`, borderRadius: 12, padding: 24, backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: gray[500], marginBottom: 16, textTransform: 'uppercase' as const, letterSpacing: '0.05em', padding: 8, borderRadius: 8, border: '1px solid #D1D1D1' }}>
              Pro Plan
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginTop: 8 }}>
                <span style={{ fontSize: 36, fontWeight: 700, letterSpacing: '-0.03em', lineHeight: 1, color: gray[900] }}>$29</span>
                <span style={{ fontSize: 14, color: gray[500] }}>/mo</span>
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 20, flex: 1 }}>
              {['Unlimited projects', 'Priority support', 'Custom domains'].map((feature) => (
                <div key={feature} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: gray[600] }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: gray[900], display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <div style={{ width: 6, height: 3, borderLeft: '1.5px solid #fff', borderBottom: '1.5px solid #fff', transform: 'rotate(-45deg) translateY(-0.5px)' }} />
                  </div>
                  {feature}
                </div>
              ))}
            </div>
            <Button>Get started</Button>
          </div>

          {/* Colors */}
          <div style={{ border: `1px solid ${gray[200]}`, borderRadius: 12, padding: 24, backgroundColor: '#fff' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: gray[500], marginBottom: 16, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Palette</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 16 }}>
              {[
                { color: blue[500], name: 'Blue' },
                { color: indigo, name: 'Indigo' },
                { color: violet, name: 'Violet' },
                { color: emerald, name: 'Emerald' },
                { color: amber, name: 'Amber' },
                { color: rose, name: 'Rose' },
              ].map((swatch) => (
                <div key={swatch.name}>
                  <div style={{ height: 40, borderRadius: 6, background: swatch.color, marginBottom: 4 }} />
                  <div style={{ fontSize: 11, color: gray[500], textAlign: 'center' }}>{swatch.name}</div>
                </div>
              ))}
            </div>
            <Button bg={blue[600]}>Blue surface</Button>
          </div>

          {/* Testimonial */}
          <div style={{ border: `1px solid ${gray[200]}`, borderRadius: 12, padding: 24, backgroundColor: '#fff', display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: 32, lineHeight: 1, color: gray[300], marginBottom: 8, fontFamily: 'Georgia, serif' }}>&ldquo;</div>
            <p style={{ fontSize: 14, lineHeight: 1.7, color: gray[700], flex: 1, margin: 0 }}>
              This tool completely changed how we iterate on design. What used to take a round-trip to Figma now happens right in the browser.
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, paddingTop: 16, borderTop: `1px solid ${gray[200]}` }}>
              <Avatar initials="AK" bg={gray[800]} />
              <div>
                <div style={{ fontSize: 13, fontWeight: 500 }}>Alex Kim</div>
                <div style={{ fontSize: 12, color: gray[500] }}>Engineering Lead, Acme</div>
              </div>
            </div>
          </div>

          {/* Notification */}
          <div style={{ border: `1px solid ${gray[200]}`, borderRadius: 12, padding: 24, backgroundColor: '#fff' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: gray[500], marginBottom: 16, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>Notifications</div>
            {[
              { initials: 'SM', title: 'Sara mentioned you', desc: 'in Design Review #14', time: '2m' },
              { initials: 'TR', title: 'Tom requested review', desc: 'on Homepage redesign', time: '1h' },
            ].map((n, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '10px 0', borderTop: i > 0 ? `1px solid ${gray[100]}` : 'none' }}>
                <Avatar initials={n.initials} bg={gray[100]} color={gray[600]} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.3 }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: gray[500] }}>{n.desc}</div>
                </div>
                <div style={{ fontSize: 11, color: gray[400], flexShrink: 0 }}>{n.time}</div>
              </div>
            ))}
          </div>

          {/* Stats */}
          <div style={{ border: `1px solid ${gray[200]}`, borderRadius: 12, padding: 24, backgroundColor: '#fff' }}>
            <div style={{ fontSize: 13, fontWeight: 500, color: gray[500], marginBottom: 16, textTransform: 'uppercase' as const, letterSpacing: '0.05em' }}>This month</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {[
                { label: 'Revenue', value: '$12,480', bar: 0.78 },
                { label: 'Users', value: '1,024', bar: 0.52 },
                { label: 'Conversion', value: '3.2%', bar: 0.32 },
              ].map((stat) => (
                <div key={stat.label}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 13, color: gray[600] }}>{stat.label}</span>
                    <span style={{ fontSize: 13, fontWeight: 600 }}>{stat.value}</span>
                  </div>
                  <div style={{ height: 6, backgroundColor: gray[100], borderRadius: 3, overflow: 'hidden' }}>
                    <div style={{ width: `${stat.bar * 100}%`, height: 6, backgroundColor: gray[900], borderRadius: 3 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </>
  )
}
