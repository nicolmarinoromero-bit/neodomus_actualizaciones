// Almacenamiento de sesión aislado por pestaña.
// Las claves de sesión (tokens y usuario) se guardan en localStorage pero con
// un sufijo único por pestaña (id en sessionStorage). Así una pestaña mantiene
// su sesión aunque en otra pestaña se inicie sesión con otra cuenta.

const SESSION_ID_KEY = 'neodomus_tab_session_id';
const SUFFIX = '__tab__';

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

export const tabGet = (key: string): string | null => {
  try {
    return localStorage.getItem(scoped(key));
  } catch {
    return null;
  }
};

export const tabSet = (key: string, value: string): void => {
  try {
    localStorage.setItem(scoped(key), value);
  } catch {
    /* noop */
  }
};

export const tabRemove = (key: string): void => {
  try {
    localStorage.removeItem(scoped(key));
  } catch {
    /* noop */
  }
};

export const tabRemoveAll = (): void => {
  try {
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

// Genera un id de sesión NUEVO para esta pestaña: al iniciar sesión con otra
// cuenta, los tokens se guardan bajo un id distinto y la pestaña original
// conserva su sesión intacta (también si la pestaña heredó sessionStorage).
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