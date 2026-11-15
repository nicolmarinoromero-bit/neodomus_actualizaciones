// Semana 8 del bootcamp — facturas del administrador (AdminFacturas).
// Cubre carga, error con aviso, estado vacío, tabla de pedidos y citas,
// búsqueda por varios campos, descarga de PDF y refresco silencioso. Red y
// descarga simuladas.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock, descargarMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn() },
  descargarMock: vi.fn(),
}));
vi.mock('@services/api', () => ({
  default: apiMock,
  descargarFactura: descargarMock,
}));

import AdminFacturas from './AdminFacturas';

const FACTURAS = [
  {
    id_factura: 1,
    numero_factura: 'FAC-2026-0001',
    fecha_factura: '2026-11-10T15:30:00',
    monto_total: 1849200,
    metodo_pago: 'tarjeta',
    estado_pago: 'Pagada',
    enviada_por_correo: true,
    nombre_cliente: 'Carolina Mendez',
    email_cliente: 'carolina@neodomus.com',
    pedido: { id_pedido: 501, total: 1849200, estado: 'Entregado' },
    cita: null,
    pdf_url: '/api/v1/facturas/1/pdf',
  },
  {
    id_factura: 2,
    numero_factura: 'FAC-2026-0002',
    fecha_factura: null,
    monto_total: 350000,
    metodo_pago: null,
    estado_pago: null,
    enviada_por_correo: false,
    nombre_cliente: 'Luis Perez',
    email_cliente: null,
    pedido: null,
    cita: { id_cita: 77, tipo_servicio: 'Instalación', fecha: null, costo: 350000 },
    pdf_url: null,
  },
];

function montar() {
  return render(
    <IdiomaProvider>
      <AdminFacturas />
    </IdiomaProvider>,
  );
}

describe('AdminFacturas', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    descargarMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el cargador mientras consulta las facturas', () => {
    // Arrange
    apiMock.get.mockReturnValue(new Promise(() => {}));

    // Act
    montar();

    // Assert
    expect(screen.getByText('Cargando facturas...')).toBeTruthy();
  });

  it('un fallo de carga muestra el aviso y el estado vacío', async () => {
    // Arrange
    apiMock.get.mockRejectedValue(new Error('sin red'));

    // Act
    montar();

    // Assert
    expect(await screen.findByText('Error al cargar facturas')).toBeTruthy();
    expect(screen.getByText('No hay facturas registradas.')).toBeTruthy();
  });

  it('sin facturas muestra el estado vacío y el contador en cero', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: [] });

    // Act
    montar();

    // Assert
    expect(await screen.findByText('No hay facturas registradas.')).toBeTruthy();
    expect(screen.getByText('0 factura(s)')).toBeTruthy();
  });

  it('lista facturas de pedido y de cita con sus datos y acciones', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: FACTURAS });

    // Act
    montar();
    await screen.findByText('FAC-2026-0001');

    // Assert: pedido con PDF y correo enviado.
    const filaPedido = screen.getByText('FAC-2026-0001').closest('tr') as HTMLElement;
    expect(within(filaPedido).getByText('Carolina Mendez')).toBeTruthy();
    expect(within(filaPedido).getByText('Pedido')).toBeTruthy();
    expect(within(filaPedido).getByText('#501')).toBeTruthy();
    expect(within(filaPedido).getByText(/1\D?849\D?200/)).toBeTruthy();
    expect(within(filaPedido).getByText('Pagada')).toBeTruthy();
    expect(within(filaPedido).getByTitle('Enviada')).toBeTruthy();
    expect(within(filaPedido).getByTitle('Descargar PDF')).toBeTruthy();

    // Assert: cita sin PDF ni correo.
    const filaCita = screen.getByText('FAC-2026-0002').closest('tr') as HTMLElement;
    expect(within(filaCita).getByText('Luis Perez')).toBeTruthy();
    expect(within(filaCita).getByText('Cita')).toBeTruthy();
    expect(within(filaCita).getByText('Cita #77')).toBeTruthy();
    expect(within(filaCita).getByText(/350\D?000/)).toBeTruthy();
    expect(within(filaCita).getByTitle('No enviada')).toBeTruthy();
    expect(within(filaCita).queryByTitle('Descargar PDF')).toBeNull();
    expect(screen.getByText('2 factura(s)')).toBeTruthy();
  });

  it('la búsqueda filtra por número, cliente, correo, pedido y cita', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: FACTURAS });
    montar();
    await screen.findByText('FAC-2026-0001');
    const usuario = userEvent.setup();
    const buscador = screen.getByPlaceholderText(/Buscar por .*cliente/i);

    // Act / Assert: por número.
    await usuario.type(buscador, '0002');
    expect(screen.getByText('FAC-2026-0002')).toBeTruthy();
    expect(screen.queryByText('FAC-2026-0001')).toBeNull();

    // Act / Assert: por correo.
    await usuario.clear(buscador);
    await usuario.type(buscador, 'carolina@');
    expect(screen.getByText('FAC-2026-0001')).toBeTruthy();
    expect(screen.queryByText('FAC-2026-0002')).toBeNull();

    // Act / Assert: por id de pedido.
    await usuario.clear(buscador);
    await usuario.type(buscador, '501');
    expect(screen.getByText('FAC-2026-0001')).toBeTruthy();
    expect(screen.getByText('1 factura(s)')).toBeTruthy();

    // Act / Assert: por id de cita.
    await usuario.clear(buscador);
    await usuario.type(buscador, '77');
    expect(screen.getByText('FAC-2026-0002')).toBeTruthy();

    // Act / Assert: sin coincidencias.
    await usuario.clear(buscador);
    await usuario.type(buscador, 'zzz');
    expect(screen.getByText('No hay facturas registradas.')).toBeTruthy();
    expect(screen.getByText('0 factura(s)')).toBeTruthy();
  });

  it('descarga el PDF y deshabilita el botón mientras dura la petición', async () => {
    // Arrange: descarga controlada.
    apiMock.get.mockResolvedValue({ data: [FACTURAS[0]] });
    let resolver: () => void = () => {};
    descargarMock.mockReturnValue(new Promise<void>((resolve) => { resolver = resolve; }));
    montar();
    await screen.findByText('FAC-2026-0001');

    // Act
    const boton = screen.getByTitle('Descargar PDF') as HTMLButtonElement;
    fireEvent.click(boton);

    // Assert: petición en curso.
    expect(descargarMock).toHaveBeenCalledWith('/api/v1/facturas/1/pdf');
    await waitFor(() => expect(boton.disabled).toBe(true));

    // Act: termina la descarga.
    resolver();

    // Assert
    await waitFor(() => expect(boton.disabled).toBe(false));
  });

  it('un fallo de descarga muestra el aviso de error', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: [FACTURAS[0]] });
    descargarMock.mockRejectedValue(new Error('sin archivo'));
    montar();
    await screen.findByText('FAC-2026-0001');

    // Act
    fireEvent.click(screen.getByTitle('Descargar PDF'));

    // Assert
    expect(await screen.findByText('Error al descargar la factura')).toBeTruthy();
    expect((screen.getByTitle('Descargar PDF') as HTMLButtonElement).disabled).toBe(false);
  });
});