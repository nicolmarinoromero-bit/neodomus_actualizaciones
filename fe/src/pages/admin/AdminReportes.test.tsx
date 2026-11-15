import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api, { descargarReportePdf } from '@services/api';
import AdminReportes from './AdminReportes';

vi.mock('@i18n/IdiomaContext', () => ({
  useIdioma: () => ({ t: (clave: string) => clave }),
}));

vi.mock('@services/api', () => ({
  default: { get: vi.fn() },
  descargarReportePdf: vi.fn(),
}));

const resumen = {
  ventas_total: 1234567.8,
  pedidos_total: 42,
  pedidos_por_mes: [
    { mes: '2026-03', cantidad: 10, ventas: 500000 },
    { mes: '2026-04', cantidad: 5, ventas: 250000 },
  ],
  productos_mas_vendidos: [
    { nombre_producto: 'Cámara WiFi', cantidad: 3, total: 900000 },
    { nombre_producto: 'Sensor de puerta', cantidad: 2, total: 300000 },
  ],
  clientes_total: 12,
  citas_total: 7,
  citas_por_estado: { Pendiente: 1, Confirmada: 2, Finalizada: 3, Cancelada: 1 },
  citas_por_mes: [],
  tecnicos_total: 5,
  tecnicos_activos: 4,
  productos_total: 20,
  productos_activos: 15,
  solicitudes_pendientes: 2,
};

const resumenVacio = {
  ...resumen,
  ventas_total: 0,
  pedidos_total: 0,
  pedidos_por_mes: [],
  productos_mas_vendidos: [],
  citas_total: 0,
  citas_por_estado: { Pendiente: 0, Confirmada: 0, Finalizada: 0, Cancelada: 0 },
};

const rangoMesActual = () => {
  const hoy = new Date();
  const mes = String(hoy.getMonth() + 1).padStart(2, '0');
  return {
    fecha_inicio: `${hoy.getFullYear()}-${mes}-01`,
    fecha_fin: `${hoy.getFullYear()}-${mes}-${String(hoy.getDate()).padStart(2, '0')}`,
  };
};

const fechas = () => {
  const entradas = document.querySelectorAll<HTMLInputElement>('input[type="date"]');
  expect(entradas).toHaveLength(2);
  return entradas;
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AdminReportes — carga y panel', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: resumen });
  });

  it('solicita el rango del mes y muestra KPI, gráficos y resúmenes', async () => {
    render(<AdminReportes />);

    const titulo = await screen.findByText('adm.reportes.ventasTotales');
    expect(titulo).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/reports/resumen', {
      params: rangoMesActual(),
    });

    const ventas = `$${Math.round(resumen.ventas_total).toLocaleString('es-CO')}`;
    expect(screen.getAllByText(ventas).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('adm.reportes.pedidosRegistrados')).toBeTruthy();
    expect(screen.getByText('adm.reportes.conHistorico')).toBeTruthy();

    // Barras de ventas por mes con el nombre del mes traducido.
    expect(screen.getByText('adm.reportes.mesMar 2026')).toBeTruthy();
    expect(screen.getByText('adm.reportes.mesAbr 2026')).toBeTruthy();
    const ventasMarzo = `$${Math.round(500000).toLocaleString('es-CO')}`;
    expect(screen.getByText(ventasMarzo)).toBeTruthy();

    // Productos más vendidos y unidades.
    expect(screen.getByText('Cámara WiFi')).toBeTruthy();
    expect(screen.getAllByText('adm.reportes.unidadesVendidas').length).toBe(2);
    expect(screen.getByText('adm.reportes.tecnicosActivosSub')).toBeTruthy();
    expect(screen.getByText('/ 5')).toBeTruthy();

    // Citas por estado y resumen del sistema.
    expect(screen.getByText('adm.reportes.estadoPendientes')).toBeTruthy();
    expect(screen.getByText('adm.reportes.estadoCanceladas')).toBeTruthy();
    expect(screen.getAllByText('12').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('adm.reportes.resumenSolicitudes')).toBeTruthy();
    expect(screen.getAllByText('2').length).toBeGreaterThanOrEqual(1);
  });

  it('muestra los estados vacíos cuando no hay pedidos ni productos', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: resumenVacio });

    render(<AdminReportes />);

    expect(await screen.findByText('adm.reportes.sinVentasGraficar')).toBeTruthy();
    expect(screen.getByText('adm.reportes.sinVentasProductos')).toBeTruthy();
    expect(screen.getByText('adm.reportes.sinPedidos')).toBeTruthy();
  });
});

