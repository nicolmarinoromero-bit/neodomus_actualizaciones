// Semana 2 — diálogo de confirmación reutilizable (lo que ve y hace el usuario).
// Estados: cerrado → nada en el DOM; abierto → título/mensaje/botones;
// aceptando → botones deshabilitados y etiqueta de guardado.
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { IdiomaProvider } from '@i18n/IdiomaContext';
import ConfirmDialog from './ConfirmDialog';

function montar(props: Record<string, unknown> = {}) {
  return render(
    <IdiomaProvider>
      <ConfirmDialog
        abierto
        mensaje="¿Seguro que quieres eliminar la cita?"
        onCancelar={vi.fn()}
        onAceptar={vi.fn()}
        {...props}
      />
    </IdiomaProvider>,
  );
}

describe('ConfirmDialog', () => {
  it('cerrado no renderiza nada', () => {
    montar({ abierto: false });
    expect(screen.queryByRole('dialog')).toBeFalsy();
  });

  it('abierto muestra título por defecto, mensaje y botones accesibles', () => {
    montar();
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(screen.getByText('¿Seguro que quieres eliminar la cita?')).toBeTruthy();
    // Dos botones de cancelar: la X (aria-label) y el fantasma del pie.
    expect(screen.getAllByRole('button', { name: /cancelar/i })).toHaveLength(2);
    expect(screen.getByRole('button', { name: /aceptar/i })).toBeTruthy();
  });

  it('un título propio pisa el del sistema y las etiquetas son configurables', () => {
    montar({ titulo: 'Eliminar técnica', labelAceptar: 'Eliminar', labelCancelar: 'Volver' });
    expect(screen.getByText('Eliminar técnica')).toBeTruthy();
    // El pie usa la etiqueta configurada; la X conserva su aria-label del sistema.
    expect(screen.getByRole('button', { name: 'Volver' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Cancelar' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Eliminar' })).toBeTruthy();
  });

  it('los botones invocan sus callbacks exactamente una vez', () => {
    // Arrange
    const onCancelar = vi.fn();
    const onAceptar = vi.fn();
    montar({ onCancelar, onAceptar });
    // Act: la X (primer botón de cancelar) y el botón principal.
    fireEvent.click(screen.getAllByRole('button', { name: /cancelar/i })[0]);
    fireEvent.click(screen.getByRole('button', { name: /aceptar/i }));
    // Assert
    expect(onCancelar).toHaveBeenCalledTimes(1);
    expect(onAceptar).toHaveBeenCalledTimes(1);
  });

  it('mientras acepta, los botones se deshabilitan y el principal muestra "guardando"', () => {
    // Arrange
    const onAceptar = vi.fn();
    montar({ aceptando: true, onAceptar });
    // Act: el botón deshabilitado no dispara el callback.
    fireEvent.click(screen.getByRole('button', { name: /guardando/i }));
    // Assert
    expect(onAceptar).not.toHaveBeenCalled();
    const cancelares = screen.getAllByRole('button', { name: /cancelar/i }) as HTMLButtonElement[];
    expect(cancelares.every((b) => b.disabled)).toBe(true);
  });
});
