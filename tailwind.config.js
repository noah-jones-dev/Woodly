/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        cream: { 50: "#fdfbf7", 100: "#f8f3ea", 200: "#efe6d6" },
        charcoal: { 700: "#3a3634", 800: "#2b2826", 900: "#1e1c1b" },
        wood: { 300: "#d9b48a", 400: "#c8965f", 500: "#a8743f", 600: "#8a5a2b", 700: "#6b4320" },
        sage: { 500: "#6f8a6a" },
        warn: { 500: "#c7772b" },
        danger: { 500: "#b8463a" },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "ui-monospace", "monospace"],
      },
    },
  },
  plugins: [],
};
