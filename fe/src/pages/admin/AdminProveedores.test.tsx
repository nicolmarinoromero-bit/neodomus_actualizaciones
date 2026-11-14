// Semana 7 del bootcamp — proveedores del administrador (AdminProveedores).
// Cubre carga, error, resumen de productos/stock, búsqueda, alta, edición,
// validación y errores del backend. Red simulada y almacenamiento limpio.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));
vi.mock('@services/api', () => ({ default: apiMock }));

import AdminProveedores from './AdminProveedores';

const PROVEEDORES = [
  {
    id_proveedor: 1,
    nombre_proveedor: 'Sensores Inteligentes',
    contacto_proveedor: 'Ana Torres',
    telefono_proveedor: '3001234567',
    correo_proveedor: 'ana@sensores.com',
    direccion_proveedor: 'Calle 1 #2-3',
  },
  {
    id_proveedor: 2,
    nombre_proveedor: 'Hogar Total',
    contacto_proveedor: null,
    telefono_proveedor: null,
    correo_proveedor: null,
    direccion_proveedor: null,
  },
];

const PRODUCTOS = [
  { id_producto: 1, nombre_producto: 'Sensor', stock_producto: 5, id_proveedor_pr: 1 },
  { id_producto: 2, nombre_producto: 'Cámara', stock_producto: 3, id_proveedor_pr: 1 },
  { id_producto: 3, nombre_producto: 'Bombillo', stock_producto: 7, id_proveedor_pr: 2 },
];

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <AdminProveedores />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function red(proveedores: unknown[] = PROVEEDORES, productos: unknown[] = PRODUCTOS) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/productos/proveedores') return { data: proveedores };
    if (url === '/productos/?limit=100') return { data: { total: productos.length, data: productos } };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

async function abrirNuevo() {
  await userEvent.setup().click(screen.getByRole('button', { name: /Nuevo proveedor/i }));
  return screen.getByRole('heading', { name: /Nuevo proveedor/i }).closest('form') as HTMLElement;
}

