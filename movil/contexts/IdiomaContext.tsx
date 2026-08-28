// ─────────────────────────────────────────────────────────────
// Idioma — mecanismo propio como la WEB (sin librerías):
// diccionario plano {clave:{es,en}} + persistencia en
// AsyncStorage['pf_idioma'] (misma clave que la web usa en
// localStorage). Las cadenas de datos (productos, etc.) vienen del
// backend; aquí se traduce la INTERFAZ móvil.
// ─────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export type Idioma = "es" | "en";

const CLAVE_IDIOMA = "pf_idioma";

const DICCIONARIO: Record<string, { es: string; en: string }> = {
  // Navbar / menú usuario
  "nav.inicio": { es: "Inicio", en: "Home" },
  "nav.productos": { es: "Productos", en: "Products" },
  "nav.tecnicos": { es: "Técnicos", en: "Technicians" },
  "nav.citas": { es: "Citas", en: "Appointments" },
  "nav.ayuda": { es: "Ayuda", en: "Help" },
  "nav.carrito": { es: "Carrito", en: "Cart" },
  "nav.notificaciones": { es: "Notificaciones", en: "Notifications" },
  "menu.herramientas": { es: "Herramientas", en: "Tools" },
  "menu.miPerfil": { es: "Mi perfil", en: "My profile" },
  "menu.cambiarPassword": { es: "Cambiar contraseña", en: "Change password" },
  "menu.misPedidos": { es: "Mis pedidos", en: "My orders" },
  "menu.misServicios": { es: "Mis servicios", en: "My services" },
  "menu.misFavoritos": { es: "Mis favoritos", en: "My favorites" },
  "menu.misReembolsos": { es: "Mis reembolsos", en: "My refunds" },
  "menu.misResenas": { es: "Mis reseñas", en: "My reviews" },
  "menu.misTecnicos": { es: "Mis técnicos", en: "My technicians" },
  "menu.misFacturas": { es: "Mis facturas", en: "My invoices" },
  "menu.idioma": { es: "Idioma", en: "Language" },
  "menu.cerrarSesion": { es: "Cerrar sesión", en: "Log out" },
  // Perfil
  "perfil.titulo": { es: "Mi perfil", en: "My profile" },
  "perfil.nombres": { es: "Nombres", en: "First name" },
  "perfil.apellidos": { es: "Apellidos", en: "Last name" },
  "perfil.correo": { es: "Correo electrónico", en: "Email" },
  "perfil.tipoDoc": { es: "Tipo de documento", en: "Document type" },
  "perfil.documento": { es: "Documento", en: "Document number" },
  "perfil.telefono": { es: "Teléfono", en: "Phone" },
  "perfil.direccion": { es: "Dirección", en: "Address" },
  "perfil.editar": { es: "Editar perfil", en: "Edit profile" },
  "perfil.guardar": { es: "Guardar cambios", en: "Save changes" },
  "perfil.confirmarTitulo": {
    es: "¿Estás seguro que quieres editar tu perfil?",
    en: "Are you sure you want to edit your profile?",
  },
  "perfil.confirmarBody": {
    es: "Podrás modificar tus datos y luego guardarlos.",
    en: "You will be able to modify your data and then save it.",
  },
  "perfil.aceptar": { es: "Aceptar", en: "Accept" },
  "perfil.rechazar": { es: "Rechazar", en: "Reject" },
  "perfil.telefonoInvalido": {
    es: "El teléfono debe tener exactamente 10 dígitos",
    en: "Phone must be exactly 10 digits",
  },
  "perfil.guardadoOk": {
    es: "Cambios guardados correctamente",
    en: "Changes saved successfully",
  },
  "perfil.cambiarFoto": { es: "Cambiar foto", en: "Change photo" },
  "perfil.eliminarFoto": { es: "Eliminar foto", en: "Remove photo" },
  "perfil.inhabilitar": { es: "Inhabilitar mi cuenta", en: "Disable my account" },
  "perfil.inhabilitarMotivo": {
    es: "Motivo de la inhabilitación",
    en: "Reason for disabling",
  },
  "perfil.inhabilitarMensaje": {
    es: "Se enviará una solicitud al administrador para inhabilitar tu cuenta. El administrador deberá revisar y aprobar la solicitud.",
    en: "A request will be sent to the administrator to disable your account. The administrator must review and approve it.",
  },
  "perfil.enviarSolicitud": { es: "Enviar solicitud", en: "Send request" },
  "perfil.solicitudEnviada": {
    es: "Solicitud de inhabilitación enviada al administrador",
    en: "Account disabling request sent to the administrator",
  },
  "perfil.solicitudPendiente": {
    es: "Tienes una solicitud pendiente de aprobación.",
    en: "You have a pending request.",
  },
  "perfil.solicitudRechazada": {
    es: "Tu última solicitud fue rechazada. Puedes intentarlo de nuevo.",
    en: "Your last request was rejected. You can try again.",
  },
  "perfil.correoCodigoEnviado": {
    es: "Enviamos un código de verificación a tu correo actual",
    en: "We sent a verification code to your current email",
  },
  "perfil.correoVerificado": {
    es: "Correo verificado y actualizado correctamente",
    en: "Email verified and updated successfully",
  },
  "perfil.codigoIncorrecto": {
    es: "El código de verificación es incorrecto.",
    en: "The verification code is incorrect.",
  },
  "perfil.codigoExpirado": {
    es: "El código de verificación ha expirado.",
    en: "The verification code has expired.",
  },
  "common.guardando": { es: "Guardando...", en: "Saving..." },
  "common.cancelar": { es: "Cancelar", en: "Cancel" },
  "common.confirmar": { es: "Confirmar", en: "Confirm" },
  "common.reenviar": { es: "Reenviar código", en: "Resend code" },
  "common.cargando": { es: "Cargando...", en: "Loading..." },
};

interface IdiomaContextValue {
  idioma: Idioma;
  setIdioma: (idioma: Idioma) => Promise<void>;
  /** Traduce una clave con fallback es → clave. */
  t: (clave: string) => string;
}

const IdiomaContext = createContext<IdiomaContextValue | null>(null);

export function IdiomaProvider({ children }: { children: React.ReactNode }) {
  const [idioma, setIdiomaEstado] = useState<Idioma>("es");

  useEffect(() => {
    AsyncStorage.getItem(CLAVE_IDIOMA)
      .then((guardado) => {
        if (guardado === "en" || guardado === "es") setIdiomaEstado(guardado);
      })
      .catch(() => {});
  }, []);

  const setIdioma = useCallback(async (nuevo: Idioma) => {
    setIdiomaEstado(nuevo);
    await AsyncStorage.setItem(CLAVE_IDIOMA, nuevo).catch(() => {});
  }, []);

  const t = useCallback(
    (clave: string) => {
      const entrada = DICCIONARIO[clave];
      if (!entrada) return clave;
      return entrada[idioma] ?? entrada.es;
    },
    [idioma],
  );

  const valor = useMemo(
    () => ({ idioma, setIdioma, t }),
    [idioma, setIdioma, t],
  );

  return (
    <IdiomaContext.Provider value={valor}>{children}</IdiomaContext.Provider>
  );
}

export function useIdioma(): IdiomaContextValue {
  const ctx = useContext(IdiomaContext);
  if (!ctx) throw new Error("useIdioma debe usarse dentro de <IdiomaProvider>");
  return ctx;
}
