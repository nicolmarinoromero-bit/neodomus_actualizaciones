import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import api from '@services/api';
import PasswordTab from './PasswordTab';

vi.mock('@i18n/IdiomaContext', () => ({
  useIdioma: () => ({ t: (clave: string) => clave }),
}));

vi.mock('@services/api', () => ({
  default: { post: vi.fn() },
}));

vi.mock('./SectionHeader', () => ({ default: () => null }));

const llenar = (
  actual: string,
  nueva: string,
  confirmar: string = nueva,
) => {
  fireEvent.change(screen.getByLabelText('perfil.contrasenaActual'), {
    target: { value: actual },
  });
  fireEvent.change(screen.getByLabelText('perfil.nuevaContrasena'), {
    target: { value: nueva },
  });
  fireEvent.change(screen.getByLabelText('perfil.confirmarNuevaContrasena'), {
    target: { value: confirmar },
  });
};

const botonEnviar = () =>
  screen.getByRole('button', { name: /perfil\.actualizarContrasena/ });

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe('PasswordTab — requisitos y validaciones', () => {
  it('evalúa en vivo los requisitos de la nueva contraseña', () => {
    render(<PasswordTab notify={vi.fn()} />);

    expect(screen.queryByText('perfil.reqTitulo')).toBeNull();

    fireEvent.change(screen.getByLabelText('perfil.nuevaContrasena'), {
      target: { value: 'abc' },
    });
    expect(screen.getByText('perfil.reqTitulo')).toBeTruthy();
    expect(document.querySelectorAll('.pf-pass-requirements li')).toHaveLength(5);
    expect(document.querySelectorAll('.pf-pass-requirements li.valid')).toHaveLength(1);

    fireEvent.change(screen.getByLabelText('perfil.nuevaContrasena'), {
      target: { value: 'Abcdef12!' },
    });
    expect(document.querySelectorAll('.pf-pass-requirements li.valid')).toHaveLength(5);
    expect(document.querySelectorAll('.pf-pass-requirements li.invalid')).toHaveLength(0);
  });

  it('bloquea copiar y pegar en los campos de contraseña', () => {
    render(<PasswordTab notify={vi.fn()} />);
    const input = screen.getByLabelText('perfil.contrasenaActual');

    expect(fireEvent.paste(input)).toBe(false);
    expect(fireEvent.copy(input)).toBe(false);
  });

  it('exige que la confirmación coincida y que la nueva sea distinta', () => {
    render(<PasswordTab notify={vi.fn()} />);

    llenar('Actual123!', 'Nueva123!', 'Otra123!');
    expect(screen.getByText('perfil.contrasenasNoCoinciden')).toBeTruthy();
    expect(botonEnviar()).toHaveProperty('disabled', true);

    llenar('Actual123!', 'Actual123!', 'Actual123!');
    expect(screen.queryByText('perfil.contrasenasNoCoinciden')).toBeNull();
    expect(botonEnviar()).toHaveProperty('disabled', true);

    llenar('Actual123!', 'Nueva123!');
    expect(botonEnviar()).toHaveProperty('disabled', false);
  });

  it('avisa si se envía sin cumplir los requisitos', () => {
    const notify = vi.fn();
    const { container } = render(<PasswordTab notify={notify} />);

    fireEvent.submit(container.querySelector('form') as HTMLFormElement);

    expect(notify).toHaveBeenCalledWith('perfil.validacionesContrasena', 'error');
    expect(api.post).not.toHaveBeenCalled();
  });

  it('muestra u oculta las tres contraseñas', () => {
    render(<PasswordTab notify={vi.fn()} />);
    const actual = screen.getByLabelText('perfil.contrasenaActual');
    expect(actual).toHaveProperty('type', 'password');

    fireEvent.click(
      screen.getByRole('button', { name: 'perfil.mostrarContrasena' }),
    );
    expect(actual).toHaveProperty('type', 'text');
    expect(screen.getByLabelText('perfil.nuevaContrasena')).toHaveProperty(
      'type',
      'text',
    );
    expect(
      screen.getByRole('button', { name: 'perfil.ocultarContrasena' }),
    ).toBeTruthy();
  });
});

describe('PasswordTab — envío', () => {
  beforeEach(() => {
    vi.mocked(api.post).mockResolvedValue({ data: { msg: 'ok' } });
  });

  it('cambia la contraseña, notifica y limpia el formulario', async () => {
    const notify = vi.fn();
    render(<PasswordTab notify={notify} />);

    llenar('Actual123!', 'Nueva123!');
    fireEvent.click(botonEnviar());

    await waitFor(() =>
      expect(api.post).toHaveBeenCalledWith('/auth/change-password', {
        current_password: 'Actual123!',
        new_password: 'Nueva123!',
      }),
    );
    expect(notify).toHaveBeenCalledWith('perfil.contrasenaActualizada', 'success');
    await waitFor(() =>
      expect(
        (screen.getByLabelText('perfil.contrasenaActual') as HTMLInputElement).value,
      ).toBe(''),
    );
    expect(
      (screen.getByLabelText('perfil.nuevaContrasena') as HTMLInputElement).value,
    ).toBe('');
    expect(
      (screen.getByLabelText('perfil.confirmarNuevaContrasena') as HTMLInputElement)
        .value,
    ).toBe('');
  });

  it('deshabilita el botón mientras guarda', async () => {
    let resolver: (valor?: unknown) => void = () => undefined;
    vi.mocked(api.post).mockImplementation(
      () => new Promise((resolve) => { resolver = resolve; }) as Promise<unknown>,
    );
    render(<PasswordTab notify={vi.fn()} />);

    llenar('Actual123!', 'Nueva123!');
    fireEvent.click(botonEnviar());

    const guardando = await screen.findByRole('button', {
      name: /perfil\.actualizandoContrasena/,
    });
    expect(guardando).toHaveProperty('disabled', true);

    resolver({ data: {} });
    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /perfil\.actualizarContrasena/ }),
      ).toHaveProperty('disabled', true),
    );
  });

  it('muestra el detalle del backend si el cambio falla', async () => {
    const notify = vi.fn();
    vi.mocked(api.post).mockRejectedValue({
      response: { data: { detail: 'La contraseña actual no coincide' } },
    });
    render(<PasswordTab notify={notify} />);

    llenar('Actual123!', 'Nueva123!');
    fireEvent.click(botonEnviar());

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        'La contraseña actual no coincide',
        'error',
      ),
    );
  });

  it('usa el mensaje genérico si el error no trae detalle', async () => {
    const notify = vi.fn();
    vi.mocked(api.post).mockRejectedValue(new Error('down'));
    render(<PasswordTab notify={notify} />);

    llenar('Actual123!', 'Nueva123!');
    fireEvent.click(botonEnviar());

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith(
        'perfil.errorCambiarContrasena',
        'error',
      ),
    );
  });
});