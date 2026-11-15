// Semana 5 del bootcamp — AdminInstalaciones (gestión de citas y tarifas).
// Cubre la carga de citas/técnicos/tarifas/historial, tarjetas de cita,
// filtros, edición de tarifas, cambio de estado, reasignación, comisiones,
// cancelación con reembolso y aplazamiento sugerido. Red simulada.
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { apiMock } = vi.hoisted(() => ({
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
}));

vi.mock('@services/api', () => ({ default: apiMock }));

import AdminInstalaciones from './AdminInstalaciones';

const CITA_PENDIENTE = {
  id_cita: 1,
  cliente_nombre: 'Carolina Méndez',
  cliente_email: 'carolina@example.com',
  tipo_servicio: 'instalacion',
  fecha: '2026-11-16',
  hora: '09:00',
  estado: 'Pendiente',
  id_tecnico: null,
  nombre_tecnico: null,
  direccion: 'Calle 100 # 20-30',
  descripcion: 'Instalar dos cámaras',
  costo_cita: 120000,
  estado_pago: 'aprobado',
  comision_porcentaje: null,
  comision_valor: null,
  metodo_pago: 'tarjeta_credito',
  numero_transaccion: 'TX-0001',
  id_tecnico_2: null,
  id_tecnico_3: null,
  nombre_tecnico_2: null,
  nombre_tecnico_3: null,
};

const CITA_CONFIRMADA = {
  ...CITA_PENDIENTE,
  id_cita: 2,
  cliente_nombre: 'Luis Pérez',
  cliente_email: 'luis@example.com',
  descripcion: 'Mantenimiento de ascensor',
  tipo_servicio: 'mantenimiento',
  fecha: '2026-11-17',
  hora: '11:00',
  estado: 'Confirmada',
  id_tecnico: 1,
  nombre_tecnico: 'Andrés Técnico',
  costo_cita: 80000,
  estado_pago: 'pendiente',
  comision_porcentaje: 10,
  comision_valor: 8000,
  metodo_pago: null,
  numero_transaccion: null,
};

const CITA_INACTIVA = {
  ...CITA_PENDIENTE,
  id_cita: 3,
  cliente_nombre: 'Mario Ruiz',
  cliente_email: 'mario@example.com',
  descripcion: 'Revisión de cerraduras',
  estado: 'Confirmada',
  id_tecnico: 3,
  nombre_tecnico: 'Técnico Retirado',
  costo_cita: 90000,
  estado_pago: 'pagado',
  metodo_pago: null,
  numero_transaccion: null,
};

const CITA_FINALIZADA = {
  ...CITA_PENDIENTE,
  id_cita: 4,
  cliente_nombre: 'Ana Torres',
  cliente_email: 'ana@example.com',
  descripcion: 'Reparación de interfono',
  estado: 'Finalizada',
  id_tecnico: 1,
  nombre_tecnico: 'Andrés Técnico',
  costo_cita: 60000,
  estado_pago: 'pagado',
  metodo_pago: null,
  numero_transaccion: null,
};

const CITA_CANCELADA = {
  ...CITA_PENDIENTE,
  id_cita: 5,
  cliente_nombre: 'Cancelado Cliente',
  descripcion: 'Servicio cancelado',
  estado: 'Cancelada',
};

const TECNICOS = [
  { id_tecnico: 1, id_usuario: 10, first_name: 'Andrés', last_name: 'Técnico', is_active: true },
  { id_tecnico: 2, id_usuario: 11, first_name: 'Beto', last_name: 'Campo', is_active: true },
  { id_tecnico: 3, id_usuario: 12, first_name: 'Técnico', last_name: 'Retirado', is_active: false },
];

const TARIFAS = [
  { tipo_servicio: 'instalacion', costo: 120000 },
  { tipo_servicio: 'mantenimiento', costo: 80000 },
];

const HISTORIAL = [
  {
    id_historial: 1,
    id_cita: 90,
    accion: 'cancelacion',
    fecha_cita: '2026-11-05',
    hora_cita: '08:00',
    tipo_servicio: 'instalacion',
    estado_cita: 'Cancelada',
    cliente_nombre: 'Cliente Histórico',
    tecnico_anterior_nombre: 'Andrés Técnico',
    tecnico_nuevo_nombre: null,
    motivo: 'Solicitud del cliente',
    detalle: null,
    created_at: '2026-11-04T12:00:00',
    reembolso: { id_reembolso: 1, monto: 120000, estado: 'Pendiente', numero_transaccion_reembolso: null },
  },
];

