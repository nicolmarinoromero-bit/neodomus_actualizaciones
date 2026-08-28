// Almacenamiento de sesión con soporte multi-pestaña.
// Los tokens se guardan en localStorage COMPARTIDO entre pestañas.
// Un prefijo por pestaña (sessionStorage) permite que cada pestaña
// tenga su propio usuario, pero los tokens de acceso se sincronizan.

const SESSION_ID_KEY = 'neodomus_tab_session_id';
const SUFFIX = '__tab__';
const SHARED_TOKEN_KEY = 'neodomus_shared_access_token';
const SHARED_REFRESH_KEY = 'neodomus_shared_refresh_token';
const SHARED_USER_KEY = 'neodomus_shared_user';

const getSessionId = (): string => {
  try {
    let id = sessionStorage.getItem(SESSION_ID_KEY);
    if (!id) {
      id = `${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(SESSION_ID_KEY, id);
    }
    return id;
  } catch {
    return 'shared';
  }
};

const scoped = (key: string): string => `${getSessionId()}${SUFFIX}${key}`;

// ── Keys que se comparten entre pestañas ─────────────────────────────
const SHARED_KEYS: Record<string, string> = {
  access_token: SHARED_TOKEN_KEY,
  refresh_token: SHARED_REFRESH_KEY,
  user: SHARED_USER_KEY,
};

// ── Lectura: datos compartidos se leen del almacenamiento COMPARTIDO ──
export const tabGet = (key: string): string | null => {
  try {
    const sharedKey = SHARED_KEYS[key];
    if (sharedKey) {
      const shared = localStorage.getItem(sharedKey);
      if (shared) return shared;
      // Fallback: migrar tokens del sistema viejo (scoped por sessionId).
      // Si el usuario inició sesión con el código anterior, los tokens
      // están bajo un sessionId anterior y no se encuentran con el nuevo.
      // Buscamos cualquier key que termine en SUFFIX+key y la migramos.
      const scopedVal = localStorage.getItem(scoped(key));
      if (scopedVal) {
        localStorage.setItem(sharedKey, scopedVal);
        return scopedVal;
      }
      // Buscar en cualquier key scoped antigua (sessionId desconocido).
      const suffix = `${SUFFIX}${key}`;
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.endsWith(suffix) && k !== scoped(key)) {
          const val = localStorage.getItem(k);
          if (val) {
            localStorage.setItem(sharedKey, val);
            return val;
          }
        }
      }
      return null;
    }
    return localStorage.getItem(scoped(key));
  } catch {
    return null;
  }
};

// ── Escritura: datos compartidos se guardan en COMPARTIDO + local ────
export const tabSet = (key: string, value: string): void => {
  try {
    const sharedKey = SHARED_KEYS[key];
    if (sharedKey) {
      localStorage.setItem(sharedKey, value);
    }
    localStorage.setItem(scoped(key), value);
  } catch {
    /* noop */
  }
};

export const tabRemove = (key: string): void => {
  try {
    const sharedKey = SHARED_KEYS[key];
    if (sharedKey) {
      localStorage.removeItem(sharedKey);
    }
    localStorage.removeItem(scoped(key));
  } catch {
    /* noop */
  }
};

export const tabRemoveAll = (): void => {
  try {
    // Limpiar datos compartidos.
    Object.values(SHARED_KEYS).forEach((k) => localStorage.removeItem(k));
    // Limpiar datos por pestaña.
    const keys: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.includes(SUFFIX)) keys.push(k);
    }
    keys.forEach((k) => localStorage.removeItem(k));
  } catch {
    /* noop */
  }
};

// No necesita rotar: los tokens son compartidos entre pestañas.
export const rotateTabSessionId = (): void => {
  try {
    sessionStorage.setItem(
      SESSION_ID_KEY,
      `${Date.now()}_${Math.random().toString(36).slice(2, 10)}_${Math.random().toString(36).slice(2, 10)}`,
    );
  } catch {
    /* noop */
  }
};
