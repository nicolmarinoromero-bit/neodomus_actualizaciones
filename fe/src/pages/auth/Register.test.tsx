// Semana 3 del bootcamp — página Registro desde la perspectiva del usuario.
// user-event real: requisitos de contraseña en vivo, coincidencias de
// correo/contraseña, filtrado de documento/teléfono, dependencia
// ciudad→municipio y el registro exitoso que abre la verificación de correo.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock, openAuthMock, closeAuthMock, googleHabilitado } = vi.hoisted(() => ({
  apiMock: { post: vi.fn() },
  openAuthMock: vi.fn(),
  closeAuthMock: vi.fn(),
  googleHabilitado: { value: false },
}));

vi.mock('@contexts/AuthModalContext', () => ({
  useAuthModal: () => ({ openAuth: openAuthMock, closeAuth: closeAuthMock }),
  AuthModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@contexts/AuthContext', () => ({
  useAuth: () => ({ googleLogin: vi.fn(), user: undefined, isAuthenticated: false }),
}));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@utils/google', () => ({
  GOOGLE_LOGIN_HABILITADO: googleHabilitado.value,
  GOOGLE_CLIENT_ID: 'id-de-prueba',
}));
vi.mock('@react-oauth/google', () => ({
  GoogleLogin: () => <button type="button">Google mock</button>,
}));

import Register from './Register';

function montar() {
  return render(
    <IdiomaProvider>
      <Register />
    </IdiomaProvider>,
  );
}

const CLAVE = 'ClaveSegura1!';

async function llenarFormularioBasico(usuario: ReturnType<typeof userEvent.setup>) {
  await usuario.type(screen.getByLabelText('Nombres'), 'Carolina');
  await usuario.type(screen.getByLabelText(/Apellidos/), 'Mendez');
  // tipo_documento: CC (1) por defecto
  await usuario.type(screen.getByLabelText('Documento'), '1090284721');
  // ciudad y municipio (dependencia: Bogotá → Bogotá D.C.)
  await usuario.selectOptions(screen.getByLabelText('Ciudad'), 'Bogotá');
  await usuario.selectOptions(screen.getByLabelText('Municipio'), 'Bogotá D.C.');
  await usuario.type(screen.getByLabelText('Dirección'), 'Calle 10 #5-22');
  await usuario.type(screen.getByLabelText(/Teléfono/), '3105027488');
  await usuario.type(screen.getByLabelText('Correo'), 'carolina@neodomus.com');
  await usuario.type(screen.getByLabelText('Confirmación de correo'), 'carolina@neodomus.com');
  await usuario.type(screen.getByLabelText('Contraseña'), CLAVE);
  await usuario.type(screen.getByLabelText('Confirmación de contraseña'), CLAVE);
  const casillas = screen.getAllByRole('checkbox');
  for (const casilla of casillas) await usuario.click(casilla);
}

