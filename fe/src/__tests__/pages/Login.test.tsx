// Tests del formulario de inicio de sesión: render, validación de correo,
// manejo de errores del backend, "recordarme" y redirección por rol.
// La capa de red (@services/api) se mockea completa.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

vi.mock('@services/api', () => {
  const instancia: any = {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} as Record<string, string> } },
  };
  return { default: instancia, refreshAccessToken: vi.fn(async () => ({ ok: false, authError: false })) };
});

// El botón de Google necesita GoogleOAuthProvider; no aporta a estos tests.
vi.mock('@react-oauth/google', () => ({ GoogleLogin: () => null }));

import api from '@services/api';
import { AuthProvider } from '../../contexts/AuthContext';
import { AuthModalProvider, useAuthModal } from '../../contexts/AuthModalContext';
import Login from '../../pages/auth/Login';

const apiMock = api as unknown as {
  get: {
    mockResolvedValue(v: unknown): unknown;
    mockRejectedValue(e: unknown): unknown;
    mock: { calls: any[][] };
  };
  post: {
    mockResolvedValue(v: unknown): unknown;
    mockRejectedValue(e: unknown): unknown;
    mockRejectedValueOnce(e: unknown): unknown;
    mockImplementation(f: () => Promise<unknown>): unknown;
    mock: { calls: any[][] };
  };
};

const REMEMBERED_EMAIL_KEY = 'neodomus_remembered_email';
const LEGACY_PASSWORD_KEY = 'neodomus_remembered_password';

/** Expone el paso actual del modal de autenticación para poder asertarlo. */
const StepProbe = () => {
  const { step } = useAuthModal();
  return <div data-testid="auth-step">{step ?? 'ninguno'}</div>;
};

const renderLogin = () =>
  render(
    <MemoryRouter>
      <AuthProvider>
        <AuthModalProvider>
          <StepProbe />
          <Login />
        </AuthModalProvider>
      </AuthProvider>
    </MemoryRouter>,
  );

/** Perfil completo para refreshUserProfile tras un login exitoso. */
const PERFIL = {
  first_name: 'Ana',
  last_name: 'Pérez',
  email: 'ana@correo.com',
  telefono_cliente: 300,
  address: 'Calle 1',
  documento_cliente: 101,
  id_tipo_documento_c: 1,
};

const loginExitoso = () => {
  apiMock.post.mockResolvedValue({
    data: { access_token: 'at', refresh_token: 'rt', rol: 'cliente', first_name: 'Ana', last_name: 'Pérez', id: 7 },
  });
  apiMock.get.mockResolvedValue({ data: PERFIL });
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  apiMock.get.mockResolvedValue({ data: PERFIL });
  apiMock.post.mockResolvedValue({ data: {} });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

const rellenar = async (user: ReturnType<typeof userEvent.setup>, correo: string, clave: string) => {
  await user.type(screen.getByPlaceholderText('Correo electrónico'), correo);
  await user.type(screen.getByPlaceholderText('Contraseña'), clave);
};

describe('Login — render', () => {
  it('muestra el formulario con todos los controles', () => {
    renderLogin();
    expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Correo electrónico')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Contraseña')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrarse' })).toBeInTheDocument();
    expect(screen.getByText('Recordarme')).toBeInTheDocument();
    expect(screen.getByTestId('auth-step')).toHaveTextContent('ninguno');
  });

  it('abre los pasos del modal de autenticación (recuperar y registro)', async () => {
    const user = userEvent.setup();
    renderLogin();

    await user.click(screen.getByRole('button', { name: '¿Olvidaste tu contraseña?' }));
    expect(screen.getByTestId('auth-step')).toHaveTextContent('recuperar');

    await user.click(screen.getByRole('button', { name: 'Registrarse' }));
    expect(screen.getByTestId('auth-step')).toHaveTextContent('registro');
  });

  it('muestra/oculta la contraseña con el botón de ojo', async () => {
    const user = userEvent.setup();
    const { container } = renderLogin();
    const campo = screen.getByPlaceholderText('Contraseña');
    expect(campo).toHaveAttribute('type', 'password');

    const ojo = container.querySelector('.login-password-toggle') as HTMLButtonElement;
    expect(ojo).not.toBeNull();
    await user.click(ojo);
    expect(campo).toHaveAttribute('type', 'text');
  });

  it('restaura el correo recordado y borra la contraseña legada', () => {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, 'anterior@correo.com');
    localStorage.setItem(LEGACY_PASSWORD_KEY, 'secreto-en-claro');

    renderLogin();

    expect(screen.getByPlaceholderText('Correo electrónico')).toHaveValue('anterior@correo.com');
    expect(localStorage.getItem(LEGACY_PASSWORD_KEY)).toBeNull();
  });
});

describe('Login — validación', () => {
  it('rechaza un correo inválido sin llamar al backend', async () => {
    const user = userEvent.setup();
    renderLogin();

    // 'a@b' pasa la validación nativa del input type=email pero no el regex
    // propio del formulario (exige dominio con punto).
    await rellenar(user, 'a@b', 'Secreta1!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Ingresa un correo electrónico válido')).toBeInTheDocument();
    const loginCall = apiMock.post.mock.calls.find(([url]) => url === '/auth/login');
    expect(loginCall).toBeUndefined();
  });

  it('el formulario se envía con Enter', async () => {
    loginExitoso();
    const user = userEvent.setup();
    renderLogin();
    const correo = screen.getByPlaceholderText('Correo electrónico');

    await rellenar(user, 'ana@correo.com', 'Secreta1!');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/auth/login', {
        email: 'ana@correo.com',
        password: 'Secreta1!',
      });
    });
    expect(correo).toBeDefined();
  });
});

