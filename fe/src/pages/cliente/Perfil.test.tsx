import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, useLocation, useNavigate } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Perfil from './Perfil';
import api from '@services/api';

vi.mock('@contexts/AuthContext', () => ({
  useAuth: () => ({
    user: { id: 3, nombre: 'Cliente Prueba', correo: 'cliente@neodomus.test' },
    refreshUserProfile: vi.fn(),
  }),
}));

vi.mock('@i18n/IdiomaContext', () => ({
  useIdioma: () => ({ t: (clave: string) => clave }),
}));

vi.mock('@services/api', () => ({
  default: { get: vi.fn(), post: vi.fn(), put: vi.fn() },
}));

const { favoritosVacios, quitarFavoritoMock } = vi.hoisted(() => ({
  favoritosVacios: new Set<number>(),
  quitarFavoritoMock: vi.fn(),
}));

vi.mock('@utils/favoritos', () => ({
  useFavoritos: () => ({ favoritos: favoritosVacios, quitarFavorito: quitarFavoritoMock }),
}));

vi.mock('@components/profile/SectionHeader', () => ({ default: () => null }));
vi.mock('@components/profile/PerfilCuenta', () => ({ default: () => null }));
vi.mock('@components/profile/ReembolsosCliente', () => ({ default: () => null }));
vi.mock('@components/profile/OrdersTab', () => ({ default: () => null }));
vi.mock('@components/profile/ServiciosTab', () => ({ default: () => null }));
vi.mock('@components/profile/ReviewsTab', () => ({ default: () => null }));
vi.mock('@components/profile/TechniciansTab', () => ({ default: () => null }));
vi.mock('@components/profile/FacturasTab', () => ({ default: () => null }));
vi.mock('@components/profile/LanguageTab', () => ({ default: () => null }));
vi.mock('@components/profile/NotificationsTab', () => ({ default: () => null }));
vi.mock('@components/profile/PasswordTab', () => ({ default: () => null }));

function NavegacionPrueba() {
  const navigate = useNavigate();
  return (
    <>
      <button type="button" onClick={() => navigate('/perfil?tab=reembolsos')}>
        ir a reembolsos
      </button>
      <button type="button" onClick={() => navigate('/perfil')}>
        ir a perfil
      </button>
    </>
  );
}

function RutaActual() {
  const { pathname } = useLocation();
  return <span data-testid="ruta-actual">{pathname}</span>;
}

const botonActivo = (texto: string) =>
  screen.getByText(texto, { selector: '.pf-nav-label' }).closest('button');

afterEach(cleanup);

describe('sección activa del perfil según la URL', () => {
  beforeEach(() => {
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/clients/me') {
        return {
          data: {
            first_name: 'Cliente',
            last_name: 'Prueba',
            email: 'cliente@neodomus.test',
          },
        } as never;
      }
      if (url === '/clients/me/cuenta-solicitud') {
        return { data: { estado: 'sin_solicitud' } } as never;
      }
      return { data: [] } as never;
    });
  });

  it('abre la pestaña de la notificación aunque el perfil ya esté montado', async () => {
    render(
      <MemoryRouter initialEntries={['/perfil?tab=pedidos']}>
        <Perfil />
        <NavegacionPrueba />
      </MemoryRouter>,
    );

    expect(botonActivo('perfil.misPedidos')?.className).toContain('active');

    fireEvent.click(screen.getByRole('button', { name: 'ir a reembolsos' }));

    await waitFor(() => {
      expect(botonActivo('perfil.misReembolsos')?.className).toContain('active');
    });
    expect(botonActivo('perfil.misPedidos')?.className).not.toContain('active');

    fireEvent.click(screen.getByRole('button', { name: 'ir a perfil' }));

    await waitFor(() => {
      expect(botonActivo('perfil.miPerfil')?.className).toContain('active');
    });
  });
});

describe('favoritos — botón «Ver producto»', () => {
  beforeEach(() => {
    favoritosVacios.clear();
    favoritosVacios.add(5);
    favoritosVacios.add(8);
    vi.mocked(api.get).mockImplementation(async (url: string) => {
      if (url === '/clients/me') {
        return {
          data: { first_name: 'Cliente', last_name: 'Prueba', email: 'cliente@neodomus.test' },
        } as never;
      }
      if (url === '/clients/me/cuenta-solicitud') {
        return { data: { estado: 'sin_solicitud' } } as never;
      }
      if (url.startsWith('/productos')) {
        return {
          data: {
            data: [
              {
                id_producto: 5,
                nombre_producto: 'Cable UTP Cat6',
                referencia_producto: 'REF-CABLE-UTP',
                precio_venta_producto: 3500,
                nombre_categoria: 'Cables y conectividad',
              },
              {
                id_producto: 8,
                nombre_producto: 'Fuente de poder 12v 5a',
                referencia_producto: 'REF-FUENTE-12V',
                precio_venta_producto: 58000,
                nombre_categoria: 'Energía',
              },
            ],
          },
        } as never;
      }
      return { data: [] } as never;
    });
  });

  afterEach(() => {
    favoritosVacios.clear();
  });

  it('cada tarjeta abre su propio detalle, como en el catálogo (/producto/:id)', async () => {
    render(
      <MemoryRouter initialEntries={['/perfil?tab=favoritos']}>
        <Perfil />
        <RutaActual />
      </MemoryRouter>,
    );

    const botones = await screen.findAllByText('perfil.verProducto');
    expect(botones).toHaveLength(2);

    // Tarjeta 1 → detalle del producto 1; tarjeta 2 → detalle del producto 2.
    fireEvent.click(botones[0]);
    expect(screen.getByTestId('ruta-actual').textContent).toBe('/producto/5');

    fireEvent.click(botones[1]);
    expect(screen.getByTestId('ruta-actual').textContent).toBe('/producto/8');
  });
});
