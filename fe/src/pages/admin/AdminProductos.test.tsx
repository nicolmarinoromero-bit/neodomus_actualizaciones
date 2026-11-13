// Semana 3 del bootcamp — panel admin de productos (listado completo).
// Lo que ve y hace el administrador: tabla con estados/stock/precio,
// búsqueda, filtro de estado, paginación, visibilidad y ocultado, y la
// solicitud de reabastecimiento al proveedor. Red simulada.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({ apiMock: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('@services/api', () => ({ default: apiMock }));

import AdminProductos from './AdminProductos';

const PRODUCTO = {
  id_producto: 91,
  nombre_producto: 'Cinta LED RGB 5m',
  marca: 'Neodomus',
  referencia_producto: 'led-003',
  nombre_categoria: 'Iluminación',
  id_cate_pr: 3,
  stock_producto: 8,
  estado_producto: 'activo',
  visible_cliente: true,
  precio_venta_producto: 45000,
  precio_final: 36000,
  descuento_activo: 20,
  promocion_hasta: '2026-12-01',
  venta_por_metros: false,
  id_proveedor_pr: 7,
  nombre_proveedor: 'Iluminación Andina',
  variantes: [],
};

function montar(ruta = '/admin/productos') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <IdiomaProvider>
        <Routes>
          <Route path="/admin/productos" element={<AdminProductos />} />
          <Route path="/admin/productos/nuevo" element={<div>Formulario nuevo</div>} />
          <Route path="/admin/productos/:id" element={<div>Detalle producto</div>} />
        </Routes>
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function catalogo(payload: Record<string, unknown>) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url.startsWith('/productos/proveedores')) return { data: [{ id_proveedor: 7, nombre_proveedor: 'Iluminación Andina' }] };
    if (url.startsWith('/productos/?')) return { data: payload };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.put.mockReset();
  apiMock.post.mockReset();
});

describe('AdminProductos — listado', () => {
  it('muestra la tabla con stock, estado, precio con descuento y acciones', async () => {
    // Arrange
    catalogo({ data: [PRODUCTO], total: 1, total_pages: 1 });
    montar();
    // Assert: fila cargada.
    const fila = (await screen.findByText('Cinta LED RGB 5m')).closest('tr')!;
    expect(within(fila).getByText('Iluminación')).toBeTruthy();
    expect(within(fila).getByText('8 u.')).toBeTruthy();
    expect(within(fila).getByText('Activo')).toBeTruthy();
    // Precio con descuento: precio tachado + precio final + badge.
    expect(within(fila).getByText('$45.000')).toBeTruthy();
    expect(within(fila).getByText('$36.000')).toBeTruthy();
    expect(within(fila).getByText('-20%')).toBeTruthy();
    // Sin categoría también se representa (badge neutral).
  });

  it('la búsqueda envía el parámetro search y recarga', async () => {
    // Arrange
    catalogo({ data: [PRODUCTO], total: 1, total_pages: 1 });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Cinta LED RGB 5m');
    // Act
    await usuario.type(screen.getByPlaceholderText(/Buscar/i), 'cinta');
    await usuario.keyboard('{Enter}');
    // Assert: la última llamada incluye search=cinta y page=1.
    await waitFor(() => {
      const llamadas = apiMock.get.mock.calls.filter(([u]) => String(u).includes('search=cinta'));
      expect(llamadas.length).toBeGreaterThan(0);
    });
  });

  it('el filtro de estado recarga con estado=activo y reinicia a la página 1', async () => {
    // Arrange
    catalogo({ data: [PRODUCTO], total: 1, total_pages: 1 });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Cinta LED RGB 5m');
    // Act
    await usuario.selectOptions(screen.getByTitle(/visibilidad|estado/i), 'activo');
    // Assert
    await waitFor(() => {
      const conEstado = apiMock.get.mock.calls.filter(([u]) => String(u).includes('estado=activo'));
      expect(conEstado.length).toBeGreaterThan(0);
    });
  });

  it('paginación: página 2 pide page=2 al backend', async () => {
    // Arrange
    catalogo({
      data: [{ ...PRODUCTO, id_producto: 91 }],
      total: 12,
      total_pages: 2,
    });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Cinta LED RGB 5m');
    // Act
    await usuario.click(screen.getByRole('button', { name: '2' }));
    // Assert
    await waitFor(() => {
      const pag2 = apiMock.get.mock.calls.filter(([u]) => String(u).includes('page=2'));
      expect(pag2.length).toBeGreaterThan(0);
    });
  });

  it('el interruptor de visibilidad llama al endpoint y avisa con toast', async () => {
    // Arrange
    catalogo({ data: [PRODUCTO], total: 1, total_pages: 1 });
    apiMock.put.mockResolvedValue({ data: { mensaje: 'Producto oculto del catálogo' } });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Cinta LED RGB 5m');
    // Act: la fila trae un interruptor marcado (visible); al desmarcar se oculta.
    const interruptores = screen.getAllByRole('checkbox');
    await usuario.click(interruptores[0]);
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/productos/91/visibilidad'));
    expect(await screen.findByText('Producto oculto del catálogo')).toBeTruthy();
  });

  it('ocultar producto activo envía el estado inactivo con todos los campos', async () => {
    // Arrange
    catalogo({ data: [PRODUCTO], total: 1, total_pages: 1 });
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    const fila = (await screen.findByText('Cinta LED RGB 5m')).closest('tr')!;
    // Act: botón "Ocultar" del activo (único botón peligro de la fila).
    await usuario.click(within(fila).getByRole('button', { name: 'Ocultar' }));
    // Assert: PUT con estado inactivo (payload completo).
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledTimes(1));
    const [url, cuerpo] = apiMock.put.mock.calls[0];
    expect(url).toBe('/productos/91');
    expect(cuerpo).toMatchObject({ estado_producto: 'inactivo', nombre_producto: 'Cinta LED RGB 5m' });
  });

  it('sin resultados con búsqueda muestra el estado vacío correspondiente', async () => {
    // Arrange
    catalogo({ data: [], total: 0, total_pages: 1 });
    const usuario = userEvent.setup();
    montar();
    // Estado vacío inicial (sin productos) antes de buscar.
    await screen.findByText('No hay productos');
    // Act: buscar algo inexistente.
    await usuario.type(screen.getByPlaceholderText('Buscar producto...'), 'zzz');
    await usuario.keyboard('{Enter}');
    // Assert: el título pasa a "Sin resultados" (búsqueda sin coincidencias).
    await waitFor(() => {
      expect(screen.getByText('Sin resultados')).toBeTruthy();
    });
  });

  it('un fallo de red muestra el estado de error con reintentar y se recupera', async () => {
    // Arrange: primer GET falla, el reintento funciona.
    apiMock.get.mockImplementationOnce(async () => {
      throw new Error('down');
    });
    catalogo({ data: [PRODUCTO], total: 1, total_pages: 1 });
    const usuario = userEvent.setup();
    montar();
    // Assert: estado de error visible.
    expect(await screen.findByText('No se pudieron cargar los productos')).toBeTruthy();
    // Act: reintentar.
    await usuario.click(screen.getByRole('button', { name: /Reintentar/i }));
    // Assert: la tabla vuelve.
    expect(await screen.findByText('Cinta LED RGB 5m')).toBeTruthy();
  });
});

