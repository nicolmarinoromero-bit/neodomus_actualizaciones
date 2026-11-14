// Semana 5 del bootcamp — TechnicianEntregas con red simulada.
// Cubre la carga de entregas/recogidas, los cambios de estado del pedido,
// la subida de evidencias (FormData), el estado de error con reintento y el
// intercambio de ubicación con la API de geolocalización simulada.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
}));

vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@components/tecnico/NuevaNovedadModal', () => ({ default: () => null }));

import TechnicianEntregas from './TechnicianEntregas';

const ENTREGA = {
  id_pedido: 88,
  cliente: 'Carolina Mendez',
  telefono: 3105027488,
  email: 'carolina@example.com',
  direccion: 'Calle Cliente 123',
  fecha_entrega: '2026-11-20',
  hora_entrega: '10:00',
  hora_entrega_fin: '12:00',
  estado_entrega: 'Asignada',
  evidencias_entrega: [] as string[],
  productos: [{ descripcion: 'Cinta LED', cantidad: 2, subtotal: 100000 }],
  cita: {
    id_cita: 9, tipo_servicio: 'instalacion', fecha: '2026-11-20',
    hora: '10:00', estado: 'Finalizada',
  },
};

const RECOGIDA = {
  id_devolucion: 4,
  id_pedido: 77,
  producto: 'Panel LED',
  cliente: 'Luis Pérez',
  direccion: 'Calle Recogida 9',
  telefono: 3001112233,
  estado_devolucion: 'Aprobada',
  preferencia: 'producto',
  recogida_estado: null as 'Asignada' | 'Recogida' | null,
  motivo: 'Producto defectuoso',
};

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <TechnicianEntregas />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function responder(
  entregas: typeof ENTREGA[] = [ENTREGA],
  recogidas: typeof RECOGIDA[] = [RECOGIDA],
) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/tecnicos/entregas') return { data: entregas };
    if (url === '/devoluciones/mis-recogidas') return { data: recogidas };
    if (url.startsWith('/media')) return { data: new Blob(['x']) };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.put.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockResolvedValue({ data: {} });
  apiMock.post.mockResolvedValue({ data: {} });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  delete (navigator as any).geolocation;
});

describe('TechnicianEntregas — carga y detalle', () => {
  it('muestra la entrega con contacto, productos, cita y la recogida asignada', async () => {
    // Arrange
    responder();
    montar();
    // Assert
    expect(await screen.findByText('Carolina Mendez')).toBeTruthy();
    expect(screen.getByText(/Pedido #88/)).toBeTruthy();
    expect(screen.getByText('Calle Cliente 123')).toBeTruthy();
    expect(screen.getByText('3105027488')).toBeTruthy();
    expect(screen.getByText('carolina@example.com')).toBeTruthy();
    expect(screen.getByText(/× 2 Cinta LED/)).toBeTruthy();
    expect(screen.getByText(/Adjunta al servicio/)).toBeTruthy();
    expect(screen.getByText('Finalizada')).toBeTruthy();
    expect(screen.getByText(/Recogidas por devolución/)).toBeTruthy();
    expect(screen.getByText(/Devolución #4/)).toBeTruthy();
    expect(screen.getByText(/Luis Pérez/)).toBeTruthy();
    expect(screen.getByText(/Producto defectuoso/)).toBeTruthy();
    expect(screen.getByText('Por recoger')).toBeTruthy();
  });

  it('sin entregas activas muestra el estado vacío', async () => {
    // Arrange: una entrega ya entregada con evidencias pasa al historial.
    responder([{ ...ENTREGA, estado_entrega: 'Entregado', evidencias_entrega: ['/media/a.jpg'] }], []);
    montar();
    // Assert
    expect(await screen.findByText('No tienes entregas asignadas.')).toBeTruthy();
  });

  it('un fallo de carga muestra el error y permite reintentar', async () => {
    // Arrange: el primer intento falla; el reintento devuelve datos.
    apiMock.get.mockRejectedValueOnce(new Error('down')).mockImplementation(async (url: string) => {
      if (url === '/tecnicos/entregas') return { data: [ENTREGA] };
      return { data: [] };
    });
    montar();
    // Act
    const reintentar = await screen.findByRole('button', { name: 'Reintentar' });
    await userEvent.click(reintentar);
    // Assert
    expect(await screen.findByText('Carolina Mendez')).toBeTruthy();
  });
});

describe('TechnicianEntregas — cambios de estado', () => {
  it('recorre Recogido → En camino → Entregado con notificaciones', async () => {
    // Arrange
    let estado = 'Asignada';
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/tecnicos/entregas') return { data: [{ ...ENTREGA, estado_entrega: estado }] };
      return { data: [] };
    });
    apiMock.put.mockImplementation(async (_url: string, body: any) => {
      estado = body.estado;
      return { data: {} };
    });
    const usuario = userEvent.setup();
    montar();
    // Act 1: marcar recogido.
    await usuario.click(await screen.findByRole('button', { name: /Ya lo recogí/ }));
    // Assert 1
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/tecnicos/entregas/88/estado', { estado: 'Recogido' }),
    );
    expect(await screen.findByText('Pedido marcado como recogido')).toBeTruthy();
    // Act 2: avisar que va en camino.
    await usuario.click(await screen.findByRole('button', { name: /En camino$/ }));
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/tecnicos/entregas/88/estado', { estado: 'En camino' }),
    );
    expect(await screen.findByText(/llegada inminente/)).toBeTruthy();
    // En camino ya no permite más cambios de estado: "Entregado" abre la
    // carga de evidencias (probada en el bloque de evidencias).
    expect(await screen.findByRole('button', { name: /Entregado/ })).toBeTruthy();
  });

  it('si el backend rechaza el cambio muestra su detalle', async () => {
    // Arrange
    responder();
    apiMock.put.mockRejectedValue({ response: { data: { detail: 'Estado no permitido' } } });
    const usuario = userEvent.setup();
    montar();
    // Act
    await usuario.click(await screen.findByRole('button', { name: /Ya lo recogí/ }));
    // Assert
    expect(await screen.findByText('Estado no permitido')).toBeTruthy();
  });
});

