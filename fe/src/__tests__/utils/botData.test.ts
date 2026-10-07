// Tests del asistente virtual (respuesta por palabras clave + fallback).
import { describe, it, expect } from 'vitest';
import { responderBot, BOT_FALLBACK, BOT_INICIAL, BOT_FAQS, BOT_SUGERENCIAS } from '../../data/botData';

describe('responderBot', () => {
  it('responde la FAQ de pedidos aunque el texto venga en mayúsculas', () => {
    const r = responderBot('QUIERO HACER UN PEDIDO');
    expect(r).toBe(BOT_FAQS.find((f) => f.keywords.includes('pedido'))!.respuesta);
  });

  it('detecta el tema de pagos', () => {
    expect(responderBot('¿Puedo pagar con nequi?')).toContain('Nequi');
  });

  it('detecta el tema de garantía', () => {
    expect(responderBot('tiene garantía el equipo?')).toContain('12 meses');
  });

  it('devuelve el fallback cuando no hay coincidencia', () => {
    expect(responderBot('zzz tema inexistente qqq')).toBe(BOT_FALLBACK);
  });

  it('usa la primera coincidencia del listado de FAQs', () => {
    const texto = `${BOT_FAQS[0].keywords[0]} ${BOT_FAQS[1].keywords[0]}`;
    expect(responderBot(texto)).toBe(BOT_FAQS[0].respuesta);
  });

  it('el mensaje inicial y las sugerencias no están vacíos', () => {
    expect(BOT_INICIAL.length).toBeGreaterThan(0);
    expect(BOT_SUGERENCIAS.length).toBeGreaterThan(0);
    expect(BOT_FAQS.every((f) => f.respuesta.trim().length > 0)).toBe(true);
  });
});
