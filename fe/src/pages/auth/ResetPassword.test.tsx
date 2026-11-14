// Semana 7 del bootcamp — restablecimiento de contraseña con token.
// Cubre enlace inválido, requisitos en vivo, coincidencia, éxito y errores
// 403/429/timeout. Red y modal simulados.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock, modalMock } = vi.hoisted(() => ({
  apiMock: { post: vi.fn() },
  modalMock: { token: 'token-abc' as string | null, openAuth: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@contexts/AuthModalContext', () => ({
  useAuthModal: () => modalMock,
  AuthModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import ResetPassword from './ResetPassword';

const CLAVE = 'Segura1!';
const OTRA = 'Distinta2!';

function montar() {
  return render(
    <IdiomaProvider>
      <ResetPassword />
    </IdiomaProvider>,
  );
}

async function llenar(nueva = CLAVE, confirmar = CLAVE) {
  const usuario = userEvent.setup();
  await usuario.type(screen.getByPlaceholderText('Nueva contraseña'), nueva);
  await usuario.type(screen.getByPlaceholderText('Confirmar contraseña'), confirmar);
  return usuario;
}

describe('ResetPassword', () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    modalMock.openAuth.mockReset();
    modalMock.token = 'token-abc';
  });

  it('sin token muestra el enlace inválido y permite solicitar otro', async () => {
    // Arrange
    modalMock.token = null;

    // Act
    montar();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Solicitar nuevamente' }));

    // Assert
    expect(screen.getByText('Enlace inválido')).toBeTruthy();
    expect(modalMock.openAuth).toHaveBeenCalledWith('recuperar');
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('los requisitos se validan en vivo mientras se escribe', async () => {
    // Arrange
    montar();
    const nueva = screen.getByPlaceholderText('Nueva contraseña');

    // Act: primero una clave incompleta, luego una que cumple todo.
    await userEvent.setup().type(nueva, 'abc');
    expect(document.querySelectorAll('.password-requirements li.valid')).toHaveLength(1);
    await userEvent.setup().clear(nueva);
    await userEvent.setup().type(nueva, CLAVE);

    // Assert: los cinco requisitos quedan marcados y el botón se habilita.
    expect(document.querySelectorAll('.password-requirements li.valid')).toHaveLength(5);
    expect((screen.getByRole('button', { name: 'Restablecer contraseña' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('con contraseñas distintas no llama al backend', async () => {
    // Arrange
    montar();
    const usuario = await llenar(CLAVE, OTRA);

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    // Assert
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(screen.getByText('Las contraseñas no coinciden')).toBeTruthy();
  });

  it('envía el token y la nueva contraseña y abre el login', async () => {
    // Arrange
    apiMock.post.mockResolvedValue({ data: { mensaje: 'ok' } });
    montar();
    const usuario = await llenar();

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith(
        '/auth/reset-password',
        { token: 'token-abc', new_password: CLAVE },
        { timeout: 15000 },
      ),
    );
    expect(modalMock.openAuth).toHaveBeenCalledWith('ingresar');
  });

  it('traduce el 403 por cambio de IP', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({ response: { status: 403, data: {} } });
    montar();
    const usuario = await llenar();

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    // Assert
    expect(await screen.findByText(/otra IP/i)).toBeTruthy();
    expect(modalMock.openAuth).not.toHaveBeenCalled();
  });

  it('traduce el 429 por demasiadas solicitudes', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({ response: { status: 429, data: {} } });
    montar();
    const usuario = await llenar();

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    // Assert
    expect(await screen.findByText(/Demasiadas solicitudes/i)).toBeTruthy();
  });

  it('traduce el timeout de la petición', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' });
    montar();
    const usuario = await llenar();

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    // Assert
    expect(await screen.findByText(/demasiado/i)).toBeTruthy();
  });

  it('muestra el detalle devuelto por el backend', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({
      response: { status: 400, data: { detail: 'El token ya fue utilizado' } },
    });
    montar();
    const usuario = await llenar();

    // Act
    await usuario.click(screen.getByRole('button', { name: 'Restablecer contraseña' }));

    // Assert
    expect(await screen.findByText('El token ya fue utilizado')).toBeTruthy();
  });
});