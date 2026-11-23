import React from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react-native";

jest.mock("@/contexts/AuthContext", () => ({ useAuth: jest.fn() }));
jest.mock("@/contexts/IdiomaContext", () => ({
  useIdioma: () => ({ t: (clave: string) => clave }),
}));
jest.mock("@/services/contacto.service", () => ({ enviarConsulta: jest.fn() }));

import FormularioContacto from "@/components/public/FormularioContacto";
import { useAuth } from "@/contexts/AuthContext";
import { enviarConsulta } from "@/services/contacto.service";

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;
const enviarConsultaMock = enviarConsulta as jest.MockedFunction<typeof enviarConsulta>;

async function montar(alEnviado = jest.fn()) {
  useAuthMock.mockReturnValue({ usuario: null } as unknown as ReturnType<typeof useAuth>);
  await render(<FormularioContacto alEnviado={alEnviado} />);
  return alEnviado;
}

async function completarCampos(email = "ana@example.com") {
  await fireEvent.changeText(screen.getByPlaceholderText("form.nombrePlaceholder"), " Ana Pérez ");
  await fireEvent.changeText(screen.getByPlaceholderText("form.emailPlaceholder"), email);
  await fireEvent.changeText(screen.getByPlaceholderText("form.mensajePlaceholder"), " Necesito ayuda ");
}

beforeEach(() => {
  jest.clearAllMocks();
});

it("valida campos vacíos, correo inválido y categoría faltante", async () => {
  const alEnviado = await montar();
  const enviar = screen.getByText("publico.enviarConsulta");

  await fireEvent.press(enviar);
  expect(alEnviado).toHaveBeenLastCalledWith("form.completaCampos", "error");

  await completarCampos("correo-invalido");
  await fireEvent.press(enviar);
  expect(alEnviado).toHaveBeenLastCalledWith("form.emailInvalido", "error");

  await completarCampos();
  await fireEvent.press(enviar);
  expect(alEnviado).toHaveBeenLastCalledWith("form.seleccionaCategoria", "error");
  expect(enviarConsultaMock).not.toHaveBeenCalled();
});

it("envía los datos normalizados y limpia el mensaje tras el éxito", async () => {
  enviarConsultaMock.mockResolvedValue({ msg: "ok", id: 1 });
  const alEnviado = await montar();
  await completarCampos();
  await fireEvent.press(screen.getByText("form.opcion.pedido"));
  await fireEvent.press(screen.getByText("publico.enviarConsulta"));

  await waitFor(() => {
    expect(enviarConsultaMock).toHaveBeenCalledWith({
      nombre: "Ana Pérez",
      email: "ana@example.com",
      asunto: "Pedido",
      mensaje: "Necesito ayuda",
      categoria: "pedido",
    });
  });
  expect(alEnviado).toHaveBeenLastCalledWith("form.exito", "success");
  await waitFor(() =>
    expect(screen.getByPlaceholderText("form.mensajePlaceholder").props.value).toBe(""),
  );
});

it("informa cuando el servicio de contacto falla", async () => {
  enviarConsultaMock.mockRejectedValue(new Error("offline"));
  const alEnviado = await montar();
  await completarCampos();
  await fireEvent.press(screen.getByText("form.opcion.consultaGeneral"));
  await fireEvent.press(screen.getByText("publico.enviarConsulta"));

  await waitFor(() =>
    expect(alEnviado).toHaveBeenLastCalledWith("form.errorEnvio", "error"),
  );
});
