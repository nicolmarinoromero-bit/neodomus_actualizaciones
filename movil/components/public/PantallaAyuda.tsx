import LocalizedNotificationText from "@/components/common/LocalizedNotificationText";
// ─────────────────────────────────────────────────────────────
// Pantalla Ayuda (Centro de Ayuda) — adaptación móvil de la
// AyudaPage WEB. Compartida por el TAB Ayuda y la ruta apilada /ayuda.
// Mismos tabs que la web: FAQ · asistente · contacto · consulta y,
// para clientes autenticados, seguimiento de solicitudes. FAQs con
// /faq como la web, que cae al fallback), contactos literales.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import type { ScrollViewInstance } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import PublicScreen from "@/components/public/PublicScreen";
import ChatBot from "@/components/chat/ChatBot";
import FormularioContacto from "@/components/public/FormularioContacto";
import {
  CANALES_ADICIONALES,
  INFO_CONTACTO,
} from "@/data/contactoInfo";
import { apiFetch } from "@/services/api";
import { useScrollTopAlEntrar } from "@/hooks/useScrollTopAlEntrar";
import { useIdioma } from "@/contexts/IdiomaContext";
import { useAuth } from "@/contexts/AuthContext";
import {
  listarSolicitudesCliente,
  marcarRespuestaSolicitudLeida,
  type SolicitudCliente,
} from "@/services/solicitudes.service";
type TabAyuda = "faq" | "asistente" | "contacto" | "consulta" | "solicitudes";

interface FAQ {
  id: number;
  pregunta: string;
  respuesta: string;
  categoria: string;
}

// Fallback literal de la WEB (faqsMock en AyudaPage.tsx).
const clavesFaq = [
  ["publico.pregunta1", "publico.respuesta1", "publico.catPedidos"],
  ["publico.pregunta2", "publico.respuesta2", "publico.catPagos"],
  ["publico.pregunta3", "publico.respuesta3", "publico.catCitas"],
  ["publico.pregunta4", "publico.respuesta4", "publico.catCitas"],
  ["publico.pregunta5", "publico.respuesta5", "publico.catCuenta"],
  ["publico.pregunta6", "publico.respuesta6", "publico.catEnvios"],
  ["publico.pregunta7", "publico.respuesta7", "publico.catServicios"],
  ["publico.pregunta8", "publico.respuesta8", "publico.catContacto"],
] as const;

const TABS: { id: TabAyuda; clave: string; icono: string }[] = [
  { id: "faq", clave: "publico.tabFaq", icono: "circle-question" },
  { id: "asistente", clave: "publico.asistenteVirtual", icono: "robot" },
  { id: "contacto", clave: "publico.contacto", icono: "headset" },
  { id: "consulta", clave: "publico.enviarConsulta", icono: "paper-plane" },
];
const TAB_SOLICITUDES = { id: "solicitudes" as const, clave: "ayuda.solicitudes.titulo", icono: "message" };

