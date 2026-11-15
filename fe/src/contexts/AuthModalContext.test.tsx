// Semana 2 — contexto del modal de autenticación (estado compartido real).
// Reglas: openAuth guarda paso + parámetros (email/token), closeAuth limpia
// el paso, y usar el hook fuera del provider es un error de programación.
import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { AuthModalProvider, useAuthModal } from './AuthModalContext';

function LectorDeEstado() {
  const { step, email, token, openAuth, closeAuth } = useAuthModal();
  return (
    <div>
      <span data-testid="step">{step ?? 'cerrado'}</span>
      <span data-testid="email">{email || 'sin-email'}</span>
      <span data-testid="token">{token || 'sin-token'}</span>
      <button onClick={() => openAuth('restablecer', { email: 'a@neodomus.com', token: 'tok-1' })}>
        abrir-restablecer
      </button>
      <button onClick={() => openAuth('registro')}>abrir-registro</button>
      <button onClick={closeAuth}>cerrar</button>
    </div>
  );
}

describe('AuthModalContext', () => {
  it('abre un paso con sus parámetros y conserva el email/token', () => {
    render(<AuthModalProvider><LectorDeEstado /></AuthModalProvider>);
    fireEvent.click(screen.getByText('abrir-restablecer'));
    expect(screen.getByTestId('step').textContent).toBe('restablecer');
    expect(screen.getByTestId('email').textContent).toBe('a@neodomus.com');
    expect(screen.getByTestId('token').textContent).toBe('tok-1');
  });

  it('cambiar de paso no borra los parámetros ya dados', () => {
    render(<AuthModalProvider><LectorDeEstado /></AuthModalProvider>);
    fireEvent.click(screen.getByText('abrir-restablecer'));
    fireEvent.click(screen.getByText('abrir-registro'));
    expect(screen.getByTestId('step').textContent).toBe('registro');
    // El email/token persisten (los usan pasos consecutivos del flujo).
    expect(screen.getByTestId('email').textContent).toBe('a@neodomus.com');
    expect(screen.getByTestId('token').textContent).toBe('tok-1');
  });

  it('closeAuth cierra el modal manteniendo los parámetros', () => {
    render(<AuthModalProvider><LectorDeEstado /></AuthModalProvider>);
    fireEvent.click(screen.getByText('abrir-restablecer'));
    fireEvent.click(screen.getByText('cerrar'));
    expect(screen.getByTestId('step').textContent).toBe('cerrado');
    expect(screen.getByTestId('email').textContent).toBe('a@neodomus.com');
  });

  it('usar el hook fuera del provider falla con un mensaje claro', () => {
    // Evita el ruido de error en consola (React lo registra igualmente).
    const silencio = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      expect(() => renderHook(() => useAuthModal())).toThrow(
        'useAuthModal must be used within an AuthModalProvider',
      );
    } finally {
      silencio.mockRestore();
    }
  });

  it('los parámetros opcionales no pisan valores previos si no vienen', () => {
    // Arrange
    const { result } = renderHook(() => useAuthModal(), { wrapper: AuthModalProvider });
    act(() => result.current.openAuth('ingresar', { email: 'x@neodomus.com' }));
    // Act: abrir un paso SIN email no debe limpiar el email anterior.
    act(() => result.current.openAuth('registro'));
    // Assert
    expect(result.current.email).toBe('x@neodomus.com');
  });
});