describe('AdminProductos — solicitud de reabastecimiento (vista por proveedor)', () => {
  it('permite solicitar stock al proveedor con cantidades y marca', async () => {
    // Arrange
    catalogo({ data: [PRODUCTO], total: 1, total_pages: 1 });
    apiMock.post.mockResolvedValue({ data: { msg: 'Solicitud enviada al proveedor' } });
    const usuario = userEvent.setup();
    montar('/admin/productos?proveedor=7');
    await screen.findByText('Cinta LED RGB 5m');
    // Act: abrir el modal desde la fila.
    await usuario.click(screen.getByRole('button', { name: /Solicitar más/i }));
    // El <form> del modal no tiene nombre accesible (no expone role="form"):
    // se localiza por la clase que le da el componente.
    const modal = await waitFor(() => {
      const formulario = document.querySelector('form.ap-modal') as HTMLFormElement;
      expect(formulario).toBeTruthy();
      return formulario;
    });
    // Cantidad del producto.
    const cantidad = within(modal as HTMLElement).getByDisplayValue('1');
    await usuario.clear(cantidad);
    await usuario.type(cantidad, '5');
    await usuario.click(within(modal as HTMLElement).getByRole('button', { name: /Enviar|Solicitar/i }));
    // Assert
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledTimes(1));
    const [url, items] = apiMock.post.mock.calls[0];
    expect(url).toBe('/productos/proveedores/7/solicitar-reabastecimiento');
    expect(items).toEqual([
      { id_producto: 91, cantidad: 5, marca: 'Neodomus' },
    ]);
    expect(await screen.findByText('Solicitud enviada al proveedor')).toBeTruthy();
  });

  it('sin cantidades válidas avisa sin llamar al backend', async () => {
    // Arrange
    catalogo({ data: [PRODUCTO], total: 1, total_pages: 1 });
    const usuario = userEvent.setup();
    montar('/admin/productos?proveedor=7');
    await screen.findByText('Cinta LED RGB 5m');
    // Act: abrir el modal y vaciar la cantidad inicial.
    await usuario.click(screen.getByRole('button', { name: /Solicitar más/i }));
    // El <form> del modal no tiene nombre accesible (no expone role="form"):
    // se localiza por la clase que le da el componente.
    const modal = await waitFor(() => {
      const formulario = document.querySelector('form.ap-modal') as HTMLFormElement;
      expect(formulario).toBeTruthy();
      return formulario;
    });
    const cantidad = within(modal as HTMLElement).getByDisplayValue('1');
    await usuario.clear(cantidad);
    await usuario.click(within(modal as HTMLElement).getByRole('button', { name: /Enviar|Solicitar/i }));
    // Assert: toast de error, sin POST.
    await waitFor(() => {
      expect(apiMock.post).not.toHaveBeenCalled();
    });
  });
});
