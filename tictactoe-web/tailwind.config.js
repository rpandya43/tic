/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        background: {
          start: 'rgb(13, 17, 23)',
          end: 'rgb(23, 27, 33)',
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/forms'),
  ],
} 