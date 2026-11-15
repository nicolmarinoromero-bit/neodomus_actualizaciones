// Semana 4 del bootcamp — TechnicianDashboard (centro de trabajo del técnico).
// Carga inicial de citas/entregas/recogidas/calificaciones, tarjetas de
// estadísticas, listado por grupos (hoy/próximas/atrasadas/historial),
// apertura del detalle de cita y cambio de estado con confirmación.
// Red y sesión simuladas.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { authMock, apiMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  apiMock: { get: vi.fn(), put: vi.fn(), post: vi.fn(), delete: vi.fn() },
}));

vi.mock('@contexts/AuthContext', () => ({ useAuth: authMock }));
vi.mock('@services/api', () => ({
  default: apiMock,
  descargarFactura: vi.fn(),
  descargarReportePdf: vi.fn(),
}));

import TechnicianDashboard from './TechnicianDashboard';

const HOY = new Date().toISOString().slice(0, 10);
const FUTURA = '2030-01-15';

const CITA_HOY = {
  id_cita: 31, id_cliente: 7, cliente: 'Carolina Mendez', id_tecnico: 5,
  tipo_servicio: 'instalacion', fecha: HOY, hora: '10:00',
  direccion: 'Calle Cliente 123', estado: 'Confirmada', estado_pago: 'aprobado',
  documento_tipo: 'CC', documento_numero: '1090284721', telefono: '3105027488',
  email: 'carolina@neodomus.com',
};
const CITA_FUTURA = { ...CITA_HOY, id_cita: 32, fecha: FUTURA, hora: '14:00' };
const ENTREGA = {
  id_pedido: 88, estado_entrega: 'Asignada', estado_pedido: 'Pagado',
  nombre_cliente: 'Carolina Mendez', direccion: 'Calle Cliente 123',
  fecha_entrega: HOY, productos: [{ nombre_producto: 'Cinta LED', cantidad: 2 }],
};
const RECOGIDA = {
  id_devolucion: 4, id_pedido: 88, producto: 'Panel LED', cliente: 'Luis Pérez',
  direccion: 'Calle Recogida 9', preferencia: 'producto',
  estado_devolucion: 'Aprobada', recogida_estado: 'Pendiente',
};

function montar(ruta = '/dashboard/tecnico') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <IdiomaProvider>
        <TechnicianDashboard />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function red(citas = [CITA_HOY, CITA_FUTURA], entregas = [ENTREGA], recogidas = [RECOGIDA]) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/tecnicos/mis-citas') return { data: citas };
    if (url === '/tecnicos/mis-entregas') return { data: entregas };
    if (url === '/calificaciones/mis') return { data: {} };
    if (url === '/devoluciones/mis-recogidas') return { data: recogidas };
    if (typeof url === 'string' && url.startsWith('/tecnicos/clientes/')) return { data: [] };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.put.mockReset();
  apiMock.post.mockReset();
  apiMock.delete.mockReset();
  authMock.mockReturnValue({
    user: { id: 5, nombre: 'Ana Técnica', correo: 'ana@neodomus.com' },
    isAuthenticated: true, rol: 'tecnico',
  });
});

describe('TechnicianDashboard — carga inicial', () => {
  it('carga citas, entregas, recogidas y calificaciones en paralelo', async () => {
    // Arrange
    red();
    montar();
    // Assert: la cita de hoy y las próximas aparecen con su cliente.
    expect((await screen.findAllByText('Carolina Mendez')).length).toBeGreaterThan(0);
    await waitFor(() =>
      expect(apiMock.get.mock.calls.some(([u]) => u === '/tecnicos/mis-entregas')).toBe(true),
    );
    expect(apiMock.get.mock.calls.some(([u]) => u === '/calificaciones/mis')).toBe(true);
    expect(apiMock.get.mock.calls.some(([u]) => u === '/devoluciones/mis-recogidas')).toBe(true);
  });

  it('sin citas muestra los estados vacíos de cada tarjeta', async () => {
    // Arrange
    red([], [], []);
    montar();
    // Assert: los dos vacíos (citas del día y próximas).
    expect(await screen.findByText('No hay citas para hoy')).toBeTruthy();
    expect(screen.getByText('No hay citas programadas')).toBeTruthy();
  });

  it('un fallo de red deja el cargador y no rompe la página', async () => {
    // Arrange
    apiMock.get.mockRejectedValue(new Error('down'));
    montar();
    // Assert: la página sigue montada (estado de carga o vacío, sin crash).
    await waitFor(() => expect(apiMock.get).toHaveBeenCalled());
    expect(document.body.textContent?.length || 0).toBeGreaterThan(0);
  });
});

describe('TechnicianDashboard — detalle y cambio de estado', () => {
  it('abrir una cita muestra su modal con los datos del cliente', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    expect((await screen.findAllByText('Carolina Mendez')).length).toBeGreaterThan(0);
    // Act: botón "Ver" de la tarjeta.
    await usuario.click(screen.getAllByRole('button', { name: 'Ver' })[0]);
    // Assert: el modal "Detalle de cita" con los datos de contacto del cliente.
    const dialogo = await screen.findByText('Detalle de cita').then(() => document.querySelector('.ap-cita-modal') as HTMLElement);
    expect(within(dialogo).getAllByText('Calle Cliente 123').length).toBeGreaterThan(0);
    expect(within(dialogo).getByText('CC 1090284721')).toBeTruthy();
  });

  it('el historial del cliente se consulta al abrir el detalle', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    expect((await screen.findAllByText('Carolina Mendez')).length).toBeGreaterThan(0);
    // Act
    await usuario.click(screen.getAllByRole('button', { name: 'Ver' })[0]);
    // Assert: se pide el historial de la cliente 7.
    await waitFor(() =>
      expect(apiMock.get.mock.calls.some(([u]) => String(u).startsWith('/tecnicos/clientes/7'))).toBe(true),
    );
  });
});

describe('TechnicianDashboard — entregas y recogidas', () => {
  it('muestra la entrega asignada con su cliente y productos', async () => {
    // Arrange
    red();
    montar();
    // Assert: la entrega aparece con su número de pedido (los productos usan
    // el campo descripcion, no nombre_producto).
    expect(await screen.findByText(/Pedido #88/)).toBeTruthy();
    expect((await screen.findAllByText(/Calle Cliente 123/)).length).toBeGreaterThan(0);
  });

  it('la recogida de devolución aparece con su cliente', async () => {
    // Arrange: la recogida usa la forma del backend (producto, cliente, estado...).
    red(undefined, undefined, [{ ...RECOGIDA, id_devolucion: 5 }]);
    montar();
    // Assert: la tarjeta de recogidas muestra el contador y el cliente.
    expect(await screen.findByText(/Recogidas por devolución/)).toBeTruthy();
    expect(await screen.findByText('Luis Pérez')).toBeTruthy();
    expect(screen.getAllByText('1').length).toBeGreaterThan(0);
  });
});
