// ─────────────────────────────────────────────────────────────
// Tests de FavoritosContext: réplica del comportamiento de la web
// (favoritos 100% cliente con claves por identidad y migración
// visitante → cuenta al iniciar sesión).
// ─────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import { FavoritosProvider, useFavoritos } from "@/contexts/FavoritosContext";
import { limpiarAlmacenamiento, sembrarAlmacenamiento } from "../helpers/almacenamiento";

const CLAVE_VISITANTE = "neodomus_favoritos_visitante";
const CORREO = "ana@ejemplo.com";
const CLAVE_CUENTA = "neodomus_favoritos_ana@ejemplo.com";

// Deja concluir la carga inicial (getItem → setFavoritos) dentro de act.
const asentar = async () => {
  await act(async () => {
    await new Promise((resolucion) => setTimeout(resolucion, 0));
  });
};

// Monta el hook con identidad fija y la carga inicial ya asentada.
async function montar(correo?: string) {
  const { result, rerender } = await renderHook(() => useFavoritos(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <FavoritosProvider correoUsuario={correo ?? null}>{children}</FavoritosProvider>
    ),
  });
  await asentar();
  return { result, rerender };
}

// Monta el hook con identidad mutable: cambiarCorreo(nuevo) muta el ref y
// rerender hace que el wrapper relea el ref y reproviene al proveedor.
async function montarConCorreo() {
  const correo = { current: null as string | null };
  const { result, rerender } = await renderHook(() => useFavoritos(), {
    wrapper: ({ children }: { children: React.ReactNode }) => (
      <FavoritosProvider correoUsuario={correo.current}>{children}</FavoritosProvider>
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

/** Lee el valor persistido de una clave y lo devuelve como conjunto. */
async function conjuntoGuardado(clave: string): Promise<Set<number>> {
  const crudo = await AsyncStorage.getItem(clave);
  return new Set(JSON.parse(crudo ?? "[]") as number[]);
}

beforeEach(async () => {
  await limpiarAlmacenamiento();
});

describe("useFavoritos", () => {
  it("lanza error fuera del proveedor", async () => {
    await expect(renderHook(() => useFavoritos())).rejects.toThrow(
      "useFavoritos debe usarse dentro de <FavoritosProvider>",
    );
  });
});

describe("visitante", () => {
  it("arranca vacío y toggle añade + persiste en la clave del visitante", async () => {
    const { result } = await montar();

    await act(async () => {
      result.current.toggleFavorito(7);
    });
    expect(result.current.favoritos.has(7)).toBe(true);
    expect(result.current.esFavorito(7)).toBe(true);
    await waitFor(() =>
      expect(AsyncStorage.setItem).toHaveBeenLastCalledWith(CLAVE_VISITANTE, "[7]"),
    );
  });

  it("toggle dos veces elimina y vuelve a añadir el favorito", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "[7,8]" });
    const { result } = await montar();
    await waitFor(() => expect(result.current.favoritos.size).toBe(2));

    await act(async () => {
      result.current.toggleFavorito(7);
    });
    expect(result.current.esFavorito(7)).toBe(false);
    // El Set preserva orden de inserción (delete+add → "8,7"); comparamos
    // contenido, no cadenas exactas.
    await waitFor(async () => {
      expect(await conjuntoGuardado(CLAVE_VISITANTE)).toEqual(new Set([8]));
    });

    await act(async () => {
      result.current.toggleFavorito(7);
    });
    expect(result.current.esFavorito(7)).toBe(true);
    await waitFor(async () => {
      expect(await conjuntoGuardado(CLAVE_VISITANTE)).toEqual(new Set([7, 8]));
    });
  });

  it("quitarFavorito sobre un id ausente no persiste nada", async () => {
    const { result } = await montar();

    await act(async () => {
      result.current.quitarFavorito(99);
    });
    expect(AsyncStorage.setItem).not.toHaveBeenCalled();
  });

  it("quitarFavorito elimina un id presente", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "[3,4]" });
    const { result } = await montar();
    await waitFor(() => expect(result.current.favoritos.size).toBe(2));

    await act(async () => {
      result.current.quitarFavorito(3);
    });
    expect(result.current.favoritos.has(3)).toBe(false);
    expect(result.current.favoritos.has(4)).toBe(true);
    await waitFor(async () => {
      expect(await conjuntoGuardado(CLAVE_VISITANTE)).toEqual(new Set([4]));
    });
  });
});

