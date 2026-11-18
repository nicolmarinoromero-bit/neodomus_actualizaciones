// ─────────────────────────────────────────────────────────────
// Pruebas de services/api.ts: la capa única de comunicación.
// Se sustituye globalThis.fetch por un doble controlado (helpers/fetch).
// ─────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { ApiError, apiFetch } from "@/services/api";
import { guardarSesion } from "@/services/storage";
import { instalarFetch, restaurarFetch, type LlamadaFetch } from "../helpers/fetch";

const BASE = "http://10.0.2.2:8000/api/v1";

beforeEach(async () => {
  await AsyncStorage.clear();
});

afterEach(() => {
  restaurarFetch();
});

describe("apiFetch — caso feliz", () => {
  it("hace GET con Accept-Language por defecto y parsea el JSON", async () => {
    const llamadas = instalarFetch({ cuerpo: { ok: true } });

    await expect(apiFetch("/ping")).resolves.toEqual({ ok: true });

    expect(llamadas).toHaveLength(1);
    expect(llamadas[0].url).toBe(`${BASE}/ping`);
    expect(llamadas[0].init.headers).toMatchObject({
      "Content-Type": "application/json",
      "Accept-Language": "es",
    });
    expect((llamadas[0].init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it("traduce pf_idioma=en al header Accept-Language", async () => {
    await AsyncStorage.setItem("pf_idioma", "en");
    const llamadas = instalarFetch({ cuerpo: {} });

    await apiFetch("/ping");

    expect(llamadas[0].init.headers).toMatchObject({ "Accept-Language": "en" });
  });

  it("no serializa ni pone Content-Type cuando el cuerpo es FormData", async () => {
    const llamadas = instalarFetch({ cuerpo: { id: 1 } });
    const formData = new FormData();
    formData.append("file", "contenido");

    await apiFetch("/upload", { method: "POST", body: formData as unknown as BodyInit });

    const cabeceras = llamadas[0].init.headers as Record<string, string>;
    expect(cabeceras["Content-Type"]).toBeUndefined();
  });

  it("devuelve null ante un cuerpo vacío (204)", async () => {
    instalarFetch({ texto: "" });
    await expect(apiFetch("/nada")).resolves.toBeNull();
  });

  it("adjunta Authorization cuando hay sesión guardada", async () => {
    await guardarSesion({
      accessToken: "tok-123",
      refreshToken: "ref-123",
      userType: "client",
    });
    const llamadas = instalarFetch({ cuerpo: {} });

    await apiFetch("/clients/me");

    expect(llamadas[0].init.headers).toMatchObject({
      Authorization: "Bearer tok-123",
    });
  });
});

describe("apiFetch — errores del backend", () => {
  it("propaga ApiError con el detail de FastAPI", async () => {
    instalarFetch({ status: 400, cuerpo: { detail: "Correo ya registrado" } });

    const error = await apiFetch("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email: "a", password: "b" }),
    }).catch((e: unknown) => e);

    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).status).toBe(400);
    expect((error as ApiError).message).toBe("Correo ya registrado");
  });

  it("une los mensajes de un detail de validación (array)", async () => {
    instalarFetch({
      status: 422,
      cuerpo: { detail: [{ msg: "campo requerido" }, { msg: "correo inválido" }] },
    });

    const error = await apiFetch("/x").catch((e: unknown) => e);
    expect((error as ApiError).message).toBe("campo requerido · correo inválido");
  });

  it("usa el campo message cuando no hay detail", async () => {
    instalarFetch({ status: 409, cuerpo: { message: "Conflicto" } });

    const error = await apiFetch("/x").catch((e: unknown) => e);
    expect((error as ApiError).message).toBe("Conflicto");
  });

  it("aplica mensajes de respaldo por código HTTP", async () => {
    for (const [status, esperado] of [
      [400, "Petición inválida."],
      [401, "Credenciales inválidas o sesión expirada."],
      [403, "No tienes permisos para esta operación."],
      [404, "Recurso no encontrado."],
      [429, "Demasiados intentos. Espera un momento e inténtalo de nuevo."],
      [500, "Error interno del servidor."],
      [503, "Error inesperado (código 503)."],
    ] as const) {
      const llamadas = instalarFetch({ status, texto: "{}" });
      const error = await apiFetch("/x").catch((e: unknown) => e);
      expect((error as ApiError).status).toBe(status);
      expect((error as ApiError).message).toBe(esperado);
      restaurarFetch();
      void llamadas;
    }
  });
});

describe("apiFetch — fallos de red", () => {
  it("traduce un fallo de red puro a ApiError con status 0", async () => {
    instalarFetch({ lanzar: new TypeError("Network request failed") });

    const error = await apiFetch("/x").catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).message).toContain("No se pudo conectar con el servidor");
  });

  it("detecta el aborto del temporizador con un mensaje específico", async () => {
    const aborto = new Error("The operation was aborted");
    aborto.name = "AbortError";
    instalarFetch({ lanzar: aborto });

    const error = await apiFetch("/x").catch((e: unknown) => e);
    expect((error as ApiError).status).toBe(0);
    expect((error as ApiError).message).toContain("tardó demasiado en responder");
  });
});

describe("apiFetch — renovación de sesión ante 401", () => {
  const prepararSesion = () =>
    guardarSesion({
      accessToken: "expirado",
      refreshToken: "refresh-activo",
      userType: "client",
      correo: "ana@neodomus.com",
    });

  it("renueva tokens una vez y repite la petición", async () => {
    await prepararSesion();
    const llamadas: LlamadaFetch[] = instalarFetch((llamada) => {
      if (llamada.url.endsWith("/auth/refresh")) {
        return { cuerpo: { access_token: "nuevo", refresh_token: "nuevo-ref" } };
      }
      const auth = (llamada.init.headers as Record<string, string>).Authorization;
      if (auth?.includes("expirado")) return { status: 401, texto: "{}" };
      return { cuerpo: { datos: "ok" } };
    });

    await expect(apiFetch("/pedidos/mis-pedidos")).resolves.toEqual({ datos: "ok" });

    expect(llamadas).toHaveLength(3);
    expect(llamadas[1].url).toBe(`${BASE}/auth/refresh`);
    expect(JSON.parse(String(llamadas[1].init.body))).toEqual({
      refresh_token: "refresh-activo",
    });
    // La petición repetida viaja con el token renovado.
    expect((llamadas[2].init.headers as Record<string, string>).Authorization).toBe(
      "Bearer nuevo",
    );
    // La sesión renovada quedó persistida.
    await expect(AsyncStorage.getItem("neodomus.session.access_token")).resolves.toBe(
      "nuevo",
    );
  });

  it("borra la sesión local si la renovación falla", async () => {
    await prepararSesion();
    instalarFetch((llamada) => {
      if (llamada.url.endsWith("/auth/refresh")) {
        return { status: 401, texto: "{}" };
      }
      return { status: 401, cuerpo: { detail: "Credenciales inválidas o sesión expirada." } };
    });

    const error = await apiFetch("/pedidos/mis-pedidos").catch((e: unknown) => e);

    expect((error as ApiError).status).toBe(401);
    expect(await AsyncStorage.getItem("neodomus.session.access_token")).toBeNull();
    expect(await AsyncStorage.getItem("neodomus.session.refresh_token")).toBeNull();
  });

  it("no intenta renovar cuando no hay sesión", async () => {
    const llamadas = instalarFetch({ status: 401, texto: "{}" });

    const error = await apiFetch("/clients/me").catch((e: unknown) => e);

    expect((error as ApiError).status).toBe(401);
    expect(llamadas).toHaveLength(1);
  });
});