describe('TechnicianEntregas — evidencias', () => {
  it('sube fotos, marca Entregado y recarga la lista', async () => {
    // Arrange: pedido en camino con un input de archivos.
    responder([{ ...ENTREGA, estado_entrega: 'En camino' }], []);
    const { container } = montar();
    await screen.findByText('Carolina Mendez');
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    // Act
    fireEvent.change(input, {
      target: { files: [new File(['foto'], 'evidencia.jpg', { type: 'image/jpeg' })] },
    });
    // Assert: FormData al endpoint y cambio automático a Entregado.
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/tecnicos/entregas/88/evidencias', expect.any(FormData)),
    );
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/tecnicos/entregas/88/estado', { estado: 'Entregado' }),
    );
    expect(await screen.findByText('Pedido entregado con evidencias guardadas')).toBeTruthy();
    const enviado = apiMock.post.mock.calls[0][1] as FormData;
    expect((enviado.get('files') as File).name).toBe('evidencia.jpg');
  });

  it('confirmar la recogida de una devolución envía la evidencia', async () => {
    // Arrange: sin entregas activas, una recogida pendiente.
    responder([], [RECOGIDA]);
    const { container } = montar();
    await screen.findByText(/Devolución #4/);
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    // Act
    fireEvent.change(input, {
      target: { files: [new File(['ev'], 'recogida.png', { type: 'image/png' })] },
    });
    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith(
        '/devoluciones/4/evidencia-recogida', expect.any(FormData),
      ),
    );
    expect(await screen.findByText(/Recogida confirmada/)).toBeTruthy();
  });
});

describe('TechnicianEntregas — ubicación', () => {
  it('sin soporte de geolocalización avisa al técnico', async () => {
    // Arrange
    responder([{ ...ENTREGA, estado_entrega: 'En camino' }], []);
    const usuario = userEvent.setup();
    montar();
    // Act
    await usuario.click(await screen.findByRole('button', { name: /Compartir ubicación/ }));
    // Assert
    expect(await screen.findByText(/no permite compartir ubicación/)).toBeTruthy();
  });

  it('comparte la posición y puede detener el seguimiento', async () => {
    // Arrange: geolocalización simulada que entrega una posición.
    let exito: ((pos: any) => void) | undefined;
    const clearWatch = vi.fn();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        watchPosition: vi.fn((ok: (pos: any) => void) => { exito = ok; return 7; }),
        clearWatch,
      },
    });
    responder([{ ...ENTREGA, estado_entrega: 'En camino' }], []);
    const usuario = userEvent.setup();
    montar();
    // Act
    await usuario.click(await screen.findByRole('button', { name: /Compartir ubicación/ }));
    exito?.({ coords: { latitude: 4.65, longitude: -74.05 } });
    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/tecnicos/ubicacion', {
        latitud: 4.65, longitud: -74.05,
      }),
    );
    await usuario.click(await screen.findByRole('button', { name: /Detener ubicación/ }));
    expect(clearWatch).toHaveBeenCalledWith(7);
  });
});
