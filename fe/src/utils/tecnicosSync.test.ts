// Semana 2 — sincronización de técnicos entre pestañas (BroadcastChannel +
// evento de ventana; la misma pestaña reacciona al evento local).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { notificarCambiosTecnicos, suscribirCambiosTecnicos } from './tecnicosSync';

describe('tecnicosSync', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('notificar publica en el canal y dispara el evento local', () => {
    // Arrange
    const postMessage = vi.fn();
    const cerrar = vi.fn();
    const original = window.BroadcastChannel;
    class CanalFalso {
      onmessage: ((ev: unknown) => void) | null = null;
      postMessage = postMessage;
      close = cerrar;
    }
    (window as unknown as { BroadcastChannel: unknown }).BroadcastChannel = CanalFalso;
    const oyente = vi.fn();
    window.addEventListener('tecnicos-actualizados', oyente);
    try {
      // Act
      notificarCambiosTecnicos();
      // Assert
      expect(postMessage).toHaveBeenCalledTimes(1);
      const mensaje = postMessage.mock.calls[0][0] as { tipo: string; ts: number };
      expect(mensaje.tipo).toBe('tecnicos-actualizados');
      expect(typeof mensaje.ts).toBe('number');
      expect(cerrar).toHaveBeenCalledTimes(1); // el canal no queda abierto
      expect(oyente).toHaveBeenCalledTimes(1); // la pestaña actual también recarga
    } finally {
      (window as unknown as { BroadcastChannel: unknown }).BroadcastChannel = original;
      window.removeEventListener('tecnicos-actualizados', oyente);
    }
  });

  it('suscribir escucha el evento local y la cancelación lo retira', () => {
    // Arrange
    const callback = vi.fn();
    const cancelar = suscribirCambiosTecnicos(callback);
    window.dispatchEvent(new CustomEvent('tecnicos-actualizados'));
    expect(callback).toHaveBeenCalledTimes(1);
    // Act
    cancelar();
    window.dispatchEvent(new CustomEvent('tecnicos-actualizados'));
    // Assert: tras cancelar no vuelve a llegar nada.
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('sin soporte de BroadcastChannel la suscripción degrada al evento local', () => {
    // Arrange: navegador sin BroadcastChannel.
    const original = window.BroadcastChannel;
    (window as unknown as { BroadcastChannel: unknown }).BroadcastChannel = undefined;
    try {
      const callback = vi.fn();
      // Act: no lanza aunque el canal falle.
      const cancelar = suscribirCambiosTecnicos(callback);
      window.dispatchEvent(new CustomEvent('tecnicos-actualizados'));
      // Assert
      expect(callback).toHaveBeenCalledTimes(1);
      expect(() => cancelar()).not.toThrow();
    } finally {
      (window as unknown as { BroadcastChannel: unknown }).BroadcastChannel = original;
    }
  });
});
