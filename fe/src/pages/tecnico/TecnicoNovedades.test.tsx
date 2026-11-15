// Semana 5 del bootcamp — TecnicoNovedades (historial y reporte de novedades).
// Cubre listado y filtros, estados vacíos, detalle con evidencias e historial,
// envío de mensaje/solución al cliente y el formulario por pasos (cliente,
// origen, detalle y evidencia) con sus validaciones. Red simulada.
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

import TecnicoNovedades from './TecnicoNovedades';

const NOVEDAD_PEDIDO = {
  id_novedad: 1,
  tipo_novedad: 'Producto danado',
  tipo_novedad_label: 'Producto danado',
  descripcion_novedad: 'La caja llegó abollada',
  prioridad: 'alta',
  prioridad_label: 'Alta',
  estado_novedad: 'Pendiente',
  estado_novedad_label: 'Pendiente',
  fecha_reporte: '2026-11-03T10:00:00',
  lugar_ocurrencia: 'Bodega principal',
  evidencia_url: null,
  id_pedido: 77,
  id_cita: null,
  id_cliente: 5,
  id_devolucion: null,
  id_tecnico: 10,
  tecnico_nombre: 'Andrés Técnico',
  cliente_nombre: 'Carolina Méndez',
  accion_admin: null,
  mensaje_cliente: 'Estamos revisando tu caso',
  solucion_cliente: null,
  cliente_visible: false,
  fecha_resolucion: null,
  evidencias: [],
};

const NOVEDAD_CITA = {
  ...NOVEDAD_PEDIDO,
  id_novedad: 2,
  tipo_novedad: 'Cita no realizada',
  tipo_novedad_label: 'Cita no realizada',
  descripcion_novedad: 'El cliente no estaba',
  prioridad: 'urgente',
  prioridad_label: 'Urgente',
  estado_novedad: 'En revision',
  estado_novedad_label: 'En revisión',
  fecha_reporte: '2026-11-04T12:30:00',
  lugar_ocurrencia: null,
  id_pedido: null,
  id_cita: 88,
  id_cliente: 6,
  cliente_nombre: 'Luis Pérez',
  mensaje_cliente: null,
  solucion_cliente: 'Se reprogramó la cita',
  cliente_visible: true,
  evidencias: [{ id_evidencia_n: 4, url: '/media/novedades/ev4.jpg', fecha_subida: '2026-11-04T13:00:00' }],
};

const NOVEDAD_DEVOLUCION = {
  ...NOVEDAD_PEDIDO,
  id_novedad: 3,
  tipo_novedad: 'Producto faltante',
  tipo_novedad_label: 'Producto faltante',
  descripcion_novedad: 'Falta un tornillo en la caja',
  prioridad: 'normal',
  prioridad_label: 'Normal',
  estado_novedad: 'Resuelta',
  estado_novedad_label: 'Resuelta',
  id_pedido: null,
  id_cita: null,
  id_devolucion: 9,
  cliente_nombre: 'Ana Torres',
  mensaje_cliente: null,
  solucion_cliente: null,
};

const NOVEDAD_SIN_ORIGEN = {
  ...NOVEDAD_PEDIDO,
  id_novedad: 4,
  tipo_novedad: 'Otro',
  tipo_novedad_label: 'Otro',
  descripcion_novedad: 'Novedad general de la jornada',
  prioridad: 'baja',
  prioridad_label: 'Baja',
  estado_novedad: 'Cerrada',
  estado_novedad_label: 'Cerrada',
  id_pedido: null,
  id_cliente: null,
  cliente_nombre: null,
  mensaje_cliente: null,
};

const CLIENTES = [
  {
    id_cliente: 5,
    nombre: 'Carolina Méndez',
    email: 'carolina@example.com',
    telefono: 3105027488,
    documento: 10203040,
    direccion: 'Calle 100 # 20-30',
  },
];

