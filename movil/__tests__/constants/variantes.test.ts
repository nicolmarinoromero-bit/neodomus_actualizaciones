// ─────────────────────────────────────────────────────────────
// Pruebas de constants/variantes.ts (lógica de variantes portada de la web).
// ─────────────────────────────────────────────────────────────

import type { VarianteProducto } from "@/services/productos.service";
import {
  COLOR_HEX,
  PALETAS,
  RGB_GRADIENTE,
  medidaDe,
  paletaDeColores,
  usaTamanos,
} from "@/constants/variantes";

const variante = (datos: Partial<VarianteProducto>): VarianteProducto => ({
  id: 1,
  nombre: "Blanco",
  stock: 5,
  ...datos,
});

describe("medidaDe", () => {
  it("prioriza etiqueta_medida y recorta espacios", () => {
    expect(medidaDe({ etiqueta_medida: " 2,5 m ", tamaño: "XL" })).toBe("2,5 m");
  });

  it("usa tamaño como respaldo", () => {
    expect(medidaDe({ etiqueta_medida: null, tamaño: "Grande" })).toBe("Grande");
  });

  it("devuelve cadena vacía sin medidas", () => {
    expect(medidaDe({ etiqueta_medida: null, tamaño: null })).toBe("");
  });
});

describe("usaTamanos", () => {
  it("es verdadera si alguna variante define medida", () => {
    expect(usaTamanos([variante({ nombre: "Negro" }), variante({ tamaño: "M" })])).toBe(true);
  });

  it("es falsa si ninguna variante define medida", () => {
    expect(usaTamanos([variante({}), variante({ etiqueta_medida: "  " })])).toBe(false);
  });

  it("es falsa sin variantes", () => {
    expect(usaTamanos([])).toBe(false);
  });
});

describe("paletaDeColores", () => {
  it("usa los nombres de las variantes cuando existen", () => {
    const variantes = [variante({ nombre: "Oro" }), variante({ nombre: "Gris" })];
    expect(paletaDeColores(variantes, 1)).toEqual(["Oro", "Gris"]);
  });

  it("usa la paleta por categoría como respaldo", () => {
    expect(paletaDeColores([], 1)).toEqual(["Blanco", "Negro", "Gris"]);
    expect(paletaDeColores([], 3)).toEqual(["Blanco cálido", "Blanco frío", "RGB"]);
  });

  it("usa la paleta por defecto sin categoría conocida", () => {
    expect(paletaDeColores([], null)).toEqual(["Blanco", "Negro", "Gris"]);
    expect(paletaDeColores([], 999)).toEqual(["Blanco", "Negro", "Gris"]);
  });
});

describe("catálogos estáticos", () => {
  it("PALETAS cubre las diez categorías", () => {
    expect(Object.keys(PALETAS)).toHaveLength(10);
  });

  it("COLOR_HEX mapea los colores nombrados a hex", () => {
    expect(COLOR_HEX["Negro"]).toBe("#1e1e1e");
    expect(COLOR_HEX["Blanco"]).toBe("#f5f5f5");
    expect(COLOR_HEX["Azul"]).toBe("#2f6fed");
  });

  it("RGB_GRADIENTE define el degradado de la web", () => {
    expect(RGB_GRADIENTE).toEqual(["#ff4d4d", "#ffd700", "#2f6fed", "#7c4dff"]);
  });
});