// Comunica con el backend mediante API "/faq".
export default function PantallaAyuda() {
  const { t, idioma } = useIdioma();
  const { autenticado } = useAuth();
  const scrollRef = useRef<ScrollViewInstance | null>(null);
  // Entrar a Ayuda desde otra sección → empezar arriba.
  useScrollTopAlEntrar(scrollRef);
  const [tabActivo, setTabActivo] = useState<TabAyuda>("faq");
  const faqsMock = useMemo(
    () =>
      clavesFaq.map(([pregunta, respuesta, categoria], index) => ({
        id: index + 1,
        pregunta: t(pregunta),
        respuesta: t(respuesta),
        categoria,
      })),
    [t],
  );
  const [faqsRemotos, setFaqsRemotos] = useState<FAQ[] | null>(null);
  const faqs = faqsRemotos ?? faqsMock;
  const [cargandoFaqs, setCargandoFaqs] = useState(true);
  const [faqAbierta, setFaqAbierta] = useState<number | null>(null);
  const [toast, setToast] = useState<{ msg: string; tipo: "success" | "error" } | null>(null);
  const [solicitudes, setSolicitudes] = useState<SolicitudCliente[]>([]);
  const [cargandoSolicitudes, setCargandoSolicitudes] = useState(false);
  const [solicitudAbierta, setSolicitudAbierta] = useState<number | null>(null);

  const cargarSolicitudes = async () => {
    if (!autenticado) return;
    setCargandoSolicitudes(true);
    try {
      setSolicitudes(await listarSolicitudesCliente());
    } catch {
      setToast({ msg: t("ayuda.solicitudes.errorCarga"), tipo: "error" });
    } finally {
      setCargandoSolicitudes(false);
    }
  };

  const abrirSolicitud = async (solicitud: SolicitudCliente) => {
    const abrir = solicitudAbierta !== solicitud.id;
    setSolicitudAbierta(abrir ? solicitud.id : null);
    if (!abrir || !solicitud.respuesta_no_leida) return;
    try {
      await marcarRespuestaSolicitudLeida(solicitud.id);
      setSolicitudes((actuales) => actuales.map((item) =>
        item.id === solicitud.id ? { ...item, respuesta_no_leida: false } : item,
      ));
    } catch {
      setToast({ msg: t("ayuda.solicitudes.errorLeida"), tipo: "error" });
    }
  };

  const tabsAyuda = autenticado ? [...TABS, TAB_SOLICITUDES] : TABS;


  useEffect(() => {
    let activo = true;
    // Igual que la web: intenta /faq; si falla usa el fallback literal.
    apiFetch<{ data?: FAQ[] } | FAQ[]>("/faq")
      .then((datos) => {
        if (!activo) return;
        const lista = Array.isArray(datos) ? datos : (datos.data ?? []);
        if (lista.length > 0) {
          setFaqsRemotos(lista);
        }
      })
      .catch(() => {})
      .finally(() => {
        if (activo) setCargandoFaqs(false);
      });
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const temporizador = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(temporizador);
  }, [toast]);

  const categorias = [...new Set(faqs.map((faq) => faq.categoria))];
  const etiquetaCategoria = (categoria: string) => {
    const clave = clavesFaq.find(
      ([, , categoriaClave]) => t(categoriaClave) === categoria,
    )?.[2];
    return (clave ? t(clave) : categoria).toUpperCase();
  };

  return (
    <PublicScreen scrollRef={scrollRef}>
      <View style={styles.contenedor}>
        <Text style={styles.titulo}>{t("publico.centroAyuda")}</Text>
        <Text style={styles.subtitulo}>
          {t("publico.ayudaDescripcion")}
        </Text>

        {/* Tabs internos */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tabs}
        >
          {tabsAyuda.map((tab) => (
            <Pressable
              key={tab.id}
              onPress={() => {
                setTabActivo(tab.id);
                if (tab.id === "solicitudes") void cargarSolicitudes();
              }}
              style={[styles.tab, tabActivo === tab.id && styles.tabActivo]}
            >
              <FontAwesome6
                name={(tab.icono as never) || "circle-question"}
                size={13}
                color={tabActivo === tab.id ? C.textoSobreOro : C.oroSuave}
              />
              <Text
                style={[
                  styles.tabTexto,
                  tabActivo === tab.id && styles.tabTextoActivo,
                ]}
              >
                {t(tab.clave)}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        {/* ── FAQ ── */}
        {tabActivo === "faq" && (
          cargandoFaqs ? (
            <View style={styles.centro}>
              <ActivityIndicator color={C.oro} />
              <Text style={styles.cargandoTexto}>
                {t("publico.cargandoPreguntas")}
              </Text>
            </View>
          ) : (
            <View style={styles.seccion}>
              {categorias.map((categoria) => (
                <View key={categoria} style={styles.grupoFaq}>
                  <Text style={styles.categoriaTitulo}>
                    {etiquetaCategoria(categoria)}
                  </Text>
                  {faqs
                    .filter((faq) => faq.categoria === categoria)
                    .map((faq) => (
                      <View
                        key={faq.id}
                        style={styles.tarjetaFaq}
                      >
                        <Pressable
                          style={styles.faqCabecera}
                          onPress={() =>
                            setFaqAbierta(faqAbierta === faq.id ? null : faq.id)
                          }
                        >
                          <Text style={styles.faqPregunta}>{faq.pregunta}</Text>
                          <FontAwesome6
                            name={
                              faqAbierta === faq.id
                                ? "chevron-up"
                                : "chevron-down"
                            }
                            size={13}
                            color={C.oroSuave}
                          />
                        </Pressable>
                        {faqAbierta === faq.id && (
                          <Text style={styles.faqRespuesta}>{faq.respuesta}</Text>
                        )}
                      </View>
                    ))}
                </View>
              ))}

              <View style={styles.ctaFaq}>
                <Text style={styles.ctaFaqTitulo}>
                  {t("publico.noRespuesta")}
                </Text>
                <Pressable
                  style={({ pressed }) => [
                    styles.botonPrimario,
                    pressed && styles.presionado,
                  ]}
                  onPress={() => setTabActivo("consulta")}
                >
                  <Text style={styles.textoBotonPrimario}>
                    {t("publico.enviarPregunta")}
                  </Text>
                </Pressable>
              </View>
            </View>
          )
        )}

        {/* ── Asistente virtual ── */}
        {tabActivo === "asistente" && <ChatBot />}

        {/* ── Contacto ── */}
        {tabActivo === "contacto" && (
          <View style={styles.seccion}>
            {INFO_CONTACTO.map((item) => (
              <Pressable
                key={item.tituloClave}
                disabled={!item.enlace}
                onPress={() =>
                  item.enlace && Linking.openURL(item.enlace).catch(() => {})
                }
                style={styles.tarjetaContacto}
              >
                <View style={styles.contactoIcono}>
                  <FontAwesome6
                    name={(item.icono as never) || "circle-info"}
                    size={16}
                    color={C.textoSobreOro}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.contactoTitulo}>{t(item.tituloClave)}</Text>
                  <Text style={styles.contactoValor}>
                    {item.valorClave ? t(item.valorClave) : item.valor}
                  </Text>
                  <Text style={styles.contactoDetalle}>{t(item.detalleClave)}</Text>
                </View>
                {!!item.enlace && (
                  <FontAwesome6
                    name="arrow-up-right-from-square"
                    size={13}
                    color={C.grisTexto}
                  />
                )}
              </Pressable>
            ))}

            <View style={styles.canalesAdicionales}>
              <Text style={styles.canalesTitulo}>{t("publico.canalesAdicionales")}</Text>
              {CANALES_ADICIONALES.map((canalClave) => (
                <Text key={canalClave} style={styles.canalLinea}>
                  {canalClave === "contacto.whatsapp"
                    ? `${t(canalClave)}: +57 300 123 4567`
                    : canalClave === "contacto.redes"
                      ? `${t(canalClave)}: @NeodomusOficial`
                      : t(canalClave)}
                </Text>
              ))}
            </View>
          </View>
        )}

        {/* ── Enviar consulta ── */}
        {tabActivo === "consulta" && (
          <FormularioContacto
            alEnviado={(msg, tipo) => setToast({ msg, tipo })}
          />
        )}

        {tabActivo === "solicitudes" && autenticado && (
          <View style={styles.solicitudesSeccion}>
            <View style={styles.solicitudesCabecera}>
              <Text style={styles.solicitudesTitulo}>{t("ayuda.solicitudes.titulo")}</Text>
              <Pressable
                accessibilityRole="button"
                onPress={() => void cargarSolicitudes()}
                disabled={cargandoSolicitudes}
                style={styles.botonActualizar}
              >
                <FontAwesome6 name="arrows-rotate" size={13} color={C.oroSuave} />
                <Text style={styles.botonActualizarTexto}>{t("ayuda.solicitudes.actualizar")}</Text>
              </Pressable>
            </View>
            {cargandoSolicitudes ? (
              <View style={styles.centro}>
                <ActivityIndicator color={C.oro} />
                <Text style={styles.cargandoTexto}>{t("ayuda.solicitudes.cargando")}</Text>
              </View>
            ) : solicitudes.length === 0 ? (
              <View style={styles.solicitudVacia}>
                <FontAwesome6 name="message" size={24} color={C.oroSuave} />
                <Text style={styles.solicitudVaciaTitulo}>{t("ayuda.solicitudes.vacio")}</Text>
                <Text style={styles.contactoDetalle}>{t("ayuda.solicitudes.vacioDesc")}</Text>
              </View>
            ) : (
              solicitudes.map((solicitud) => {
                const abierta = solicitudAbierta === solicitud.id;
                const fecha = solicitud.created_at
                  ? new Date(solicitud.created_at).toLocaleDateString(idioma === "en" ? "en-US" : "es-CO", {
                    day: "2-digit", month: "short", year: "numeric",
                  })
                  : "";
                const estadoKey: Record<string, string> = {
                  pendiente: "ayuda.solicitudes.estadoPendiente",
                  en_proceso: "ayuda.solicitudes.estadoProceso",
                  respondida: "ayuda.solicitudes.estadoResuelta",
                  resuelta: "ayuda.solicitudes.estadoResuelta",
                };
                return (
                  <View key={solicitud.id} style={styles.solicitudTarjeta}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityState={{ expanded: abierta }}
                      onPress={() => void abrirSolicitud(solicitud)}
                      style={styles.solicitudBoton}
                    >
                      <View style={{ flex: 1, gap: 6 }}>
                        <Text style={styles.solicitudAsunto}>{solicitud.asunto}</Text>
                        <View style={styles.solicitudMeta}>
                          {!!fecha && <Text style={styles.solicitudMetaTexto}>{fecha}</Text>}
                          <Text style={styles.solicitudEstado}>
                            {t(estadoKey[solicitud.estado] || "ayuda.solicitudes.estadoPendiente")}
                          </Text>
                          {solicitud.respuesta_no_leida && (
                            <Text style={styles.solicitudNueva}>{t("ayuda.solicitudes.nuevaRespuesta")}</Text>
                          )}
                        </View>
                      </View>
                      <FontAwesome6 name={abierta ? "chevron-up" : "chevron-down"} size={13} color={C.oroSuave} />
                    </Pressable>
                    {abierta && (
                      <View style={styles.solicitudDetalle}>
                        <Text style={styles.solicitudMensaje}>{solicitud.mensaje}</Text>
                        {solicitud.respuesta ? (
                          <View style={styles.solicitudRespuesta}>
                            <Text style={styles.solicitudRespuestaTitulo}>{t("ayuda.solicitudes.respuesta")}</Text>
                            <Text style={styles.solicitudMensaje}>{solicitud.respuesta}</Text>
                            {!!solicitud.responded_at && (
                              <Text style={styles.solicitudMetaTexto}>
                                {new Date(solicitud.responded_at).toLocaleDateString(idioma === "en" ? "en-US" : "es-CO")}
                              </Text>
                            )}
                          </View>
                        ) : (
                          <Text style={styles.contactoDetalle}>{t("ayuda.solicitudes.sinRespuesta")}</Text>
                        )}
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </View>
        )}
      </View>

      {toast && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View
            style={[
              styles.toast,
              toast.tipo === "success" ? styles.toastExito : styles.toastError,
            ]}
          >
            <Text style={styles.toastTexto}><LocalizedNotificationText message={toast.msg} /></Text>
          </View>
        </View>
      )}
    </PublicScreen>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 14,
    gap: 14,
  },

  titulo: {
    color: C.blanco,
    fontSize: 25,
    fontFamily: FontFamilies.bodyBold,
  },

  subtitulo: {
    color: C.grisTexto,
    fontSize: 14,
    lineHeight: 20,
    marginTop: -6,
  },

  tabs: {
    gap: 8,
    paddingRight: 16,
  },

  tab: {
    flexDirection: "row",
    alignItems: "center",
    gap: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.bordeOro,
    backgroundColor: "rgba(212,165,75,0.06)",
    paddingVertical: 9,
    paddingHorizontal: 14,
  },

  tabActivo: {
    backgroundColor: C.oro,
    borderColor: C.oro,
  },

  tabTexto: {
    color: C.oroSuave,
    fontSize: 13,
    fontFamily: FontFamilies.bodyMedium,
  },

  tabTextoActivo: {
    color: C.textoSobreOro,
    fontFamily: FontFamilies.button,
  },

  seccion: {
    gap: 10,
    paddingBottom: 10,
  },

  solicitudesSeccion: { gap: 10, paddingBottom: 12 },
  solicitudesCabecera: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  solicitudesTitulo: { color: C.blanco, fontSize: 17, fontFamily: FontFamilies.bodyBold },
  botonActualizar: { flexDirection: "row", alignItems: "center", gap: 7, padding: 8 },
  botonActualizarTexto: { color: C.oroSuave, fontSize: 12.5, fontFamily: FontFamilies.bodyMedium },
  solicitudVacia: { alignItems: "center", gap: 9, padding: 24, backgroundColor: C.cardOscura, borderRadius: 16, borderWidth: 1, borderColor: C.grisBorde },
  solicitudVaciaTitulo: { color: C.blanco, fontSize: 15, fontFamily: FontFamilies.bodyBold, textAlign: "center" },
  solicitudTarjeta: { borderRadius: 14, borderWidth: 1, borderColor: C.grisBorde, backgroundColor: C.cardOscura, overflow: "hidden" },
  solicitudBoton: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, padding: 14 },
  solicitudAsunto: { color: C.blanco, fontSize: 14, fontFamily: FontFamilies.bodyBold },
  solicitudMeta: { flexDirection: "row", alignItems: "center", flexWrap: "wrap", gap: 7 },
  solicitudMetaTexto: { color: C.grisTexto, fontSize: 11.5 },
  solicitudEstado: { color: C.oroSuave, fontSize: 11.5, fontFamily: FontFamilies.bodyMedium },
  solicitudNueva: { color: C.verdeExito, fontSize: 11.5, fontFamily: FontFamilies.bodyBold },
  solicitudDetalle: { borderTopWidth: 1, borderTopColor: C.grisBorde, padding: 14, gap: 12 },
  solicitudMensaje: { color: C.blanco, fontSize: 13.5, lineHeight: 20 },
  solicitudRespuesta: { borderLeftWidth: 3, borderLeftColor: C.oro, paddingLeft: 11, gap: 6 },
  solicitudRespuestaTitulo: { color: C.oroSuave, fontSize: 13, fontFamily: FontFamilies.bodyBold },

  grupoFaq: { gap: 8 },

  categoriaTitulo: {
    color: C.grisTexto,
    fontSize: 12,
    letterSpacing: 1,
    fontFamily: FontFamilies.bodyBold,
    marginTop: 4,
  },

  tarjetaFaq: {
    backgroundColor: C.cardOscura,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.grisBorde,
    paddingVertical: 4,
    paddingHorizontal: 14,
  },

  faqCabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
    paddingVertical: 13,
  },

  faqPregunta: {
    color: C.blanco,
    fontSize: 14.5,
    fontFamily: FontFamilies.bodyMedium,
    flex: 1,
  },

  faqRespuesta: {
    color: C.grisTexto,
    fontSize: 13.5,
    lineHeight: 21,
    paddingBottom: 13,
  },

  ctaFaq: {
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    marginBottom: 4,
  },

  ctaFaqTitulo: {
    color: C.blanco,
    fontSize: 15,
    fontFamily: FontFamilies.bodyBold,
  },

  botonPrimario: {
    backgroundColor: "#d4a54b",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 22,
  },

  textoBotonPrimario: {
    color: C.textoSobreOro,
    fontFamily: FontFamilies.button,
    fontSize: 14,
  },

  centro: {
    alignItems: "center",
    paddingVertical: 40,
    gap: 10,
  },

  cargandoTexto: {
    color: C.grisTexto,
    fontSize: 13.5,
  },

  tarjetaContacto: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    backgroundColor: C.cardOscura,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.grisBorde,
    padding: 14,
  },

  contactoIcono: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: C.oroClaro,
    alignItems: "center",
    justifyContent: "center",
  },

  contactoTitulo: {
    color: C.grisTexto,
    fontSize: 12.5,
  },

  contactoValor: {
    color: C.blanco,
    fontSize: 15,
    fontFamily: FontFamilies.bodyBold,
    marginVertical: 1,
  },

  contactoDetalle: {
    color: C.grisTexto,
    fontSize: 12.5,
  },

  canalesAdicionales: {
    backgroundColor: "rgba(212,165,75,0.07)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.bordeOro,
    padding: 14,
    gap: 5,
  },

  canalesTitulo: {
    color: C.oroSuave,
    fontSize: 13.5,
    fontFamily: FontFamilies.bodyBold,
    marginBottom: 2,
  },

  canalLinea: {
    color: C.blanco,
    fontSize: 13.5,
    lineHeight: 20,
  },

  toastWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "flex-end",
    paddingBottom: 84,
  },

  toast: {
    borderRadius: 40,
    borderWidth: 1,
    paddingVertical: 10,
    paddingHorizontal: 20,
    maxWidth: "90%",
  },

  toastExito: {
    backgroundColor: "rgba(0,0,0,0.92)",
    borderColor: C.verdeExito,
  },

  toastError: {
    backgroundColor: "rgba(0,0,0,0.92)",
    borderColor: C.rojoError,
  },

  toastTexto: {
    color: C.blanco,
    fontSize: 13.5,
    textAlign: "center",
  },

  presionado: { opacity: 0.85 },
});
