// ─────────────────────────────────────────────────────────────
// Tests de useScrollTopAlEntrar: al ganar foco, la lista debe
// volver al inicio (y=0). Soporta FlatList (scrollToOffset),
// ScrollView (scrollTo, ambas firmas) y ref nativo envuelto.
//
// expo-router se sustituye por un doble que captura el callback de
// foco para poder dispararlo manualmente en cada caso.
// ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => ({
  useFocusEffect: jest.fn(),
}));

import { act, renderHook } from "@testing-library/react-native";
import { useFocusEffect } from "expo-router";
import { useScrollTopAlEntrar } from "@/hooks/useScrollTopAlEntrar";

const useFocusEffectMock = useFocusEffect as jest.MockedFunction<typeof useFocusEffect>;

// Doble rAF (dos frames anidados con setTimeout en el setup) → dos
// macrotareas bastan para que el scroll intente ejecutarse.
const pasarFrames = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
    await new Promise((r) => setTimeout(r, 0));
  });
};

function dispararFoco() {
  const callback = useFocusEffectMock.mock.calls.at(-1)?.[0];
  if (!callback) throw new Error("useFocusEffect no recibió callback");
  return callback;
}

beforeEach(() => {
  useFocusEffectMock.mockClear();
});

it("llama a useFocusEffect exactamente con el callback de foco", async () => {
  const ref = { current: null };
  await renderHook(() => useScrollTopAlEntrar(ref));
  expect(useFocusEffectMock).toHaveBeenCalledTimes(1);
});

it("FlatList: hace scroll al inicio con scrollToOffset", async () => {
  const lista = {
    scrollToOffset: jest.fn(),
    scrollTo: jest.fn(),
  };
  const ref = { current: lista };
  await renderHook(() => useScrollTopAlEntrar(ref));

  await act(async () => {
    dispararFoco()();
  });
  await pasarFrames();

  expect(lista.scrollToOffset).toHaveBeenCalledWith({ offset: 0, animated: false });
  expect(lista.scrollTo).not.toHaveBeenCalled();
});

it("ScrollView: hace scroll con ambas firmas de scrollTo", async () => {
  const vista = { scrollTo: jest.fn() };
  const ref = { current: vista };
  await renderHook(() => useScrollTopAlEntrar(ref));

  await act(async () => {
    dispararFoco()();
  });
  await pasarFrames();

  expect(vista.scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
  expect(vista.scrollTo).toHaveBeenCalledWith({ x: 0, y: 0, animated: false });
});

it("lista envuelta: usa el ref nativo expuesto por getNativeScrollRef", async () => {
  const envuelta = {
    getNativeScrollRef: jest.fn(() => ({ scrollTo: jest.fn() })),
  };
  const ref = { current: envuelta };
  await renderHook(() => useScrollTopAlEntrar(ref));

  await act(async () => {
    dispararFoco()();
  });
  await pasarFrames();

  expect(envuelta.getNativeScrollRef).toHaveBeenCalled();
});

it("si scrollToOffset lanza, usa scrollTo como respaldo", async () => {
  const rota = {
    scrollToOffset: jest.fn(() => {
      throw new Error("boom");
    }),
    scrollTo: jest.fn(),
  };
  const ref = { current: rota };
  await renderHook(() => useScrollTopAlEntrar(ref));

  await act(async () => {
    dispararFoco()();
  });
  await pasarFrames();

  expect(rota.scrollTo).toHaveBeenCalledWith({ y: 0, animated: false });
});

it("componente sin métodos de scroll no lanza error", async () => {
  const ref = { current: { hola: "mundo" } };
  await renderHook(() => useScrollTopAlEntrar(ref));

  await act(async () => {
    dispararFoco()();
  });
  await pasarFrames();
});

it("ref vacío no lanza error", async () => {
  const ref: { current: unknown } = { current: null };
  await renderHook(() => useScrollTopAlEntrar(ref));

  await act(async () => {
    dispararFoco()();
  });
  await pasarFrames();
});

it("ref nativo sin scrollTo ni scrollToOffset no lanza error", async () => {
  const envuelta = {
    getNativeScrollRef: jest.fn(() => ({ otroMetodo: jest.fn() })),
  };
  const ref = { current: envuelta };
  await renderHook(() => useScrollTopAlEntrar(ref));

  await act(async () => {
    dispararFoco()();
  });
  await pasarFrames();
});
