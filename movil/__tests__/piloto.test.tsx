// Prueba piloto: valida que el ambiente jest-expo + RNTL 14 (API async) funciona.

import { render, screen, fireEvent } from "@testing-library/react-native";
import { Pressable, Text } from "react-native";
import { esEmailValido } from "@/utils/validaciones";

describe("ambiente de pruebas", () => {
  it("renderiza un Text nativo", async () => {
    await render(<Text>Hola NeoDomus</Text>);
    expect(screen.getByText("Hola NeoDomus")).toBeTruthy();
  });

  it("dispara eventos con fireEvent async", async () => {
    const onPress = jest.fn();
    await render(
      <Pressable onPress={onPress}>
        <Text>Botón</Text>
      </Pressable>,
    );
    await fireEvent.press(screen.getByText("Botón"));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it("resuelve el alias @/", () => {
    expect(esEmailValido("a@b.co")).toBe(true);
  });
});
