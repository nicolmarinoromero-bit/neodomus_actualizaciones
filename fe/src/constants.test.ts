// Semana 2 — reglas de stock y categorías del frontend (deben coincidir con
// el backend: STOCK_MINIMO y CATEGORIAS_CONSULTA). Unitarias puras.
import { describe, expect, it } from 'vitest';
import {
  CATEGORIAS_CONSULTA,
  CATEGORIAS_CONSULTA_ORDER,
  STOCK_MINIMO,
  badgeCategoria,
  badgeStock,
  estadoStock,
  nombreCategoria,
  textoStock,
} from './constants';

describe('estadoStock (contrato espejo del backend)', () => {
  it('el umbral coincide con STOCK_MINIMO del backend', () => {
    expect(STOCK_MINIMO).toBe(5);
  });

  it('stock 0 o negativo es agotado', () => {
    expect(estadoStock(0)).toBe('agotado');
    expect(estadoStock(-1)).toBe('agotado');
  });

  it('entre 1 y STOCK_MINIMO-1 es stock bajo', () => {
    expect(estadoStock(1)).toBe('bajo');
    expect(estadoStock(STOCK_MINIMO - 1)).toBe('bajo');
  });

  it('desde STOCK_MINIMO es disponible', () => {
    expect(estadoStock(STOCK_MINIMO)).toBe('disponible');
    expect(estadoStock(50)).toBe('disponible');
  });
});

describe('textoStock', () => {
  it('agotado, bajo y disponible tienen su texto para la persona usuaria', () => {
    expect(textoStock(0)).toBe('Sin stock');
    expect(textoStock(2)).toBe('2 u. · stock bajo');
    expect(textoStock(8)).toBe('8 u.');
  });
});

describe('badgeStock y categorías', () => {
  it('badges por estado de stock', () => {
    expect(badgeStock(0)).toBe('err');
    expect(badgeStock(1)).toBe('warn');
    expect(badgeStock(5)).toBe('ok');
  });

  it('nombreCategoria resuelve conocidas y conserva desconocidas', () => {
    expect(nombreCategoria('pedido')).toBe('Pedido');
    expect(nombreCategoria('categoria-rara')).toBe('categoria-rara');
    expect(nombreCategoria(null)).toBe('Sin clasificar');
  });

  it('el orden de categorías coincide con las claves del mapa', () => {
    expect(CATEGORIAS_CONSULTA_ORDER).toEqual(Object.keys(CATEGORIAS_CONSULTA));
  });

  it('badges por categoría de consulta', () => {
    expect(badgeCategoria('soporte-tecnico')).toBe('warn');
    expect(badgeCategoria('pago')).toBe('ok');
    expect(badgeCategoria('reclamo')).toBe('err');
    expect(badgeCategoria('consulta-general')).toBe('info');
    expect(badgeCategoria('otra')).toBe('neutral');
    expect(badgeCategoria(undefined)).toBe('neutral');
  });
});
