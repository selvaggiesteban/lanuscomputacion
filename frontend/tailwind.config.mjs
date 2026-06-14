/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/**/*.{astro,html,js,jsx,md,mdx,svelte,ts,tsx,vue}'],
  theme: {
    extend: {
      colors: {
        ml: {
          yellow: '#FFE600',
          'yellow-hover': '#FFF059',
          blue: '#3483FA',
          'blue-hover': '#1259c3',
          'blue-light': '#E4F1FE',
          green: '#00a650',
          'green-bg': '#E6F7ED',
          text: '#333333',
          'text-secondary': '#666666',
          'text-muted': '#999999',
          border: '#E0E0E0',
          bg: '#EDEDED',
          white: '#FFFFFF',
          star: '#FFD700',
          'price-bg': '#F5F5F5',
        },
        b2b: {
          purple: '#7C3AED',
          'purple-light': '#EDE9FE',
        },
      },
      fontFamily: {
        sans: [
          'Proxima Nova',
          '-apple-system',
          'BlinkMacSystemFont',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
      },
      fontSize: {
        'price': ['32px', { lineHeight: '1.1', fontWeight: '700' }],
        'price-lg': ['24px', { lineHeight: '1.2', fontWeight: '700' }],
        'price-md': ['18px', { lineHeight: '1.2', fontWeight: '600' }],
      },
      spacing: {
        'header': '56px',
        'megamenu': '40px',
      },
      boxShadow: {
        'card': '0 1px 2px 0 rgba(0,0,0,0.08)',
        'card-hover': '0 4px 8px 0 rgba(0,0,0,0.12)',
        'megamenu': '0 4px 12px 0 rgba(0,0,0,0.15)',
        'drawer': '-4px 0 12px 0 rgba(0,0,0,0.1)',
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-in': 'slideInRight 0.3s ease-out',
        'shimmer': 'shimmer 1.5s infinite linear',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInRight: {
          '0%': { transform: 'translateX(100%)' },
          '100%': { transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
      },
    },
  },
  plugins: [],
};
