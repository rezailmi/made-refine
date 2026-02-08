import React from 'react'

const gray = {
  900: 'var(--color-gray-900, #111827)',
}

export function Avatar({
  initials,
  size = 32,
  bg = gray[900],
  color = '#fff',
  fontSize,
}: {
  initials: string
  size?: number
  bg?: string
  color?: string
  fontSize?: number
}) {
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: fontSize ?? size * 0.35,
        fontWeight: 600,
        color,
        letterSpacing: '-0.02em',
        flexShrink: 0,
      }}
    >
      {initials}
    </div>
  )
}

export function Button({
  children,
  bg = gray[900],
  color = '#fff',
}: {
  children: React.ReactNode
  bg?: string
  color?: string
}) {
  return (
    <div
      style={{
        padding: '10px 0',
        backgroundColor: bg,
        color,
        borderRadius: 8,
        fontSize: 14,
        fontWeight: 500,
        textAlign: 'center',
        letterSpacing: '-0.01em',
      }}
    >
      {children}
    </div>
  )
}
