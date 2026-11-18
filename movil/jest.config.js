// ─────────────────────────────────────────────────────────────
// Pruebas y cobertura de la aplicación móvil.
//
// - Preset oficial jest-expo (SDK 58): entorno nativo, transform de TS/TSX
//   y mocks de módulos de Expo ya incluidos (reutilización, cero config extra).
// - Alias "@/": mismos paths de tsconfig.json.
// - Cobertura: convenciones ya usadas en fe/vitest.config.ts (reporteros
//   text/lcov/json-summary; diccionarios y datos declarativos fuera).
// ─────────────────────────────────────────────────────────────

module.exports = {
  preset: "jest-expo",

  // Solo se descubren pruebas dentro de __tests__ (árbol espejo de la fuente).
  roots: ["<rootDir>/__tests__"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],

  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/$1",
  },

  setupFiles: ["<rootDir>/jest.setup.js"],

  // Limpia registros de llamadas entre pruebas sin tocar las implementaciones
  // del mock global de AsyncStorage (definidas en jest.setup.js).
  clearMocks: true,

  coverageDirectory: "coverage",
  coverageReporters: ["text", "lcov", "json-summary"],
  // Trinquete de cobertura (convención del repo, igual que fe/vitest.config.ts):
  // nunca baja respecto a la medición real de 2026-11-17
  // (90.26 % sentencias, 81.29 % ramas, 78.12 % funciones, 90.7 % líneas).
  coverageThreshold: {
    global: {
      statements: 90,
      branches: 80,
      functions: 75,
      lines: 90,
    },
  },
  collectCoverageFrom: [
    "app/**/*.{ts,tsx}",
    "components/**/*.{ts,tsx}",
    "constants/**/*.{ts,tsx}",
    "contexts/**/*.{ts,tsx}",
    "hooks/**/*.{ts,tsx}",
    "services/**/*.{ts,tsx}",
    "utils/**/*.{ts,tsx}",
    "!**/__tests__/**",
    // Variante iOS puramente declarativa (mismo contrato que icon-symbol.tsx).
    "components/ui/icon-symbol.ios.tsx",
    // Implementación web del hook (requiere DOM; cubierta por la base).
    "hooks/use-color-scheme.web.ts",
    // Diccionarios declarativos: solo mapas de cadenas (igual que fe).
    "contexts/translations/*Translations.ts",
  ],
};
