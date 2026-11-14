import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

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
    // Los recorridos de e2e/ se ejecutan con Playwright, no con Vitest.
    include: ['src/**/*.test.{ts,tsx}'],
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // Páginas pesadas (Checkout, Paneles admin) pueden exceder los 5 s por
    // defecto cuando la ejecución está instrumentada por coverage (v8).
    testTimeout: 15_000,
    coverage: {
      // Cobertura de la Semana 1 del bootcamp (receta "medir la cobertura
      // desde el día 1", adaptada a Vitest 2 + Vite 5). La línea base queda
      // registrada en docs/testing/MATRIZ_DE_COBERTURA.md y su umbral sube
      // semana a semana (30 → 80); nunca baja respecto a la medición real.
      provider: 'v8',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        // Arranque de la app (no es lógica de negocio medible).
        'src/main.tsx',
        'src/App.tsx',
        // Tipos y constantes sin ejecución medible.
        'src/vite-env.d.ts',
        'src/types/**',
        // Traducciones declarativas: solo los MAPAS de cadenas. La lógica de
        // traducción (translations.ts, translateLocalizedMessage.ts,
        // IdiomaContext.tsx) queda incluida porque es código ejecutable.
        'src/i18n/*Translations.ts',
        // Datos estáticos del chatbot y assets verificados con tests de
        // claves, no lógica de negocio.
        'src/data/**',
        'src/assets/**',
        // Infraestructura de pruebas: no se auto-mide (los *.test.* ya vienen
        // excluidos por los defaults de Vitest).
        'src/test/**',
      ],
      reporter: ['text', 'lcov', 'json-summary'],
      reportsDirectory: 'coverage',
      thresholds: {
        // Semana 7 del bootcamp: piso 75 % alcanzado con la medición real
        // (2026-11-14: 78.23 % líneas, 77.89 % ramas, 64.79 % funciones con
        // 77 archivos / 522 pruebas). Trinquete: nunca baja; S8 piso 80.
        lines: 75,
        branches: 76,
        functions: 60,
        statements: 75,
      },
    },
  },
});
