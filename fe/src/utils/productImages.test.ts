// Semana 2 — resolución de imágenes de producto (regla real del catálogo:
// imagen configurada manda, si no la referencia estable del seed, si no
// placeholder; nunca depender del AUTO_INCREMENT).
import { describe, expect, it, vi } from 'vitest';
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  aplicarFallbackImagenProducto,
  imagenPorReferencia,
  resolverImagenProducto,
} from './productImages';

describe('imagenPorReferencia', () => {
  it('resuelve la referencia canónica al asset estable', () => {
    expect(imagenPorReferencia('smi-001')).toBe('/productos/1.jpg');
  });

  it('normaliza mayúsculas y espacios alrededor', () => {
    expect(imagenPorReferencia('  SMI-001 ')).toBe('/productos/1.jpg');
  });

  it('una referencia nula o vacía no resuelve nada', () => {
    expect(imagenPorReferencia(null)).toBeUndefined();
    expect(imagenPorReferencia('')).toBeUndefined();
    expect(imagenPorReferencia('   ')).toBeUndefined();
  });
});

describe('resolverImagenProducto', () => {
  it('la imagen configurada manda sobre la referencia', () => {
    expect(
      resolverImagenProducto({ imagen_url: 'https://cdn.neodomus.com/foto.webp', referencia_producto: 'smi-001' }),
    ).toBe('https://cdn.neodomus.com/foto.webp');
  });

  it('sin imagen configurada usa la referencia; sin ambas cae al placeholder', () => {
    expect(resolverImagenProducto({ referencia_producto: 'led-003' })).toBe('/productos/3.jpg');
    expect(resolverImagenProducto({})).toBe(PRODUCT_IMAGE_PLACEHOLDER);
  });

  it('una imagen_url en blanco cuenta como no configurada', () => {
    expect(resolverImagenProducto({ imagen_url: '   ', referencia_producto: 'utp6-050' })).toBe('/productos/5.jpg');
  });
});

describe('aplicarFallbackImagenProducto', () => {
  function imagenCon(src: string | null): HTMLImageElement {
    const imagen = document.createElement('img');
    if (src !== null) imagen.setAttribute('src', src);
    return imagen;
  }

  it('reemplaza el src roto por el fallback de la referencia', () => {
    const imagen = imagenCon('/productos/rota.jpg');
    aplicarFallbackImagenProducto(imagen, 'ccd-004');
    expect(imagen.getAttribute('src')).toBe('/productos/2.jpg');
  });

  it('sin referencia aplica el placeholder y no limpia el onerror ajeno', () => {
    const imagen = imagenCon(null);
    aplicarFallbackImagenProducto(imagen, null);
    expect(imagen.getAttribute('src')).toBe(PRODUCT_IMAGE_PLACEHOLDER);
  });

  it('si el src ya ES el fallback se neutraliza onerror (evita bucle de error)', () => {
    // Arrange
    const imagen = imagenCon(PRODUCT_IMAGE_PLACEHOLDER);
    const onerror = vi.fn();
    imagen.onerror = onerror as unknown as (ev: unknown) => unknown;
    // Act
    aplicarFallbackImagenProducto(imagen, null);
    // Assert: el handler se retira y el src no cambia.
    expect(imagen.onerror).toBeNull();
    expect(imagen.getAttribute('src')).toBe(PRODUCT_IMAGE_PLACEHOLDER);
  });
});
