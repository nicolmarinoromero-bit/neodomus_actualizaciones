// Semana 5 del bootcamp — TecnicoCitas (agenda del técnico).
// Cubre estadísticas, listado de citas activas, búsqueda y filtros,
// paginación, comisiones y el flujo de reagendamiento (horas disponibles,
// confirmación, error y validación de domingos). Red y sesión simuladas.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@components/tecnico/NuevaNovedadModal', () => ({ default: () => null }));

import TecnicoCitas from './TecnicoCitas';

const BASE = {
  fecha: '2026-11-16',
  hora: '09:00',
  estado: 'Pendiente',
  tipo_servicio: 'instalacion',
  cliente: 'Carolina Méndez',
  direccion: 'Calle 100 # 20-30',
  telefono: 3105027488,
  email: 'carolina@example.com',
  documento_tipo: 'CC',
  documento_numero: 10203040,
  descripcion: 'Instalar dos cámaras',
  id_tecnico: 1,
  nombre_tecnico: 'Andrés Técnico',
  id_comision_c: 12,
  comision_porcentaje: 10,
  comision_valor: 12000,
};

const CITA_CONFIRMADA = {
  ...BASE,
  id_cita: 2,
  fecha: '2026-11-17',
  hora: '11:00',
  estado: 'Confirmada',
  tipo_servicio: 'mantenimiento',
  cliente: 'Luis Pérez',
  documento_numero: 99887766,
  descripcion: 'Mantenimiento preventivo',
  comision_porcentaje: null,
  comision_valor: null,
};

const CITA_FINALIZADA = {
  ...BASE,
  id_cita: 3,
  fecha: '2026-11-10',
  hora: '15:00',
  estado: 'Finalizada',
  cliente: 'Ana Torres',
};

const CITA_1 = { ...BASE, id_cita: 1 };

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <TecnicoCitas />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function responder(citas: any[] = [CITA_1, CITA_CONFIRMADA, CITA_FINALIZADA]) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/tecnicos/mis-citas') return { data: citas };
    if (url.includes('/horas-disponibles')) return { data: ['09:00', '10:00'] };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

beforeEach(() => {
  vi.useRealTimers();
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  apiMock.put.mockResolvedValue({ data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TecnicoCitas — listado y estadísticas', () => {
  it('muestra solo las citas activas con sus datos, badges y comisiones', async () => {
    // Arrange
    responder();
    montar();
    // Assert
    expect(await screen.findByText('Carolina Méndez')).toBeTruthy();
    expect(screen.getByText('Luis Pérez')).toBeTruthy();
    expect(screen.queryByText('Ana Torres')).toBeNull();
    // Estadísticas.
    expect(screen.getByText('Pendientes').nextSibling?.textContent).toBe('1');
    expect(screen.getByText('Confirmadas').nextSibling?.textContent).toBe('1');
    expect(screen.getByText('Total Activas').nextSibling?.textContent).toBe('2');
    // Datos de la cita.
    expect(screen.getByText('CC 10203040')).toBeTruthy();
    expect(screen.getAllByText('3105027488').length).toBeGreaterThan(0);
    expect(screen.getAllByText('carolina@example.com').length).toBeGreaterThan(0);
    expect(screen.getByText('Instalar dos cámaras')).toBeTruthy();
    expect(screen.getAllByText('Calle 100 # 20-30').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Andrés Técnico').length).toBeGreaterThan(0);
    expect(screen.getByText(/Comisi.*10%/)).toBeTruthy();
    expect(screen.getByText(/Sin comisi/)).toBeTruthy();
    expect(screen.getByText(/Tienes 2 citas pendientes por completar/)).toBeTruthy();
    // El id de cita se muestra en el encabezado de cada tarjeta.
    expect(screen.getByText('#1')).toBeTruthy();
    expect(screen.getByText('#2')).toBeTruthy();
  });

  it('sin citas muestra el estado vacío', async () => {
    // Arrange
    responder([]);
    montar();
    // Assert
    expect(await screen.findByText(/No tienes citas pendientes ni confirmadas/)).toBeTruthy();
    expect(screen.getByText(/Cuando un cliente agende un servicio/)).toBeTruthy();
  });

  it('la búsqueda filtra por cliente, documento y servicio; sin coincidencias avisa', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Méndez');
    const buscador = screen.getByPlaceholderText(/Buscar por cliente/);
    // Act: por cliente.
    await usuario.type(buscador, 'luis');
    // Assert
    expect(screen.getByText('Luis Pérez')).toBeTruthy();
    expect(screen.queryByText('Carolina Méndez')).toBeNull();
    // Act: por documento.
    await usuario.clear(buscador);
    await usuario.type(buscador, '10203040');
    // Assert
    expect(screen.getByText('Carolina Méndez')).toBeTruthy();
    expect(screen.queryByText('Luis Pérez')).toBeNull();
    // Act: sin coincidencias.
    await usuario.clear(buscador);
    await usuario.type(buscador, 'zzz');
    // Assert
    expect(await screen.findByText(/No hay citas que coincidan/)).toBeTruthy();
  });

  it('filtra por fecha y por hora y permite quitar el filtro', async () => {
    // Arrange
    responder();
    montar();
    await screen.findByText('Carolina Méndez');
    const fecha = document.querySelector('input[type="date"]') as HTMLInputElement;
    const hora = screen.getByRole('combobox');
    // Act: fecha de la cita confirmada.
    fireEvent.change(fecha, { target: { value: '2026-11-17' } });
    // Assert
    expect(screen.getByText('Luis Pérez')).toBeTruthy();
    expect(screen.queryByText('Carolina Méndez')).toBeNull();
    // Act: quitar filtro de fecha.
    await userEvent.click(screen.getByRole('button', { name: /Quitar filtro/ }));
    // Assert
    expect(screen.getByText('Carolina Méndez')).toBeTruthy();
    // Act: filtrar por hora 11:00.
    fireEvent.change(hora, { target: { value: '11:00' } });
    // Assert
    expect(screen.getByText('Luis Pérez')).toBeTruthy();
    expect(screen.queryByText('Carolina Méndez')).toBeNull();
  });
});

describe('TecnicoCitas — paginación', () => {
  it('pagina las citas de seis en seis', async () => {
    // Arrange: ocho citas activas con clientes distinguibles.
    const citas = Array.from({ length: 8 }, (_, i) => ({
      ...BASE,
      id_cita: 100 + i,
      cliente: `Cliente ${i + 1}`,
      fecha: `2026-11-${String(16 + i).padStart(2, '0')}`,
      comision_valor: null,
      comision_porcentaje: null,
    }));
    responder(citas);
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Cliente 1');
    // Assert: primera página.
    expect(screen.getByText('Cliente 6')).toBeTruthy();
    expect(screen.queryByText('Cliente 7')).toBeNull();
    expect((screen.getByRole('button', { name: '1' }) as HTMLElement).className).toContain('active');
    // Act: siguiente.
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }));
    // Assert: segunda página.
    expect(screen.getByText('Cliente 7')).toBeTruthy();
    expect(screen.getByText('Cliente 8')).toBeTruthy();
    expect(screen.queryByText('Cliente 1')).toBeNull();
    // Act: volver con el número de página.
    await usuario.click(screen.getByRole('button', { name: '1' }));
    // Assert
    expect(screen.getByText('Cliente 1')).toBeTruthy();
  });
});

