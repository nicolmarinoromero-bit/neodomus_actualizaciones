// Semana 3 del bootcamp — CitasPage (agendamiento de servicios, el flujo
// central del cliente). user-event real sobre el formulario de 3 pasos:
// técnico → servicio/fecha/hora → pago; más "Mis citas" (cancelación) e
// historial con calificación. Red y sesión simuladas.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { authMock, apiMock, openAuthMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  apiMock: { get: vi.fn(), post: vi.fn(), put: vi.fn(), delete: vi.fn() },
  openAuthMock: vi.fn(),
}));

vi.mock('@contexts/AuthContext', () => ({ useAuth: authMock }));
vi.mock('@contexts/AuthModalContext', () => ({
  useAuthModal: () => ({ openAuth: openAuthMock, closeAuth: vi.fn() }),
  AuthModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@services/api', () => ({
  default: apiMock,
  descargarFactura: vi.fn(),
}));

import CitasPage from './CitasPage';

// Forma cruda del endpoint /tecnicos/publicos (el componente la mapea).
const TECNICO = {
  id_tecnico: 5, first_name: 'Ana', last_name: 'Técnica', foto_url: null,
  certificacion_t: 'Instalación', calificacion: 5,
  disponible: true, is_active: true,
};

const CITA_FUTURA = {
  id_cita: 12, tipo_servicio: 'Instalación', estado: 'Confirmada',
  // La tarjeta debe seguir siendo futura sin depender del día de ejecución.
  fecha: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10),
  hora: '10:00', direccion: 'Calle 1',
  descripcion: 'Instalar sensor', estado_pago: 'aprobado', costo_cita: 60000,
  nombre_tecnico: 'Ana Técnica',
};

const CITA_FINALIZADA = {
  ...CITA_FUTURA, id_cita: 13, estado: 'Finalizada', fecha: '2026-11-01',
  calificada: false,
};

function montar(ruta = '/cliente/citas') {
  return render(
    <MemoryRouter initialEntries={[ruta]}>
      <IdiomaProvider>
        <CitasPage />
      </IdiomaProvider>
    </MemoryRouter>,
  );
}

function visitante() {
  authMock.mockReturnValue({ user: undefined, isAuthenticated: false, rol: undefined });
}

function cliente() {
  authMock.mockReturnValue({
    user: { id: 1, correo: 'carolina@neodomus.com' },
    isAuthenticated: true,
    rol: 'cliente',
  });
}

function redCompleta({ citas = [] as Array<Record<string, unknown>>, horas = ['08:00', '10:00', '14:00'] } = {}) {
  apiMock.get.mockImplementation(async (url: string, config?: { params?: unknown }) => {
    if (String(url) === '/pedidos/metodos-pago') {
      return { data: { bancos: ['Bancolombia', 'Banco de Bogotá'] } };
    }
    if (String(url) === '/clients/me') return { data: { address: 'Calle Perfil 123' } };
    if (String(url).startsWith('/tecnicos/publicos')) return { data: [TECNICO] };
    if (String(url).startsWith('/citas/horas-disponibles')) return { data: horas };
    if (String(url) === '/citas/mis-citas') return { data: citas };
    if (String(url) === '/citas/ofertas-pendientes') return { data: [] };
    if (String(url) === '/citas/tarifas' || String(url).startsWith('/tarifas')) return { data: [] };
    if (config?.params) return { data: [] }; // cualquier otra consulta parametrizada
    throw new Error(`Ruta inesperada: ${url}`);
  });
}

beforeEach(() => {
  apiMock.get.mockReset();
  apiMock.post.mockReset();
  apiMock.put.mockReset();
  apiMock.delete.mockReset();
  sessionStorage.clear();
  // Respuesta benigna por defecto: las pruebas que configuran rutas la
  // pisan con mockImplementation; sin esto, cualquier consulta que un test
  // no configure devuelve undefined y revienta con .then.
  apiMock.get.mockResolvedValue({ data: [] });
});

