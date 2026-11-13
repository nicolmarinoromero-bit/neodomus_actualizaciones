// Semana 4 del bootcamp — panel admin de clientes.
// Listado con conteos y estado de cuenta, búsqueda, detalle con historial de
// pedidos/servicios/devoluciones, descarga de factura y acciones de
// inhabilitar/habilitar con confirmación. Red simulada.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));

import AdminClientes from './AdminClientes';

const ACTIVO = {
  id_cliente: 7, first_name: 'Carolina', last_name: 'Mendez',
  email: 'carolina@example.com', telefono_cliente: 3001234567,
  documento_cliente: 1090284721, address: 'Calle Cliente 123',
  created_at: '2025-01-10T00:00:00Z', pedidos_count: 2, citas_count: 1, is_active: true,
};
const INACTIVO = {
  ...ACTIVO, id_cliente: 8, first_name: 'Luis', last_name: 'Pérez',
  email: 'luis@example.com', telefono_cliente: null, documento_cliente: null,
  pedidos_count: 0, citas_count: 0, is_active: false,
};

const PEDIDO = {
  id_pedido: 88, fecha: '2026-10-01', total: 120000, estado: 'Pagado',
  estado_entrega: 'Entregado',
  detalles: [{
    nombre: 'Panel LED', cantidad: 2, precio_unitario: 50000,
    subtotal: 100000, es_servicio: false,
  }],
  pago: { metodo_pago: 'Tarjeta', estado: 'aprobado', monto: 120000 },
  factura: { numero_factura: 'FV-1', monto_total: 120000, pdf_url: null },
};
const SERVICIO = {
  id_cita: 70, tipo_servicio: 'Instalación', fecha: '2026-10-02', hora: '09:00',
  direccion: 'Calle Cliente 123', descripcion: 'Instalación de panel',
  estado: 'Finalizada', costo_cita: 80000, metodo_pago: 'Efectivo',
  estado_pago: 'pagado', nombre_tecnico: 'Ana Torres',
};
const DEVOLUCION = {
  id_devolucion: 9, motivo: 'Producto dañado', descripcion: 'Llegó roto',
  estado: 'Aprobada', cantidad: 2, created_at: '2026-10-03',
  resuelta_at: '2026-10-05', pedido: { id_pedido: 88, total: 120000 },
  producto: { id_producto: 1, nombre: 'Panel LED' },
};

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <AdminClientes />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function red(clientes: unknown[] = [ACTIVO, INACTIVO]) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/clients') return { data: clientes };
    if (url === '/clients/7/pedidos') return { data: [PEDIDO] };
    if (url === '/clients/7/servicios') return { data: [SERVICIO] };
    if (url === '/clients/7/devoluciones') return { data: [DEVOLUCION] };
    if (url === '/pedidos/admin/88/factura') return { data: new Blob(['pdf'], { type: 'application/pdf' }) };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

function panelDetalle() {
  return screen.getByRole('heading', { name: 'Detalle del cliente' }).closest('.modal-content') as HTMLElement;
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  vi.restoreAllMocks();
});

describe('AdminClientes — listado', () => {
  it('muestra datos de contacto, conteos y estado de la cuenta', async () => {
    // Arrange
    red();
    montar();
    // Assert
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('Carolina Mendez')).toBeTruthy();
    expect(within(tabla).getByText('carolina@example.com')).toBeTruthy();
    expect(within(tabla).getByText('3001234567')).toBeTruthy();
    expect(within(tabla).getByText('2 pedidos')).toBeTruthy();
    expect(within(tabla).getByText('1 citas')).toBeTruthy();
    expect(within(tabla).getByText('Activa')).toBeTruthy();
    expect(within(tabla).getByText('Inhabilitada')).toBeTruthy();
    expect(screen.getByText('2 clientes registrados en el sistema')).toBeTruthy();
  });

  it('filtra por correo o documento y muestra el estado vacío', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    // Act
    await usuario.type(screen.getByPlaceholderText(/Buscar por nombre/), '1090284721');
    // Assert: solo queda la clienta que coincide por documento.
    await waitFor(() => expect(screen.queryByText('Luis Pérez')).toBeNull());
    expect(screen.getByText('Carolina Mendez')).toBeTruthy();
    // Act
    await usuario.clear(screen.getByPlaceholderText(/Buscar por nombre/));
    await usuario.type(screen.getByPlaceholderText(/Buscar por nombre/), 'zzz');
    // Assert
    expect(await screen.findByText('Sin resultados')).toBeTruthy();
  });

  it('muestra el error de carga y permite reintentar', async () => {
    // Arrange
    apiMock.get.mockRejectedValue(new Error('sin red'));
    montar();
    // Assert
    expect(await screen.findByText('No se pudieron cargar los clientes')).toBeTruthy();
    // Act
    red();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    // Assert
    expect(await screen.findByText('Carolina Mendez')).toBeTruthy();
  });
});

