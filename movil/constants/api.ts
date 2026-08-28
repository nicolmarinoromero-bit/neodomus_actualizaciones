// ─────────────────────────────────────────────────────────────
// Configuración centralizada de conexión al backend.
//
// La URL se define UNA sola vez mediante la variable de entorno
// EXPO_PUBLIC_API_URL (Expo la lee de movil/.env al compilar).
// Ver movil/.env.example para los valores según entorno.
//
// Aquí SOLO se añade el prefijo /api/v1 que usa todo el backend,
// de modo que ningún servicio necesita saber host ni puerto.
// ─────────────────────────────────────────────────────────────

const URL_SIN_PREFIJO = (
  process.env.EXPO_PUBLIC_API_URL ?? "http://10.0.2.2:8000"
).replace(/\/+$/, "");

/** Base completa para todas las peticiones: <host>:<puerto>/api/v1 */
export const API_BASE_URL = `${URL_SIN_PREFIJO}/api/v1`;

/** Host base sin /api/v1 (útil para recursos estáticos como /uploads). */
export const BACKEND_HOST_URL = URL_SIN_PREFIJO;
