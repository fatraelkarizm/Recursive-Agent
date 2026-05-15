import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: "#0A192F",
        electric: "#64FFDA",
        slate: "#8892B0"
      }
    }
  },
  plugins: []
};

export default config;
