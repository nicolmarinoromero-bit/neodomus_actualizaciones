// ─────────────────────────────────────────────────────────────
// Tests de PasswordInput: toggle de visibilidad dentro del campo,
// modo controlado (compartido en registro) y modo editable.
// ─────────────────────────────────────────────────────────────

import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";
import React from "react";
import PasswordInput from "@/components/auth/PasswordInput";

it("muestra el placeholder y oculta la contraseña al inicio", async () => {
  await render(
    <PasswordInput placeholder="Contraseña" value="secreta" onChangeText={jest.fn()} />,
  );

  const input = screen.getByPlaceholderText("Contraseña");
  expect(input.props.secureTextEntry).toBe(true);
});

it("sin modo controlado, el ojo alterna la visibilidad internamente", async () => {
  await render(
    <PasswordInput placeholder="Contraseña" value="secreta" onChangeText={jest.fn()} />,
  );
  expect(screen.getByPlaceholderText("Contraseña").props.secureTextEntry).toBe(true);

  fireEvent.press(screen.getByLabelText("Mostrar contraseña"));
  await waitFor(() =>
    expect(screen.getByPlaceholderText("Contraseña").props.secureTextEntry).toBe(false),
  );
  expect(screen.getByLabelText("Ocultar contraseña")).toBeTruthy();

  fireEvent.press(screen.getByLabelText("Ocultar contraseña"));
  await waitFor(() =>
    expect(screen.getByPlaceholderText("Contraseña").props.secureTextEntry).toBe(true),
  );
});

it("en modo controlado delega el toggle en el padre", async () => {
  const onToggleVisible = jest.fn();
  await render(
    <PasswordInput
      placeholder="Contraseña"
      value="secreta"
      onChangeText={jest.fn()}
      visible={false}
      onToggleVisible={onToggleVisible}
    />,
  );

  fireEvent.press(screen.getByLabelText("Mostrar contraseña"));
  expect(onToggleVisible).toHaveBeenCalledTimes(1);
});

it("en modo controlado respeta la visibilidad externa", async () => {
  await render(
    <PasswordInput
      placeholder="Contraseña"
      value="secreta"
      onChangeText={jest.fn()}
      visible
      onToggleVisible={jest.fn()}
    />,
  );

  expect(screen.getByPlaceholderText("Contraseña").props.secureTextEntry).toBe(false);
});

it("notifica los cambios de texto al padre", async () => {
  const onChangeText = jest.fn();
  await render(
    <PasswordInput placeholder="Contraseña" value="" onChangeText={onChangeText} />,
  );

  fireEvent.changeText(screen.getByPlaceholderText("Contraseña"), "nueva");
  expect(onChangeText).toHaveBeenCalledWith("nueva");
});

it("no editable: el ojo queda deshabilitado", async () => {
  await render(
    <PasswordInput
      placeholder="Contraseña"
      value="secreta"
      onChangeText={jest.fn()}
      editable={false}
    />,
  );

  expect(
    screen.getByRole("button", { name: "Mostrar contraseña", disabled: true }),
  ).toBeTruthy();
});

it("no editable: el TextInput queda deshabilitado", async () => {
  await render(
    <PasswordInput
      placeholder="Contraseña"
      value="secreta"
      onChangeText={jest.fn()}
      editable={false}
    />,
  );

  expect(screen.getByPlaceholderText("Contraseña").props.editable).toBe(false);
});