describe('AdminReportes — errores y validación', () => {
  it('muestra el error de carga y permite reintentar', async () => {
    vi.mocked(api.get)
      .mockRejectedValueOnce(new Error('down'))
      .mockResolvedValueOnce({ data: resumen });

    render(<AdminReportes />);

    expect(await screen.findByText('adm.reportes.errorTitulo')).toBeTruthy();
    const reintentar = screen.getByRole('button', {
      name: /adm\.reportes\.reintentar/,
    });
    fireEvent.click(reintentar);

    expect(await screen.findByText('adm.reportes.ventasTotales')).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(2);
  });

  it('bloquea la consulta cuando la fecha final es anterior a la inicial', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: resumen });

    render(<AdminReportes />);
    await screen.findByText('adm.reportes.ventasTotales');

    const [inicio, fin] = fechas();
    fireEvent.change(inicio, { target: { value: '2026-05-10' } });
    fireEvent.change(fin, { target: { value: '2026-05-01' } });
    fireEvent.click(
      screen.getByRole('button', { name: /adm\.reportes\.aplicarRango/ }),
    );

    expect(await screen.findByText('adm.reportes.rangoInvalido')).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(1);

    // Un rango válido vuelve a consultar y limpia el aviso.
    fireEvent.change(fin, { target: { value: '2026-05-31' } });
    fireEvent.click(
      screen.getByRole('button', { name: /adm\.reportes\.aplicarRango/ }),
    );
    await waitFor(() => expect(api.get).toHaveBeenCalledTimes(2));
    expect(api.get).toHaveBeenLastCalledWith('/reports/resumen', {
      params: { fecha_inicio: '2026-05-10', fecha_fin: '2026-05-31' },
    });
    await waitFor(() =>
      expect(screen.queryByText('adm.reportes.rangoInvalido')).toBeNull(),
    );
  });

  it('exige ambas fechas antes de consultar', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: resumen });

    render(<AdminReportes />);
    await screen.findByText('adm.reportes.ventasTotales');

    const [inicio] = fechas();
    fireEvent.change(inicio, { target: { value: '' } });
    fireEvent.click(
      screen.getByRole('button', { name: /adm\.reportes\.aplicarRango/ }),
    );

    expect(
      await screen.findByText('adm.reportes.rangoFechasRequeridas'),
    ).toBeTruthy();
    expect(api.get).toHaveBeenCalledTimes(1);
  });
});

describe('AdminReportes — descarga PDF', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockResolvedValue({ data: resumen });
  });

  it('descarga con el rango elegido y deshabilita el botón mientras tanto', async () => {
    let resolver: () => void = () => undefined;
    vi.mocked(descargarReportePdf).mockImplementation(
      () => new Promise<void>((resolve) => { resolver = () => resolve(); }),
    );

    render(<AdminReportes />);
    await screen.findByText('adm.reportes.ventasTotales');

    const [inicio, fin] = fechas();
    fireEvent.change(inicio, { target: { value: '2026-01-01' } });
    fireEvent.change(fin, { target: { value: '2026-01-31' } });
    fireEvent.click(
      screen.getByRole('button', { name: /adm\.reportes\.descargarPdf/ }),
    );

    expect(
      await screen.findByRole('button', { name: /adm\.reportes\.descargando/ }),
    ).toHaveProperty('disabled', true);
    expect(descargarReportePdf).toHaveBeenCalledWith(
      { fechaInicio: '2026-01-01', fechaFin: '2026-01-31' },
      'adm.reportes.errorDescarga',
    );

    resolver();
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /adm\.reportes\.descargarPdf/ }),
      ).toHaveProperty('disabled', false),
    );
  });

  it('no descarga si el rango es inválido', async () => {
    render(<AdminReportes />);
    await screen.findByText('adm.reportes.ventasTotales');

    const [inicio, fin] = fechas();
    fireEvent.change(inicio, { target: { value: '2026-02-10' } });
    fireEvent.change(fin, { target: { value: '2026-02-01' } });
    fireEvent.click(
      screen.getByRole('button', { name: /adm\.reportes\.descargarPdf/ }),
    );

    expect(await screen.findByText('adm.reportes.rangoInvalido')).toBeTruthy();
    expect(descargarReportePdf).not.toHaveBeenCalled();
  });
});