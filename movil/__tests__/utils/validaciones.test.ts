// ─────────────────────────────────────────────────────────────
// Pruebas de utils/validaciones.ts (lógica pura de formularios).
// ─────────────────────────────────────────────────────────────

import {
  REGEX_CONTRASENA,
  TIPOS_DOCUMENTO,
  REGIONES_COLOMBIA,
  contrasenaValida,
  esEmailValido,
  evaluarContrasena,
  limpiarNumerico,
} from "@/utils/validaciones";

describe("esEmailValido", () => {
  it("acepta correos válidos", () => {
    expect(esEmailValido("usuario@ejemplo.co")).toBe(true);
    expect(esEmailValido("a.b@c.d.e")).toBe(true);
    expect(esEmailValido("correo@dominio.com")).toBe(true);
  });

  it("rechaza espacios en cualquier parte", () => {
    expect(esEmailValido("usuario @ejemplo.co")).toBe(false);
    expect(esEmailValido(" usuario@ejemplo.co")).toBe(false);
    expect(esEmailValido("usuario@ejemplo .co")).toBe(false);
  });

  it("rechaza sin arroba o con arrobas duplicados", () => {
    expect(esEmailValido("usuariaejemplo.co")).toBe(false);
    expect(esEmailValido("usuario@@ejemplo.co")).toBe(false);
  });

  it("rechaza arroba al inicio o al final", () => {
    expect(esEmailValido("@ejemplo.co")).toBe(false);
    expect(esEmailValido("usuario@")).toBe(false);
  });

  it("exige al menos un punto en el dominio", () => {
    expect(esEmailValido("usuario@dominio")).toBe(false);
    expect(esEmailValido("usuario@.")).toBe(false);
    expect(esEmailValido("usuario@dominio.")).toBe(false);
  });

  it("acepta cadena vacía como inválida", () => {
    expect(esEmailValido("")).toBe(false);
  });
});

describe("evaluarContrasena", () => {
  it("marca todos los requisitos como falsos con cadena vacía", () => {
    expect(evaluarContrasena("")).toEqual({
      length: false,
      uppercase: false,
      lowercase: false,
      number: false,
      special: false,
    });
  });

  it("evalúa cada requisito de forma independiente", () => {
    expect(evaluarContrasena("abcdefgh")).toEqual({
      length: true,
      uppercase: false,
      lowercase: true,
      number: false,
      special: false,
    });
    expect(evaluarContrasena("Abc123!@")).toEqual({
      length: true,
      uppercase: true,
      lowercase: true,
      number: true,
      special: true,
    });
    expect(evaluarContrasena("Aa1!")).toEqual({
      length: false,
      uppercase: true,
      lowercase: true,
      number: true,
      special: true,
    });
  });
});

describe("contrasenaValida", () => {
  it("solo es verdadera cuando todos los requisitos se cumplen", () => {
    expect(contrasenaValida(evaluarContrasena("Abc123!@"))).toBe(true);
    expect(contrasenaValida(evaluarContrasena("abc123!@"))).toBe(false);
    expect(contrasenaValida(evaluarContrasena("Abc123"))).toBe(false);
  });
});

describe("REGEX_CONTRASENA", () => {
  it("coincide con contraseñas que cumplen la política de la web", () => {
    expect(REGEX_CONTRASENA.test("Abc123!@#")).toBe(true);
    expect(REGEX_CONTRASENA.test("abc123!@#")).toBe(false);
    expect(REGEX_CONTRASENA.test("ABC123!@#")).toBe(false);
    expect(REGEX_CONTRASENA.test("Abcdef!@#")).toBe(false);
    expect(REGEX_CONTRASENA.test("Abcdef1@#")).toBe(true);
  });
});

describe("limpiarNumerico", () => {
  it("conserva solo dígitos", () => {
    expect(limpiarNumerico("12a3-4")).toBe("1234");
    expect(limpiarNumerico("abc")).toBe("");
  });

  it("limita a 10 dígitos", () => {
    expect(limpiarNumerico("1234567890123")).toBe("1234567890");
    expect(limpiarNumerico("123456789")).toBe("123456789");
  });
});

describe("catálogos estáticos", () => {
  it("REGIONES_COLOMBIA lista Bogotá con su único distrito", () => {
    expect(REGIONES_COLOMBIA).toEqual({ Bogotá: ["Bogotá D.C."] });
  });

  it("TIPOS_DOCUMENTO ofrece CC y CE", () => {
    expect(TIPOS_DOCUMENTO).toEqual([
      { valor: "1", label: "CC" },
      { valor: "2", label: "CE" },
    ]);
  });
});
