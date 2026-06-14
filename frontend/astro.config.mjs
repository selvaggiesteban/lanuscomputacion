import { defineConfig } from 'astro/config';
import react from '@astrojs/react';
import tailwind from '@astrojs/tailwind';
import cloudflare from '@astrojs/cloudflare';

export default defineConfig({
  integrations: [
    react(),
    tailwind({
      applyBaseStyles: false,
    }),
  ],
  output: 'server',
  adapter: cloudflare({
    platformProxy: {
      enabled: true,
    },
  }),
  vite: {
    resolve: {
      alias: {
        'react-dom/server': 'react-dom/server.edge',
      },
    },
  },
  site: 'https://lanuscomputacion.com',
  server: {
    port: 4321,
  },
});
