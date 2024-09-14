import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/middleware/*.ts"],
  format: ["esm", "cjs"],
  dts: true,
  splitting: false,
  clean: true,
});
