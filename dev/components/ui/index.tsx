import React from 'react'

const gray = {
  100: 'var(--color-gray-100, #f3f4f6)',
  200: 'var(--color-gray-200, #e5e7eb)',
  300: 'var(--color-gray-300, #d1d5db)',
  500: 'var(--color-gray-500, #6b7280)',
  600: 'var(--color-gray-600, #4b5563)',
  900: 'var(--color-gray-900, #111827)',
}

const variantStyles = {
  primary: { bg: gray[900], color: '#fff' },
  secondary: { bg: 'transparent', color: gray[900], border: `1px solid ${gray[300]}` },
  ghost: { bg: 'transparent', color: gray[600] },
  danger: { bg: '#fee2e2', color: '#dc2626' },
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
  variant = 'primary',
}: {
  children: React.ReactNode
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
}) {
  const styles = variantStyles[variant]
  return (
    <div
      style={{
        padding: '8px 16px',
        backgroundColor: styles.bg,
        color: styles.color,
        border: styles.border || 'none',
        borderRadius: 8,
        fontSize: 13,
        fontWeight: 500,
        textAlign: 'center',
        letterSpacing: '-0.01em',
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {children}
    </div>
  )
}

const badgeStyles = {
  success: { bg: '#dcfce7', color: '#166534' },
  warning: { bg: '#fef9c3', color: '#854d0e' },
  muted: { bg: gray[100], color: gray[500] },
}

export function Badge({
  children,
  variant = 'success',
}: {
  children: React.ReactNode
  variant?: 'success' | 'warning' | 'muted'
}) {
  const styles = badgeStyles[variant]
  return (
    <div
      style={{
        display: 'inline-flex',
        padding: '2px 10px',
        borderRadius: 9999,
        fontSize: 12,
        fontWeight: 500,
        lineHeight: 1.5,
        backgroundColor: styles.bg,
        color: styles.color,
      }}
    >
      {children}
    </div>
  )
}
