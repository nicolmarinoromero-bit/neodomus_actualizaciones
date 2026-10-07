// Tests del cliente API: configuración, interceptores (token por pestaña,
// refresh de sesión, normalización de errores 422) y descargas de PDF.
// axios se mockea por completo: aquí NO se hace ninguna llamada de red real.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('axios', () => {
  // Instancia "axios" devuelta por axios.create(); debe ser invocable porque
  // el interceptor de respuesta reintenta la petición original con api(config).
  const instance: any = Object.assign(vi.fn(async () => ({ data: {}, status: 200 })), {
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
    defaults: { headers: { common: {} as Record<string, string> } },
    get: vi.fn(),
    post: vi.fn(),
  });
  const axiosMock: any = Object.assign(vi.fn(), {
    create: vi.fn(() => instance),
    post: vi.fn(),
    get: vi.fn(),
    __instance: instance,
  });
  return { default: axiosMock };
});

import axios from 'axios';
import api, { refreshAccessToken, descargarFactura, descargarReportePdf } from '../../services/api';
import { tabGet, tabSet, tabRemove } from '../../utils/tabStorage';

// Tipo mínimo de un mock de Vitest: solo lo que usan estos tests.
type Mock = {
  (...args: any[]): any;
  mock: { calls: any[][] };
  mockReset(): void;
  mockClear(): void;
  mockResolvedValue(v: unknown): void;
  mockRejectedValue(e: unknown): void;
  mockImplementation(f: (...args: any[]) => any): void;
};
const instancia = (axios as any).__instance as Mock & {
  (config?: unknown): Promise<unknown>;
  interceptors: { request: { use: Mock }; response: { use: Mock } };
  defaults: { headers: { common: Record<string, string> } };
  get: Mock;
  post: Mock;
};

const BASE_URL = 'http://localhost:8000/api/v1';

// Los handlers de los interceptores se registran al importar el módulo:
// se capturan aquí ANTES de que ningún `mockClear` borre su historial.
const requestHandler: (config: any) => any = instancia.interceptors.request.use.mock.calls[0][0];
const responseFulfilled: (r: any) => any = instancia.interceptors.response.use.mock.calls[0][0];
const responseRejected: (e: any) => Promise<any> = instancia.interceptors.response.use.mock.calls[0][1];
const configCreate: any = (axios.create as Mock).mock.calls[0][0];

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  (axios.post as Mock).mockReset();
  (instancia.get as Mock).mockReset();
  (instancia.post as Mock).mockReset();
  (instancia as unknown as Mock).mockClear();
  delete (window as any).__neodomus_validando_sesion;
  if (typeof (window as any).alert !== 'function') {
    (window as any).alert = vi.fn();
  }
});

afterEach(() => {
  vi.restoreAllMocks();
  tabRemove('access_token');
  tabRemove('refresh_token');
});

describe('creación del cliente axios', () => {
  it('usa la URL base del API y timeout de 15 s', () => {
    expect(configCreate).toEqual(
      expect.objectContaining({ baseURL: BASE_URL, timeout: 15000 }),
    );
  });

  it('exporta una instancia por defecto', () => {
    expect(api).toBe(instancia);
  });
});

describe('interceptor de peticiones', () => {
  it('adjunta el Authorization con el token de la pestaña', () => {
    tabSet('access_token', 'tok-abc');
    const config: any = { headers: { 'Content-Type': 'application/json' } };
    requestHandler(config);
    expect(config.headers.Authorization).toBe('Bearer tok-abc');
  });

  it('no toca Authorization si no hay token guardado', () => {
    const config: any = { headers: {} };
    requestHandler(config);
    expect(config.headers.Authorization).toBeUndefined();
  });

  it('elimina el Content-Type JSON cuando el cuerpo es FormData', () => {
    tabSet('access_token', 'tok');
    const config: any = {
      data: new FormData(),
      headers: { 'Content-Type': 'application/json', common: { 'Content-Type': 'application/json' } },
    };
    requestHandler(config);
    expect(config.headers['Content-Type']).toBeUndefined();
    expect(config.headers.common['Content-Type']).toBeUndefined();
    expect(config.headers.Authorization).toBe('Bearer tok');
  });

  it('conserva el Content-Type en peticiones normales', () => {
    const config: any = { data: { a: 1 }, headers: { 'Content-Type': 'application/json' } };
    requestHandler(config);
    expect(config.headers['Content-Type']).toBe('application/json');
  });
});

