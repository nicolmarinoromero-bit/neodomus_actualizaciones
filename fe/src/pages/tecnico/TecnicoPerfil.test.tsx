import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@services/api';
import TecnicoPerfil from './TecnicoPerfil';

const { refreshUserProfile, storageMock, usuarioSesion } = vi.hoisted(() => ({
  refreshUserProfile: vi.fn(),
  usuarioSesion: { nombre: 'Tecnico Demo', correo: 'demo@neodomus.test' },
  storageMock: {
    avatar: null as string | null,
    getTechnicalAvatar: vi.fn(),
    setTechnicalAvatar: vi.fn(),
    removeTechnicalAvatar: vi.fn(),
  },
}));

vi.mock('@contexts/AuthContext', () => ({
  useAuth: () => ({
    user: usuarioSesion,
    refreshUserProfile,
  }),
}));

vi.mock('@i18n/IdiomaContext', () => ({
  useIdioma: () => ({ t: (clave: string) => clave }),
}));

vi.mock('@services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@utils/profileStorage', () => ({
  getTechnicalAvatar: storageMock.getTechnicalAvatar,
  setTechnicalAvatar: storageMock.setTechnicalAvatar,
  removeTechnicalAvatar: storageMock.removeTechnicalAvatar,
  getIniciales: (nombre: string) => nombre.slice(0, 2).toUpperCase(),
}));

vi.mock('@components/common/LocalizedNotificationText', () => ({
  default: ({ message }: { message: string }) => <span>{message}</span>,
}));

vi.mock('@components/profile/SectionHeader', () => ({ default: () => null }));

vi.mock('@components/admin/EspecializacionesSelect', () => ({
  default: ({
    value,
    onChange,
    disabled,
  }: {
    value: number[];
    onChange: (ids: number[]) => void;
    disabled?: boolean;
  }) => (
    <div>
      <span data-testid="esp-seleccionadas">{value.join(',')}</span>
      <button type="button" disabled={disabled} onClick={() => onChange([...value, 2])}>
        add-esp-2
      </button>
      <button type="button" disabled={disabled} onClick={() => onChange([])}>
        remove-esp
      </button>
    </div>
  ),
}));

vi.mock('@components/profile/PerfilCuenta', () => ({
  default: ({
    campos,
    email,
    onGuardar,
    notificar,
    onEmailVerificado,
  }: {
    campos: { clave: string; label: string; valor: string }[];
    email: string;
    onGuardar: (payload: Record<string, unknown>) => Promise<boolean>;
    notificar: (msg: string, tipo?: string) => void;
    onEmailVerificado: (email: string) => void;
  }) => (
    <div>
      <span data-testid="perfil-email">{email}</span>
      {campos.map((c) => (
        <span key={c.clave} data-testid={`campo-${c.clave}`}>
          {c.label}:{c.valor}
        </span>
      ))}
      <button
        type="button"
        onClick={() =>
          onGuardar({
            first_name: '  Nuevo ',
            last_name: ' Tecnico ',
            telefono_usuario: '300-111-2233',
            documento_usuario: '1.020.304.050',
            certificacion_t: ' Redes ',
          })
        }
      >
        guardar-ok
      </button>
      <button type="button" onClick={() => onGuardar({ telefono_usuario: '123' })}>
        guardar-tel-corto
      </button>
      <button type="button" onClick={() => onGuardar({})}>
        guardar-vacio
      </button>
      <button type="button" onClick={() => notificar('aviso-local', 'info')}>
        notificar
      </button>
      <button type="button" onClick={() => onEmailVerificado('nuevo@neodomus.test')}>
        email-verificado
      </button>
    </div>
  ),
}));

vi.mock('@components/profile/PasswordTab', () => ({
  default: ({ notify }: { notify: (msg: string) => void }) => (
    <div>
      password-tab
      <button type="button" onClick={() => notify('clave-ok')}>notify-pass</button>
    </div>
  ),
}));

vi.mock('@components/profile/LanguageTab', () => ({
  default: () => <div>language-tab</div>,
}));

const perfil = {
  first_name: 'Carlos',
  last_name: 'Pérez',
  email: 'carlos@neodomus.test',
  telefono_usuario: 3001112233,
  documento_usuario: 1020304050,
  certificacion_t: 'Redes',
  foto_url: '/fotos/carlos.png',
  especializaciones: [{ id_especializacion: 1, nombre: 'Redes', descripcion: null }],
};

const catalogo = [
  { id_especializacion: 1, nombre: 'Redes', descripcion: null },
  { id_especializacion: 2, nombre: 'Cámaras', descripcion: null },
];

