// Tests del diálogo de confirmación reutilizable (modal de acciones destructivas).
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { IdiomaProvider } from '../../i18n/IdiomaContext';
import ConfirmDialog from '../../components/common/ConfirmDialog';

const renderDialog = (props: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) => {
  const onAceptar = vi.fn();
  const onCancelar = vi.fn();
  render(
    <IdiomaProvider>
      <ConfirmDialog
        abierto
        mensaje="¿Seguro que deseas eliminar el producto?"
        onAceptar={onAceptar}
        onCancelar={onCancelar}
        {...props}
      />
    </IdiomaProvider>,
  );
  return { onAceptar, onCancelar };
};

/** La X y el botón fantasma comparten la etiqueta "Cancelar". */
const botonCerrarX = () => document.querySelector('.ap-modal-x') as HTMLButtonElement;
const botonCancelar = () => document.querySelector('.ap-btn-ghost') as HTMLButtonElement;

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

describe('ConfirmDialog', () => {
  it('no renderiza nada cuando está cerrado', () => {
    const { container } = render(
      <IdiomaProvider>
        <ConfirmDialog
          abierto={false}
          mensaje="Hola"
          onAceptar={vi.fn()}
          onCancelar={vi.fn()}
        />
      </IdiomaProvider>,
    );
    expect(container.innerHTML).toBe('');
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('muestra título por defecto, mensaje y botones', () => {
    renderDialog();
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true');
    expect(screen.getByText('¿Seguro que deseas eliminar el producto?')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Confirmar cambios' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aceptar' })).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: 'Cancelar' })).toHaveLength(2);
    expect(botonCerrarX()).not.toBeNull();
    expect(botonCancelar()).not.toBeNull();
  });

  it('respeta título y etiquetas personalizadas', () => {
    renderDialog({
      titulo: 'Eliminar técnico',
      labelAceptar: 'Sí, eliminar',
      labelCancelar: 'Volver',
    });
    expect(screen.getByRole('heading', { name: 'Eliminar técnico' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Sí, eliminar' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Volver' })).toBeInTheDocument();
  });

  it('dispara onAceptar y onCancelar', async () => {
    const user = userEvent.setup();
    const { onAceptar, onCancelar } = renderDialog();

    await user.click(screen.getByRole('button', { name: 'Aceptar' }));
    expect(onAceptar).toHaveBeenCalledTimes(1);
    expect(onCancelar).not.toHaveBeenCalled();

    await user.click(botonCancelar());
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('el botón de cerrar (X) cancela', async () => {
    const user = userEvent.setup();
    const { onCancelar } = renderDialog();
    await user.click(botonCerrarX());
    expect(onCancelar).toHaveBeenCalledTimes(1);
  });

  it('mientras acepta, deshabilita los controles y muestra "Guardando"', () => {
    renderDialog({ aceptando: true });
    expect(screen.getByRole('button', { name: /Guardando/ })).toBeDisabled();
    const botones = screen.getAllByRole('button');
    expect(botones).toHaveLength(3);
    for (const boton of botones) expect(boton).toBeDisabled();
  });

  it('se traduce al inglés si el idioma guardado es "en"', () => {
    localStorage.setItem('pf_idioma', 'en');
    renderDialog();
    expect(screen.getByRole('heading', { name: 'Confirm changes' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Accept' })).toBeInTheDocument();
  });
});
