import type { Config } from 'tailwindcss'

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#d51015',
          dark: '#a10e11',
          light: '#fee8ea'
        }
      }
    }
  },
  plugins: []
} satisfies Config
