// ─────────────────────────────────────────────────────────────
// Tests de IdiomaContext: diccionario plano es/en con persistencia
// en AsyncStorage['pf_idioma'] (misma clave que la web) y helper
// traducirMensajeNotificacion para mensajes crudos del backend.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import {
  IdiomaProvider,
  traducirMensajeNotificacion,
  useIdioma,
} from "@/contexts/IdiomaContext";
import { limpiarAlmacenamiento, sembrarAlmacenamiento } from "../helpers/almacenamiento";

const asentar = async () => {
  await act(async () => {
    await new Promise((resolucion) => setTimeout(resolucion, 0));
  });
};

async function montar() {
  const { result, rerender } = await renderHook(() => useIdioma(), {
    wrapper: IdiomaProvider,
  });
  // La persistencia del idioma elegido se escribe al final del setItem.
  await asentar();
  return { result, rerender };
}

beforeEach(async () => {
  await limpiarAlmacenamiento();
});

describe("useIdioma", () => {
  it("lanza error fuera del proveedor", async () => {
    await expect(renderHook(() => useIdioma())).rejects.toThrow(
      "useIdioma debe usarse dentro de <IdiomaProvider>",
    );
  });
});

describe("t()", () => {
  it("traduce a español por defecto", async () => {
    const { result } = await montar();
    expect(result.current.idioma).toBe("es");
    expect(result.current.t("nav.inicio")).toBe("Inicio");
    expect(result.current.t("nav.productos")).toBe("Productos");
  });

  it("traduce a inglés tras cambiar el idioma y persiste la elección", async () => {
    const { result } = await montar();

    await act(async () => {
      await result.current.setIdioma("en");
    });
    expect(result.current.idioma).toBe("en");
    expect(result.current.t("nav.inicio")).toBe("Home");
    expect(result.current.t("nav.productos")).toBe("Products");
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenCalledWith("pf_idioma", "en"),
    );
  });

  it("interpola parámetros {param}", async () => {
    const { result } = await montar();
    expect(result.current.t("tecnico.hola", { nombre: "Juan" })).toBe("Hola, Juan");
    expect(result.current.t("notificaciones.sinLeer", { count: 3 })).toBe("3 sin leer");
  });

  it("clave desconocida devuelve la propia clave", async () => {
    const { result } = await montar();
    expect(result.current.t("clave.inexistente")).toBe("clave.inexistente");
  });
});

describe("restauración al montar", () => {
  it("restaura 'en' desde AsyncStorage", async () => {
    await sembrarAlmacenamiento({ pf_idioma: "en" });
    const { result } = await montar();
    await waitFor(() => expect(result.current.idioma).toBe("en"));
    expect(result.current.t("nav.inicio")).toBe("Home");
  });

  it("ignora valores que no son 'es' ni 'en'", async () => {
    await sembrarAlmacenamiento({ pf_idioma: "fr" });
    const { result } = await montar();
    expect(result.current.idioma).toBe("es");
  });

  it("sin preferencia guardada empieza en español", async () => {
    const { result } = await montar();
    expect(result.current.idioma).toBe("es");
  });
});

describe("traducirMensajeNotificacion", () => {
  it("traduce un mensaje conocido del backend al inglés", () => {
    expect(traducirMensajeNotificacion("Sin citas hoy", "en")).toBe(
      "No appointments today",
    );
  });

  it("traduce mensajes con parámetros interpolados", () => {
    expect(traducirMensajeNotificacion("Hola, Juan", "en")).toBe("Hello, Juan");
  });

  it("deja intacto un mensaje que no está en el diccionario", () => {
    expect(traducirMensajeNotificacion("Mensaje inventado del backend", "en")).toBe(
      "Mensaje inventado del backend",
    );
  });
});
