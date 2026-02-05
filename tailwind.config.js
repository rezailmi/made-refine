/** @type {import('tailwindcss').Config} */
const animate = require('tailwindcss-animate')

module.exports = {
  content: ['./src/**/*.{ts,tsx}', './dev/**/*.{ts,tsx,html}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        border: 'hsl(var(--border, 214.3 31.8% 91.4%) / <alpha-value>)',
        input: 'hsl(var(--input, 214.3 31.8% 91.4%) / <alpha-value>)',
        ring: 'hsl(var(--ring, 222.2 84% 4.9%) / <alpha-value>)',
        background: 'hsl(var(--background, 0 0% 100%) / <alpha-value>)',
        foreground: 'hsl(var(--foreground, 222.2 84% 4.9%) / <alpha-value>)',
        primary: {
          DEFAULT: 'hsl(var(--primary, 222.2 47.4% 11.2%) / <alpha-value>)',
          foreground: 'hsl(var(--primary-foreground, 210 40% 98%) / <alpha-value>)',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary, 210 40% 96.1%) / <alpha-value>)',
          foreground: 'hsl(var(--secondary-foreground, 222.2 47.4% 11.2%) / <alpha-value>)',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive, 0 84.2% 60.2%) / <alpha-value>)',
          foreground: 'hsl(var(--destructive-foreground, 210 40% 98%) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted, 210 40% 96.1%) / <alpha-value>)',
          foreground: 'hsl(var(--muted-foreground, 215.4 16.3% 46.9%) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent, 210 40% 96.1%) / <alpha-value>)',
          foreground: 'hsl(var(--accent-foreground, 222.2 47.4% 11.2%) / <alpha-value>)',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover, 0 0% 100%) / <alpha-value>)',
          foreground: 'hsl(var(--popover-foreground, 222.2 84% 4.9%) / <alpha-value>)',
        },
      },
      borderRadius: {
        lg: 'var(--radius, 0.5rem)',
        md: 'calc(var(--radius, 0.5rem) - 2px)',
        sm: 'calc(var(--radius, 0.5rem) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--collapsible-panel-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--collapsible-panel-height)' },
          to: { height: '0' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
      },
    },
  },
  plugins: [animate],
}