describe('interceptor de respuestas', () => {
  it('las respuestas exitosas pasan sin modificarse', () => {
    const respuesta = { data: { ok: true }, status: 200 };
    expect(responseFulfilled(respuesta)).toBe(respuesta);
  });

  it('normaliza el detail ARRAY de los 422 de FastAPI a un string seguro', async () => {
    const rejected = responseRejected;
    const error: any = {
      response: { status: 422, data: { detail: [{ msg: 'Field required' }] } },
      config: { url: '/products' },
    };
    await expect(rejected(error)).rejects.toBe(error);
    expect(error.response.data.detail).toBe(
      'La solicitud no es válida: revisa los datos o el archivo enviado.',
    );
  });

  it('deja intacto un detail string', async () => {
    const rejected = responseRejected;
    const error: any = {
      response: { status: 400, data: { detail: 'Detalle legible' } },
      config: { url: '/products' },
    };
    await expect(rejected(error)).rejects.toBe(error);
    expect(error.response.data.detail).toBe('Detalle legible');
  });

  it('ante un 401 refresca el token y reintenta la petición original', async () => {
    tabSet('refresh_token', 'refresh-1');
    (axios.post as Mock).mockResolvedValue({
      data: { access_token: 'nuevo', refresh_token: 'refresh-2' },
    });
    (instancia as unknown as Mock & ((c: unknown) => Promise<unknown>)).mockResolvedValue({
      data: { ok: true },
      status: 200,
    });

    const rejected = responseRejected;
    const config: any = { url: '/products', method: 'get' };
    const resultado = await rejected({ response: { status: 401, data: {} }, config });

    expect(axios.post).toHaveBeenCalledWith(
      `${BASE_URL}/auth/refresh`,
      { refresh_token: 'refresh-1' },
      expect.anything(),
    );
    expect(tabGet('access_token')).toBe('nuevo');
    expect(tabGet('refresh_token')).toBe('refresh-2');
    // Reintenta con la misma configuración marcada como reintentada.
    expect(instancia).toHaveBeenCalledWith(config);
    expect(config._retry).toBe(true);
    expect(resultado).toEqual({ data: { ok: true }, status: 200 });
  });

  it('NO refresca en endpoints de autenticación', async () => {
    const rejected = responseRejected;
    const config: any = { url: '/auth/login' };
    await expect(
      rejected({ response: { status: 401, data: {} }, config }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(axios.post).not.toHaveBeenCalled();
    expect(config._retry).toBeUndefined();
  });

  it('NO reintenta dos veces la misma petición (_retry)', async () => {
    tabSet('refresh_token', 'refresh-1');
    (axios.post as Mock).mockResolvedValue({
      data: { access_token: 'nuevo', refresh_token: 'refresh-2' },
    });
    const rejected = responseRejected;
    const config: any = { url: '/products', _retry: true };
    await expect(
      rejected({ response: { status: 401, data: {} }, config }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(instancia).not.toHaveBeenCalled();
  });

  it('si el refresh devuelve 401 (token inválido) limpia la sesión y avisa a la UI', async () => {
    tabSet('refresh_token', 'refresh-viejo');
    tabSet('access_token', 'tok-viejo');
    tabSet('user', '{"id":1}');
    (axios.post as Mock).mockRejectedValue({ response: { status: 401 } });
    const despacho = vi.spyOn(window, 'dispatchEvent');

    const rejected = responseRejected;
    await expect(
      rejected({ response: { status: 401, data: {} }, config: { url: '/products' } }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(tabGet('access_token')).toBeNull();
    expect(tabGet('refresh_token')).toBeNull();
    expect(tabGet('user')).toBeNull();
    expect(despacho).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'neodomus:sesion-expirada' }),
    );
  });

  it('si el refresh falla por red NO borra la sesión', async () => {
    tabSet('refresh_token', 'refresh-viejo');
    tabSet('user', '{"id":1}');
    (axios.post as Mock).mockRejectedValue(new Error('Network Error'));
    const despacho = vi.spyOn(window, 'dispatchEvent');

    const rejected = responseRejected;
    const error: any = { response: { status: 401, data: {} }, config: { url: '/products' } };
    await expect(rejected(error)).rejects.toBe(error);

    expect(tabGet('refresh_token')).toBe('refresh-viejo');
    expect(tabGet('user')).toBe('{"id":1}');
    expect(despacho).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'neodomus:sesion-expirada' }),
    );
  });

  it('durante la validación inicial de sesión NO se limpia (flag global)', async () => {
    (window as any).__neodomus_validando_sesion = true;
    tabSet('refresh_token', 'refresh-viejo');
    (axios.post as Mock).mockRejectedValue({ response: { status: 401 } });
    const despacho = vi.spyOn(window, 'dispatchEvent');

    const rejected = responseRejected;
    await expect(
      rejected({ response: { status: 401, data: {} }, config: { url: '/products' } }),
    ).rejects.toMatchObject({ response: { status: 401 } });

    expect(tabGet('refresh_token')).toBe('refresh-viejo');
    expect(despacho).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'neodomus:sesion-expirada' }),
    );
  });

  it('los errores que no son 401 se propagan sin reintentar', async () => {
    const rejected = responseRejected;
    const error: any = { response: { status: 500, data: {} }, config: { url: '/products' } };
    await expect(rejected(error)).rejects.toBe(error);
    expect(axios.post).not.toHaveBeenCalled();
  });
});

