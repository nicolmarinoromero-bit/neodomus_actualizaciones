// Semana 2 — casos límite del parseo de metros (regla real del carrito:
// coma o punto decimal, máximo 2 decimales, valores > 0, nunca valores
// ambiguos). Complementa metros.test.ts con las ramas no cubiertas.
import { describe, expect, it } from 'vitest';
import { formatMetros, parseMetros } from './metros';

describe('parseMetros: casos límite', () => {
  it('los separadores ambiguos se rechazan con mensaje claro', () => {
    // Arrange: entradas que combinan separadores o símbolos.
    const entradas = ['1,5.5', '1.5,5', '-2', '1e3', 'abc', '1,234'];
    // Act / Assert: ninguna produce valor.
    for (const entrada of entradas) {
      const resultado = parseMetros(entrada);
      expect(resultado.valor).toBeNull();
      expect(resultado.error).toBeTruthy();
    }
  });

  it('la longitud cero no es válida (debe ser mayor a cero)', () => {
    const resultado = parseMetros('0');
    expect(resultado).toEqual({ valor: null, error: 'La longitud debe ser mayor a cero' });
  });

  it('hasta 2 decimales se aceptan en coma y en punto', () => {
    expect(parseMetros('2,5')).toEqual({ valor: 2.5, error: null });
    expect(parseMetros('2.75')).toEqual({ valor: 2.75, error: null });
    expect(parseMetros('3,')).toEqual({ valor: 3, error: null }); // separador suelto
    expect(parseMetros('3.')).toEqual({ valor: 3, error: null });
  });
});

describe('formatMetros: casos límite', () => {
  it('valores no numéricos o nulos devuelven cadena vacía', () => {
    expect(formatMetros(null)).toBe('');
    expect(formatMetros(undefined)).toBe('');
    expect(formatMetros(Number.NaN)).toBe('');
    expect(formatMetros(Number.POSITIVE_INFINITY)).toBe('');
  });

  it('se limita a 2 decimales sin notación exponencial', () => {
    // 1.016 → "1.02"; 1.005 en binario es 1.0049… → redondea a "1.00"
    // (comportamiento estándar de toFixed: se fija con este caso).
    expect(formatMetros(1.016)).toBe('1.02');
    expect(formatMetros(1.005)).toBe('1');
    expect(formatMetros(0.000001)).toBe('0');
    expect(formatMetros(10)).toBe('10');
  });
});
