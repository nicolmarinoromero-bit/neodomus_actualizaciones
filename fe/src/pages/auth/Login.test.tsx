// Semana 3 del bootcamp — página Login desde la perspectiva del usuario.
// Interacción real con user-event; estados no felices: correo inválido,
// credenciales incorrectas (401), cuenta inhabilitada (403) con solicitud de
// habilitación y correo recordado precargado. Red/estado global simulados.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { useAuthMock, apiMock, openAuthMock, closeAuthMock, googleHabilitado } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  apiMock: { post: vi.fn() },
  openAuthMock: vi.fn(),
  closeAuthMock: vi.fn(),
  googleHabilitado: { value: false },
}));

vi.mock('@contexts/AuthContext', () => ({
  useAuth: useAuthMock,
  // Login usa localStorage/tabSet indirectamente vía AuthContext (simulado).
}));
vi.mock('@contexts/AuthModalContext', () => ({
  useAuthModal: () => ({ openAuth: openAuthMock, closeAuth: closeAuthMock }),
  AuthModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@utils/google', () => ({
  GOOGLE_LOGIN_HABILITADO: googleHabilitado.value,
  GOOGLE_CLIENT_ID: 'id-de-prueba',
}));
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button type="button">Acceder con Google (mock)</button>,
}));

import Login from './Login';

function montar(rutaInicial = '/login') {
  return render(
    <IdiomaProvider>
      <MemoryRouter initialEntries={[rutaInicial]}>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/productos" element={<div>Catálogo de productos</div>} />
          <Route path="/dashboard/admin" element={<div>Dashboard admin</div>} />
          <Route path="/dashboard/tecnico" element={<div>Dashboard técnico</div>} />
        </Routes>
      </MemoryRouter>
    </IdiomaProvider>,
  );
}

function autenticado(overrides: Record<string, unknown> = {}) {
  useAuthMock.mockReturnValue({
    login: vi.fn().mockResolvedValue({ rol: 'cliente' }),
    googleLogin: vi.fn(),
    user: undefined,
    isAuthenticated: false,
    passwordResetRequired: false,
    ...overrides,
  });
}

const CORREO = 'persona@neodomus.com';
const CLAVE = 'ClaveSegura123';