const PEDIDOS = [
  {
    id_pedido: 77,
    fecha_pedido: '2026-11-01T09:00:00',
    estado_pedido: 'En camino',
    total: 120000,
    fecha_entrega: '2026-11-05',
    hora_entrega: '09:00',
    hora_entrega_fin: '11:00',
    estado_entrega: 'Pendiente',
    nombre_tecnico: 'Andrés Técnico',
    detalles: [{ producto: 'Panel LED', cantidad: 2, precio: 60000 }],
  },
];

const CITAS = [
  {
    id_cita: 88,
    fecha: '2026-11-05',
    hora: '10:00',
    tipo_servicio: 'instalacion',
    especialidad: 'Redes',
    estado: 'Confirmada',
    direccion: 'Calle 100 # 20-30',
    descripcion: 'Instalar panel',
    costo: 120000,
    nombre_tecnico: 'Andrés Técnico',
    id_tecnico: 10,
  },
];

const DETALLE = {
  ...NOVEDAD_CITA,
  descripcion_novedad: 'El cliente no estaba',
  lugar_ocurrencia: 'Calle 100 # 20-30',
  accion_admin: 'Se validó con el cliente y se reprogramó',
  mensaje_cliente: 'Estamos revisando tu caso',
  historial: [
    {
      id_historial: 1,
      accion: 'Novedad creada',
      detalle: 'Reportada por el técnico',
      fecha: '2026-11-04T12:30:00',
      usuario_nombre: 'Andrés Técnico',
    },
    {
      id_historial: 2,
      accion: 'Reprogramación aprobada',
      detalle: null,
      fecha: '2026-11-04T14:00:00',
      usuario_nombre: null,
    },
  ],
};

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <TecnicoNovedades />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function responder(novedades: any[] = [NOVEDAD_PEDIDO, NOVEDAD_CITA, NOVEDAD_DEVOLUCION, NOVEDAD_SIN_ORIGEN]) {
  apiMock.get.mockImplementation(async (url: string, config?: any) => {
    if (url === '/novedades/mis-novedades') return { data: novedades };
    if (url === '/novedades/clientes-buscar') {
      return { data: config?.params?.q === 'zzz' ? [] : CLIENTES };
    }
    if (/^\/novedades\/clientes\/5\/pedidos$/.test(url)) return { data: PEDIDOS };
    if (/^\/novedades\/clientes\/5\/citas$/.test(url)) return { data: CITAS };
    if (/^\/novedades\/\d+$/.test(url)) return { data: DETALLE };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  apiMock.post.mockImplementation(async (url: string) => {
    if (url === '/novedades') return { data: { id_novedad: 99, mensaje: 'ok' } };
    return { data: {} };
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('TecnicoNovedades — listado y filtros', () => {
  it('muestra las novedades con prioridad, estado, origen, evidencia y mensajes', async () => {
    // Arrange
    responder();
    montar();
    // Assert: tabla con las cuatro novedades y sus etiquetas.
    expect(await screen.findByText('Producto danado')).toBeTruthy();
    expect(screen.getByText('Historial de novedades')).toBeTruthy();
    expect(screen.getByText('Cita no realizada')).toBeTruthy();
    expect(screen.getByText('Producto faltante')).toBeTruthy();
    // Prioridades y estados.
    expect(screen.getAllByText('Alta').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Urgente').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Pendiente').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/En revisi/).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Resuelta').length).toBeGreaterThan(0);
    // Orígenes: pedido, cita, devolución y sin origen.
    expect(screen.getByText('#77')).toBeTruthy();
    expect(screen.getByText('Cita #88')).toBeTruthy();
    expect(screen.getByText('Dev #9')).toBeTruthy();
    expect(screen.getByText('Sin origen')).toBeTruthy();
    // Clientes y contadores.
    expect(screen.getByText('Carolina Méndez')).toBeTruthy();
    expect(screen.getByText('Luis Pérez')).toBeTruthy();
    expect(screen.getByText('Ana Torres')).toBeTruthy();
    expect(screen.getByText('4 de 4 novedades')).toBeTruthy();
    // Mensaje enviado y solución visible/oculta.
    expect(screen.getByRole('button', { name: /Enviado/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Visible/ })).toBeTruthy();
  });

  it('filtra por estado, prioridad, relación y búsqueda, y limpia los filtros', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Producto danado');
    // Act: píldora del estado Pendiente.
    await usuario.click(screen.getByRole('button', { name: /^Pendiente/ }));
    // Assert
    expect(screen.getByText('Producto danado')).toBeTruthy();
    expect(screen.queryByText('Cita no realizada')).toBeNull();
    expect(screen.getByText('1 de 4 novedades')).toBeTruthy();
    // Act: cambiar a la píldora Resuelta.
    await usuario.click(screen.getByRole('button', { name: /^Resuelta/ }));
    // Assert
    expect(screen.getByText('Producto faltante')).toBeTruthy();
    expect(screen.queryByText('Producto danado')).toBeNull();
    // Act: limpiar con la píldora Todas.
    await usuario.click(screen.getByRole('button', { name: /^Todas/ }));
    // Act: prioridad urgente.
    await usuario.selectOptions(screen.getByDisplayValue('Todas las prioridades'), 'urgente');
    // Assert
    expect(screen.getByText('Cita no realizada')).toBeTruthy();
    expect(screen.queryByText('Producto danado')).toBeNull();
    // Act: limpiar y filtrar por origen de devolución.
    await usuario.click(screen.getByRole('button', { name: /Limpiar/ }));
    await usuario.selectOptions(screen.getByDisplayValue('Todos los orígenes'), 'devolucion');
    // Assert
    expect(screen.getByText('Producto faltante')).toBeTruthy();
    expect(screen.queryByText('Cita no realizada')).toBeNull();
    // Act: limpiar y buscar por pedido y por cliente.
    await usuario.click(screen.getByRole('button', { name: /Limpiar/ }));
    const buscador = screen.getByPlaceholderText(/Buscar por tipo, cliente, pedido/);
    await usuario.type(buscador, '#77');
    // Assert
    expect(screen.getByText('Producto danado')).toBeTruthy();
    expect(screen.queryByText('Producto faltante')).toBeNull();
    await usuario.clear(buscador);
    await usuario.type(buscador, 'luis');
    // Assert
    expect(screen.getByText('Cita no realizada')).toBeTruthy();
    expect(screen.queryByText('Producto danado')).toBeNull();
    // Act: búsqueda sin coincidencias.
    await usuario.clear(buscador);
    await usuario.type(buscador, 'zzz');
    // Assert
    expect(await screen.findByText('Sin resultados')).toBeTruthy();
    expect(screen.getByText(/No se encontraron novedades/)).toBeTruthy();
    // Act: botón Limpiar filtros del estado vacío.
    await usuario.click(screen.getByRole('button', { name: /Limpiar filtros/ }));
    // Assert
    expect(screen.getByText('Producto danado')).toBeTruthy();
  });

  it('sin novedades muestra el estado vacío con el botón para agregar', async () => {
    // Arrange
    responder([]);
    montar();
    // Assert
    expect(await screen.findByText('Sin novedades aun')).toBeTruthy();
    expect(screen.getByText(/Aun no has reportado novedades/)).toBeTruthy();
    expect(screen.getAllByRole('button', { name: /Agregar novedad/ }).length).toBeGreaterThan(0);
  });

  it('si falla la carga avisa con un toast', async () => {
    // Arrange
    apiMock.get.mockRejectedValue(new Error('down'));
    montar();
    // Assert
    expect(await screen.findByText('Error al cargar novedades')).toBeTruthy();
    expect(await screen.findByText('Sin novedades aun')).toBeTruthy();
  });
});

describe('TecnicoNovedades — detalle', () => {
  it('abre el detalle con lugar, descripción, evidencias, respuesta e historial', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    const { container } = montar();
    await screen.findByText('Cita no realizada');
    // Act: Ver de la segunda novedad.
    await usuario.click(screen.getAllByRole('button', { name: /Ver/ })[1]);
    // Assert
    expect(await screen.findByText('Novedad #2')).toBeTruthy();
    const modal = container.querySelector('.ap-modal') as HTMLElement;
    expect(within(modal).getByText(/En revisi/)).toBeTruthy();
    expect(within(modal).getByText('Calle 100 # 20-30')).toBeTruthy();
    expect(within(modal).getByText('El cliente no estaba')).toBeTruthy();
    expect(within(modal).getByText('Evidencia')).toBeTruthy();
    expect(within(modal).getAllByTestId('evidencia').length).toBe(1);
    expect(within(modal).getByText('Respuesta del admin')).toBeTruthy();
    expect(within(modal).getByText(/Se valid/)).toBeTruthy();
    expect(within(modal).getByText('Mensaje al cliente')).toBeTruthy();
    expect(within(modal).getByText(/Estamos revisando tu caso/)).toBeTruthy();
    expect(within(modal).getByText(/Soluci.*para el cliente/)).toBeTruthy();
    expect(within(modal).getByText('Se reprogramó la cita')).toBeTruthy();
    expect(within(modal).getByText('(visible)')).toBeTruthy();
    // Historial con usuario y sistema.
    expect(within(modal).getByText('Historial')).toBeTruthy();
    expect(within(modal).getByText('Novedad creada')).toBeTruthy();
    expect(within(modal).getByText('por Andrés Técnico')).toBeTruthy();
    expect(within(modal).getByText('Reprogramación aprobada')).toBeTruthy();
    expect(within(modal).getByText('por Sistema')).toBeTruthy();
    // Act: cerrar con la X.
    fireEvent.click(container.querySelector('.ap-modal-x') as HTMLElement);
    // Assert
    await waitFor(() => expect(screen.queryByText('Novedad #2')).toBeNull());
  });

  it('si el detalle falla muestra el toast de error', async () => {
    // Arrange: listado correcto, detalle caído.
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/novedades/mis-novedades') return { data: [NOVEDAD_PEDIDO] };
      throw new Error('down');
    });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Producto danado');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Ver/ }));
    // Assert
    expect(await screen.findByText('Error al cargar detalle')).toBeTruthy();
  });

  it('envía el mensaje y la solución al cliente y refresca el detalle', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Cita no realizada');
    await usuario.click(screen.getAllByRole('button', { name: /Ver/ })[1]);
    await screen.findByText('Novedad #2');
    const mensaje = screen.getByPlaceholderText('Mensaje para el cliente (obligatorio)');
    const solucion = screen.getByPlaceholderText('Solución detallada (opcional)');
    // Act
    await usuario.type(mensaje, '  Ya fue atendido  ');
    await usuario.type(solucion, 'Se envió un técnico');
    await usuario.click(screen.getByRole('checkbox'));
    await usuario.click(screen.getByRole('button', { name: /Enviar al cliente/ }));
    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/novedades/2/mensaje-cliente', {
        mensaje_cliente: 'Ya fue atendido',
        solucion_cliente: 'Se envió un técnico',
        cliente_visible: true,
      }),
    );
    expect(await screen.findByText(/Mensaje y solu/)).toBeTruthy();
    // Se recarga el detalle y la lista.
    await waitFor(() =>
      expect(apiMock.get.mock.calls.filter(([u]) => u === '/novedades/2').length).toBeGreaterThan(1),
    );
    expect(mensaje).toHaveProperty('value', '');
  });

  it('si el envío falla muestra el detalle devuelto por el backend', async () => {
    // Arrange
    responder();
    apiMock.post.mockRejectedValue({ response: { data: { detail: 'El mensaje no puede estar vacío' } } });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Cita no realizada');
    await usuario.click(screen.getAllByRole('button', { name: /Ver/ })[1]);
    await screen.findByText('Novedad #2');
    // Act
    await usuario.type(screen.getByPlaceholderText('Mensaje para el cliente (obligatorio)'), 'Hola');
    await usuario.click(screen.getByRole('button', { name: /Enviar al cliente/ }));
    // Assert
    expect(await screen.findByText('El mensaje no puede estar vacío')).toBeTruthy();
  });
});