describe('AdminClientes — detalle', () => {
  it('abre el historial de pedidos con productos, pago y factura', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    // Act
    await usuario.click(screen.getByRole('button', { name: '2 pedidos' }));
    // Assert
    const panel = panelDetalle();
    expect(await within(panel).findByText('Pedido #88')).toBeTruthy();
    expect(within(panel).getByText('Panel LED x2')).toBeTruthy();
    expect(within(panel).getByText(/Total: \$120[,.]000/)).toBeTruthy();
    expect(within(panel).getByText('Tarjeta · aprobado')).toBeTruthy();
    expect(within(panel).getByRole('button', { name: 'Factura PDF' })).toBeTruthy();
    expect(within(panel).getByText('Tel: 3001234567 · Doc: 1090284721')).toBeTruthy();
  });

  it('navega a servicios y devoluciones y filtra el historial', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    await usuario.click(screen.getByRole('button', { name: '2 pedidos' }));
    const panel = panelDetalle();
    // Act
    await usuario.click(within(panel).getByRole('button', { name: /Servicios \(1\)/ }));
    // Assert
    expect(await within(panel).findByText('Instalación')).toBeTruthy();
    expect(within(panel).getByText('Técnico: Ana Torres')).toBeTruthy();
    expect(within(panel).getByText('Descripción: Instalación de panel')).toBeTruthy();
    // Act
    await usuario.click(within(panel).getByRole('button', { name: /Devoluciones \(1\)/ }));
    // Assert
    expect(await within(panel).findByText('Devolución #9')).toBeTruthy();
    expect(within(panel).getByText('Producto: Panel LED (x2)')).toBeTruthy();
    expect(within(panel).getByText('Motivo: Producto dañado')).toBeTruthy();
    // Act: filtro de historial sin coincidencias.
    await usuario.type(within(panel).getByPlaceholderText('Buscar...'), 'inexistente');
    // Assert
    expect(await within(panel).findByText('No hay devoluciones que coincidan.')).toBeTruthy();
  });

  it('muestra los estados vacíos del historial cuando no hay registros', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    const fila = (await screen.findByText('Luis Pérez')).closest('tr')!;
    // Act: el detalle del cliente inactivo no tiene historial (las rutas fallan).
    await usuario.click(within(fila).getAllByRole('button')[0]);
    const panel = panelDetalle();
    // Assert
    expect(await within(panel).findByText('Este cliente no tiene pedidos registrados.')).toBeTruthy();
    await usuario.click(within(panel).getByRole('button', { name: /Servicios \(0\)/ }));
    expect(within(panel).getByText('Este cliente no tiene servicios registrados.')).toBeTruthy();
    await usuario.click(within(panel).getByRole('button', { name: /Devoluciones \(0\)/ }));
    expect(within(panel).getByText('Este cliente no tiene devoluciones registradas.')).toBeTruthy();
  });

  it('informa si la factura no se puede descargar', async () => {
    // Arrange
    red();
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    await usuario.click(screen.getByRole('button', { name: '2 pedidos' }));
    const panel = panelDetalle();
    apiMock.get.mockRejectedValueOnce(new Error('sin factura'));
    // Act
    await usuario.click(within(panel).getByRole('button', { name: 'Factura PDF' }));
    // Assert
    await waitFor(() => expect(alerta).toHaveBeenCalled());
  });

  it('descarga la factura del pedido como PDF', async () => {
    // Arrange
    red();
    const abrir = vi.spyOn(window, 'open').mockImplementation(() => null);
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    await usuario.click(screen.getByRole('button', { name: '2 pedidos' }));
    const panel = panelDetalle();
    // Act
    await usuario.click(within(panel).getByRole('button', { name: 'Factura PDF' }));
    // Assert
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/pedidos/admin/88/factura', { responseType: 'blob' }));
    expect(abrir).toHaveBeenCalledWith(expect.stringMatching(/^blob:test\//), '_blank');
  });
});

describe('AdminClientes — inhabilitar y habilitar', () => {
  it('inhabilitar pide confirmación y llama al endpoint', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Inhabilitar$/ }));
    const dialogo = screen.getByRole('heading', { name: 'Inhabilitar cuenta' }).closest('.modal-confirm-dialog') as HTMLElement;
    expect(within(dialogo).getByText(/¿Estás seguro de inhabilitar la cuenta de Carolina Mendez\?/)).toBeTruthy();
    await usuario.click(within(dialogo).getByRole('button', { name: 'Inhabilitar' }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/clients/7/inhabilitar'));
  });

  it('cancelar la confirmación no ejecuta la acción', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Inhabilitar$/ }));
    const dialogo = screen.getByRole('heading', { name: 'Inhabilitar cuenta' }).closest('.modal-confirm-dialog') as HTMLElement;
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cancelar' }));
    // Assert
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Inhabilitar cuenta' })).toBeNull());
    expect(apiMock.put).not.toHaveBeenCalled();
  });

  it('habilita una cuenta inactiva', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Luis Pérez');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Habilitar$/ }));
    const dialogo = screen.getByRole('heading', { name: 'Habilitar cuenta' }).closest('.modal-confirm-dialog') as HTMLElement;
    await usuario.click(within(dialogo).getByRole('button', { name: 'Habilitar' }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/clients/8/habilitar'));
  });
});
