// Semana 7 del bootcamp — verificación del cambio de correo (CampoEmail).
// Cubre el flujo completo: edición, validación, solicitud de código,
// verificación, error de código y cancelación. Red simulada.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));

import CampoEmail from './CampoEmail';

const VALOR = 'actual@neodomus.com';
const NUEVO = 'nuevo@neodomus.com';

function montar(overrides: Record<string, unknown> = {}) {
  const notificar = vi.fn();
  const onVerificado = vi.fn();
  const onCambio = vi.fn();
  const props = {
    label: 'Correo',
    valor: VALOR,
    emailOriginal: VALOR,
    notificar,
    onVerificado,
    onCambio,
    ...overrides,
  };
  render(
    <IdiomaProvider>
      <CampoEmail {...(props as any)} />
    </IdiomaProvider>,
  );
  return { notificar, onVerificado, onCambio };
}

const abrirEdicion = async () => {
  await userEvent.setup().click(screen.getByRole('button', { name: /Editar Correo/i }));
};

const solicitarCodigo = async () => {
  const input = screen.getByDisplayValue(VALOR) as HTMLInputElement;
  await userEvent.setup().clear(input);
  await userEvent.setup().type(input, NUEVO);
  await userEvent.setup().click(
    screen.getByRole('button', { name: /Solicitar código de verificación/i }),
  );
};

describe('CampoEmail', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
  });

  it('muestra el correo actual y permite entrar en edición', async () => {
    // Arrange / Act
    montar();
    expect(screen.getByText(VALOR)).toBeTruthy();
    await abrirEdicion();

    // Assert: el borrador arranca con el valor actual y se ofrece el hint.
    expect((screen.getByDisplayValue(VALOR) as HTMLInputElement).type).toBe('email');
    expect(screen.getByText(/Has modificado tu correo/i)).toBeTruthy();
  });

  it('un correo inválido no solicita el código', async () => {
    // Arrange
    const { notificar } = montar();
    await abrirEdicion();
    const input = screen.getByDisplayValue(VALOR) as HTMLInputElement;
    await userEvent.setup().clear(input);
    await userEvent.setup().type(input, 'no-es-un-correo');

    // Act
    await userEvent.setup().click(
      screen.getByRole('button', { name: /Solicitar código de verificación/i }),
    );

    // Assert
    expect(apiMock.post).not.toHaveBeenCalled();
    expect(notificar).toHaveBeenCalledWith(
      'No se pudo enviar el código de verificación',
      'error',
    );
  });

  it('solicita el código al correo actual y muestra el paso de verificación', async () => {
    // Arrange
    const { notificar, onCambio } = montar();
    apiMock.post.mockResolvedValue({ data: { mensaje: 'ok' } });
    await abrirEdicion();

    // Act
    await solicitarCodigo();

    // Assert: se envía el correo nuevo y se enmascara el correo actual.
    expect(onCambio).toHaveBeenCalledWith(NUEVO);
    expect(apiMock.post).toHaveBeenCalledWith('/auth/request-email-change', {
      nuevo_email: NUEVO,
    });
    expect(await screen.findByText('act****@neodomus.com')).toBeTruthy();
    expect(notificar).toHaveBeenCalledWith(
      'Código enviado a tu correo actual. Revisa tu bandeja de entrada.',
      'info',
    );
    const reenviar = screen.getByRole('button', { name: /Reenviar código \(30s\)/i });
    expect((reenviar as HTMLButtonElement).disabled).toBe(true);
  });

  it('un código incompleto no llega al backend', async () => {
    // Arrange
    const { notificar } = montar();
    apiMock.post.mockResolvedValue({ data: {} });
    await abrirEdicion();
    await solicitarCodigo();
    await screen.findByText('act****@neodomus.com');

    // Act
    await userEvent.setup().type(
      screen.getByLabelText('Código de verificación'),
      '123',
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Verificar código' }));

    // Assert
    expect(apiMock.post).toHaveBeenCalledTimes(1); // solo la solicitud
    expect(notificar).toHaveBeenCalledWith('Ingresa el código de 6 dígitos', 'error');
  });

  it('verifica el código, aplica el cambio y permite aceptar', async () => {
    // Arrange
    const { onVerificado, notificar } = montar();
    apiMock.post.mockResolvedValueOnce({ data: {} }).mockResolvedValueOnce({ data: {} });
    await abrirEdicion();
    await solicitarCodigo();
    await screen.findByText('act****@neodomus.com');

    // Act
    await userEvent.setup().type(
      screen.getByLabelText('Código de verificación'),
      '123456',
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Verificar código' }));

    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenLastCalledWith('/auth/verify-email-change', {
        code: '123456',
        nuevo_email: NUEVO,
      }),
    );
    expect(onVerificado).toHaveBeenCalledWith(NUEVO);
    expect(notificar).toHaveBeenCalledWith('Correo verificado y actualizado correctamente', 'success');
    expect(await screen.findByText(/Identidad verificada/i)).toBeTruthy();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(screen.getByRole('button', { name: /Editar Correo/i })).toBeTruthy();
  });

  it('un código expirado muestra el mensaje específico', async () => {
    // Arrange
    const { notificar } = montar();
    apiMock.post.mockResolvedValueOnce({ data: {} }).mockRejectedValueOnce({
      response: { data: { detail: 'El código ha expirado' } },
    });
    await abrirEdicion();
    await solicitarCodigo();
    await screen.findByText('act****@neodomus.com');

    // Act
    await userEvent.setup().type(
      screen.getByLabelText('Código de verificación'),
      '000000',
    );
    await userEvent.setup().click(screen.getByRole('button', { name: 'Verificar código' }));

    // Assert
    await waitFor(() =>
      expect(notificar).toHaveBeenCalledWith(
        expect.stringMatching(/expirado/i),
        'error',
      ),
    );
  });

  it('cancelar descarta el borrador y vuelve a la vista de lectura', async () => {
    // Arrange
    montar();
    await abrirEdicion();
    await userEvent.setup().type(
      screen.getByDisplayValue(VALOR),
      'x',
    );

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cancelar' }));

    // Assert
    expect(screen.queryByDisplayValue(VALOR)).toBeNull();
    expect(screen.getByText(VALOR)).toBeTruthy();
  });

  it('modoEdicion arranca directamente en el formulario', () => {
    // Act
    montar({ modoEdicion: true });

    // Assert
    expect(screen.getByDisplayValue(VALOR)).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Editar Correo/i })).toBeNull();
  });
});