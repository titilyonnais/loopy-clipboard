/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Geist", "system-ui", "sans-serif"],
        mono: ["Geist Mono", "ui-monospace", "monospace"],
        display: ["Bricolage Grotesque", "Geist", "sans-serif"],
      },
      colors: {
        ink: {
          50: "#f5f5f6",
          100: "#e5e5e7",
          200: "#c8c8cc",
          300: "#a5a5ab",
          400: "#75757c",
          500: "#52525a",
          600: "#3a3a40",
          700: "#27272b",
          800: "#1a1a1d",
          850: "#131316",
          900: "#0d0d10",
          950: "#08080a",
        },
        lime: {
          300: "#d9f99d",
          400: "#bef264",
          500: "#a3e635",
          600: "#84cc16",
        },
      },
      animation: {
        "fade-in": "fadeIn 0.18s ease-out",
        "slide-up": "slideUp 0.22s cubic-bezier(0.16, 1, 0.3, 1)",
        "scale-in": "scaleIn 0.16s cubic-bezier(0.16, 1, 0.3, 1)",
        "pulse-slow": "pulse 2.5s cubic-bezier(0.4, 0, 0.6, 1) infinite",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: {
          "0%": { opacity: "0", transform: "translateY(6px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        scaleIn: {
          "0%": { opacity: "0", transform: "scale(0.97)" },
          "100%": { opacity: "1", transform: "scale(1)" },
        },
      },
    },
  },
  plugins: [],
};
