// Semana 5 del bootcamp — TecnicoDevoluciones (recogidas y cambios asignados).
// Cubre la carga de devoluciones activas e historial, los filtros, la subida
// de evidencias de recogida y de cambio, el detalle y los errores.
// Red simulada; las imágenes autenticadas y el modal de novedad se sustituyen.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@components/common/AuthImage', () => ({
  default: ({ src, alt }: { src: string; alt?: string }) => (
    <div data-testid="evidencia" data-alt={alt}>{src}</div>
  ),
}));
vi.mock('@components/tecnico/NuevaNovedadModal', () => ({ default: () => null }));

import TecnicoDevoluciones from './TecnicoDevoluciones';

const BASE = {
  id_devolucion: 4,
  id_pedido: 77,
  producto: 'Panel LED',
  cliente: 'Luis Pérez',
  direccion: 'Calle Recogida 9',
  telefono: 3001112233,
  email: 'luis@example.com',
  estado_devolucion: 'Aprobada',
  resolucion: null as string | null,
  preferencia: 'producto',
  recogida_estado: 'Asignada' as 'Asignada' | 'Recogida' | null,
  motivo: 'Producto defectuoso',
  fecha_solicitud: '2026-11-01T09:15:00',
  evidencia_recogida_url: null as string | null,
  fecha_recogida: null as string | null,
  evidencia_cambio_url: null as string | null,
  fecha_entrega_cambio: null as string | null,
};

const PENDIENTE = {
  ...BASE,
  id_devolucion: 5,
  producto: 'Sensor de movimiento',
  cliente: 'Ana Torres',
  estado_devolucion: 'Pendiente',
  motivo: null,
};

const RECOGIDA_CAMBIO = {
  ...BASE,
  id_devolucion: 6,
  producto: 'Cerradura inteligente',
  cliente: 'Mario Ruiz',
  recogida_estado: 'Recogida' as const,
  evidencia_recogida_url: '/media/devoluciones/recogida6.jpg',
  fecha_recogida: '2026-11-04T11:20:00',
};

const HISTORIAL = {
  ...BASE,
  id_devolucion: 7,
  producto: 'Cámara exterior',
  cliente: 'Sofía Lara',
  estado_devolucion: 'Aprobada',
  preferencia: 'dinero',
  resolucion: 'reembolso',
  recogida_estado: 'Recogida' as const,
  evidencia_recogida_url: '/media/devoluciones/recogida7.jpg',
  fecha_recogida: '2026-10-28T16:00:00',
};

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <TecnicoDevoluciones />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function responder(activas: any[] = [BASE, PENDIENTE, RECOGIDA_CAMBIO], historial: any[] = [HISTORIAL]) {
  apiMock.get.mockImplementation(async (url: string, config?: any) => {
    if (url !== '/devoluciones/mis-recogidas') throw new Error(`Ruta inesperada: ${url}`);
    if (config?.params?.historial) return { data: historial };
    return { data: activas };
  });
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  apiMock.post.mockResolvedValue({ data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TecnicoDevoluciones — listado', () => {
  it('muestra las devoluciones activas, sus badges y las estadísticas', async () => {
    // Arrange
    responder();
    montar();
    // Assert
    expect(await screen.findByText('Panel LED')).toBeTruthy();
    expect(screen.getByText('Devoluciones y cambios')).toBeTruthy();
    expect(screen.getAllByText(/Luis Pérez/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Calle Recogida 9/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/3001112233/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Producto defectuoso/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Por recoger').length).toBeGreaterThan(0);
    expect(screen.getByText(/Esperando aprobaci/)).toBeTruthy();
    expect(screen.getByText(/falta entregar el cambio/)).toBeTruthy();
    // Estadísticas: total activas, por recoger, cambios por entregar e historial.
    expect(screen.getByText('Devoluciones asignadas')).toBeTruthy();
    expect(screen.getByText('Cambios por entregar')).toBeTruthy();
    expect(screen.getByText('En historial')).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Pendientes/ })).toBeTruthy();
    expect(screen.getByRole('tab', { name: /Historial/ })).toBeTruthy();
  });

  it('la pestaña de historial muestra las devoluciones completadas y el estado vacío', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Panel LED');
    // Act
    await usuario.click(screen.getByRole('tab', { name: /Historial/ }));
    // Assert
    expect(await screen.findByText('Cámara exterior')).toBeTruthy();
    expect(screen.getByText(/Sofía Lara/)).toBeTruthy();
    expect(screen.getByText('Recogido')).toBeTruthy();
    // Act: búsqueda sin coincidencias en historial.
    await usuario.type(screen.getByPlaceholderText(/Buscar por cliente/), 'zzz');
    // Assert
    expect(await screen.findByText(/no hay citas finalizadas/i)).toBeTruthy();
  });

  it('sin devoluciones activas muestra el estado vacío con su ayuda', async () => {
    // Arrange
    responder([], []);
    montar();
    // Assert
    expect(await screen.findByText('No tienes devoluciones asignadas.')).toBeTruthy();
    expect(screen.getByText(/Cuando un cliente solicite una devolución/)).toBeTruthy();
  });

  it('filtra por cliente, producto y motivo', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Panel LED');
    const buscador = screen.getByPlaceholderText(/Buscar por cliente/);
    // Act: por cliente.
    await usuario.type(buscador, 'mario');
    // Assert
    expect(screen.getByText('Cerradura inteligente')).toBeTruthy();
    expect(screen.queryByText('Panel LED')).toBeNull();
    // Act: por producto.
    await usuario.clear(buscador);
    await usuario.type(buscador, 'sensor');
    // Assert
    expect(screen.getByText('Sensor de movimiento')).toBeTruthy();
    expect(screen.queryByText('Cerradura inteligente')).toBeNull();
    // Act: por motivo.
    await usuario.clear(buscador);
    await usuario.type(buscador, 'defectuoso');
    // Assert
    expect(screen.getByText('Panel LED')).toBeTruthy();
    expect(screen.queryByText('Sensor de movimiento')).toBeNull();
    // Act: sin coincidencias.
    await usuario.clear(buscador);
    await usuario.type(buscador, 'inexistente');
    // Assert
    expect(await screen.findByText(/no hay citas finalizadas/i)).toBeTruthy();
  });
});

