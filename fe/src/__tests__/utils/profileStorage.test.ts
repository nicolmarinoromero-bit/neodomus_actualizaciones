// Tests del helper genérico de localStorage y del perfil/avatares/pedidos.
import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  loadItem,
  saveItem,
  getAvatar,
  setAvatar,
  removeAvatar,
  getTechnicalAvatar,
  setTechnicalAvatar,
  removeTechnicalAvatar,
  getAdminAvatar,
  setAdminAvatar,
  removeAdminAvatar,
  getIniciales,
  getPedidos,
  getMensajes,
  getResenas,
  getTecnicos,
  getPagos,
  getIdioma,
  getNotificaciones,
  PF_AVATAR_KEY,
  PF_TECH_AVATAR_KEY,
  PF_ADMIN_AVATAR_KEY,
} from '../../utils/profileStorage';

describe('loadItem / saveItem', () => {
  beforeEach(() => localStorage.clear());

  it('guarda y recupera valores serializados', () => {
    saveItem('clave', { a: 1 });
    expect(loadItem('clave', { a: 0 })).toEqual({ a: 1 });
  });

  it('devuelve el fallback si la clave no existe', () => {
    expect(loadItem('faltante', 'por-defecto')).toBe('por-defecto');
    expect(loadItem<number[]>('faltante', [])).toEqual([]);
  });

  it('devuelve el fallback si el JSON está corrupto', () => {
    localStorage.setItem('corrupto', '{no-es-json');
    expect(loadItem('corrupto', 'seguro')).toBe('seguro');
  });
});

describe('avatares de perfil', () => {
  beforeEach(() => localStorage.clear());

  it('set/get/remove de avatar de cliente dispara el evento de actualización', () => {
    const listener = vi.fn();
    window.addEventListener('client-profile-updated', listener);

    expect(getAvatar()).toBeNull();
    setAvatar('data:image/png;base64,AAA');
    expect(getAvatar()).toBe('data:image/png;base64,AAA');
    expect(listener).toHaveBeenCalledTimes(1);

    removeAvatar();
    expect(getAvatar()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
    window.removeEventListener('client-profile-updated', listener);
  });

  it('los avatares de técnico y admin usan sus propias claves y eventos', () => {
    const tecnico = vi.fn();
    const admin = vi.fn();
    window.addEventListener('technical-profile-updated', tecnico);
    window.addEventListener('admin-profile-updated', admin);

    setTechnicalAvatar('tech.png');
    setAdminAvatar('admin.png');
    expect(getTechnicalAvatar()).toBe('tech.png');
    expect(getAdminAvatar()).toBe('admin.png');
    expect(tecnico).toHaveBeenCalledTimes(1);
    expect(admin).toHaveBeenCalledTimes(1);

    removeTechnicalAvatar();
    removeAdminAvatar();
    expect(getTechnicalAvatar()).toBeNull();
    expect(getAdminAvatar()).toBeNull();

    window.removeEventListener('technical-profile-updated', tecnico);
    window.removeEventListener('admin-profile-updated', admin);
  });

  it('las tres claves de avatar son independientes', () => {
    setAvatar('c.png');
    setTechnicalAvatar('t.png');
    expect(getAvatar()).toBe('c.png');
    expect(getTechnicalAvatar()).toBe('t.png');
    expect(localStorage.getItem(PF_AVATAR_KEY)).toBe('c.png');
    expect(localStorage.getItem(PF_TECH_AVATAR_KEY)).toBe('t.png');
    expect(localStorage.getItem(PF_ADMIN_AVATAR_KEY)).toBeNull();
  });
});

describe('getIniciales', () => {
  it('toma hasta dos iniciales en mayúsculas', () => {
    expect(getIniciales('Ana María Pérez')).toBe('AM');
    expect(getIniciales('juan')).toBe('J');
  });

  it('devuelve "N" cuando no hay nombre', () => {
    expect(getIniciales('')).toBe('N');
    expect(getIniciales('   ')).toBe('N');
  });
});

describe('datos por defecto del perfil', () => {
  beforeEach(() => localStorage.clear());

  it('entrega pedidos/mensajes/reseñas de ejemplo cuando no hay datos guardados', () => {
    expect(getPedidos().length).toBeGreaterThan(0);
    expect(getPedidos()[0]).toHaveProperty('folio');
    expect(getMensajes().length).toBeGreaterThan(0);
    expect(getResenas().length).toBeGreaterThan(0);
    expect(getTecnicos().length).toBeGreaterThan(0);
    expect(getPagos().length).toBeGreaterThan(0);
  });

  it('respeta los datos guardados por encima de los de ejemplo', () => {
    saveItem('pf_pedidos', [{ id: 'PED-1' }]);
    expect(getPedidos()).toHaveLength(1);
    expect(getPedidos()[0].id).toBe('PED-1');
  });

  it('idioma por defecto "es" y preferencias de notificación por defecto', () => {
    expect(getIdioma()).toBe('es');
    localStorage.setItem('pf_idioma', 'en');
    expect(getIdioma()).toBe('en');

    expect(getNotificaciones()).toEqual({
      pedidos: true,
      promociones: true,
      tecnicos: true,
      boletines: false,
      seguridad: true,
    });
  });
});
