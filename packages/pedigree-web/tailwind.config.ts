/** Tailwind CSS configuration with Pedigree design tokens. */
import type { Config } from 'tailwindcss'
import defaultTheme from 'tailwindcss/defaultTheme'

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    borderRadius: {
      none: '0',
      sm: '6px',
      md: '12px',
      lg: '16px',
      full: '9999px',
    },
    extend: {
      colors: {
        accent: {
          DEFAULT: '#0F766E',
          hover: '#115E59',
          subtle: '#F0FDFA',
          dark: '#14B8A6',
        },
        success: '#16A34A',
        warning: '#D97706',
        error: '#DC2626',
      },
      fontFamily: {
        sans: ['var(--font-inter)', ...defaultTheme.fontFamily.sans],
        mono: ['var(--font-jetbrains-mono)', ...defaultTheme.fontFamily.mono],
        display: ['var(--font-fraunces)', ...defaultTheme.fontFamily.serif],
      },
      boxShadow: {
        subtle: '0 0 0 1px rgba(229,229,229,0.6), 0 1px 2px rgba(0,0,0,0.04)',
        lifted: '0 0 0 1px rgba(229,229,229,0.8), 0 8px 24px rgba(0,0,0,0.06)',
      },
      fontSize: {
        '2xs': ['0.75rem', { lineHeight: '1rem' }],
        xs: ['0.875rem', { lineHeight: '1.25rem' }],
        sm: ['1rem', { lineHeight: '1.5rem' }],
        base: ['1.25rem', { lineHeight: '1.75rem' }],
        lg: ['1.5rem', { lineHeight: '2rem' }],
        xl: ['2rem', { lineHeight: '2.5rem' }],
        '2xl': ['2.5rem', { lineHeight: '3rem' }],
        '3xl': ['3.5rem', { lineHeight: '4rem' }],
        '4xl': ['4.5rem', { lineHeight: '5rem' }],
      },
    },
  },
  plugins: [],
}

export default config
