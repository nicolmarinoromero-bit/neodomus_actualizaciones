// CheckoutPage · reglas por tipo de servicio (casos reproducidos):
//   1) Mantenimiento con especialidad sin aptos → aviso y pago bloqueado
//      ANTES de enviar el pedido; la recomendación se recalcula con el tipo.
//   2) La franja de horas llega del backend con la duración real (items).
//   3) Error de consulta ≠ agenda vacía: aviso con reintento.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';
import api from '@services/api';
import CheckoutPage from './CheckoutPage';

const auth = vi.hoisted(() => ({
  current: {
    isAuthenticated: true,
    rol: 'cliente',
    user: { id: 1, nombre: 'Cliente Test', correo: 'cliente@test.patito' },
    loading: false,
  },
}));

const cart = vi.hoisted(() => ({
  current: {
    items: [
      {
        id_producto: 9,
        nombre_producto: 'Cámara IP 1080p',
        precio_venta_producto: 245000,
        imagen: '/productos/9.jpg',
        cantidad: 1,
      },
    ],
    totalPrice: 245000,
    totalItems: 1,
    clearCart: vi.fn(),
  },
}));

vi.mock('@contexts/AuthContext', () => ({ useAuth: () => auth.current }));
vi.mock('@contexts/CartContext', () => ({ useCart: () => cart.current }));
vi.mock('@services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  descargarFactura: vi.fn(),
  descargarReportePdf: vi.fn(),
}));

const recomendaciones = vi.hoisted(() => ({ bodies: [] as any[] }));
const horasPedidos = vi.hoisted(() => ({ urls: [] as string[] }));
const modoRecomendacion = vi.hoisted(() => ({ rechazar: false }));

const respuestaAprobado = {
  data: {
    pedido: { id_pedido: 88, total: 325000 },
    pago: { estado: 'aprobado', numero_transaccion: 'TD-2' },
    factura: { numero_factura: 'FAC-88', enviada_por_correo: true },
    pdf_url: '/pedidos/88/factura',
  },
};

const respuestaRecomendacion = () => ({
  data: {
    tecnicos_necesarios: 1,
    horas_por_tecnico: 1.5,
    tiempo_total_horas: 1.5,
    especializaciones_requeridas: [
      { id_especializacion: 1, nombre: 'Instalación de cámaras de seguridad' },
    ],
    tecnicos_sugeridos: [],
  },
});

beforeEach(() => {
  recomendaciones.bodies = [];
  horasPedidos.urls = [];
  modoRecomendacion.rechazar = false;
  vi.mocked(api.get).mockImplementation(async (url: string, config?: any) => {
    if (url === '/pedidos/metodos-pago') return { data: { bancos: [] } };
    if (url === '/clients/me') return { data: { address: 'Calle 1 # 2-3' } };
    if (url === '/novedades/cliente/mis-cupones') return { data: [] };
    if (typeof url === 'string' && url.startsWith('/tecnicos/publicos')) return { data: [] };
    if (typeof url === 'string' && url.startsWith('/citas/horas-disponibles')) {
      horasPedidos.urls.push(`${url}?${new URLSearchParams(config?.params ?? {}).toString()}`);
      return { data: ['08:00', '11:00'] };
    }
    throw new Error(`Ruta inesperada: ${url}`);
  });
  vi.mocked(api.post).mockImplementation(async (url: string, body?: unknown) => {
    if (url === '/pedidos') return respuestaAprobado;
    if (url === '/pedidos/recomendacion-tecnicos') {
      if (modoRecomendacion.rechazar) throw new Error('consulta caída');
      recomendaciones.bodies.push(body);
      return {
        data: {
          tecnicos_necesarios: 1,
          horas_por_tecnico: 1.5,
          tiempo_total_horas: 1.5,
          especializaciones_requeridas: [
            { id_especializacion: 1, nombre: 'Instalación de cámaras de seguridad' },
          ],
          tecnicos_sugeridos: [],
        },
      };
    }
    throw new Error(`Ruta inesperada: ${url}`);
  });
});

afterEach(() => {
  cleanup();
  localStorage.clear();
  sessionStorage.clear();
  vi.clearAllMocks();
});

const checkout = () =>
  render(
    <MemoryRouter initialEntries={['/checkout']}>
      <IdiomaProvider>
        <CheckoutPage />
      </IdiomaProvider>
    </MemoryRouter>,
  );

async function agregarServicio(tipo: 'Instalación' | 'Mantenimiento') {
  const existente = document.querySelector('.checkout-servicio-fila select') as HTMLSelectElement | null;
  if (!existente) {
    fireEvent.click(screen.getByRole('button', { name: /Agregar servicio/ }));
  }
  const tipoSelect = document.querySelector('.checkout-servicio-fila select') as HTMLSelectElement;
  if (tipo !== 'Instalación') fireEvent.change(tipoSelect, { target: { value: tipo } });
  await act(async () => {
    await Promise.resolve();
  });
}

