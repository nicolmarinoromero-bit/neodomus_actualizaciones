/* Umbral de stock bajo (debe coincidir con STOCK_MINIMO del backend,
   be/app/routers/productos.py). Los productos con stock >= STOCK_MINIMO
   se consideran "disponible"; entre 1 y STOCK_MINIMO-1 "bajo"; 0 => "agotado". */
export const STOCK_MINIMO = 5;

export type EstadoStock = 'disponible' | 'bajo' | 'agotado';

export const estadoStock = (stock: number): EstadoStock => {
  if (stock <= 0) return 'agotado';
  if (stock < STOCK_MINIMO) return 'bajo';
  return 'disponible';
};

export const textoStock = (stock: number): string => {
  const estado = estadoStock(stock);
  if (estado === 'agotado') return 'Sin stock';
  if (estado === 'bajo') return `${stock} u. · stock bajo`;
  return `${stock} u.`;
};

/* Clase de badge existente en el panel: ok (verde) / warn (amarillo) / err (rojo). */
export const badgeStock = (stock: number): 'ok' | 'warn' | 'err' => {
  const estado = estadoStock(stock);
  if (estado === 'agotado') return 'err';
  if (estado === 'bajo') return 'warn';
  return 'ok';
};

/* ── Categorías de consulta/soporte (debe coincidir con CATEGORIAS_CONSULTA del backend) ── */

export const CATEGORIAS_CONSULTA: Record<string, string> = {
  'consulta-general': 'Consulta general',
  'soporte-tecnico': 'Soporte técnico',
  pedido: 'Pedido',
  pago: 'Pago',
  reembolso: 'Reembolso',
  reclamo: 'Reclamo',
  otro: 'Otro',
};

export const CATEGORIAS_CONSULTA_ORDER: string[] = Object.keys(CATEGORIAS_CONSULTA);

export const nombreCategoria = (categoria?: string | null): string =>
  categoria ? CATEGORIAS_CONSULTA[categoria] || categoria : 'Sin clasificar';

export const badgeCategoria = (categoria?: string | null): 'info' | 'warn' | 'ok' | 'neutral' => {
  switch (categoria) {
    case 'solicitud':
    case 'soporte-tecnico':
      return 'warn';
    case 'pedido':
    case 'pago':
    case 'reembolso':
      return 'ok';
    case 'reclamo':
      return 'err' as 'info' | 'warn' | 'ok' | 'neutral';
    case 'consulta-general':
      return 'info';
    default:
      return 'neutral';
  }
};