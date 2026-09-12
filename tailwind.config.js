/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './App.tsx', './index.tsx', './{components,screens,hooks,systems,data,utils,types}/**/*.{ts,tsx}'],
  theme: {
    extend: {
      screens: {
        // Used by the HUD to drop the wordmark on very narrow phones.
        xs: '400px',
      },
    },
  },
  plugins: [],
};
