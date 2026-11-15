// Semana 4 del bootcamp — historial administrativo de novedades.
// Listado con filtros por estado/tipo/prioridad/técnico/origen/evidencia y
// cliente/pedido; modal de detalle con cambio de estado, cupón de compensación,
// respuesta al técnico, mensaje al cliente y reasignación de técnico.
// Red simulada.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));

import AdminNovedades from './AdminNovedades';

const NOVEDAD_PEDIDO = {
  id_novedad: 41, tipo_novedad: 'Retraso en entrega', tipo_novedad_label: 'Retraso en entrega',
  estado_novedad: 'Pendiente', estado_novedad_label: 'Pendiente',
  prioridad: 'alta', prioridad_label: 'Alta',
  id_tecnico: 5, tecnico_nombre: 'Ana Torres', id_cliente: 7, cliente_nombre: 'Carolina Mendez',
  id_pedido: 88, id_cita: null, id_devolucion: null,
  fecha_reporte: '2026-11-01T10:00:00Z', descripcion_novedad: 'El pedido llegó tarde',
  lugar_ocurrencia: 'Calle Cliente 123', mensaje_cliente: 'Ya vamos en camino',
  solucion_cliente: 'Se compensó el envío', cliente_visible: true, cupon: null,
  evidencias: [{ id_evidencia_n: 1, url: '/evidencias/41.jpg', fecha_subida: '2026-11-01' }],
};
const NOVEDAD_CITA = {
  ...NOVEDAD_PEDIDO, id_novedad: 42, tipo_novedad: 'Cita no realizada',
  tipo_novedad_label: 'Cita no realizada', estado_novedad: 'Resuelta',
  estado_novedad_label: 'Resuelta', prioridad: 'baja', prioridad_label: 'Baja',
  id_pedido: null, id_cita: 70, id_cliente: null, cliente_nombre: null,
  mensaje_cliente: null, solucion_cliente: null, cliente_visible: false,
  evidencias: [], tecnico_nombre: null,
};
const DETALLE = {
  ...NOVEDAD_PEDIDO,
  historial: [{
    id_historial: 1, accion: 'Creada', detalle: 'Reporte inicial',
    fecha: '2026-11-01T10:05:00Z', usuario_nombre: 'Ana Torres',
  }],
};

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <AdminNovedades />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function red(novedades: unknown[] = [NOVEDAD_PEDIDO, NOVEDAD_CITA], detalle: unknown = DETALLE) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/novedades') return { data: novedades };
    if (url === '/tecnicos') return { data: [{ id_tecnico: 5, first_name: 'Ana', last_name: 'Torres' }] };
    if (url === '/novedades/41' || url === '/novedades/42') return { data: detalle };
    if (url.startsWith('/evidencias/')) return { data: new Blob(['evidencia'], { type: 'image/jpeg' }) };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

