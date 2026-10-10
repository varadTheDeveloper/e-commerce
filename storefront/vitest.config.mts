import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

const src = (p: string) => fileURLToPath(new URL(`./src/${p}`, import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      "@lib": src("lib"),
      "@modules": src("modules"),
      "@config": src("config"),
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
})
