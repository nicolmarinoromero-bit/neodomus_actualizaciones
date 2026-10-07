// Tests de los guardas de rutas (ProtectedRoute, RoleRoute, PrivateRoute):
// carga inicial, redirección por sesión inexistente y separación de roles.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';

const estado = vi.hoisted(() => ({
  loading: false,
  isAuthenticated: false,
  rol: null as string | null,
}));

vi.mock('@contexts/AuthContext', () => ({
  useAuth: () => ({ ...estado }),
}));

import { ProtectedRoute } from '../../components/common/ProtectedRoute';
import RoleRoute from '../../components/layout/RoleRoute';
import PrivateRoute from '../../components/layout/PrivateRoute';

beforeEach(() => {
  estado.loading = false;
  estado.isAuthenticated = false;
  estado.rol = null;
});

/** Router de prueba con todas las rutas destino usadas por los guardas. */
const RouterPrueba = ({ children }: { children: React.ReactNode }) => (
  <MemoryRouter initialEntries={['/privada']}>
    <Routes>
      <Route path="/privada" element={children} />
      <Route path="/login" element={<div>pantalla-login</div>} />
      <Route path="/" element={<div>pantalla-inicio</div>} />
      <Route path="/productos" element={<div>area-productos</div>} />
      <Route path="/dashboard/admin" element={<div>area-admin</div>} />
      <Route path="/dashboard/tecnico" element={<div>area-tecnico</div>} />
    </Routes>
  </MemoryRouter>
);

/** Router donde /privada está protegida por un guarda basado en <Outlet/>. */
const RouterConGuarda = (guarda: React.ReactElement) => (
  <MemoryRouter initialEntries={['/privada']}>
    <Routes>
      <Route element={guarda}>
        <Route path="/privada" element={<div>contenido-privado</div>} />
      </Route>
      <Route path="/login" element={<div>pantalla-login</div>} />
      <Route path="/" element={<div>pantalla-inicio</div>} />
      <Route path="/productos" element={<div>area-productos</div>} />
      <Route path="/dashboard/admin" element={<div>area-admin</div>} />
      <Route path="/dashboard/tecnico" element={<div>area-tecnico</div>} />
    </Routes>
  </MemoryRouter>
);

describe('ProtectedRoute', () => {
  it('mientras carga no redirige', () => {
    estado.loading = true;
    render(
      <RouterPrueba>
        <ProtectedRoute allowedRoles={['cliente']}>
          <div>contenido-privado</div>
        </ProtectedRoute>
      </RouterPrueba>,
    );
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(screen.queryByText('pantalla-login')).toBeNull();
  });

  it('sin sesión redirige a /login guardando el origen', () => {
    render(
      <RouterPrueba>
        <ProtectedRoute>
          <div>contenido-privado</div>
        </ProtectedRoute>
      </RouterPrueba>,
    );
    expect(screen.getByText('pantalla-login')).toBeInTheDocument();
    expect(screen.queryByText('contenido-privado')).toBeNull();
  });

  it('con sesión y rol permitido muestra el contenido', () => {
    estado.isAuthenticated = true;
    estado.rol = 'cliente';
    render(
      <RouterPrueba>
        <ProtectedRoute allowedRoles={['cliente']}>
          <div>contenido-privado</div>
        </ProtectedRoute>
      </RouterPrueba>,
    );
    expect(screen.getByText('contenido-privado')).toBeInTheDocument();
  });

  it('con sesión pero rol no permitido redirige al inicio', () => {
    estado.isAuthenticated = true;
    estado.rol = 'tecnico';
    render(
      <RouterPrueba>
        <ProtectedRoute allowedRoles={['cliente']}>
          <div>contenido-privado</div>
        </ProtectedRoute>
      </RouterPrueba>,
    );
    expect(screen.getByText('pantalla-inicio')).toBeInTheDocument();
    expect(screen.queryByText('contenido-privado')).toBeNull();
  });

  it('con sesión pero sin rol no entra', () => {
    estado.isAuthenticated = true;
    estado.rol = null;
    render(
      <RouterPrueba>
        <ProtectedRoute allowedRoles={['cliente']}>
          <div>contenido-privado</div>
        </ProtectedRoute>
      </RouterPrueba>,
    );
    expect(screen.getByText('pantalla-inicio')).toBeInTheDocument();
  });

  it('sin allowedRoles acepta cualquier sesión', () => {
    estado.isAuthenticated = true;
    estado.rol = 'administrador';
    render(
      <RouterPrueba>
        <ProtectedRoute>
          <div>contenido-privado</div>
        </ProtectedRoute>
      </RouterPrueba>,
    );
    expect(screen.getByText('contenido-privado')).toBeInTheDocument();
  });
});

describe('PrivateRoute', () => {
  it('muestra el estado de carga', () => {
    estado.loading = true;
    render(RouterConGuarda(<PrivateRoute />));
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(screen.queryByText('pantalla-login')).toBeNull();
  });

  it('sin sesión redirige a /login', () => {
    render(RouterConGuarda(<PrivateRoute />));
    expect(screen.getByText('pantalla-login')).toBeInTheDocument();
    expect(screen.queryByText('contenido-privado')).toBeNull();
  });

  it('con sesión muestra la ruta protegida', () => {
    estado.isAuthenticated = true;
    render(RouterConGuarda(<PrivateRoute />));
    expect(screen.getByText('contenido-privado')).toBeInTheDocument();
    expect(screen.queryByText('pantalla-login')).toBeNull();
  });
});

describe('RoleRoute', () => {
  const conRuta = (allowed: Array<'cliente' | 'administrador' | 'tecnico'>) =>
    RouterConGuarda(<RoleRoute allowed={allowed} />);

  it('mientras carga no redirige', () => {
    estado.loading = true;
    render(conRuta(['cliente']));
    expect(screen.getByText('Cargando...')).toBeInTheDocument();
    expect(screen.queryByText('pantalla-login')).toBeNull();
  });

  it('sin sesión va a /login', () => {
    render(conRuta(['cliente']));
    expect(screen.getByText('pantalla-login')).toBeInTheDocument();
  });

  it('rol permitido entra al outlet', () => {
    estado.isAuthenticated = true;
    estado.rol = 'cliente';
    render(conRuta(['cliente']));
    expect(screen.getByText('contenido-privado')).toBeInTheDocument();
  });

  it('normaliza "admin" a "administrador"', () => {
    estado.isAuthenticated = true;
    estado.rol = 'admin';
    render(conRuta(['administrador']));
    expect(screen.getByText('contenido-privado')).toBeInTheDocument();
  });

  it('rol distinto redirige al panel de su rol', () => {
    estado.isAuthenticated = true;
    estado.rol = 'tecnico';
    render(conRuta(['administrador']));
    expect(screen.getByText('area-tecnico')).toBeInTheDocument();
    expect(screen.queryByText('contenido-privado')).toBeNull();
  });

  it('un rol desconocido cae al área de clientes', () => {
    estado.isAuthenticated = true;
    estado.rol = 'invitado';
    render(conRuta(['cliente']));
    expect(screen.getByText('area-productos')).toBeInTheDocument();
  });
});