describe("carga inicial", () => {
  it("carga la lista del visitante desde AsyncStorage", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "[5]" });
    const { result } = await montar();
    await waitFor(() => expect(result.current.favoritos.has(5)).toBe(true));
  });

  it("carga la lista del usuario con sesión iniciada", async () => {
    await sembrarAlmacenamiento({ [CLAVE_CUENTA]: "[1,2,3]" });
    const { result } = await montar(CORREO);
    await waitFor(() => expect(result.current.favoritos.size).toBe(3));
    expect(result.current.esFavorito(2)).toBe(true);
  });

  it("JSON corrupto produce un conjunto vacío", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "esto no es json" });
    const { result } = await montar();
    expect(result.current.favoritos.size).toBe(0);
  });

  it("lista que no es array produce un conjunto vacío", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: '{"no":"es-lista"}' });
    const { result } = await montar();
    expect(result.current.favoritos.size).toBe(0);
  });

  it("filtra elementos que no son números", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: '[1,"2",true,3]' });
    const { result } = await montar();
    await waitFor(() => expect(result.current.favoritos.size).toBe(2));
    expect(result.current.favoritos.has(1)).toBe(true);
    expect(result.current.favoritos.has(3)).toBe(true);
    expect(result.current.favoritos.has(2)).toBe(false);
  });
});

describe("migración visitante → cuenta", () => {
  it("une sin duplicados, guarda la cuenta y vacía la lista del visitante", async () => {
    await sembrarAlmacenamiento({
      [CLAVE_VISITANTE]: "[7,8]",
      [CLAVE_CUENTA]: "[8,9]",
    });

    const { result } = await montar(CORREO);

    await waitFor(() => expect(result.current.favoritos.size).toBe(3));
    expect(result.current.esFavorito(7)).toBe(true);
    expect(result.current.esFavorito(8)).toBe(true);
    expect(result.current.esFavorito(9)).toBe(true);

    await waitFor(async () => {
      expect(await conjuntoGuardado(CLAVE_CUENTA)).toEqual(new Set([7, 8, 9]));
    });
    await waitFor(() =>
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CLAVE_VISITANTE),
    );
    await expect(AsyncStorage.getItem(CLAVE_VISITANTE)).resolves.toBeNull();
  });

  it("no migra si la lista del visitante está vacía", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "[]" });
    const { result } = await montar(CORREO);
    expect(result.current.favoritos.size).toBe(0);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it("no migra si no hay datos del visitante", async () => {
    const { result } = await montar(CORREO);
    expect(result.current.favoritos.size).toBe(0);
    expect(AsyncStorage.removeItem).not.toHaveBeenCalled();
  });

  it("migración con JSON corrupto del visitante no rompe la sesión", async () => {
    await sembrarAlmacenamiento({ [CLAVE_VISITANTE]: "no-json" });
    const { result } = await montar(CORREO);
    // La carga de la cuenta sigue funcionando pese al fallo de migración.
    expect(result.current.favoritos.size).toBe(0);
  });
});

describe("cambio de identidad", () => {
  it("recarga la lista y migra el resto del visitante al iniciar sesión", async () => {
    await sembrarAlmacenamiento({
      [CLAVE_VISITANTE]: "[5]",
      [CLAVE_CUENTA]: "[1,2]",
    });
    const { result, cambiarCorreo } = await montarConCorreo();
    await waitFor(() => expect(result.current.favoritos.has(5)).toBe(true));

    // Inicia sesión: la carga lee la cuenta {1,2} y la migración añade el 5.
    await cambiarCorreo(CORREO);
    await waitFor(() => expect(result.current.favoritos.size).toBe(3));
    expect(result.current.esFavorito(1)).toBe(true);
    expect(result.current.esFavorito(2)).toBe(true);
    expect(result.current.esFavorito(5)).toBe(true);
    await waitFor(() =>
      expect(AsyncStorage.removeItem).toHaveBeenCalledWith(CLAVE_VISITANTE),
    );
  });

  it("vuelve a la lista del visitante al cerrar sesión", async () => {
    await sembrarAlmacenamiento({
      [CLAVE_VISITANTE]: "[5]",
      [CLAVE_CUENTA]: "[1,2]",
    });
    const { result, cambiarCorreo } = await montarConCorreo();
    await waitFor(() => expect(result.current.favoritos.has(5)).toBe(true));

    await cambiarCorreo(CORREO);
    await waitFor(() => expect(result.current.favoritos.size).toBe(3));

    // Cerrar sesión: vuelve a leer la clave del visitante (vacía tras migrar).
    await cambiarCorreo(null);
    await waitFor(() => expect(result.current.favoritos.size).toBe(0));
  });
});
