// Filtro genérico de listas históricas: búsqueda textual en varios campos + rango de fechas.
// Comparte la lógica usada por los modales de historial de los paneles administrativos.

export interface OpcionesFiltroHistorico {
  busqueda?: string;
  desde?: string;
  hasta?: string;
}

export function filtrarConBusquedaYFechas<T extends Record<string, any>>(
  items: T[],
  camposBusqueda: string[],
  opciones: OpcionesFiltroHistorico,
): T[] {
  let resultado = items;
  const q = (opciones.busqueda || '').toLowerCase();
  if (q) {
    resultado = resultado.filter((item) =>
      camposBusqueda.some((campo) => String(item[campo] || '').toLowerCase().includes(q)),
    );
  }
  const desde = opciones.desde;
  if (desde) {
    resultado = resultado.filter((item) => {
      const fecha = item.fecha || item.fecha_entrega || item.created_at;
      return fecha && fecha >= desde;
    });
  }
  const hasta = opciones.hasta;
  if (hasta) {
    resultado = resultado.filter((item) => {
      const fecha = item.fecha || item.fecha_entrega || item.created_at;
      return fecha && fecha <= hasta;
    });
  }
  return resultado;
}
