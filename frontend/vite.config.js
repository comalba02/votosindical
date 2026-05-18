import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../', '')
  return {
    plugins: [
      tailwindcss(),
      react()
    ],
    envDir: '../',
    server: {
      port: parseInt(env.FRONTEND_PORT) || 5173,
      allowedHosts: ['votaciones.itasesorias.com', 'localhost']
    },
    preview: {
      port: parseInt(env.FRONTEND_PORT) || 5173,
      allowedHosts: ['votaciones.itasesorias.com', 'localhost']
    }
  }
})
