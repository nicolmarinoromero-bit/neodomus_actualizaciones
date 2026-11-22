import React from "react";
import { fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("@/components/app/AppScreen", () => ({
  __esModule: true,
  default: ({ children }: { children: React.ReactNode }) => children,
}));

import PantallaAcceso from "@/components/app/PantallaAcceso";

it("muestra el acceso y ejecuta la acción de iniciar sesión", async () => {
  const onIniciarSesion = jest.fn();
  await render(
    <PantallaAcceso
      titulo="Carrito"
      tituloAcceso="Inicia sesión para continuar"
      mensaje="Accede con tu cuenta."
      onIniciarSesion={onIniciarSesion}
    />,
  );

  expect(screen.getByText("Inicia sesión para continuar")).toBeTruthy();
  expect(screen.queryByText("Crear cuenta")).toBeNull();
  fireEvent.press(screen.getByText("Iniciar sesión"));
  expect(onIniciarSesion).toHaveBeenCalledTimes(1);
});

it("muestra y ejecuta la acción opcional de crear cuenta", async () => {
  const onCrearCuenta = jest.fn();
  await render(
    <PantallaAcceso
      titulo="Carrito"
      tituloAcceso="Inicia sesión para continuar"
      mensaje="Accede con tu cuenta."
      onIniciarSesion={jest.fn()}
      onCrearCuenta={onCrearCuenta}
    />,
  );

  fireEvent.press(screen.getByText("Crear cuenta"));
  expect(onCrearCuenta).toHaveBeenCalledTimes(1);
});
