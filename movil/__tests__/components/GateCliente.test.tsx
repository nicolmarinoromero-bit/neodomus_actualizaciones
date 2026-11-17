// ─────────────────────────────────────────────────────────────
// Tests de GateCliente: protección real de rutas de cliente.
//
// - cargando → null (evita parpadeos al restaurar sesión).
// - visitante o no-cliente → pantalla "Inicia sesión para continuar"
//   con botones que navegan a /login y /registro.
// - cliente autenticado → children.
//
// useAuth se sustituye por un doble controlable (igual que en los
// tests de CartContext); el idioma usa el IdiomaProvider real porque
// la barra pública traduce sus etiquetas; safe-area usa el mock
// oficial del paquete; expo-router devuelve funciones de navegación
// estables para poder asertar sobre ellas.
// ─────────────────────────────────────────────────────────────

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

jest.mock("expo-router", () => {
  const push = jest.fn();
  const back = jest.fn();
  const navigate = jest.fn();
  return {
    useRouter: () => ({ push, back, navigate }),
    useFocusEffect: jest.fn(),
    router: { push, navigate },
  };
});

jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default,
);

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import { Text } from "react-native";
import { useRouter } from "expo-router";
import GateCliente from "@/components/app/GateCliente";
import { IdiomaProvider } from "@/contexts/IdiomaContext";
import { useAuth } from "@/contexts/AuthContext";

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;
const { push } = useRouter() as unknown as { push: jest.Mock };

// Solo los campos que GateCliente consume del contexto.
type EstadoSonda = Pick<
  ReturnType<typeof useAuth>,
  "cargando" | "autenticado" | "userType"
>;

async function montar(estado: EstadoSonda) {
  useAuthMock.mockReturnValue(estado as unknown as ReturnType<typeof useAuth>);
  await render(
    <IdiomaProvider>
      <GateCliente titulo="Mis pedidos">
        <Text>CONTENIDO-CLIENTE</Text>
      </GateCliente>
    </IdiomaProvider>,
  );
}

beforeEach(() => {
  useAuthMock.mockReset();
  push.mockClear();
});

it("mientras se restaura la sesión no renderiza nada", async () => {
  await montar({ cargando: true, autenticado: false, userType: null });
  expect(screen.queryByText("Inicia sesión para continuar")).toBeNull();
  expect(screen.queryByText("CONTENIDO-CLIENTE")).toBeNull();
});

it("visitante ve la pantalla de acceso con ambos botones", async () => {
  await montar({ cargando: false, autenticado: false, userType: null });

  expect(screen.getByText("Inicia sesión para continuar")).toBeTruthy();
  expect(
    screen.getByText(
      "Mis pedidos es una sección para usuarios con cuenta Neodomus verificada. Inicia sesión o crea tu cuenta para acceder.",
    ),
  ).toBeTruthy();
  // "Iniciar sesión" también lo muestra la barra pública (2 veces); el
  // del gate es el último en el árbol.
  expect(screen.getAllByText("Iniciar sesión")).toHaveLength(3);
  expect(screen.getByText("Crear cuenta")).toBeTruthy();
  expect(screen.queryByText("CONTENIDO-CLIENTE")).toBeNull();
});

it("el botón de iniciar sesión navega a /login", async () => {
  await montar({ cargando: false, autenticado: false, userType: null });

  const botonIniciar = screen.getAllByText("Iniciar sesión").at(-1);
  if (!botonIniciar) throw new Error("No se encontró el botón de iniciar sesión");
  fireEvent.press(botonIniciar);
  expect(push).toHaveBeenCalledWith("/login");
});

it("el botón de crear cuenta navega a /registro", async () => {
  await montar({ cargando: false, autenticado: false, userType: null });

  fireEvent.press(screen.getByText("Crear cuenta"));
  expect(push).toHaveBeenCalledWith("/registro");
});

it("usuario autenticado que no es cliente también ve la pantalla de acceso", async () => {
  await montar({ cargando: false, autenticado: true, userType: "employee" });

  expect(screen.getByText("Inicia sesión para continuar")).toBeTruthy();
  expect(screen.queryByText("CONTENIDO-CLIENTE")).toBeNull();
});

it("cliente autenticado ve el contenido protegido", async () => {
  await montar({ cargando: false, autenticado: true, userType: "client" });

  expect(screen.getByText("CONTENIDO-CLIENTE")).toBeTruthy();
  expect(screen.queryAllByText("Iniciar sesión")).toHaveLength(0);
});