describe('TecnicoDevoluciones — evidencias', () => {
  it('sube la evidencia de recogida y recarga la lista', async () => {
    // Arrange
    responder();
    const { container } = montar();
    await screen.findByText('Panel LED');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    // Act
    fireEvent.change(input, {
      target: { files: [new File(['foto'], 'recogida.jpg', { type: 'image/jpeg' })] },
    });
    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith(
        '/devoluciones/4/evidencia-recogida',
        expect.any(FormData),
      ),
    );
    const enviado = apiMock.post.mock.calls[0][1] as FormData;
    expect((enviado.get('file') as File).name).toBe('recogida.jpg');
    expect(await screen.findByText(/Recogida confirmada/)).toBeTruthy();
    // La lista se recarga: dos lecturas iniciales + dos del refresco.
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(4));
  });

  it('si el backend rechaza la recogida muestra su detalle', async () => {
    // Arrange
    responder();
    apiMock.post.mockRejectedValue({ response: { data: { detail: 'La devolución ya fue recogida' } } });
    const { container } = montar();
    await screen.findByText('Panel LED');
    // Act
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['foto'], 'x.jpg', { type: 'image/jpeg' })] },
    });
    // Assert
    expect(await screen.findByText('La devolución ya fue recogida')).toBeTruthy();
  });

  it('sube la evidencia del cambio entregado', async () => {
    // Arrange: solo la devolución recogida pendiente de cambio.
    responder([RECOGIDA_CAMBIO], []);
    const { container } = montar();
    await screen.findByText('Cerradura inteligente');
    // Act
    fireEvent.change(container.querySelector('input[type="file"]') as HTMLInputElement, {
      target: { files: [new File(['foto'], 'cambio.png', { type: 'image/png' })] },
    });
    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith(
        '/devoluciones/6/evidencia-cambio',
        expect.any(FormData),
      ),
    );
    expect(await screen.findByText(/Entrega del cambio confirmada/)).toBeTruthy();
  });

  it('si falla la carga muestra el error y permite reintentar', async () => {
    // Arrange: el primer intento falla y el reintento devuelve datos.
    apiMock.get.mockRejectedValueOnce(new Error('down')).mockImplementation(async (url: string, config?: any) => {
      if (url !== '/devoluciones/mis-recogidas') throw new Error(`Ruta inesperada: ${url}`);
      return { data: config?.params?.historial ? [] : [BASE] };
    });
    const usuario = userEvent.setup();
    montar();
    // Act
    const reintentar = await screen.findByRole('button', { name: /Reintentar/ });
    await usuario.click(reintentar);
    // Assert
    expect(await screen.findByText('Panel LED')).toBeTruthy();
  });
});

describe('TecnicoDevoluciones — detalle', () => {
  it('abre el detalle con los datos y las evidencias disponibles', async () => {
    // Arrange
    responder([RECOGIDA_CAMBIO], []);
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Cerradura inteligente');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Ver detalles/ }));
    // Assert
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/Detalle de devolución #6/)).toBeTruthy();
    expect(within(dialogo).getByText(/Cerradura inteligente/)).toBeTruthy();
    expect(within(dialogo).getByText('Mario Ruiz')).toBeTruthy();
    expect(within(dialogo).getByText(/3001112233/)).toBeTruthy();
    expect(within(dialogo).getByText(/luis@example.com/)).toBeTruthy();
    expect(within(dialogo).getByText(/Calle Recogida 9/)).toBeTruthy();
    expect(within(dialogo).getByText('Producto defectuoso')).toBeTruthy();
    expect(within(dialogo).getAllByText('Cambio de producto').length).toBeGreaterThan(0);
    expect(within(dialogo).getByText('Evidencias del trabajo')).toBeTruthy();
    expect(within(dialogo).getAllByTestId('evidencia').length).toBeGreaterThan(0);
    // Act: cerrar con la X.
    await usuario.click(within(dialogo).getAllByRole('button', { name: 'Cerrar' })[0]);
    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('el detalle sin evidencias ni teléfono usa los valores por defecto', async () => {
    // Arrange
    responder([{ ...BASE, telefono: null, email: null, motivo: null, preferencia: 'dinero' }], []);
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Panel LED');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Ver detalles/ }));
    // Assert
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getAllByText('No registrado').length).toBeGreaterThanOrEqual(3);
    expect(within(dialogo).getByText(/no has subido evidencias/)).toBeTruthy();
    expect(within(dialogo).getByText(/Devoluci.*dinero/)).toBeTruthy();
    // Act: cerrar con el botón inferior.
    await usuario.click(within(dialogo).getAllByRole('button', { name: 'Cerrar' }).at(-1) as HTMLElement);
    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});
