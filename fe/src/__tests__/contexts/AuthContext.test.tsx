// Tests de la lógica de autenticación del frontend (AuthContext):
// guardado/limpieza de tokens por pestaña, validación de rol y arranque de
// sesión. La capa de red (@services/api) se mockea completa.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, waitFor, act } from '@testing-library/react';

vi.mock('@services/api', () => {
  const instancia: any = {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} as Record<string, string> } },
  };
  return {
    default: instancia,
    refreshAccessToken: vi.fn(async () => ({ ok: false, authError: false })),
  };
});

import api, { refreshAccessToken } from '@services/api';
import { AuthProvider, useAuth } from '../../contexts/AuthContext';
import { tabGet, tabSet } from '../../utils/tabStorage';

const apiMock = api as unknown as {
  get: { mock: { calls: any[][] }; mockResolvedValue(v: unknown): unknown; mockRejectedValue(e: unknown): unknown; mockImplementation(f: (url: string) => unknown): unknown };
  post: { mock: { calls: any[][] }; mockResolvedValue(v: unknown): unknown; mockRejectedValue(e: unknown): unknown };
  defaults: { headers: { common: Record<string, string> } };
};

const refreshMock = refreshAccessToken as unknown as ReturnType<typeof vi.fn>;

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

const renderAuth = () => renderHook(() => useAuth(), { wrapper });

/** Perfil completo de cliente para refreshUserProfile. */
const PERFIL_COMPLETO = {
  first_name: 'Ana',
  last_name: 'Pérez',
  email: 'ana@correo.com',
  telefono_cliente: 3001112222,
  address: 'Calle 1 # 2-3',
  documento_cliente: 1010101010,
  id_tipo_documento_c: 1,
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  // Defaults deterministas: cada test que necesite otra cosa los sobreescribe.
  apiMock.get.mockResolvedValue({ data: {} });
  apiMock.post.mockResolvedValue({ data: {} });
  refreshMock.mockResolvedValue({ ok: false, authError: false });
  delete (window as any).__neodomus_validando_sesion;
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AuthContext — arranque', () => {
  it('arranca sin sesión cuando no hay usuario guardado', async () => {
    const { result } = renderAuth();
    expect(result.current.loading).toBe(true);

    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.rol).toBeNull();
    // Sin usuario guardado no se consulta la sesión en el backend.
    expect(apiMock.get).not.toHaveBeenCalled();
  });

  it('restaura la sesión si el backend confirma que sigue vigente', async () => {
    tabSet('user', JSON.stringify({ id: 7, nombre: 'Ana Perez', correo: 'ana@correo.com', rol: 'cliente' }));
    apiMock.get.mockImplementation((url: string) =>
      Promise.resolve(
        url === '/auth/session'
          ? { data: { user_type: 'client', rol: 'cliente' } }
          : { data: PERFIL_COMPLETO },
      ),
    );

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(result.current.rol).toBe('cliente');
    expect(result.current.user?.correo).toBe('ana@correo.com');
    expect(apiMock.get).toHaveBeenCalledWith('/auth/session');
  });

  it('cierra la sesión si la sesión del backend pertenece a otra cuenta', async () => {
    tabSet('user', JSON.stringify({ id: 7, nombre: 'Ana Perez', correo: 'ana@correo.com', rol: 'cliente' }));
    // El backend devuelve un empleado: no coincide con el rol recordado.
    apiMock.get.mockResolvedValue({ data: { user_type: 'employee', rol: 'tecnico' } });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(tabGet('user')).toBeNull();
  });

  it('confía en los datos guardados si el backend no responde (error de red)', async () => {
    tabSet('user', JSON.stringify({ id: 7, nombre: 'Ana Perez', correo: 'ana@correo.com', rol: 'cliente' }));
    apiMock.get.mockRejectedValue(new Error('Network Error'));

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(tabGet('user')).not.toBeNull();
  });
});

