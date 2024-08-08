import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: "react-fiber-config",
        replacement: path.resolve(
          __dirname,
          "../packages/react-dom-bindings/src/client/react-fiber-config-dom.ts"
        ),
      },
      {
        find: "shared",
        replacement: path.resolve(__dirname, "../packages/shared/src/"),
      },
    ],
  },
});
