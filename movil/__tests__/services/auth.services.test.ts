// ─────────────────────────────────────────────────────────────
// Pruebas de services/auth.services.ts: contrato de endpoints
// (URL, método y cuerpo) contra el backend real de NeoDomus.
// ─────────────────────────────────────────────────────────────

import * as auth from "@/services/auth.services";
import { fetchActual, instalarFetch, restaurarFetch } from "../helpers/fetch";

const BASE = "http://10.0.2.2:8000/api/v1";

beforeEach(() => {
  instalarFetch({ cuerpo: {} });
});

afterEach(() => {
  restaurarFetch();
});

function cuerpoLlamada(indice = 0): Record<string, unknown> {
  const init = fetchActual().mock.calls[indice][1] as RequestInit;
  return JSON.parse(String(init.body ?? "{}"));
}

describe("registro y verificación", () => {
  it("registra cliente en /auth/register/client con el body de la web", async () => {
    const datos = {
      first_name: "Ana",
      last_name: "Pérez",
      email: "ana@neodomus.com",
      password: "Abc123!@#",
      id_tipo_documento_c: 1,
      documento_cliente: 1234567890,
      telefono_cliente: 3001234567,
      city: "Bogotá D.C.",
      address: "Calle 1 #2-3",
    };

    await auth.registrarCliente(datos);

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/auth/register/client`);
    expect(cuerpoLlamada()).toEqual(datos);
  });

  it("verifica correo con el código como query param codificado", async () => {
    await auth.verificarCorreo("12 3A");

    expect(fetchActual().mock.calls[0][0]).toBe(
      `${BASE}/auth/verify-email?code=12%203A`,
    );
    const init = fetchActual().mock.calls[0][1] as RequestInit;
    expect(init.method).toBe("POST");
  });

  it("reenvía verificación con el correo en el body", async () => {
    await auth.reenviarVerificacion("ana@neodomus.com");

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/auth/resend-verification`);
    expect(cuerpoLlamada()).toEqual({ email: "ana@neodomus.com" });
  });
});

describe("login y sesión", () => {
  it("inicia sesión con credenciales en el body", async () => {
    await auth.iniciarSesion("ana@neodomus.com", "Abc123!@#");

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/auth/login`);
    expect(cuerpoLlamada()).toEqual({
      email: "ana@neodomus.com",
      password: "Abc123!@#",
    });
  });

  it("solicita habilitación de cuenta inhabilitada", async () => {
    await auth.solicitarHabilitacion("ana@neodomus.com", "Abc123!@#");

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/auth/solicitar-habilitacion`);
    expect(cuerpoLlamada()).toEqual({
      email: "ana@neodomus.com",
      password: "Abc123!@#",
    });
  });

  it("cierra sesión sin refreshToken: body vacío", async () => {
    await auth.cerrarSesionBackend();

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/auth/logout`);
    expect(cuerpoLlamada()).toEqual({});
  });

  it("cierra sesión enviando el refreshToken", async () => {
    await auth.cerrarSesionBackend("ref-9");

    expect(cuerpoLlamada()).toEqual({ refresh_token: "ref-9" });
  });

  it("valida la sesión en /auth/session sin body", async () => {
    await auth.validarSesionBackend();

    const init = fetchActual().mock.calls[0][1] as RequestInit;
    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/auth/session`);
    expect(init.method).toBeUndefined();
    expect(init.body).toBeUndefined();
  });
});

describe("recuperación de contraseña (código de 6 dígitos)", () => {
  it("solicita la recuperación con el correo", async () => {
    await auth.solicitarRecuperacionPassword("ana@neodomus.com");

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/auth/forgot-password`);
    expect(cuerpoLlamada()).toEqual({ email: "ana@neodomus.com" });
  });

  it("verifica el código de recuperación", async () => {
    await auth.verificarCodigoRecuperacion("ana@neodomus.com", "123456");

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/auth/verify-code`);
    expect(cuerpoLlamada()).toEqual({ email: "ana@neodomus.com", code: "123456" });
  });

  it("restablece la contraseña usando el código como token", async () => {
    await auth.restablecerPassword("123456", "Nueva123!@#");

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/auth/reset-password`);
    expect(cuerpoLlamada()).toEqual({ token: "123456", new_password: "Nueva123!@#" });
  });
});

describe("cambio de contraseña con sesión activa", () => {
  it("envía contraseña actual y nueva", async () => {
    await auth.cambiarPassword("Actual123!@", "Nueva123!@#");

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/auth/change-password`);
    expect(cuerpoLlamada()).toEqual({
      current_password: "Actual123!@",
      new_password: "Nueva123!@#",
    });
  });
});
