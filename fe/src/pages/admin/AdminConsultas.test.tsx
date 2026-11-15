// Semana 3 del bootcamp — panel admin de consultas/solicitudes de cuenta.
// Interacción con user-event: aprobar/rechazar solicitudes de clientes y
// técnicos, habilitar cuentas inhabilitadas y responder consultas de ayuda
// (incluido el filtro por estado). Red simulada.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({ apiMock: { get: vi.fn(), put: vi.fn(), post: vi.fn() } }));
vi.mock('@services/api', () => ({ default: apiMock }));

import AdminConsultas from './AdminConsultas';

const SOLICITUD_CLIENTE = {
  id: 21, tipo: 'inhabilitacion', estado: 'pendiente',
  cliente_nombre: 'Carolina Mendez', cliente_email: 'carolina@neodomus.com',
  motivo: 'Cancelé mi pedido dos veces', created_at: '2026-11-01T10:00:00Z',
};
const SOLICITUD_EMPLEADO = {
  id: 8, estado: 'pendiente', empleado_nombre: 'Ana Técnica',
  empleado_email: 'ana@neodomus.com', created_at: '2026-11-02T10:00:00Z',
};
const SOLICITUD_AYUDA = {
  id: 33, categoria: 'pedido', estado: 'pendiente', nombre: 'Luis Pérez',
  email: 'luis@neodomus.com', mensaje: '¿Dónde está mi pedido 91?', created_at: '2026-11-03T10:00:00Z',
};
const CLIENTE_INHABILITADO = {
  id_cliente: 5, first_name: 'Luis', last_name: 'Pérez', email: 'luis@neodomus.com', is_active: false,
};
const TECNICO_INHABILITADO = {
  id: 9, id_usuario: 309, first_name: 'Marta', last_name: 'Técnica', email: 'marta@neodomus.com', is_active: false,
};

function montar(ruta = '/admin/consultas') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <IdiomaProvider>
        <AdminConsultas />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function datosCompletos() {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/admin/account-requests') return { data: [SOLICITUD_CLIENTE] };
    if (url === '/admin/account-requests/empleados') return { data: [SOLICITUD_EMPLEADO] };
    if (url === '/admin/consultas') return { data: [SOLICITUD_AYUDA] };
    if (url === '/clients') return { data: [CLIENTE_INHABILITADO] };
    if (url === '/tecnicos') return { data: [TECNICO_INHABILITADO] };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.put.mockReset();
  apiMock.post.mockReset();
});

