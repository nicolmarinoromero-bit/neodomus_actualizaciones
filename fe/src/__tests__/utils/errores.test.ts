// Tests de extracción de mensajes de error de la API (utils/errores).
import { describe, it, expect } from 'vitest';
import { detalleError } from '../../utils/errores';

const FALLBACK = 'Error genérico';

describe('detalleError', () => {
  it('devuelve el detail cuando es un string no vacío', () => {
    const err = { response: { data: { detail: 'Credenciales inválidas' } } };
    expect(detalleError(err, FALLBACK)).toBe('Credenciales inválidas');
  });

  it('ignora un detail string en blanco y usa el fallback', () => {
    const err = { response: { data: { detail: '   ' } } };
    expect(detalleError(err, FALLBACK)).toBe(FALLBACK);
  });

  it('usa el fallback cuando detail es un array (validación 422 de FastAPI)', () => {
    const err = {
      response: { data: { detail: [{ msg: 'Field required', loc: ['body', 'email'] }] } },
    };
    expect(detalleError(err, FALLBACK)).toBe(FALLBACK);
  });

 it('usa el fallback cuando detail es un objeto con msg', () => {
    const err = { response: { data: { detail: { msg: 'algo' } } } };
    expect(detalleError(err, FALLBACK)).toBe(FALLBACK);
  });

  it('usa el fallback cuando la respuesta no tiene detail', () => {
    expect(detalleError({}, FALLBACK)).toBe(FALLBACK);
    expect(detalleError(undefined, FALLBACK)).toBe(FALLBACK);
    expect(detalleError({ response: { data: {} } }, FALLBACK)).toBe(FALLBACK);
  });

  it('usa el fallback cuando el array de detail está vacío', () => {
    const err = { response: { data: { detail: [] } } };
    expect(detalleError(err, FALLBACK)).toBe(FALLBACK);
  });
});
