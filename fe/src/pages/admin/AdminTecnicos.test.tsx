// Semana 4 del bootcamp — panel admin de técnicos.
// Listado con disponibilidad, especializaciones y agenda; alta y edición con
// contraseña; inhabilitación con motivo/fecha, habilitación e historial de
// servicios/entregas/devoluciones. Red simulada.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));

import AdminTecnicos from './AdminTecnicos';

const ESPECIALIDADES = [
  { id_especializacion: 1, nombre: 'Electricidad', activa: true },
  { id_especializacion: 2, nombre: 'Climatización', activa: true },
];

const ACTIVO = {
  id_tecnico: 5, id_usuario: 101, first_name: 'Ana', last_name: 'Torres',
  email: 'ana.torres@neodomus.com', telefono_usuario: 3001234567,
  documento_usuario: 1090284721, is_active: true, calificacion: 4.5,
  total_calificaciones: 12, citas_pendientes: 3, entregas_pendientes: 2,
  especializaciones: [{ id_especializacion: 1, nombre: 'Electricidad' }],
};
const INACTIVO = {
  ...ACTIVO, id_tecnico: 6, id_usuario: 102, first_name: 'Beto', last_name: 'Ruiz',
  email: 'beto.ruiz@neodomus.com', is_active: false, password_reset_required: true,
  desactivado_hasta: '2030-01-01T12:00:00Z', calificacion: null,
  total_calificaciones: 0, citas_pendientes: 0, entregas_pendientes: 0,
  especializaciones: [],
};

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <AdminTecnicos />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function red(tecnicos: unknown[] = [ACTIVO, INACTIVO], historial?: unknown) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/especializaciones') return { data: ESPECIALIDADES };
    if (url === '/tecnicos') return { data: tecnicos };
    if (url === '/tecnicos/admin/5/historial') {
      return {
        data: historial ?? {
          servicios: [{
            id_cita: 70, tipo_servicio: 'Instalación', fecha: '2026-10-01', hora: '09:00',
            cliente: 'Carolina Mendez', direccion: 'Calle 1', estado: 'Finalizada', costo_cita: 80000,
          }],
          entregas: [{
            id_pedido: 88, cliente: 'Carolina Mendez', estado_entrega: 'Entregado',
            fecha_entrega: '2026-10-02', hora_entrega: '10:00', total: 120000, productos: ['Panel LED'],
          }],
          devoluciones: [{
            id_devolucion: 9, cliente: 'Luis Pérez', producto: 'Sensor', estado: 'Aprobada',
            motivo: 'Producto dañado', cantidad: 2, created_at: '2026-10-03',
          }],
        },
      };
    }
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
});

