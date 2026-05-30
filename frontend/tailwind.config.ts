import type { Config } from "tailwindcss";
// @ts-expect-error -- dome-ui ships .d.ts but Next.js strict resolution misses the subpath export
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
