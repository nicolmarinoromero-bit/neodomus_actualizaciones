// Semana 2 del bootcamp — unitarias del hook de favoritos (AAA).
// Regla real: los favoritos se separan por identidad (visitante vs correo),
// persisten en localStorage y al iniciar sesión los del visitante se
// MIGRAN a la cuenta sin duplicados. Sin red: AuthContext se simula.
import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));

vi.mock('@contexts/AuthContext', () => ({
  useAuth: useAuthMock,
}));

import { useFavoritos } from './favoritos';

const VISITANTE_KEY = 'neodomus_favoritos_visitante';

function identidad({ autenticado, correo }: { autenticado: boolean; correo?: string }) {
  useAuthMock.mockReturnValue({
    isAuthenticated: autenticado,
    user: correo ? { id: 1, correo } : undefined,
  });
}

describe('useFavoritos', () => {
  beforeEach(() => {
    localStorage.clear();
    useAuthMock.mockReset();
  });

  afterEach(() => {
    localStorage.clear();
  });

  it('un visitante guarda y quita favoritos en su clave propia', () => {
    // Arrange
    identidad({ autenticado: false });
    const { result } = renderHook(() => useFavoritos());
    // Act
    act(() => result.current.toggleFavorito(7));
    // Assert: estado interno y persistencia coinciden.
    expect(result.current.favoritos.has(7)).toBe(true);
    expect(result.current.esFavorito(7)).toBe(true);
    expect(JSON.parse(localStorage.getItem(VISITANTE_KEY) || '[]')).toEqual([7]);
  });

  it('toggle dos veces vuelve al estado vacío (idempotente)', () => {
    identidad({ autenticado: false });
    const { result } = renderHook(() => useFavoritos());
    act(() => result.current.toggleFavorito(3));
    act(() => result.current.toggleFavorito(3));
    expect(result.current.favoritos.has(3)).toBe(false);
    expect(localStorage.getItem(VISITANTE_KEY)).toBe('[]');
  });

  it('quitarFavorito sobre un id ausente no escribe nada', () => {
    identidad({ autenticado: false });
    const { result } = renderHook(() => useFavoritos());
    act(() => result.current.quitarFavorito(99));
    expect(result.current.favoritos.size).toBe(0);
    // La clave ni siquiera se crea: no hay escritura si el estado no cambió.
    expect(localStorage.getItem(VISITANTE_KEY)).toBeNull();
  });

  it('cada usuario tiene su propia lista (claves por correo)', () => {
    // Arrange: el usuario carolina ya tiene un favorito guardado.
    identidad({ autenticado: true, correo: 'carolina@neodomus.com' });
    localStorage.setItem('neodomus_favoritos_carolina@neodomus.com', JSON.stringify([11]));
    const { result, rerender } = renderHook(() => useFavoritos());
    expect(result.current.favoritos.has(11)).toBe(true);
    // Act: otro usuario inicia sesión en el mismo almacenamiento.
    identidad({ autenticado: true, correo: 'ana@neodomus.com' });
    rerender();
    // Assert: la lista de carolina no se filtra a ana.
    return waitFor(() => expect(result.current.favoritos.has(11)).toBe(false));
  });

  it('al iniciar sesión los favoritos del visitante se migran sin duplicados', () => {
    // Arrange: visitante con favoritos (incluido uno que ya tiene la cuenta).
    localStorage.setItem(VISITANTE_KEY, JSON.stringify([5, 9]));
    localStorage.setItem('neodomus_favoritos_ana@neodomus.com', JSON.stringify([9]));
    identidad({ autenticado: false });
    const { result, rerender } = renderHook(() => useFavoritos());
    // Act: inicia sesión.
    identidad({ autenticado: true, correo: 'ana@neodomus.com' });
    rerender();
    // Assert: unión sin duplicados y estado temporal del visitante limpio.
    return waitFor(() => {
      expect([...result.current.favoritos].sort()).toEqual([5, 9]);
      expect(JSON.parse(localStorage.getItem('neodomus_favoritos_ana@neodomus.com') || '[]').sort())
        .toEqual([5, 9]);
      expect(JSON.parse(localStorage.getItem(VISITANTE_KEY) || '[]')).toEqual([]);
    });
  });

  it('un JSON corrupto en el almacenamiento no rompe el hook (lista vacía)', () => {
    // Arrange: valor inválido escrito a mano.
    identidad({ autenticado: true, correo: 'roto@neodomus.com' });
    localStorage.setItem('neodomus_favoritos_roto@neodomus.com', '{no-es-json');
    // Act / Assert: la lectura cae a [] sin lanzar.
    const { result } = renderHook(() => useFavoritos());
    expect(result.current.favoritos.size).toBe(0);
  });
});
