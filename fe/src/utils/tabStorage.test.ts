// Semana 2 del bootcamp — unitarias del almacenamiento de sesión por pestaña.
// `tabStorage` aísla usuario/tokens por pestaña y migra la sesión compartida
// legacy: lógica real que evita cierres de sesión cruzados entre pestañas.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const SESSION_ID_KEY = 'neodomus_tab_session_id';
const SUFFIX = '__tab__';

function clavesConSufijo(): string[] {
  return Object.keys(localStorage).filter((k) => k.includes(SUFFIX));
}

describe('tabStorage (sesión aislada por pestaña)', () => {
  let modulo: typeof import('./tabStorage');

  beforeEach(async () => {
    sessionStorage.clear();
    localStorage.clear();
    // Import fresco por prueba para partir de un id de sesión nuevo.
    vi.resetModules();
    modulo = await import('./tabStorage');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('tabSet/tabGet escriben y leen bajo la clave de ESTA pestaña', () => {
    // Act
    modulo.tabSet('access_token', 'token-abc');
    // Assert
    expect(modulo.tabGet('access_token')).toBe('token-abc');
    expect(clavesConSufijo()).toHaveLength(1);
  });

  it('rota el id de sesión y las claves antiguas quedan huérfanas', () => {
    // Arrange: clave escrita con el primer id de sesión.
    modulo.tabSet('access_token', 'token-viejo');
    const idAntes = sessionStorage.getItem(SESSION_ID_KEY);
    // Act
    modulo.rotateTabSessionId();
    // Assert: id distinto y la clave anterior ya no es legible.
    expect(sessionStorage.getItem(SESSION_ID_KEY)).not.toBe(idAntes);
    expect(modulo.tabGet('access_token')).toBeNull();
  });

  it('tabRemove elimina solo la clave pedida', () => {
    // Arrange
    modulo.tabSet('access_token', 'a');
    modulo.tabSet('refresh_token', 'r');
    // Act
    modulo.tabRemove('access_token');
    // Assert
    expect(modulo.tabGet('access_token')).toBeNull();
    expect(modulo.tabGet('refresh_token')).toBe('r');
  });

  it('tabRemoveAll limpia todas las claves con sufijo y conserva las ajenas', () => {
    // Arrange
    modulo.tabSet('access_token', 'a');
    modulo.tabSet('user', 'u');
    localStorage.setItem('otro_dato', 'se queda');
    // Act
    modulo.tabRemoveAll();
    // Assert
    expect(clavesConSufijo()).toHaveLength(0);
    expect(localStorage.getItem('otro_dato')).toBe('se queda');
  });

  it('migra la sesión legacy compartida (no fuerza re-login tras actualizar)', async () => {
    // Arrange: datos de la versión anterior (neodomus_shared_*) sin sesión
    // propia en esta pestaña.
    localStorage.setItem('neodomus_shared_access_token', 'legacy-token');
    vi.resetModules();
    modulo = await import('./tabStorage');
    // Act
    const leido = modulo.tabGet('access_token');
    // Assert: migrado a la clave de esta pestaña.
    expect(leido).toBe('legacy-token');
    expect(modulo.tabGet('access_token')).toBe('legacy-token');
  });

  it('sin sessionStorage disponible usa id compartido sin lanzar', async () => {
    // Arrange: sessionStorage roto.
    const original = window.sessionStorage;
    Object.defineProperty(window, 'sessionStorage', {
      configurable: true,
      get: () => {
        throw new Error('bloqueado');
      },
    });
    try {
      vi.resetModules();
      modulo = await import('./tabStorage');
      // Act / Assert: degrada a 'shared' y sigue funcionando.
      modulo.tabSet('access_token', 'x');
      expect(modulo.tabGet('access_token')).toBe('x');
    } finally {
      Object.defineProperty(window, 'sessionStorage', { configurable: true, value: original });
    }
  });
});
