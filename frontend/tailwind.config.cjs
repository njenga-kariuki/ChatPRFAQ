module.exports = {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        gray: {
          50: '#FAFAFA',
          100: '#F5F5F5',
          200: '#E5E5E5',
          300: '#D4D4D4',
          400: '#A3A3A3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0A0A0A'
        }
      },
      prose: {
        DEFAULT: {
          css: {
            maxWidth: 'none',
            color: '#404040',
            '[class~="lead"]': {
              color: '#525252',
            },
            strong: {
              color: '#171717',
              fontWeight: '600',
            },
            'h1, h2, h3, h4': {
              color: '#171717',
              fontWeight: '600',
            },
          },
        },
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
} 