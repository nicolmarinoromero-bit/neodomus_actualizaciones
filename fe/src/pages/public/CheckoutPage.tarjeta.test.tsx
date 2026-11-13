// Semana 3 del bootcamp — CheckoutPage: pago con tarjeta (débito)
// desde la perspectiva del usuario. Validaciones visibles campo a campo,
// pago exitoso y la regla de privacidad: el número completo y el CVV nunca
// se persisten en el almacenamiento local.
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
        id_producto: 1,
        nombre_producto: 'Tubería PVC',
        precio_venta_producto: 5000,
        imagen: '/productos/1.jpg',
        cantidad: 1,
      },
    ],
    totalPrice: 5000,
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

const respuestaAprobado = {
  data: {
    pedido: { id_pedido: 77, total: 5000 },
    pago: { estado: 'aprobado', numero_transaccion: 'TD-1' },
    factura: { numero_factura: 'FAC-77', enviada_por_correo: true },
    pdf_url: '/pedidos/77/factura',
  },
};

beforeEach(() => {
  vi.mocked(api.get).mockImplementation(async (url: string) => {
    if (url === '/pedidos/metodos-pago') {
      return { data: { bancos: ['Bancolombia', 'Banco de Bogotá'] } };
    }
    if (url === '/clients/me') return { data: { address: 'Calle 1 # 2-3' } };
    if (url === '/novedades/cliente/mis-cupones') return { data: [] };
    if (typeof url === 'string' && url.startsWith('/tecnicos/publicos')) return { data: [] };
    throw new Error(`Ruta inesperada: ${url}`);
  });
  vi.mocked(api.post).mockImplementation(async (url: string) => {
    if (url === '/pedidos') return respuestaAprobado;
    if (url === '/pedidos/recomendacion-tecnicos') {
      return {
        data: { tecnicos_necesarios: 1, horas_por_tecnico: 1, especializaciones_requeridas: [], tecnicos_sugeridos: [] },
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

async function elegirTarjeta() {
  await screen.findByText('Resumen del pedido');
  fireEvent.click(screen.getByRole('button', { name: /Tarjeta débito/ }));
  await screen.findByLabelText('Número de tarjeta');
}

function llenarTarjeta(numero = '4111111111111111', expiracion = '12/30', cvv = '123') {
  fireEvent.change(screen.getByLabelText('Número de tarjeta'), { target: { value: numero } });
  fireEvent.change(screen.getByLabelText('Expiración'), { target: { value: expiracion } });
  fireEvent.change(screen.getByLabelText('CVV'), { target: { value: cvv } });
  fireEvent.change(screen.getByPlaceholderText('Como aparece en la tarjeta'), {
    target: { value: 'Cliente Test' },
  });
}

async function pagar() {
  fireEvent.click(screen.getByRole('button', { name: 'Pagar y confirmar' }));
  await act(async () => {
    await Promise.resolve();
  });
}


async function elegirSimulacion(valor: 'aprobado' | 'rechazado' | 'pendiente') {
  // El simulador de pago es un combobox con los tres resultados posibles.
  const simulacion = screen.getAllByRole('combobox').find((el) =>
    Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'aprobado'),
  ) as HTMLSelectElement;
  fireEvent.change(simulacion, { target: { value: valor } });
}

function pedidoCreado(): boolean {
  return vi.mocked(api.post).mock.calls.some(([ruta]) => ruta === '/pedidos');
}

describe('CheckoutPage · pago con tarjeta', () => {
  it('sin ningún dato muestra el aviso de datos incompletos y no envía el pedido', async () => {
    // Arrange
    checkout();
    await elegirTarjeta();
    // Act
    await pagar();
    // Assert: aviso visible y ninguna petición de pedido.
    expect(screen.getByText('Completa los datos de la tarjeta.')).toBeTruthy();
    expect(pedidoCreado()).toBe(false);
  });

  it('un número de tarjeta corto se rechaza con su aviso y sin enviar', async () => {
    // Arrange
    checkout();
    await elegirTarjeta();
    llenarTarjeta('4111');
    await elegirSimulacion('aprobado');
    // Act
    await pagar();
    // Assert
    expect(screen.getByText('El número de tarjeta debe tener entre 13 y 19 dígitos.')).toBeTruthy();
    expect(pedidoCreado()).toBe(false);
  });

  it('una expiración con formato inválido muestra su aviso propio', async () => {
    // Arrange
    checkout();
    await elegirTarjeta();
    llenarTarjeta('4111111111111111', '13/99');
    await elegirSimulacion('aprobado');
    // Act
    await pagar();
    // Assert
    expect(screen.getByText('Usa el formato de expiración MM/AA.')).toBeTruthy();
    expect(pedidoCreado()).toBe(false);
  });

  it('una tarjeta vencida se rechaza con su aviso', async () => {
    // Arrange
    checkout();
    await elegirTarjeta();
    llenarTarjeta('4111111111111111', '01/20');
    await elegirSimulacion('aprobado');
    // Act
    await pagar();
    // Assert
    expect(screen.getByText('La tarjeta está vencida.')).toBeTruthy();
    expect(pedidoCreado()).toBe(false);
  });

  it('un CVV inválido se rechaza con su aviso', async () => {
    // Arrange
    checkout();
    await elegirTarjeta();
    llenarTarjeta('4111111111111111', '12/30', '12');
    await elegirSimulacion('aprobado');
    // Act
    await pagar();
    // Assert
    expect(screen.getByText('El CVV debe tener 3 o 4 dígitos.')).toBeTruthy();
    expect(pedidoCreado()).toBe(false);
  });

  it('sin elegir el resultado del simulador pide completarlo antes de pagar', async () => {
    // Arrange
    checkout();
    await elegirTarjeta();
    llenarTarjeta();
    // Act
    await pagar();
    // Assert: aviso del simulador y sin pedido.
    expect(screen.getByText(/Selecciona el resultado de simulación/i)).toBeTruthy();
    expect(pedidoCreado()).toBe(false);
  });

  it('pago exitoso con tarjeta: confirmación, pedido creado y datos sensibles sin persistir', async () => {
    // Arrange
    checkout();
    await elegirTarjeta();
    llenarTarjeta();
    await elegirSimulacion('aprobado');
    // Act
    await pagar();
    // Assert: confirmación en pantalla + pedido creado con método débito.
    await waitFor(() => expect(screen.getByText('¡Pago exitoso!')).toBeTruthy());
    const llamada = vi.mocked(api.post).mock.calls.find(([ruta]) => ruta === '/pedidos');
    const cuerpo = (llamada?.[1] ?? {}) as { pago: { metodo: string } };
    expect(cuerpo.pago.metodo).toBe('tarjeta_debito');
    // Privacidad: el número completo no queda en ningún storage.
    const storage = JSON.stringify([
      localStorage.getItem('checkout_datos_pago'),
      sessionStorage.getItem('checkout_datos_pago'),
    ]);
    expect(storage).not.toContain('4111111111111111');
  });
});
