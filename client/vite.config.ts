import { defineConfig, loadEnv } from 'vite'
import path from "node:path";
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const envDirectory = path.join(__dirname, "../");
  const env = loadEnv(mode, envDirectory);
  return {
      envDir: envDirectory,
      envPrefix: "PUBLIC_",
      plugins: [react()],
      server: { proxy: { "/api": `http://localhost:${env.PUBLIC_SERVER_PORT}` } }
  }
})