describe('CheckoutPage · servicios técnicos por tipo', () => {
  it('mantenimiento sin personal apto: aviso y pago bloqueados antes de enviar', async () => {
    checkout();
    await screen.findByText('Resumen del pedido');
    await agregarServicio('Mantenimiento');

    expect(
      await screen.findByText(/Ningún técnico disponible cumple las especializaciones/),
    ).toBeTruthy();
    const pagar = screen.getByRole('button', { name: 'Pagar y confirmar' }) as HTMLButtonElement;
    expect(pagar.disabled).toBe(true);

    fireEvent.click(pagar);
    await act(async () => {
      await Promise.resolve();
    });
    expect(
      vi.mocked(api.post).mock.calls.some(([ruta]) => ruta === '/pedidos'),
    ).toBe(false);
  });

  it('la recomendación se recalcula con el tipo de servicio al cambiarlo', async () => {
    checkout();
    await screen.findByText('Resumen del pedido');
    await agregarServicio('Instalación');
    await waitFor(() => {
      expect(
        recomendaciones.bodies.some((b: any) => b.tipo_servicio === 'instalacion'),
      ).toBe(true);
    });
    await agregarServicio('Mantenimiento');
    await waitFor(() => {
      expect(
        recomendaciones.bodies.some((b: any) => b.tipo_servicio === 'mantenimiento'),
      ).toBe(true);
    });
  });

  it('pide las franjas al backend con la carga real (items) para instalación', async () => {
    checkout();
    await screen.findByText('Resumen del pedido');
    await agregarServicio('Instalación');
    const fecha = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(fecha, { target: { value: '2027-01-09' } });
    await waitFor(() => {
      expect(horasPedidos.urls.some((u) => u.includes('items='))).toBe(true);
    });
    // Solo las franjas que el backend devuelve (17:00 no cabe con la carga).
    expect(screen.queryByRole('button', { name: '17:00' })).toBeNull();
    expect(screen.getByRole('button', { name: '08:00' })).toBeTruthy();
  });

  it('error de consulta: aviso con reintento, nunca agenda vacía', async () => {
    modoRecomendacion.rechazar = true;
    checkout();
    await screen.findByText('Resumen del pedido');
    await agregarServicio('Mantenimiento');

    expect(screen.queryByText(/Ningún técnico disponible cumple/)).toBeNull();
    const reintentar = screen.getByRole('button', { name: 'Reintentar' });
    const llamadas = vi.mocked(api.post).mock.calls.filter(([r]) => r === '/pedidos/recomendacion-tecnicos');
    expect(llamadas.length).toBeGreaterThanOrEqual(1);

    modoRecomendacion.rechazar = false;
    fireEvent.click(reintentar);
    await waitFor(() => {
      expect(screen.getByText(/Ningún técnico disponible cumple/)).toBeTruthy();
    });
  });

  it('la confirmación de compra nombra el servicio real agendado', async () => {
    // El backend responde con la cita de mantenimiento agendada.
    vi.mocked(api.post).mockImplementation(async (url: string) => {
      if (url === '/pedidos') {
        return {
          data: {
            pedido: { id_pedido: 89, total: 125000 },
            pago: { estado: 'aprobado', numero_transaccion: 'TD-9' },
            factura: { numero_factura: 'FAC-89', enviada_por_correo: true },
            ordenes_instalacion: [{
              id_cita: 4, tipo_servicio: 'mantenimiento', estado: 'Confirmada',
              nombre_tecnico: 'JORGE DANIEL CHARRY PÉREZ', fecha: '2026-11-27', hora: '17:00',
            }],
          },
        } as never;
      }
      if (url === '/pedidos/recomendacion-tecnicos') {
        return {
          data: {
            tecnicos_necesarios: 1,
            horas_por_tecnico: 1.5,
            tiempo_total_horas: 1.5,
            especializaciones_requeridas: [
              { id_especializacion: 1, nombre: 'Instalación de cámaras de seguridad' },
            ],
            tecnicos_sugeridos: [
              { id_tecnico: 12, nombre: 'JORGE DANIEL CHARRY PÉREZ', cubre_todo: true },
            ],
          },
        } as never;
      }
      throw new Error(`Ruta inesperada: ${url}`);
    });
    checkout();
    await screen.findByText('Resumen del pedido');
    await agregarServicio('Mantenimiento');
    // La recomendación recalculada con tipo (1 técnico) ya cargó.
    await screen.findByText(/requerirá 1 técnico/);
    fireEvent.change(document.querySelector('input[type="date"]') as HTMLInputElement, {
      target: { value: '2026-11-27' },
    });
    await screen.findByRole('button', { name: '08:00' });

    fireEvent.click(screen.getByRole('button', { name: /Tarjeta débito/ }));
    fireEvent.change(screen.getByLabelText('Número de tarjeta'), { target: { value: '4242424242424242' } });
    fireEvent.change(screen.getByLabelText('Expiración'), { target: { value: '12/30' } });
    fireEvent.change(screen.getByLabelText('CVV'), { target: { value: '123' } });
    fireEvent.change(screen.getByPlaceholderText('Como aparece en la tarjeta'), { target: { value: 'Cliente Test' } });
    const sim = screen
      .getAllByRole('combobox')
      .find((el) => Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'aprobado')) as HTMLSelectElement;
    fireEvent.change(sim, { target: { value: 'aprobado' } });

    fireEvent.click(screen.getByRole('button', { name: 'Pagar y confirmar' }));
    await waitFor(() => {
      expect(screen.getByText('Mantenimiento agendado')).toBeTruthy();
    });
    expect(screen.queryByText('Instalación agendada')).toBeNull();
  });
});
