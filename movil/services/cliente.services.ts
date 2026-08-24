// ─────────────────────────────────────────────────────────────
// Servicios del USUARIO AUTENTICADO (cliente) — endpoints REALES
// de la WEB, replicados 1:1 (fe/src/pages/cliente + Checkout).
// ─────────────────────────────────────────────────────────────

import { apiFetch, ApiError } from "./api";
import { API_BASE_URL } from "@/constants/api";
// API clásica de FileSystem (cacheDirectory/downloadAsync) estable en SDK 54.
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

// Cambio de contraseña (reexport del servicio de auth)
export { cambiarPassword } from "./auth.services";

// ── Perfil ───────────────────────────────────────────────────

export interface PerfilCliente {
  first_name: string;
  last_name: string;
  email: string;
  id_tipo_documento_c?: number | null;
  documento_cliente?: number | null;
  telefono_cliente?: number | null;
  address?: string | null;
}

export const obtenerPerfilCliente = () =>
  apiFetch<PerfilCliente>("/clients/me");

export const actualizarPerfilCliente = (datos: {
  email: string;
  first_name: string;
  last_name: string;
  id_tipo_documento_c: number | null;
  documento_cliente: number | null;
  telefono_cliente: number | null;
  address: string;
}) =>
  apiFetch<unknown>("/clients/me", {
    method: "PUT",
    body: JSON.stringify(datos),
  });

// ── Cambio de correo con código al correo ACTUAL ─────────────

export const solicitarCambioCorreo = (nuevo_email: string) =>
  apiFetch<unknown>("/auth/request-email-change", {
    method: "POST",
    body: JSON.stringify({ nuevo_email }),
  });

export const verificarCambioCorreo = (code: string, nuevo_email: string) =>
  apiFetch<unknown>("/auth/verify-email-change", {
    method: "POST",
    body: JSON.stringify({ code, nuevo_email }),
  });

// ── Inhabilitar cuenta (solicitud al administrador) ──────────

export const obtenerSolicitudCuenta = () =>
  apiFetch<{ estado?: string | null }>("/clients/me/cuenta-solicitud");

export const crearSolicitudInhabilitar = (motivo: string) =>
  apiFetch<unknown>("/clients/me/cuenta-solicitud", {
    method: "POST",
    body: JSON.stringify({ tipo: "inhabilitar", motivo }),
  });

// ── Pedidos ──────────────────────────────────────────────────

export interface DetallePedido {
  id_detalle: number;
  id_producto_d?: number | null;
  nombre: string;
  cantidad: number;
  metros?: number | null;
  precio_unitario: number;
  subtotal: number;
  es_servicio?: boolean;
  fecha_servicio?: string | null;
}

export interface PagoPedido {
  metodo_pago?: string;
  metodo_pago_nombre?: string;
  estado?: "aprobado" | "rechazado" | "pendiente";
  numero_transaccion?: string;
  codigo_punto_pago?: string;
  banco?: string;
  ultimos_digitos?: string;
}

export interface Pedido {
  id_pedido: number;
  fecha?: string;
  total: number;
  estado:
    | "Pagado"
    | "Pago pendiente"
    | "Pago rechazado"
    | "Cancelado"
    | string;
  pago?: PagoPedido;
  factura?: {
    id_factura: number;
    numero_factura: string;
    enviada_por_correo?: boolean;
    pdf_url?: string;
  } | null;
  detalles: DetallePedido[];
  fecha_entrega?: string | null;
  hora_entrega?: string | null;
  hora_entrega_fin?: string | null;
  nombre_tecnico_entrega?: string | null;
  telefono_tecnico_entrega?: string | null;
  estado_entrega?: string | null;
}

export const listarMisPedidos = () =>
  apiFetch<Pedido[]>("/pedidos/mis-pedidos");

export const confirmarPagoPedido = (idPedido: number) =>
  apiFetch<unknown>(`/pedidos/${idPedido}/confirmar-pago`, {
    method: "POST",
  });

export interface PasoSeguimiento {
  paso: string;
  completado: boolean;
}

