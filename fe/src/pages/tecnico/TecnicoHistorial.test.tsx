import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@services/api';
import TecnicoHistorial from './TecnicoHistorial';

vi.mock('@i18n/IdiomaContext', () => ({
  useIdioma: () => ({ idioma: 'es', t: (clave: string) => clave }),
}));

vi.mock('@services/api', () => ({
  default: { get: vi.fn() },
}));

vi.mock('@components/common/AuthImage', () => ({
  default: ({ src }: { src: string }) => <div data-testid="evidencia">{src}</div>,
}));

const citas = [
  {
    id_cita: 1,
    fecha: '2026-11-06',
    hora: '09:00:00',
    estado: 'Finalizada',
    tipo_servicio: 'instalacion',
    cliente: 'María López',
    direccion: 'Calle 10 # 5-20',
    telefono: 3001112233,
    descripcion: 'Instalación de cámaras',
    nombre_tecnico: 'Carlos Pérez',
    nombre_tecnico_2: 'Ana Ruiz',
    nombre_tecnico_3: 'Luis Gómez',
    evidencias: [
      { url: '/ev1' },
      { url: '/ev2' },
      { url: '/ev3' },
      { url: '/ev4' },
    ],
  },
  {
    id_cita: 2,
    fecha: '2026-10-15',
    hora: '14:00:00',
    estado: 'Cancelada',
    tipo_servicio: 'reparacion',
    cliente: 'Jorge Díaz',
    direccion: 'Carrera 7 # 12-34',
    telefono: null,
    descripcion: null,
    nombre_tecnico: null,
    evidencias: [],
  },
  {
    id_cita: 3,
    fecha: '2026-11-20',
    hora: '11:00:00',
    estado: 'Confirmada',
    tipo_servicio: 'mantenimiento',
    cliente: 'Cliente Futuro',
    direccion: 'Calle 1',
    telefono: 3009998877,
    descripcion: 'No debe aparecer',
    nombre_tecnico: 'Carlos Pérez',
    evidencias: [],
  },
];

const entregas = [
  {
    id_pedido: 77,
    cliente: 'Luis Pérez',
    fecha_entrega: '2026-11-05',
    hora_entrega: '09:00:00',
    hora_entrega_fin: '10:00:00',
    estado_entrega: 'Entregado',
    evidencias_entrega: ['/e1', '/e2', '/e3', '/e4'],
    productos: [{ descripcion: 'Panel LED', cantidad: 2 }],
  },
  {
    id_pedido: 78,
    cliente: 'Ana Ruiz',
    fecha_entrega: '2026-11-04',
    hora_entrega: '17:00:00',
    hora_entrega_fin: null,
    estado_entrega: 'Entregado',
    evidencias_entrega: [],
    productos: [],
  },
  {
    id_pedido: 79,
    cliente: 'Pedido en curso',
    fecha_entrega: '2026-11-03',
    hora_entrega: '08:00:00',
    hora_entrega_fin: null,
    estado_entrega: 'Recogido',
    evidencias_entrega: [],
    productos: [],
  },
];

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('TecnicoHistorial — citas', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/tecnicos/mis-citas' ? citas : entregas }),
    );
  });

  it('carga el historial y excluye citas no finalizadas', async () => {
    render(<TecnicoHistorial />);

    expect(await screen.findByText('María López')).toBeTruthy();
    expect(screen.getByText('Jorge Díaz')).toBeTruthy();
    expect(screen.queryByText('Cliente Futuro')).toBeNull();
    expect(api.get).toHaveBeenCalledWith('/tecnicos/mis-citas');

    // Tres técnicos, teléfono, descripción y conteo de evidencias (+1).
    expect(screen.getByText('Carlos Pérez')).toBeTruthy();
    expect(screen.getByText('Ana Ruiz')).toBeTruthy();
    expect(screen.getByText('Luis Gómez')).toBeTruthy();
    expect(screen.getByText('3001112233')).toBeTruthy();
    expect(screen.getByText('Instalación de cámaras')).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getAllByTestId('evidencia')).toHaveLength(3);
  });

  it('filtra por estado, fecha, hora y búsqueda libre', async () => {
    render(<TecnicoHistorial />);
    await screen.findByText('María López');

    const estado = screen.getByLabelText('tec.estado');
    fireEvent.change(estado, { target: { value: 'Cancelada' } });
    await waitFor(() => expect(screen.queryByText('María López')).toBeNull());
    expect(screen.getByText('Jorge Díaz')).toBeTruthy();

    fireEvent.change(estado, { target: { value: 'todas' } });
    fireEvent.change(screen.getByLabelText('tec.fecha'), {
      target: { value: '2026-11-06' },
    });
    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());
    expect(screen.queryByText('Jorge Díaz')).toBeNull();

    fireEvent.change(screen.getByLabelText('tec.fecha'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('tec.hora'), {
      target: { value: '14:00' },
    });
    await waitFor(() => expect(screen.getByText('Jorge Díaz')).toBeTruthy());
    expect(screen.queryByText('María López')).toBeNull();

    // La búsqueda mira también la fecha formateada ("noviembre").
    fireEvent.change(screen.getByLabelText('tec.hora'), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText('tec.buscarPlaceholder'), {
      target: { value: 'noviembre' },
    });
    await waitFor(() => expect(screen.getByText('María López')).toBeTruthy());
    expect(screen.queryByText('Jorge Díaz')).toBeNull();

    // El botón Limpiar restablece búsqueda y filtros.
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    await waitFor(() => expect(screen.getByText('Jorge Díaz')).toBeTruthy());
    expect(screen.getByText('María López')).toBeTruthy();
    expect(
      (screen.getByPlaceholderText('tec.buscarPlaceholder') as HTMLInputElement).value,
    ).toBe('');
  });

  it('muestra el estado vacío cuando no hay citas en el historial', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });

    render(<TecnicoHistorial />);

    expect(await screen.findByText('tec.vacioHistorial')).toBeTruthy();
    expect(screen.getByText('tec.vacioHistorialHint')).toBeTruthy();
  });

  it('sigue mostrando el historial si la carga falla', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(api.get).mockRejectedValue(new Error('down'));

    render(<TecnicoHistorial />);

    expect(await screen.findByText('tec.vacioHistorial')).toBeTruthy();
    expect(error).toHaveBeenCalledWith('Error al cargar historial:', expect.any(Error));
  });
});