describe('Register (página)', () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    openAuthMock.mockReset();
    closeAuthMock.mockReset();
    googleHabilitado.value = false;
  });

  it('los requisitos de contraseña se marcan en vivo al escribir', async () => {
    // Arrange
    const usuario = userEvent.setup();
    montar();
    const requisitos = screen.getByText('La contraseña debe contener:').closest('.password-requirements')!;

    // Assert inicial: sin escribir, los cinco requisitos están en rojo.
    expect((requisitos as HTMLElement).querySelectorAll('li.invalid')).toHaveLength(5);

    // Act: una minúscula sola cumple solo ese requisito.
    await usuario.type(screen.getByLabelText('Contraseña'), 'abc');
    expect((requisitos as HTMLElement).querySelectorAll('li.invalid')).toHaveLength(4);
    expect((requisitos as HTMLElement).querySelectorAll('li.valid')).toHaveLength(1);

    // Act: contraseña completa.
    await usuario.type(screen.getByLabelText('Contraseña'), 'Segura' + '1' + '!');
    // Assert: los cinco requisitos pasan (5 ✓).
    await waitFor(() => {
      expect((requisitos as HTMLElement).querySelectorAll('li.valid')).toHaveLength(5);
      expect((requisitos as HTMLElement).querySelectorAll('li.invalid')).toHaveLength(0);
    });
  });

  it('documento y teléfono filtran todo lo que no sea dígito (máx. 10)', async () => {
    // Arrange
    const usuario = userEvent.setup();
    montar();
    // Act
    await usuario.type(screen.getByLabelText('Documento'), '109a-028*47 21x');
    await usuario.type(screen.getByLabelText(/Teléfono/), '310.502-7488');
    // Assert
    expect((screen.getByLabelText('Documento') as HTMLInputElement).value).toBe('1090284721');
    expect((screen.getByLabelText(/Teléfono/) as HTMLInputElement).value).toBe('3105027488');
  });

  it('el municipio está deshabilitado hasta elegir ciudad y muestra sus opciones', async () => {
    // Arrange
    const usuario = userEvent.setup();
    montar();
    const municipio = screen.getByLabelText('Municipio') as HTMLSelectElement;
    // Assert inicial: sin ciudad no hay municipio.
    expect(municipio.disabled).toBe(true);
    // Act
    await usuario.selectOptions(screen.getByLabelText('Ciudad'), 'Bogotá');
    // Assert
    expect(municipio.disabled).toBe(false);
    expect(within(municipio).getByRole('option', { name: 'Bogotá D.C.' })).toBeTruthy();
  });

  it('correos distintos dejan el envío deshabilitado y sin petición al backend', async () => {
    // Arrange
    const usuario = userEvent.setup();
    montar();
    await llenarFormularioBasico(usuario);
    // Rompe la coincidencia de correos.
    const confirmacion = screen.getByLabelText('Confirmación de correo');
    await usuario.clear(confirmacion);
    await usuario.type(confirmacion, 'otra@neodomus.com');
    // Assert: el botón queda deshabilitado (la UI no deja enviar) y no hay petición.
    expect((screen.getByRole('button', { name: 'Registrarse' }) as HTMLButtonElement).disabled).toBe(true);
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('contraseñas distintas dejan el envío deshabilitado y sin petición al backend', async () => {
    // Arrange
    const usuario = userEvent.setup();
    montar();
    await llenarFormularioBasico(usuario);
    await usuario.type(screen.getByLabelText('Confirmación de contraseña'), 'Distinta9!');
    // Assert
    expect((screen.getByRole('button', { name: 'Registrarse' }) as HTMLButtonElement).disabled).toBe(true);
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('contraseña válida pero débil bloqueada por requisitos con mensaje propio', async () => {
    // Arrange: contraseña débil pero con todos los campos llenos y coincidentes
    // (los requisitos también exigen mayúscula/minúscula/número/especial).
    const usuario = userEvent.setup();
    montar();
    await llenarFormularioBasico(usuario);
    // Reemplaza la contraseña por una débil en ambos campos: la casilla de
    // requisitos vuelve a estar en rojo pero isFormComplete es true.
    const clave = screen.getByLabelText('Contraseña');
    const confirmacion = screen.getByLabelText('Confirmación de contraseña');
    await usuario.clear(clave);
    await usuario.type(clave, 'abcdefgh1');
    await usuario.clear(confirmacion);
    await usuario.type(confirmacion, 'abcdefgh1');
    // Act
    await usuario.click(screen.getByRole('button', { name: 'Registrarse' }));
    // Assert
    expect(await screen.findByText('La contraseña no cumple los requisitos.')).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('registro exitoso normaliza el correo y abre la verificación de email', async () => {
    // Arrange
    apiMock.post.mockResolvedValue({ data: { msg: 'código enviado' } });
    const usuario = userEvent.setup();
    montar();
    await llenarFormularioBasico(usuario);
    // Correo con mayúsculas/espacios para probar la normalización.
    const correo = screen.getByLabelText('Correo');
    const confirmacion = screen.getByLabelText('Confirmación de correo');
    await usuario.clear(correo);
    await usuario.type(correo, '  Carolina@Neodomus.com');
    await usuario.clear(confirmacion);
    await usuario.type(confirmacion, '  Carolina@Neodomus.com');
    // Act
    await usuario.click(screen.getByRole('button', { name: 'Registrarse' }));
    // Assert
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(1));
    const [url, cuerpo, opciones] = apiMock.post.mock.calls[0];
    expect(url).toBe('/auth/register/client');
    expect(cuerpo).toEqual({
      first_name: 'Carolina',
      last_name: 'Mendez',
      email: 'carolina@neodomus.com',
      password: CLAVE,
      id_tipo_documento_c: 1,
      documento_cliente: 1090284721,
      telefono_cliente: 3105027488,
      city: 'Bogotá D.C.',
      address: 'Calle 10 #5-22',
    });
    expect(opciones).toEqual({ timeout: 15000 });
    expect(openAuthMock).toHaveBeenCalledWith('verificar-email', { email: 'carolina@neodomus.com' });
  });

  it('un error del backend muestra el detalle recibido', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({
      response: { status: 400, data: { detail: 'El email ya está registrado' } },
    });
    const usuario = userEvent.setup();
    montar();
    await llenarFormularioBasico(usuario);
    // Act
    await usuario.click(screen.getByRole('button', { name: 'Registrarse' }));
    // Assert
    expect(await screen.findByText('El email ya está registrado')).toBeTruthy();
    expect(openAuthMock).not.toHaveBeenCalled();
  });
});
