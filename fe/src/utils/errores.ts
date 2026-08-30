// Extrae un mensaje legible del error de una respuesta de la API.
// FastAPI devuelve `detail` como string (HTTPException) o como un ARRAY de
// objetos cuando falla la validación Pydantic (422); renderizar ese array
// directamente en la UI crashea React (pantalla en negro).
export const detalleError = (err: any, fallback: string): string => {
  const detail = err?.response?.data?.detail;
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    const primero = detail[0];
    if (primero?.msg) return fallback;
  }
  if (detail && typeof detail === 'object' && detail.msg) return fallback;
  return fallback;
};
