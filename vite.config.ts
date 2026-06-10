import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { VitePWA } from 'vite-plugin-pwa';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [
    tailwindcss(),
    sveltekit(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        navigateFallback: null,
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/(api|geocoding-api)\.open-meteo\.com\/.*/,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'open-meteo',
              expiration: { maxEntries: 32, maxAgeSeconds: 60 * 60 * 24 * 7 },
            },
          },
        ],
      },
    }),
  ],
});
