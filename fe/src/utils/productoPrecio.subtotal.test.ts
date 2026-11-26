// Precio unitario fijo y subtotal por línea: al cambiar SOLO la cantidad,
// el precio unitario de la variante elegida se mantiene y el subtotal se
// recalcula (Alexa $300.000/u: 1 → $300.000; 2 → $600.000; 1 → $300.000).
// Por metros se conserva precio/m y precisión decimal: $3.500/m × 0,5 m × 2 = $3.500.
import { describe, expect, it } from 'vitest';
import { precioUnitarioProducto, redondearImporte, subtotalLinea } from '@utils/productoPrecio';

describe('precio unitario fijo y subtotal por línea', () => {
  const alexa = { precio_venta_producto: 300000, precio_final: null, descuento_activo: null };
  const varianteGris = { precio: 300000 };
  const cable = { precio_venta_producto: 3500, precio_final: null, descuento_activo: null };

  it('el precio unitario de la variante no cambia con la cantidad', () => {
    expect(precioUnitarioProducto(alexa, varianteGris)).toBe(300000);
    // Cantidad no es entrada del precio unitario: solo el subtotal la usa.
    expect(subtotalLinea(precioUnitarioProducto(alexa, varianteGris), 1)).toBe(300000);
    expect(subtotalLinea(precioUnitarioProducto(alexa, varianteGris), 2)).toBe(600000);
    expect(subtotalLinea(precioUnitarioProducto(alexa, varianteGris), 1)).toBe(300000);
  });

  it('metros conserva precio/m y precisión decimal: 0,5 m × 2 = $3.500', () => {
    expect(precioUnitarioProducto(cable)).toBe(3500);
    expect(subtotalLinea(3500, 2, 0.5)).toBe(3500);
    expect(redondearImporte(3500 * 2 * 0.5)).toBe(3500);
  });

  it('subtotales exactos con centavos no pierden precisión', () => {
    expect(subtotalLinea(1234.55, 3)).toBe(3703.65);
  });
});
