/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        okami: {
          bg: 'var(--okami-bg)',
          panel: 'var(--okami-panel)',
          border: 'var(--okami-border)',
          accent: 'var(--okami-accent)',
          'accent-hover': 'var(--okami-accent-hover)',
          muted: 'var(--okami-muted)',
          success: 'var(--okami-success)',
          warning: 'var(--okami-warning)',
          danger: 'var(--okami-danger)',
        },
      },
      borderRadius: {
        panel: 'var(--okami-radius)',
      },
      boxShadow: {
        panel: 'var(--okami-shadow)',
      },
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        display: ['"Outfit"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
