/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#f0f5ff',
          100: '#e0ebff',
          200: '#c7d9fe',
          300: '#a3c0fd',
          400: '#759dfa',
          500: '#4e7bf5',
          600: '#345de9',
          700: '#2747cf',
          800: '#243ca7',
          900: '#223684',
          950: '#172251',
        }
      }
    },
  },
  plugins: [],
}

