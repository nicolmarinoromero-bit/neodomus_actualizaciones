import { act, renderHook } from '@testing-library/react';
import type { FormEvent } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@services/api';
import { useCambioPassword } from './useCambioPassword';

vi.mock('@services/api', () => ({
  default: { post: vi.fn() },
}));

const opciones = {
  errorNoCoinciden: 'no-coinciden',
  errorRequisitos: 'requisitos',
  errorMismaActual: 'misma-actual',
  errorGeneral: 'error-general',
};

const evento = { preventDefault: vi.fn() } as unknown as FormEvent;

describe('useCambioPassword', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockReset();
    evento.preventDefault = vi.fn();
  });

  it('rechaza contraseñas que no coinciden sin llamar al backend', async () => {
    const { result } = renderHook(() => useCambioPassword(opciones));

    act(() => {
      result.current.setCurrentPassword('Actual1!');
      result.current.setNewPassword('Nueva12!');
      result.current.setConfirmPassword('Otra1!');
    });
    await act(async () => {
      await result.current.handleSubmit(evento);
    });

    expect(result.current.error).toBe('no-coinciden');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña que no cumple los requisitos', async () => {
    const { result } = renderHook(() => useCambioPassword(opciones));

    act(() => {
      result.current.setCurrentPassword('Actual1!');
      result.current.setNewPassword('debil');
      result.current.setConfirmPassword('debil');
    });
    await act(async () => {
      await result.current.handleSubmit(evento);
    });

    expect(result.current.error).toBe('requisitos');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('envía la nueva contraseña, muestra el éxito y limpia el formulario', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: {} } as never);
    const onSuccess = vi.fn();
    const { result } = renderHook(() =>
      useCambioPassword({ ...opciones, mensajeExito: 'actualizada', onSuccess }),
    );

    act(() => {
      result.current.setCurrentPassword('Actual1!');
      result.current.setNewPassword('Nueva12!');
      result.current.setConfirmPassword('Nueva12!');
    });
    await act(async () => {
      await result.current.handleSubmit(evento);
    });

    expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
      current_password: 'Actual1!',
      new_password: 'Nueva12!',
    });
    expect(result.current.message).toBe('actualizada');
    expect(result.current.error).toBe('');
    expect(result.current.currentPassword).toBe('');
    expect(result.current.newPassword).toBe('');
    expect(result.current.confirmPassword).toBe('');
    expect(onSuccess).toHaveBeenCalledOnce();
  });

  it('muestra el detalle devuelto por el backend', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { detail: 'detalle-backend' } },
    });
    const { result } = renderHook(() => useCambioPassword(opciones));

    act(() => {
      result.current.setCurrentPassword('Actual1!');
      result.current.setNewPassword('Nueva12!');
      result.current.setConfirmPassword('Nueva12!');
    });
    await act(async () => {
      await result.current.handleSubmit(evento);
    });

    expect(result.current.error).toBe('detalle-backend');
  });
});