describe('AdminConsultas — solicitudes de cuenta', () => {
  it('combina y lista solicitudes de clientes y técnicos pendientes', async () => {
    // Arrange
    datosCompletos();
    montar();
    // Assert: ambas solicitudes visibles con su tipo.
    expect(await screen.findByText('Carolina Mendez')).toBeTruthy();
    expect(screen.getByText('Ana Técnica')).toBeTruthy();
    expect(screen.getAllByText(/Inhabilitación de cuenta/).length).toBeGreaterThan(0);
    expect(screen.getByText(/Habilitación de técnico/i)).toBeTruthy();
  });

  it('aprobar una solicitud de cliente llama al endpoint correcto y avisa', async () => {
    // Arrange
    datosCompletos();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    // Act: aprobar en la tarjeta de la cliente.
    const tarjeta = screen.getByText('Carolina Mendez').closest('article')!;
    await usuario.click(within(tarjeta).getByRole('button', { name: /Aprobar/i }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/admin/account-requests/21/aprobar'));
    expect(await screen.findByText(/aprobada|aprobada correctamente/i)).toBeTruthy();
  });

  it('rechazar una solicitud de técnico llama al endpoint de empleados', async () => {
    // Arrange
    datosCompletos();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Ana Técnica');
    // Act
    const tarjeta = screen.getByText('Ana Técnica').closest('article')!;
    await usuario.click(within(tarjeta).getByRole('button', { name: /Rechazar/i }));
    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/admin/account-requests/empleados/8/rechazar'),
    );
  });

  it('un error del backend muestra el detalle en el toast y permite reintentar', async () => {
    // Arrange
    datosCompletos();
    apiMock.put.mockRejectedValue({ response: { data: { detail: 'La solicitud ya fue procesada' } } });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Mendez');
    // Act
    const tarjeta = screen.getByText('Carolina Mendez').closest('article')!;
    await usuario.click(within(tarjeta).getByRole('button', { name: /Aprobar/i }));
    // Assert
    expect(await screen.findByText('La solicitud ya fue procesada')).toBeTruthy();
  });
});

describe('AdminConsultas — cuentas inhabilitadas', () => {
  it('lista inhabilitados y habilita a una cliente con su endpoint', async () => {
    // Arrange
    datosCompletos();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    // Ir a la vista de cuentas (pestaña "Cuentas inhabilitadas").
    await usuario.click(await screen.findByRole('tab', { name: /Cuentas inhabilitadas/ }));
    // Assert: los inhabilitados aparecen.
    expect(await screen.findByText('Luis Pérez')).toBeTruthy();
    expect(screen.getByText('Marta Técnica')).toBeTruthy();
    // Act: habilitar a Luis.
    const tarjeta = screen.getByText('Luis Pérez').closest('article')!;
    await usuario.click(within(tarjeta).getByRole('button', { name: /Habilitar cuenta/i }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/clients/5/habilitar'));
  });

  it('habilitar a un técnico envía is_active:true por /users', async () => {
    // Arrange
    datosCompletos();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole('tab', { name: /Cuentas inhabilitadas/ }));
    await screen.findByText('Marta Técnica');
    // Act
    const tarjeta = screen.getByText('Marta Técnica').closest('article')!;
    await usuario.click(within(tarjeta).getByRole('button', { name: /Habilitar cuenta/i }));
    // Assert
    await waitFor(() => expect(apiMock.put).toHaveBeenCalledWith('/users/309', { is_active: true }));
  });

  it('la búsqueda de cuentas filtra por nombre o correo', async () => {
    // Arrange
    datosCompletos();
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole('tab', { name: /Cuentas inhabilitadas/ }));
    await screen.findByText('Luis Pérez');
    // Act
    await usuario.type(screen.getByPlaceholderText('Buscar cuenta...'), 'luis@');
    // Assert: Marta desaparece del filtrado.
    await waitFor(() => expect(screen.queryByText('Marta Técnica')).toBeNull());
    expect(screen.getByText('Luis Pérez')).toBeTruthy();
  });
});

describe('AdminConsultas — consultas de ayuda', () => {
  it('lista las consultas y las marca resueltas con respuesta', async () => {
    // Arrange
    datosCompletos();
    apiMock.put.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole('tab', { name: /Ayuda y soporte/ }));
    // Assert: la consulta de ayuda visible con su mensaje.
    expect(await screen.findByText('¿Dónde está mi pedido 91?')).toBeTruthy();
    // Act: escribir respuesta y marcar resuelta.
    const tarjeta = screen.getByText('¿Dónde está mi pedido 91?').closest('article')!;
    const area = within(tarjeta as HTMLElement).getByPlaceholderText('Escribe una respuesta para el cliente...');
    await usuario.type(area, 'Tu pedido salió hoy.');
    await usuario.click(within(tarjeta as HTMLElement).getByRole('button', { name: /Marcar resuelta/i }));
    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/admin/consultas/33', {
        estado: 'resuelta',
        respuesta: 'Tu pedido salió hoy.',
      }),
    );
  });

  it('el filtro de estado de ayuda oculta las que no coinciden', async () => {
    // Arrange
    datosCompletos();
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/admin/consultas') {
        return {
          data: [
            SOLICITUD_AYUDA,
            { ...SOLICITUD_AYUDA, id: 34, estado: 'respondida', mensaje: 'Consulta ya resuelta' },
          ],
        };
      }
      if (url === '/admin/account-requests') return { data: [] };
      if (url === '/admin/account-requests/empleados') return { data: [] };
      if (url === '/clients') return { data: [] };
      if (url === '/tecnicos') return { data: [] };
      throw new Error(`Ruta inesperada: ${url}`);
    });
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole('tab', { name: /Ayuda y soporte/ }));
    await screen.findByText('¿Dónde está mi pedido 91?');
    // Act: filtrar solo pendientes.
    const filtro = screen.getAllByRole('combobox').find((el) =>
      Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'pendiente'),
    ) as HTMLSelectElement;
    await usuario.selectOptions(filtro, 'pendiente');
    // Assert: la resuelta se oculta.
    await waitFor(() => expect(screen.queryByText('Consulta ya resuelta')).toBeNull());
    expect(screen.getByText('¿Dónde está mi pedido 91?')).toBeTruthy();
  });
});
