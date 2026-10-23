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
  security: {
    // Los endpoints externos (cron con Bearer, webhook de ML) no envian
    // Sec-Fetch-Site y Astro los rechazaria con 403. La proteccion CSRF de
    // rutas admin se hace en lib/admin-auth.ts (validacion de Origin).
    checkOrigin: false,
  },
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
