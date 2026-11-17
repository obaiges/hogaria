/// <reference types="vitest/config" />
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'prompt',
      injectRegister: false,
      injectManifest: {
        // Shell (ADR-015): JS, CSS, HTML, iconos, logos y las fuentes Barlow en woff2 de los
        // subconjuntos latinos (los navegadores que soportan service workers leen woff2).
        globPatterns: ['**/*.{js,css,html,png,svg,webmanifest}', 'assets/barlow*-latin-*.woff2'],
      },
      manifest: {
        name: 'Hogaria',
        short_name: 'Hogaria',
        lang: 'es',
        display: 'standalone',
        start_url: '/',
        theme_color: '#14A19E',
        background_color: '#F4FAFA',
        icons: [
          { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
          {
            src: '/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
    dedupe: ['react', 'react-dom'],
  },
  server: {
    proxy: {
      '/api': 'http://localhost:3000',
      '/realtime': {
        target: 'http://localhost:3000',
        ws: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
    // MSW intercepta URLs absolutas (el fetch de Node no admite rutas relativas).
    env: { VITE_API_URL: 'http://api.test' },
  },
});
