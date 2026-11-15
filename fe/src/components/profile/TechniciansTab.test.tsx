// Semana 8 del bootcamp — técnicos favoritos del perfil (TechniciansTab).
// Cubre carga, error, estado vacío, tarjetas con foto/iniciales, certificación,
// calificación, enlaces de contacto y retirada de favoritos persistida. Red
// simulada y autenticación de visitante.
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({ apiMock: { get: vi.fn() } }));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: false, user: null }),
}));

import TechniciansTab from './TechniciansTab';

const FAVORITOS_KEY = 'neodomus_tecnicos_favoritos_visitante';

const TECNICOS = [
  {
    id_tecnico: 1,
    first_name: 'Ana',
    last_name: 'Torres',
    certificacion_t: 'Certificación eléctrica',
    is_active: true,
    disponible: true,
    telefono: 3001234567,
    foto_url: '/assets/images/ana.png',
    calificacion: 4.5,
  },
  {
    id_tecnico: 2,
    first_name: 'Luis',
    last_name: 'Perez',
    certificacion_t: null,
    is_active: true,
    disponible: false,
    telefono: 3009999999,
    foto_url: null,
    calificacion: 4,
  },
  {
    id_tecnico: 3,
    first_name: 'Carlos',
    last_name: 'Mendez',
    certificacion_t: null,
    is_active: true,
    disponible: true,
    telefono: null,
    foto_url: null,
    calificacion: 0,
  },
];

function montar() {
  return render(
    <IdiomaProvider>
      <TechniciansTab />
    </IdiomaProvider>,
  );
}

describe('TechniciansTab', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMock.get.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('muestra el cargador mientras consulta los técnicos', () => {
    // Arrange
    apiMock.get.mockReturnValue(new Promise(() => {}));

    // Act
    montar();

    // Assert
    expect(screen.getByText('Cargando...')).toBeTruthy();
  });

  it('sin favoritos muestra el estado vacío con su ayuda', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: TECNICOS });

    // Act
    montar();

    // Assert
    expect(await screen.findByText('Aún no tienes técnicos favoritos.')).toBeTruthy();
    expect(screen.getByText(/Marca con .* a tus técnicos/i)).toBeTruthy();
    expect(screen.queryByText('Ana Torres')).toBeNull();
  });

  it('un fallo de red registra el error y deja el estado vacío', async () => {
    // Arrange
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiMock.get.mockRejectedValue(new Error('sin red'));

    // Act
    montar();

    // Assert
    expect(await screen.findByText('Aún no tienes técnicos favoritos.')).toBeTruthy();
    expect(error).toHaveBeenCalled();
  });

  it('lista solo los favoritos con certificación, calificación y contacto', async () => {
    // Arrange
    localStorage.setItem(FAVORITOS_KEY, JSON.stringify([1, 3]));
    apiMock.get.mockResolvedValue({ data: TECNICOS });

    // Act
    montar();
    await screen.findByText('Ana Torres');

    // Assert: favorito con foto y datos completos.
    expect(screen.getByText('Certificación eléctrica')).toBeTruthy();
    expect(screen.getByText(/4\.5/)).toBeTruthy();
    expect(screen.getByAltText('Ana Torres').getAttribute('src')).toBe('/assets/images/ana.png');
    const llamar = screen.getByRole('link', { name: /Llamar/i });
    expect(llamar.getAttribute('href')).toBe('tel:+573001234567');
    expect(screen.getByRole('link', { name: /Mensaje/i }).getAttribute('href')).toBe(
      'https://wa.me/573001234567',
    );

    // Assert: favorito sin foto usa iniciales y no inventa calificación.
    expect(screen.getByText('CM')).toBeTruthy();
    expect(screen.queryByText(/0\.0/)).toBeNull();

    // Assert: el no favorito no aparece.
    expect(screen.queryByText('Luis Perez')).toBeNull();
    expect(screen.getAllByRole('button', { name: /Quitar de favoritos/i })).toHaveLength(2);
  });

  it('retirar de favoritos actualiza la vista y el almacenamiento', async () => {
    // Arrange
    localStorage.setItem(FAVORITOS_KEY, JSON.stringify([1]));
    apiMock.get.mockResolvedValue({ data: TECNICOS });
    montar();
    await screen.findByText('Ana Torres');

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: /Quitar de favoritos/i }));

    // Assert
    expect(await screen.findByText('Aún no tienes técnicos favoritos.')).toBeTruthy();
    expect(JSON.parse(localStorage.getItem(FAVORITOS_KEY) || '[]')).toEqual([]);
  });

  it('una foto que falla cae a la imagen por defecto', async () => {
    // Arrange
    localStorage.setItem(FAVORITOS_KEY, JSON.stringify([1]));
    apiMock.get.mockResolvedValue({ data: [TECNICOS[0]] });
    montar();
    const foto = await screen.findByAltText('Ana Torres');

    // Act
    fireEvent.error(foto);

    // Assert
    expect((foto as HTMLImageElement).src.endsWith('/assets/images/perfil.png')).toBe(true);
  });

  it('un favorito inexistente en la respuesta no se renderiza', async () => {
    // Arrange: favorito 99 ya no está entre los técnicos públicos.
    localStorage.setItem(FAVORITOS_KEY, JSON.stringify([99]));
    apiMock.get.mockResolvedValue({ data: TECNICOS });

    // Act
    montar();

    // Assert
    await waitFor(() => expect(screen.getByText('Aún no tienes técnicos favoritos.')).toBeTruthy());
  });
});