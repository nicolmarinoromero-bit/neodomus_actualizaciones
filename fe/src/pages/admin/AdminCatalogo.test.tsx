// Semana 7 del bootcamp — catálogo del administrador (AdminCatalogo).
// Cubre carga, error, tabla, búsqueda, vista por categorías, paginación,
// visibilidad de productos y estados vacíos. Red simulada.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), put: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));

import AdminCatalogo from './AdminCatalogo';

const CATEGORIAS = [
  { id_categoria: 1, nombre_categoria: 'Iluminación', descripcion: 'Luces inteligentes' },
  { id_categoria: 2, nombre_categoria: 'Seguridad', descripcion: '' },
];

const producto = (id: number, overrides: Record<string, unknown> = {}) => ({
  id_producto: id,
  referencia_producto: `REF-${id}`,
  nombre_producto: `Producto ${id}`,
  marca: 'Neodomus',
  precio_venta_producto: 1000 * id,
  stock_producto: 10,
  id_cate_pr: 1,
  nombre_categoria: 'Iluminación',
  visible_cliente: true,
  ...overrides,
});

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <AdminCatalogo />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function red(productos: unknown[] = [producto(1)], categorias: unknown[] = CATEGORIAS) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/productos/categorias') return { data: categorias };
    if (url === '/productos/?limit=100') return { data: { total: productos.length, data: productos } };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

describe('AdminCatalogo', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.put.mockReset();
  });

  it('muestra el cargador mientras consulta categorías y productos', () => {
    // Arrange
    apiMock.get.mockReturnValue(new Promise(() => {}));

    // Act
    montar();

    // Assert
    expect(screen.getByText('Cargando catálogo')).toBeTruthy();
    expect(screen.getByText('Consultando categorías y productos...')).toBeTruthy();
  });

  it('un fallo de carga muestra el estado de error y permite reintentar', async () => {
    // Arrange
    apiMock.get.mockRejectedValue(new Error('sin red'));

    // Act
    montar();
    const reintentar = await screen.findByRole('button', { name: 'Reintentar' });

    // Assert: recargar la página es la acción disponible.
    expect(screen.getByText('No se pudo cargar el catálogo')).toBeTruthy();
    expect(reintentar).toBeTruthy();
  });

  it('lista los productos con categoría, stock y precio formateado', async () => {
    // Arrange
    red([producto(1), producto(2, { nombre_categoria: null, visible_cliente: false })]);

    // Act
    montar();

    // Assert
    expect(await screen.findByText('Producto 1')).toBeTruthy();
    expect(screen.getByText('Producto 2')).toBeTruthy();
    expect(screen.getByText(/ID 1/)).toBeTruthy();
    expect(screen.getByText('$1.000')).toBeTruthy();
    expect(screen.getByText('Sin categoría')).toBeTruthy();
    expect(screen.getAllByText('Visible').length).toBeGreaterThan(0);
    expect(screen.getByText('Oculto')).toBeTruthy();
    expect(screen.getByText('2 categorías')).toBeTruthy();
  });

  it('sin productos muestra el estado vacío con acceso a crear', async () => {
    // Arrange
    red([], []);

    // Act
    montar();

    // Assert
    expect(await screen.findByText('No hay productos registrados')).toBeTruthy();
    expect(screen.getByRole('link', { name: /Crear el primer producto/i })).toBeTruthy();
  });

  it('la búsqueda filtra por nombre y muestra el estado sin resultados', async () => {
    // Arrange
    red([producto(1), producto(2, { nombre_producto: 'Cámara WiFi' })]);
    montar();
    await screen.findByText('Producto 1');
    const usuario = userEvent.setup();

    // Act: una coincidencia.
    await usuario.type(screen.getByPlaceholderText('Buscar producto...'), 'wifi');

    // Assert
    expect(screen.getByText('Cámara WiFi')).toBeTruthy();
    expect(screen.queryByText('Producto 1')).toBeNull();

    // Act: sin coincidencias.
    await usuario.clear(screen.getByPlaceholderText('Buscar producto...'));
    await usuario.type(screen.getByPlaceholderText('Buscar producto...'), 'zzz');

    // Assert
    expect(screen.getByText('Sin resultados')).toBeTruthy();
    expect(screen.getByText('No hay productos que coincidan con la búsqueda.')).toBeTruthy();
  });

  it('pagina de 10 en 10 y permite ir a la página siguiente', async () => {
    // Arrange: 12 productos → dos páginas.
    const productos = Array.from({ length: 12 }, (_, i) => producto(i + 1));
    red(productos);
    montar();
    await screen.findByText('Producto 1');
    expect(screen.queryByText('Producto 11')).toBeNull();

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: '2' }));

    // Assert
    expect(screen.getByText('Producto 11')).toBeTruthy();
    expect(screen.getByText('Producto 12')).toBeTruthy();
    expect(screen.queryByText('Producto 1')).toBeNull();
  });

  it('la vista por categorías muestra el conteo y el enlace a sus productos', async () => {
    // Arrange
    red([producto(1), producto(2)], CATEGORIAS);
    montar();
    await screen.findByText('Producto 1');

    // Act
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'categorias');

    // Assert
    expect(screen.getByText('Iluminación')).toBeTruthy();
    expect(screen.getByText('Luces inteligentes')).toBeTruthy();
    expect(screen.getByText('Sin descripción disponible.')).toBeTruthy();
    expect(screen.getByText('2 productos')).toBeTruthy();
    expect(screen.getAllByRole('link', { name: /Ver productos/i }).length).toBe(2);
  });

  it('sin categorías la vista por categorías muestra su estado vacío', async () => {
    // Arrange
    red([producto(1)], []);
    montar();
    await screen.findByText('Producto 1');

    // Act
    await userEvent.setup().selectOptions(screen.getByRole('combobox'), 'categorias');

    // Assert
    expect(screen.getByText('No hay categorías registradas')).toBeTruthy();
  });

  it('oculta un producto y confirma con el mensaje del backend', async () => {
    // Arrange
    red([producto(1, { visible_cliente: true })]);
    apiMock.put.mockResolvedValue({ data: { visible_cliente: false, mensaje: 'Producto oculto' } });
    montar();
    await screen.findByText('Producto 1');
    const casilla = screen.getByRole('checkbox') as HTMLInputElement;
    expect(casilla.checked).toBe(true);

    // Act
    fireEvent.click(casilla);

    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/productos/1/visibilidad'),
    );
    expect(await screen.findByText('Producto oculto')).toBeTruthy();
  });

  it('revierte la visibilidad y muestra el detalle si el backend falla', async () => {
    // Arrange
    red([producto(1, { visible_cliente: true })]);
    apiMock.put.mockRejectedValue({ response: { data: { detail: 'Producto bloqueado' } } });
    montar();
    await screen.findByText('Producto 1');

    // Act
    fireEvent.click(screen.getByRole('checkbox'));

    // Assert
    expect(await screen.findByText('Producto bloqueado')).toBeTruthy();
    await waitFor(() => expect((screen.getByRole('checkbox') as HTMLInputElement).checked).toBe(true));
  });
});