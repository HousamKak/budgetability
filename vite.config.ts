import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import { fileURLToPath, URL } from "node:url"

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  return {
    plugins: [react()],
    resolve: {
      alias: {
        "@": fileURLToPath(new URL("./src", import.meta.url)),
      },
    },
    base: mode === 'production' ? '/budgetability/' : '/',
    build: {
      outDir: 'dist',
      assetsDir: 'assets'
    },
    define: {
      __DEV__: mode === 'development',
    },
    // Explicitly specify environment file loading
    envPrefix: 'VITE_',
    envDir: process.cwd(),
  }
})
