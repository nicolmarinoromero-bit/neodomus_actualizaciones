// Semana 7 del bootcamp — catálogo del cliente (ClientDashboard).
// Cubre carga, error, búsqueda, filtro por categoría, paginación, cantidades
// con tope de stock y agregado al carrito. Red y carrito simulados.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock, addItemMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn() },
  addItemMock: vi.fn(),
}));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@contexts/CartContext', () => ({
  useCart: () => ({ addItem: addItemMock }),
}));

import ClientDashboard from './ClientDashboard';

const CATEGORIAS = [
  { id_categoria: 1, nombre_categoria: 'Iluminación', descripcion: 'Luces' },
  { id_categoria: 2, nombre_categoria: 'Seguridad', descripcion: 'Cámaras' },
];

const producto = (id: number, overrides: Record<string, unknown> = {}) => ({
  id_producto: id,
  referencia_producto: `REF-${id}`,
  nombre_producto: `Producto ${id}`,
  precio_venta_producto: 1000 * id,
  imagen_url: null,
  id_cate_pr: 1,
  nombre_categoria: 'Iluminación',
  stock_producto: 10,
  ...overrides,
});

function red(productos: unknown[] = [producto(1)]) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/productos/categorias') return { data: CATEGORIAS };
    if (url === '/productos/?limit=100') return { data: { data: productos } };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

function montar() {
  const utils = render(
    <IdiomaProvider>
      <ClientDashboard />
    </IdiomaProvider>,
  );
  return utils;
}

const tarjetas = (container: HTMLElement) =>
  container.querySelectorAll('.card-producto').length;

describe('ClientDashboard', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    addItemMock.mockReset();
    window.scrollTo = vi.fn();
  });

  it('muestra el estado de carga mientras llegan los productos', () => {
    // Arrange
    apiMock.get.mockImplementation((url: string) =>
      url === '/productos/categorias'
        ? Promise.resolve({ data: CATEGORIAS })
        : new Promise(() => {}),
    );

    // Act
    montar();

    // Assert
    expect(screen.getByText('Cargando productos...')).toBeTruthy();
  });

  it('muestra el error de carga de productos', async () => {
    // Arrange
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/productos/categorias') return { data: CATEGORIAS };
      throw new Error('sin red');
    });

    // Act
    montar();

    // Assert
    expect(
      await screen.findByText('No se pudieron cargar los productos. Intenta más tarde.'),
    ).toBeTruthy();
  });

  it('lista productos, filtra por búsqueda y por categoría', async () => {
    // Arrange
    red([producto(1), producto(2, { nombre_producto: 'Cámara WiFi', id_cate_pr: 2, nombre_categoria: 'Seguridad' })]);
    const { container } = montar();
    await waitFor(() => expect(tarjetas(container)).toBe(2));

    // Act: búsqueda por nombre.
    const usuario = userEvent.setup();
    await usuario.type(screen.getByPlaceholderText('Buscar'), 'camara'.replace('a', 'á'));
    expect(tarjetas(container)).toBe(1);
    expect(screen.getByText('Cámara WiFi')).toBeTruthy();

    // Act: limpiar búsqueda y filtrar por categoría.
    await usuario.clear(screen.getByPlaceholderText('Buscar'));
    await usuario.selectOptions(screen.getAllByRole('combobox')[1], '2');

    // Assert
    expect(tarjetas(container)).toBe(1);
    expect(screen.queryByText('Producto 1')).toBeNull();
  });

  it('pagina de 8 en 8 y permite cambiar el tamaño de página', async () => {
    // Arrange: 10 productos → dos páginas.
    const productos = Array.from({ length: 10 }, (_, i) => producto(i + 1));
    red(productos);
    const { container } = montar();
    await waitFor(() => expect(tarjetas(container)).toBe(8));
    const usuario = userEvent.setup();

    // Act: ir a la página 2.
    await usuario.click(screen.getByRole('button', { name: '2' }));

    // Assert
    expect(tarjetas(container)).toBe(2);
    expect(screen.getByText('Producto 10')).toBeTruthy();
    expect(window.scrollTo).toHaveBeenCalled();

    // Act: cambiar a 16 por página.
    await usuario.selectOptions(screen.getAllByRole('combobox')[0], '16');
    expect(tarjetas(container)).toBe(10);
    expect(screen.queryByRole('button', { name: '2' })).toBeNull();
  });

  it('sin coincidencias muestra el estado vacío de búsqueda', async () => {
    // Arrange
    red([producto(1)]);
    montar();
    await screen.findByText('Producto 1');

    // Act
    await userEvent.setup().type(screen.getByPlaceholderText('Buscar'), 'zzz');

    // Assert
    expect(screen.getByText('Producto no encontrado')).toBeTruthy();
    expect(screen.getByText(/No encontramos ningún producto/i)).toBeTruthy();
  });

  it('agrega al carrito la cantidad elegida y avisa al usuario', async () => {
    // Arrange
    red([producto(1, { stock_producto: 5, precio_final: 900, descuento_activo: 10 })]);
    montar();
    await screen.findByText('Producto 1');
    const usuario = userEvent.setup();

    // Act: subir a 3 unidades y comprar.
    await usuario.click(screen.getByRole('button', { name: '+' }));
    await usuario.click(screen.getByRole('button', { name: '+' }));
    await usuario.click(screen.getByRole('button', { name: 'COMPRAR' }));

    // Assert
    expect(addItemMock).toHaveBeenCalledWith(
      {
        id_producto: 1,
        referencia_producto: 'REF-1',
        nombre_producto: 'Producto 1',
        precio_venta_producto: 900,
        imagen: expect.any(String),
      },
      3,
    );
    expect(screen.getByText('3 × Producto 1 agregado al carrito')).toBeTruthy();
  });

  it('respeta el stock en los controles de cantidad', async () => {
    // Arrange: una sola unidad disponible.
    red([producto(1, { stock_producto: 1 })]);
    montar();
    await screen.findByText('Producto 1');

    // Assert: el botón + ya está bloqueado.
    expect((screen.getByRole('button', { name: '+' }) as HTMLButtonElement).disabled).toBe(true);

    // Act: escribir 99 y salir del campo.
    const cantidad = screen.getByLabelText('Cantidad');
    fireEvent.change(cantidad, { target: { value: '99' } });
    fireEvent.blur(cantidad);
    await userEvent.setup().click(screen.getByRole('button', { name: 'COMPRAR' }));

    // Assert: se agregó solo 1.
    expect(addItemMock).toHaveBeenCalledWith(expect.objectContaining({ id_producto: 1 }), 1);
  });

  it('el foco de la ventana refresca el catálogo en silencio', async () => {
    // Arrange
    red([producto(1)]);
    montar();
    await screen.findByText('Producto 1');
    expect(apiMock.get).toHaveBeenCalledTimes(2);

    // Act
    fireEvent.focus(window);

    // Assert
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(3));
  });
});