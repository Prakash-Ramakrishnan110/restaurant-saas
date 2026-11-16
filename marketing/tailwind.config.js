/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}", "./content/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0B1F3B",
        orange: "#FF6A00",
        cream: "#FFF3E0",
        surface: "#FFFBF7",
      },
      fontFamily: {
        display: ["Poppins", "Noto Sans Tamil", "system-ui", "sans-serif"],
        sans: ["Inter", "Noto Sans Tamil", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
