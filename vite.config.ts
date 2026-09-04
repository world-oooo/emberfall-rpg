import { defineConfig } from 'vite';
import { fileURLToPath, URL } from 'node:url';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as { version: string };

// Static build, relative base so the dist/ folder works from any path (Vercel, itch.io, file server).
export default defineConfig({
  base: './',
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  resolve: {
    alias: {
      '@game': fileURLToPath(new URL('./src/game', import.meta.url)),
    },
  },
  server: {
    port: 5180,
    strictPort: true,
    open: false,
  },
  preview: {
    port: 5181,
    strictPort: true,
  },
  build: {
    target: 'es2022',
    sourcemap: false,
    // hashed bundles go to dist/bundle so un-hashed game data in public/assets keeps its own cache policy
    assetsDir: 'bundle',
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks: (id: string) => (id.includes('node_modules/phaser') ? 'phaser' : undefined),
      },
    },
  },
});
