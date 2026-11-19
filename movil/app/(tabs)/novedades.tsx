import LocalizedNotificationText from "@/components/common/LocalizedNotificationText";
// ─────────────────────────────────────────────────────────────
// Novedades del cliente — solo lectura.
// Muestra las novedades visibles para el cliente, incluyendo
// mensajes y soluciones del administrador.
// ─────────────────────────────────────────────────────────────

import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { router } from "expo-router";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import GateCliente from "@/components/app/GateCliente";
import { useScrollTopAlEntrar } from "@/hooks/useScrollTopAlEntrar";
import { COLORES_ESTADO_NOVEDAD, NovedadCard } from "@/components/public/NovedadCard";
import { NovedadEvidencias } from "@/components/public/NovedadEvidencias";
import { formatearFechaNovedad as fmtFecha } from "@/utils/novedades";
import {
  Novedad,
  NovedadDetalle,
  listarNovedadesCliente,
  listarCuponesCliente,
  type CuponCliente,
} from "@/services/novedades.service";



// programa una actualización periódica.
function NovedadesClienteScreen() {
  const insets = useSafeAreaInsets();
  const scrollRef = useRef(null);
  useScrollTopAlEntrar(scrollRef);

  const [novedades, setNovedades] = useState<Novedad[]>([]);
  const [cargando, setCargando] = useState(true);
  const [toast, setToast] = useState<{ msg: string; tipo: "ok" | "err" } | null>(null);
  const [detalle, setDetalle] = useState<NovedadDetalle | null>(null);
  const [busqueda, setBusqueda] = useState("");
  const [filtroEstado, setFiltroEstado] = useState("");
  const [cupones, setCupones] = useState<CuponCliente[]>([]);

  const cargar = useCallback(async (silencioso = false) => {
    try {
      const data = await listarNovedadesCliente();
      setNovedades(data);
    } catch {
      if (!silencioso) setToast({ msg: "Error al cargar novedades", tipo: "err" });
    } finally {
      setCargando(false);
    }
  }, []);

  useEffect(() => {
    const inicioId = setTimeout(() => { void cargar(); }, 0);
    const actualizarCupones = () => {
      void listarCuponesCliente().then(setCupones).catch(() => setCupones([]));
    };
    actualizarCupones();
    const i = setInterval(() => {
      void cargar(true);
      actualizarCupones();
    }, 30000);
    return () => { clearTimeout(inicioId); clearInterval(i); };
  }, [cargar]);

  const novedadesFiltradas = novedades.filter((n) => {
    if (filtroEstado && n.estado_novedad !== filtroEstado) return false;
    const consulta = busqueda.trim().toLocaleLowerCase();
    if (!consulta) return true;
    const campos = [
      n.tipo_novedad_label || n.tipo_novedad,
      n.descripcion_novedad,
      n.lugar_ocurrencia,
      n.tecnico_nombre,
      n.id_pedido ? `#${n.id_pedido}` : "",
      n.id_cita ? `#${n.id_cita}` : "",
    ];
    return campos.some((campo) => campo?.toLocaleLowerCase().includes(consulta));
  });

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const abrirDetalle = async (id: number) => {
    try {
      const { obtenerNovedad } = await import("@/services/novedades.service");
      const data = await obtenerNovedad(id);
      setDetalle(data);
    } catch {
      setToast({ msg: "Error al cargar detalle", tipo: "err" });
    }
  };

  return (
    <View style={[s.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={s.header}>
        <Text style={s.headerTitle}>Mis novedades</Text>
        <Text style={s.headerSub}>Seguimiento de incidencias y soluciones</Text>
      </View>

      {/* Toast */}
      {toast && (
        <View style={[s.toast, toast.tipo === "ok" ? s.toastOk : s.toastErr]}>
          <Text style={s.toastText}><LocalizedNotificationText message={toast.msg} /></Text>
        </View>
      )}

      {cargando ? (
        <View style={s.center}>
          <ActivityIndicator size="large" color={C.oro} />
          <Text style={s.centerText}>Cargando novedades...</Text>
        </View>
      ) : (
        <ScrollView
          ref={scrollRef}
          style={s.list}
          contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
        >
          <View style={s.cupones}>
            <View style={s.cuponesHeader}>
              <View style={{ flex: 1 }}>
                <Text style={s.cuponesTitle}>Mis cupones disponibles</Text>
                <Text style={s.centerText}>Puedes aplicarlos al finalizar tu compra.</Text>
              </View>
              {cupones.length > 0 && (
                <Pressable onPress={() => router.push("/(tabs)/checkout" as never)} style={s.cuponUsar}>
                  <Text style={s.cuponUsarText}>Usar</Text>
                </Pressable>
              )}
            </View>
            {cupones.length === 0 ? (
              <Text style={s.cuponVacio}>Todavía no tienes cupones disponibles.</Text>
            ) : cupones.map((cupon) => (
              <View key={cupon.id_cupon} style={s.cuponCard}>
                <Text style={s.cuponCodigo}>{cupon.codigo}</Text>
                <Text style={s.cuponDetalle}>
                  {cupon.tipo_descuento === "porcentaje"
                    ? `${cupon.valor_descuento}% de descuento`
                    : `${Number(cupon.valor_descuento).toLocaleString("es-CO")} COP de descuento`}
                </Text>
                <Text style={s.cuponDetalle}>
                  {cupon.fecha_vencimiento ? `Vence ${fmtFecha(cupon.fecha_vencimiento)}` : "Sin vencimiento"}
                  {` · ${Math.max(0, cupon.usos_maximos - cupon.usos_realizados)} uso(s) disponible(s)`}
                </Text>
              </View>
            ))}
          </View>

          <TextInput
            value={busqueda}
            onChangeText={setBusqueda}
            placeholder="Buscar en tus novedades"
            placeholderTextColor="#777"
            style={s.searchInput}
            accessibilityLabel="Buscar novedades"
          />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.filtros}>
            {["", "Pendiente", "En revisión", "Aprobada", "Rechazada", "Resuelta", "Cerrada"].map((estado) => (
              <Pressable key={estado || "Todas"} onPress={() => setFiltroEstado(estado)} style={[s.filtro, filtroEstado === estado && s.filtroActivo]}>
                <Text style={[s.filtroTexto, filtroEstado === estado && s.filtroTextoActivo]}>{estado || "Todas"}</Text>
              </Pressable>
            ))}
          </ScrollView>

          {novedadesFiltradas.length === 0 ? (
            <View style={s.center}>
              <FontAwesome6 name="shield-halved" size={40} color={C.oro + "50"} />
              <Text style={s.centerTitle}>{novedades.length ? "Sin resultados" : "Sin novedades"}</Text>
              <Text style={s.centerText}>{novedades.length ? "No hay novedades que coincidan con tus filtros." : "No hay novedades visibles para tu cuenta"}</Text>
            </View>
          ) : novedadesFiltradas.map((n) => (
            <NovedadCard
              key={n.id_novedad}
              novedad={n}
              onPress={() => abrirDetalle(n.id_novedad)}
              colorPrioridad={C.oro}
              mostrarMensajesCliente
            />
          ))}
        </ScrollView>
      )}

      {/* Modal de detalle */}
      <Modal visible={!!detalle} animationType="slide" onRequestClose={() => setDetalle(null)}>
        <View style={[s.modal, { paddingTop: insets.top + 10 }]}>
          <View style={s.modalHeader}>
            <Pressable onPress={() => setDetalle(null)}>
              <FontAwesome6 name="xmark" size={20} color="#8a8a8a" />
            </Pressable>
            <Text style={s.modalTitle}>Novedad #{detalle?.id_novedad}</Text>
            <View style={{ width: 24 }} />
          </View>

          {detalle && (
            <ScrollView style={s.modalBody} contentContainerStyle={{ paddingBottom: 40 }}>
              <View style={[s.badgeModal, { backgroundColor: COLORES_ESTADO_NOVEDAD[detalle.estado_novedad]?.fondo || "#222", borderColor: COLORES_ESTADO_NOVEDAD[detalle.estado_novedad]?.borde || "#444" }]}>
                <Text style={[s.badgeText, { color: C.oro }]}>{detalle.estado_novedad_label || detalle.estado_novedad}</Text>
              </View>

              <View style={s.detalleGrid}>
                <View style={s.detalleItem}>
                  <Text style={s.detalleLabel}>Tipo</Text>
                  <Text style={s.detalleValue}>{detalle.tipo_novedad_label || detalle.tipo_novedad}</Text>
                </View>
                <View style={s.detalleItem}>
                  <Text style={s.detalleLabel}>Prioridad</Text>
                  <Text style={[s.detalleValue, { color: C.oro }]}>{detalle.prioridad_label || detalle.prioridad}</Text>
                </View>
                <View style={s.detalleItem}>
                  <Text style={s.detalleLabel}>Fecha</Text>
                  <Text style={s.detalleValue}>{fmtFecha(detalle.fecha_reporte)}</Text>
                </View>
                {detalle.cliente_info && (
                  <View style={s.detalleItem}>
                    <Text style={s.detalleLabel}>Cliente</Text>
                    <Text style={s.detalleValue}>{detalle.cliente_info.nombre}</Text>
                  </View>
                )}
              </View>

              {detalle.lugar_ocurrencia && (
                <View style={s.detalleItemFull}>
                  <Text style={s.detalleLabel}>Lugar</Text>
                  <Text style={s.detalleValue}>{detalle.lugar_ocurrencia}</Text>
                </View>
              )}

              <View style={s.detalleSection}>
                <Text style={s.detalleSectionTitle}>Descripción</Text>
                <Text style={s.detalleDesc}>{detalle.descripcion_novedad}</Text>
              </View>

              {detalle.mensaje_cliente && (
                <View style={[s.detalleSection, { backgroundColor: "rgba(212,165,75,0.08)", borderRadius: 10, padding: 12 }]}>
                  <Text style={[s.detalleSectionTitle, { color: "#d4a54b" }]}>Mensaje del administrador</Text>
                  <Text style={s.detalleDesc}>{detalle.mensaje_cliente}</Text>
                </View>
              )}

              {detalle.solucion_cliente && (
                <View style={[s.detalleSection, { backgroundColor: "rgba(46,160,67,0.08)", borderRadius: 10, padding: 12 }]}>
                  <Text style={[s.detalleSectionTitle, { color: "#46d06f" }]}>Solución para el cliente</Text>
                  <Text style={s.detalleDesc}>{detalle.solucion_cliente}</Text>
                </View>
              )}

              {detalle.cupon && (
                <View style={[s.detalleSection, { backgroundColor: "rgba(212,165,75,0.08)", borderRadius: 10, padding: 12 }]}>
                  <Text style={[s.detalleSectionTitle, { color: "#f1d27b" }]}>Cupón de compensación: {detalle.cupon.codigo}</Text>
                  <Text style={s.detalleDesc}>
                    {detalle.cupon.tipo_descuento === "porcentaje"
                      ? `${detalle.cupon.valor_descuento}% de descuento`
                      : `${Number(detalle.cupon.valor_descuento).toLocaleString("es-CO")} COP de descuento`}
                  </Text>
                  <Text style={s.cuponDetalle}>
                    {detalle.cupon.activo && detalle.cupon.usos_realizados < detalle.cupon.usos_maximos
                      ? "Disponible para usar en tu próxima compra."
                      : "Este cupón ya no está disponible."}
                  </Text>
                </View>
              )}

              <NovedadEvidencias evidencias={detalle.evidencias ?? []} />

              {detalle.historial && detalle.historial.length > 0 && (
                <View style={s.detalleSection}>
                  <Text style={s.detalleSectionTitle}>Historial</Text>
                  {detalle.historial.map((h, idx) => (
                    <View key={h.id_historial} style={[s.historialItem, idx === 0 && s.historialItemActive]}>
                      <View style={[s.historialDot, idx === 0 && { backgroundColor: C.oro }]} />
                      <View style={s.historialContent}>
                        <Text style={s.historialAccion}>{h.accion}</Text>
                        {h.detalle && <Text style={s.historialDetalle}>{h.detalle}</Text>}
                        <Text style={s.historialMeta}>{h.usuario_nombre || "Sistema"} · {fmtFecha(h.fecha)}</Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </ScrollView>
          )}
        </View>
      </Modal>
    </View>
  );
}

export default function NovedadesClienteRoute() {
  return (
    <GateCliente titulo="Mis novedades">
      <NovedadesClienteScreen />
    </GateCliente>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  header: { paddingHorizontal: 20, paddingBottom: 12 },
  headerTitle: { fontFamily: FontFamilies.bodyBold, fontSize: 22, color: "#fff" },
  headerSub: { fontFamily: FontFamilies.body, fontSize: 13, color: "#8a8a8a", marginTop: 2 },
  toast: { marginHorizontal: 20, marginBottom: 10, padding: 12, borderRadius: 10 },
  toastOk: { backgroundColor: "rgba(46,160,67,0.15)", borderWidth: 1, borderColor: "rgba(46,160,67,0.4)" },
  toastErr: { backgroundColor: "rgba(229,72,77,0.15)", borderWidth: 1, borderColor: "rgba(229,72,77,0.4)" },
  toastText: { fontFamily: FontFamilies.body, fontSize: 13, color: "#fff", textAlign: "center" },
  center: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: 40 },
  centerTitle: { fontFamily: FontFamilies.bodyBold, fontSize: 16, color: "#fff", marginTop: 12 },
  centerText: { fontFamily: FontFamilies.body, fontSize: 13, color: "#8a8a8a", textAlign: "center", marginTop: 6 },
  list: { flex: 1, paddingHorizontal: 20 },
  badge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontFamily: FontFamilies.bodyBold, fontSize: 10 },
  cupones: { marginHorizontal: 20, marginTop: 6, marginBottom: 14, padding: 14, borderRadius: 14, backgroundColor: "rgba(212,165,75,0.07)", borderWidth: 1, borderColor: "rgba(212,165,75,0.22)" },
  cuponesHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  cuponesTitle: { fontFamily: FontFamilies.bodyBold, fontSize: 15, color: "#f1d27b" },
  cuponVacio: { color: "#999", fontSize: 12 },
  cuponCard: { padding: 10, marginTop: 7, borderRadius: 10, borderWidth: 1, borderStyle: "dashed", borderColor: "rgba(212,165,75,0.4)" },
  cuponCodigo: { color: "#f1d27b", fontFamily: FontFamilies.bodyBold, fontSize: 15, letterSpacing: 1 },
  cuponDetalle: { color: "#aaa", fontSize: 11, marginTop: 4 },
  cuponUsar: { paddingVertical: 8, paddingHorizontal: 14, borderRadius: 9, backgroundColor: C.oro },
  cuponUsarText: { color: "#000", fontFamily: FontFamilies.bodyBold, fontSize: 12 },
  searchInput: { marginHorizontal: 20, marginBottom: 10, padding: 12, borderRadius: 10, backgroundColor: "#161616", borderWidth: 1, borderColor: "rgba(255,255,255,0.1)", color: "#fff", fontSize: 13 },
  filtros: { gap: 6, paddingHorizontal: 20, paddingBottom: 12 },
  filtro: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: 18, borderWidth: 1, borderColor: "rgba(255,255,255,0.12)", backgroundColor: "rgba(255,255,255,0.04)" },
  filtroActivo: { backgroundColor: C.oro, borderColor: C.oro },
  filtroTexto: { color: "#aaa", fontSize: 11 },
  filtroTextoActivo: { color: "#000", fontFamily: FontFamilies.bodyBold },
  modal: { flex: 1, backgroundColor: "#0a0a0a" },
  modalHeader: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: 20, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: "rgba(255,255,255,0.06)" },
  modalTitle: { fontFamily: FontFamilies.bodyBold, fontSize: 16, color: "#fff" },
  modalBody: { flex: 1, paddingHorizontal: 20, paddingTop: 16 },
  badgeModal: { alignSelf: "flex-start" },
  detalleGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginTop: 14, marginBottom: 16 },
  detalleItem: { width: "48%" },
  detalleItemFull: { width: "100%" },
  detalleLabel: { fontFamily: FontFamilies.body, fontSize: 10, color: "#8a8a8a", textTransform: "uppercase", letterSpacing: 0.5 },
  detalleValue: { fontFamily: FontFamilies.bodyBold, fontSize: 13, color: "#fff", marginTop: 2 },
  detalleSection: { marginBottom: 16, padding: 12, backgroundColor: "rgba(255,255,255,0.02)", borderWidth: 1, borderColor: "rgba(255,255,255,0.06)", borderRadius: 12 },
  detalleSectionTitle: { fontFamily: FontFamilies.bodyBold, fontSize: 13, color: C.oro, marginBottom: 8 },
  detalleDesc: { fontFamily: FontFamilies.body, fontSize: 13, color: "#ccc", lineHeight: 20 },
  historialItem: { flexDirection: "row", gap: 10, padding: 10, borderLeftWidth: 2, borderLeftColor: "rgba(255,255,255,0.08)", marginBottom: 6, borderRadius: 6 },
  historialItemActive: { borderLeftColor: C.oro, backgroundColor: "rgba(212,165,75,0.04)" },
  historialDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: "#555", marginTop: 4 },
  historialContent: { flex: 1 },
  historialAccion: { fontFamily: FontFamilies.bodyBold, fontSize: 12, color: "#fff" },
  historialDetalle: { fontFamily: FontFamilies.body, fontSize: 11, color: "#aaa", marginTop: 2 },
  historialMeta: { fontFamily: FontFamilies.body, fontSize: 10, color: "#666", marginTop: 4 },
});
