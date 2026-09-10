import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import basicSsl from "@vitejs/plugin-basic-ssl"
import { VitePWA } from "vite-plugin-pwa"
import path from "node:path"

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
  server: {
    port: 5173,
    host: "0.0.0.0",
    strictPort: true,
    allowedHosts: true,
  },
  preview: {
    port: 5173,
    host: "0.0.0.0",
    strictPort: true,
    allowedHosts: true,
  },
  plugins: [
    basicSsl(),
    react(),
    VitePWA({
      strategies: "injectManifest",
      srcDir: "src",
      filename: "sw.ts",
      registerType: "autoUpdate",
      injectRegister: "auto",
      manifest: false,
      injectManifest: {
        globPatterns: ["**/*.{js,css,html,svg,woff2,webmanifest}"],
      },
      // Module SW in Vite dev breaks Chrome Android Web Push ("push service error").
      devOptions: { enabled: false },
    }),
  ],
})
