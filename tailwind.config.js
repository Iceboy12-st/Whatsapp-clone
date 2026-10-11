/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        wa: {
          green: {
            DEFAULT: '#00a884',
            dark: '#008069',
            light: '#25d366',
            'lighter': '#dcf8c6',
          },
          teal: {
            DEFAULT: '#128c7e',
            dark: '#075e54',
          },
          bg: {
            DEFAULT: '#efeae2',
            dark: '#111b21',
            panel: '#f0f2f5',
            'panel-dark': '#202c33',
            hover: '#f5f6f6',
            'hover-dark': '#2a3942',
          },
          bubble: {
            in: '#ffffff',
            'in-dark': '#202c33',
            out: '#d9fdd3',
            'out-dark': '#005c4b',
          },
          border: {
            DEFAULT: '#e9edef',
            dark: '#2a3942',
          },
          text: {
            DEFAULT: '#111b21',
            secondary: '#667781',
            'secondary-dark': '#8696a0',
            dark: '#e9edef',
          },
        },
      },
      fontFamily: {
        sans: ['Segoe UI', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease-in',
        'slide-in': 'slideIn 0.3s ease-out',
        'slide-up': 'slideUp 0.3s ease-out',
        'pop': 'pop 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideIn: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        pop: {
          '0%': { transform: 'scale(0.8)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
