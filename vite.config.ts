import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';

import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [tailwindcss(), cloudflare()],
  resolve: {
    alias: {
      '@shared': path.resolve(__dirname, './shared'),
    },
  },
});