// Consulta las solicitudes de ayuda del cliente y registra la lectura de respuestas.
import { apiFetch } from "./api";

export interface SolicitudCliente {
  id: number;
  asunto: string;
  mensaje: string;
  categoria?: string | null;
  estado: string;
  respuesta?: string | null;
  created_at?: string | null;
  responded_at?: string | null;
  respuesta_no_leida: boolean;
}

export const listarSolicitudesCliente = () =>
  apiFetch<SolicitudCliente[]>("/contacto/mias");

export const marcarRespuestaSolicitudLeida = (id: number) =>
  apiFetch<unknown>(`/contacto/mias/${id}/respuesta/leida`, { method: "PATCH" });
