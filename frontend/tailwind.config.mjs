/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        'ml-text': '#1a1a1a',
        'ml-text-secondary': '#4a4a4a',
        'ml-text-muted': '#71717a',
        'ml-bg': '#f9f9f9',
        'ml-yellow': '#fbbf24',
        'ml-border': '#e4e4e7',
        'ml-blue': '#0056b3',
        'ml-blue-hover': '#004494',
        'ml-blue-light': '#e6effa',
        'ml-green-bg': '#dcfce7',
        'ml-green': '#166534',
        'b2b-purple': '#6b21a8',
      },
      borderRadius: {
        'ml-card': '12px',
      },
      boxShadow: {
        'card': '0 2px 4px rgba(0,0,0,0.05)',
        'card-hover': '0 4px 8px rgba(0,0,0,0.1)',
      }
    },
  },
  plugins: [],
}
