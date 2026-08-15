import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import type { UserConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ command }) => {
  const config: UserConfig = {
    plugins: [react()],
  };

  // Only enable proxy when running dev server
  if (command === 'serve') {
    config.server = {
      proxy: {
        '/identity': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/fleet': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
        '/ai': {
          target: 'http://localhost:5000',
          changeOrigin: true,
        },
      },
    };
  }

  return config;
});
