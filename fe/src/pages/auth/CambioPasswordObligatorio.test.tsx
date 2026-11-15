// Semana 8 del bootcamp — cambio obligatorio de contraseña.
// Cubre validaciones del hook, éxito por rol, error del backend y cierre de
// sesión. Autenticación, red y rutas simuladas.
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock, authMock } = vi.hoisted(() => ({
  apiMock: { post: vi.fn() },
  authMock: {
    rol: 'administrador',
    logout: vi.fn(),
    setPasswordResetRequired: vi.fn(),
  },
}));
vi.mock('@services/api', () => ({ default: apiMock }));
vi.mock('@contexts/AuthContext', () => ({ useAuth: () => authMock }));

import CambioPasswordObligatorio from './CambioPasswordObligatorio';

const TEMPORAL = 'Temporal1!';
const NUEVA = 'NuevaClave2!';

function montar() {
  return render(
    <MemoryRouter initialEntries={['/cambiar']}>
      <IdiomaProvider>
        <Routes>
          <Route path="/cambiar" element={<CambioPasswordObligatorio />} />
          <Route path="/dashboard/admin" element={<div>Panel administrador</div>} />
          <Route path="/dashboard/tecnico" element={<div>Panel técnico</div>} />
        </Routes>
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

async function llenar(actual = TEMPORAL, nueva = NUEVA, confirmar = NUEVA) {
  const usuario = userEvent.setup();
  await usuario.type(
    screen.getByPlaceholderText('Contraseña temporal (la que te dio el administrador)'),
    actual,
  );
  await usuario.type(screen.getByPlaceholderText('Nueva contraseña'), nueva);
  await usuario.type(screen.getByPlaceholderText('Confirmar nueva contraseña'), confirmar);
  await usuario.click(screen.getByRole('button', { name: 'Cambiar contraseña' }));
  return usuario;
}

describe('CambioPasswordObligatorio', () => {
  beforeEach(() => {
    apiMock.post.mockReset();
    authMock.logout.mockReset();
    authMock.setPasswordResetRequired.mockReset();
    authMock.rol = 'administrador';
  });

  it('muestra el aviso, los tres campos y el cierre de sesión', () => {
    // Act
    montar();

    // Assert
    expect(screen.getByRole('heading', { name: /Debes cambiar tu contraseña/i })).toBeTruthy();
    expect(screen.getByPlaceholderText(/Contraseña temporal/i)).toBeTruthy();
    expect(screen.getByPlaceholderText('Nueva contraseña')).toBeTruthy();
    expect(screen.getByPlaceholderText('Confirmar nueva contraseña')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeTruthy();
  });

  it('rechaza contraseñas nuevas distintas', async () => {
    // Arrange
    montar();

    // Act
    await llenar(TEMPORAL, NUEVA, 'OtraClave3!');

    // Assert
    expect(screen.getByText('Las nuevas contraseñas no coinciden')).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('rechaza una contraseña que no cumple los requisitos', async () => {
    // Arrange
    montar();

    // Act
    await llenar(TEMPORAL, 'corta', 'corta');

    // Assert
    expect(screen.getByText(/al menos 8 caracteres/i)).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('rechaza reutilizar la contraseña temporal', async () => {
    // Arrange
    montar();

    // Act
    await llenar(TEMPORAL, TEMPORAL, TEMPORAL);

    // Assert
    expect(screen.getByText(/diferente a la actual/i)).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('guarda la nueva contraseña y lleva al panel del administrador', async () => {
    // Arrange
    apiMock.post.mockResolvedValue({ data: {} });
    montar();

    // Act
    await llenar();

    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/auth/change-password', {
        current_password: TEMPORAL,
        new_password: NUEVA,
      }),
    );
    expect(await screen.findByText('Panel administrador')).toBeTruthy();
    expect(authMock.setPasswordResetRequired).toHaveBeenCalledWith(false);
  });

  it('un técnico es redirigido a su propio panel', async () => {
    // Arrange
    authMock.rol = 'tecnico';
    apiMock.post.mockResolvedValue({ data: {} });
    montar();

    // Act
    await llenar();

    // Assert
    expect(await screen.findByText('Panel técnico')).toBeTruthy();
  });

  it('muestra el detalle del backend si el cambio falla', async () => {
    // Arrange
    apiMock.post.mockRejectedValue({
      response: { data: { detail: 'La contraseña temporal expiró' } },
    });
    montar();

    // Act
    await llenar();

    // Assert
    expect(await screen.findByText('La contraseña temporal expiró')).toBeTruthy();
    expect(authMock.setPasswordResetRequired).not.toHaveBeenCalled();
  });

  it('cerrar sesión delega en el contexto de autenticación', async () => {
    // Arrange
    montar();

    // Act
    await userEvent.setup().click(screen.getByRole('button', { name: 'Cerrar sesión' }));

    // Assert
    expect(authMock.logout).toHaveBeenCalledTimes(1);
  });
});