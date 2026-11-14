// Semana 7 del bootcamp — perfil del administrador (AdminPerfil).
// Cubre carga de datos, respaldo desde la sesión, edición con confirmación,
// validación de teléfono, errores del backend, foto y pestañas. Red y sesión
// simuladas.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock, authMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
  authMock: { user: undefined as any, refreshUserProfile: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@contexts/AuthContext', () => ({ useAuth: () => authMock }));

import AdminPerfil from './AdminPerfil';

const PERFIL = {
  first_name: 'Carolina',
  last_name: 'Mendez',
  email: 'carolina@neodomus.com',
  telefono_usuario: 3001234567,
};

function montar() {
  return render(
    <IdiomaProvider>
      <AdminPerfil />
    </IdiomaProvider>,
  );
}

async function entrarEnEdicion() {
  const usuario = userEvent.setup();
  await usuario.click(await screen.findByRole('button', { name: /Editar perfil/i }));
  await usuario.click(screen.getByRole('button', { name: 'Aceptar' }));
  await screen.findByLabelText('Nombre');
  return usuario;
}

describe('AdminPerfil', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMock.get.mockReset();
    apiMock.put.mockReset();
    authMock.refreshUserProfile.mockReset();
    authMock.user = undefined;
  });

  it('carga el perfil desde /users/me y lo muestra en la cabecera', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: PERFIL });

    // Act
    montar();

    // Assert
    expect(await screen.findByText('Carolina Mendez')).toBeTruthy();
    expect(screen.getAllByText('carolina@neodomus.com').length).toBeGreaterThan(0);
    expect(apiMock.get).toHaveBeenCalledWith('/users/me');
    expect(screen.queryByText('Cargando datos...')).toBeNull();
  });

  it('si falla la carga usa los datos de la sesión', async () => {
    // Arrange
    apiMock.get.mockRejectedValue(new Error('sin red'));
    authMock.user = { nombre: 'Admin Sistema', correo: 'admin@neodomus.com' };

    // Act
    montar();

    // Assert
    expect(await screen.findByText('Admin Sistema')).toBeTruthy();
    expect(screen.getAllByText('admin@neodomus.com').length).toBeGreaterThan(0);
  });

  it('edita nombre, apellidos y teléfono y refresca la sesión', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: PERFIL });
    apiMock.put.mockResolvedValue({ data: { mensaje: 'ok' } });
    montar();
    const usuario = await entrarEnEdicion();

    // Act
    const nombre = screen.getByLabelText('Nombre');
    await usuario.clear(nombre);
    await usuario.type(nombre, 'Carolina');
    const telefono = screen.getByLabelText('Teléfono');
    await usuario.clear(telefono);
    await usuario.type(telefono, '3109876543');
    await usuario.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/users/me', {
        email: 'carolina@neodomus.com',
        first_name: 'Carolina',
        last_name: 'Mendez',
        telefono_usuario: 3109876543,
      }),
    );
    expect(authMock.refreshUserProfile).toHaveBeenCalledTimes(1);
    expect(await screen.findByText('Cambios guardados correctamente')).toBeTruthy();
  });

  it('un teléfono que no tiene 10 dígitos no se envía', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: PERFIL });
    montar();
    const usuario = await entrarEnEdicion();

    // Act
    const telefono = screen.getByLabelText('Teléfono');
    await usuario.clear(telefono);
    await usuario.type(telefono, '3109');
    await usuario.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    // Assert
    expect(apiMock.put).not.toHaveBeenCalled();
    expect(
      await screen.findByText('El teléfono debe tener exactamente 10 dígitos'),
    ).toBeTruthy();
  });

  it('muestra el detalle del backend cuando el guardado falla', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: PERFIL });
    apiMock.put.mockRejectedValue({
      response: { data: { detail: 'El correo ya está registrado' } },
    });
    montar();
    const usuario = await entrarEnEdicion();

    // Act
    await usuario.click(screen.getByRole('button', { name: /Guardar cambios/i }));

    // Assert
    expect(await screen.findByText('El correo ya está registrado')).toBeTruthy();
    expect(authMock.refreshUserProfile).not.toHaveBeenCalled();
  });

  it('rechaza una foto de más de 4 MB', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: PERFIL });
    montar();
    await screen.findByText('Carolina Mendez');
    const archivo = new File(['x'], 'foto.png', { type: 'image/png' });
    Object.defineProperty(archivo, 'size', { value: 5 * 1024 * 1024 });

    // Act
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo] } });

    // Assert
    expect(await screen.findByText('La imagen debe pesar menos de 4 MB')).toBeTruthy();
    expect(localStorage.getItem('adminAvatar')).toBeNull();
  });

  it('carga una foto válida y permite eliminarla', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: PERFIL });
    montar();
    await screen.findByText('Carolina Mendez');
    const archivo = new File(['imagen'], 'foto.png', { type: 'image/png' });

    // Act: subir la foto.
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [archivo] } });

    // Assert: se guarda el data URL y aparece la acción de eliminar.
    expect(await screen.findByText('Foto de perfil actualizada')).toBeTruthy();
    await waitFor(() => expect(localStorage.getItem('adminAvatar')).toMatch(/^data:/));
    const eliminar = await screen.findByRole('button', { name: /Eliminar foto/i });

    // Act: eliminar la foto.
    await userEvent.setup().click(eliminar);
    expect(await screen.findByText('Foto de perfil eliminada')).toBeTruthy();
    expect(localStorage.getItem('adminAvatar')).toBeNull();
  });

  it('cambia entre las pestañas de cuenta, contraseña e idioma', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: PERFIL });
    montar();
    await screen.findByText('Carolina Mendez');
    const usuario = userEvent.setup();

    // Act / Assert: contraseña.
    await usuario.click(screen.getByRole('button', { name: /Cambiar contraseña/i }));
    expect(await screen.findByText('Cambiar contraseña')).toBeTruthy();
    expect(screen.queryByLabelText('Nombre')).toBeNull();

    // Act / Assert: idioma y selección de inglés.
    await usuario.click(screen.getByRole('button', { name: /^Idioma$/i }));
    const ingles = await screen.findAllByText('English');
    expect(ingles.length).toBeGreaterThan(0);
    await usuario.click(ingles[0]);
    expect(await screen.findByText(/Changes saved|Language saved|Idioma guardado/i)).toBeTruthy();
  });
});