import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@services/api';
import ServiciosTab from './ServiciosTab';

vi.mock('@i18n/IdiomaContext', () => ({
  useIdioma: () => ({
    idioma: 'es',
    t: (clave: string, params?: { n?: number }) =>
      params?.n !== undefined ? `${clave}.${params.n}` : clave,
  }),
}));

vi.mock('@services/api', () => ({
  default: { get: vi.fn(), post: vi.fn() },
}));

vi.mock('./SectionHeader', () => ({ default: () => null }));
vi.mock('@components/common/ModalPortal', () => ({
  default: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));
vi.mock('@components/common/LocalizedNotificationText', () => ({
  default: ({ message }: { message: string }) => <span>{message}</span>,
}));

const iso = (dias: number) => {
  const fecha = new Date();
  fecha.setDate(fecha.getDate() + dias);
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
};

const citaFinalizada = {
  id_cita: 11,
  estado: 'Finalizada',
  tipo_servicio: 'instalacion',
  fecha: iso(-20),
  hora: '09:00:00',
  direccion: 'Calle 10 # 5-20',
  id_tecnico: 4,
  nombre_tecnico: 'Carlos Pérez',
  tecnico_nombre: 'Carlos Pérez',
  tecnico_telefono: 3001112233,
  tecnico_certificacion: 'Redes y cámaras',
  tecnico_foto_url: '/fotos/carlos.png',
};

const citaConfirmada = {
  id_cita: 12,
  estado: 'Confirmada',
  tipo_servicio: 'reparacion',
  fecha: iso(15),
  hora: '14:00:00',
  direccion: 'Carrera 7 # 12-34',
  id_tecnico: null,
  nombre_tecnico: null,
  tecnico_nombre: null,
};

const citaCancelada = {
  id_cita: 13,
  estado: 'Cancelada',
  tipo_servicio: 'mantenimiento',
  fecha: iso(20),
  hora: '08:00:00',
  direccion: '',
  id_tecnico: null,
};

const citas = [citaFinalizada, citaConfirmada, citaCancelada];

const orden = (id: number) =>
  document.querySelectorAll('.pf-order')[id] as HTMLElement;

const expandir = (id: number) => {
  const fila = orden(id);
  fireEvent.click(within(fila).getByRole('button', { name: /perfil\.servicios\.rastrear/ }));
};

beforeEach(() => {
  vi.mocked(api.get).mockResolvedValue({ data: citas });
});

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.restoreAllMocks();
});

describe('ServiciosTab — listado', () => {
  it('carga los servicios y ordena primero los futuros', async () => {
    render(<ServiciosTab />);

    expect(await screen.findByText('#11')).toBeTruthy();
    expect(api.get).toHaveBeenCalledWith('/citas/mis-citas');

    const ids = Array.from(document.querySelectorAll('.pf-order-id')).map(
      (n) => n.textContent,
    );
    expect(ids).toEqual(['#12', '#13', '#11']);

    expect(screen.getByText(/citas\.reparacion/)).toBeTruthy();
    expect(screen.getByText(/citas\.instalacion/)).toBeTruthy();
    expect(
      screen.getAllByRole('button', { name: /perfil\.servicios\.rastrear/ }),
    ).toHaveLength(3);
    expect(screen.getAllByText('Finalizada').length).toBe(1);
    expect(screen.getAllByText('Cancelada').length).toBe(1);
  });

  it('muestra el estado vacío si no hay servicios', async () => {
    vi.mocked(api.get).mockResolvedValue({ data: [] });

    render(<ServiciosTab />);

    expect(await screen.findByText('perfil.servicios.vacio')).toBeTruthy();
  });

  it('tolera respuestas que no son arreglos y registra el error', async () => {
    const error = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    vi.mocked(api.get).mockResolvedValue({ data: null });

    render(<ServiciosTab />);

    expect(await screen.findByText('perfil.servicios.vacio')).toBeTruthy();
    expect(error).not.toHaveBeenCalled();

    cleanup();
    vi.mocked(api.get).mockRejectedValue(new Error('down'));
    render(<ServiciosTab />);
    expect(await screen.findByText('perfil.servicios.vacio')).toBeTruthy();
    expect(error).toHaveBeenCalledWith('Error cargando servicios:', expect.any(Error));
  });
});

