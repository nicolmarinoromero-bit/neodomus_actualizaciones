// Tests de los hooks de favoritos (visitante vs. usuario autenticado):
// claves por identidad, migración al login y persistencia en localStorage.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';

const sesion = vi.hoisted(() => ({ autenticado: false, correo: '' }));

vi.mock('@contexts/AuthContext', () => ({
  useAuth: () => ({
    isAuthenticated: sesion.autenticado,
    user: sesion.autenticado ? { correo: sesion.correo } : null,
  }),
}));

import { useFavoritos } from '../../utils/favoritos';
import { useTecnicosFavoritos } from '../../utils/tecnicosFavoritos';

const KEY_VISITANTE = 'neodomus_favoritos_visitante';
const KEY_TEC_VISITANTE = 'neodomus_tecnicos_favoritos_visitante';

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sesion.autenticado = false;
  sesion.correo = '';
});

describe('useFavoritos', () => {
  it('como visitante usa la clave compartida de visitantes', () => {
    const { result } = renderHook(() => useFavoritos());
    expect(result.current.esFavorito(1)).toBe(false);

    act(() => result.current.toggleFavorito(1));
    expect(result.current.esFavorito(1)).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY_VISITANTE) || '[]')).toEqual([1]);

    act(() => result.current.toggleFavorito(1));
    expect(result.current.esFavorito(1)).toBe(false);
    expect(JSON.parse(localStorage.getItem(KEY_VISITANTE) || '[]')).toEqual([]);
  });

  it('quitarFavorito no toca los que no estaban marcados', () => {
    localStorage.setItem(KEY_VISITANTE, JSON.stringify([5]));
    const { result } = renderHook(() => useFavoritos());
    expect(result.current.esFavorito(5)).toBe(true);

    act(() => result.current.quitarFavorito(9));
    expect(JSON.parse(localStorage.getItem(KEY_VISITANTE) || '[]')).toEqual([5]);

    act(() => result.current.quitarFavorito(5));
    expect(result.current.esFavorito(5)).toBe(false);
  });

  it('usa la clave del usuario cuando está autenticado', () => {
    sesion.autenticado = true;
    sesion.correo = 'ana@correo.com';
    const { result } = renderHook(() => useFavoritos());

    act(() => result.current.toggleFavorito(7));
    expect(JSON.parse(localStorage.getItem('neodomus_favoritos_ana@correo.com') || '[]')).toEqual([7]);
    expect(localStorage.getItem(KEY_VISITANTE)).toBeNull();
  });

  it('al iniciar sesión migra los favoritos del visitante sin duplicados', async () => {
    localStorage.setItem(KEY_VISITANTE, JSON.stringify([1, 2]));
    localStorage.setItem('neodomus_favoritos_ana@correo.com', JSON.stringify([2, 3]));
    sesion.autenticado = true;
    sesion.correo = 'ana@correo.com';

    const { result } = renderHook(() => useFavoritos());

    await waitFor(() => {
      expect([...result.current.favoritos].sort()).toEqual([1, 2, 3]);
    });
    // La lista del visitante queda vacía tras la migración.
    expect(JSON.parse(localStorage.getItem(KEY_VISITANTE) || '[]')).toEqual([]);
    expect(
      JSON.parse(localStorage.getItem('neodomus_favoritos_ana@correo.com') || '[]').sort(),
    ).toEqual([1, 2, 3]);
  });

  it('al cerrar sesión vuelve a la lista del visitante', async () => {
    // Solo favoritos de la cuenta: la migración no toca nada.
    localStorage.setItem('neodomus_favoritos_ana@correo.com', JSON.stringify([4]));
    sesion.autenticado = true;
    sesion.correo = 'ana@correo.com';

    const { result, rerender } = renderHook(() => useFavoritos());
    expect(result.current.esFavorito(4)).toBe(true);

    // Otro visitante (p. ej. otra sesión) deja favoritos en la clave común.
    localStorage.setItem(KEY_VISITANTE, JSON.stringify([9]));
    sesion.autenticado = false;
    sesion.correo = '';
    rerender();

    expect(result.current.esFavorito(4)).toBe(false);
    expect(result.current.esFavorito(9)).toBe(true);
  });

  it('un JSON corrupto se trata como lista vacía', () => {
    localStorage.setItem(KEY_VISITANTE, 'no-es-json');
    const { result } = renderHook(() => useFavoritos());
    expect(result.current.favoritos.size).toBe(0);
    act(() => result.current.toggleFavorito(3));
    expect(JSON.parse(localStorage.getItem(KEY_VISITANTE) || '[]')).toEqual([3]);
  });
});

describe('useTecnicosFavoritos', () => {
  it('alterna favoritos de técnicos como visitante', () => {
    const { result } = renderHook(() => useTecnicosFavoritos());
    expect(result.current.esFavorito(2)).toBe(false);

    act(() => result.current.toggleFavorito(2));
    expect(result.current.esFavorito(2)).toBe(true);
    expect(JSON.parse(localStorage.getItem(KEY_TEC_VISITANTE) || '[]')).toEqual([2]);

    act(() => result.current.toggleFavorito(2));
    expect(result.current.esFavorito(2)).toBe(false);
  });

  it('migra los favoritos de técnicos del visitante al usuario', async () => {
    localStorage.setItem(KEY_TEC_VISITANTE, JSON.stringify([11]));
    sesion.autenticado = true;
    sesion.correo = 'ana@correo.com';

    const { result } = renderHook(() => useTecnicosFavoritos());

    await waitFor(() => expect(result.current.esFavorito(11)).toBe(true));
    expect(JSON.parse(localStorage.getItem(KEY_TEC_VISITANTE) || '[]')).toEqual([]);
    expect(JSON.parse(localStorage.getItem('neodomus_tecnicos_favoritos_ana@correo.com') || '[]')).toEqual([11]);
  });

  it('con usuario sin correo se queda en la clave de visitante', () => {
    sesion.autenticado = true;
    sesion.correo = '';
    const { result } = renderHook(() => useTecnicosFavoritos());

    act(() => result.current.toggleFavorito(4));
    expect(JSON.parse(localStorage.getItem(KEY_TEC_VISITANTE) || '[]')).toEqual([4]);
  });
});
