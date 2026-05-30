import type { Config } from "tailwindcss";
import domePreset from "@dome-layer/dome-ui/tailwind-preset";

const config: Config = {
  presets: [domePreset as Partial<Config> as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./context/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./node_modules/@dome-layer/dome-ui/dist/**/*.js",
  ],
  plugins: [],
};

export default config;
