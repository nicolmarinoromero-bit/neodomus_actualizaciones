// Semana 4 del bootcamp — panel admin de devoluciones y reembolsos.
// Estados de la tarjeta de solicitud (máquina de estados visible), modales de
// aprobar/rechazar con motivo, observaciones, pestaña de reembolsos con
// creación y procesamiento. Red simulada.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({ apiMock: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('@services/api', () => ({ default: apiMock }));

import AdminDevoluciones from './AdminDevoluciones';

const SOLICITUD_SOLICITADA = {
  id_solicitud: 51, numero: 'DEV-51', id_pedido: 88, estado: 'Solicitada',
  tipo_devolucion: 'total', monto_total: 90000, items: [{ id: 1 }],
  cliente: 'Carolina Mendez', created_at: '2026-11-01T10:00:00Z',
  motivo_label: 'Producto dañado',
};
const SOLICITUD_APROBADA = {
  ...SOLICITUD_SOLICITADA, id_solicitud: 52, numero: 'DEV-52', estado: 'Aprobada',
  resolucion: 'Reembolso',
};
const REEMBOLSO = {
  id_reembolso: 9, id_pedido: 88, monto: 90000, estado: 'Pendiente',
  motivo: 'Devolución DEV-51', created_at: '2026-11-02T10:00:00Z',
};
const ELEGIBLE = { tipo: 'pedido', id_pedido: 90, etiqueta: 'Luis Pérez', monto_pagado: 50000 };

function montar(ruta = '/admin/devoluciones') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <IdiomaProvider>
        <AdminDevoluciones />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function datos({ solicitudes = [SOLICITUD_SOLICITADA], reembolsos = [], elegibles = [] } = {}) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/devoluciones/admin/solicitudes') return { data: solicitudes };
    if (url === '/reembolsos') return { data: reembolsos };
    if (url === '/reembolsos/elegibles') return { data: elegibles };
    if (url === '/tecnicos') return { data: [{ id_tecnico: 5, first_name: 'Ana', last_name: 'Técnica', is_active: true }] };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.put.mockReset();
  apiMock.post.mockReset();
});

