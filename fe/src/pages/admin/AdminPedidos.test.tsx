// Semana 4 del bootcamp — gestión de pedidos con entrega.
// Listado, búsqueda, edición de fecha/hora con horarios disponibles del
// backend, cambio de técnico encargado y mensajes de error. Red simulada.
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));

import AdminPedidos from './AdminPedidos';

const PEDIDO = {
  id_pedido: 88, cliente: 'Carolina Mendez', direccion: 'Calle Cliente 123',
  telefono: 3105027488, fecha_entrega: '2030-01-15', hora_entrega: '10:00',
  hora_entrega_fin: '12:00', estado_entrega: 'Asignada', id_tecnico_entrega: 5,
  nombre_tecnico: 'Ana Torres', productos: ['Panel LED', 'Sensor de movimiento'],
};
const TECNICOS = [
  { id_tecnico: 5, first_name: 'Ana', last_name: 'Torres' },
  { id_tecnico: 6, first_name: 'Beto', last_name: 'Ruiz' },
];

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <AdminPedidos />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function red(pedidos: unknown[] = [PEDIDO]) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/pedidos/admin/entregas') return { data: pedidos };
    if (url === '/tecnicos') return { data: TECNICOS };
    if (url === '/pedidos/admin/horarios-disponibles') return { data: ['08:00', '09:00', '11:00', '13:00'] };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
});

describe('AdminPedidos', () => {
  it('muestra cliente, productos, fecha, estado y técnico encargado', async () => {
    // Arrange
    red();
    montar();
    // Assert
    const fila = (await screen.findByText('Carolina Mendez')).closest('tr')!;
    expect(within(fila).getByText('88')).toBeTruthy();
    expect(within(fila).getByText('Panel LED, Sensor de movimiento')).toBeTruthy();
    expect(within(fila).getByText('Asignada')).toBeTruthy();
    expect(within(fila).getByRole('button', { name: /2030-01-15 10:00 - 12:00/ })).toBeTruthy();
    expect((within(fila).getByRole('combobox') as HTMLSelectElement).value).toBe('5');
  });

  it('filtra por cliente y muestra el estado vacío', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    // Act
    await usuario.type(screen.getByPlaceholderText(/Buscar por pedido/), 'inexistente');
    // Assert
    expect(await screen.findByText('No hay pedidos con entrega registrada.')).toBeTruthy();
  });

  it('edita fecha y horas y guarda la entrega con los horarios elegidos', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    // Act
    await usuario.click(screen.getByRole('button', { name: /2030-01-15 10:00 - 12:00/ }));
    const fecha = await screen.findByDisplayValue('2030-01-15');
    fireEvent.change(fecha, { target: { value: '2031-02-01' } });
    // Assert: la carga de horarios consulta el backend.
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/pedidos/admin/horarios-disponibles', {
      params: { fecha: '2031-02-01', tecnico_id: '5' },
    }));
    // Act: elegir hora de inicio y fin disponibles.
    await screen.findByRole('option', { name: '11:00' });
    const inicio = screen.getByDisplayValue('Hora inicio');
    await usuario.selectOptions(inicio, '11:00');
    const fin = screen.getByDisplayValue('Hora fin');
    await usuario.selectOptions(fin, '13:00');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/pedidos/admin/88/entrega', {
      id_tecnico: 5, fecha_entrega: '2031-02-01', hora_entrega: '11:00', hora_entrega_fin: '13:00',
    }));
    expect(await screen.findByText('Fecha y hora de entrega actualizadas')).toBeTruthy();
  });

  it('cancela la edición sin guardar', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    // Act
    await usuario.click(screen.getByRole('button', { name: /2030-01-15 10:00 - 12:00/ }));
    await screen.findByDisplayValue('2030-01-15');
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    // Assert
    expect(screen.queryByDisplayValue('2030-01-15')).toBeNull();
    expect(apiMock.put).not.toHaveBeenCalled();
  });

  it('rechaza programar en una fecha pasada', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    // Act
    await usuario.click(screen.getByRole('button', { name: /2030-01-15 10:00 - 12:00/ }));
    const fecha = await screen.findByDisplayValue('2030-01-15');
    fireEvent.change(fecha, { target: { value: '2020-01-01' } });
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    // Assert
    expect(await screen.findByText('No es posible programar una entrega en una fecha pasada')).toBeTruthy();
    expect(apiMock.put).not.toHaveBeenCalled();
  });

  it('muestra el detalle de error del backend al guardar la entrega', async () => {
    // Arrange
    red();
    apiMock.put.mockRejectedValue({ response: { data: { detail: 'Horario ocupado' } } });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    await usuario.click(screen.getByRole('button', { name: /2030-01-15 10:00 - 12:00/ }));
    // Act
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    // Assert
    expect(await screen.findByText('Horario ocupado')).toBeTruthy();
  });

  it('cambia el técnico encargado', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    const fila = (await screen.findByText('Carolina Mendez')).closest('tr')!;
    // Act
    await usuario.selectOptions(within(fila).getByRole('combobox'), '6');
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/pedidos/admin/88/entrega', { id_tecnico: 6 }));
    expect(await screen.findByText('Pedido actualizado correctamente.')).toBeTruthy();
  });

  it('informa cuando falla la carga inicial', async () => {
    // Arrange
    apiMock.get.mockRejectedValue(new Error('sin red'));
    montar();
    // Assert
    expect(await screen.findByText('No se pudieron cargar los pedidos.')).toBeTruthy();
  });
});
