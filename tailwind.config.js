/** @type {import('tailwindcss').Config} */
const animate = require('tailwindcss-animate')

module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  corePlugins: {
    preflight: false,
  },
  theme: {
    extend: {
      colors: {
        border: 'var(--border, hsl(214.3 31.8% 91.4%))',
        input: 'var(--input, hsl(214.3 31.8% 91.4%))',
        ring: 'var(--ring, hsl(222.2 84% 4.9%))',
        background: 'var(--background, hsl(0 0% 100%))',
        foreground: 'var(--foreground, hsl(222.2 84% 4.9%))',
        primary: {
          DEFAULT: 'var(--primary, hsl(222.2 47.4% 11.2%))',
          foreground: 'var(--primary-foreground, hsl(210 40% 98%))',
        },
        secondary: {
          DEFAULT: 'var(--secondary, hsl(210 40% 96.1%))',
          foreground: 'var(--secondary-foreground, hsl(222.2 47.4% 11.2%))',
        },
        destructive: {
          DEFAULT: 'var(--destructive, hsl(0 84.2% 60.2%))',
          foreground: 'var(--destructive-foreground, hsl(210 40% 98%))',
        },
        muted: {
          DEFAULT: 'var(--muted, hsl(210 40% 96.1%))',
          foreground: 'var(--muted-foreground, hsl(215.4 16.3% 46.9%))',
        },
        accent: {
          DEFAULT: 'var(--accent, hsl(210 40% 96.1%))',
          foreground: 'var(--accent-foreground, hsl(222.2 47.4% 11.2%))',
        },
        popover: {
          DEFAULT: 'var(--popover, hsl(0 0% 100%))',
          foreground: 'var(--popover-foreground, hsl(222.2 84% 4.9%))',
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