describe('ServiciosTab — detalle y rastreo', () => {
  it('expande una cita finalizada con técnico y pasos completados', async () => {
    render(<ServiciosTab />);
    await screen.findByText('#11');

    expandir(2);

    expect(screen.getByText('perfil.servicios.detalle')).toBeTruthy();
    expect(screen.getByText('Calle 10 # 5-20')).toBeTruthy();
    expect(screen.getByText('perfil.servicios.rastreoServicio')).toBeTruthy();
    expect(screen.getByText('perfil.servicios.paso.solicitud')).toBeTruthy();
    expect(screen.getByText('perfil.servicios.paso.realizado')).toBeTruthy();
    expect(document.querySelectorAll('.pf-tracker-paso.done')).toHaveLength(4);
    expect(screen.getAllByText('Carlos Pérez').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Redes y cámaras')).toBeTruthy();
    expect(screen.getByText('3001112233')).toBeTruthy();
    expect(screen.getByAltText('Carlos Pérez')).toHaveProperty(
      'src',
      expect.stringContaining('/fotos/carlos.png'),
    );
    expect(
      screen.getByRole('button', { name: /perfil\.servicios\.ocultarRastreo/ }),
    ).toHaveProperty('ariaExpanded', 'true');

    fireEvent.click(
      screen.getByRole('button', { name: /perfil\.servicios\.ocultarRastreo/ }),
    );
    expect(screen.queryByText('perfil.servicios.detalle')).toBeNull();
  });

  it('muestra el aviso de técnico por asignar y los pasos pendientes', async () => {
    render(<ServiciosTab />);
    await screen.findByText('#11');

    expandir(0);

    expect(screen.getByText('perfil.servicios.sinTecnico')).toBeTruthy();
    expect(document.querySelectorAll('.pf-tracker-paso.done')).toHaveLength(2);
    expect(screen.getByText('perfil.servicios.paso.tecnico')).toBeTruthy();
    expect(screen.getByText('perfil.servicios.paso.confirmada')).toBeTruthy();
  });

  it('informa la cancelación y no muestra el rastreo', async () => {
    render(<ServiciosTab />);
    await screen.findByText('#11');

    expandir(1);

    expect(screen.getByText('perfil.servicios.citaCancelada')).toBeTruthy();
    expect(screen.queryByText('perfil.servicios.rastreoServicio')).toBeNull();
    expect(screen.getByText('—')).toBeTruthy();
  });
});

describe('ServiciosTab — calificación', () => {
  it('califica una cita finalizada con estrellas y comentario', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } });
    render(<ServiciosTab />);
    await screen.findByText('#11');
    expandir(2);

    fireEvent.click(
      screen.getByRole('button', { name: /perfil\.servicios\.calificarTecnico/ }),
    );

    const dialogo = screen.getByRole('dialog');
    expect(within(dialogo).getByText('perfil.servicios.modalTitulo')).toBeTruthy();
    expect(
      within(dialogo).getByText(/perfil\.servicios\.calificacionTecnico|Carlos Pérez/),
    ).toBeTruthy();

    const enviar = within(dialogo).getByRole('button', {
      name: /perfil\.servicios\.enviarCalificacion/,
    });
    expect(enviar).toHaveProperty('disabled', true);

    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'perfil.servicios.estrellas.5' }),
    );
    expect(within(dialogo).getByText('perfil.servicios.rating.excelente')).toBeTruthy();

    fireEvent.change(
      within(dialogo).getByPlaceholderText('perfil.servicios.comentarioPlaceholder'),
      { target: { value: '  Excelente servicio  ' } },
    );
    fireEvent.click(
      within(dialogo).getByRole('button', {
        name: /perfil\.servicios\.enviarCalificacion/,
      }),
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/calificaciones', {
        id_cita: 11,
        calificacion: 5,
        comentario: 'Excelente servicio',
      }),
    );
    expect(await screen.findByText('perfil.servicios.graciasCalificacion')).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(
        screen.queryByRole('button', {
          name: /perfil\.servicios\.calificarTecnico/,
        }),
      ).toBeNull(),
    );
  });

  it('omite el comentario vacío y permite cerrar el modal', async () => {
    vi.mocked(api.post).mockResolvedValue({ data: { ok: true } });
    render(<ServiciosTab />);
    await screen.findByText('#11');
    expandir(2);

    // Abrir, elegir estrellas y cerrar con la X sin enviar.
    fireEvent.click(
      screen.getByRole('button', { name: /perfil\.servicios\.calificarTecnico/ }),
    );
    let dialogo = screen.getByRole('dialog');
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'perfil.servicios.estrellas.4' }),
    );
    expect(within(dialogo).getByText('perfil.servicios.rating.muyBueno')).toBeTruthy();
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'common.cerrar' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(api.post).not.toHaveBeenCalled();

    // Abrir de nuevo y enviar sin comentario.
    fireEvent.click(
      screen.getByRole('button', { name: /perfil\.servicios\.calificarTecnico/ }),
    );
    dialogo = screen.getByRole('dialog');
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'perfil.servicios.estrellas.4' }),
    );
    fireEvent.click(
      within(dialogo).getByRole('button', {
        name: /perfil\.servicios\.enviarCalificacion/,
      }),
    );

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/calificaciones', {
        id_cita: 11,
        calificacion: 4,
        comentario: undefined,
      }),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });

  it('muestra el detalle del backend si la calificación falla', async () => {
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { detail: 'Ya calificaste esta cita' } },
    });
    render(<ServiciosTab />);
    await screen.findByText('#11');
    expandir(2);

    fireEvent.click(
      screen.getByRole('button', { name: /perfil\.servicios\.calificarTecnico/ }),
    );
    const dialogo = screen.getByRole('dialog');
    fireEvent.click(
      within(dialogo).getByRole('button', { name: 'perfil.servicios.estrellas.3' }),
    );
    fireEvent.click(
      within(dialogo).getByRole('button', {
        name: /perfil\.servicios\.enviarCalificacion/,
      }),
    );

    expect(await screen.findByText('Ya calificaste esta cita')).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy();
  });
});