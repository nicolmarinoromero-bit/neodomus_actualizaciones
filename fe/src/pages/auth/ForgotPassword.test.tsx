// Semana 8 del bootcamp — recuperación de contraseña (ForgotPassword).
// Cubre validación, éxito, timeout, rate limit, errores del backend, fallo de
// red, estado de envío y navegación al login. Red y modal simulados.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock, modalMock } = vi.hoisted(() => ({
  apiMock: { post: vi.fn() },
  modalMock: { openAuth: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@contexts/AuthModalContext', () => ({
  useAuthModal: () => modalMock,
}));

import ForgotPassword from './ForgotPassword';

const CORREO = 'cliente@neodomus.com';

function montar() {
  return render(
    <IdiomaProvider>
      <ForgotPassword />
    </IdiomaProvider>,
  );
}

async function enviar(correo = CORREO) {
  const usuario = userEvent.setup();
  await usuario.type(screen.getByPlaceholderText('Tu correo electrónico'), correo);
  await usuario.click(screen.getByRole('button', { name: /Enviar código/i }));
  return usuario;
}

describe('ForgotPassword', () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    modalMock.openAuth.mockReset();
  });

  it('un correo inválido no llama al backend', async () => {
    // Arrange
    montar();
    const correo = screen.getByPlaceholderText('Tu correo electrónico');
    await userEvent.setup().type(correo, 'no-es-correo');

    // Act: se envía el formulario saltando la validación nativa del navegador
    // (la validación propia del componente es la que se prueba).
    fireEvent.submit(correo.closest('form') as HTMLFormElement);

    // Assert
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(screen.getByText('Correo electrónico inválido')).toBeTruthy();
  });

  it('normaliza el correo y avanza a la verificación', async () => {
    // Arrange
    apiMock.post.mockResolvedValue({ data: {} });
    montar();

    // Act
    await enviar('  Cliente@Neodomus.com  ');

    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith(
        '/auth/forgot-password',
        { email: CORREO },
        { timeout: 15000 },
      ),
    );
    expect(modalMock.openAuth).toHaveBeenCalledWith('verificar-codigo', { email: CORREO });
  });

  it('durante el envío deshabilita el botón y muestra Enviando...', async () => {
    // Arrange
    let resolver: (valor: unknown) => void = () => {};
    apiMock.post.mockReturnValue(new Promise((resolve) => { resolver = resolve; }));
    montar();

    // Act
    await enviar();

    // Assert
    const boton = screen.getByRole('button', { name: /Enviando/i }) as HTMLButtonElement;
    expect(boton.disabled).toBe(true);
    expect((screen.getByPlaceholderText('Tu correo electrónico') as HTMLInputElement).disabled).toBe(true);

    resolver({ data: {} });
    await waitFor(() => expect(modalMock.openAuth).toHaveBeenCalled());
  });

  it('traduce el timeout de la petición', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 15000ms' });
    montar();

    // Act
    await enviar();

    // Assert
    expect(await screen.findByText(/tardó demasiado/i)).toBeTruthy();
    expect(modalMock.openAuth).not.toHaveBeenCalled();
  });

  it('traduce el 429 por demasiadas solicitudes', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({ response: { status: 429, data: {} } });
    montar();

    // Act
    await enviar();

    // Assert
    expect(await screen.findByText(/Demasiadas solicitudes/i)).toBeTruthy();
  });

  it('muestra el detalle del backend cuando es texto', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({
      response: { status: 400, data: { detail: 'Correo bloqueado' } },
    });
    montar();

    // Act
    await enviar();

    // Assert
    expect(await screen.findByText('Correo bloqueado')).toBeTruthy();
  });

  it('un detalle no textual usa el mensaje genérico de envío', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({
      response: { status: 400, data: { detail: [{ msg: 'dato inválido' }] } },
    });
    montar();

    // Act
    await enviar();

    // Assert
    expect(await screen.findByText('Error al enviar la solicitud')).toBeTruthy();
  });

  it('sin respuesta del servidor informa el problema de conexión', async () => {
    // Arrange
    apiMock.post.mockRejectedValue(new Error('Network Error'));
    montar();

    // Act
    await enviar();

    // Assert
    expect(await screen.findByText(/conexión/i)).toBeTruthy();
  });

  it('un error con respuesta sin detalle usa el mensaje general', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({ response: { status: 500, data: {} } });
    montar();

    // Act
    await enviar();

    // Assert
    expect(await screen.findByText(/No fue posible enviar el código/i)).toBeTruthy();
  });

  it('el enlace de volver abre el modal de ingreso', async () => {
    // Arrange
    montar();

    // Act
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Volver al inicio de sesión/i }),
    );

    // Assert
    expect(modalMock.openAuth).toHaveBeenCalledWith('ingresar');
  });
});