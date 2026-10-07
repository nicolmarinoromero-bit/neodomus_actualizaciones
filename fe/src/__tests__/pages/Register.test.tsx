// Tests del formulario de registro: validación de campos, requisitos de
// contraseña en vivo, normalización del payload y respuestas del backend.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@services/api', () => {
  const instancia: any = {
    get: vi.fn(),
    post: vi.fn(),
    defaults: { headers: { common: {} as Record<string, string> } },
  };
  return { default: instancia, refreshAccessToken: vi.fn(async () => ({ ok: false, authError: false })) };
});

vi.mock('@react-oauth/google', () => ({ GoogleLogin: () => null }));

import api from '@services/api';
import { AuthProvider } from '../../contexts/AuthContext';
import { AuthModalProvider, useAuthModal } from '../../contexts/AuthModalContext';
import Register from '../../pages/auth/Register';

const apiMock = api as unknown as {
  get: { mockResolvedValue(v: unknown): unknown; mockRejectedValue(e: unknown): unknown };
  post: {
    mockResolvedValue(v: unknown): unknown;
    mockRejectedValue(e: unknown): unknown;
    mock: { calls: any[][] };
  };
};

/** Expone el paso actual del modal de autenticación. */
const StepProbe = () => {
  const { step } = useAuthModal();
  return <div data-testid="auth-step">{step ?? 'ninguno'}</div>;
};

const renderRegister = () =>
  render(
    <AuthProvider>
      <AuthModalProvider>
        <StepProbe />
        <Register />
      </AuthModalProvider>
    </AuthProvider>,
  );

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
  apiMock.get.mockResolvedValue({ data: {} });
  apiMock.post.mockResolvedValue({ data: {} });
  vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  vi.restoreAllMocks();
});

interface DatosParciales {
  nombre?: string;
  apellido?: string;
  documento?: string;
  telefono?: string;
  ciudad?: string;
  municipio?: string;
  direccion?: string;
  correo?: string;
  confirmCorreo?: string;
  password?: string;
  confirmPassword?: string;
}

/** Rellena el formulario con valores válidos por defecto. */
const llenar = async (
  user: ReturnType<typeof userEvent.setup>,
  contenedor: HTMLElement,
  datos: DatosParciales = {},
) => {
  const d = {
    nombre: 'Ana',
    apellido: 'Pérez',
    documento: '1234567890',
    telefono: '3001234567',
    ciudad: 'Bogotá',
    municipio: 'Bogotá D.C.',
    direccion: 'Calle 1 # 2-3',
    correo: 'ana@correo.com',
    confirmCorreo: 'ana@correo.com',
    password: 'Secreta1!',
    confirmPassword: 'Secreta1!',
    ...datos,
  };

  await user.type(screen.getByPlaceholderText('Ingresa tus nombres'), d.nombre);
  await user.type(screen.getByPlaceholderText('Ingresa tus apellidos'), d.apellido);
  await user.type(screen.getByPlaceholderText('Ingresa tu número de documento'), d.documento);
  await user.type(screen.getByPlaceholderText('Ingresa tu número telefónico'), d.telefono);

  // Los <label> no están asociados con htmlFor: se localizan por el select.
  const selectCiudad = screen.getByDisplayValue('Selecciona tu ciudad');
  await user.selectOptions(selectCiudad, d.ciudad);
  const selectMunicipio = screen.getByDisplayValue('Selecciona tu municipio');
  await user.selectOptions(selectMunicipio, d.municipio);

  await user.type(screen.getByPlaceholderText('Ingresa tu dirección'), d.direccion);
  await user.type(screen.getByPlaceholderText('Ingresa tu correo'), d.correo);

  const correos = contenedor.querySelectorAll('input[type="email"]');
  await user.type(correos[1], d.confirmCorreo);

  await user.type(screen.getByPlaceholderText('Ingresa tu contraseña'), d.password);
  const claves = contenedor.querySelectorAll('input[type="password"]');
  await user.type(claves[1], d.confirmPassword);

  for (const casilla of screen.getAllByRole('checkbox')) {
    await user.click(casilla);
  }
};

