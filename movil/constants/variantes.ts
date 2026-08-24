// ─────────────────────────────────────────────────────────────
// PORT de la lógica de variantes de la WEB
// (fe/src/pages/public/ProductoDetalle.tsx · PALETAS / COLOR_HEX /
//  medidaDe / usaTamanos).
//
// Reglas WEB replicadas:
// - Paleta de colores = nombres de las variantes del producto;
//   si no tiene variantes → paleta por categoría (PALETAS).
// - El producto "usa tamaños" solo si alguna variante define
//   etiqueta_medida o tamaño.
// - La variante activa es la que coincide con color + medida.
// ─────────────────────────────────────────────────────────────

import type { VarianteProducto } from "@/services/productos.service";

/** Paletas por categoría (fallback cuando el producto no tiene variantes). */
export const PALETAS: Record<number, string[]> = {
  1: ["Blanco", "Negro", "Gris"],
  2: ["Blanco", "Negro", "Plata"],
  3: ["Blanco cálido", "Blanco frío", "RGB"],
  4: ["Negro", "Blanco"],
  5: ["Azul", "Amarillo", "Negro"],
  6: ["Blanco", "Negro"],
  7: ["Negro"],
  8: ["Blanco", "Negro"],
  9: ["Blanco", "Gris", "Negro"],
  10: ["Blanco", "Gris"],
};

/** Mapa nombre de color → hex (igual que la WEB). */
export const COLOR_HEX: Record<string, string> = {
  Blanco: "#f5f5f5",
  "Blanco cálido": "#ffe9c7",
  "Blanco frío": "#e8f4ff",
  Negro: "#1e1e1e",
  Gris: "#9e9e9e",
  Plata: "#c0c0c0",
  Azul: "#2f6fed",
  Amarillo: "#f6c344",
};

/** Colores del degradado RGB (la web usa un linear-gradient). */
export const RGB_GRADIENTE = ["#ff4d4d", "#ffd700", "#2f6fed", "#7c4dff"];

export const medidaDe = (
  variante: Pick<VarianteProducto, "etiqueta_medida" | "tamaño">,
): string => (variante.etiqueta_medida || variante.tamaño || "").trim();

/** El producto usa medidas si alguna variante las define (regla WEB). */
export const usaTamanos = (variantes: VarianteProducto[]): boolean =>
  variantes.some((variante) => !!medidaDe(variante));

/** Paleta de colores del producto (variantes reales o fallback por categoría). */
export const paletaDeColores = (
  variantes: VarianteProducto[],
  idCategoria?: number | null,
): string[] => {
  if (variantes.length > 0) return variantes.map((v) => v.nombre);
  return PALETAS[idCategoria ?? 0] ?? ["Blanco", "Negro", "Gris"];
};