const configurarApi = () => {
  vi.mocked(api.get).mockImplementation((url: string) => {
    if (url === '/users/me') return Promise.resolve({ data: perfil });
    if (url === '/especializaciones') return Promise.resolve({ data: catalogo });
    return Promise.resolve({ data: [] });
  });
};

beforeEach(() => {
  configurarApi();
  storageMock.getTechnicalAvatar.mockReturnValue(null);
  storageMock.setTechnicalAvatar.mockReset();
  storageMock.removeTechnicalAvatar.mockReset();
  refreshUserProfile.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('TecnicoPerfil — carga', () => {
  it('carga perfil, catálogo, foto y especializaciones', async () => {
    render(<TecnicoPerfil />);

    expect(await screen.findAllByText('carlos@neodomus.test')).toHaveLength(2);
    expect(screen.getByText('Carlos Pérez')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/users/me');
    expect(api.get).toHaveBeenCalledWith('/especializaciones');
    expect(screen.getByTestId('campo-telefono_usuario').textContent).toBe(
      'tec.telefono:3001112233',
    );
    expect(screen.getByTestId('campo-documento_usuario').textContent).toBe(
      'tec.documento:1020304050',
    );
    expect(screen.getByTestId('esp-seleccionadas').textContent).toBe('1');
    expect(storageMock.setTechnicalAvatar).toHaveBeenCalledWith('/fotos/carlos.png');
    expect(screen.getAllByAltText('tec.fotoPerfil')[0]).toHaveProperty(
      'src',
      expect.stringContaining('/fotos/carlos.png'),
    );
  });

  it('usa los datos de sesión si el perfil no se puede cargar', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(api.get).mockRejectedValue(new Error('down'));

    render(<TecnicoPerfil />);

    expect(await screen.findByTestId('perfil-email')).toHaveProperty(
      'textContent',
      'demo@neodomus.test',
    );
    expect(screen.getAllByText('demo@neodomus.test').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Tecnico Demo')).toBeTruthy();
    expect(error).toHaveBeenCalledWith(
      'Error cargando perfil del técnico:',
      expect.any(Error),
    );
    expect(error).toHaveBeenCalledWith(
      'Error cargando catálogo de especializaciones:',
      expect.any(Error),
    );
  });
});

describe('TecnicoPerfil — cuenta y guardado', () => {
  it('guarda los campos normalizados y refresca la sesión', async () => {
    const evento = vi.fn();
    window.addEventListener('technical-profile-updated', evento);
    render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');

    fireEvent.click(screen.getByRole('button', { name: 'guardar-ok' }));

    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/users/me', {
        first_name: '  Nuevo ',
        last_name: ' Tecnico ',
        telefono_usuario: 3001112233,
        documento_usuario: 1020304050,
        certificacion_t: ' Redes ',
      }),
    );
    expect(await screen.findByText('tec.cambiosGuardados')).toBeTruthy();
    expect(refreshUserProfile).toHaveBeenCalled();
    expect(evento).toHaveBeenCalled();
    expect(screen.getByText('Nuevo Tecnico')).toBeTruthy();
    expect(screen.getByTestId('campo-telefono_usuario').textContent).toBe(
      'tec.telefono:3001112233',
    );
    expect(screen.getByTestId('campo-certificacion_t').textContent).toBe(
      'tec.especialidad:Redes',
    );
    window.removeEventListener('technical-profile-updated', evento);
  });

  it('muestra el detalle del backend cuando el guardado falla', async () => {
    vi.mocked(api.put).mockRejectedValue({
      response: { data: { detail: 'El documento ya está registrado' } },
    });
    render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');

    fireEvent.click(screen.getByRole('button', { name: 'guardar-ok' }));

    expect(await screen.findByText('El documento ya está registrado')).toBeTruthy();
    expect(refreshUserProfile).not.toHaveBeenCalled();
  });

  it('usa el mensaje genérico si el error no trae detalle', async () => {
    vi.mocked(api.put).mockRejectedValue(new Error('down'));
    render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');

    fireEvent.click(screen.getByRole('button', { name: 'guardar-ok' }));

    expect(await screen.findByText('tec.errorGuardar')).toBeTruthy();
  });

  it('rechaza teléfonos que no tengan 10 dígitos sin llamar a la API', async () => {
    render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');

    fireEvent.click(screen.getByRole('button', { name: 'guardar-tel-corto' }));

    expect(await screen.findByText('perfil.telefono10')).toBeTruthy();
    expect(api.put).not.toHaveBeenCalled();
  });

  it('guarda vacíos como nulos y acepta el cambio de correo verificado', async () => {
    vi.mocked(api.put).mockResolvedValue({ data: {} });
    render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');

    fireEvent.click(screen.getByRole('button', { name: 'guardar-vacio' }));
    await waitFor(() =>
      expect(api.put).toHaveBeenCalledWith('/users/me', {
        telefono_usuario: null,
        documento_usuario: null,
      }),
    );

    fireEvent.click(screen.getByRole('button', { name: 'email-verificado' }));
    await waitFor(() =>
      expect(screen.getByTestId('perfil-email').textContent).toBe(
        'nuevo@neodomus.test',
      ),
    );
    expect(refreshUserProfile).toHaveBeenCalled();
  });
});

