// Semana 5 del bootcamp — ClienteNovedades (seguimiento de reportes del cliente).
// Cubre carga de novedades y cupones, filtros por estado/búsqueda, apertura
// del detalle con evidencias, cupón e historial, y los avisos de error.
// Red simulada; las imágenes autenticadas se sustituyen por un doble.
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@components/common/AuthImage', () => ({
  default: ({ src }: { src: string }) => <div data-testid="evidencia">{src}</div>,
}));

import ClienteNovedades from './ClienteNovedades';

const NOVEDAD = {
  id_novedad: 21,
  tipo_novedad: 'producto',
  tipo_novedad_label: 'Producto defectuoso',
  descripcion_novedad: 'La cámara no enciende',
  estado_novedad: 'Pendiente',
  estado_novedad_label: 'Pendiente',
  prioridad: 'alta',
  prioridad_label: 'Alta',
  fecha_reporte: '2026-11-02T10:30:00',
  tecnico_nombre: 'Andrés Técnico',
  cliente_nombre: 'Carolina Méndez',
  lugar_ocurrencia: 'Calle 100 # 20-30',
  id_pedido: 45,
  id_cita: null,
  mensaje_cliente: '¿Alguna novedad?',
  solucion_cliente: null,
  imagen_url: null,
};

const NOVEDAD_RESUELTA = {
  ...NOVEDAD,
  id_novedad: 22,
  tipo_novedad: 'servicio',
  tipo_novedad_label: 'Servicio',
  descripcion_novedad: 'Instalación incompleta',
  estado_novedad: 'Resuelta',
  estado_novedad_label: 'Resuelta',
  prioridad: 'baja',
  prioridad_label: 'Baja',
  fecha_reporte: '2026-10-20T08:00:00',
  tecnico_nombre: null,
  mensaje_cliente: null,
  solucion_cliente: 'Se completó la instalación el 22 de octubre',
  id_pedido: null,
  id_cita: 9,
};

const CUPON = {
  id_cupon: 3,
  codigo: 'LO SENTIMOS10',
  tipo_descuento: 'porcentaje',
  valor_descuento: 10,
  fecha_vencimiento: '2026-12-31',
  compra_minima: 0,
  usos_maximos: 2,
  usos_realizados: 0,
  activo: true,
};

const DETALLE = {
  ...NOVEDAD,
  historial: [
    {
      id_historial: 1,
      accion: 'Reporte creado',
      detalle: 'El cliente adjuntó una foto',
      fecha: '2026-11-02T10:31:00',
      usuario_nombre: 'Carolina Méndez',
    },
    {
      id_historial: 2,
      accion: 'Revisión asignada',
      detalle: null,
      fecha: '2026-11-03T09:00:00',
      usuario_nombre: null,
    },
  ],
  evidencias: [
    { id_evidencia_n: 1, url: '/media/novedades/foto1.jpg' },
    { id_evidencia_n: 2, url: '/media/novedades/foto2.jpg' },
  ],
  accion_admin: 'Se agendó una visita técnica',
  cupon: { ...CUPON, activo: true, usos_maximos: 1, usos_realizados: 0 },
};

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <ClienteNovedades />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function responder(novedades: any[] = [NOVEDAD, NOVEDAD_RESUELTA], cupones: any[] = [CUPON]) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/novedades/cliente/novedades') return { data: novedades };
    if (url === '/novedades/cliente/mis-cupones') return { data: cupones };
    if (url.match(/^\/novedades\/\d+$/)) return { data: DETALLE };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