describe('refreshAccessToken', () => {
  it('sin refresh token devuelve ok=false sin llamar al backend', async () => {
    await expect(refreshAccessToken()).resolves.toEqual({ ok: false, authError: false });
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('guarda los tokens nuevos y devuelve ok=true', async () => {
    tabSet('refresh_token', 'r1');
    (axios.post as Mock).mockResolvedValue({
      data: { access_token: 'a2', refresh_token: 'r2' },
    });

    await expect(refreshAccessToken()).resolves.toEqual({ ok: true, authError: false });
    expect(tabGet('access_token')).toBe('a2');
    expect(tabGet('refresh_token')).toBe('r2');
  });

  it('responde 401 cuando el refresh token ya no sirve', async () => {
    tabSet('refresh_token', 'r1');
    (axios.post as Mock).mockRejectedValue({ response: { status: 401 } });
    await expect(refreshAccessToken()).resolves.toEqual({ ok: false, authError: true });
  });

  it('errores de red o 500 no invalidan la sesión (authError=false)', async () => {
    tabSet('refresh_token', 'r1');
    (axios.post as Mock).mockRejectedValue({ response: { status: 503 } });
    await expect(refreshAccessToken()).resolves.toEqual({ ok: false, authError: false });
  });

  it('la respuesta sin access_token sigue marcando ok=true pero no pisa el token', async () => {
    tabSet('refresh_token', 'r1');
    tabSet('access_token', 'a1');
    (axios.post as Mock).mockResolvedValue({ data: {} });
    await expect(refreshAccessToken()).resolves.toEqual({ ok: true, authError: false });
    expect(tabGet('access_token')).toBe('a1');
  });
});

/** Prepara el DOM para las descargas: captura los <a> creados y stubbea
 *  createObjectURL/click (jsdom no navega ni crea blobs de objeto). */
const prepararDom = () => {
  const creados: HTMLAnchorElement[] = [];
  const crearOriginal = document.createElement.bind(document);
  vi.spyOn(document, 'createElement').mockImplementation(((tag: string) => {
    const el = crearOriginal(tag);
    if (tag === 'a') creados.push(el as HTMLAnchorElement);
    return el;
  }) as unknown as typeof document.createElement);
  const crearObjeto = vi.fn(() => 'blob:falso');
  const revocarObjeto = vi.fn();
  (window.URL as any).createObjectURL = crearObjeto;
  (window.URL as any).revokeObjectURL = revocarObjeto;
  const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);
  return { creados, click, revocarObjeto };
};

describe('descargarFactura', () => {
  it('pide el PDF sin el prefijo /api/v1 (ya está en el baseURL) y descarga', async () => {
    const { creados, click, revocarObjeto } = prepararDom();
    (instancia.get as Mock).mockResolvedValue({ data: 'PDF' });

    await descargarFactura('/api/v1/invoices/123/factura.pdf');

    expect(instancia.get).toHaveBeenCalledWith('/invoices/123/factura.pdf', {
      responseType: 'blob',
    });
    expect(creados[0].download).toBe('factura_123.pdf');
    expect(click).toHaveBeenCalled();
    expect(revocarObjeto).toHaveBeenCalledWith('blob:falso');
  });

  it('si la URL no trae folio, usa factura_.pdf', async () => {
    const { creados } = prepararDom();
    (instancia.get as Mock).mockResolvedValue({ data: 'PDF' });
    await descargarFactura('/api/v1/descarga');
    expect(creados[0].download).toBe('factura_.pdf');
  });

  it('ante un error con detalle en el blob muestra el detalle en la alerta', async () => {
    prepararDom();
    (instancia.get as Mock).mockRejectedValue({
      response: { data: new Blob([JSON.stringify({ detail: 'Factura no encontrada' })]) },
    });
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => undefined);

    await descargarFactura('/api/v1/invoices/9/factura.pdf');

    expect(alerta).toHaveBeenCalledWith('Factura no encontrada');
  });

  it('ante un error sin detalle muestra el mensaje genérico', async () => {
    prepararDom();
    (instancia.get as Mock).mockRejectedValue(new Error('fallo'));
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await descargarFactura('/api/v1/invoices/9/factura.pdf');
    expect(alerta).toHaveBeenCalledWith('No se pudo descargar la factura.');
  });
});

