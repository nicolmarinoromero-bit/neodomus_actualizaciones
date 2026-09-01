/**
 * Cliente HTTP centralizado para toda la aplicación.
 *
 * ¿Para qué?
 *   Todas las peticiones al backend pasan por este módulo. Centraliza:
 *   - La URL base de la API (VITE_API_URL o localhost:8000).
 *   - El envío automático del token de autenticación (Authorization header).
 *   - La renovación automática de tokens (refresh) cuando expiran.
 *   - El manejo de errores comunes (401, 422, errores de red).
 *
 * ¿Por qué?
 *   Sin un cliente centralizado, cada componente tendría que:
 *   1. Recordar pasar el token manualmente.
 *   2. Manejar 401s y refrescar tokens repetidamente.
 *   3. Parsear errores 422 del backend.
 *   Esto duplicaría lógica y causaría bugs de sesión inconsistente.
 *
 * Impacto:
 *   - El interceptor de request AÑADE el token a CADA petición.
 *   - El interceptor de response INTENTA REFRESCAR si recibe 401.
 *   - Si el refresh falla, BORRA la sesión y dispara un evento.
 *   - Si el refresh funciona, REINTENTA la petición original.
 *
 * Flujo completo de una petición:
 *   1. Componente llama: api.get('/devoluciones/mis-recogidas')
 *   2. Interceptor request: añade Authorization: Bearer <token>
 *   3. Navegador envía petición a backend
 *   4. Backend responde:
 *      a. 200 OK → interceptor return response → componente recibe datos
 *      b. 401 → interceptor intenta refresh → si OK, reintenta
 *      c. 401 + refresh falla → clearSession() → usuario al login
 */
import axios from 'axios';
import { tabGet, tabRemove, tabSet } from '../utils/tabStorage';

/**
 * URL base de la API.
 * VITE_API_URL se define en .env del frontend (build time).
 * Fallback: localhost:8000/api/v1 (desarrollo local sin Docker).
 */
const BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api/v1';

// ─── Gestión de sesión ──────────────────────────────────────────────────
//
// La sesión se persiste en sessionStorage (por pestaña). Cada pestaña
// tiene sus propios tokens. Esto permite tener una cuenta de cliente
// abierta en una pestaña y una de empleado en otra.
// ────────────────────────────────────────────────────────────────────────

/**
 * Borra TODOS los datos de sesión de la pestaña actual.
 *
 * ¿Por qué borrar todo?
 *   Para que al recargar la página, AuthContext vea que no hay sesión
 *   y redirija al login. Si quedara algún token, el usuario vería
 *   errores 401 repetidos o pantallas vacías.
 *
 * ¿Por qué dispatchEvent en vez de navigate()?
 *   Porque navigate() aquí causaría ciclos: el interceptor limpia →
 *   navigate → React re-monta → componente hace petición → 401 →
 *   interceptor limpia → navigate → infinito. El evento lo maneja
 *   AuthContext que redirige DESPUÉS de que React terminó de montar.
 *
 * Impacto: limpiar solo access_token sin refresh_token causaría que
 * el interceptor intentara un refresh innecesariamente al recargar.
 * Limpiar solo sin dispatch causaría que AuthContext no supiera que
 * la sesión expiró.
 */
const clearSession = () => {
  tabRemove('access_token');
  tabRemove('refresh_token');
  tabRemove('user');
  tabRemove('password_reset_required');
  tabRemove('perfil_incompleto');
  // Disparar evento para que AuthContext reaccione (limpia estado React).
  // La redirección la maneja AuthContext / RoleRoute, NO aquí, para evitar
  // ciclos al recargar la página.
  window.dispatchEvent(new Event('neodomus:sesion-expirada'));
};

/**
 * Intenta renovar el access_token usando el refresh_token.
 *
 * ¿Cómo funciona?
 *   1. Lee el refresh_token de sessionStorage (la pestaña actual).
 *   2. POST /auth/refresh con el refresh_token en el body.
 *   3. Si el backend responde 200 → guarda los nuevos tokens y retorna ok:true.
 *   4. Si el backend responde 401 → el refresh_token es inválido → authError:true.
 *   5. Si hay error de red/timeout/500 → NO borra sesión → authError:false.
 *
 * ¿Por qué NO borrar sesión en errores de red?
 *   Porque el backend puede estar reiniciándose (deploy, crash). Si borramos
 *   la sesión, el usuario pierde todo y tiene que loguearse de nuevo. Es
 *   mejor esperar a que el backend vuelva y que la petición original tenga
 *   éxito al reintentar.
 *
 * ¿Por qué usar axios.post directo en vez de `api`?
 *   Porque `api` tiene un interceptor que intenta refresh en 401. Si
 *   usáramos `api` aquí, crearíamos un bucle infinito: 401 → refresh →
 *   401 → refresh → infinito.
 *
 * Impacto: este es el mecanismo que mantiene la sesión viva cuando
 * el access_token expira (típicamente 15-60 min). Sin esto, el usuario
 * se desconectaría cada vez que el token expira.
 */