export interface SeguimientoPedido {
  estado_entrega: string;
  pasos: PasoSeguimiento[];
  rango_entrega?: string | null;
  tecnico?: {
    nombre?: string | null;
    telefono?: string | null;
    foto?: string | null;
  } | null;
  ubicacion?: {
    latitud: number;
    longitud: number;
    actualizado_en?: string;
  } | null;
}

export const obtenerSeguimiento = (idPedido: number) =>
  apiFetch<SeguimientoPedido>(`/pedidos/${idPedido}/seguimiento`);

/** Descarga el PDF REAL generado por el backend y lo abre/comparte. */
export async function descargarFacturaPdf(
  pdfUrl: string,
  accessToken: string,
): Promise<string> {
  // La web quita '/api/v1' porque axios ya lo incluye en baseURL;
  // API_BASE_URL móvil también lo incluye → misma URL final.
  const ruta = pdfUrl.replace(/^\/api\/v1/, "");
  const url = `${API_BASE_URL}${ruta}`;

  const destino = `${FileSystem.cacheDirectory}factura_${(
    ruta.match(/\/(\d+)\/factura/) || [])[1] || Date.now()
  }.pdf`;

  const resultado = await FileSystem.downloadAsync(url, destino, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!(await Sharing.isAvailableAsync())) {
    return resultado.uri; // Sin compartir nativo: queda en caché.
  }
  await Sharing.shareAsync(resultado.uri, {
    mimeType: "application/pdf",
    dialogTitle: "Factura Neodomus",
    UTI: "com.adobe.pdf",
  });
  return resultado.uri;
}

// ── Citas ────────────────────────────────────────────────────

export type TipoServicio =
  | "instalacion"
  | "mantenimiento"
  | "reparacion"
  | "revision"
  | "soporte";

export interface Cita {
  id_cita: number;
  tipo_servicio: string;
  fecha: string;
  hora: string;
  direccion: string;
  descripcion?: string | null;
  id_tecnico?: number | null;
  nombre_tecnico?: string | null;
  tecnico_telefono?: string | null;
  tecnico_email?: string | null;
  calificada?: boolean;
  costo_cita?: number | null;
  estado_pago?: string | null;
  estado: "Pendiente" | "Confirmada" | "Finalizada" | "Cancelada" | string;
}

export const listarMisCitas = () => apiFetch<Cita[]>("/citas/mis-citas");

export const crearCita = (datos: {
  tipo_servicio: string;
  fecha: string;
  hora: string;
  direccion: string;
  descripcion: string;
  id_tecnico: number | null;
  nombre_tecnico: string | null;
  metodo_pago: string;
  datos_pago: Record<string, unknown>;
}) =>
  apiFetch<{ redirect_url?: string }>("/citas", {
    method: "POST",
    body: JSON.stringify(datos),
  });

export const actualizarCita = (
  idCita: number,
  datos: {
    tipo_servicio: string;
    fecha: string;
    hora: string;
    direccion: string;
    descripcion: string;
    id_tecnico: number | null;
    nombre_tecnico: string | null;
  },
) =>
  apiFetch<unknown>(`/citas/${idCita}`, {
    method: "PUT",
    body: JSON.stringify(datos),
  });

export const cancelarCita = (idCita: number) =>
  apiFetch<unknown>(`/citas/${idCita}`, { method: "DELETE" });

export const listarHorasDisponibles = (params: {
  fecha: string;
  tecnico_id?: number;
  tipo_servicio?: string;
}) => {
  const qs = new URLSearchParams({
    fecha: params.fecha,
    ...(params.tecnico_id
      ? { tecnico_id: String(params.tecnico_id) }
      : {}),
    ...(params.tipo_servicio ? { tipo_servicio: params.tipo_servicio } : {}),
  }).toString();
  return apiFetch<string[]>(`/citas/horas-disponibles?${qs}`);
};

export interface Tarifa {
  tipo_servicio: string;
  costo: number;
}

export const listarTarifas = () => apiFetch<Tarifa[]>("/tarifas");

// ── Técnicos públicos ────────────────────────────────────────

export interface TecnicoPublico {
  id_tecnico: number;
  first_name: string;
  last_name: string;
  certificacion_t?: string | null;
  is_active: boolean;
  disponible?: boolean;
  telefono?: string | null;
  foto_url?: string | null;
  calificacion?: number | null;
}

