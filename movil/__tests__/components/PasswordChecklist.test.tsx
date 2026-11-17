// ─────────────────────────────────────────────────────────────
// Tests de PasswordChecklist: título + 5 requisitos con estado
// visual según los flags recibidos.
// ─────────────────────────────────────────────────────────────

import { render, screen } from "@testing-library/react-native";
import React from "react";
import PasswordChecklist from "@/components/auth/PasswordChecklist";

it("muestra el título y los cinco requisitos", async () => {
  await render(
    <PasswordChecklist
      requisitos={{
        length: false,
        uppercase: false,
        lowercase: false,
        number: false,
        special: false,
      }}
    />,
  );

  expect(screen.getByText("La contraseña debe contener:")).toBeTruthy();
  expect(screen.getByText("8+ caracteres")).toBeTruthy();
  expect(screen.getByText("Una mayúscula")).toBeTruthy();
  expect(screen.getByText("Una minúscula")).toBeTruthy();
  expect(screen.getByText("Un número")).toBeTruthy();
  expect(screen.getByText("Carácter especial")).toBeTruthy();
});

it("mantiene los mismos textos con todos los requisitos cumplidos", async () => {
  await render(
    <PasswordChecklist
      requisitos={{
        length: true,
        uppercase: true,
        lowercase: true,
        number: true,
        special: true,
      }}
    />,
  );

  expect(screen.getByText("8+ caracteres")).toBeTruthy();
  expect(screen.getByText("Carácter especial")).toBeTruthy();
});

it("renderiza un requisito mixto sin errores", async () => {
  await render(
    <PasswordChecklist
      requisitos={{
        length: true,
        uppercase: false,
        lowercase: true,
        number: false,
        special: true,
      }}
    />,
  );

  expect(screen.getByText("Una mayúscula")).toBeTruthy();
});
