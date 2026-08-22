import axios from 'axios';
import { tabRemove } from '../utils/tabStorage';

const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ────────────────────────────────────────────────────────────────
// Refresco de token (persistencia de sesión por pestaña)
// ────────────────────────────────────────────────────────────────

const clearSession = () => {
  tabRemove('access_token');
  tabRemove('refresh_token');
  tabRemove('user');
  if (window.location.pathname !== '/login') {
    window.location.href = '/login';
  }
};

// Intenta renovar la sesión con la cookie HttpOnly del refresh token.
// Devuelve true si el servidor emitió una nueva sesión.
const refreshAccessToken = async (): Promise<boolean> => {
  try {
    await axios.post(
      `${BASE_URL}/auth/refresh`,
      null,
      {
        withCredentials: true,
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000,
      },
    );
    return true;
  } catch {
    return false;
  }
};

// ────────────────────────────────────────────────────────────────
// Cliente axios
// ────────────────────────────────────────────────────────────────

// Limpieza de sesiones pre-migración: los tokens ya NO viven en JavaScript.
try {
  localStorage.removeItem('__tab__access_token');
  localStorage.removeItem('__tab__refresh_token');
} catch {
  /* noop */
}
Object.keys(localStorage)
  .filter((k) => k.endsWith('__tab__access_token') || k.endsWith('__tab__refresh_token'))
  .forEach((k) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* noop */
    }
  });

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // envía las cookies HttpOnly de sesión en cada petición
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
  },
  responseType: 'json',
  responseEncoding: 'utf8',
});

// Interceptor de respuesta:
//  - En error 401 renueva la sesión (cookie de refresh) y reintenta la petición.
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;
    const originalRequest: any = config;
    const url: string = originalRequest?.url || '';

    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/refresh');

    if (
      response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      originalRequest._retry = true;
      const renovada = await refreshAccessToken();
      if (renovada) {
        return api(originalRequest);
      }
      // No se pudo renovar la sesión -> cerrar sesión
      clearSession();
    }

    return Promise.reject(error);
  }
);

export default api;

// ────────────────────────────────────────────────────────────────
// Descarga de factura PDF autenticada
// ────────────────────────────────────────────────────────────────

export const descargarFactura = async (pdfUrl: string) => {
  try {
    const res = await api.get(pdfUrl.replace(/^\/api\/v1/, ''), {
      responseType: 'blob',
    });
    const blob = new Blob([res.data], { type: 'application/pdf' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `factura_${(pdfUrl.match(/\/(\d+)\/factura/) || [])[1] || ''}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    let msg = 'No se pudo descargar la factura.';
    if (err.response?.data instanceof Blob) {
      try {
        const parsed = JSON.parse(await err.response.data.text());
        if (parsed?.detail) msg = parsed.detail;
      } catch {
        /* noop */
      }
    }
    window.alert(msg);
  }
};

// ────────────────────────────────────────────────────────────────
// Descarga del reporte general del panel en PDF
// ────────────────────────────────────────────────────────────────

export const descargarReportePdf = async (
  rango?: { fechaInicio?: string; fechaFin?: string },
  mensajeError = 'No se pudo descargar el reporte.',
) => {
  try {
    const params: Record<string, string> = {};
    if (rango?.fechaInicio) params.fecha_inicio = rango.fechaInicio;
    if (rango?.fechaFin) params.fecha_fin = rango.fechaFin;
    const res = await api.get('/reports/pdf', {
      params,
      responseType: 'blob',
    });
    const blob = new Blob([res.data], {
      type: 'application/pdf',
    });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const cd = res.headers?.['content-disposition'] as string | undefined;
    const match = cd ? /filename="?([^"]+)"?/.exec(cd) : null;
    a.download = match?.[1] || 'Reporte_NEODOMUS.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  } catch (err: any) {
    let msg = mensajeError;
    if (err.response?.data instanceof Blob) {
      try {
        const parsed = JSON.parse(await err.response.data.text());
        if (parsed?.detail) msg = parsed.detail;
      } catch {
        /* noop */
      }
    }
    window.alert(msg);
  }
};
