/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          50:  "#f0fdf4",
          100: "#dcfce7",
          200: "#bbf7d0",
          300: "#86efac",
          500: "#22c55e",
          600: "#16a34a",
          700: "#15803d",
          800: "#166534",
          900: "#14532d",
          DEFAULT: "#16803A",
          hover:   "#15803d",
          light:   "#f0fdf4",
          dark:    "#14532d",
        },
        ink: {
          DEFAULT: "#111111",
          muted:   "#64748B",
          subtle:  "#94a3b8",
        },
        surface: {
          DEFAULT: "#ffffff",
          page:    "#F8FAF9",
          subtle:  "#F8FAF9",
          muted:   "#f1f5f9",
          border:  "#DDE5E0",
        }
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
      }
    }
  },
  plugins: []
}
