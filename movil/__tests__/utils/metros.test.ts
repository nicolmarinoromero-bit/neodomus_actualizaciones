// ─────────────────────────────────────────────────────────────
// Pruebas de utils/metros.ts (metraje comercial en pasos de 0,5 m)
// y del reexport del parser compartido shared/metros.ts.
// ─────────────────────────────────────────────────────────────

import {
  PASO_METROS,
  esMetrajeValido,
  formatMetros,
  maxMetrajePermitido,
  opcionesMetraje,
  parseMetros,
  pasosMetraje,
} from "@/utils/metros";

describe("parseMetros (shared/metros)", () => {
  it("acepta coma o punto como separador decimal", () => {
    expect(parseMetros("1,5")).toEqual({ valor: 1.5, error: null });
    expect(parseMetros("1.5")).toEqual({ valor: 1.5, error: null });
    expect(parseMetros("10")).toEqual({ valor: 10, error: null });
  });

  it("acepta números directamente", () => {
    expect(parseMetros(2.5)).toEqual({ valor: 2.5, error: null });
  });

  it("recorta espacios", () => {
    expect(parseMetros("  2  ")).toEqual({ valor: 2, error: null });
  });

  it("rechaza caracteres no numéricos o separadores ambiguos", () => {
    expect(parseMetros("abc")).toEqual({
      valor: null,
      error: "Cantidad inválida (usa hasta 2 decimales)",
    });
    expect(parseMetros("1,5.5")).toEqual({
      valor: null,
      error: "Cantidad inválida (usa hasta 2 decimales)",
    });
    expect(parseMetros("1.555")).toEqual({
      valor: null,
      error: "Cantidad inválida (usa hasta 2 decimales)",
    });
    expect(parseMetros("-1")).toEqual({
      valor: null,
      error: "Cantidad inválida (usa hasta 2 decimales)",
    });
  });

  it("rechaza cero y vacío", () => {
    expect(parseMetros("0")).toEqual({
      valor: null,
      error: "La longitud debe ser mayor a cero",
    });
    expect(parseMetros("")).toEqual({
      valor: null,
      error: "Cantidad inválida (usa hasta 2 decimales)",
    });
  });
});

describe("formatMetros (shared/metros)", () => {
  it("devuelve cadena vacía para valores nulos o no finitos", () => {
    expect(formatMetros(null)).toBe("");
    expect(formatMetros(undefined)).toBe("");
    expect(formatMetros(Number.NaN)).toBe("");
  });

  it("formatea sin ceros de más (máx. 2 decimales)", () => {
    expect(formatMetros(3)).toBe("3");
    expect(formatMetros(2.5)).toBe("2.5");
    expect(formatMetros(1.25)).toBe("1.25");
    expect(formatMetros(1.999)).toBe("2");
  });
});

describe("pasosMetraje", () => {
  it("PASO_METROS es medio metro", () => {
    expect(PASO_METROS).toBe(0.5);
  });

  it("convierte el máximo disponible en unidades enteras de 0,5 m", () => {
    expect(pasosMetraje(3.2)).toBe(6);
    expect(pasosMetraje(3)).toBe(6);
    expect(pasosMetraje(0.5)).toBe(1);
  });

  it("devuelve 0 con entradas inválidas o insuficientes", () => {
    expect(pasosMetraje(0.4)).toBe(0);
    expect(pasosMetraje(0)).toBe(0);
    expect(pasosMetraje(-1)).toBe(0);
    expect(pasosMetraje(null)).toBe(0);
    expect(pasosMetraje(undefined)).toBe(0);
    expect(pasosMetraje(Number.NaN)).toBe(0);
    expect(pasosMetraje(Infinity)).toBe(0);
  });
});

describe("opcionesMetraje", () => {
  it("genera incrementos de 0,5 m hasta el máximo", () => {
    expect(opcionesMetraje(3.2)).toEqual([0.5, 1, 1.5, 2, 2.5, 3]);
    expect(opcionesMetraje(1)).toEqual([0.5, 1]);
  });

  it("genera lista vacía sin disponibilidad", () => {
    expect(opcionesMetraje(0.4)).toEqual([]);
    expect(opcionesMetraje(null)).toEqual([]);
  });
});

describe("maxMetrajePermitido", () => {
  it("devuelve el múltiplo exacto de 0,5 m", () => {
    expect(maxMetrajePermitido(3.2)).toBe(3);
    expect(maxMetrajePermitido(2)).toBe(2);
    expect(maxMetrajePermitido(0.4)).toBe(0);
  });
});

describe("esMetrajeValido", () => {
  it("acepta múltiplos de 0,5 m dentro del disponible", () => {
    expect(esMetrajeValido(2.5, 3.2)).toBe(true);
    expect(esMetrajeValido(3, 3.2)).toBe(true);
    expect(esMetrajeValido(1, 1)).toBe(true);
  });

  it("rechaza valores fuera de disponible, no múltiplos o inválidos", () => {
    expect(esMetrajeValido(3.5, 3.2)).toBe(false);
    expect(esMetrajeValido(1.25, 3.2)).toBe(false);
    expect(esMetrajeValido(0, 3.2)).toBe(false);
    expect(esMetrajeValido(-2, 3.2)).toBe(false);
    expect(esMetrajeValido(Number.NaN, 3.2)).toBe(false);
    expect(esMetrajeValido(2, null)).toBe(false);
  });
});
