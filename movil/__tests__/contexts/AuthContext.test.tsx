// ─────────────────────────────────────────────────────────────
// Tests de AuthContext: restauración de sesión guardada, inicio y
// cierre de sesión, perfil del backend y avatar persistido.
//
// No se mockea ningún servicio: storage real sobre el AsyncStorage
// en memoria y fetch sustituido por el doble del helper, igual que
// en las pruebas de servicios.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  instalarFetch,
  fetchActual,
  restaurarFetch,
  type LlamadaFetch,
  type ReglaRespuesta,
} from "../helpers/fetch";
import { limpiarAlmacenamiento, sembrarAlmacenamiento } from "../helpers/almacenamiento";
import React from "react";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { API_BASE_URL } from "@/constants/api";

const CLAVES_SESION = {
  access: "neodomus.session.access_token",
  refresh: "neodomus.session.refresh_token",
  userType: "neodomus.session.user_type",
  correo: "neodemus.session.correo",
  rol: "neodomus.session.rol",
};

const PERFIL_CLIENTE = {
  id_cliente: 5,
  first_name: "Ana",
  last_name: "Gómez",
  email: "ana@ejemplo.com",
  foto_url: "http://cdn.ejemplo.com/foto.jpg",
};

// Enruta por endpoint; todo lo no declarado responde 404.
function router(
  reglas: Record<string, ReglaRespuesta>,
): (llamada: LlamadaFetch) => ReglaRespuesta {
  return (llamada: LlamadaFetch) => {
    const ruta = llamada.url.replace(API_BASE_URL, "");
    if (ruta in reglas) return reglas[ruta];
    return { status: 404, cuerpo: {} };
  };
}

async function montar() {
  const { result, rerender } = await renderHook(() => useAuth(), {
    wrapper: AuthProvider,
  });
  // La restauración de sesión es una cadena de promesas con fetch.
  await act(async () => {
    await new Promise((resolucion) => setTimeout(resolucion, 0));
    await new Promise((resolucion) => setTimeout(resolucion, 0));
  });
  return { result, rerender };
}

afterEach(() => {
  restaurarFetch();
});

beforeEach(async () => {
  await limpiarAlmacenamiento();
});

describe("useAuth", () => {
  it("lanza error fuera del proveedor", async () => {
    await expect(renderHook(() => useAuth())).rejects.toThrow(
      "useAuth debe usarse dentro de <AuthProvider>",
    );
  });
});

describe("arranque sin sesión", () => {
  it("termina como invitado: cargando false y autenticado false", async () => {
    instalarFetch(router({}));
    const { result } = await montar();

    expect(result.current.cargando).toBe(false);
    expect(result.current.autenticado).toBe(false);
    expect(result.current.usuario).toBeNull();
    expect(result.current.userType).toBeNull();
    // Sin sesión no se consulta el perfil.
    expect(
      fetchActual().mock.calls.filter(([url]) => String(url).includes("/clients/me")),
    ).toHaveLength(0);
  });
});

describe("restauración de sesión guardada", () => {
  it("restaura usuario, tipo y rol desde AsyncStorage y el perfil del backend", async () => {
    await sembrarAlmacenamiento({
      [CLAVES_SESION.access]: "token-a",
      [CLAVES_SESION.refresh]: "token-r",
      [CLAVES_SESION.userType]: "client",
      [CLAVES_SESION.correo]: "ana@ejemplo.com",
      [CLAVES_SESION.rol]: "cliente",
    });
    instalarFetch(
      router({
        "/clients/me": { cuerpo: PERFIL_CLIENTE },
      }),
    );
    const { result } = await montar();

    expect(result.current.cargando).toBe(false);
    expect(result.current.autenticado).toBe(true);
    expect(result.current.userType).toBe("client");
    expect(result.current.rol).toBe("cliente");
    expect(result.current.usuario).toMatchObject({
      id: 5,
      nombre: "Ana Gómez",
      correo: "ana@ejemplo.com",
      userType: "client",
    });
    expect(result.current.avatar).toBe("http://cdn.ejemplo.com/foto.jpg");
  });

  it("consulta /auth/session cuando la sesión guardada no tiene rol", async () => {
    await sembrarAlmacenamiento({
      [CLAVES_SESION.access]: "token-a",
      [CLAVES_SESION.refresh]: "token-r",
      [CLAVES_SESION.userType]: "client",
      [CLAVES_SESION.correo]: "ana@ejemplo.com",
    });
    instalarFetch(
      router({
        "/auth/session": { cuerpo: { rol: "cliente" } },
        "/clients/me": { cuerpo: PERFIL_CLIENTE },
      }),
    );
    const { result } = await montar();

    await waitFor(() => expect(result.current.autenticado).toBe(true));
    expect(result.current.rol).toBe("cliente");
    expect(
      fetchActual().mock.calls.some(([url]) => String(url).includes("/auth/session")),
    ).toBe(true);
    // El rol consultado se vuelve a guardar en la sesión.
    await expect(AsyncStorage.getItem(CLAVES_SESION.rol)).resolves.toBe("cliente");
  });

  it("sesión con tipo de usuario inválido se ignora (invitado)", async () => {
    await sembrarAlmacenamiento({
      [CLAVES_SESION.access]: "token-a",
      [CLAVES_SESION.refresh]: "token-r",
      [CLAVES_SESION.userType]: "fantasma",
    });
    instalarFetch(router({}));
    const { result } = await montar();

    expect(result.current.autenticado).toBe(false);
  });
});