export const refreshAccessToken = async (): Promise<{ ok: boolean; authError: boolean }> => {
  const refreshToken = tabGet('refresh_token');
  if (!refreshToken) return { ok: false, authError: false };
  try {
    const res = await axios.post(
      `${BASE_URL}/auth/refresh`,
      { refresh_token: refreshToken },
      {
        withCredentials: false, // Los tokens van en body, NO en cookies
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000, // 10s máximo para no bloquear UI
      },
    );
    // Almacenar los nuevos tokens en la pestaña
    if (res.data?.access_token) {
      tabSet('access_token', res.data.access_token);
    }
    if (res.data?.refresh_token) {
      tabSet('refresh_token', res.data.refresh_token);
    }
    return { ok: true, authError: false };
  } catch (err: any) {
    // 401 = refresh_token inválido/expirado → sesión muerta
    if (err.response?.status === 401) {
      return { ok: false, authError: true };
    }
    // Error de red, timeout, 500, backend reiniciándose → sesión viva
    return { ok: false, authError: false };
  }
};

// ─── Cliente axios ──────────────────────────────────────────────────────
//
// api es la instancia de axios que usa TODA la aplicación. Cada
// componente importa `api` en vez de usar axios directamente.
// ────────────────────────────────────────────────────────────────────────

/**
 * Instancia de axios configurada con los defaults de la aplicación.
 *
 * Configuración:
 *   - baseURL: todas las peticiones son relativas a /api/v1.
 *   - withCredentials: false → NO envía cookies. Los tokens van en
 *     Authorization header (soporte multi-pestaña, compatible con móvil).
 *   - timeout: 15s máximo por petición. Evita que UI se congele si
 *     el backend tarda demasiado.
 *   - responseType: json → parsea automáticamente la respuesta.
 */
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: false,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Accept': 'application/json; charset=utf-8',
  },
  responseType: 'json',
  responseEncoding: 'utf8',
});

// ─── Interceptor de request ────────────────────────────────────────────
//
// Se ejecuta ANTES de cada petición. Modifica la configuración
// de axios para:
//   1. Eliminar Content-Type en FormData (el navegador lo genera).
//   2. Añadir el token de autorización desde sessionStorage.
// ────────────────────────────────────────────────────────────────────────

/**
 * Interceptor de request: ajusta headers antes de enviar.
 *
 * ¿Para qué el delete Content-Type en FormData?
 *   Cuando envías FormData (subida de archivos), axios por defecto
 *   envía Content-Type: application/json. Esto hace que el backend
 *   reciba un JSON en vez de un FormData → error 422 "file required".
 *   Al borrar Content-Type, axios deja que el navegador genere
 *   multipart/form-data con el boundary correcto.
 *
 * ¿Para qué el Authorization header?
 *   El backend valida el token via Depends(oauth2_scheme) que lee
 *   el header Authorization. Sin él, todos los endpoints protegidos
 *   devuelven 401.
 *
 * ¿Por qué leer de sessionStorage (tabGet)?
 *   Porque permite multi-pestaña: cada pestaña tiene sus propios
 *   tokens. Si usáramos localStorage, todas las pestañas compartirían
 *   la misma sesión y se pisarían al refrescar.
 *
 * Impacto: sin este interceptor, cada componente tendría que recordar
 * pasar el token manualmente. Olvidarlo causaría 401s silenciosos.
 */
api.interceptors.request.use((config) => {
  // FormData: dejar que el navegador fije multipart/form-data con su boundary
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    delete config.headers['Content-Type'];
    if (config.headers.common) delete config.headers.common['Content-Type'];
  }
  // Añadir token de autenticación desde sessionStorage (multi-pestaña)
  const tabToken = tabGet('access_token');
  if (tabToken) {
    config.headers.Authorization = `Bearer ${tabToken}`;
  }
  return config;
});

// ─── Interceptor de response ───────────────────────────────────────────
//
// Se ejecuta DESPUÉS de cada respuesta. Maneja errores comunes:
//   - 401: intenta refresh y reintenta la petición.
//   - 422: normaliza el formato de error para evitar crashes en React.
//   - Otros errores: rechaza la promesa para que el componente los maneje.
// ────────────────────────────────────────────────────────────────────────

