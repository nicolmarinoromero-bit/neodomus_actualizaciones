// Tests de las constantes de negocio compartidas (stock y categorías).
import { describe, it, expect } from 'vitest';
import {
  STOCK_MINIMO,
  estadoStock,
  textoStock,
  badgeStock,
  CATEGORIAS_CONSULTA,
  CATEGORIAS_CONSULTA_ORDER,
  nombreCategoria,
  badgeCategoria,
} from '../../constants';

describe('estadoStock', () => {
  it('marca como agotado cuando el stock es 0 o negativo', () => {
    expect(estadoStock(0)).toBe('agotado');
    expect(estadoStock(-3)).toBe('agotado');
  });

  it('marca como bajo por debajo del umbral', () => {
    expect(estadoStock(1)).toBe('bajo');
    expect(estadoStock(STOCK_MINIMO - 1)).toBe('bajo');
  });

  it('marca como disponible desde el umbral en adelante', () => {
    expect(estadoStock(STOCK_MINIMO)).toBe('disponible');
    expect(estadoStock(1000)).toBe('disponible');
  });
});

describe('textoStock', () => {
  it('describe cada estado con el texto de la UI', () => {
    expect(textoStock(0)).toBe('Sin stock');
    expect(textoStock(3)).toBe('3 u. · stock bajo');
    expect(textoStock(12)).toBe('12 u.');
  });
});

describe('badgeStock', () => {
  it('asigna el color de badge esperado por estado', () => {
    expect(badgeStock(0)).toBe('err');
    expect(badgeStock(2)).toBe('warn');
    expect(badgeStock(5)).toBe('ok');
  });
});

describe('categorías de consulta', () => {
  it('mantiene el orden de las categorías definidas', () => {
    expect(CATEGORIAS_CONSULTA_ORDER).toEqual(Object.keys(CATEGORIAS_CONSULTA));
    expect(CATEGORIAS_CONSULTA_ORDER).toContain('reclamo');
  });

  it('nombreCategoria traduce claves conocidas', () => {
    expect(nombreCategoria('pago')).toBe('Pago');
    expect(nombreCategoria('soporte-tecnico')).toBe('Soporte técnico');
  });

  it('nombreCategoria devuelve la clave o el texto por defecto si no la conoce', () => {
    expect(nombreCategoria('clave-inexistente')).toBe('clave-inexistente');
    expect(nombreCategoria(null)).toBe('Sin clasificar');
    expect(nombreCategoria(undefined)).toBe('Sin clasificar');
    expect(nombreCategoria('')).toBe('Sin clasificar');
  });

  it('badgeCategoria agrupa cada categoría en su color', () => {
    expect(badgeCategoria('soporte-tecnico')).toBe('warn');
    expect(badgeCategoria('pedido')).toBe('ok');
    expect(badgeCategoria('reembolso')).toBe('ok');
    expect(badgeCategoria('reclamo')).toBe('err');
    expect(badgeCategoria('consulta-general')).toBe('info');
    expect(badgeCategoria('otro')).toBe('neutral');
    expect(badgeCategoria(null)).toBe('neutral');
  });
});
