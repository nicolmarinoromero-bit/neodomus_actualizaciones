// ─────────────────────────────────────────────────────────────
// Tests de TecnicosFavoritosContext: favoritos de técnicos 100%
// cliente, claves por identidad y migración visitante → cuenta.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import {
  TecnicosFavoritosProvider,
  useTecnicosFavoritos,
} from "@/contexts/TecnicosFavoritosContext";
import { limpiarAlmacenamiento, sembrarAlmacenamiento } from "../helpers/almacenamiento";

const CLAVE_VISITANTE = "neodomus_tecnicos_favoritos_visitante";
const CORREO = "ana@ejemplo.com";
const CLAVE_CUENTA = "neodomus_tecnicos_favoritos_ana@ejemplo.com";

const asentar = async () => {
  await act(async () => {
    await new Promise((resolucion) => setTimeout(resolucion, 0));
  });
};

async function montar(correo?: string) {
  const { result, rerender } = await renderHook(() => useTecnicosFavoritos(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <TecnicosFavoritosProvider correoUsuario={correo ?? null}>{children}</TecnicosFavoritosProvider>
    ),
  });
  await asentar();
  return { result, rerender };
}

async function montarConCorreo() {
  const correo = { current: null as string | null };
  const { result, rerender } = await renderHook(() => useTecnicosFavoritos(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <TecnicosFavoritosProvider correoUsuario={correo.current}>{children}</TecnicosFavoritosProvider>
    ),
  });
  await asentar();
  const cambiarCorreo = async (nuevo: string | null) => {
    correo.current = nuevo;
    await rerender(<React.Fragment />);
    await asentar();
  };
  return { result, cambiarCorreo };
}

async function conjuntoGuardado(clave: string): Promise<Set<number>> {
  const crudo = await AsyncStorage.getItem(clave);
  return new Set(JSON.parse(crudo ?? "[]") as number[]);
}

beforeEach(async () => {
  await limpiarAlmacenamiento();
});

describe("useTecnicosFavoritos", () => {
  it("lanza error fuera del proveedor", async () => {
    await expect(renderHook(() => useTecnicosFavoritos())).rejects.toThrow(
      "useTecnicosFavoritos debe usarse dentro de <TecnicosFavoritosProvider>",
    );
  });
});

describe("visitante", () => {
  it("arranca vacío y toggle añade + persiste en la clave del visitante", async () => {
    const { result } = await montar();

    await act(async () => {
      result.current.toggleFavoritoTecnico(11);
    });
    expect(result.current.favoritosTecnicos.has(11)).toBe(true);
    expect(result.current.esFavoritoTecnico(11)).toBe(true);
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(CLAVE_VISITANTE, "[11]"),
    );
  });

  it("toggle dos veces elimina y vuelve a añadir el técnico", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "[11,12]" });
    const { result } = await montar();
    await waitFor(() => expect(result.current.favoritosTecnicos.size).toBe(2));

    await act(async () => {
      result.current.toggleFavoritoTecnico(11);
    });
    expect(result.current.esFavoritoTecnico(11)).toBe(false);
    await waitFor(async () => {
      expect(await conjuntoGuardado(CLAVE_VISITANTE)).toEqual(new Set([12]));
    });

    await act(async () => {
      result.current.toggleFavoritoTecnico(11);
    });
    expect(result.current.esFavoritoTecnico(11)).toBe(true);
    await waitFor(async () => {
      expect(await conjuntoGuardado(CLAVE_VISITANTE)).toEqual(new Set([11, 12]));
    });
  });

  it("quitarFavoritoTecnico sobre un id ausente no persiste nada", async () => {
    const { result } = await montar();

    await act(async () => {
      result.current.quitarFavoritoTecnico(99);
    });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("quitarFavoritoTecnico elimina un técnico presente", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "[13,14]" });
    const { result } = await montar();
    await waitFor(() => expect(result.current.favoritosTecnicos.size).toBe(2));

    await act(async () => {
      result.current.quitarFavoritoTecnico(13);
    });
    expect(result.current.favoritosTecnicos.has(13)).toBe(false);
    expect(result.current.favoritosTecnicos.has(14)).toBe(true);
    await waitFor(async () => {
      expect(await conjuntoGuardado(CLAVE_VISITANTE)).toEqual(new Set([14]));
    });
  });
});

