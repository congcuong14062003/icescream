/** @type {import('tailwindcss').Config} */
export default {
  prefix: "tw-",
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        mint: {
          50: "#eefbf7",
          100: "#d5f5ea",
          200: "#aeead8",
          300: "#78d8c0",
          400: "#40bea3",
          500: "#1fa087",
          600: "#16816e",
          700: "#14675a",
          800: "#135248",
          900: "#10443d",
          950: "#082823"
        },
        blush: {
          50: "#fff5f7",
          100: "#ffe4ea",
          200: "#fecdd8",
          300: "#f9a8ba",
          400: "#f17f9c",
          500: "#df5778",
          600: "#c63c61",
          700: "#a72f50"
        },
        lavender: {
          50: "#f8f6ff",
          100: "#eee9ff",
          200: "#ddd5fe",
          300: "#c7b8f8",
          400: "#ad98ef",
          500: "#8b70dd",
          600: "#7252cb",
          700: "#6043af"
        }
      },
      boxShadow: {
        soft: "0 10px 30px rgba(15, 52, 46, 0.08)",
        panel: "0 1px 2px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 52, 46, 0.06)",
        floating: "0 20px 45px rgba(6, 37, 32, 0.14)"
      },
      borderRadius: {
        "4xl": "1.75rem"
      }
    },
  },
  plugins: [],
};
