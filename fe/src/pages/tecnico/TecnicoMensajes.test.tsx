// Semana 7 del bootcamp — mensajes del técnico (TecnicoMensajes).
// Cubre carga, siembra de conversaciones desde los clientes asignados, no
// leídos, apertura de conversación y persistencia en localStorage. Red y
// almacenamiento de pestaña simulados.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock, tabGetMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn() },
  tabGetMock: vi.fn(),
}));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@utils/tabStorage', () => ({ tabGet: tabGetMock }));

import TecnicoMensajes from './TecnicoMensajes';

const CLIENTES = [
  { id_cliente: 1, nombre: 'Ana Torres', email: 'ana@neodomus.com' },
  { id_cliente: 2, nombre: 'Luis Perez', email: 'luis@neodomus.com' },
];

function montar() {
  return render(
    <IdiomaProvider>
      <TecnicoMensajes />
    </IdiomaProvider>,
  );
}

describe('TecnicoMensajes', () => {
  beforeEach(() => {
    localStorage.clear();
    apiMock.get.mockReset();
    tabGetMock.mockReset();
    tabGetMock.mockReturnValue(JSON.stringify({ nombre: 'Carlos Técnico' }));
  });

  it('muestra el cargador mientras consulta los clientes', () => {
    // Arrange
    apiMock.get.mockReturnValue(new Promise(() => {}));

    // Act
    montar();

    // Assert
    expect(screen.getByText('Cargando tus datos...')).toBeTruthy();
  });

  it('sin clientes muestra el estado vacío', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: [] });

    // Act
    montar();

    // Assert
    expect(await screen.findByText('Aún no tienes mensajes.')).toBeTruthy();
    expect(screen.getByText('Los mensajes de tus clientes aparecerán aquí.')).toBeTruthy();
    expect(localStorage.getItem('tecMensajes')).toBe('[]');
  });

  it('siembra una conversación por cliente con mensajes del técnico', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: CLIENTES });

    // Act
    montar();

    // Assert: se listan ambas conversaciones y la primera queda abierta.
    expect((await screen.findAllByText('Ana Torres')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Luis Perez').length).toBeGreaterThan(0);
    expect(screen.getAllByText(/soy Carlos Técnico/i).length).toBeGreaterThan(0);
    expect(document.body.textContent).toContain('Técnico ·');
    expect(document.body.textContent).toContain('Cliente ·');
    const guardadas = JSON.parse(localStorage.getItem('tecMensajes') || '[]');
    expect(guardadas).toHaveLength(2);
    expect(guardadas[0]).toMatchObject({ id: 1, cliente: 'Ana Torres', leido: false });
    expect(guardadas[1]).toMatchObject({ id: 2, cliente: 'Luis Perez', leido: true });
    expect(apiMock.get).toHaveBeenCalledWith('/tecnicos/mis-clientes');
  });

  it('muestra el contador de no leídos y marca la conversación al abrirla', async () => {
    // Arrange
    apiMock.get.mockResolvedValue({ data: CLIENTES });
    montar();
    await screen.findAllByText('Ana Torres');
    expect(screen.getAllByText('Nuevo').length).toBeGreaterThan(0);

    // Act: abrir la conversación pendiente.
    await userEvent.setup().click(screen.getAllByRole('button', { name: /Ana Torres/i })[0]);

    // Assert: la vista cambia y el contador desaparece.
    await waitFor(() =>
      expect(JSON.parse(localStorage.getItem('tecMensajes') || '[]')[0].leido).toBe(true),
    );
    await waitFor(() =>
      expect(document.querySelectorAll('.ap-badge.warn')).toHaveLength(0),
    );
    expect(screen.queryByText('Nuevo')).toBeNull();
    expect(screen.getAllByText('ana@neodomus.com').length).toBeGreaterThan(0);
  });

  it('reutiliza conversaciones previas del almacenamiento', async () => {
    // Arrange: una conversación vieja que no debe re-sembrarse.
    localStorage.setItem(
      'tecMensajes',
      JSON.stringify([
        {
          id: 9,
          cliente: 'Cliente Previo',
          email: 'previo@neodomus.com',
          leido: true,
          mensajes: [{ de: 'cliente', texto: 'Mensaje guardado', hora: '09:00' }],
        },
      ]),
    );
    apiMock.get.mockResolvedValue({ data: CLIENTES });

    // Act
    montar();

    // Assert
    expect((await screen.findAllByText('Cliente Previo')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Mensaje guardado').length).toBeGreaterThan(0);
    expect(screen.queryByText('Ana Torres')).toBeNull();
  });

  it('un fallo de red termina la carga y deja el estado vacío', async () => {
    // Arrange
    const error = vi.spyOn(console, 'error').mockImplementation(() => {});
    apiMock.get.mockRejectedValue(new Error('sin red'));

    // Act
    montar();

    // Assert
    expect(await screen.findByText('Aún no tienes mensajes.')).toBeTruthy();
    expect(error).toHaveBeenCalled();
    error.mockRestore();
  });

  it('un usuario de pestaña corrupto cae al nombre genérico', async () => {
    // Arrange
    tabGetMock.mockReturnValue('{no-json');
    apiMock.get.mockResolvedValue({ data: [CLIENTES[0]] });

    // Act
    montar();

    // Assert
    expect((await screen.findAllByText(/soy Técnico/i)).length).toBeGreaterThan(0);
  });
});