describe('CitasPage — agendar (paso a paso)', () => {
  it('sin sesión, enviar el formulario abre el modal de autenticación', async () => {
    // Arrange
    visitante();
    const usuario = userEvent.setup();
    montar();
    const boton = await screen.findByRole('button', { name: /Agendar cita/i });
    // Act
    await usuario.click(boton);
    // Assert: no navega ni crea nada; pide iniciar sesión.
    expect(openAuthMock).toHaveBeenCalledWith('ingresar');
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('sin técnico elegido, el envío avisa y no crea la cita', async () => {
    // Arrange
    cliente();
    redCompleta();
    const usuario = userEvent.setup();
    montar();
    const boton = await screen.findByRole('button', { name: /Agendar cita/i });
    // Act
    await usuario.click(boton);
    // Assert
    expect(await screen.findByText('Debes seleccionar un técnico primero')).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  // Acciones comunes: elegir técnico (menú) y fijar la fecha (dispara la
  // carga de horas del técnico elegido).
  async function elegirTecnico(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.click(screen.getByRole('button', { name: /Seleccionar técnico/ }));
    const lista = await screen.findByRole('listbox');
    await usuario.click(within(lista).getByRole('button', { name: 'Seleccionar' }));
    // El paso de servicio/fecha queda habilitado (deja de estar atenuado).
    await screen.findByText('Ana Técnica');
  }

  async function fijarFecha() {
    const { fireEvent } = await import('@testing-library/react');
    fireEvent.change(screen.getByLabelText(/Fecha de la cita/i), { target: { value: '2026-11-20' } });
    // Las horas del técnico cargan para esa fecha.
    await screen.findByRole('button', { name: '10:00' });
  }

  async function llenarServicio(usuario: ReturnType<typeof userEvent.setup>) {
    await usuario.selectOptions(screen.getByLabelText(/Tipo de servicio/i), 'instalacion');
    // La dirección llega pre-rellena con la del perfil: se limpia para
    // escribir una concreta y poder afirmar el payload exacto.
    const direccion = screen.getByLabelText(/Dirección del servicio/i);
    await usuario.clear(direccion);
    await usuario.type(direccion, 'Calle 1 #2-3');
    await usuario.type(screen.getByLabelText(/Descripción del servicio/i), 'Instalar sensor de puerta');
    await usuario.click(screen.getByRole('button', { name: '10:00' }));
  }

  it('elegir técnico habilita fecha/hora y carga sus horas disponibles', async () => {
    // Arrange
    cliente();
    redCompleta();
    const usuario = userEvent.setup();
    montar();
    // Act: abrir el selector de técnicos, confirmar a Ana y elegir fecha.
    await elegirTecnico(usuario);
    await fijarFecha();
    // Assert: las horas del técnico aparecen como opciones seleccionables y
    // se pidieron al backend con el técnico y la fecha.
    await waitFor(() => {
      const llamada = apiMock.get.mock.calls
        .map(([u]) => String(u))
        .find((u) => u.startsWith('/citas/horas-disponibles'));
      expect(llamada).toBeTruthy();
      expect(llamada).toContain('tecnico_id=5');
    });
    expect(screen.getByRole('button', { name: '10:00' })).toBeTruthy();
  });

  it('campos incompletos con técnico elegido muestran el aviso y no envían', async () => {
    // Arrange
    cliente();
    redCompleta();
    const usuario = userEvent.setup();
    montar();
    await elegirTecnico(usuario);
    await fijarFecha();
    // Act: enviar sin tipo/dirección/descripción.
    await usuario.click(screen.getByRole('button', { name: /Agendar cita/i }));
    // Assert
    expect(await screen.findByText('Completa todos los campos obligatorios')).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('sin método de pago muestra el aviso propio', async () => {
    // Arrange
    cliente();
    redCompleta();
    const usuario = userEvent.setup();
    montar();
    await elegirTecnico(usuario);
    await fijarFecha();
    await llenarServicio(usuario);
    // Act: sin método de pago elegido.
    await usuario.click(screen.getByRole('button', { name: /Agendar cita/i }));
    // Assert
    expect(await screen.findByText('Selecciona un método de pago')).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('punto de pago: crea la cita con el payload correcto', async () => {
    // Arrange
    cliente();
    redCompleta();
    apiMock.post.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await elegirTecnico(usuario);
    await fijarFecha();
    await llenarServicio(usuario);
    // Elegir punto de pago y confirmar.
    await usuario.click(screen.getByRole('button', { name: /Punto de pago/i }));
    const punto = screen.getAllByRole('combobox').find((el) =>
      Array.from((el as HTMLSelectElement).options).some((o) => o.value === 'Efecty'),
    ) as HTMLSelectElement;
    await usuario.selectOptions(punto, 'Efecty');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Agendar cita/i }));
    // Assert
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith('/citas', expect.objectContaining({
      id_tecnico: 5,
      nombre_tecnico: 'Ana Técnica',
      direccion: 'Calle 1 #2-3',
      metodo_pago: 'punto_pago',
      datos_pago: { punto_pago: 'Efecty' },
    })));
    expect(await screen.findByText('Cita agendada correctamente')).toBeTruthy();
  });
});

describe('CitasPage — mis citas', () => {
  it('lista las citas futuras y cancela con confirmación (DELETE)', async () => {
    // Arrange
    cliente();
    redCompleta({ citas: [CITA_FUTURA] });
    apiMock.delete.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole('tab', { name: /Mis citas/i }));
    // Assert: la cita aparece (tarjeta con la dirección y el estado).
    expect(await screen.findByText('Calle 1')).toBeTruthy();
    expect(screen.getByText('Confirmada')).toBeTruthy();
    // Act: cancelar (abre el modal con el desglose de reembolso) y confirmar.
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));
    const dialogo = await screen.findByRole('dialog');
    expect(within(dialogo).getByText(/Se reembolsa el 85%/i)).toBeTruthy();
    await usuario.click(within(dialogo).getByRole('button', { name: /Sí, cancelar cita/i }));
    // Assert
    await waitFor(() => expect(apiMock.delete).toHaveBeenCalledWith('/citas/12'));
  });
});

describe('CitasPage — historial y calificación', () => {
  it('las citas finalizadas van al historial y se pueden calificar', async () => {
    // Arrange
    cliente();
    redCompleta({ citas: [CITA_FINALIZADA] });
    apiMock.post.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    await usuario.click(await screen.findByRole('tab', { name: /Historial/i }));
    expect(await screen.findByText('Finalizada')).toBeTruthy();
    // Act: calificar.
    await usuario.click(screen.getByRole('button', { name: /Calificar técnico/i }));
    const dialogo = await screen.findByRole('dialog');
    await usuario.click(within(dialogo).getByRole('button', { name: '4 estrellas' }));
    await usuario.type(within(dialogo).getByPlaceholderText('Comentario (opcional)...'), 'Excelente trabajo');
    await usuario.click(within(dialogo).getByRole('button', { name: /Enviar calificación/i }));
    // Assert
    await waitFor(() =>
      expect(apiMock.post).toHaveBeenCalledWith('/calificaciones', expect.objectContaining({
        id_cita: 13,
        calificacion: 4,
        comentario: 'Excelente trabajo',
      })),
    );
  });
});