describe('Login — respuestas del backend', () => {
  it('ante un 401 muestra credenciales incorrectas', async () => {
    apiMock.post.mockRejectedValue({ response: { status: 401 } });
    const user = userEvent.setup();
    renderLogin();

    await rellenar(user, 'ana@correo.com', 'mala');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(
      await screen.findByText('Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.'),
    ).toBeInTheDocument();
  });

  it('ante un 403 por cuenta inhabilitada ofrece solicitar habilitación', async () => {
    apiMock.post.mockRejectedValueOnce({
      response: { status: 403, data: { detail: 'Tu cuenta está inhabilitada por un administrador.' } },
    });
    const user = userEvent.setup();
    renderLogin();

    await rellenar(user, 'ana@correo.com', 'Secreta1!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    // El detalle también aparece en la caja de error general: se comprueba
    // que exista y se usa el botón de la caja de reactivación.
    expect((await screen.findAllByText(/Tu cuenta está inhabilitada/)).length).toBeGreaterThan(0);
    const boton = screen.getByRole('button', { name: 'Solicitar habilitación de la cuenta' });

    // La solicitud reutiliza correo y contraseña.
    await user.click(boton);
    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/auth/solicitar-habilitacion', {
        email: 'ana@correo.com',
        password: 'Secreta1!',
      });
    });
    expect(await screen.findByText(/Solicitud de habilitación enviada/)).toBeInTheDocument();
  });

  it('ante un 403 por correo sin verificar ofrece verificar el correo', async () => {
    apiMock.post.mockRejectedValue({
      response: { status: 403, data: { detail: 'Tu correo aún no ha sido verificado.' } },
    });
    const user = userEvent.setup();
    renderLogin();

    await rellenar(user, 'ana@correo.com', 'Secreta1!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect((await screen.findAllByText(/Tu correo aún no ha sido verificado/)).length).toBeGreaterThan(0);
    await user.click(screen.getByRole('button', { name: 'Verificar mi correo' }));
    expect(screen.getByTestId('auth-step')).toHaveTextContent('verificar-email');
  });

  it('ante un error distinto muestra el detail devuelto', async () => {
    apiMock.post.mockRejectedValue({
      response: { status: 500, data: { detail: 'Error interno del servidor' } },
    });
    const user = userEvent.setup();
    renderLogin();

    await rellenar(user, 'ana@correo.com', 'Secreta1!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByText('Error interno del servidor')).toBeInTheDocument();
  });
});

describe('Login — sesión y "recordarme"', () => {
  it('login exitoso guarda el correo solo si "recordarme" está marcado', async () => {
    loginExitoso();
    const user = userEvent.setup();
    renderLogin();

    await rellenar(user, 'ana@correo.com', 'Secreta1!');
    await user.click(screen.getByRole('checkbox', { name: 'Recordarme' }));
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/auth/login', {
        email: 'ana@correo.com',
        password: 'Secreta1!',
      });
    });
    await waitFor(() => {
      expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBe('ana@correo.com');
    });
    // La contraseña jamás se persiste.
    expect(localStorage.getItem('neodomus_remembered_password')).toBeNull();
  });

  it('sin "recordarme" borra cualquier correo guardado', async () => {
    localStorage.setItem(REMEMBERED_EMAIL_KEY, 'viejo@correo.com');
    loginExitoso();
    const user = userEvent.setup();
    renderLogin();

    // El formulario se precarga con el correo guardado y "recordarme" activo.
    const casilla = screen.getByRole('checkbox', { name: 'Recordarme' }) as HTMLInputElement;
    expect(casilla).toBeChecked();
    await user.click(casilla);

    await user.clear(screen.getByPlaceholderText('Correo electrónico'));
    await rellenar(user, 'nuevo@correo.com', 'Secreta1!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith('/auth/login', {
        email: 'nuevo@correo.com',
        password: 'Secreta1!',
      });
    });
    expect(localStorage.getItem(REMEMBERED_EMAIL_KEY)).toBeNull();
  });

  it('deshabilita el botón mientras procesa el inicio de sesión', async () => {
    const pendiente: { resolver?: (v: unknown) => void } = {};
    apiMock.post.mockImplementation(
      () =>
        new Promise((res) => {
          pendiente.resolver = res;
        }),
    );
    const user = userEvent.setup();
    renderLogin();

    await rellenar(user, 'ana@correo.com', 'Secreta1!');
    await user.click(screen.getByRole('button', { name: 'Ingresar' }));

    expect(await screen.findByRole('button', { name: 'Ingresando...' })).toBeDisabled();
    expect(screen.getByPlaceholderText('Correo electrónico')).toBeDisabled();

    // Finaliza la petición para no dejar promesas ni estados pendientes.
    await act(async () => {
      pendiente.resolver?.({
        data: { access_token: 'at', refresh_token: 'rt', rol: 'cliente', first_name: 'Ana', last_name: 'Pérez' },
      });
      await Promise.resolve();
    });
  });
});
