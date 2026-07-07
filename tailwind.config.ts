import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: "class",
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: "#5B2A86",
          50: "#f3eef8",
          100: "#e3d6ef",
          600: "#5B2A86",
          700: "#4a2170",
          900: "#2e134a",
        },
      },
    },
  },
  plugins: [],
};

export default config;