export const listarTecnicosPublicos = (filtros?: {
  tipo_servicio?: string;
  fecha?: string;
  hora?: string;
}) => {
  const qs = filtros
    ? "?" +
      new URLSearchParams(
        Object.entries(filtros).filter(([, v]) => !!v) as [string, string][],
      ).toString()
    : "";
  return apiFetch<TecnicoPublico[]>(`/tecnicos/publicos${qs}`);
};

// ── Técnicos favoritos (persistidos en backend por cliente) ──

export const listarTecnicosFavoritos = () =>
  apiFetch<TecnicoPublico[]>("/tecnicos/favoritos");

export const agregarTecnicoFavorito = (idTecnico: number) =>
  apiFetch<{ favorito: boolean }>(`/tecnicos/favoritos/${idTecnico}`, {
    method: "POST",
  });

export const eliminarTecnicoFavorito = (idTecnico: number) =>
  apiFetch<{ favorito: boolean }>(`/tecnicos/favoritos/${idTecnico}`, {
    method: "DELETE",
  });

// ── Métodos de pago ──────────────────────────────────────────

export interface MetodosPago {
  bancos: string[];
  metodos: Record<string, unknown>;
}

export const obtenerMetodosPago = () =>
  apiFetch<MetodosPago>("/pedidos/metodos-pago");

// ── Notificaciones (cliente) ─────────────────────────────────

export interface Notificacion {
  id_notificacion: number;
  tipo: string;
  titulo: string;
  mensaje: string;
  leida: boolean;
  fecha_creacion?: string;
}

export const listarNotificaciones = () =>
  apiFetch<Notificacion[]>("/notificaciones/mias");

/** Marca todas las notificaciones propias como leídas (endpoint existente). */
export const marcarNotificacionesLeidas = () =>
  apiFetch<{ msg?: string; actualizadas?: number }>("/notificaciones/leer-todas", {
    method: "PATCH",
  });

// ── Reembolsos / Reseñas / Devoluciones ──────────────────────

export interface Reembolso {
  id_reembolso: number;
  referencia: string;
  monto: number;
  estado: string;
  motivo?: string | null;
  created_at: string;
}

export const listarMisReembolsos = () =>
  apiFetch<Reembolso[]>("/reembolsos/mis");

export interface ResenaTecnico {
  id_calificacion: number;
  calificacion: number;
  comentario?: string | null;
  created_at?: string;
  nombre_tecnico?: string | null;
  tipo_servicio?: string | null;
  fecha_cita?: string | null;
}

export const listarMisResenas = () =>
  apiFetch<ResenaTecnico[]>("/calificaciones/mis-dadas");

export const calificarTecnico = (datos: {
  id_cita: number;
  calificacion: number;
  comentario?: string;
}) =>
  apiFetch<unknown>("/calificaciones", {
    method: "POST",
    body: JSON.stringify(datos),
  });

// ── Checkout: crear pedido (body EXACTO de la web) ───────────

export const crearPedido = (payload: {
  items: {
    id_producto: number;
    cantidad: number;
    metros?: number;
    color?: string;
    tamaño?: string;
    id_variante?: number;
  }[];
  servicios: {
    nombre: string;
    tipo_servicio: string;
    precio: number;
    fecha?: string;
    hora: string;
    id_tecnico?: number;
    id_tecnico_2?: number;
    id_tecnico_3?: number;
  }[];
  pago: Record<string, unknown>;
}) =>
  apiFetch<{
    redirect_url?: string;
    pedido?: { id_pedido: number };
    pago?: {
      estado: "aprobado" | "pendiente" | "rechazado";
      numero_transaccion?: string;
      codigo_punto_pago?: string;
      referencia_pago?: string;
      fecha_limite?: string;
    };
    factura?: { numero_factura: string; enviada_por_correo?: boolean };
    pdf_url?: string;
    ordenes_instalacion?: Record<string, unknown>[];
    entrega?: Record<string, unknown>;
  }>("/pedidos", { method: "POST", body: JSON.stringify(payload) });
