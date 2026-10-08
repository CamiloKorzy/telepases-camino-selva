import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        cs: {
          primary: "#285944",
          dark: "#1b3d2f",
          light: "#3d795f",
          accent: "#8cb399",
          bg: "#f5f7f6",
        },
      },
    },
  },
  plugins: [],
};
export default config;
