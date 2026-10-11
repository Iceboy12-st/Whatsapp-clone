/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        app: 'var(--wa-app)',
        header: 'var(--wa-header)',
        panel: 'var(--wa-panel)',
        hover: 'var(--wa-hover)',
        active: 'var(--wa-active)',
        line: 'var(--wa-border)',
        bubble: { in: 'var(--wa-in)', out: 'var(--wa-out)' },
        accent: { DEFAULT: '#00a884', dark: '#008069', soft: 'var(--wa-accent-soft)' },
        ink: { DEFAULT: 'var(--wa-text)', 2: 'var(--wa-text-2)', 3: 'var(--wa-text-3)' },
        field: 'var(--wa-field)',
        tick: '#53bdeb',
        danger: '#ea0038',
      },
      fontFamily: {
        sans: ['"Segoe UI"', '"Helvetica Neue"', 'Helvetica', '"Lucida Grande"', 'Arial', 'Ubuntu', 'Cantarell', '"Fira Sans"', 'sans-serif'],
      },
      boxShadow: {
        bubble: '0 1px 0.5px rgba(11, 20, 26, 0.13)',
        menu: '0 2px 5px 0 rgba(11,20,26,.26), 0 2px 10px 0 rgba(11,20,26,.16)',
      },
      animation: {
        'fade-in': 'fadeIn 0.15s ease-out',
        'slide-in': 'slideIn 0.2s ease-out',
        'slide-left': 'slideLeft 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
        pop: 'pop 0.15s ease-out',
        shimmer: 'shimmer 1.4s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: { '0%': { opacity: '0' }, '100%': { opacity: '1' } },
        slideIn: { '0%': { transform: 'translateX(100%)' }, '100%': { transform: 'translateX(0)' } },
        slideLeft: { '0%': { transform: 'translateX(-100%)' }, '100%': { transform: 'translateX(0)' } },
        slideUp: { '0%': { transform: 'translateY(12px)', opacity: '0' }, '100%': { transform: 'translateY(0)', opacity: '1' } },
        pop: { '0%': { transform: 'scale(0.9)', opacity: '0' }, '100%': { transform: 'scale(1)', opacity: '1' } },
        shimmer: { '0%, 100%': { opacity: '1' }, '50%': { opacity: '0.45' } },
      },
    },
  },
  plugins: [],
}