describe("carga inicial", () => {
  it("carga la lista del visitante desde AsyncStorage", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "[15]" });
    const { result } = await montar();
    await waitFor(() => expect(result.current.favoritosTecnicos.has(15)).toBe(true));
  });

  it("carga la lista del usuario con sesión iniciada", async () => {
    await sembrarAlmacenamiento({ [CLAVE_CUENTA]: "[21,22]" });
    const { result } = await montar(CORREO);
    await waitFor(() => expect(result.current.favoritosTecnicos.size).toBe(2));
    expect(result.current.esFavoritoTecnico(21)).toBe(true);
  });

  it("JSON corrupto produce un conjunto vacío", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "no-json" });
    const { result } = await montar();
    expect(result.current.favoritosTecnicos.size).toBe(0);
  });

  it("filtra elementos que no son números", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: '[21,"22",null,23]' });
    const { result } = await montar();
    await waitFor(() => expect(result.current.favoritosTecnicos.size).toBe(2));
    expect(result.current.favoritosTecnicos.has(21)).toBe(true);
    expect(result.current.favoritosTecnicos.has(23)).toBe(true);
    expect(result.current.favoritosTecnicos.has(22)).toBe(false);
  });
});

describe("migración visitante → cuenta", () => {
  it("une sin duplicados, guarda la cuenta y vacía la lista del visitante", async () => {
    await sembrarAlmacenamiento({
      [CLAVE_VISITANTE]: "[31,32]",
      [CLAVE_CUENTA]: "[32,33]",
    });

    const { result } = await montar(CORREO);

    await waitFor(() => expect(result.current.favoritosTecnicos.size).toBe(3));
    await waitFor(async () => {
      expect(await conjuntoGuardado(CLAVE_CUENTA)).toEqual(new Set([31, 32, 33]));
    });
    await waitFor(() =>
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CLAVE_VISITANTE),
    );
    await expect(AsyncStorage.getItem(CLAVE_VISITANTE)).resolves.toBeNull();
  });

  it("no migra si la lista del visitante está vacía", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "[]" });
    const { result } = await montar(CORREO);
    expect(result.current.favoritosTecnicos.size).toBe(0);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it("migración con JSON corrupto del visitante no rompe la sesión", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "no-json" });
    const { result } = await montar(CORREO);
    expect(result.current.favoritosTecnicos.size).toBe(0);
  });
});

describe("cambio de identidad", () => {
  it("recarga la lista y migra el resto del visitante al iniciar sesión", async () => {
    await sembrarAlmacenamiento({
      [CLAVE_VISITANTE]: "[41]",
      [CLAVE_CUENTA]: "[42]",
    });
    const { result, cambiarCorreo } = await montarConCorreo();
    await waitFor(() => expect(result.current.favoritosTecnicos.has(41)).toBe(true));

    await cambiarCorreo(CORREO);
    await waitFor(() => expect(result.current.favoritosTecnicos.size).toBe(2));
    expect(result.current.esFavoritoTecnico(41)).toBe(true);
    expect(result.current.esFavoritoTecnico(42)).toBe(true);
  });

  it("vuelve a la lista del visitante al cerrar sesión", async () => {
    await sembrarAlmacenamiento({
      [CLAVE_VISITANTE]: "[41]",
      [CLAVE_CUENTA]: "[42]",
    });
    const { result, cambiarCorreo } = await montarConCorreo();
    await waitFor(() => expect(result.current.favoritosTecnicos.has(41)).toBe(true));

    await cambiarCorreo(CORREO);
    await waitFor(() => expect(result.current.favoritosTecnicos.size).toBe(2));

    await cambiarCorreo(null);
    await waitFor(() => expect(result.current.favoritosTecnicos.size).toBe(0));
  });
});
