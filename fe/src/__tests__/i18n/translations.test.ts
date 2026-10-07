// Tests del i18n: construcción de la función de traducción e integridad
// de los diccionarios (todas las claves deben tener es y en).
import { describe, it, expect } from 'vitest';
import { construirT, TRADUCCIONES, TRADUCCIONES_BASE, IDIOMAS_DISPONIBLES } from '../../i18n/translations';
import { ADMIN_TRADUCCIONES } from '../../i18n/adminTranslations';
import { ADMIN_TRADUCCIONES_CATALOGO } from '../../i18n/adminTranslations-catalogo';
import { ADMIN_TRADUCCIONES_CONSULTAS } from '../../i18n/adminTranslations-consultas';
import { ADMIN_TRADUCCIONES_DASHBOARD } from '../../i18n/adminTranslations-dashboard';
import { ADMIN_TRADUCCIONES_INSTALACIONES } from '../../i18n/adminTranslations-instalaciones';
import { ADMIN_TRADUCCIONES_NOTIFICACIONES } from '../../i18n/adminTranslations-notificaciones';
import { ADMIN_TRADUCCIONES_PRODUCTO_DETALLE } from '../../i18n/adminTranslations-productoDetalle';
import { ADMIN_TRADUCCIONES_PRODUCTOS } from '../../i18n/adminTranslations-productos';
import { ADMIN_TRADUCCIONES_PROVEEDORES } from '../../i18n/adminTranslations-proveedores';
import { ADMIN_TRADUCCIONES_REPORTES } from '../../i18n/adminTranslations-reportes';
import { ADMIN_TRADUCCIONES_TECNICOS } from '../../i18n/adminTranslations-tecnicos';

// Diccionarios con forma { es, en } (TRADUCCIONES_BASE está tipado más suelto).
type Diccionario = Record<string, string>;

describe('construirT', () => {
  it('traduce claves conocidas al idioma pedido', () => {
    expect(construirT('es')('nav.productos')).toBe('Productos');
    expect(construirT('en')('nav.productos')).toBe('Products');
  });

  it('interpola variables {n} y otras', () => {
    const t = construirT('es');
    expect(t('adm.catalogo.badgeCategorias', { n: 3 })).toBe('3 categorías');
    const tEn = construirT('en');
    expect(tEn('adm.clientes.pedidos', { n: 12 })).toBe('12 orders');
  });

  it('si la clave no existe devuelve la propia clave', () => {
    expect(construirT('es')('clave.que.no.existe')).toBe('clave.que.no.existe');
  });

  it('si falta la traducción al idioma solicitado cae al español y luego a la clave', () => {
    const tabla = TRADUCCIONES['nav.productos'];
    expect(construirT('fr')('nav.productos')).toBe(tabla.es);
  });
});

describe('diccionarios i18n', () => {
  const diccionarios: Array<[string, Record<string, Diccionario>]> = [
    ['TRADUCCIONES_BASE', TRADUCCIONES_BASE],
    ['ADMIN_TRADUCCIONES', ADMIN_TRADUCCIONES],
    ['ADMIN_TRADUCCIONES_CATALOGO', ADMIN_TRADUCCIONES_CATALOGO],
    ['ADMIN_TRADUCCIONES_CONSULTAS', ADMIN_TRADUCCIONES_CONSULTAS],
    ['ADMIN_TRADUCCIONES_DASHBOARD', ADMIN_TRADUCCIONES_DASHBOARD],
    ['ADMIN_TRADUCCIONES_INSTALACIONES', ADMIN_TRADUCCIONES_INSTALACIONES],
    ['ADMIN_TRADUCCIONES_NOTIFICACIONES', ADMIN_TRADUCCIONES_NOTIFICACIONES],
    ['ADMIN_TRADUCCIONES_PRODUCTO_DETALLE', ADMIN_TRADUCCIONES_PRODUCTO_DETALLE],
    ['ADMIN_TRADUCCIONES_PRODUCTOS', ADMIN_TRADUCCIONES_PRODUCTOS],
    ['ADMIN_TRADUCCIONES_PROVEEDORES', ADMIN_TRADUCCIONES_PROVEEDORES],
    ['ADMIN_TRADUCCIONES_REPORTES', ADMIN_TRADUCCIONES_REPORTES],
    ['ADMIN_TRADUCCIONES_TECNICOS', ADMIN_TRADUCCIONES_TECNICOS],
  ];

  it.each(diccionarios)('%s tiene claves no vacías en español e inglés', (_nombre, tabla) => {
    const claves = Object.keys(tabla);
    expect(claves.length).toBeGreaterThan(0);
    for (const clave of claves) {
      expect(clave.trim(), `clave vacía en ${_nombre}`).not.toBe('');
      expect(tabla[clave].es.trim(), `${_nombre}.${clave} sin español`).not.toBe('');
      expect(tabla[clave].en.trim(), `${_nombre}.${clave} sin inglés`).not.toBe('');
    }
  });

  it('TRADUCCIONES fusiona la base con las traducciones de admin', () => {
    expect(Object.keys(TRADUCCIONES)).toEqual(
      expect.arrayContaining(['nav.productos', ...Object.keys(ADMIN_TRADUCCIONES)]),
    );
  });

  it('declara los idiomas disponibles con su bandera', () => {
    expect(IDIOMAS_DISPONIBLES.map((i) => i.codigo)).toEqual(['es', 'en']);
    expect(IDIOMAS_DISPONIBLES.every((i) => i.bandera.length > 0)).toBe(true);
  });
});
