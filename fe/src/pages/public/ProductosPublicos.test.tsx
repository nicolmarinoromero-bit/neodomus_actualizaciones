// Semana 8 del bootcamp — catálogo público (ProductosPublicos).
// Cubre carga, error, filtros, paginación, cambio de tamaño, refresco por foco
// y estado vacío. Tarjetas y red simuladas.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@components/productos/ProductoCard', () => ({
  default: ({ producto }: { producto: { id_producto: number; nombre_producto: string } }) => (
    <div data-testid="producto">{`${producto.id_producto}:${producto.nombre_producto}`}</div>
  ),
}));

import ProductosPublicos from './ProductosPublicos';

const CATEGORIAS = [
  { id_categoria: 1, nombre_categoria: 'Iluminación', descripcion: 'Luces' },
  { id_categoria: 2, nombre_categoria: 'Seguridad', descripcion: 'Cámaras' },
];

const producto = (id: number, overrides: Record<string, unknown> = {}) => ({
  id_producto: id,
  nombre_producto: `Producto ${id}`,
  precio_venta_producto: 1000 * id,
  id_cate_pr: 1,
  ...overrides,
});

function red(productos: unknown[] = [producto(1)], categorias: unknown[] = CATEGORIAS) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/productos/categorias') return { data: categorias };
    if (url === '/productos/?limit=100') return { data: { data: productos } };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

function montar() {
  return render(
    <IdiomaProvider>
      <ProductosPublicos />
    </IdiomaProvider>,
  );
}

const tarjetas = () => screen.queryAllByTestId('producto');

describe('ProductosPublicos', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    window.scrollTo = vi.fn();
  });

  it('muestra el cargador mientras llegan los productos', () => {
    // Arrange
    apiMock.get.mockImplementation((url: string) =>
      url === '/productos/categorias'
        ? Promise.resolve({ data: CATEGORIAS })
        : new Promise(() => {}),
    );

    // Act
    montar();

    // Assert
    expect(screen.getByText('Cargando...')).toBeTruthy();
  });

  it('muestra el error de carga de productos', async () => {
    // Arrange
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/productos/categorias') return { data: CATEGORIAS };
      throw { response: { data: { detail: 'Catálogo caído' } } };
    });

    // Act
    montar();

    // Assert
    expect(await screen.findByText('Catálogo caído')).toBeTruthy();
  });

  it('lista los primeros 8 productos y pagina', async () => {
    // Arrange: 10 productos.
    red(Array.from({ length: 10 }, (_, i) => producto(i + 1)));
    montar();

    // Assert
    await waitFor(() => expect(tarjetas()).toHaveLength(8));
    expect(screen.getByText('1:Producto 1')).toBeTruthy();
    expect(screen.queryByText('9:Producto 9')).toBeNull();

    // Act: ir a la página 2.
    await userEvent.setup().click(screen.getByRole('button', { name: '2' }));

    // Assert
    expect(tarjetas()).toHaveLength(2);
    expect(screen.getByText('9:Producto 9')).toBeTruthy();
    expect(window.scrollTo).toHaveBeenCalled();
  });

  it('cambia el tamaño de página y reinicia la paginación', async () => {
    // Arrange
    red(Array.from({ length: 10 }, (_, i) => producto(i + 1)));
    montar();
    await waitFor(() => expect(tarjetas()).toHaveLength(8));
    const usuario = userEvent.setup();

    // Act
    await usuario.selectOptions(screen.getAllByRole('combobox')[0], '16');

    // Assert
    expect(tarjetas()).toHaveLength(10);
    expect(screen.queryByRole('button', { name: '2' })).toBeNull();
  });

  it('filtra por búsqueda, por categoría y limpia la búsqueda', async () => {
    // Arrange
    red([
      producto(1),
      producto(2, { nombre_producto: 'Cámara WiFi', id_cate_pr: 2 }),
    ]);
    montar();
    await waitFor(() => expect(tarjetas()).toHaveLength(2));
    const usuario = userEvent.setup();
    const buscador = screen.getByRole('textbox') as HTMLInputElement;

    // Act: búsqueda por nombre.
    await usuario.type(buscador, 'cámara');

    // Assert
    expect(tarjetas()).toHaveLength(1);
    expect(screen.getByText('2:Cámara WiFi')).toBeTruthy();

    // Act: limpiar y filtrar por categoría.
    await usuario.clear(buscador);
    await usuario.selectOptions(screen.getAllByRole('combobox')[1], '2');

    // Assert
    expect(tarjetas()).toHaveLength(1);
    expect(screen.queryByText('1:Producto 1')).toBeNull();

    // Act: búsqueda sin resultados y acción de limpiar.
    await usuario.type(buscador, 'zzz');
    await usuario.click(screen.getByRole('button', { name: /Limpiar búsqueda/i }));

    // Assert
    expect((buscador as HTMLInputElement).value).toBe('');
    expect(tarjetas()).toHaveLength(1);
  });

  it('sin productos muestra el estado vacío del catálogo', async () => {
    // Arrange
    red([], CATEGORIAS);

    // Act
    montar();

    // Assert
    await waitFor(() => expect(tarjetas()).toHaveLength(0));
    expect(screen.getByText('Sin productos disponibles')).toBeTruthy();
    expect(screen.getByText('Ahora mismo no hay productos disponibles.')).toBeTruthy();
  });

  it('el foco de la ventana refresca el catálogo en silencio', async () => {
    // Arrange
    red([producto(1)]);
    montar();
    await waitFor(() => expect(tarjetas()).toHaveLength(1));
    expect(apiMock.get).toHaveBeenCalledTimes(2);

    // Act
    fireEvent.focus(window);

    // Assert
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(3));
  });

  it('un fallo de categorías no impide mostrar el catálogo', async () => {
    // Arrange
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/productos/categorias') throw new Error('sin categorías');
      return { data: { data: [producto(1)] } };
    });

    // Act
    montar();

    // Assert
    await waitFor(() => expect(tarjetas()).toHaveLength(1));
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });
});