describe('AuthContext — login', () => {
  it('login exitoso guarda tokens y usuario por pestaña y autentica', async () => {
    apiMock.post.mockResolvedValue({
      data: {
        access_token: 'at-1',
        refresh_token: 'rt-1',
        rol: 'cliente',
        first_name: 'Ana',
        last_name: 'Pérez',
        id: 7,
      },
    });
    apiMock.get.mockResolvedValue({ data: PERFIL_COMPLETO });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('ana@correo.com', 'Secreta1!');
    });

    expect(apiMock.post).toHaveBeenCalledWith('/auth/login', {
      email: 'ana@correo.com',
      password: 'Secreta1!',
    });
    expect(tabGet('access_token')).toBe('at-1');
    expect(tabGet('refresh_token')).toBe('rt-1');
    const guardado = JSON.parse(tabGet('user') || '{}');
    expect(guardado).toEqual({
      id: 7,
      nombre: 'Ana Pérez',
      correo: 'ana@correo.com',
      rol: 'cliente',
    });
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.rol).toBe('cliente');
    expect(result.current.user?.nombre).toBe('Ana Pérez');
  });

  it('rechaza cuentas sin rol válido y no deja tokens', async () => {
    apiMock.post.mockResolvedValue({
      data: { access_token: 'at-1', refresh_token: 'rt-1', rol: 'superusuario' },
    });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    let fallo: unknown;
    await act(async () => {
      try {
        await result.current.login('x@correo.com', 'pw');
      } catch (e) {
        fallo = e;
      }
    });

    expect((fallo as Error).message).toContain('La cuenta no tiene un rol válido asignado.');
    expect(result.current.isAuthenticated).toBe(false);
    expect(tabGet('access_token')).toBeNull();
    expect(tabGet('user')).toBeNull();
  });

  it('propaga el error 401 del backend sin autenticar', async () => {
    apiMock.post.mockRejectedValue({ response: { status: 401 } });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    let fallo: unknown;
    await act(async () => {
      try {
        await result.current.login('x@correo.com', 'mala');
      } catch (e) {
        fallo = e;
      }
    });

    expect(fallo).toMatchObject({ response: { status: 401 } });
    expect(result.current.isAuthenticated).toBe(false);
    expect(tabGet('access_token')).toBeNull();
  });

  it('marca password_reset_required cuando el backend lo pide', async () => {
    apiMock.post.mockResolvedValue({
      data: {
        access_token: 'at',
        refresh_token: 'rt',
        rol: 'tecnico',
        password_reset_required: true,
      },
    });
    apiMock.get.mockResolvedValue({ data: { first_name: 'Luis', last_name: 'Gómez', email: 'l@x.com' } });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.login('l@x.com', 'pw');
    });

    expect(result.current.passwordResetRequired).toBe(true);
    expect(tabGet('password_reset_required')).toBe('1');
  });
});

describe('AuthContext — logout', () => {
  it('limpia tokens, usuario y flags, y avisa al backend', async () => {
    tabSet('access_token', 'at');
    tabSet('refresh_token', 'rt');
    tabSet('user', '{"id":1}');
    tabSet('password_reset_required', '1');
    apiMock.post.mockResolvedValue({ data: {} });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    act(() => {
      result.current.logout();
    });

    expect(apiMock.post).toHaveBeenCalledWith('/auth/logout');
    expect(tabGet('access_token')).toBeNull();
    expect(tabGet('refresh_token')).toBeNull();
    expect(tabGet('user')).toBeNull();
    expect(tabGet('password_reset_required')).toBeNull();
    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
    expect(result.current.rol).toBeNull();
  });

  it('el evento neodomus:sesion-expirada limpia el estado React', async () => {
    apiMock.post.mockResolvedValue({
      data: { access_token: 'at', refresh_token: 'rt', rol: 'cliente', first_name: 'Ana', last_name: 'P', id: 1 },
    });
    apiMock.get.mockResolvedValue({ data: PERFIL_COMPLETO });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => {
      await result.current.login('ana@correo.com', 'pw');
    });
    expect(result.current.isAuthenticated).toBe(true);

    act(() => {
      window.dispatchEvent(new Event('neodomus:sesion-expirada'));
    });

    expect(result.current.isAuthenticated).toBe(false);
    expect(result.current.user).toBeNull();
  });
});

describe('AuthContext — googleLogin', () => {
  it('almacena la sesión devuelta por /auth/google con rol por defecto cliente', async () => {
    apiMock.post.mockResolvedValue({
      data: { access_token: 'g-at', refresh_token: 'g-rt', first_name: 'Carla', last_name: 'Ríos', id: 9 },
    });
    apiMock.get.mockResolvedValue({ data: PERFIL_COMPLETO });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));

    await act(async () => {
      await result.current.googleLogin('credencial-google');
    });

    expect(apiMock.post).toHaveBeenCalledWith('/auth/google', { credential: 'credencial-google' });
    expect(tabGet('access_token')).toBe('g-at');
    expect(result.current.isAuthenticated).toBe(true);
    expect(result.current.rol).toBe('cliente');
  });
});

describe('AuthContext — refresh de sesión', () => {
  it('si el access_token expiró usa refreshAccessToken antes de decidir', async () => {
    tabSet('user', JSON.stringify({ id: 7, nombre: 'Ana Perez', correo: 'a@x.com', rol: 'cliente' }));
    apiMock.get.mockImplementation((url: string) =>
      url === '/auth/session'
        ? Promise.reject({ response: { status: 401 } })
        : Promise.resolve({ data: { user_type: 'client', rol: 'cliente' } }),
    );
    refreshMock.mockResolvedValue({ ok: true, authError: false });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.isAuthenticated).toBe(true));
    expect(refreshMock).toHaveBeenCalled();
  });

  it('si el refresh token es inválido cierra la sesión', async () => {
    tabSet('user', JSON.stringify({ id: 7, nombre: 'Ana Perez', correo: 'a@x.com', rol: 'cliente' }));
    apiMock.get.mockRejectedValue({ response: { status: 401 } });
    refreshMock.mockResolvedValue({ ok: false, authError: true });

    const { result } = renderAuth();
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.isAuthenticated).toBe(false);
    expect(tabGet('user')).toBeNull();
    expect(tabGet('access_token')).toBeNull();
  });
});