describe('Register — render y validación en vivo', () => {
  it('muestra el formulario con los requisitos de contraseña', () => {
    renderRegister();
    expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();
    expect(screen.getByText('La contraseña debe contener:')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Registrarse' })).toBeDisabled();
  });

  it('marca y desmarca los requisitos de contraseña al escribir', async () => {
    const user = userEvent.setup();
    const { container } = renderRegister();

    const debil = screen.getByPlaceholderText('Ingresa tu contraseña');
    await user.type(debil, 'abc');
    expect(screen.getByText(/8\+ caracteres/)).toHaveClass('invalid');
    expect(screen.getByText(/Una mayúscula/)).toHaveClass('invalid');
    expect(screen.getByText(/Un número/)).toHaveClass('invalid');

    await user.type(debil, 'BCDEFGH1!');
    expect(screen.getByText(/8\+ caracteres/)).toHaveClass('valid');
    expect(screen.getByText(/Una mayúscula/)).toHaveClass('valid');
    expect(screen.getByText(/Una minúscula/)).toHaveClass('valid');
    expect(screen.getByText(/Un número/)).toHaveClass('valid');
    expect(screen.getByText(/Carácter especial/)).toHaveClass('valid');

    expect(container.querySelectorAll('input[type="password"]')).toHaveLength(2);
  });

  it('documento y teléfono aceptan solo dígitos y máximo 10 caracteres', async () => {
    const user = userEvent.setup();
    renderRegister();

    const documento = screen.getByPlaceholderText('Ingresa tu número de documento');
    await user.type(documento, '12ab34cd56ef78gh90ij');
    expect(documento).toHaveValue('1234567890');

    const telefono = screen.getByPlaceholderText('Ingresa tu número telefónico');
    await user.type(telefono, '300-111-222');
    expect(telefono).toHaveValue('300111222');
  });

  it('al elegir ciudad se desbloquean sus municipios', async () => {
    const user = userEvent.setup();
    renderRegister();

    expect(screen.getByDisplayValue('Selecciona tu municipio')).toBeDisabled();
    await user.selectOptions(screen.getByDisplayValue('Selecciona tu ciudad'), 'Bogotá');
    expect(screen.getByDisplayValue('Selecciona tu municipio')).toBeEnabled();
    expect(screen.getByRole('option', { name: 'Bogotá D.C.' })).toBeInTheDocument();
  });
});

describe('Register — validación al enviar', () => {
  // IMPORTANTE: el botón solo se habilita cuando los correos y las
  // contraseñas coinciden (isFormComplete), por lo que las ramas
  // "Los correos no coinciden." / "Las contraseñas no coinciden." de
  // validateForm() son código muerto en la UI. Ver HALLAZGOS_TESTS.md.
  it('mantiene deshabilitado el botón si los correos no coinciden', async () => {
    const user = userEvent.setup();
    const { container } = renderRegister();
    await llenar(user, container, { confirmCorreo: 'otro@correo.com' });

    const boton = screen.getByRole('button', { name: 'Registrarse' });
    expect(boton).toBeDisabled();
    await user.click(boton);

    expect(screen.queryByText('Los correos no coinciden.')).toBeNull();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('mantiene deshabilitado el botón si las contraseñas no coinciden', async () => {
    const user = userEvent.setup();
    const { container } = renderRegister();
    await llenar(user, container, { confirmPassword: 'Secreta2!' });

    const boton = screen.getByRole('button', { name: 'Registrarse' });
    expect(boton).toBeDisabled();
    await user.click(boton);

    expect(screen.queryByText('Las contraseñas no coinciden.')).toBeNull();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('rechaza contraseñas que no cumplen los requisitos', async () => {
    const user = userEvent.setup();
    const { container } = renderRegister();
    await llenar(user, container, { password: 'abcdefg1', confirmPassword: 'abcdefg1' });

    await user.click(screen.getByRole('button', { name: 'Registrarse' }));

    expect(await screen.findByText('La contraseña no cumple los requisitos.')).toBeInTheDocument();
    expect(apiMock.post).not.toHaveBeenCalled();
  });
});

describe('Register — envío al backend', () => {
  it('registra con el payload normalizado y avanza a verificar el correo', async () => {
    const user = userEvent.setup();
    const { container } = renderRegister();
    await llenar(user, container, { correo: 'Ana@Correo.com', confirmCorreo: 'Ana@Correo.com' });

    await user.click(screen.getByRole('button', { name: 'Registrarse' }));

    await waitFor(() => {
      expect(apiMock.post).toHaveBeenCalledWith(
        '/auth/register/client',
        {
          first_name: 'Ana',
          last_name: 'Pérez',
          // El correo se normaliza a minúsculas.
          email: 'ana@correo.com',
          password: 'Secreta1!',
          // Valor por defecto del estado (ver HALLAZGOS_TESTS.md).
          id_tipo_documento_c: 2,
          documento_cliente: 1234567890,
          telefono_cliente: 3001234567,
          city: 'Bogotá D.C.',
          address: 'Calle 1 # 2-3',
        },
        { timeout: 15000 },
      );
    });
    expect(screen.getByTestId('auth-step')).toHaveTextContent('verificar-email');
  });

  it('ante un 429 muestra el mensaje de límite de solicitudes', async () => {
    apiMock.post.mockRejectedValue({ response: { status: 429 } });
    const user = userEvent.setup();
    const { container } = renderRegister();
    await llenar(user, container);

    await user.click(screen.getByRole('button', { name: 'Registrarse' }));

    expect(
      await screen.findByText('Demasiadas solicitudes. Espera un minuto antes de reintentar.'),
    ).toBeInTheDocument();
    expect(screen.getByTestId('auth-step')).toHaveTextContent('ninguno');
  });

  it('ante un timeout muestra el mensaje de conexión', async () => {
    apiMock.post.mockRejectedValue({ code: 'ECONNABORTED', message: 'timeout of 15000ms exceeded' });
    const user = userEvent.setup();
    const { container } = renderRegister();
    await llenar(user, container);

    await user.click(screen.getByRole('button', { name: 'Registrarse' }));

    expect(
      await screen.findByText('La solicitud tardó demasiado. Verifica tu conexión e inténtalo nuevamente.'),
    ).toBeInTheDocument();
  });

  it('ante un error del backend muestra el detail devuelto', async () => {
    apiMock.post.mockRejectedValue({
      response: { status: 400, data: { detail: 'El correo ya está registrado' } },
    });
    const user = userEvent.setup();
    const { container } = renderRegister();
    await llenar(user, container);

    await user.click(screen.getByRole('button', { name: 'Registrarse' }));

    expect(await screen.findByText('El correo ya está registrado')).toBeInTheDocument();
    expect(screen.getByTestId('auth-step')).toHaveTextContent('ninguno');
  });
});
