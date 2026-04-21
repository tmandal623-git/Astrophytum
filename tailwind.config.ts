export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // stone: require('tailwindcss/colors').stone, // ✅ ADD THIS
        cactus: {
          50:  '#f0f9ee',
          100: '#ddf0da',
          200: '#bce1b6',
          300: '#8dcc84',
          400: '#5fb054',
          500: '#3d9133',
          600: '#2d7425',
          700: '#265c20',
          800: '#22491d',
          900: '#1d3d1a',
        },
        gold: {
          400: '#d4a847',
          500: '#c8a84b',
          600: '#b8961e',
        },
      },
      fontFamily: {
        sans: ['DM Sans', 'sans-serif'],
        display: ['DM Serif Display', 'serif'],
      },
      borderRadius: { xl: '16px' },
    },
  },
  plugins: [],
};