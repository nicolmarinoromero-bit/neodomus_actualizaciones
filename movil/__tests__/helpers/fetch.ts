// ─────────────────────────────────────────────────────────────
// Helper de peticiones HTTP para pruebas de servicios.
//
// Sustituye globalThis.fetch por un doble controlado que registra cada
// llamada (URL + init) y decide la respuesta por índice de llamada o por
// un manejador. Devuelve la lista de llamadas para aserciones.
// ─────────────────────────────────────────────────────────────

export interface LlamadaFetch {
  url: string;
  init: RequestInit;
}

export type ReglaRespuesta =
  | { status?: number; cuerpo?: unknown; texto?: string }
  | { lanzar: unknown };

export type RespuestaProgramada =
  | ReglaRespuesta
  | ((llamada: LlamadaFetch, indice: number) => ReglaRespuesta);

const fetchOriginal = globalThis.fetch;

/** Instala el doble de fetch y devuelve el registro de llamadas. */
export function instalarFetch(responder: RespuestaProgramada): LlamadaFetch[] {
  const llamadas: LlamadaFetch[] = [];

  const fetchMock = jest.fn(async (entrada: unknown, init: RequestInit = {}) => {
    const llamada: LlamadaFetch = { url: String(entrada), init };
    llamadas.push(llamada);
    const indice = llamadas.length - 1;
    const regla = typeof responder === "function" ? responder(llamada, indice) : responder;

    if ("lanzar" in regla) throw regla.lanzar;

    const texto =
      regla.texto ?? (regla.cuerpo === undefined ? "" : JSON.stringify(regla.cuerpo));
    return new Response(texto, { status: regla.status ?? 200 });
  }) as unknown as typeof fetch;

  globalThis.fetch = fetchMock;
  return llamadas;
}

/** Devuelve el doble de fetch instalado (para aserciones de llamadas). */
export function fetchActual(): jest.Mock {
  return globalThis.fetch as unknown as jest.Mock;
}

/** Restaura el fetch original. */
export function restaurarFetch(): void {
  globalThis.fetch = fetchOriginal;
}
