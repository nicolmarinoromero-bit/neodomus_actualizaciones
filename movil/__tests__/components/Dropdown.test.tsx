// ─────────────────────────────────────────────────────────────
// Tests de Dropdown: placeholder, etiqueta, apertura del modal,
// selección y cierre tras elegir.
// ─────────────────────────────────────────────────────────────

import { act, fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import Dropdown from "@/components/ui/Dropdown";

const OPCIONES = [
  { label: "Cédula", value: "cc" },
  { label: "Pasaporte", value: "pp" },
];

const asentar = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

async function montar(props: Partial<React.ComponentProps<typeof Dropdown>> = {}) {
  const onChange = jest.fn();
  await render(
    <Dropdown
      value={null}
      placeholder="Tipo de documento"
      options={OPCIONES}
      onChange={onChange}
      {...props}
    />,
  );
  return onChange;
}

it("muestra el placeholder cuando no hay selección", async () => {
  await montar();
  expect(screen.getByText("Tipo de documento")).toBeTruthy();
});

it("muestra la etiqueta cuando se proporciona", async () => {
  await montar({ label: "Documento" });
  expect(screen.getByText("Documento")).toBeTruthy();
});

it("muestra la etiqueta de la opción seleccionada", async () => {
  await montar({ value: "pp" });
  expect(screen.getByText("Pasaporte")).toBeTruthy();
  expect(screen.queryByText("Tipo de documento")).toBeNull();
});

it("al abrir muestra todas las opciones", async () => {
  await montar();
  fireEvent.press(screen.getByText("Tipo de documento"));
  await waitFor(() => expect(screen.getByText("Pasaporte")).toBeTruthy());
  expect(screen.getByText("Cédula")).toBeTruthy();
});

it("seleccionar una opción notifica el valor y cierra el modal", async () => {
  const onChange = await montar();
  fireEvent.press(screen.getByText("Tipo de documento"));
  await waitFor(() => expect(screen.getByText("Pasaporte")).toBeTruthy());

  fireEvent.press(screen.getByText("Pasaporte"));
  expect(onChange).toHaveBeenCalledWith("pp");
  await waitFor(() => expect(screen.queryByText("Pasaporte")).toBeNull());
});

it("elegir la misma opción ya activa también notifica", async () => {
  const onChange = await montar({ value: "cc" });
  fireEvent.press(screen.getByText("Cédula"));
  await waitFor(() => expect(screen.getByText("Pasaporte")).toBeTruthy());

  // "Cédula" aparece dos veces (selector + opción del modal): la opción
  // del modal es la última en el árbol.
  const opcionModal = screen.getAllByText("Cédula").at(-1);
  if (!opcionModal) throw new Error("No se encontró la opción del modal");
  fireEvent.press(opcionModal);
  expect(onChange).toHaveBeenCalledWith("cc");
  await waitFor(() => expect(screen.queryByText("Pasaporte")).toBeNull());
});