function cerrarModal() {
  const cerrar = document.querySelector('.ap-modal-x') as HTMLElement | null;
  if (!cerrar) throw new Error('No hay modal abierto');
  cerrar.click();
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('ClienteNovedades — listado y cupones', () => {
  it('muestra las novedades, sus etiquetas y los cupones del cliente', async () => {
    // Arrange
    responder();
    montar();
    // Assert
    expect(await screen.findByText('Producto defectuoso')).toBeTruthy();
    expect(screen.getByText('Andrés Técnico')).toBeTruthy();
    expect(screen.getByText('Alta')).toBeTruthy();
    expect(screen.getByText('Resuelta', { selector: '.ap-badge' })).toBeTruthy();
    expect(screen.getByText('2 de 2 novedades')).toBeTruthy();
    expect(screen.getByText('Mensaje recibido')).toBeTruthy();
    expect(screen.getAllByText(/Soluci/).length).toBeGreaterThan(0);
    // Cupones: código, descuento, vencimiento y usos restantes.
    expect(screen.getByText('LO SENTIMOS10')).toBeTruthy();
    expect(screen.getByText('10% de descuento')).toBeTruthy();
    expect(screen.getByText(/2 uso\(s\) disponible\(s\)/)).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Usar en mi compra' })).toBeTruthy();
  });

  it('sin cupones ni novedades muestra los estados vacíos', async () => {
    // Arrange
    responder([], []);
    montar();
    // Assert
    expect(await screen.findByText(/no tienes cupones disponibles/)).toBeTruthy();
    expect(await screen.findByText('Sin novedades')).toBeTruthy();
    expect(screen.getByText('Aun no has reportado ninguna novedad.')).toBeTruthy();
    expect(screen.queryByRole('link', { name: 'Usar en mi compra' })).toBeNull();
  });
});

describe('ClienteNovedades — filtros', () => {
  it('filtra por estado y por texto, y avisa cuando no hay coincidencias', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Producto defectuoso');
    // Act: píldora de estado.
    await usuario.click(screen.getByRole('button', { name: 'Resuelta' }));
    // Assert
    expect(screen.getByText('Servicio')).toBeTruthy();
    expect(screen.queryByText('Producto defectuoso')).toBeNull();
    expect(screen.getByText('1 de 2 novedades')).toBeTruthy();
    // Act: desactiva la píldora y busca por técnico.
    await usuario.click(screen.getByRole('button', { name: 'Resuelta' }));
    const buscador = screen.getByPlaceholderText(/Buscar por tipo/);
    await usuario.type(buscador, 'andrés');
    // Assert
    expect(screen.getByText('Producto defectuoso')).toBeTruthy();
    expect(screen.queryByText('Servicio')).toBeNull();
    // Act: búsqueda sin coincidencias.
    await usuario.clear(buscador);
    await usuario.type(buscador, 'inexistente');
    // Assert
    expect(await screen.findByText('Sin resultados')).toBeTruthy();
    expect(screen.getByText(/No se encontraron novedades/)).toBeTruthy();
    // Act: quitar la búsqueda y usar el selector de estado.
    await usuario.clear(buscador);
    await usuario.selectOptions(screen.getByRole('combobox'), 'Pendiente');
    // Assert
    expect(screen.getByText('Producto defectuoso')).toBeTruthy();
    expect(screen.queryByText('Servicio')).toBeNull();
  });
});

