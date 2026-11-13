// Semana 2 — guard de separación de roles por ruta (RoleRoute).
// Regla real: cada rol vive en su espacio; un rol equivocado NO ve la ruta
// ajena, vuelve al suyo; 'admin' se normaliza a 'administrador'.
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock('@contexts/AuthContext', () => ({ useAuth: useAuthMock }));

import RoleRoute from './RoleRoute';

function montar(allowed: Array<'cliente' | 'administrador' | 'tecnico'>) {
  render(
    <MemoryRouter initialEntries={['/zona-admin']}>
      <Routes>
        <Route element={<RoleRoute allowed={allowed} />}>
          <Route path="/zona-admin" element={<div>Zona de administradores</div>} />
        </Route>
        <Route path="/login" element={<div>Página de login</div>} />
        <Route path="/productos" element={<div>Catálogo</div>} />
        <Route path="/dashboard/admin" element={<div>Dashboard admin</div>} />
        <Route path="/dashboard/tecnico" element={<div>Dashboard técnico</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('RoleRoute', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it('mientras la sesión carga solo muestra el cargador', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, loading: true, rol: 'admin' });
    montar(['administrador']);
    expect(screen.getByText('Cargando...')).toBeTruthy();
  });

  it('sin sesión va a /login', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, loading: false, rol: undefined });
    montar(['administrador']);
    expect(screen.getByText('Página de login')).toBeTruthy();
  });

  it('sin rol definido va a /login', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, loading: false, rol: undefined });
    montar(['administrador']);
    expect(screen.getByText('Página de login')).toBeTruthy();
  });

  it('un rol permitido ve la ruta protegida', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, loading: false, rol: 'administrador' });
    montar(['administrador']);
    expect(screen.getByText('Zona de administradores')).toBeTruthy();
  });

  it("el alias 'admin' se normaliza a 'administrador'", () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, loading: false, rol: 'admin' });
    montar(['administrador']);
    expect(screen.getByText('Zona de administradores')).toBeTruthy();
  });

  it('un cliente que intenta la zona admin vuelve al catálogo (su contexto)', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, loading: false, rol: 'cliente' });
    montar(['administrador']);
    expect(screen.getByText('Catálogo')).toBeTruthy();
    expect(screen.queryByText('Zona de administradores')).toBeFalsy();
  });

  it('un técnico que intenta la zona admin va a su dashboard de técnico', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, loading: false, rol: 'tecnico' });
    montar(['administrador']);
    expect(screen.getByText('Dashboard técnico')).toBeTruthy();
    expect(screen.queryByText('Zona de administradores')).toBeFalsy();
  });
});