/**
 * Interceptor de response: maneja errores globalmente.
 *
 * Flujo de manejo de errores:
 *   1. Si la respuesta es exitosa → retorna tal cual.
 *   2. Si hay error:
 *      a. Normaliza errores 422 (detail como array → string seguro).
 *      b. Si es 401 y NO es endpoint de auth → intenta refresh.
 *      c. Si refresh OK → reintenta la petición original.
 *      d. Si refresh falla → clearSession() → usuario al login.
 *      e. Si es cualquier otro error → rechaza para que el componente
 *         lo maneje (mostrar toast, modal, etc.).
 *
 * ¿Por qué NO refrescar en endpoints de auth?
 *   Porque /auth/login y /auth/refresh son los endpoints que CREAN
 *   la sesión. Si reciben 401, es porque las credenciales son
 *   incorrectas (no porque el token expiró). Intentar refresh aquí
 *   causaría un bucle infinito.
 *
 * ¿Qué es __neodomus_validando_sesion?
 *   Flag global que AuthContext pone en true mientras valida la sesión
 *   al cargar la página. Evita que el interceptor borre la sesión
 *   durante la validación inicial (race condition).
 *
 * Impacto: sin este interceptor, cada componente tendría que manejar
 * 401s individualmente, lo cual es propenso a errores y inconsistente.
 */
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const { response, config } = error;

    // FastAPI 422 devuelve `detail` como ARRAY de objetos; si alguna
    // pantalla lo renderiza directo crashea React (pantalla en negro).
    // Se normaliza a un string seguro para toda la app.
    if (response?.data?.detail && typeof response.data.detail !== 'string') {
      response.data.detail = 'La solicitud no es válida: revisa los datos o el archivo enviado.';
    }

    const originalRequest: any = config;
    const url: string = originalRequest?.url || '';

    // No intentar refresh en endpoints de autenticación (evitar bucle infinito)
    const isAuthEndpoint =
      url.includes('/auth/login') || url.includes('/auth/refresh') || url.includes('/auth/session');

    if (
      response?.status === 401 &&
      originalRequest &&
      !originalRequest._retry &&
      !isAuthEndpoint
    ) {
      // Marcar como retry para evitar bucle infinito (máximo 1 reintento)
      originalRequest._retry = true;
      const resultado = await refreshAccessToken();
      if (resultado.ok) {
        // Refresh exitoso: reintentar la petición original con el nuevo token
        return api(originalRequest);
      }
      // Solo borrar sesión si el refresh token es realmente inválido (401).
      // Si es error de red (backend reiniciándose, timeout, 500), mantener
      // los tokens para que al recargar la página la sesión siga viva.
      if (resultado.authError && !(window as any).__neodomus_validando_sesion) {
        clearSession();
      }
    }

    return Promise.reject(error);
  }
);

export default api;

// ─── Utilidades de descarga ────────────────────────────────────────────
//
// Funciones helper para descargar archivos PDF protegidos por auth.
// Usan el mismo interceptor `api` para enviar el token automáticamente.
// ────────────────────────────────────────────────────────────────────────

/**
 * Descarga una factura PDF autenticada.
 *
 * ¿Cómo funciona?
 *   1. Hace GET a la URL de la factura (ej: /invoices/1/factura.pdf).
 *   2. Pide responseType: 'blob' para recibir binario, no JSON.
 *   3. Crea un Blob y genera una URL temporal (URL.createObjectURL).
 *   4. Crea un <a> invisible, le pone download= y lo clickea programáticamente.
 *   5. Limpia el <a> y revoca la URL temporal para liberar memoria.
 *
 * ¿Por qué no usar window.open()?
 *   Porque window.open() no envía el Authorization header. La factura
 *   está protegida por auth, así que necesitamos usar `api.get()` que
 *   sí envía el token.
 *
 * Impacto: sin esta función, cada pantalla que muestre facturas
 * tendría que duplicar la lógica de descarga con auth.
 */
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
    // Si el backend devolvió un blob con un JSON de error dentro
    if (err.response?.data instanceof Blob) {
      try {
        const parsed = JSON.parse(await err.response.data.text());
        if (parsed?.detail) msg = parsed.detail;
      } catch {
        /* noop - el blob no era JSON */
      }
    }
    window.alert(msg);
  }
};

/**
 * Descarga el reporte general del panel en PDF.
 *
 * ¿Cómo funciona?
 *   Similar a descargarFactura pero con parámetros de rango de fechas.
 *   El backend genera el PDF dinámicamente según las fechas enviadas.
 *
 * Parámetros:
 *   - rango: { fechaInicio, fechaFin } opcionales. Si no se envían,
 *     el backend genera el reporte completo.
 *   - mensajeError: texto personalizado para mostrar si falla.
 *
 * Nota sobre content-disposition:
 *   El backend envía el nombre del archivo en el header
 *   Content-Disposition: filename="reporte.pdf". Lo extraemos con
 *   regex para usarlo como nombre de descarga.
 */
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
