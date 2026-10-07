// Tests de la sincronización de cambios de técnicos entre pestañas.
// jsdom no expone BroadcastChannel de forma fiable, así que se prueba la
// ruta por eventos de ventana (fallback usado también en el mismo tab).
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { notificarCambiosTecnicos, suscribirCambiosTecnicos } from '../../utils/tecnicosSync';

describe('tecnicosSync', () => {
  beforeEach(() => localStorage.clear());

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('notificarCambiosTecnicos emite el evento de ventana', () => {
    const listener = vi.fn();
    window.addEventListener('tecnicos-actualizados', listener);
    notificarCambiosTecnicos();
    expect(listener).toHaveBeenCalledTimes(1);
    window.removeEventListener('tecnicos-actualizados', listener);
  });

  it('suscribirCambiosTecnicos recibe los cambios y al desuscribirse deja de recibirlos', () => {
    const callback = vi.fn();
    const cancelar = suscribirCambiosTecnicos(callback);

    notificarCambiosTecnicos();
    expect(callback).toHaveBeenCalledTimes(1);

    cancelar();
    notificarCambiosTecnicos();
    expect(callback).toHaveBeenCalledTimes(1);
  });

  it('la suscripción es estable aunque BroadcastChannel falle', () => {
    // Fuerza el camino de error del try/catch (canal no disponible).
    const original = globalThis.BroadcastChannel;
    // @ts-expect-error — se elimina a propósito para probar el fallback
    delete globalThis.BroadcastChannel;

    const callback = vi.fn();
    const cancelar = suscribirCambiosTecnicos(callback);
    window.dispatchEvent(new CustomEvent('tecnicos-actualizados'));
    expect(callback).toHaveBeenCalledTimes(1);
    cancelar();

    globalThis.BroadcastChannel = original;
  });
});
