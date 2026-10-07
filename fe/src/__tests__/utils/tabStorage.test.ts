// Tests del almacenamiento aislado por pestaña (sesión multi-pestaña).
import { describe, it, expect, beforeEach } from 'vitest';
import {
  tabGet,
  tabSet,
  tabRemove,
  tabRemoveAll,
  rotateTabSessionId,
} from '../../utils/tabStorage';

const SESSION_ID_KEY = 'neodomus_tab_session_id';

describe('tabStorage', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('guarda y lee valores aislados bajo el id de sesión de la pestaña', () => {
    tabSet('access_token', 'tok-123');
    expect(tabGet('access_token')).toBe('tok-123');
    const id = sessionStorage.getItem(SESSION_ID_KEY);
    expect(id).toBeTruthy();
    expect(localStorage.getItem(`${id}__tab__access_token`)).toBe('tok-123');
  });

  it('devuelve null para claves inexistentes', () => {
    expect(tabGet('no-existe')).toBeNull();
  });

  it('elimina valores con tabRemove', () => {
    tabSet('user', '{"id":1}');
    tabRemove('user');
    expect(tabGet('user')).toBeNull();
  });

  it('tabRemoveAll limpia únicamente las claves con prefijo de pestaña', () => {
    tabSet('access_token', 'a');
    tabSet('refresh_token', 'b');
    localStorage.setItem('otra_clave_global', 'x');
    tabRemoveAll();
    expect(tabGet('access_token')).toBeNull();
    expect(tabGet('refresh_token')).toBeNull();
    expect(localStorage.getItem('otra_clave_global')).toBe('x');
  });

  it('migra la sesión legacy compartida si esta pestaña no tiene sesión', () => {
    localStorage.setItem('neodomus_shared_access_token', 'legacy-token');
    expect(tabGet('access_token')).toBe('legacy-token');
    // Queda copiada a la clave de esta pestaña para siguientes lecturas.
    expect(tabGet('access_token')).toBe('legacy-token');
    localStorage.removeItem('neodomus_shared_access_token');
  });

  it('no migra claves que no están en la tabla legacy', () => {
    localStorage.setItem('neodomus_shared_password_reset_required', '1');
    expect(tabGet('password_reset_required')).toBeNull();
  });

  it('rotateTabSessionId cambia el id de la pestaña (las claves viejas quedan huérfanas)', () => {
    tabSet('access_token', 'tok-1');
    const idAntes = sessionStorage.getItem(SESSION_ID_KEY);
    rotateTabSessionId();
    const idDespues = sessionStorage.getItem(SESSION_ID_KEY);
    expect(idDespues).not.toBe(idAntes);
    expect(tabGet('access_token')).toBeNull();
  });
});