function montar() {
  return render(
    <MemoryRouter>
      <IdiomaProvider>
        <AdminInstalaciones />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function responder(citas: any[] = [CITA_PENDIENTE, CITA_CONFIRMADA, CITA_INACTIVA, CITA_FINALIZADA, CITA_CANCELADA]) {
  apiMock.get.mockImplementation(async (url: string) => {
    if (url === '/citas/all-admin') return { data: citas };
    if (url === '/tecnicos') return { data: TECNICOS };
    if (url === '/tarifas') return { data: TARIFAS };
    if (url === '/citas/admin/reasignaciones-historial') return { data: HISTORIAL };
    if (url.includes('/tecnicos-disponibles')) {
      return {
        data: [
          { id_tecnico: 1, id_usuario: 10, nombre: 'ANDRÉS TÉCNICO', cubre_especializacion: true },
          { id_tecnico: 2, id_usuario: 11, nombre: 'BETO CAMPO', cubre_especializacion: true },
        ],
      };
    }
    if (url.includes('/proxima-fecha')) {
      return { data: { fecha: '2026-12-01', hora: '10:00', id_tecnico: 2, nombre_tecnico: 'Beto Campo' } };
    }
    if (url.includes('/horas-disponibles')) return { data: ['09:00', '10:00'] };
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

function tarjetaDe(nombre: string): HTMLElement {
  return screen.getByText(nombre).closest('.ap-grid-item') as HTMLElement;
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  apiMock.put.mockImplementation(async (url: string, body: any) => {
    if (url.startsWith('/tarifas/')) {
      return { data: { tipo_servicio: url.split('/').pop(), costo: body.costo } };
    }
    const id = Number(url.split('/').pop());
    const original = [CITA_PENDIENTE, CITA_CONFIRMADA, CITA_INACTIVA, CITA_FINALIZADA].find(
      (c) => c.id_cita === id,
    );
    return { data: { ...(original || CITA_PENDIENTE), ...body } };
  });
  apiMock.post.mockImplementation(async (url: string, body: any) => {
    if (url.includes('/reasignar')) {
      const id = Number(url.split('/')[4]);
      const original = [CITA_PENDIENTE, CITA_CONFIRMADA, CITA_INACTIVA, CITA_FINALIZADA].find(
        (c) => c.id_cita === id,
      );
      return { data: { ...(original || CITA_PENDIENTE), ...body } };
    }
    return { data: {} };
  });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('AdminInstalaciones — carga y tarjetas', () => {
  it('muestra tarifas, historial y las citas no canceladas con sus datos', async () => {
    // Arrange
    responder();
    montar();
    // Assert
    expect(await screen.findByText('Carolina Méndez')).toBeTruthy();
    expect(screen.getByText(/5 citas agendadas por los clientes/)).toBeTruthy();
    // Tarifas.
    expect(screen.getByText('Tarifas de servicio')).toBeTruthy();
    expect(screen.getAllByText(/120.000/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/80.000/).length).toBeGreaterThan(0);
    // Historial con reembolso.
    expect(screen.getByText('Citas canceladas por administrador')).toBeTruthy();
    expect(screen.getByText(/Cliente Histórico/)).toBeTruthy();
    expect(screen.getByText(/120.000 · Pendiente/)).toBeTruthy();
    // Citas: la cancelada no aparece.
    expect(screen.getByText('Luis Pérez')).toBeTruthy();
    expect(screen.getByText('Mario Ruiz')).toBeTruthy();
    expect(screen.getByText('Ana Torres')).toBeTruthy();
    expect(screen.queryByText('Cancelado Cliente')).toBeNull();
    // Datos de la cita pendiente.
    expect(screen.getByText('Pendiente de asignación')).toBeTruthy();
    expect(screen.getByText('Aprobado')).toBeTruthy();
    expect(screen.getByText('tarjeta credito')).toBeTruthy();
    expect(screen.getByText('TX-0001')).toBeTruthy();
    expect(screen.getByText('Instalar dos cámaras')).toBeTruthy();
    // Comisión y aviso de técnico inhabilitado.
    expect(screen.getAllByText(/10%/).length).toBeGreaterThan(0);
    expect(screen.getByText('Técnico inhabilitado')).toBeTruthy();
    expect(screen.getAllByText(/Técnico Retirado/).length).toBeGreaterThan(0);
  });

  it('sin citas muestra el estado vacío', async () => {
    // Arrange
    responder([]);
    montar();
    // Assert
    expect(await screen.findByText('No hay citas registradas')).toBeTruthy();
    expect(screen.getByText(/Cuando los clientes agenden una instalación/)).toBeTruthy();
  });

  it('un error de carga muestra el mensaje y permite reintentar', async () => {
    // Arrange: primer intento caído, reintento correcto.
    apiMock.get.mockRejectedValueOnce(new Error('down')).mockImplementation(async (url: string) => {
      if (url === '/citas/all-admin') return { data: [CITA_PENDIENTE] };
      if (url === '/tecnicos') return { data: TECNICOS };
      if (url === '/tarifas') return { data: TARIFAS };
      if (url === '/citas/admin/reasignaciones-historial') return { data: [] };
      return { data: [] };
    });
    const usuario = userEvent.setup();
    montar();
    // Act
    await usuario.click(await screen.findByRole('button', { name: /Reintentar/ }));
    // Assert
    expect(await screen.findByText('Carolina Méndez')).toBeTruthy();
  });
});

describe('AdminInstalaciones — filtros y tarifas', () => {
  it('filtra por estado y por búsqueda', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Méndez');
    // Act: píldora Pendiente.
    await usuario.click(screen.getByRole('button', { name: /^Pendiente/ }));
    // Assert
    expect(screen.getByText('Carolina Méndez')).toBeTruthy();
    expect(screen.queryByText('Luis Pérez')).toBeNull();
    // Act: píldora Todas y búsqueda por cliente.
    await usuario.click(screen.getByRole('button', { name: /^Todas/ }));
    await usuario.type(screen.getByPlaceholderText('Buscar cita...'), 'luis');
    // Assert
    expect(screen.getByText('Luis Pérez')).toBeTruthy();
    expect(screen.queryByText('Carolina Méndez')).toBeNull();
    // Act: búsqueda sin coincidencias.
    await usuario.clear(screen.getByPlaceholderText('Buscar cita...'));
    await usuario.type(screen.getByPlaceholderText('Buscar cita...'), 'zzz');
    // Assert
    expect(await screen.findByText('Sin resultados')).toBeTruthy();
    expect(screen.getByText(/No hay citas que coincidan/)).toBeTruthy();
  });

  it('edita una tarifa y muestra la confirmación', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Tarifas de servicio');
    // Act: editar la primera tarifa (instalación).
    await usuario.click(screen.getAllByRole('button', { name: 'Editar' })[0]);
    const input = screen.getByDisplayValue('120000');
    await usuario.clear(input);
    await usuario.type(input, '150000');
    await usuario.click(screen.getByRole('button', { name: 'Guardar' }));
    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/tarifas/instalacion', { costo: 150000 }),
    );
    expect(await screen.findByText(/Tarifa actualizada correctamente/)).toBeTruthy();
  });
});

describe('AdminInstalaciones — acciones sobre la cita', () => {
  it('cambia el estado desde el selector y actualiza la tarjeta', async () => {
    // Arrange
    responder();
    montar();
    await screen.findByText('Carolina Méndez');
    const tarjeta = tarjetaDe('Carolina Méndez');
    const estado = tarjeta.querySelectorAll('select')[0] as HTMLSelectElement;
    // Act
    fireEvent.change(estado, { target: { value: 'Confirmada' } });
    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/citas/admin/1', { estado: 'Confirmada' }),
    );
  });

  it('reasigna la cita a otro técnico y notifica', async () => {
    // Arrange
    responder();
    montar();
    await screen.findByText('Carolina Méndez');
    const tarjeta = tarjetaDe('Carolina Méndez');
    const tecnico = tarjeta.querySelectorAll('select')[1] as HTMLSelectElement;
    // Act
    fireEvent.change(tecnico, { target: { value: '2' } });
    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/citas/admin/1/reasignar', { id_tecnico: 2 }),
    );
    expect(await screen.findByText(/Cita reasignada correctamente/)).toBeTruthy();
  });

  it('aplica y retira la comisión de una cita', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Luis Pérez');
    const tarjeta = tarjetaDe('Luis Pérez');
    // Act: cambiar el porcentaje.
    await usuario.click(within(tarjeta).getByRole('button', { name: /Cambiar %/ }));
    const input = within(tarjeta).getByDisplayValue('10');
    await usuario.clear(input);
    await usuario.type(input, '15');
    await usuario.click(within(tarjeta).getByRole('button', { name: 'Aplicar' }));
    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/citas/admin/2', { comision_porcentaje: 15 }),
    );
    expect(await screen.findByText(/Comisión aplicada a la cita/)).toBeTruthy();
    // Act: retirar la comisión.
    await usuario.click(within(tarjetaDe('Luis Pérez')).getByRole('button', { name: 'Quitar' }));
    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/citas/admin/2', { id_comision_c: null }),
    );
    expect(await screen.findByText(/Comisión retirada de la cita/)).toBeTruthy();
  });

  it('cancela una cita tras confirmar el diálogo de reembolso', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Méndez');
    // Act: abrir el diálogo de la primera cita.
    await usuario.click(within(tarjetaDe('Carolina Méndez')).getByRole('button', { name: /Cancelar cita/ }));
    const dialogo = await screen.findByRole('dialog');
    // Assert: explica el reembolso.
    expect(within(dialogo).getByText(/Cancelar cita #1/)).toBeTruthy();
    expect(within(dialogo).getByText(/reembolso del 100%/)).toBeTruthy();
    // Act: confirmar.
    await usuario.click(within(dialogo).getByRole('button', { name: /Confirmar cancelación/ }));
    // Assert
    await waitFor(() =>
      expect(apiMock.put).toHaveBeenCalledWith('/citas/admin/1', { estado: 'Cancelada' }),
    );
    expect(await screen.findByText(/Cita #1 cancelada\. Reembolso del 100%/)).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('permite volver sin cancelar la cita', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Carolina Méndez');
    // Act
    await usuario.click(within(tarjetaDe('Carolina Méndez')).getByRole('button', { name: /Cancelar cita/ }));
    const dialogo = await screen.findByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: 'Volver' }));
    // Assert
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(apiMock.put).not.toHaveBeenCalledWith('/citas/admin/1', { estado: 'Cancelada' });
  });
});

