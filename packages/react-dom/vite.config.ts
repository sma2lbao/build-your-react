import { defineConfig } from "vite";
import { resolve } from "path";
import dts from "vite-plugin-dts";

export default defineConfig({
  plugins: [dts({ rollupTypes: true })],

  build: {
    lib: {
      entry: resolve(__dirname, "./src/index.ts"),
      name: "ReactDOM",
      formats: ["umd", "es"],
    },
    rollupOptions: {
      external: ["react"],
      output: {
        globals: {},
      },
    },
    outDir: "lib",
  },
});
