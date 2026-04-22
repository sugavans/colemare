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
        // Workflow color tokens
        'match-color':  { DEFAULT: '#0E7490', light: '#E0F2F7', border: '#0E7490' }, // teal — Score My Resume
        'cl-color':     { DEFAULT: '#6D28D9', light: '#EDE9FE', border: '#6D28D9' }, // violet — Draft Cover Letter
        'opt-color':    { DEFAULT: '#1F3864', light: '#EAF4EA', border: '#1F3864' }, // navy — Optimize Everything
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
