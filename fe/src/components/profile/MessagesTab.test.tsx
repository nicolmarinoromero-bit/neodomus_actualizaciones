// Semana 8 del bootcamp — mensajes del perfil (MessagesTab).
// Cubre listado, contador de no leídos, filtro, detalle, marcado individual,
// marcado masivo, persistencia y estados vacíos. Almacenamiento limpio.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';
import { PF_MENSAJES_KEY } from '@utils/profileStorage';

import MessagesTab from './MessagesTab';

const MENSAJES = [
  {
    id: 'msg-1',
    de: 'Neodomus',
    tipo: 'pedido' as const,
    asunto: 'Tu pedido está en camino',
    preview: 'El pedido salió del almacén...',
    fecha: 'Hace 2 horas',
    leido: false,
    cuerpo: 'Tu pedido FAC-2026-0001 ya fue despachado y está en camino.',
  },
  {
    id: 'msg-2',
    de: 'Soporte Neodomus',
    tipo: 'cuenta' as const,
    asunto: 'Tu contraseña fue actualizada',
    preview: 'Si no fuiste tú, contáctanos...',
    fecha: 'Ayer',
    leido: true,
    cuerpo: 'La contraseña de tu cuenta se actualizó correctamente.',
  },
  {
    id: 'msg-3',
    de: 'Neodomus',
    tipo: 'promo' as const,
    asunto: 'Descuento en iluminación',
    preview: 'Aprovecha el 20 % esta semana...',
    fecha: 'Hace 3 días',
    leido: false,
    cuerpo: 'Tenemos descuentos del 20 % en toda la línea de iluminación.',
  },
];

function montar(onDataChanged = vi.fn()) {
  const utils = render(
    <IdiomaProvider>
      <MessagesTab onDataChanged={onDataChanged} />
    </IdiomaProvider>,
  );
  return { ...utils, onDataChanged };
}

function sembrar(mensajes = MENSAJES) {
  localStorage.setItem(PF_MENSAJES_KEY, JSON.stringify(mensajes));
}

function guardados() {
  return JSON.parse(localStorage.getItem(PF_MENSAJES_KEY) || '[]');
}

describe('MessagesTab', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('lista los mensajes, cuenta los no leídos y ofrece marcarlos todos', () => {
    // Arrange
    sembrar();

    // Act
    montar();

    // Assert
    expect(screen.getByText('Tu pedido está en camino')).toBeTruthy();
    expect(screen.getByText('Tu contraseña fue actualizada')).toBeTruthy();
    expect(screen.getByText('Descuento en iluminación')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No leídas (2)' })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Marcar todas como leídas/i })).toBeTruthy();
    expect(document.querySelectorAll('.pf-msg-item.unread')).toHaveLength(2);
  });

  it('el filtro de no leídas oculta los mensajes ya leídos', async () => {
    // Arrange
    sembrar();
    montar();
    const usuario = userEvent.setup();

    // Act
    await usuario.click(screen.getByRole('button', { name: /No leídas/i }));

    // Assert
    expect(screen.getByText('Tu pedido está en camino')).toBeTruthy();
    expect(screen.getByText('Descuento en iluminación')).toBeTruthy();
    expect(screen.queryByText('Tu contraseña fue actualizada')).toBeNull();
  });

  it('abrir un mensaje no leído muestra el detalle y lo persiste como leído', async () => {
    // Arrange
    sembrar();
    const { onDataChanged } = montar();
    const usuario = userEvent.setup();

    // Act
    await usuario.click(screen.getByText('Tu pedido está en camino'));

    // Assert
    expect(screen.getByRole('heading', { name: 'Tu pedido está en camino' })).toBeTruthy();
    expect(
      screen.getByText('Tu pedido FAC-2026-0001 ya fue despachado y está en camino.'),
    ).toBeTruthy();
    expect(screen.getByText('Hace 2 horas')).toBeTruthy();
    expect(screen.getByText('Neodomus')).toBeTruthy();
    expect(guardados()[0].leido).toBe(true);
    expect(guardados()[1].leido).toBe(true);
    expect(guardados()[2].leido).toBe(false);
    expect(onDataChanged).toHaveBeenCalledTimes(1);
  });

  it('volver desde el detalle restaura la lista con el contador actualizado', async () => {
    // Arrange
    sembrar();
    montar();
    const usuario = userEvent.setup();
    await usuario.click(screen.getByText('Tu pedido está en camino'));

    // Act
    await usuario.click(screen.getByRole('button', { name: /Volver/i }));

    // Assert
    expect(screen.getByText('Tu contraseña fue actualizada')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'No leídas (1)' })).toBeTruthy();
  });

  it('abrir un mensaje ya leído no vuelve a guardar ni notifica', async () => {
    // Arrange
    sembrar();
    const { onDataChanged } = montar();
    const usuario = userEvent.setup();

    // Act
    await usuario.click(screen.getByText('Tu contraseña fue actualizada'));

    // Assert
    expect(screen.getByRole('heading', { name: 'Tu contraseña fue actualizada' })).toBeTruthy();
    expect(onDataChanged).not.toHaveBeenCalled();
    expect(guardados()[1].leido).toBe(true);
  });

  it('marcar todas persiste los cambios, oculta la acción y vacía el filtro', async () => {
    // Arrange
    sembrar();
    const { onDataChanged } = montar();
    const usuario = userEvent.setup();

    // Act
    await usuario.click(screen.getByRole('button', { name: /Marcar todas como leídas/i }));

    // Assert
    await waitFor(() => expect(guardados().every((m: { leido: boolean }) => m.leido)).toBe(true));
    expect(onDataChanged).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: /Marcar todas como leídas/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /No leídas \(/i })).toBeNull();

    // Act: el filtro de no leídas queda vacío.
    await usuario.click(screen.getByRole('button', { name: 'No leídas' }));

    // Assert
    expect(screen.getByText('No tienes mensajes sin leer.')).toBeTruthy();
  });

  it('sin mensajes muestra el estado vacío general', () => {
    // Arrange
    sembrar([]);

    // Act
    montar();

    // Assert
    expect(screen.getByText('No tienes mensajes todavía.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: /Marcar todas como leídas/i })).toBeNull();
  });
});