describe('TecnicoCitas — reagendamiento', () => {
  it('abre el modal, carga horas, confirma y notifica el éxito', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Méndez');
    // Act: abrir reagendar de la primera cita.
    await usuario.click(screen.getAllByRole('button', { name: /Reagendar/ })[0]);
    // Assert: modal con datos de la cita y horas cargadas para la fecha actual.
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText('Reagendar cita')).toBeTruthy();
    expect(within(dialogo).getByText('Datos de la cita')).toBeTruthy();
    expect(within(dialogo).getByText('Calle 100 # 20-30')).toBeTruthy();
    expect(within(dialogo).getByText('Andrés Técnico')).toBeTruthy();
    expect(within(dialogo).getByText('Instalar dos cámaras')).toBeTruthy();
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith('/tecnicos/citas/1/horas-disponibles', {
        params: { fecha: '2026-11-16' },
      }),
    );
    const hora = await within(dialogo).findByRole('button', { name: '10:00' });
    // Act: elegir hora y confirmar.
    await usuario.click(hora);
    await usuario.click(within(dialogo).getByRole('button', { name: /Confirmar reagendamiento/ }));
    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/tecnicos/citas/1/reagendar', {
        fecha: '2026-11-16',
        hora: '10:00',
        id_comision: 12,
      }),
    );
    expect(await screen.findByText(/Cita reagendada correctamente/)).toBeTruthy();
    // La lista se refresca.
    await waitFor(() => expect(apiMock.get.mock.calls.filter(([u]) => u === '/tecnicos/mis-citas').length).toBeGreaterThan(1));
  });

  it('muestra el detalle del backend si el reagendamiento falla', async () => {
    // Arrange
    responder();
    apiMock.put.mockRejectedValue({ response: { data: { detail: 'Horario ya ocupado' } } });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Méndez');
    // Act
    await usuario.click(screen.getAllByRole('button', { name: /Reagendar/ })[0]);
    const dialogo = await screen.findByRole('dialog');
    await usuario.click(await within(dialogo).findByRole('button', { name: '09:00' }));
    await usuario.click(within(dialogo).getByRole('button', { name: /Confirmar reagendamiento/ }));
    // Assert
    expect(await screen.findByText('Horario ya ocupado')).toBeTruthy();
  });

  it('rechaza los domingos y avisa cuando no hay horas disponibles', async () => {
    // Arrange: sin horas disponibles para la fecha elegida.
    responder();
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/tecnicos/mis-citas') return { data: [CITA_1] };
      return { data: [] };
    });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Méndez');
    await usuario.click(screen.getAllByRole('button', { name: /Reagendar/ })[0]);
    const dialogo = await screen.findByRole('dialog');
    // Act: domingo 15 de noviembre de 2026.
    const fecha = within(dialogo).getByDisplayValue('2026-11-16') as HTMLInputElement;
    fireEvent.change(fecha, { target: { value: '2026-11-15' } });
    // Assert
    expect(await screen.findByText(/Los domingos no est/)).toBeTruthy();
    // La fecha no cambió y se muestran las horas originales (vacías).
    expect(fecha.value).toBe('2026-11-16');
    expect(within(dialogo).getByText(/No hay horarios disponibles/)).toBeTruthy();
  });

  it('permite cancelar el reagendamiento y cerrar con la X', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Méndez');
    // Act: abrir y cancelar con el botón.
    await usuario.click(screen.getAllByRole('button', { name: /Reagendar/ })[0]);
    let dialogo = await screen.findByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Act: abrir y cerrar con la X.
    await usuario.click(screen.getAllByRole('button', { name: /Reagendar/ })[0]);
    dialogo = await screen.findByRole('dialog');
    fireEvent.click(dialogo.querySelector('.ap-modal-x') as HTMLElement);
    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