describe('descargarReportePdf', () => {
  it('envía el rango de fechas como query params y usa el nombre del header', async () => {
    const { creados } = prepararDom();
    (instancia.get as Mock).mockResolvedValue({
      data: 'PDF',
      headers: { 'content-disposition': 'attachment; filename="reporte_enero.pdf"' },
    });

    await descargarReportePdf({ fechaInicio: '2026-01-01', fechaFin: '2026-01-31' });

    expect(instancia.get).toHaveBeenCalledWith('/reports/pdf', {
      params: { fecha_inicio: '2026-01-01', fecha_fin: '2026-01-31' },
      responseType: 'blob',
    });
    expect(creados[0].download).toBe('reporte_enero.pdf');
  });

  it('sin fechas no envía params y usa el nombre por defecto', async () => {
    const { creados } = prepararDom();
    (instancia.get as Mock).mockResolvedValue({ data: 'PDF', headers: {} });

    await descargarReportePdf();

    expect(instancia.get).toHaveBeenCalledWith('/reports/pdf', {
      params: {},
      responseType: 'blob',
    });
    expect(creados[0].download).toBe('Reporte_NEODOMUS.pdf');
  });

  it('muestra el mensaje de error personalizado si falla', async () => {
    (instancia.get as Mock).mockRejectedValue({ response: { data: new Blob(['x']) } });
    const alerta = vi.spyOn(window, 'alert').mockImplementation(() => undefined);
    await descargarReportePdf(undefined, 'Sin permisos');
    expect(alerta).toHaveBeenCalledWith('Sin permisos');
  });
});
