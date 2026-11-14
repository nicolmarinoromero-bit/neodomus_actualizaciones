// Semana 7 del bootcamp — verificación por código de 6 dígitos.
// Cubre correo ausente, OTP completo/incompleto, errores 429/timeout y el
// reenvío tras el periodo de espera. Red y modal simulados; temporizadores
// controlados solo en la prueba de reenvío.
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock, modalMock } = vi.hoisted(() => ({
  apiMock: { post: vi.fn() },
  modalMock: { email: 'cliente@neodomus.com' as string | null, openAuth: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@contexts/AuthModalContext', () => ({
  useAuthModal: () => modalMock,
  AuthModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import VerifyCode from './VerifyCode';

function montar() {
  return render(
    <IdiomaProvider>
      <VerifyCode />
    </IdiomaProvider>,
  );
}

async function escribirCodigo(codigo: string) {
  const casillas = screen.getAllByPlaceholderText('-');
  for (let i = 0; i < codigo.length; i++) {
    await userEvent.setup().type(casillas[i], codigo[i]);
  }
}

describe('VerifyCode', () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    modalMock.openAuth.mockReset();
    modalMock.email = 'cliente@neodomus.com';
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('sin correo muestra el error y vuelve a recuperar contraseña', async () => {
    // Arrange
    modalMock.email = null;

    // Act
    montar();
    await userEvent.setup().click(screen.getByRole('button', { name: /Volver/i }));

    // Assert
    expect(screen.getByText('Error')).toBeTruthy();
    expect(screen.getByText(/No se proporcionó un correo electrónico válido/i)).toBeTruthy();
    expect(modalMock.openAuth).toHaveBeenCalledWith('recuperar');
  });

  it('muestra el correo, seis casillas y el contador de expiración', () => {
    // Act
    montar();

    // Assert
    expect(screen.getByText('cliente@neodomus.com')).toBeTruthy();
    expect(screen.getAllByPlaceholderText('-')).toHaveLength(6);
    expect(screen.getByText('10:00')).toBeTruthy();
  });

  it('un código incompleto no llega al backend', async () => {
    // Arrange
    montar();
    await escribirCodigo('123');

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /Confirmar código/i }));

    // Assert
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(screen.getByText('Ingresa el código de 6 dígitos')).toBeTruthy();
  });

  it('un código completo pasa al restablecimiento con el token', async () => {
    // Arrange
    apiMock.post.mockResolvedValue({ data: { mensaje: 'ok' } });
    montar();
    await escribirCodigo('123456');

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /Confirmar código/i }));

    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith(
        '/auth/verify-code',
        { email: 'cliente@neodomus.com', code: '123456' },
        { timeout: 15000 },
      ),
    );
    expect(modalMock.openAuth).toHaveBeenCalledWith('restablecer', { token: '123456' });
  });

  it('traduce el 429 por demasiados intentos', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({ response: { status: 429, data: {} } });
    montar();
    await escribirCodigo('000000');

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /Confirmar código/i }));

    // Assert
    expect(await screen.findByText(/Demasiados intentos/i)).toBeTruthy();
  });

  it('traduce el timeout de verificación', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout' });
    montar();
    await escribirCodigo('000000');

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /Confirmar código/i }));

    // Assert
    expect(await screen.findByText(/verificación tardó demasiado/i)).toBeTruthy();
  });

  it('muestra el detalle del backend para un código inválido', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({
      response: { status: 400, data: { detail: 'Código inválido o expirado' } },
    });
    montar();
    await escribirCodigo('999999');

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /Confirmar código/i }));

    // Assert
    expect(await screen.findByText('Código inválido o expirado')).toBeTruthy();
  });

  it('permite reenviar el código cuando termina el periodo de espera', async () => {
    // Arrange
    vi.useFakeTimers();
    apiMock.post.mockResolvedValue({ data: { mensaje: 'ok' } });
    montar();

    // Act: el reenvío está bloqueado durante los primeros 120 s.
    for (let segundo = 0; segundo < 121; segundo++) {
      await act(async () => {
        vi.advanceTimersByTime(1_000);
      });
    }
    fireEvent.click(screen.getByRole('link', { name: /Reenviar código/i }));
    await act(async () => {
      await Promise.resolve();
      await Promise.resolve();
    });

    // Assert
    expect(apiMock.post).toHaveBeenCalledWith(
      '/auth/forgot-password',
      { email: 'cliente@neodomus.com' },
      { timeout: 15000 },
    );
    expect(screen.getByText('10:00')).toBeTruthy();
  });

  it('el enlace de volver al login abre el modal de ingreso', async () => {
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