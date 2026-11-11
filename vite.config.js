import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const target = env.VITE_PROXY_TARGET || 'http://localhost:4000';
  // HTTPS by default: browsers only allow camera/mic on https (or localhost). Use `npm run dev:http` to turn it off.
  const useHttps = process.env.HTTP !== 'true';
  return {
    plugins: [react(), ...(useHttps ? [basicSsl()] : [])],
    server: {
      port: 5174,
      host: true,
      proxy: {
        '/api': { target, changeOrigin: true },
        '/socket.io': { target, ws: true, changeOrigin: true },
      },
    },
    preview: { port: 4174 },
  };
});
