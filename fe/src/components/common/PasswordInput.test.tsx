// Semana 2 — campo de contraseña con mostrar/ocultar (widget de formularios
// de cambio de contraseña: lo que ve y hace el usuario).
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { PasswordInput } from './PasswordInput';

describe('PasswordInput', () => {
  it('por defecto oculta el valor (type password)', () => {
    // Act
    render(<PasswordInput value="Secreta123" onChange={vi.fn()} placeholder="Contraseña" />);
    // Assert
    expect((screen.getByPlaceholderText('Contraseña') as HTMLInputElement).type).toBe('password');
    expect(screen.getByPlaceholderText('Contraseña')).toBeTruthy();
  });

  it('el botón alterna entre oculto y visible sin cambiar el valor', () => {
    // Arrange: el input de contraseña no tiene rol ARIA propio; se localiza
    // dentro del contenedor del widget.
    const { container } = render(<PasswordInput value="Secreta123" onChange={vi.fn()} />);
    const campo = container.querySelector('input') as HTMLInputElement;
    // Act: mostrar
    fireEvent.click(screen.getByRole('button'));
    // Assert
    expect(campo.type).toBe('text');
    // Act: volver a ocultar
    fireEvent.click(screen.getByRole('button'));
    expect(campo.type).toBe('password');
  });

  it('al escribir notifica el nuevo valor al formulario', () => {
    // Arrange
    const onChange = vi.fn();
    render(<PasswordInput value="" onChange={onChange} placeholder="Nueva" />);
    // Act
    fireEvent.change(screen.getByPlaceholderText('Nueva'), { target: { value: 'NuevaClave9' } });
    // Assert
    expect(onChange).toHaveBeenCalledWith('NuevaClave9');
  });

  it('propaga los atributos de accesibilidad y estado al input', () => {
    // Arrange / Act
    render(
      <PasswordInput
        value=""
        onChange={vi.fn()}
        placeholder="Actual"
        required
        minLength={8}
        disabled
        autoComplete="current-password"
      />,
    );
    const campo = screen.getByPlaceholderText('Actual') as HTMLInputElement;
    // Assert
    expect(campo.required).toBe(true);
    expect(campo.minLength).toBe(8);
    expect(campo.disabled).toBe(true);
    expect(campo.autocomplete).toBe('current-password');
  });
});