function abrirDetalle(usuario: ReturnType<typeof userEvent.setup>) {
  return usuario.click(screen.getAllByRole('button', { name: 'Ver detalle' })[0]).then(() =>
    screen.findByRole('heading', { name: /Novedad #41/ }),
  );
}

function panelDetalle() {
  return screen.getByRole('heading', { name: /Novedad #41/ }).closest('.ap-modal') as HTMLElement;
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
});

describe('AdminNovedades — listado y filtros', () => {
  it('muestra tipo, técnico, cliente, origen, prioridad, estado y contadores', async () => {
    // Arrange
    red();
    montar();
    // Assert
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('Retraso en entrega')).toBeTruthy();
    expect(within(tabla).getByText('Cita no realizada')).toBeTruthy();
    expect(within(tabla).getByText('Ana Torres')).toBeTruthy();
    expect(within(tabla).getByText('Carolina Mendez')).toBeTruthy();
    expect(within(tabla).getByText('#88')).toBeTruthy();
    expect(within(tabla).getByText(/#70/)).toBeTruthy();
    expect(within(tabla).getAllByText('Alta').length).toBeGreaterThan(0);
    expect(within(tabla).getAllByText('Baja').length).toBeGreaterThan(0);
    expect(screen.getByText('2 de 2 novedades')).toBeTruthy();
  });

  it('filtra por texto y por tipo, y limpia los filtros', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    const tabla = await screen.findByRole('table');
    // Act: búsqueda por cliente.
    await usuario.type(screen.getByPlaceholderText(/Buscar por técnico/), 'Carolina');
    // Assert
    await waitFor(() => expect(within(tabla).queryByText('Cita no realizada')).toBeNull());
    // Act: limpiar y filtrar por tipo.
    await usuario.click(screen.getByRole('button', { name: /Limpiar/ }));
    await usuario.selectOptions(screen.getAllByRole('combobox')[0], 'Cita no realizada');
    // Assert
    await waitFor(() => expect(within(tabla).queryByText('Retraso en entrega')).toBeNull());
    expect(within(tabla).getByText('Cita no realizada')).toBeTruthy();
  });

  it('combina filtros por estado, prioridad, técnico, origen, evidencia e IDs', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByRole('table');
    // Act: aplicar todos los filtros que solo cumple la novedad de pedido.
    await usuario.click(screen.getByRole('button', { name: /^Pendiente/ }));
    await usuario.selectOptions(screen.getAllByRole('combobox')[0], 'Retraso en entrega');
    await usuario.selectOptions(screen.getAllByRole('combobox')[1], 'alta');
    await usuario.selectOptions(screen.getAllByRole('combobox')[2], '5');
    await usuario.selectOptions(screen.getAllByRole('combobox')[3], 'pedido');
    await usuario.selectOptions(screen.getAllByRole('combobox')[4], 'si');
    await usuario.type(screen.getByPlaceholderText('# Cliente'), '7');
    await usuario.type(screen.getByPlaceholderText('# Pedido'), '88');
    // Assert: queda una sola fila y el contador lo refleja.
    await waitFor(() => expect(screen.getByText('1 de 2 novedades')).toBeTruthy());
    // Act: un cliente inexistente deja el estado vacío con opción de limpiar.
    await usuario.clear(screen.getByPlaceholderText('# Cliente'));
    await usuario.type(screen.getByPlaceholderText('# Cliente'), '999');
    // Assert
    expect(await screen.findByText('Sin resultados')).toBeTruthy();
    await usuario.click(screen.getByRole('button', { name: /Limpiar filtros/ }));
    expect(await screen.findByText('2 de 2 novedades')).toBeTruthy();
  });

  it('muestra el error de carga y permite reintentar', async () => {
    // Arrange
    apiMock.get.mockRejectedValue(new Error('sin red'));
    montar();
    // Assert
    expect(await screen.findByText('No se pudieron cargar las novedades')).toBeTruthy();
    // Act
    red();
    await userEvent.setup().click(screen.getByRole('button', { name: 'Reintentar' }));
    // Assert
    expect(await screen.findByRole('table')).toBeTruthy();
  });
});

describe('AdminNovedades — detalle', () => {
  it('abre el detalle con descripción, evidencias e historial', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByRole('table');
    // Act
    await abrirDetalle(usuario);
    // Assert
    const panel = panelDetalle();
    expect(within(panel).getByText('El pedido llegó tarde')).toBeTruthy();
    expect(within(panel).getByText('Calle Cliente 123')).toBeTruthy();
    expect(within(panel).getByText('Evidencia (1)')).toBeTruthy();
    expect(within(panel).getByText('Reporte inicial')).toBeTruthy();
    expect(within(panel).getByText('Ya vamos en camino')).toBeTruthy();
    expect(within(panel).getByText('Se compensó el envío')).toBeTruthy();
  });

  it('muestra una novedad sin origen, sin cliente y sin historial', async () => {
    // Arrange
    const sinOrigen = {
      ...NOVEDAD_PEDIDO, id_pedido: null, id_cita: null, id_devolucion: null,
      id_cliente: null, tecnico_nombre: null, cliente_nombre: null,
      evidencias: [], historial: [], mensaje_cliente: null, solucion_cliente: null,
    };
    red([sinOrigen], sinOrigen);
    const usuario = userEvent.setup();
    montar();
    const tabla = await screen.findByRole('table');
    expect(within(tabla).getByText('Sin origen')).toBeTruthy();
    // Act
    await abrirDetalle(usuario);
    // Assert: no se renderizan secciones que dependen de cliente/origen.
    const panel = panelDetalle();
    expect(within(panel).getByText('El pedido llegó tarde')).toBeTruthy();
    expect(within(panel).queryByText('Compensación al cliente')).toBeNull();
    expect(within(panel).queryByText('Cambiar técnico')).toBeNull();
    expect(within(panel).queryByText(/Evidencia \(/)).toBeNull();
  });

  it('cambia el estado con comentario y envía nuevo_estado', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByRole('table');
    await abrirDetalle(usuario);
    const panel = panelDetalle();
    // Act
    await usuario.selectOptions(within(panel).getByDisplayValue('Pendiente'), 'Resuelta');
    await usuario.type(within(panel).getByPlaceholderText(/Comentario/), 'Se validó con el cliente');
    await usuario.click(within(panel).getByRole('button', { name: 'Guardar' }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/novedades/41/estado', {
      nuevo_estado: 'Resuelta', accion_detalle: 'Se validó con el cliente',
    }));
    expect(await screen.findByText('Estado actualizado')).toBeTruthy();
  });

  it('genera un cupón de compensación con los datos del formulario', async () => {
    // Arrange
    red();
    apiMock.post.mockResolvedValue({ data: { id_cupon: 3 } });
    const usuario = userEvent.setup();
    montar();
    await screen.findByRole('table');
    await abrirDetalle(usuario);
    const panel = panelDetalle();
    // Act
    await usuario.click(within(panel).getByRole('button', { name: /Generar cupón/ }));
    await usuario.type(within(panel).getByPlaceholderText(/Código/), 'demora123');
    await usuario.type(within(panel).getByPlaceholderText('Valor'), '15');
    await usuario.clear(within(panel).getByPlaceholderText(/Usos máximos/));
    await usuario.type(within(panel).getByPlaceholderText(/Usos máximos/), '3');
    await usuario.click(within(panel).getByRole('button', { name: 'Crear cupón' }));
    // Assert
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/novedades/41/cupon', expect.objectContaining({
      codigo: 'DEMORA123', tipo_descuento: 'porcentaje', valor_descuento: 15, usos_maximos: 3,
    })));
    expect(await screen.findByText('Cupón generado y cliente notificado')).toBeTruthy();
  });

  it('no genera cupones sin código ni valor', async () => {
    // Arrange
    red();
    const usuario = userEvent.setup();
    montar();
    await screen.findByRole('table');
    await abrirDetalle(usuario);
    const panel = panelDetalle();
    // Act
    await usuario.click(within(panel).getByRole('button', { name: /Generar cupón/ }));
    await usuario.click(within(panel).getByRole('button', { name: 'Crear cupón' }));
    // Assert
    expect(await screen.findByText('Completa código y valor del cupón')).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('responde al técnico y envía mensaje/solución visible al cliente', async () => {
    // Arrange
    red();
    apiMock.post.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByRole('table');
    await abrirDetalle(usuario);
    // Act: respuesta al técnico.
    let panel = panelDetalle();
    await usuario.type(within(panel).getByPlaceholderText(/Escribe una respuesta/), 'Validar la ruta asignada');
    await usuario.click(within(panel).getByRole('button', { name: 'Enviar respuesta' }));
    // Assert
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/novedades/41/responder', {
      respuesta: 'Validar la ruta asignada',
    }));
    // Act: mensaje al cliente.
    await waitFor(() => expect(within(panelDetalle()).getByPlaceholderText(/Mensaje para el cliente/)).toBeTruthy());
    panel = panelDetalle();
    await usuario.type(within(panel).getByPlaceholderText(/Mensaje para el cliente/), 'Tu pedido será compensado');
    await usuario.type(within(panel).getByPlaceholderText(/Solución detallada/), 'Cupón del 15 %');
    await usuario.click(within(panel).getByLabelText('Hacer visible para el cliente'));
    await usuario.click(within(panel).getByRole('button', { name: 'Enviar al cliente' }));
    // Assert
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/novedades/41/mensaje-cliente', {
      mensaje_cliente: 'Tu pedido será compensado',
      solucion_cliente: 'Cupón del 15 %',
      cliente_visible: true,
    }));
  });

  it('reasigna la novedad a otro técnico con motivo', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByRole('table');
    await abrirDetalle(usuario);
    const panel = panelDetalle();
    // Act
    await usuario.click(within(panel).getByRole('button', { name: 'Cambiar técnico' }));
    const selector = within(panel).getByDisplayValue('Seleccionar técnico...');
    await usuario.selectOptions(selector, '5');
    await usuario.type(within(panel).getByPlaceholderText(/Motivo del cambio/), 'Zona asignada');
    await usuario.click(within(panel).getByRole('button', { name: 'Confirmar cambio' }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/novedades/41/cambiar-tecnico', {
      id_nuevo_tecnico: 5, motivo: 'Zona asignada',
    }));
    expect(await screen.findByText('Técnico cambiado y notificaciones enviadas')).toBeTruthy();
  });
});
