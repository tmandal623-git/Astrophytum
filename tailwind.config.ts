// Theme palette derived from public/Images/Logo.jpeg:
//   cream background #fbfae9, sage line green #4f7a3a,
//   light sage fill #9cb87c, butter-cream dots #eeeab4.
// Keep in sync with tailwind.config.js (the file Tailwind actually loads).

// Primary — logo sage green
const cactus = {
  50:  '#f5f8ee',
  100: '#e8efda',
  200: '#d2e0bb',
  300: '#b5cb95',
  400: '#9cb87c', // logo fill
  500: '#6f9655',
  600: '#4f7a3a', // logo line
  700: '#3f6230',
  800: '#334e28',
  900: '#2a4022',
  950: '#1a2914',
};

// Neutrals — warm, cream-tinted to match the logo background
const gray = {
  50:  '#fbfae9', // logo background
  100: '#f4f3e0',
  200: '#e6e5cf',
  300: '#d0cfb6',
  400: '#a8a78f',
  500: '#7f7e69',
  600: '#5f5e4d',
  700: '#47473a',
  800: '#2f2f27',
  900: '#1f1f1a',
  950: '#141410',
};

// Accent — logo butter-cream dots
const amber = {
  50:  '#fdfcef',
  100: '#f9f6d6',
  200: '#eeeab4', // logo dots
  300: '#e4dc8d',
  400: '#d6ca67',
  500: '#c0b14a',
  600: '#9f8f37',
  700: '#7c6e2c',
  800: '#5e5425',
  900: '#463f1f',
  950: '#2a2512',
};

export default {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        cactus,
        green:   cactus,
        emerald: cactus,
        gray,
        stone:   gray,
        amber,
        gold: {
          400: amber[400],
          500: amber[500],
          600: amber[600],
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
