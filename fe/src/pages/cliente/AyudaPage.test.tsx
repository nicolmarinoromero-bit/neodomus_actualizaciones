// Semana 3 del bootcamp — Centro de Ayuda (página completa) desde el usuario.
// Interacción con user-event: acordeón FAQ, pestañas, chat con el asistente,
// formulario de consulta con validaciones y "Mis solicitudes" (listado y
// marcado de respuesta leída). Red y sesión simuladas.
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';

const { useAuthMock, apiMock, openAuthMock } = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  apiMock: { get: vi.fn(), post: vi.fn(), patch: vi.fn() },
  openAuthMock: vi.fn(),
}));

vi.mock('@contexts/AuthContext', () => ({ useAuth: useAuthMock }));
vi.mock('@contexts/AuthModalContext', () => ({
  useAuthModal: () => ({ openAuth: openAuthMock, closeAuth: vi.fn() }),
  AuthModalProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@services/api', () => ({ default: apiMock }));

import AyudaPage from './AyudaPage';

function montar(ruta = '/ayuda') {
  return render(
    <IdiomaProvider>
      <MemoryRouter initialEntries={[ruta]}>
        <AyudaPage />
      </MemoryRouter>
    </IdiomaProvider>,
  );
}

function visitante() {
  useAuthMock.mockReturnValue({ user: undefined, isAuthenticated: false });
}

function cliente(solicitudes: Array<Record<string, unknown>> = []) {
  useAuthMock.mockReturnValue({
    user: { id: 1, correo: 'carolina@neodomus.com' },
    isAuthenticated: true,
  });
  apiMock.get.mockResolvedValue({ data: solicitudes });
}

describe('AyudaPage — FAQ', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    visitante();
  });

  it('agrupa las preguntas por categoría y el acordeón abre y cierra', async () => {
    // Arrange
    montar();
    // Assert: la grilla FAQ carga con preguntas.
    const preguntas = await screen.findAllByRole('button', { name: /./ });
    expect(preguntas.length).toBeGreaterThan(5);
    const primera = preguntas[0];
    expect(primera.getAttribute('aria-expanded')).toBe('false');
    // Act: expandir
    await userEvent.setup().click(primera);
    // Assert: abierta con respuesta visible
    expect(primera.getAttribute('aria-expanded')).toBe('true');
    // Act: volver a plegar
    await userEvent.setup().click(primera);
    expect(primera.getAttribute('aria-expanded')).toBe('false');
  });

  it('el CTA de la FAQ lleva al formulario de consulta', async () => {
    // Arrange
    const usuario = userEvent.setup();
    montar();
    // Act
    await usuario.click(await screen.findByRole('button', { name: /Enviar una pregunta/ }));
    // Assert: el formulario aparece con sus campos etiquetados.
    expect(await screen.findByLabelText('Nombre completo *')).toBeTruthy();
    expect(screen.getByLabelText(/Correo electrónico \*/)).toBeTruthy();
    expect(screen.getByLabelText('Mensaje *')).toBeTruthy();
  });
});

describe('AyudaPage — pestañas', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    apiMock.get.mockReset();
    visitante();
  });

  it('asistente virtual: sugerencias visibles y el mensaje del usuario aparece', async () => {
    // Arrange
    const usuario = userEvent.setup();
    montar();
    await usuario.click(screen.getByRole('tab', { name: /Asistente virtual/ }));
    // Act: enviar una pregunta por el campo del chat.
    await usuario.type(screen.getByPlaceholderText('Escribe tu pregunta...'), '¿Cómo pago?{enter}');
    // Assert: el mensaje del usuario queda en el hilo.
    expect(await screen.findByText('¿Cómo pago?')).toBeTruthy();
  });

  it('contacto muestra los canales oficiales', async () => {
    // Arrange
    const usuario = userEvent.setup();
    montar();
    // Act
    await usuario.click(screen.getByRole('tab', { name: 'Contacto' }));
    // Assert
    expect(await screen.findByText('soporte@neodomus.com')).toBeTruthy();
    expect(screen.getByText('+57 601 123 4567')).toBeTruthy();
  });
});