describe('ClienteNovedades — detalle', () => {
  it('abre el modal con evidencias, acción, mensaje, solución, cupón e historial', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Producto defectuoso');
    // Act: el botón de la fila.
    await usuario.click(screen.getAllByRole('button', { name: /Ver detalle/ })[0]);
    // Assert
    expect(await screen.findByText('Novedad #21')).toBeTruthy();
    expect(screen.getByText('Calle 100 # 20-30')).toBeTruthy();
    expect(screen.getByText('Se agendó una visita técnica')).toBeTruthy();
    expect(screen.getByText('¿Alguna novedad?')).toBeTruthy();
    expect(screen.getByText(/#45/)).toBeTruthy();
    expect(screen.getByText('Evidencia (2)')).toBeTruthy();
    expect(screen.getAllByTestId('evidencia')).toHaveLength(2);
    expect(
      screen.getByText(
        (contenido) => contenido.includes('LO SENTIMOS10') && contenido.includes('compensaci'),
      ),
    ).toBeTruthy();
    expect(screen.getByText('Disponible para usar al pagar')).toBeTruthy();
    expect(screen.getByText('Historial')).toBeTruthy();
    expect(screen.getByText('Reporte creado')).toBeTruthy();
    expect(screen.getByText('por Carolina Méndez')).toBeTruthy();
    expect(screen.getByText('Revisión asignada')).toBeTruthy();
    expect(screen.getByText('por Sistema')).toBeTruthy();
    // Act: cerrar.
    cerrarModal();
    // Assert
    await waitFor(() => expect(screen.queryByText('Novedad #21')).toBeNull());
  });

  it('permite abrir el detalle desde el aviso de mensaje y desde la solución', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Producto defectuoso');
    // Act: clic en "Mensaje recibido".
    await usuario.click(screen.getByText('Mensaje recibido'));
    // Assert
    expect(await screen.findByText('Novedad #21')).toBeTruthy();
    cerrarModal();
    await waitFor(() => expect(screen.queryByText('Novedad #21')).toBeNull());
    // Act: clic en "Solución" dentro de la tabla.
    await usuario.click(within(screen.getByRole('table')).getByText(/Soluci/));
    // Assert
    expect(await screen.findByText('Novedad #21')).toBeTruthy();
  });

  it('un detalle sin campos opcionales no muestra secciones vacías', async () => {
    // Arrange: detalle mínimo (sin evidencias, cupón ni historial).
    responder();
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/novedades/cliente/novedades') return { data: [NOVEDAD_RESUELTA] };
      if (url === '/novedades/cliente/mis-cupones') return { data: [] };
      return {
        data: {
          ...NOVEDAD_RESUELTA,
          evidencias: [],
          historial: [],
          cupon: null,
          accion_admin: null,
          mensaje_cliente: null,
          solucion_cliente: null,
        },
      };
    });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Servicio');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Ver detalle/ }));
    // Assert
    expect(await screen.findByText('Novedad #22')).toBeTruthy();
    expect(screen.getByText('#9')).toBeTruthy();
    expect(screen.queryByText(/Evidencia/)).toBeNull();
    expect(screen.queryByText('Historial')).toBeNull();
    expect(screen.queryByText(/compensaci/)).toBeNull();
  });
});

describe('ClienteNovedades — errores', () => {
  it('si falla la carga muestra el aviso de error', async () => {
    // Arrange
    apiMock.get.mockRejectedValue(new Error('down'));
    montar();
    // Assert
    expect(await screen.findByText('Error al cargar tus novedades')).toBeTruthy();
  });

  it('si falla el detalle conserva el listado y avisa', async () => {
    // Arrange
    responder();
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/novedades/cliente/novedades') return { data: [NOVEDAD] };
      if (url === '/novedades/cliente/mis-cupones') return { data: [] };
      throw new Error('detalle caído');
    });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Producto defectuoso');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Ver detalle/ }));
    // Assert
    expect(await screen.findByText('Error al cargar detalle')).toBeTruthy();
    expect(screen.getByText('Producto defectuoso')).toBeTruthy();
  });

  it('el cupón sin vencimiento y de valor fijo se muestra correctamente', async () => {
    // Arrange
    responder([NOVEDAD], [{ ...CUPON, tipo_descuento: 'fijo', valor_descuento: 50000, fecha_vencimiento: null }]);
    montar();
    // Assert
    const cupon = await screen.findByText('50.000 COP de descuento');
    expect(cupon).toBeTruthy();
    expect(screen.getByText(/Sin fecha de vencimiento/)).toBeTruthy();
    const tarjeta = cupon.closest('article') as HTMLElement;
    expect(within(tarjeta).getByText('LO SENTIMOS10')).toBeTruthy();
  });
});
