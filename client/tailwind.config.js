/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        kid: {
          bg: '#FFFBEB',
          card: '#FEF3C7',
          accent: '#F59E0B',
          bubbleSelf: '#FCD34D',
          bubbleOther: '#FFFFFF',
          text: '#78350F'
        },
        teen: {
          bg: '#0F172A',
          card: '#1E293B',
          accent: '#06B6D4',
          bubbleSelf: '#0284C7',
          bubbleOther: '#334155',
          text: '#F8FAFC'
        },
        adult: {
          bg: '#F8FAFC',
          card: '#FFFFFF',
          accent: '#4F46E5',
          bubbleSelf: '#4F46E5',
          bubbleOther: '#F1F5F9',
          text: '#0F172A'
        }
      }
    },
  },
  plugins: [],
}
