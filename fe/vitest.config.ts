import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

// Configuración de Vitest para el frontend NEODOMUS.
// Se mantiene separada de vite.config.ts para no tocar la configuración de
// build/producción. Los alias deben replicar los de vite.config.ts para que
// los módulos que importan '@contexts/...', '@services/...' etc. resuelvan
// igual en los tests.
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@components': path.resolve(__dirname, 'src/components'),
      '@contexts': path.resolve(__dirname, 'src/contexts'),
      '@assets': path.resolve(__dirname, 'src/assets'),
      '@styles': path.resolve(__dirname, 'src/styles'),
      '@pages': path.resolve(__dirname, 'src/pages'),
      '@services': path.resolve(__dirname, 'src/services'),
      '@types': path.resolve(__dirname, 'src/types'),
      '@utils': path.resolve(__dirname, 'src/utils'),
      '@i18n': path.resolve(__dirname, 'src/i18n'),
    },
  },
  test: {
    environment: 'jsdom',
    // `globals: false` a propósito: los tests importan describe/it/expect
    // desde 'vitest' explícitamente para no romper el typecheck de `tsc`.
    globals: false,
    setupFiles: ['./src/__tests__/setup.ts'],
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/__tests__/**',
        'src/**/*.{test,spec}.{ts,tsx}',
      ],
    },
  },
});
