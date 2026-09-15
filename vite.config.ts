import { defineConfig } from 'vite';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { paraglideVitePlugin } from '@inlang/paraglide-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: './project.inlang',
      outdir: './src/paraglide',
      strategy: ['cookie', 'preferredLanguage', 'baseLocale'],
      cookieName: 'PARAGLIDE_LOCALE',
    }),
    tanstackStart(),
    react(),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
  },
  build: {
    rollupOptions: {
      output: {
        // Keep the large, rarely-changing dependencies in their own chunks so
        // a change to app code does not invalidate them in the browser cache.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return;
          if (id.includes('@codemirror') || id.includes('@lezer')) return 'codemirror';
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react';
          if (id.includes('@tanstack')) return 'tanstack';
          if (id.includes('radix-ui') || id.includes('@floating-ui')) return 'radix';
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
});
