import daisyui from "daisyui";

export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: { extend: {} },
  // Use ESM here so the config matches the rest of the Vite toolchain and lint rules.
  plugins: [daisyui],
  daisyui: { themes: ["night"] },
};