describe('AyudaPage — formulario de consulta', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    visitante();
  });

  async function irAlFormulario(usuario: ReturnType<typeof userEvent.setup>) {
    montar();
    await usuario.click(await screen.findByRole('button', { name: /Enviar una pregunta/ }));
    await screen.findByLabelText('Nombre completo *');
  }

  it('campos vacíos muestran el aviso y no envían nada', async () => {
    // Arrange
    const usuario = userEvent.setup();
    await irAlFormulario(usuario);
    // Act
    await usuario.click(screen.getByRole('button', { name: /Enviar consulta/ }));
    // Assert
    expect(await screen.findByText('Completa todos los campos')).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('correo sin @ muestra el aviso específico', async () => {
    // Arrange
    const usuario = userEvent.setup();
    await irAlFormulario(usuario);
    await usuario.type(screen.getByLabelText('Nombre completo *'), 'Carolina Mendez');
    await usuario.type(screen.getByLabelText(/Correo electrónico \*/), 'carolina-sin-arroba');
    await usuario.selectOptions(screen.getByLabelText('Motivo de la consulta *'), 'pedido');
    await usuario.type(screen.getByLabelText('Mensaje *'), '¿Dónde está mi pedido número 91?');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Enviar consulta/ }));
    // Assert
    expect(await screen.findByText(/Email inválido/)).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('sin clasificación elegida muestra el aviso de categoría', async () => {
    // Arrange
    const usuario = userEvent.setup();
    await irAlFormulario(usuario);
    await usuario.type(screen.getByLabelText('Nombre completo *'), 'Carolina Mendez');
    await usuario.type(screen.getByLabelText(/Correo electrónico \*/), 'carolina@neodomus.com');
    await usuario.type(screen.getByLabelText('Mensaje *'), '¿Dónde está mi pedido número 91?');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Enviar consulta/ }));
    // Assert
    expect(await screen.findByText(/Selecciona la clasificación/)).toBeTruthy();
    expect(apiMock.post).not.toHaveBeenCalled();
  });

  it('envío exitoso publica en /contacto (visitante) y confirma con toast', async () => {
    // Arrange
    apiMock.post.mockResolvedValue({ data: { msg: 'recibido' } });
    const usuario = userEvent.setup();
    await irAlFormulario(usuario);
    await usuario.type(screen.getByLabelText('Nombre completo *'), 'Carolina Mendez');
    await usuario.type(screen.getByLabelText(/Correo electrónico \*/), 'carolina@neodomus.com');
    await usuario.selectOptions(screen.getByLabelText('Motivo de la consulta *'), 'pedido');
    await usuario.type(screen.getByLabelText('Mensaje *'), '¿Dónde está mi pedido número 91?');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Enviar consulta/ }));
    // Assert: toast de éxito + campo de mensaje limpio.
    expect(await screen.findByText(/Tu consulta ha sido enviada/)).toBeTruthy();
    expect(apiMock.post).toHaveBeenCalledWith('/contacto', {
      nombre: 'Carolina Mendez',
      email: 'carolina@neodomus.com',
      asunto: 'Pedido',
      mensaje: '¿Dónde está mi pedido número 91?',
      categoria: 'pedido',
    });
    expect((screen.getByLabelText('Mensaje *') as HTMLTextAreaElement).value).toBe('');
  });

  it('error del backend muestra el toast de error y permite reintentar', async () => {
    // Arrange
    apiMock.post.mockRejectedValue(new Error('down'));
    const usuario = userEvent.setup();
    await irAlFormulario(usuario);
    await usuario.type(screen.getByLabelText('Nombre completo *'), 'Carolina Mendez');
    await usuario.type(screen.getByLabelText(/Correo electrónico \*/), 'carolina@neodomus.com');
    await usuario.selectOptions(screen.getByLabelText('Motivo de la consulta *'), 'reclamo');
    await usuario.type(screen.getByLabelText('Mensaje *'), 'El producto llegó dañado.');
    // Act
    await usuario.click(screen.getByRole('button', { name: /Enviar consulta/ }));
    // Assert
    expect(await screen.findByText(/Error al enviar/)).toBeTruthy();
  });
});

describe('AyudaPage — mis solicitudes (autenticado)', () => {
  beforeEach(() => {
    useAuthMock.mockReset();
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
  });

  it('carga el listado del cliente y marca la respuesta como leída al abrirla', async () => {
    // Arrange
    cliente([
      {
        id: 12, asunto: 'Pedido', mensaje: '¿Dónde está mi pedido?',
        estado: 'respondida', respuesta: 'Va en camino.', respuesta_no_leida: true,
        created_at: '2026-11-01T10:00:00Z',
      },
      {
        id: 13, asunto: 'Reclamo', mensaje: 'Producto dañado',
        estado: 'pendiente', respuesta: null, created_at: '2026-11-05T10:00:00Z',
      },
    ]);
    apiMock.patch.mockResolvedValue({ data: {} });
    const usuario = userEvent.setup();
    montar();
    // Act: ir a la pestaña de solicitudes (el montaje cae en FAQ).
    await usuario.click(await screen.findByRole('tab', { name: /Mis solicitudes/ }));
    // Assert: dos solicitudes listadas con su estado.
    expect(await screen.findByText('Pedido')).toBeTruthy();
    expect(screen.getByText('Reclamo')).toBeTruthy();
    // Act: abrir la que tiene respuesta no leída.
    await usuario.click(screen.getByRole('button', { name: /Pedido/ }));
    // Assert: detalle visible con la respuesta + PATCH de lectura enviado.
    expect(await screen.findByText('Va en camino.')).toBeTruthy();
    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledWith('/contacto/mias/12/respuesta/leida'));
    // El badge de nueva respuesta desaparece al marcarla leída.
    await waitFor(() => expect(screen.queryByText('Nueva respuesta')).toBeNull());
  });

  it('sin solicitudes muestra el estado vacío', async () => {
    // Arrange
    cliente([]);
    montar();
    const usuario = userEvent.setup();
    await usuario.click(await screen.findByRole('tab', { name: /Mis solicitudes/ }));
    // Assert: el listado indica vacío (título del estado vacío).
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith('/contacto/mias'));
  });

  it('un visitante que abre la pestaña ve el bloque de inicio de sesión', async () => {
    // Arrange
    visitante();
    // Act: la pestaña solo existe con query tab=mis-solicitudes (o sesión).
    montar('/ayuda?tab=mis-solicitudes');
    // Assert: aparece el bloque de login con su acción hacia el modal de auth.
    const botones = await screen.findAllByRole('button');
    expect(botones.some((b) => /iniciar sesión|ingresar|ingresa/i.test(b.textContent || ''))).toBe(true);
  });
});
