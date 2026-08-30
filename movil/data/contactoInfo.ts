// ─────────────────────────────────────────────────────────────
// Datos de contacto público — textos literales de la WEB
// (AyudaPage.tsx · tarjetas infoContacto + Canales adicionales).
// Compartidos por el tab Ayuda y la pantalla Contacto.
// ─────────────────────────────────────────────────────────────

export interface TarjetaContacto {
  icono: string;
  titulo: string;
  valor: string;
  detalle: string;
  enlace: string | null;
}

export const INFO_CONTACTO: TarjetaContacto[] = [
  {
    icono: "envelope",
    titulo: "Correo de soporte",
    valor: "soporte@neodomus.com",
    detalle: "Respondemos en 24h hábiles",
    enlace: "mailto:soporte@neodomus.com",
  },
  {
    icono: "phone",
    titulo: "Línea de atención",
    valor: "+57 601 123 4567",
    detalle: "Lun-Vie 8:00 - 18:00",
    enlace: "tel:+576011234567",
  },
  {
    icono: "clock",
    titulo: "Horario de atención",
    valor: "Lunes a Viernes",
    detalle: "8:00 AM - 6:00 PM",
    enlace: null,
  },
  {
    icono: "location-dot",
    titulo: "Oficina principal",
    valor: "Cra 15 #93-47, Bogotá",
    detalle: "Solo con cita previa",
    enlace: null,
  },
];

export const CANALES_ADICIONALES: string[] = [
  "Chat en vivo (próximamente)",
  "WhatsApp Business: +57 300 123 4567",
  "Redes sociales: @NeodomusOficial",
];
