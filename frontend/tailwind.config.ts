import type { Config } from "tailwindcss";
// eslint-disable-next-line @typescript-eslint/no-require-imports
import domePreset from "@dome-layer/dome-ui/tailwind-preset";

const config: Config = {
  presets: [domePreset as Partial<Config> as Config],
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./context/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  plugins: [],
};

export default config;
