import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { descargarFactura } from '@services/api';
import FacturasTab from './FacturasTab';

vi.mock('@i18n/IdiomaContext', () => ({
  useIdioma: () => ({
    t: (clave: string, params?: { id?: number }) =>
      params?.id !== undefined ? `${clave}:${params.id}` : clave,
  }),
}));

vi.mock('@services/api', () => ({
  default: { get: vi.fn() },
  descargarFactura: vi.fn(),
}));

vi.mock('./SectionHeader', () => ({ default: () => null }));

const pedidos = [
  {
    id_pedido: 1,
    fecha: '2026-11-05T14:30:00',
    total: 350000,
    estado: 'Pagado',
    pago: { id_pago: 4, metodo_pago: 'Tarjeta', estado: 'Aprobado', numero_transaccion: 'TX-1' },
    factura: {
      id_factura: 8,
      numero_factura: 'FV-2026-0008',
      monto_total: 350000,
      enviada_por_correo: true,
      pdf_url: '/facturas/8.pdf',
    },
  },
  {
    id_pedido: 2,
    fecha: null,
    total: 120000,
    estado: 'Pago pendiente',
    pago: null,
    factura: {
      id_factura: 9,
      numero_factura: 'FV-2026-0009',
      monto_total: null,
      enviada_por_correo: false,
    },
  },
  {
    id_pedido: 3,
    fecha: '2026-11-06T09:00:00',
    total: 90000,
    estado: 'En proceso',
    pago: null,
    factura: null,
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('FacturasTab', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: pedidos });
  });

  it('lista solo los pedidos con factura y sus datos', async () => {
    render(<FacturasTab />);

    expect(await screen.findByText('FV-2026-0008')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/pedidos/mis-pedidos');
    expect(screen.getByText(/perfil\.facturas\.pedido:1 ·/)).toBeTruthy();
    expect(screen.getByText('Pagado')).toBeTruthy();
    expect(screen.getByText('Pago pendiente')).toBeTruthy();
    expect(screen.getAllByText('perfil.facturas.valorFacturado').length).toBe(2);
    expect(screen.getByText('perfil.facturas.metodoPago')).toBeTruthy();
    expect(screen.getByText('Tarjeta')).toBeTruthy();
    expect(screen.getByText('perfil.facturas.enviadaCorreo')).toBeTruthy();
    expect(screen.getByText('perfil.facturas.disponibleDescarga')).toBeTruthy();
    expect(screen.getByText('perfil.facturas.si')).toBeTruthy();
    expect(screen.queryByText('FV-del-pedido-sin-factura')).toBeNull();

    // El monto total nulo cae al total del pedido.
    expect(screen.getAllByText(/120\.000|120,000/).length).toBeGreaterThanOrEqual(1);
    // Solo la factura con PDF ofrece el botón de descarga.
    expect(
      screen.getAllByRole('button', { name: /perfil\.facturas\.descargarPdf/ }),
    ).toHaveLength(1);
  });

  it('muestra el estado vacío cuando ningún pedido tiene factura', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [pedidos[2]] });

    render(<FacturasTab />);

    expect(await screen.findByText('perfil.facturas.vacio')).toBeTruthy();
  });

  it('informa el error de carga y lo registra en consola', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(api.get).mockRejectedValue(new Error('down'));

    render(<FacturasTab />);

    expect(await screen.findByText('perfil.facturas.errorCargar')).toBeTruthy();
    expect(error).toHaveBeenCalled();
  });

  it('descarga la factura y deshabilita el botón mientras tanto', async () => {
    let resolver: () => void = () => undefined;
    vi.mocked(descargarFactura).mockImplementation(
      () => new Promise<void>((resolve) => { resolver = () => resolve(); }),
    );

    render(<FacturasTab />);
    await screen.findByText('FV-2026-0008');

    fireEvent.click(
      screen.getByRole('button', { name: /perfil\.facturas\.descargarPdf/ }),
    );

    expect(
      await screen.findByRole('button', { name: /perfil\.facturas\.descargando/ }),
    ).toHaveProperty('disabled', true);
    expect(descargarFactura).toHaveBeenCalledWith('/facturas/8.pdf');

    resolver();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /perfil\.facturas\.descargarPdf/ }),
      ).toHaveProperty('disabled', false),
    );
  });

  it('tolera una respuesta nula del backend', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: null });

    render(<FacturasTab />);

    expect(await screen.findByText('perfil.facturas.vacio')).toBeTruthy();
  });
});