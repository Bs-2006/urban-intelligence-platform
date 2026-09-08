/** @type {import("tailwindcss").Config} */
export default {
  content: ["./index.html","./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        gov: { 900:"#0f172a", 800:"#1e293b", accent:"#2563eb", accentHover:"#1d4ed8" }
      }
    }
  },
  plugins: []
}
