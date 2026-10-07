// Tests de los bloqueos de copiar/pegar (campos sensibles del login/registro).
import { describe, it, expect, vi } from 'vitest';
import {
  bloquearTeclasPortapapeles,
  bloquearEventoPortapapeles,
} from '../../utils/copyPaste';

type Teclado = Parameters<typeof bloquearTeclasPortapapeles>[0];
type Portapapeles = Parameters<typeof bloquearEventoPortapapeles>[0];

const teclado = (extra: Partial<Record<string, unknown>> = {}) =>
  ({ ctrlKey: false, metaKey: false, key: '', preventDefault: vi.fn(), ...extra }) as unknown as Teclado;

describe('bloquearTeclasPortapapeles', () => {
  it('bloquea Ctrl+C / Ctrl+V / Ctrl+X', () => {
    for (const key of ['c', 'v', 'x']) {
      const e = teclado({ ctrlKey: true, key });
      bloquearTeclasPortapapeles(e);
      expect(e.preventDefault).toHaveBeenCalled();
    }
  });

  it('bloquea Cmd+C en macOS (metaKey)', () => {
    const e = teclado({ metaKey: true, key: 'C' });
    bloquearTeclasPortapapeles(e);
    expect(e.preventDefault).toHaveBeenCalled();
  });

  it('no bloquea otras teclas ni combinaciones sin modificador', () => {
    const otra = teclado({ ctrlKey: true, key: 'a' });
    bloquearTeclasPortapapeles(otra);
    expect(otra.preventDefault).not.toHaveBeenCalled();

    const sinModificador = teclado({ key: 'v' });
    bloquearTeclasPortapapeles(sinModificador);
    expect(sinModificador.preventDefault).not.toHaveBeenCalled();
  });
});

describe('bloquearEventoPortapapeles', () => {
  it('cancela el evento (pegar/clic derecho, etc.)', () => {
    const e = { preventDefault: vi.fn() } as unknown as Portapapeles;
    bloquearEventoPortapapeles(e);
    expect(e.preventDefault).toHaveBeenCalledTimes(1);
  });
});
