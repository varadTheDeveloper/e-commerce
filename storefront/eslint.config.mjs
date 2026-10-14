import { defineConfig, globalIgnores } from "eslint/config"
import nextVitals from "eslint-config-next/core-web-vitals"

// Next.js 16 removed `next lint`; ESLint runs directly with Next's recommended rules.
export default defineConfig([...nextVitals, globalIgnores([".next/**", "node_modules/**", "test-results/**", "playwright-report/**"])])