describe('AdminTecnicos — listado', () => {
  it('muestra disponibilidad, especializaciones, agenda y cuenta bloqueada', async () => {
    // Arrange
    red();
    montar();
    // Assert
    expect(await screen.findByText('ANA TORRES')).toBeTruthy();
    expect(screen.getByText('BETO RUIZ')).toBeTruthy();
    expect(screen.getByText('2 técnicos registrados en el sistema')).toBeTruthy();
    expect(screen.getByText('Electricidad')).toBeTruthy();
    expect(screen.getByText('Sin especialidad definida')).toBeTruthy();
    expect(screen.getByText('Debe cambiar su contraseña')).toBeTruthy();
    expect(screen.getByText(/Inhabilitado hasta/)).toBeTruthy();
    expect(screen.getByText('Disponible')).toBeTruthy();
    expect(screen.getByText('Inactivo')).toBeTruthy();
  });

  it('sin técnicos muestra el estado vacío y permite abrir y cerrar el alta', async () => {
    // Arrange
    red([]);
    const usuario = userEvent.setup();
    montar();
    // Assert
    expect(await screen.findByText('No hay técnicos registrados')).toBeTruthy();
    // Act: el botón del estado vacío también abre el formulario.
    const botones = screen.getAllByRole('button', { name: 'Registrar técnico' });
    await usuario.click(botones[botones.length - 1]);
    expect(await screen.findByRole('heading', { name: /Registrar nuevo técnico/ })).toBeTruthy();
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Assert
    await waitFor(() => expect(screen.queryByRole('heading', { name: /Registrar nuevo técnico/ })).toBeNull());
  });

  it('filtra por nombre y muestra el estado sin resultados', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('ANA TORRES');
    // Act
    await usuario.type(screen.getByPlaceholderText(/Buscar por nombre/), 'zzz');
    // Assert
    expect(await screen.findByText('Sin resultados')).toBeTruthy();
  });

  it('muestra el error de carga y permite reintentar', async () => {
    // Arrange
    apiMock.get.mockRejectedValueOnce(new Error('sin red')).mockRejectedValueOnce(new Error('sin red'));
    montar();
    // Assert
    expect(await screen.findByText('No se pudieron cargar los técnicos')).toBeTruthy();
    // Act: el reintento vuelve a consultar y ahora responde.
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/especializaciones') return { data: ESPECIALIDADES };
      return { data: [ACTIVO] };
    });
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    // Assert
    expect(await screen.findByText('ANA TORRES')).toBeTruthy();
  });

  it('registra un técnico con especializaciones y limpia el formulario', async () => {
    // Arrange
    red();
    apiMock.post.mockResolvedValue({ data: { id_usuario: 103 } });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('ANA TORRES');
    // Act
    await usuario.click(screen.getByRole('button', { name: 'Registrar técnico' }));
    await usuario.type(screen.getByLabelText(/Nombre/), 'Carla');
    await usuario.type(screen.getByLabelText(/Apellidos/), 'Nieto');
    await usuario.type(screen.getByLabelText(/Correo/), 'carla.nieto@neodomus.com');
    await usuario.type(screen.getByLabelText(/Contraseña de acceso/), 'secreto123');
    await usuario.type(screen.getByLabelText(/Teléfono/), '3005556677');
    await usuario.type(screen.getByLabelText(/Documento/), '10101010');
    await usuario.click(screen.getByRole('button', { name: /Seleccionar especializaciones/ }));
    await usuario.click(screen.getByRole('option', { name: /Climatización/ }));
    await usuario.click(screen.getByRole('button', { name: 'Crear técnico' }));
    // Assert
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/users', expect.objectContaining({
      first_name: 'Carla', last_name: 'Nieto', email: 'carla.nieto@neodomus.com',
      password: 'secreto123', id_rol: 2, telefono_usuario: 3005556677,
      documento_usuario: 10101010, especializaciones_ids: [2],
    })));
    expect(await screen.findByText(/Técnico registrado/)).toBeTruthy();
  });

  it('rechaza una contraseña corta al crear', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('ANA TORRES');
    await usuario.click(screen.getByRole('button', { name: 'Registrar técnico' }));
    await usuario.type(screen.getByLabelText(/Nombre/), 'Carla');
    await usuario.type(screen.getByLabelText(/Apellidos/), 'Nieto');
    await usuario.type(screen.getByLabelText(/Correo/), 'carla.nieto@neodomus.com');
    await usuario.type(screen.getByLabelText(/Contraseña de acceso/), '123');
    // Act: el submit nativo se dispara aunque el campo tenga minLength.
    fireEvent.submit(screen.getByRole('button', { name: 'Crear técnico' }).closest('form')!);
    // Assert
    expect(await screen.findByText('La contraseña debe tener al menos 6 caracteres')).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('edita los datos y cambia la contraseña solo si se marca la casilla', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('ANA TORRES');
    // Act
    await usuario.click(screen.getAllByRole('button', { name: /Editar/ })[0]);
    const email = screen.getByLabelText(/Correo/) as HTMLInputElement;
    expect(email.disabled).toBe(true);
    await usuario.clear(screen.getByLabelText(/Teléfono/));
    await usuario.type(screen.getByLabelText(/Teléfono/), '3112223344');
    await usuario.click(screen.getByLabelText(/Cambiar la contraseña de acceso/));
    await usuario.type(screen.getByLabelText(/Nueva contraseña/), 'nuevaClave9');
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/users/101', expect.objectContaining({
      first_name: 'Ana', last_name: 'Torres', email: 'ana.torres@neodomus.com',
      telefono_usuario: 3112223344, password: 'nuevaClave9',
    })));
    expect(await screen.findByText('Técnico actualizado correctamente')).toBeTruthy();
  });

  it('inhabilita con motivo y fecha, y envía el payload esperado', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('ANA TORRES');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Desactivar/ }));
    const dialogo = screen.getByRole('heading', { name: 'Desactivar a ANA TORRES' }).closest('form')!;
    await usuario.type(within(dialogo).getByLabelText(/Motivo de la inhabilitación/), 'Incumplimiento de ruta');
    fireEvent.change(within(dialogo).getByLabelText(/Inhabilitar hasta/), { target: { value: '2030-02-01T08:00' } });
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/users/101', expect.objectContaining({
      is_active: false, motivo: 'Incumplimiento de ruta',
    })));
    const payload = apiMock.put.mock.calls[0][1] as { desactivado_hasta: string | null };
    expect(payload.desactivado_hasta).toBeTruthy();
    expect(await screen.findByText(/ANA TORRES desactivado/)).toBeTruthy();
  });

  it('edita sin cambiar contraseña ni enviar campos opcionales vacíos', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('ANA TORRES');
    await usuario.click(screen.getAllByRole('button', { name: /Editar/ })[0]);
    await usuario.clear(screen.getByLabelText(/Teléfono/));
    await usuario.clear(screen.getByLabelText(/Documento/));
    // Act
    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalled());
    const payload = apiMock.put.mock.calls[0][1] as Record<string, unknown>;
    expect(payload).not.toHaveProperty('password');
    expect(payload).not.toHaveProperty('telefono_usuario');
    expect(payload).not.toHaveProperty('documento_usuario');
  });

  it('inhabilita sin fecha y deja desactivado_hasta en null', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('ANA TORRES');
    await usuario.click(screen.getByRole('button', { name: /Desactivar/ }));
    const dialogo = screen.getByRole('heading', { name: 'Desactivar a ANA TORRES' }).closest('form')!;
    await usuario.type(within(dialogo).getByLabelText(/Motivo de la inhabilitación/), 'Reasignación de zona');
    // Act
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar' }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/users/101', {
      is_active: false, motivo: 'Reasignación de zona', desactivado_hasta: null,
    }));
    expect(await screen.findByText('ANA TORRES desactivado')).toBeTruthy();
  });

  it('habilita una cuenta inactiva', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('BETO RUIZ');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Habilitar/ }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/users/102', { is_active: true }));
    expect(await screen.findByText(/BETO RUIZ habilitado correctamente/)).toBeTruthy();
  });

  it('abre el historial y navega por servicios, entregas y devoluciones', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('ANA TORRES');
    // Act
    await usuario.click(screen.getAllByRole('button', { name: /Historial/ })[0]);
    // Assert
    const dialogo = await screen.findByRole('dialog');
    expect(await within(dialogo).findByText('Instalación')).toBeTruthy();
    expect(within(dialogo).getByText('Cliente: Carolina Mendez')).toBeTruthy();
    await usuario.click(within(dialogo).getByRole('button', { name: /Entregas \(1\)/ }));
    expect(await within(dialogo).findByText('Pedido #88')).toBeTruthy();
    await usuario.click(within(dialogo).getByRole('button', { name: /Devoluciones \(1\)/ }));
    expect(await within(dialogo).findByText('Devolución #9')).toBeTruthy();
    expect(within(dialogo).getByText('Producto: Sensor')).toBeTruthy();
    // Act: el filtro de texto del historial oculta las tarjetas.
    await usuario.type(within(dialogo).getByPlaceholderText('Buscar...'), 'inexistente');
    // Assert
    expect(await within(dialogo).findByText('No hay devoluciones que coincidan.')).toBeTruthy();
  });
});
