// Semana 2 — guard de acceso de rutas protegidas (regla real: qué ve un
// visitante, un usuario autenticado y uno con rol no permitido).
import type { ReactNode } from 'react';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock('@contexts/AuthContext', () => ({ useAuth: useAuthMock }));

import { ProtectedRoute } from './ProtectedRoute';

type EstadoAuth = { isAuthenticated: boolean; loading: boolean; rol?: string };

function montar(
  estado: EstadoAuth,
  contenido: ReactNode = <div>Contenido privado</div>,
  allowedRoles?: string[],
) {
  useAuthMock.mockReturnValue(estado);
  render(
    <MemoryRouter initialEntries={['/privado']}>
      <Routes>
        <Route
          path="/privado"
          element={
            <ProtectedRoute allowedRoles={allowedRoles}>
              {contenido}
            </ProtectedRoute>
          }
        />
        <Route path="/login" element={<div>Página de login</div>} />
        <Route path="/" element={<div>Catálogo público</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it('mientras carga la sesión muestra el cargador y no redirige', () => {
    montar({ isAuthenticated: false, loading: true });

    expect(screen.getByText('Cargando...')).toBeTruthy();
    expect(screen.queryByText('Página de login')).toBeFalsy();
  });

  it('un visitante es enviado a /login', () => {
    montar({ isAuthenticated: false, loading: false });

    expect(screen.getByText('Página de login')).toBeTruthy();
  });

  it('sin allowedRoles, un autenticado ve el contenido', () => {
    montar({ isAuthenticated: true, loading: false, rol: 'cliente' });

    expect(screen.getByText('Contenido privado')).toBeTruthy();
  });

  it('con allowedRoles, un rol no listado vuelve al catálogo público', () => {
    montar(
      { isAuthenticated: true, loading: false, rol: 'cliente' },
      <div>Panel admin</div>,
      ['administrador'],
    );

    expect(screen.getByText('Catálogo público')).toBeTruthy();
    expect(screen.queryByText('Panel admin')).toBeFalsy();
  });

  it('sin rol definido y con allowedRoles, también vuelve al catálogo', () => {
    montar(
      { isAuthenticated: true, loading: false },
      <div>Panel admin</div>,
      ['administrador'],
    );

    expect(screen.getByText('Catálogo público')).toBeTruthy();
    expect(screen.queryByText('Panel admin')).toBeFalsy();
  });
});