describe('TecnicoNovedades — formulario por pasos', () => {
  it('crea la novedad con cliente, pedido, prioridad, lugar y evidencia', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    const { container } = montar();
    await screen.findByText('Producto danado');
    // Act: abrir formulario y buscar cliente.
    await usuario.click(screen.getByRole('button', { name: /Agregar novedad/ }));
    await usuario.type(screen.getByPlaceholderText('Escribe para buscar...'), 'carolina');
    // Assert: resultado de búsqueda.
    const resultado = await screen.findByRole('button', { name: /Carolina Méndez/ });
    // Act: elegir cliente y cargar origen.
    await usuario.click(resultado);
    // Assert
    expect(await screen.findByText('Pedidos')).toBeTruthy();
    expect(await screen.findByText('Citas')).toBeTruthy();
    expect(screen.getByText(/Pedidos y citas de Carolina Méndez/)).toBeTruthy();
    // Act: elegir el pedido.
    await usuario.click(screen.getByRole('button', { name: /Pedido #77/ }));
    // Assert: resumen y campos del detalle.
    expect(screen.getByText(/Pedido #77/)).toBeTruthy();
    expect(screen.getAllByText(/Cita ·/).length).toBeGreaterThan(0);
    // Act: completar tipo, prioridad, lugar y descripción.
    fireEvent.change(screen.getByLabelText(/Tipo de novedad/), { target: { value: 'Producto danado' } });
    await usuario.click(screen.getByRole('button', { name: 'Urgente' }));
    await usuario.type(screen.getByPlaceholderText('Ej: Av. Principal #123'), 'Bodega norte');
    await usuario.type(
      screen.getByPlaceholderText('Describe la situacion detalladamente...'),
      'La caja llegó abollada',
    );
    // Act: pasar a evidencia.
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }));
    // Assert
    expect(screen.getByText('Evidencia de la novedad')).toBeTruthy();
    // Act: adjuntar foto y enviar.
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    fireEvent.change(input, {
      target: { files: [new File(['foto'], 'evidencia.jpg', { type: 'image/jpeg' })] },
    });
    expect(await screen.findByAltText('Evidencia')).toBeTruthy();
    await usuario.click(screen.getByRole('button', { name: /Enviar reporte/ }));
    // Assert: payload y subida de la evidencia.
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/novedades', {
        tipo_novedad: 'Producto danado',
        descripcion: 'La caja llegó abollada',
        prioridad: 'urgente',
        id_pedido: 77,
        id_cita: 88,
        id_cliente: 5,
        lugar_ocurrencia: 'Bodega norte',
      }),
    );
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/novedades/99/evidencia', expect.any(FormData), {
        headers: { 'Content-Type': 'multipart/form-data' },
      }),
    );
    expect(await screen.findByText('Novedad reportada correctamente')).toBeTruthy();
    // El formulario se cierra y la lista se recarga.
    await waitFor(() =>
      expect(screen.queryByText('Evidencia de la novedad')).toBeNull(),
    );
  });

  it('permite reportar una novedad general sin pedido ni cita', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    const { container } = montar();
    await screen.findByText('Producto danado');
    // Act: abrir formulario y elegir novedad general.
    await usuario.click(screen.getByRole('button', { name: /Agregar novedad/ }));
    await usuario.click(screen.getByRole('button', { name: /Novedad general, sin pedido ni cita/ }));
    // Assert: sólo los pasos Detalle y Evidencia.
    expect(screen.getByText(/Novedad general · sin pedido ni cita/)).toBeTruthy();
    const formulario = container.querySelector('.ap-card') as HTMLElement;
    expect(within(formulario).queryByText('Origen')).toBeNull();
    // Act: completar y avanzar.
    fireEvent.change(screen.getByLabelText(/Tipo de novedad/), { target: { value: 'Otro' } });
    await usuario.type(
      screen.getByPlaceholderText('Describe la situacion detalladamente...'),
      'Novedad general',
    );
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }));
    await usuario.click(screen.getByRole('button', { name: /Enviar reporte/ }));
    // Assert: sin vínculos.
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/novedades', {
        tipo_novedad: 'Otro',
        descripcion: 'Novedad general',
        prioridad: 'normal',
        id_pedido: null,
        id_cita: null,
        id_cliente: null,
        lugar_ocurrencia: undefined,
      }),
    );
    expect(await screen.findByText('Novedad reportada correctamente')).toBeTruthy();
  });

  it('valida el tamaño y el formato de la evidencia y permite quitarla', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    const { container } = montar();
    await screen.findByText('Producto danado');
    await usuario.click(screen.getByRole('button', { name: /Agregar novedad/ }));
    await usuario.click(screen.getByRole('button', { name: /Novedad general, sin pedido ni cita/ }));
    fireEvent.change(screen.getByLabelText(/Tipo de novedad/), { target: { value: 'Otro' } });
    await usuario.type(
      screen.getByPlaceholderText('Describe la situacion detalladamente...'),
      'Con evidencia',
    );
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    // Act: archivo demasiado grande.
    const grande = new File(['x'], 'grande.jpg', { type: 'image/jpeg' });
    Object.defineProperty(grande, 'size', { value: 6 * 1024 * 1024 });
    fireEvent.change(input, { target: { files: [grande] } });
    // Assert
    expect(await screen.findByText('La imagen no puede superar 5 MB')).toBeTruthy();
    // Act: formato no permitido.
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'nota.txt', { type: 'text/plain' })] },
    });
    // Assert
    expect(await screen.findByText(/Formato no permitido/)).toBeTruthy();
    // Act: imagen válida y luego eliminarla.
    fireEvent.change(input, {
      target: { files: [new File(['x'], 'foto.png', { type: 'image/png' })] },
    });
    expect(await screen.findByAltText('Evidencia')).toBeTruthy();
    await usuario.click(screen.getByRole('button', { name: /Eliminar/ }));
    // Assert
    await waitFor(() => expect(screen.queryByAltText('Evidencia')).toBeNull());
    expect(screen.getByText('Subir foto')).toBeTruthy();
  });

  it('avisa cuando no encuentra clientes y al cerrar el formulario lo reinicia', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    const { container } = montar();
    await screen.findByText('Producto danado');
    await usuario.click(screen.getByRole('button', { name: /Agregar novedad/ }));
    // Act: búsqueda sin resultados.
    await usuario.type(screen.getByPlaceholderText('Escribe para buscar...'), 'zzz');
    // Assert
    expect(await screen.findByText('No se encontraron clientes')).toBeTruthy();
    // Act: cerrar con la X.
    fireEvent.click(container.querySelector('.ap-card .ap-modal-x') as HTMLElement);
    // Assert
    await waitFor(() => expect(screen.queryByPlaceholderText('Escribe para buscar...')).toBeNull());
    expect(screen.queryByText('Evidencia de la novedad')).toBeNull();
  });

  it('el selector de origen exige elegir un pedido o una cita', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Producto danado');
    await usuario.click(screen.getByRole('button', { name: /Agregar novedad/ }));
    await usuario.type(screen.getByPlaceholderText('Escribe para buscar...'), 'carolina');
    await usuario.click(await screen.findByRole('button', { name: /Carolina Méndez/ }));
    await screen.findByText('Pedidos');
    // Act: retroceder al paso de cliente y volver a avanzar.
    await usuario.click(screen.getByRole('button', { name: /Atras/ }));
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }));
    // Assert: sin origen elegido el botón sigue deshabilitado.
    const siguiente = await screen.findByRole('button', { name: /Siguiente/ });
    expect((siguiente as HTMLButtonElement).disabled).toBe(true);
  });
});
