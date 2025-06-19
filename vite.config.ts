/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import runtimeErrorOverlay from '@replit/vite-plugin-runtime-error-modal';

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...(process.env.NODE_ENV !== 'production' &&
    process.env.REPL_ID !== undefined
      ? [
          await import('@replit/vite-plugin-cartographer').then((m) =>
            m.cartographer(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, 'client', 'src'),
      '@shared': path.resolve(import.meta.dirname, 'shared'),
      '@assets': path.resolve(import.meta.dirname, 'attached_assets'),
    },
  },
  root: path.resolve(import.meta.dirname, 'client'),
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts', // Relative to the root specified above, so client/src/setupTests.ts
    css: true,
    reporters: ['default', 'html'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: '../coverage/client', // Output coverage reports to root/coverage/client
    },
    outputFile: '../vitest-html-report/client/index.html', // Output HTML report to root/vitest-html-report/client
  },
  build: {
    outDir: path.resolve(import.meta.dirname, 'dist/public'),
    emptyOutDir: true,
  },
  server: {
    fs: {
      strict: true,
      deny: ['**/.*'],
    },
  },
});
