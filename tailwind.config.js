/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx,js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans:    ['DM Sans', 'sans-serif'],
        display: ['DM Serif Display', 'serif'],
      },
      colors: {
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
      },
    },
  },
  plugins: [],
};