describe('Login (página)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    useAuthMock.mockReset();
    apiMock.post.mockReset();
    openAuthMock.mockReset();
    closeAuthMock.mockReset();
    googleHabilitado.value = false;
    autenticado();
  });

  it('un correo inválido no llega a enviarse (validación nativa del navegador)', async () => {
    // Arrange
    const usuario = userEvent.setup();
    montar();
    // Act: escribe un correo inválido y envía.
    await usuario.type(screen.getByPlaceholderText('Correo electrónico'), 'no-es-un-correo');
    await usuario.type(screen.getByPlaceholderText('Contraseña'), CLAVE);
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    // Assert: el navegador (jsdom igual que Chrome) bloquea el envío por
    // constraint validation del input type=email; no hay petición.
    const correo = screen.getByPlaceholderText('Correo electrónico') as HTMLInputElement;
    expect(correo.checkValidity()).toBe(false);
    expect(useAuthMock().login).not.toHaveBeenCalled();
  });

  it('con credenciales incorrectas (401) muestra el mensaje real y no abre sesión', async () => {
    // Arrange: el backend responde 401.
    useAuthMock.mockReturnValue({
      login: vi.fn().mockRejectedValue({
        response: { status: 401, data: { detail: 'Credenciales inválidas' } },
      }),
      googleLogin: vi.fn(),
      isAuthenticated: false,
      passwordResetRequired: false,
    });
    const usuario = userEvent.setup();
    montar();
    await usuario.type(screen.getByPlaceholderText('Correo electrónico'), CORREO);
    await usuario.type(screen.getByPlaceholderText('Contraseña'), 'Incorrecta1');
    // Act
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    // Assert: mensaje del sistema (traducido) y formulario sigue presente.
    expect(
      await screen.findByText('Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.'),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ingresar' })).toBeTruthy();
  });

  it('cuenta inhabilitada (403) ofrece solicitar habilitación y confirma el envío', async () => {
    // Arrange: 403 con "inhabilitada" en el detalle.
    useAuthMock.mockReturnValue({
      login: vi.fn().mockRejectedValue({
        response: { status: 403, data: { detail: 'Tu cuenta está inhabilitada' } },
      }),
      googleLogin: vi.fn(),
      isAuthenticated: false,
      passwordResetRequired: false,
    });
    apiMock.post.mockResolvedValue({ data: { msg: 'ok' } });
    const usuario = userEvent.setup();
    montar();
    await usuario.type(screen.getByPlaceholderText('Correo electrónico'), CORREO);
    await usuario.type(screen.getByPlaceholderText('Contraseña'), CLAVE);
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    // Assert: aparece la caja de inhabilitada.
    expect(
      await screen.findByText(/Tu cuenta está inhabilitada por un administrador/),
    ).toBeTruthy();
    // Act: pedir habilitación.
    await usuario.click(screen.getByRole('button', { name: /Solicitar habilitación de la cuenta/ }));
    // Assert: el backend recibe correo+contraseña y la UI confirma.
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(1));
    expect(apiMock.post).toHaveBeenCalledWith('/auth/solicitar-habilitacion', {
      email: CORREO,
      password: CLAVE,
    });
    expect(
      await screen.findByText(/Solicitud de habilitación enviada/),
    ).toBeTruthy();
  });

  it('con "Recordarme" guarda solo el correo y lo precarga en el próximo montaje', async () => {
    // Arrange
    const usuario = userEvent.setup();
    const { unmount } = montar();
    await usuario.type(screen.getByPlaceholderText('Correo electrónico'), CORREO);
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.type(screen.getByPlaceholderText('Contraseña'), CLAVE);
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    // Assert: persiste el correo (nunca la contraseña).
    expect(localStorage.getItem('neodomus_remembered_email')).toBe(CORREO);
    expect(localStorage.getItem('neodomus_remembered_password')).toBeNull();
    unmount();
    // Act: remontar la página.
    montar();
    // Assert: el correo precargado aparece en el campo.
    expect((screen.getByPlaceholderText('Correo electrónico') as HTMLInputElement).value).toBe(CORREO);
  });

  it('sin "Recordarme" el correo no se conserva tras iniciar sesión', async () => {
    // Arrange
    localStorage.setItem('neodomus_remembered_email', CORREO); // de una sesión previa
    const usuario = userEvent.setup();
    montar();
    // El correo viene precargado; desmarcar Recordarme y entrar.
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.type(screen.getByPlaceholderText('Contraseña'), CLAVE);
    // Act
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    // Assert
    await waitFor(() => expect(localStorage.getItem('neodomus_remembered_email')).toBeNull());
  });

  it('una pestaña que inicia sesión aquí redirige al catálogo del cliente y cierra el modal', async () => {
    // Arrange: la sesión queda autenticada (el AuthContext real actualiza el
    // estado tras login); el destino pendiente era el catálogo.
    sessionStorage.setItem('neodomus_redirect_after_login', '/productos');
    useAuthMock.mockReturnValue({
      login: vi.fn().mockResolvedValue({ rol: 'cliente' }),
      googleLogin: vi.fn(),
      user: { id: 1, rol: 'cliente' },
      isAuthenticated: true, // tras el login, el contexto actualiza a true
      passwordResetRequired: false,
    });
    const usuario = userEvent.setup();
    montar();
    await usuario.type(screen.getByPlaceholderText('Correo electrónico'), CORREO);
    await usuario.type(screen.getByPlaceholderText('Contraseña'), CLAVE);
    // Act
    await usuario.click(screen.getByRole('button', { name: 'Ingresar' }));
    // Assert: redirige al destino pendiente y cierra el modal de autenticación.
    await waitFor(() => expect(screen.getByText('Catálogo de productos')).toBeTruthy());
    expect(closeAuthMock).toHaveBeenCalled();
  });

  it('sin Google habilitado no se muestra el acceso con Google', () => {
    // Act
    montar();
    // Assert
    expect(screen.queryByRole('button', { name: /google/i })).toBeNull();
  });
});
