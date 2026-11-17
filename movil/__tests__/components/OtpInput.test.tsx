// ─────────────────────────────────────────────────────────────
// Tests de OtpInput: solo dígitos, auto-avance, pegado del código
// completo en la primera caja y borrado inteligente.
//
// Las cajas se localizan por su valor mostrado (getByDisplayValue):
// la primera caja vacía es la próxima casilla libre.
// ─────────────────────────────────────────────────────────────

import { fireEvent, render, screen } from "@testing-library/react-native";
import React from "react";
import OtpInput from "@/components/ui/OtpInput";

type Props = React.ComponentProps<typeof OtpInput>;

const cajasVacias = () => screen.getAllByDisplayValue("");
const primeraVacia = () => cajasVacias()[0];

async function montar(props: Partial<Props> = {}) {
  const onChange = jest.fn();
  await render(<OtpInput valor="" onChange={onChange} {...props} />);
  return onChange;
}

it("renderiza seis cajas vacías por defecto", async () => {
  await montar();
  expect(screen.getAllByDisplayValue("")).toHaveLength(6);
});

it("un dígito en la primera caja llama a onChange con ese dígito", async () => {
  const onChange = await montar();
  fireEvent.changeText(primeraVacia(), "5");
  expect(onChange).toHaveBeenLastCalledWith("5");
});

it("respeta una longitud personalizada", async () => {
  const onChange = jest.fn();
  await render(<OtpInput valor="" onChange={onChange} longitud={4} />);
  expect(screen.getAllByDisplayValue("")).toHaveLength(4);
});

it("pegar el código completo en la primera caja lo entrega entero", async () => {
  const onChange = await montar();
  fireEvent.changeText(primeraVacia(), "123456");
  expect(onChange).toHaveBeenLastCalledWith("123456");
});

it("pegar un código más largo que la longitud lo recorta", async () => {
  const onChange = await montar();
  fireEvent.changeText(primeraVacia(), "1234567890");
  expect(onChange).toHaveBeenLastCalledWith("123456");
});

it("el pegado con letras solo conserva dígitos", async () => {
  const onChange = await montar();
  fireEvent.changeText(primeraVacia(), "1a2b3c4d");
  expect(onChange).toHaveBeenLastCalledWith("1234");
});

it("en una caja intermedia, escribir varios caracteres toma el último", async () => {
  const onChange = jest.fn();
  await render(<OtpInput valor="12" onChange={onChange} />);
  // "12" ocupa las dos primeras cajas; la primera vacía es la tercera.
  fireEvent.changeText(primeraVacia(), "99");
  expect(onChange).toHaveBeenLastCalledWith("129");
});

it("borrar el contenido de una caja llena la deja vacía", async () => {
  const onChange = jest.fn();
  await render(<OtpInput valor="12" onChange={onChange} />);
  fireEvent.changeText(screen.getByDisplayValue("2"), "");
  expect(onChange).toHaveBeenLastCalledWith("1");
});

it("backspace en caja vacía borra el dígito anterior", async () => {
  const onChange = jest.fn();
  await render(<OtpInput valor="1" onChange={onChange} />);
  // Con valor "1", la primera caja vacía es la segunda.
  fireEvent(primeraVacia(), "keyPress", { nativeEvent: { key: "Backspace" } });
  expect(onChange).toHaveBeenLastCalledWith("");
});

it("backspace en caja llena no borra el vecino", async () => {
  const onChange = jest.fn();
  await render(<OtpInput valor="12" onChange={onChange} />);
  fireEvent(screen.getByDisplayValue("1"), "keyPress", { nativeEvent: { key: "Backspace" } });
  expect(onChange).not.toHaveBeenCalled();
});

it("backspace en la primera caja vacía no hace nada", async () => {
  const onChange = await montar();
  fireEvent(primeraVacia(), "keyPress", { nativeEvent: { key: "Backspace" } });
  expect(onChange).not.toHaveBeenCalled();
});

it("deshabilitado: las cajas no aceptan entrada", async () => {
  const onChange = jest.fn();
  await render(<OtpInput valor="" onChange={onChange} deshabilitado />);
  expect(primeraVacia().props.editable).toBe(false);
  fireEvent.changeText(primeraVacia(), "5");
  expect(onChange).not.toHaveBeenCalled();
});

it("el valor existente se reparte entre las cajas", async () => {
  await render(<OtpInput valor="123456" onChange={jest.fn()} />);
  for (const digito of "123456") {
    expect(screen.getByDisplayValue(digito)).toBeTruthy();
  }
});
