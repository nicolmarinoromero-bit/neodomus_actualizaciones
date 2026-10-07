// Tests de las utilidades de formateo de nombres.
import { describe, it, expect } from 'vitest';
import { tituloNombre, nombreCompleto } from '../../utils/formatoNombre';

describe('tituloNombre', () => {
  it('devuelve cadena vacía para valores nulos o vacíos', () => {
    expect(tituloNombre(null)).toBe('');
    expect(tituloNombre(undefined)).toBe('');
    expect(tituloNombre('')).toBe('');
    expect(tituloNombre('   ')).toBe('');
  });

  it('pone en mayúscula la primera letra de cada palabra', () => {
    expect(tituloNombre('juan pÉREZ')).toBe('Juan Pérez');
    expect(tituloNombre('ANA MARÍA')).toBe('Ana María');
    expect(tituloNombre('  carlos   andrÉs  gÓmez ')).toBe('Carlos Andrés Gómez');
  });

  it('ignora espacios sobrantes entre palabras', () => {
    expect(tituloNombre('lucia\tfernandez')).toBe('Lucia Fernandez');
  });
});

describe('nombreCompleto', () => {
  it('concatena nombre y apellido', () => {
    expect(nombreCompleto('ana', 'perez')).toBe('Ana Perez');
  });

  it('tolera campos faltantes', () => {
    expect(nombreCompleto('ana', null)).toBe('Ana');
    expect(nombreCompleto(undefined, 'perez')).toBe('Perez');
    expect(nombreCompleto(null, undefined)).toBe('');
  });

  it('normaliza espacios dobles cuando un campo viene vacío', () => {
    expect(nombreCompleto('', 'torres')).toBe('Torres');
  });
});
