/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Plus Jakarta Sans"', 'sans-serif'],
        mono: ['"Courier New"', 'monospace'],
      },
      colors: {
        primary: {
          DEFAULT: '#4f46e5', // Indigo
          light: '#e0e7ff',
          dark: '#4338ca',
        },
        bg: {
          body: '#f8fafc', // Slate 50
          surface: '#ffffff',
        },
        text: {
          main: '#0f172a', // Slate 900
          sec: '#64748b',  // Slate 500
        },
        border: '#e2e8f0',
        success: {
          DEFAULT: '#10b981',
          bg: '#ecfdf5',
        },
        warning: {
          DEFAULT: '#f59e0b',
          bg: '#fffbeb',
        },
        danger: {
          DEFAULT: '#ef4444',
          bg: '#fee2e2',
        }
      },
      animation: {
        'spin-slow': 'spin 2s linear infinite',
        'pulse-fast': 'pulse 1.5s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      }
    },
  },
  plugins: [],
}