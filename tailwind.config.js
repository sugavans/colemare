/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {
      colors: {
        navy: {
          DEFAULT: '#1F3864',
          light: '#2E5DA6',
        },
        surface: '#FFFFFF',
        background: '#F0F2F7',
        success: '#27AE60',
        warning: '#F39C12',
        danger: '#E74C3C',
        'ats-bg': '#EAF4EA',
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        card: '8px',
        pill: '50px',
      },
      boxShadow: {
        card: '0 4px 24px rgba(31,56,100,0.08)',
      },
    },
  },
  plugins: [],
};