describe('AdminInstalaciones — aplazamiento sugerido', () => {
  it('sugiere la próxima fecha, carga horarios y reasigna al confirmar', async () => {
    // Arrange
    responder();
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Mario Ruiz');
    // Act: aplazar la cita del técnico inhabilitado.
    await usuario.click(within(tarjetaDe('Mario Ruiz')).getByRole('button', { name: /Aplazar/ }));
    // Assert: sugerencia con fecha/hora del backend.
    expect(await screen.findByText('Aplazamiento sugerido')).toBeTruthy();
    await waitFor(() =>
      expect(apiMock.get).toHaveBeenCalledWith(
        expect.stringContaining('/citas/horas-disponibles?'),
      ),
    );
    expect(await screen.findByDisplayValue('2026-12-01')).toBeTruthy();
    // Act: confirmar.
    await usuario.click(screen.getByRole('button', { name: /Aplazar y reasignar/ }));
    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/citas/admin/3/reasignar', {
        id_tecnico: 2,
        fecha: '2026-12-01',
        hora: '10:00',
      }),
    );
    expect(await screen.findByText(/Cita reasignada correctamente/)).toBeTruthy();
  });

  it('si falla la búsqueda de fecha muestra el aviso', async () => {
    // Arrange
    responder();
    apiMock.get.mockImplementation(async (url: string) => {
      if (url === '/citas/all-admin') return { data: [CITA_INACTIVA] };
      if (url === '/tecnicos') return { data: TECNICOS };
      if (url === '/tarifas') return { data: TARIFAS };
      if (url === '/citas/admin/reasignaciones-historial') return { data: [] };
      if (url.includes('/tecnicos-disponibles')) return { data: [] };
      if (url.includes('/proxima-fecha')) throw { response: { data: { detail: 'Sin cupo' } } };
      return { data: [] };
    });
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Mario Ruiz');
    // Act
    await usuario.click(within(tarjetaDe('Mario Ruiz')).getByRole('button', { name: /Aplazar/ }));
    // Assert
    expect(await screen.findByText('Sin cupo')).toBeTruthy();
  });
});

describe('AdminInstalaciones — paginación', () => {
  it('pagina las citas de seis en seis', async () => {
    // Arrange
    const citas = Array.from({ length: 8 }, (_, i) => ({
      ...CITA_PENDIENTE,
      id_cita: 200 + i,
      cliente_nombre: `Cliente ${i + 1}`,
      fecha: `2026-11-${String(16 + i).padStart(2, '0')}`,
    }));
    responder(citas);
    const usuario = userEvent.setup();
    montar();
    await screen.findByText('Cliente 1');
    // Assert: primera página.
    expect(screen.getByText('Cliente 6')).toBeTruthy();
    expect(screen.queryByText('Cliente 7')).toBeNull();
    // Act
    await usuario.click(screen.getByRole('button', { name: /Siguiente/ }));
    // Assert
    expect(screen.getByText('Cliente 7')).toBeTruthy();
    expect(screen.queryByText('Cliente 1')).toBeNull();
    // Act: volver a la primera página.
    await usuario.click(screen.getByRole('button', { name: '1' }));
    // Assert
    expect(screen.getByText('Cliente 1')).toBeTruthy();
  });
});