describe('AdminProveedores', () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.put.mockReset();
  });

  it('muestra el cargador mientras consulta proveedores', () => {
    // Arrange
    apiMock.get.mockReturnValue(new Promise(() => {}));

    // Act
    montar();

    // Assert
    expect(screen.getByText('Cargando proveedores')).toBeTruthy();
    expect(screen.getByText('Consultando proveedores y productos...')).toBeTruthy();
  });

  it('un fallo de carga muestra el error y permite reintentar', async () => {
    // Arrange
    apiMock.get.mockRejectedValueOnce(new Error('sin red')).mockResolvedValue({ data: [] });

    // Act
    montar();

    // Assert
    expect(await screen.findByText('No se pudieron cargar los proveedores')).toBeTruthy();
    const reintentar = screen.getByRole('button', { name: 'Reintentar' });

    // Act: reintento exitoso.
    await userEvent.setup().click(reintentar);

    // Assert
    expect(await screen.findByText('No hay proveedores registrados')).toBeTruthy();
  });

  it('sin proveedores muestra el estado vacío', async () => {
    // Arrange
    red([], []);

    // Act
    montar();

    // Assert
    expect(await screen.findByText('No hay proveedores registrados')).toBeTruthy();
    expect(
      screen.getByText('Agrega tu primer proveedor para asociar productos a sus marcas.'),
    ).toBeTruthy();
  });

  it('lista proveedores con contacto, productos y stock agregado', async () => {
    // Arrange
    red();

    // Act
    montar();

    // Assert
    expect(await screen.findByText('Sensores Inteligentes')).toBeTruthy();
    expect(screen.getByText('Hogar Total')).toBeTruthy();
    expect(screen.getByText('Ana Torres')).toBeTruthy();
    expect(screen.getByText('ana@sensores.com')).toBeTruthy();
    expect(screen.getByText('2 productos')).toBeTruthy();
    expect(screen.getByText('8 u.')).toBeTruthy();
    expect(screen.getByText('1 producto')).toBeTruthy();
    expect(screen.getByText('7 u.')).toBeTruthy();
  });

  it('la búsqueda filtra y muestra el estado sin coincidencias', async () => {
    // Arrange
    red();
    montar();
    await screen.findByText('Sensores Inteligentes');
    const usuario = userEvent.setup();
    const buscador = screen.getByPlaceholderText(/Buscar por nombre/i);

    // Act: coincidencia por correo.
    await usuario.type(buscador, 'ana@sensores');

    // Assert
    expect(screen.getByText('Sensores Inteligentes')).toBeTruthy();
    expect(screen.queryByText('Hogar Total')).toBeNull();

    // Act: sin coincidencias.
    await usuario.clear(buscador);
    await usuario.type(buscador, 'zzz');

    // Assert
    expect(screen.getByText('Ningún proveedor coincide con la búsqueda')).toBeTruthy();
  });

  it('exige el nombre antes de crear un proveedor', async () => {
    // Arrange
    red([], []);
    montar();
    await screen.findByText('No hay proveedores registrados');
    const modal = await abrirNuevo();

    // Act
    await userEvent.setup().click(within(modal).getByRole('button', { name: /Agregar proveedor/i }));

    // Assert
    expect(screen.getByText('El nombre del proveedor es obligatorio')).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('crea un proveedor, limpia el formulario y recarga la lista', async () => {
    // Arrange: la primera carga está vacía; tras crear, el backend devuelve uno.
    const nuevo = {
      id_proveedor: 5,
      nombre_proveedor: 'Domótica Andina',
      contacto_proveedor: null,
      telefono_proveedor: '3100000000',
      correo_proveedor: 'ventas@andina.com',
      direccion_proveedor: null,
    };
    let proveedores: unknown[] = [];
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/productos/proveedores') return { data: proveedores };
      return { data: { total: 0, data: [] } };
    });
    apiMock.post.mockImplementation(async () => {
      proveedores = [nuevo];
      return { data: nuevo };
    });
    montar();
    await screen.findByText('No hay proveedores registrados');
    const modal = await abrirNuevo();
    const usuario = userEvent.setup();

    // Act
    await usuario.type(within(modal).getByLabelText('Nombre *'), 'Domótica Andina');
    await usuario.type(within(modal).getByLabelText('Teléfono'), '3100000000');
    await usuario.type(within(modal).getByLabelText('Correo'), 'ventas@andina.com');
    await usuario.click(within(modal).getByRole('button', { name: /Agregar proveedor/i }));

    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/productos/proveedores', {
        nombre_proveedor: 'Domótica Andina',
        contacto_proveedor: null,
        telefono_proveedor: '3100000000',
        correo_proveedor: 'ventas@andina.com',
        direccion_proveedor: null,
      }),
    );
    expect(await screen.findByText('Proveedor agregado correctamente')).toBeTruthy();
    expect(await screen.findByText('Domótica Andina')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: /Nuevo proveedor/i })).toBeNull();
  });

  it('edita un proveedor con el formulario precargado', async () => {
    // Arrange
    red();
    apiMock.put.mockResolvedValue({ data: {} });
    montar();
    await screen.findByText('Sensores Inteligentes');
    await userEvent.setup().click(screen.getAllByRole('button', { name: /Editar/i })[0]);
    const modal = screen.getByRole('heading', { name: /Editar proveedor/i }).closest('form') as HTMLElement;
    const nombre = within(modal).getByLabelText('Nombre *') as HTMLInputElement;
    expect(nombre.value).toBe('Sensores Inteligentes');

    // Act
    await userEvent.setup().clear(nombre);
    await userEvent.setup().type(nombre, 'Sensores Andinos');
    await userEvent.setup().click(within(modal).getByRole('button', { name: /Guardar cambios/i }));

    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith(
        '/productos/proveedores/1',
        expect.objectContaining({ nombre_proveedor: 'Sensores Andinos' }),
      ),
    );
    expect(await screen.findByText('Proveedor actualizado correctamente')).toBeTruthy();
  });

  it('muestra el detalle del backend si el guardado falla', async () => {
    // Arrange
    red(PROVEEDORES, []);
    apiMock.put.mockRejectedValue({ response: { data: { detail: 'Nombre duplicado' } } });
    montar();
    await screen.findByText('Sensores Inteligentes');
    await userEvent.setup().click(screen.getAllByRole('button', { name: /Editar/i })[0]);
    const modal = screen.getByRole('heading', { name: /Editar proveedor/i }).closest('form') as HTMLElement;

    // Act
    await userEvent.setup().click(within(modal).getByRole('button', { name: /Guardar cambios/i }));

    // Assert
    expect(await screen.findByText('Nombre duplicado')).toBeTruthy();
    expect(screen.getByRole('heading', { name: /Editar proveedor/i })).toBeTruthy();
  });

  it('cancela el formulario sin enviar datos', async () => {
    // Arrange
    red(PROVEEDORES, []);
    montar();
    await screen.findByText('Sensores Inteligentes');
    const modal = await abrirNuevo();

    // Act
    await userEvent.setup().type(within(modal).getByLabelText('Nombre *'), 'Temporal');
    await userEvent.setup().click(within(modal).getByRole('button', { name: /Cancelar/i }));

    // Assert
    expect(screen.queryByRole('heading', { name: /Nuevo proveedor/i })).toBeNull();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('pagina los proveedores de 10 en 10', async () => {
    // Arrange: 12 proveedores.
    const muchos = Array.from({ length: 12 }, (_, i) => ({
      id_proveedor: i + 1,
      nombre_proveedor: `Proveedor ${i + 1}`,
      contacto_proveedor: null,
      telefono_proveedor: null,
      correo_proveedor: null,
      direccion_proveedor: null,
    }));
    red(muchos, []);
    montar();
    await screen.findByText('Proveedor 1');
    expect(screen.queryByText('Proveedor 11')).toBeNull();

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /Ir a la página 2/i }));

    // Assert
    expect(screen.getByText('Proveedor 11')).toBeTruthy();
    expect(screen.getByText('Proveedor 12')).toBeTruthy();
    expect(screen.queryByText('Proveedor 1')).toBeNull();
  });
});