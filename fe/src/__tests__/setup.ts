// Setup global de Vitest: registra los matchers de jest-dom (toBeInTheDocument,
// toHaveClass, ...) sobre el expect de Vitest.
import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// jsdom no implementa matchMedia; algunos componentes lo consultan.
if (typeof window.matchMedia !== 'function') {
  window.matchMedia = ((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => undefined,
    removeListener: () => undefined,
    addEventListener: () => undefined,
    removeEventListener: () => undefined,
    dispatchEvent: () => false,
  })) as unknown as typeof window.matchMedia;
}

// Limpia el DOM renderizado entre tests.
afterEach(() => {
  cleanup();
});
