/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Manrope", "Segoe UI", "sans-serif"],
        display: ["Poppins", "Segoe UI", "sans-serif"],
      },
      boxShadow: {
        soft: "0 12px 40px rgba(15, 23, 42, 0.08)",
      },
      colors: {
        brand: {
          50: "#eef4ff",
          100: "#dce8ff",
          500: "#3563e9",
          600: "#294fd1",
          700: "#1f3fb0",
        },
      },
    },
  },
  plugins: [],
};
