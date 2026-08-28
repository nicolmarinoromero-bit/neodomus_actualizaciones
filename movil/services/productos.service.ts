// ─────────────────────────────────────────────────────────────
// Servicio de productos públicos.
// Endpoints reales del backend (prefijo /api/v1, be/app/routers/productos.py):
// - GET /productos/?page=&limit=&search=   → { total, page, limit, total_pages, data[] }
// - GET /productos/categorias              → Categoria[]
// - GET /productos/{id}                    → Producto (raíz)
// La WEB usa limit=100 y filtra/pagina en cliente; el móvil replica eso.
// ─────────────────────────────────────────────────────────────

import { apiFetch } from "./api";
import { BACKEND_HOST_URL } from "@/constants/api";

export interface VarianteProducto {
  id: number;
  nombre: string;
  hex?: string | null;
  tamaño?: string | null;
  ancho_cm?: number | null;
  alto_cm?: number | null;
  etiqueta_medida?: string | null;
  precio?: number | null;
  imagen_url?: string | null;
  stock: number;
}

/** Shape real del backend: routers/productos.py → ProductoResponse. */
export interface Producto {
  id_producto: number;
  nombre_producto: string;
  marca?: string | null;
  venta_por_metros?: boolean;
  referencia_producto?: string | null;
  precio_venta_producto: number;
  imagen_url?: string | null;
  id_cate_pr?: number | null;
  nombre_categoria?: string | null;
  descripcion_producto?: string | null;
  caracteristicas_producto?: string | null;
  estado_producto?: string;
  stock_producto?: number;
  stock_estado?: 'disponible' | 'bajo' | 'agotado';
  descuento_activo?: number | null;
  precio_final?: number | null;
  promocion_hasta?: string | null;
  es_nuevo?: boolean;
  tecnicos_requeridos?: number;
  dificultad_instalacion?: string | null;
  variantes?: VarianteProducto[];
}

export interface ListaProductos {
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  data: Producto[];
}

export interface CategoriaProducto {
  id_categoria: number;
  nombre_categoria: string;
  descripcion: string;
}

/**
 * Igual que la WEB: GET /productos/ CON barra final.
 * La ruta del backend está definida como router "/" con prefijo
 * "/productos" → /api/v1/productos/. Sin la barra el backend
 * responde 405 y el catálogo fallaría.
 */
export const listarProductos = () =>
  apiFetch<ListaProductos>("/productos/?limit=100");

export const obtenerCategorias = () =>
  apiFetch<CategoriaProducto[]>("/productos/categorias");

export const obtenerProducto = (id: number | string) =>
  apiFetch<Producto>(`/productos/${id}`);

/**
 * Resuelve la imagen EXACTAMENTE como la WEB (ProductosPublicos.getImagen):
 *   1. imagen_url del backend (absoluta o relativa → se completa con el host).
 *   2. Convención cuando viene vacía: archivo convencional {id}.jpg servido
 *      por el backend en /uploads (be/app/static/productos).
 * Si nada carga, la UI muestra el placeholder de Neodomus.
 */
export const urlImagenProducto = (
  producto: Pick<Producto, 'id_producto' | 'imagen_url'>,
  variante?: VarianteProducto | null,
): string => {
  const cruda = variante?.imagen_url || producto.imagen_url;
  if (!cruda) {
    return `${BACKEND_HOST_URL}/uploads/${producto.id_producto}.jpg`;
  }
  return cruda.startsWith('/')
    ? `${BACKEND_HOST_URL}${cruda}`
    : cruda;
};

export const tieneDescuento = (producto: Producto): boolean =>
  producto.precio_final != null &&
  !!producto.descuento_activo &&
  producto.descuento_activo > 0;

export const precioFinalDe = (producto: Producto): number =>
  producto.precio_final ?? producto.precio_venta_producto;

/** Formato de la web: `$${monto.toLocaleString()}` + sufijo COP. */
export const formatearPrecio = (monto: number): string =>
  `$${Math.round(monto).toLocaleString('es-CO')}`;