describe('TecnicoPerfil — especializaciones', () => {
  it('agrega y quita especializaciones con avisos', async () => {
    vi.mocked(api.post).mockResolvedValue({
      data: {
        mensaje: 'ok',
        especializaciones: [catalogo[0], catalogo[1]],
      },
    });
    vi.mocked(api.delete).mockResolvedValue({
      data: { mensaje: 'ok', especializaciones: [] },
    });
    render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');

    fireEvent.click(screen.getByRole('button', { name: 'add-esp-2' }));
    expect(await screen.findByText('Especialización agregada')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith('/tecnicos/mis-especializaciones/2');
    await waitFor(() =>
      expect(screen.getByTestId('esp-seleccionadas').textContent).toBe('1,2'),
    );

    fireEvent.click(screen.getByRole('button', { name: 'remove-esp' }));
    expect(await screen.findByText('Especialización quitada')).toBeTruthy();
    expect(api.delete).toHaveBeenCalledWith('/tecnicos/mis-especializaciones/1');
    expect(api.delete).toHaveBeenCalledWith('/tecnicos/mis-especializaciones/2');
    await waitFor(() =>
      expect(screen.getByTestId('esp-seleccionadas').textContent).toBe(''),
    );
  });

  it('muestra el error del backend al gestionar especializaciones', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { detail: 'No puedes modificar esta especialización' } },
    });
    render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');

    fireEvent.click(screen.getByRole('button', { name: 'add-esp-2' }));

    expect(
      await screen.findByText('No puedes modificar esta especialización'),
    ).toBeTruthy();
  });
});

describe('TecnicoPerfil — foto y pestañas', () => {
  it('sube una foto válida y permite eliminarla', async () => {
    storageMock.getTechnicalAvatar.mockReturnValue(null);
    const { container } = render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');
    vi.mocked(api.post).mockResolvedValue({
      data: { foto_url: '/fotos/nueva.png' },
    });

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const archivo = new File(['imagen'], 'nueva.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [archivo] } });

    expect(await screen.findByText('tec.fotoActualizada')).toBeTruthy();
    expect(api.post).toHaveBeenCalledWith(
      '/users/me/foto',
      expect.any(FormData),
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    expect(storageMock.setTechnicalAvatar).toHaveBeenCalledWith('/fotos/nueva.png');

    fireEvent.click(screen.getByRole('button', { name: /tec\.eliminarFoto/ }));
    expect(storageMock.removeTechnicalAvatar).toHaveBeenCalled();
    expect(await screen.findByText('tec.fotoEliminada')).toBeTruthy();
  });

  it('rechaza fotos de más de 5 MB sin llamar a la API', async () => {
    vi.mocked(api.post).mockClear();
    const { container } = render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const pesada = new File([new ArrayBuffer(6 * 1024 * 1024)], 'pesada.png', {
      type: 'image/png',
    });
    fireEvent.change(input, { target: { files: [pesada] } });

    expect(await screen.findByText('tec.fotoPesada')).toBeTruthy();
    expect(api.post).not.toHaveBeenCalled();
  });

  it('muestra el detalle del error al subir una foto', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { detail: 'Formato no permitido' } },
    });
    const { container } = render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'x.png', { type: 'image/png' })] },
    });

    expect(await screen.findByText('Formato no permitido')).toBeTruthy();
  });

  it('recarga el avatar cuando se actualiza el perfil técnico', async () => {
    render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');
    storageMock.getTechnicalAvatar.mockReturnValue('/fotos/evento.png');

    fireEvent(window, new CustomEvent('technical-profile-updated'));

    await waitFor(() => expect(storageMock.getTechnicalAvatar).toHaveBeenCalled());
    expect(screen.getAllByAltText('tec.fotoPerfil')[0]).toHaveProperty(
      'src',
      expect.stringContaining('/fotos/evento.png'),
    );
  });

  it('cambia entre las pestañas de cuenta, contraseña e idioma', async () => {
    render(<TecnicoPerfil />);
    await screen.findAllByText('carlos@neodomus.test');

    fireEvent.click(screen.getByRole('button', { name: /tec\.cambiarContrasena/ }));
    expect(await screen.findByText('password-tab')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /tec\.idioma/ }));
    expect(await screen.findByText('language-tab')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /tec\.miCuenta/ }));
    expect(await screen.findByTestId('perfil-email')).toBeTruthy();
  });
});