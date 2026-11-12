import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          950: "#0b1018",
          900: "#0f1622",
          800: "#151e2d",
          700: "#1d2839",
          600: "#2a384d",
          500: "#3d4e68",
        },
        parchment: {
          50: "#f7f3ea",
          100: "#ece6d6",
          200: "#d9d0b9",
          400: "#a69d86",
        },
        brass: {
          300: "#e0c488",
          400: "#d0a85c",
          500: "#b98f3e",
        },
        sage: {
          400: "#8fb59a",
        },
      },
      fontFamily: {
        serif: ["var(--font-serif)", "Georgia", "serif"],
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      keyframes: {
        fadeUp: {
          "0%": { opacity: "0", transform: "translateY(8px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        pulseRing: {
          "0%": { boxShadow: "0 0 0 0 rgba(208,168,92,0.5)" },
          "100%": { boxShadow: "0 0 0 16px rgba(208,168,92,0)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.5s ease both",
        pulseRing: "pulseRing 1.4s ease-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