describe('TecnicoHistorial — entregas', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation((url: string) =>
      Promise.resolve({ data: url === '/tecnicos/mis-citas' ? citas : entregas }),
    );
  });

  it('carga las entregas completadas con productos, franja y evidencias', async () => {
    render(<TecnicoHistorial />);
    await screen.findByText('María López');

    fireEvent.click(screen.getByRole('button', { name: /Entregas/ }));

    expect(await screen.findByText('Luis Pérez')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/tecnicos/entregas');
    expect(screen.queryByText('Pedido en curso')).toBeNull();
    expect(screen.getByText('#77')).toBeTruthy();
    expect(screen.getByText('09:00:00 - 10:00:00')).toBeTruthy();
    expect(screen.getByText(/× 2 Panel LED/)).toBeTruthy();
    expect(screen.getByText('+1')).toBeTruthy();
    expect(screen.getAllByTestId('evidencia')).toHaveLength(3);
    expect(screen.getByText('17:00:00')).toBeTruthy();
  });

  it('filtra entregas por estado, fecha, hora y cliente', async () => {
    render(<TecnicoHistorial />);
    await screen.findByText('María López');
    fireEvent.click(screen.getByRole('button', { name: /Entregas/ }));
    await screen.findByText('Luis Pérez');

    const estado = screen.getByLabelText('tec.estado');
    fireEvent.change(estado, { target: { value: 'Recogido' } });
    await waitFor(() =>
      expect(screen.queryByText('Luis Pérez')).toBeNull(),
    );
    expect(screen.getByText('tec.vacioHistorial')).toBeTruthy();

    fireEvent.change(estado, { target: { value: 'todas' } });
    fireEvent.change(screen.getByLabelText('tec.fecha'), {
      target: { value: '2026-11-05' },
    });
    await waitFor(() => expect(screen.getByText('Luis Pérez')).toBeTruthy());
    expect(screen.queryByText('Ana Ruiz')).toBeNull();

    fireEvent.change(screen.getByLabelText('tec.fecha'), { target: { value: '' } });
    fireEvent.change(screen.getByLabelText('tec.hora'), {
      target: { value: '17:00' },
    });
    await waitFor(() => expect(screen.getByText('Ana Ruiz')).toBeTruthy());
    expect(screen.queryByText('Luis Pérez')).toBeNull();

    fireEvent.change(screen.getByLabelText('tec.hora'), { target: { value: '' } });
    fireEvent.change(screen.getByPlaceholderText('tec.buscarPlaceholder'), {
      target: { value: 'ana' },
    });
    await waitFor(() => expect(screen.getByText('Ana Ruiz')).toBeTruthy());
    expect(screen.queryByText('Luis Pérez')).toBeNull();

    fireEvent.change(screen.getByPlaceholderText('tec.buscarPlaceholder'), {
      target: { value: '77' },
    });
    await waitFor(() => expect(screen.getByText('Luis Pérez')).toBeTruthy());
    expect(screen.queryByText('Ana Ruiz')).toBeNull();
  });

  it('limpia los filtros de entregas y conserva la pestaña', async () => {
    render(<TecnicoHistorial />);
    await screen.findByText('María López');
    fireEvent.click(screen.getByRole('button', { name: /Entregas/ }));
    await screen.findByText('Luis Pérez');

    fireEvent.change(screen.getByPlaceholderText('tec.buscarPlaceholder'), {
      target: { value: 'luis' },
    });
    await waitFor(() => expect(screen.queryByText('Ana Ruiz')).toBeNull());
    fireEvent.click(screen.getByRole('button', { name: 'Limpiar' }));
    await waitFor(() => expect(screen.getByText('Ana Ruiz')).toBeTruthy());
    expect(screen.getByText('Luis Pérez')).toBeTruthy();
  });

  it('vuelve a citas al cambiar de pestaña', async () => {
    render(<TecnicoHistorial />);
    await screen.findByText('María López');
    fireEvent.click(screen.getByRole('button', { name: /Entregas/ }));
    await screen.findByText('Luis Pérez');
    fireEvent.click(screen.getByRole('button', { name: /Citas/ }));
    expect(await screen.findByText('María López')).toBeTruthy();
    expect(screen.queryByText('Luis Pérez')).toBeNull();
  });
});