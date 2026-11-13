// Semana 2 — guard de acceso de rutas protegidas (regla real: qué ve un
// visitante, un usuario autenticado y uno con rol no permitido).
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const { useAuthMock } = vi.hoisted(() => ({ useAuthMock: vi.fn() }));
vi.mock('@contexts/AuthContext', () => ({ useAuth: useAuthMock }));

import { ProtectedRoute } from './ProtectedRoute';

describe('ProtectedRoute', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
  });

  it('mientras carga la sesión muestra el cargador y no redirige', () => {
    // Arrange
    useAuthMock.mockReturnValue({ isAuthenticated: false, loading: true, rol: undefined });
    // Act
    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route
            path="/privado"
            element={<ProtectedRoute><div>Contenido privado</div></ProtectedRoute>}
          />
          <Route path="/login" element={<div>Página de login</div>} />
          <Route path="/" element={<div>Catálogo público</div>} />
        </Routes>
      </MemoryRouter>,
    );
    // Assert
    expect(screen.getByText('Cargando...')).toBeTruthy();
    expect(screen.queryByText('Página de login')).toBeFalsy();
  });

  it('un visitante es enviado a /login', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: false, loading: false, rol: undefined });
    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route
            path="/privado"
            element={<ProtectedRoute><div>Contenido privado</div></ProtectedRoute>}
          />
          <Route path="/login" element={<div>Página de login</div>} />
          <Route path="/" element={<div>Catálogo público</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Página de login')).toBeTruthy();
  });

  it('sin allowedRoles, un autenticado ve el contenido', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, loading: false, rol: 'cliente' });
    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route
            path="/privado"
            element={<ProtectedRoute><div>Contenido privado</div></ProtectedRoute>}
          />
          <Route path="/login" element={<div>Página de login</div>} />
          <Route path="/" element={<div>Catálogo público</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Contenido privado')).toBeTruthy();
  });

  it('con allowedRoles, un rol no listado vuelve al catálogo público', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, loading: false, rol: 'cliente' });
    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route
            path="/privado"
            element={
              <ProtectedRoute allowedRoles={['administrador']}>
                <div>Panel admin</div>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<div>Catálogo público</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Catálogo público')).toBeTruthy();
    expect(screen.queryByText('Panel admin')).toBeFalsy();
  });

  it('sin rol definido y con allowedRoles, también vuelve al catálogo', () => {
    useAuthMock.mockReturnValue({ isAuthenticated: true, loading: false, rol: undefined });
    render(
      <MemoryRouter initialEntries={['/privado']}>
        <Routes>
          <Route
            path="/privado"
            element={
              <ProtectedRoute allowedRoles={['administrador']}>
                <div>Panel admin</div>
              </ProtectedRoute>
            }
          />
          <Route path="/" element={<div>Catálogo público</div>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText('Catálogo público')).toBeTruthy();
    expect(screen.queryByText('Panel admin')).toBeFalsy();
  });
});
