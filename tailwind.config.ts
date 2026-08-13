import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#5B2A86",
          50: "#f5eefb",
          100: "#e9d8f4",
          200: "#d5b3e8",
          300: "#bd88d9",
          400: "#9d55c4",
          500: "#7d33a8",
          600: "#5B2A86",
          700: "#4a2170",
          800: "#391955",
          900: "#2e134a",
        },
        // Cameroon flag palette (accent use only).
        cmr: {
          green: "#007A5E",
          red: "#CE1126",
          yellow: "#FCD116",
        },
      },
      boxShadow: {
        glow: "0 10px 28px -12px rgba(91,42,134,0.55)",
        glowlg: "0 22px 50px -14px rgba(91,42,134,0.5)",
        card: "0 1px 2px rgba(16,12,24,0.04), 0 8px 24px -12px rgba(16,12,24,0.12)",
      },
      keyframes: {
        fadeUp: {
          from: { opacity: "0", transform: "translateY(10px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-6px)" },
        },
        aurora: {
          "0%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
          "100%": { backgroundPosition: "0% 50%" },
        },
        shimmer: {
          "100%": { transform: "translateX(200%)" },
        },
      },
      animation: {
        fadeUp: "fadeUp 0.5s ease-out both",
        floaty: "floaty 6s ease-in-out infinite",
        aurora: "aurora 18s ease infinite",
      },
    },
  },
  plugins: [],
};

export default config;