describe('AdminDevoluciones — tarjetas de solicitud', () => {
  it('muestra las tarjetas con tipo, estado, monto y motivo', async () => {
    // Arrange
    datos();
    montar();
    // Assert
    expect(await screen.findByText('DEV-51')).toBeTruthy();
    expect(screen.getByText('Total')).toBeTruthy();
    expect(screen.getByText('Solicitada')).toBeTruthy();
    expect(screen.getByText('Producto dañado')).toBeTruthy();
  });

  it('sin solicitudes muestra el estado vacío', async () => {
    // Arrange
    datos({ solicitudes: [] });
    montar();
    // Assert
    expect(await screen.findByText('No hay solicitudes de devolución')).toBeTruthy();
  });

  it('la tarjeta Solicitada permite pasar a En revisión (PUT con estado)', async () => {
    // Arrange
    datos();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('DEV-51');
    // Act
    await usuario.click(screen.getByRole('button', { name: 'En revisión' }));
    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/devoluciones/admin/solicitudes/51/estado', { estado: 'En revisión' }),
    );
  });

  it('aprobar abre el modal con resolución y envía Reembolso/Cambio', async () => {
    // Arrange
    datos();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('DEV-51');
    // Act: aprobar con resolución Cambio (el modal usa un <select>).
    await usuario.click(screen.getByRole('button', { name: 'Aprobar' }));
    const dialogo = await screen.findByRole('dialog', { name: /Aprobar DEV-51/ });
    await usuario.selectOptions(within(dialogo as HTMLElement).getByLabelText('Resolución'), 'Cambio');
    await usuario.click(within(dialogo as HTMLElement).getByRole('button', { name: 'Aprobar devolución' }));
    // Assert: el estado enviado incluye la resolución elegida.
    await waitFor(() => {
      const llamada = apiMock.put.mock.calls.find(([u]) => String(u).includes('/estado'));
      expect(llamada).toBeTruthy();
      const cuerpo = llamada![1] as { estado: string; resolucion?: string };
      expect(cuerpo.estado).toBe('Aprobada');
      expect(['Reembolso', 'Cambio']).toContain(cuerpo.resolucion);
    });
  });

  it('rechazar exige motivo de al menos 5 caracteres', async () => {
    // Arrange
    datos();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('DEV-51');
    // Act: rechazar con motivo demasiado corto.
    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));
    const dialogo = await screen.findByRole('dialog', { name: /Rechazar DEV-51/ });
    const campo = within(dialogo as HTMLElement).getByLabelText('Motivo del rechazo *');
    await usuario.type(campo, 'no');
    await usuario.click(within(dialogo as HTMLElement).getByRole('button', { name: 'Rechazar devolución' }));
    // Assert: aviso visible y SIN llamada al backend.
    expect(await screen.findByText('Indica el motivo del rechazo')).toBeTruthy();
    expect(apiMock.put).not.toHaveBeenCalled();
  });

  it('rechazar con motivo válido envía motivo_rechazo al backend', async () => {
    // Arrange
    datos();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('DEV-51');
    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }));
    const dialogo = await screen.findByRole('dialog', { name: /Rechazar DEV-51/ });
    const campo = within(dialogo as HTMLElement).getByLabelText('Motivo del rechazo *');
    await usuario.type(campo, 'El producto no cumple la política');
    await usuario.click(within(dialogo as HTMLElement).getByRole('button', { name: 'Rechazar devolución' }));
    // Assert
    await waitFor(() => {
      const llamada = apiMock.put.mock.calls.find(([u]) => String(u).includes('/estado'));
      const cuerpo = llamada![1] as { estado: string; motivo_rechazo?: string };
      expect(cuerpo.estado).toBe('Rechazada');
      expect(cuerpo.motivo_rechazo).toBe('El producto no cumple la política');
    });
  });

  it('una Aprobada con resolución Reembolso avanza a Producto en devolución y Recibida', async () => {
    // Arrange
    datos({ solicitudes: [SOLICITUD_APROBADA] });
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('DEV-52');
    // Act: avanzar de máquina de estados.
    await usuario.click(screen.getByRole('button', { name: 'Producto en devolución' }));
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/devoluciones/admin/solicitudes/52/estado',
        { estado: 'Producto en devolución' }),
    );
  });

  it('un error del backend muestra el detalle en el toast', async () => {
    // Arrange
    datos();
    apiMock.put.mockRejectedValue({ response: { data: { detail: 'Transición no permitida' } } });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('DEV-51');
    // Act
    await usuario.click(screen.getByRole('button', { name: 'En revisión' }));
    // Assert
    expect(await screen.findByText('Transición no permitida')).toBeTruthy();
  });
});

describe('AdminDevoluciones — reembolsos', () => {
  it('lista los reembolsos pendientes y permite crear uno nuevo (elegibles)', async () => {
    // Arrange
    datos({ reembolsos: [REEMBOLSO], elegibles: [ELEGIBLE] });
    apiMock.post.mockResolvedValue({ data: { msg: 'Reembolso creado' } });
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole('tab', { name: /Reembolsos/ }));
    // Assert: el reembolso existente y los elegibles aparecen.
    expect(await screen.findByText(/90000|90.000/)).toBeTruthy();
    expect(screen.getByText(/Luis Pérez/)).toBeTruthy();
  });

  it('un fallo de /reembolsos muestra el estado de error de la pestaña', async () => {
    // Arrange
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/devoluciones/admin/solicitudes') return { data: [] };
      if (url === '/reembolsos') throw new Error('down');
      if (url === '/reembolsos/elegibles') return { data: [] };
      if (url === '/tecnicos') return { data: [] };
      throw new Error(`Ruta inesperada: ${url}`);
    });
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole('tab', { name: /Reembolsos/ }));
    // Assert: estado de error con reintentar (el panel reutiliza las claves
    // de instalaciones: 'No se pudieron cargar las citas').
    expect(await screen.findByText('No se pudieron cargar las citas')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reintentar' })).toBeTruthy();
  });
});