describe("iniciarSesion", () => {
  it("guarda tokens y carga el perfil del cliente", async () => {
    instalarFetch(
      router({
        "/auth/login": {
          cuerpo: {
            access_token: "tok-a",
            refresh_token: "tok-r",
            user_type: "client",
          },
        },
        "/clients/me": { cuerpo: PERFIL_CLIENTE },
      }),
    );
    const { result } = await montar();

    await act(async () => {
      await result.current.iniciarSesion("ana@ejemplo.com", "secreta");
    });

    expect(result.current.autenticado).toBe(true);
    expect(result.current.usuario).toMatchObject({
      id: 5,
      nombre: "Ana Gómez",
      correo: "ana@ejemplo.com",
      userType: "client",
    });
    // Tokens en la sesión local (storage real sobre AsyncStorage).
    await expect(AsyncStorage.getItem(CLAVES_SESION.access)).resolves.toBe("tok-a");
    await expect(AsyncStorage.getItem(CLAVES_SESION.userType)).resolves.toBe("client");
    const llamadaLogin = fetchActual().mock.calls.find(([, init]) => init.method === "POST");
    expect(String(llamadaLogin?.[0])).toContain("/auth/login");
  });

  it("si el perfil falla conserva el nombre derivado del correo", async () => {
    instalarFetch(
      router({
        "/auth/login": {
          cuerpo: {
            access_token: "tok-a",
            refresh_token: "tok-r",
            user_type: "client",
          },
        },
        "/clients/me": { status: 500, cuerpo: {} },
      }),
    );
    const { result } = await montar();

    await act(async () => {
      await result.current.iniciarSesion("carlos@ejemplo.com", "secreta");
    });

    expect(result.current.autenticado).toBe(true);
    expect(result.current.usuario?.nombre).toBe("Carlos");
    expect(result.current.usuario?.correo).toBe("carlos@ejemplo.com");
  });
});

describe("cerrarSesion", () => {
  it("avisa al backend, borra la sesión local y vuelve a invitado", async () => {
    await sembrarAlmacenamiento({
      [CLAVES_SESION.access]: "token-a",
      [CLAVES_SESION.refresh]: "token-r",
      [CLAVES_SESION.userType]: "client",
      [CLAVES_SESION.correo]: "ana@ejemplo.com",
      [CLAVES_SESION.rol]: "cliente",
    });
    instalarFetch(
      router({
        "/auth/logout": { cuerpo: { ok: true } },
        "/clients/me": { cuerpo: PERFIL_CLIENTE },
      }),
    );
    const { result } = await montar();
    await waitFor(() => expect(result.current.autenticado).toBe(true));

    await act(async () => {
      await result.current.cerrarSesion();
    });

    expect(result.current.autenticado).toBe(false);
    expect(result.current.usuario).toBeNull();
    const logout = fetchActual().mock.calls.find(([, init]) => init.method === "POST");
    expect(String(logout?.[0])).toContain("/auth/logout");
    await expect(AsyncStorage.getItem(CLAVES_SESION.access)).resolves.toBeNull();
    await expect(AsyncStorage.getItem(CLAVES_SESION.refresh)).resolves.toBeNull();
  });
});

describe("avatar", () => {
  it("setAvatar persiste y borra la foto local", async () => {
    instalarFetch(router({}));
    const { result } = await montar();

    await act(async () => {
      result.current.setAvatar("data:image/png;base64,AAA");
    });
    await expect(AsyncStorage.getItem("clientAvatar")).resolves.toBe(
      "data:image/png;base64,AAA",
    );
    expect(result.current.avatar).toBe("data:image/png;base64,AAA");

    await act(async () => {
      result.current.setAvatar(null);
    });
    await expect(AsyncStorage.getItem("clientAvatar")).resolves.toBeNull();
    expect(result.current.avatar).toBeNull();
  });
});
