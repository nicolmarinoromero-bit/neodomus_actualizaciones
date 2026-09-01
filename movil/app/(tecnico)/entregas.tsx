import React, { useEffect, useState, useRef } from "react";
import { useIdioma } from "@/contexts/IdiomaContext";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Modal,
  Linking,
} from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import * as ImagePicker from "expo-image-picker";
import * as Location from "expo-location";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import { apiFetch } from "@/services/api";
import { useScrollTopAlEntrar } from "@/hooks/useScrollTopAlEntrar";

interface Entrega {
  id_pedido: number;
  cliente: string;
  telefono?: number | null;
  email?: string | null;
  direccion?: string | null;
  fecha_entrega?: string | null;
  hora_entrega?: string | null;
  hora_entrega_fin?: string | null;
  estado_entrega?: string | null;
  evidencias_entrega?: string[];
  productos?: { descripcion: string; cantidad: number; subtotal: number }[];
  cita?: {
    id_cita: number;
    tipo_servicio?: string | null;
    fecha?: string | null;
    hora?: string | null;
    estado?: string | null;
  } | null;
}

interface Recogida {
  id_devolucion: number;
  id_pedido?: number | null;
  producto: string;
  cliente: string;
  direccion: string;
  telefono?: number | null;
  estado_devolucion: string;
  preferencia?: string | null;
  recogida_estado: string;
  motivo?: string | null;
  evidencia_recogida_url?: string | null;
}

const API_HOST = "http://192.168.1.13:9000";
const urlEvidencia = (url: string) => (url.startsWith("http") ? url : `${API_HOST}${url}`);

export default function TecnicoEntregasScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { t } = useIdioma();
  useScrollTopAlEntrar(scrollRef);
  const insets = useSafeAreaInsets();

  const [entregas, setEntregas] = useState<Entrega[]>([]);
  const [recogidas, setRecogidas] = useState<Recogida[]>([]);
  const [loading, setLoading] = useState(true);
  const [updatingId, setUpdatingId] = useState<number | null>(null);
  const [subiendoEvidenciaId, setSubiendoEvidenciaId] = useState<number | null>(null);
  const [subiendoRecogida, setSubiendoRecogida] = useState<number | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [compartiendoUbicacion, setCompartiendoUbicacion] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  // Modales
  const [confirmRecogida, setConfirmRecogida] = useState<Entrega | null>(null);
  const [confirmEnCamino, setConfirmEnCamino] = useState<Entrega | null>(null);
  const [confirmEntregado, setConfirmEntregado] = useState<Entrega | null>(null);

  const cargar = async () => {
    try {
      const [res, resRec] = await Promise.allSettled([
        apiFetch<Entrega[]>("/tecnicos/mis-entregas"),
        apiFetch<Recogida[]>("/devoluciones/mis-recogidas").catch(() => []),
      ]);
      if (res.status === "fulfilled") setEntregas(res.value || []);
      if (resRec.status === "fulfilled") setRecogidas((resRec.value as any) || []);
    } catch {}
    setLoading(false);
  };

  useEffect(() => { cargar(); }, []);
  useEffect(() => {
    if (!toast) return;
    const tm = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(tm);
  }, [toast]);

  // Cleanup GPS on unmount
  useEffect(() => {
    return () => { detenerUbicacion(); };
  }, []);

  // ── Estado ──
  const actualizarEstado = async (pedidoId: number, nuevoEstado: string) => {
    setUpdatingId(pedidoId);
    try {
      await apiFetch(`/tecnicos/entregas/${pedidoId}/estado`, {
        method: "PUT",
        body: JSON.stringify({ estado: nuevoEstado }),
      });
      setToast(
        nuevoEstado === "Recogido"
          ? "Pedido recogido"
          : nuevoEstado === "En camino"
            ? "En camino al cliente"
            : "Entrega completada"
      );
      setConfirmRecogida(null);
      setConfirmEnCamino(null);
      setConfirmEntregado(null);
      cargar();
    } catch (e: any) {
      setToast(e?.message || "Error al actualizar");
    }
    setUpdatingId(null);
  };

  // ── Evidencias ──
  const subirEvidencias = async (pedidoId: number, fromCamera: boolean) => {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setToast("Permiso de cámara denegado"); return; }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setToast("Permiso de galería denegado"); return; }
    }
    const launcher = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await launcher({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      quality: 0.7,
      allowsMultipleSelection: !fromCamera,
    });
    if (res.canceled || !res.assets?.length) return;
    setSubiendoEvidenciaId(pedidoId);
    try {
      const fd = new FormData();
      res.assets.forEach((a) => {
        fd.append("files", { uri: a.uri, name: "evidencia.jpg", type: "image/jpeg" } as any);
      });
      await apiFetch(`/tecnicos/entregas/${pedidoId}/evidencias`, { method: "POST", body: fd, headers: {} as any });
      await apiFetch(`/tecnicos/entregas/${pedidoId}/estado`, {
        method: "PUT",
        body: JSON.stringify({ estado: "Entregado" }),
      });
      setToast("Pedido entregado con evidencias");
      setConfirmEntregado(null);
      cargar();
    } catch (e: any) {
      setToast(e?.message || "Error al subir evidencias");
    }
    setSubiendoEvidenciaId(null);
  };

  const elegirEvidenciaEntrega = (pedidoId: number) => {
    Alert.alert("Evidencia de entrega", "¿Cómo deseas capturar la evidencia?", [
      { text: "Cámara", onPress: () => subirEvidencias(pedidoId, true) },
      { text: "Galería", onPress: () => subirEvidencias(pedidoId, false) },
    ]);
  };

  // ── Evidencia recogida (devoluciones) ──
  const subirEvidenciaRecogida = async (idDevolucion: number, fromCamera: boolean) => {
    if (fromCamera) {
      const perm = await ImagePicker.requestCameraPermissionsAsync();
      if (!perm.granted) { setToast("Permiso de cámara denegado"); return; }
    } else {
      const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!perm.granted) { setToast("Permiso de galería denegado"); return; }
    }
    const launcher = fromCamera ? ImagePicker.launchCameraAsync : ImagePicker.launchImageLibraryAsync;
    const res = await launcher({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.7 });
    if (res.canceled || !res.assets?.[0]) return;
    const asset = res.assets[0];
    setSubiendoRecogida(idDevolucion);
    try {
      const fd = new FormData();
      fd.append("file", { uri: asset.uri, name: "evidencia.jpg", type: "image/jpeg" } as any);
      await apiFetch(`/devoluciones/${idDevolucion}/evidencia-recogida`, { method: "POST", body: fd, headers: {} as any });
      setToast("Evidencia de recogida subida");
      cargar();
    } catch (e: any) { setToast(e.message || "Error"); }
    setSubiendoRecogida(null);
  };

  const elegirEvidenciaRecogida = (idDevolucion: number) => {
    Alert.alert("Evidencia de recogida", "¿Cómo deseas capturar la evidencia?", [
      { text: "Cámara", onPress: () => subirEvidenciaRecogida(idDevolucion, true) },
      { text: "Galería", onPress: () => subirEvidenciaRecogida(idDevolucion, false) },
    ]);
  };

  // ── GPS ──
  const compartirUbicacion = async () => {
    if (compartiendoUbicacion) {
      detenerUbicacion();
      return;
    }
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      setToast("Permiso de ubicación denegado");
      return;
    }
    setCompartiendoUbicacion(true);
    watchRef.current = await Location.watchPositionAsync(
      { accuracy: Location.Accuracy.High, timeInterval: 10000, distanceInterval: 10 },
      async (pos) => {
        try {
          await apiFetch("/tecnicos/ubicacion", {
            method: "POST",
            body: JSON.stringify({ latitud: pos.coords.latitude, longitud: pos.coords.longitude }),
          });
        } catch {}
      }
    );
  };

  const detenerUbicacion = () => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
    setCompartiendoUbicacion(false);
  };

  if (loading) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator color={C.oro} />
        <Text style={styles.gris}>Cargando entregas...</Text>
      </View>
    );
  }

  const entregasActivas = entregas.filter(
    (e) => e.estado_entrega !== "Entregado" || (e.evidencias_entrega || []).length === 0
  );
  const enCaminoCount = entregas.filter((e) => e.estado_entrega === "En camino").length;

  return (
    <View style={styles.pantalla}>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.contenido, { paddingBottom: insets.bottom + 72 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <View style={{ flex: 1 }}>
            <Text style={styles.titulo}>{t("entregas.titulo")}</Text>
            <Text style={styles.sub}>{entregas.length > 0 ? `${entregas.length} entregas asignadas` : t("tecnico.sinEntregas")}</Text>
          </View>
          {enCaminoCount > 0 && (
            <View style={styles.enCaminoBadge}>
              <FontAwesome6 name="route" size={11} color="#141414" />
              <Text style={styles.enCaminoTxt}>{enCaminoCount} en camino</Text>
            </View>
          )}
        </View>

        {entregasActivas.length === 0 ? (
          <View style={styles.empty}>
            <FontAwesome6 name="truck-fast" size={24} color="#5a5a5a" />
            <Text style={styles.gris}>{t("tecnico.sinEntregas")}</Text>
          </View>
        ) : (
          entregasActivas.map((e) => (
            <View key={e.id_pedido} style={styles.card}>
              <View style={styles.cardHead}>
                <Text style={styles.cardTitle} numberOfLines={1}>{e.cliente} · Pedido #{e.id_pedido}</Text>
                <View style={[styles.badge,
                  e.estado_entrega === "Entregado" ? styles.bOk :
                  e.estado_entrega === "En camino" ? styles.bInfo :
                  e.estado_entrega === "Recogido" ? styles.bProc : styles.bPend
                ]}>
                  <Text style={styles.badgeTxt}>{e.estado_entrega || "Asignada"}</Text>
                </View>
              </View>

              {/* Fecha y franja */}
              <View style={styles.infoRow}>
                <FontAwesome6 name="calendar-days" size={11} color="#9a8f78" />
                <Text style={styles.cardSub}>
                  {e.fecha_entrega || ""}{" "}
                  {e.hora_entrega_fin
                    ? `Entre ${e.hora_entrega || "10:00"} y ${e.hora_entrega_fin}`
                    : e.hora_entrega || ""}
                </Text>
              </View>

              {/* Dirección */}
              <View style={styles.infoRow}>
                <FontAwesome6 name="location-dot" size={11} color="#9a8f78" />
                <Text style={styles.cardSub}>{e.direccion || "Sin dirección"}</Text>
              </View>

              {/* Teléfono */}
              {e.telefono ? (
                <Pressable onPress={() => Linking.openURL(`tel:${e.telefono}`)} style={styles.infoRow}>
                  <FontAwesome6 name="phone" size={11} color="#9a8f78" />
                  <Text style={[styles.cardSub, { color: C.oro }]}>{e.telefono}</Text>
                </Pressable>
              ) : null}

              {/* Email */}
              {e.email ? (
                <View style={styles.infoRow}>
                  <FontAwesome6 name="envelope" size={11} color="#9a8f78" />
                  <Text style={styles.cardSub}>{e.email}</Text>
                </View>
              ) : null}

              {/* Cita asociada */}
              {e.cita && (
                <View style={styles.infoRow}>
                  <FontAwesome6 name="calendar-check" size={11} color="#9a8f78" />
                  <Text style={styles.cardSub}>
                    Servicio: {e.cita.tipo_servicio || "Instalación"}
                    {e.cita.fecha ? ` · ${e.cita.fecha}` : ""}
                    {e.cita.estado ? ` [${e.cita.estado}]` : ""}
                  </Text>
                </View>
              )}

              {/* Productos */}
              {e.productos && e.productos.length > 0 && (
                <View style={styles.productosWrap}>
                  {e.productos.map((p, idx) => (
                    <Text key={idx} style={styles.productoTxt}>× {p.cantidad} {p.descripcion}</Text>
                  ))}
                </View>
              )}

              {/* Evidencias subidas */}
              {e.estado_entrega === "Entregado" && (e.evidencias_entrega || []).length > 0 && (
                <View style={styles.evidenciasRow}>
                  {(e.evidencias_entrega || []).slice(0, 4).map((url, idx) => (
                    <Image key={idx} source={{ uri: urlEvidencia(url) }} style={styles.evidenciaThumb} />
                  ))}
                  {(e.evidencias_entrega || []).length > 4 && (
                    <Text style={styles.gris}>+{(e.evidencias_entrega || []).length - 4}</Text>
                  )}
                </View>
              )}

              {/* ── Botones de acción según estado ── */}
              <View style={styles.actions}>
                {/* Asignada → Recogido */}
                {(e.estado_entrega === "Asignada" || !e.estado_entrega) && (
                  <Pressable
                    onPress={() => setConfirmRecogida(e)}
                    disabled={updatingId === e.id_pedido}
                    style={[styles.btnPrimary, updatingId === e.id_pedido && { opacity: 0.5 }]}
                  >
                    <FontAwesome6 name="box-open" size={12} color="#141414" />
                    <Text style={styles.btnPrimaryTxt}>
                      {updatingId === e.id_pedido ? "Procesando..." : t("entregas.yaRecogi")}
                    </Text>
                  </Pressable>
                )}

                {/* Recogido → En camino */}
                {e.estado_entrega === "Recogido" && (
                  <Pressable
                    onPress={() => setConfirmEnCamino(e)}
                    disabled={updatingId === e.id_pedido}
                    style={[styles.btnPrimary, updatingId === e.id_pedido && { opacity: 0.5 }]}
                  >
                    <FontAwesome6 name="route" size={12} color="#141414" />
                    <Text style={styles.btnPrimaryTxt}>
                      {updatingId === e.id_pedido ? "Procesando..." : "En camino"}
                    </Text>
                  </Pressable>
                )}

                {/* En camino → Entregado (sube fotos) */}
                {e.estado_entrega === "En camino" && (
                  <>
                    <Pressable
                      onPress={() => elegirEvidenciaEntrega(e.id_pedido)}
                      disabled={subiendoEvidenciaId === e.id_pedido}
                      style={[styles.btnOk, subiendoEvidenciaId === e.id_pedido && { opacity: 0.5 }]}
                    >
                      <FontAwesome6 name="circle-check" size={12} color="#141414" />
                      <Text style={styles.btnOkTxt}>
                        {subiendoEvidenciaId === e.id_pedido ? "Subiendo..." : "Entregado"}
                      </Text>
                    </Pressable>
                    <Pressable
                      onPress={compartirUbicacion}
                      style={[styles.btnGhostSmall, compartiendoUbicacion && styles.btnGhostActive]}
                    >
                      <FontAwesome6 name="location-dot" size={11} color={compartiendoUbicacion ? "#e5484d" : "#f0c96f"} />
                      <Text style={[styles.btnGhostSmallTxt, compartiendoUbicacion && { color: "#e5484d" }]}>
                        {compartiendoUbicacion ? "Detener GPS" : "GPS"}
                      </Text>
                    </Pressable>
                  </>
                )}

                {/* Entregado: agregar más fotos */}
                {e.estado_entrega === "Entregado" && (
                  <Pressable
                    onPress={() => elegirEvidenciaEntrega(e.id_pedido)}
                    disabled={subiendoEvidenciaId === e.id_pedido}
                    style={[styles.btnGhostSmall, subiendoEvidenciaId === e.id_pedido && { opacity: 0.5 }]}
                  >
                    <FontAwesome6 name="camera" size={11} color="#f0c96f" />
                    <Text style={styles.btnGhostSmallTxt}>Agregar fotos</Text>
                  </Pressable>
                )}
              </View>
            </View>
          ))
        )}

        {/* ── Recogidas de devolución ── */}
        {recogidas.length > 0 && (
          <View style={styles.seccion}>
            <View style={styles.seccionHead}>
              <FontAwesome6 name="box-open" size={13} color={C.oro} />
              <Text style={styles.seccionTitulo}>Recogidas de devolución</Text>
              <View style={styles.countBadge}><Text style={styles.countTxt}>{recogidas.length}</Text></View>
            </View>
            {recogidas.map((r) => (
              <View key={r.id_devolucion} style={styles.recogidaCard}>
                <View style={styles.recogidaInfo}>
                  <Text style={styles.cardTitle} numberOfLines={1}>Devolución #{r.id_devolucion} · {r.producto}</Text>
                  <Text style={styles.cardSub}>{r.cliente} · {r.direccion}</Text>
                  <Text style={styles.cardSubSmall}>Estado: {r.recogida_estado}</Text>
                </View>
                <View style={{ alignItems: "flex-end", gap: 6 }}>
                  <View style={[styles.badge, r.recogida_estado === "Recogida" ? styles.bOk : styles.bPend]}>
                    <Text style={styles.badgeTxt}>{r.recogida_estado === "Recogida" ? "Recogida" : "Pendiente"}</Text>
                  </View>
                  {r.recogida_estado === "Recogida" && r.evidencia_recogida_url && (
                    <Image source={{ uri: urlEvidencia(r.evidencia_recogida_url) }} style={styles.evidenciaThumbSmall} />
                  )}
                  {r.recogida_estado !== "Recogida" && (
                    <Pressable
                      onPress={() => elegirEvidenciaRecogida(r.id_devolucion)}
                      disabled={subiendoRecogida === r.id_devolucion}
                      style={[styles.btnPrimarySmall, subiendoRecogida === r.id_devolucion && { opacity: 0.5 }]}
                    >
                      <FontAwesome6 name="camera" size={11} color="#141414" />
                      <Text style={styles.btnPrimarySmallTxt}>
                        {subiendoRecogida === r.id_devolucion ? "Subiendo..." : "Evidencia"}
                      </Text>
                    </Pressable>
                  )}
                </View>
              </View>
            ))}
          </View>
        )}
      </ScrollView>

      {/* ── Modal Confirmar Recogida ── */}
      <Modal visible={!!confirmRecogida} transparent animationType="fade" onRequestClose={() => setConfirmRecogida(null)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar recogida</Text>
            <Text style={styles.gris}>¿Confirmas que recogiste el pedido?</Text>
            {confirmRecogida && (
              <View style={styles.confirmBox}>
                <Text style={styles.cardTitle}>Pedido #{confirmRecogida.id_pedido}</Text>
                <Text style={styles.cardSub}>{confirmRecogida.cliente}</Text>
                <Text style={styles.cardSub}>{confirmRecogida.direccion}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => setConfirmRecogida(null)} style={styles.btnGhost}><Text style={styles.btnGhostTxt}>Cancelar</Text></Pressable>
              <Pressable onPress={() => confirmRecogida && actualizarEstado(confirmRecogida.id_pedido, "Recogido")} style={[styles.btnPrimary, { flex: 1 }]}>
                <Text style={styles.btnPrimaryTxt}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Confirmar En Camino ── */}
      <Modal visible={!!confirmEnCamino} transparent animationType="fade" onRequestClose={() => setConfirmEnCamino(null)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>¿Ir en camino?</Text>
            <Text style={styles.gris}>Se marcará como "En camino" y podrás compartir tu ubicación GPS.</Text>
            {confirmEnCamino && (
              <View style={styles.confirmBox}>
                <Text style={styles.cardTitle}>Pedido #{confirmEnCamino.id_pedido}</Text>
                <Text style={styles.cardSub}>{confirmEnCamino.cliente} · {confirmEnCamino.direccion}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => setConfirmEnCamino(null)} style={styles.btnGhost}><Text style={styles.btnGhostTxt}>Cancelar</Text></Pressable>
              <Pressable onPress={() => confirmEnCamino && actualizarEstado(confirmEnCamino.id_pedido, "En camino")} style={[styles.btnPrimary, { flex: 1 }]}>
                <Text style={styles.btnPrimaryTxt}>Confirmar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ── Modal Confirmar Entregado ── */}
      <Modal visible={!!confirmEntregado} transparent animationType="fade" onRequestClose={() => setConfirmEntregado(null)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Confirmar entrega</Text>
            <Text style={styles.gris}>Se abrirán las fotos para adjuntar evidencia de la entrega.</Text>
            {confirmEntregado && (
              <View style={styles.confirmBox}>
                <Text style={styles.cardTitle}>Pedido #{confirmEntregado.id_pedido}</Text>
                <Text style={styles.cardSub}>{confirmEntregado.cliente}</Text>
              </View>
            )}
            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable onPress={() => setConfirmEntregado(null)} style={styles.btnGhost}><Text style={styles.btnGhostTxt}>Cancelar</Text></Pressable>
              <Pressable onPress={() => { if (confirmEntregado) { const id = confirmEntregado.id_pedido; setConfirmEntregado(null); elegirEvidenciaEntrega(id); } }} style={[styles.btnOk, { flex: 1 }]}>
                <Text style={styles.btnOkTxt}>Adjuntar fotos</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {toast && (
        <View style={styles.toastWrap} pointerEvents="none">
          <View style={styles.toast}><Text style={styles.toastTxt}>{toast}</Text></View>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#000" },
  contenido: { padding: 14, gap: 12 },
  centro: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 40 },
  gris: { color: "#bdbdbd", fontSize: 12.5 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: 8 },
  titulo: { color: "#fff", fontSize: 18, fontFamily: FontFamilies.bodyBold },
  sub: { color: "#bdbdbd", fontSize: 13, marginTop: -2 },
  enCaminoBadge: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "rgba(212,165,75,0.18)", borderWidth: 1, borderColor: "rgba(212,165,75,0.3)", borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 },
  enCaminoTxt: { color: "#f0c96f", fontSize: 11, fontFamily: FontFamilies.bodyBold },
  card: { backgroundColor: "#161616", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", borderRadius: 12, padding: 12, gap: 6 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 8 },
  cardTitle: { color: "#fff", fontSize: 14, fontFamily: FontFamilies.bodyBold, flex: 1 },
  cardSub: { color: "#bdbdbd", fontSize: 12 },
  cardSubSmall: { color: "#8a8a8a", fontSize: 11 },
  infoRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  bOk: { backgroundColor: "rgba(126,226,154,0.15)", borderColor: "rgba(126,226,154,0.3)" },
  bInfo: { backgroundColor: "rgba(212,165,75,0.12)", borderColor: "rgba(212,165,75,0.25)" },
  bProc: { backgroundColor: "rgba(120,180,255,0.12)", borderColor: "rgba(120,180,255,0.25)" },
  bPend: { backgroundColor: "rgba(246,195,68,0.12)", borderColor: "rgba(246,195,68,0.25)" },
  badgeTxt: { color: "#fff", fontSize: 10, fontFamily: FontFamilies.bodyBold },
  empty: { alignItems: "center", paddingVertical: 30, gap: 8 },
  productosWrap: { backgroundColor: "rgba(255,255,255,0.04)", borderRadius: 8, padding: 8, gap: 2 },
  productoTxt: { color: "#bdbdbd", fontSize: 11 },
  evidenciasRow: { flexDirection: "row", gap: 6, alignItems: "center", flexWrap: "wrap" },
  evidenciaThumb: { width: 48, height: 48, borderRadius: 8 },
  evidenciaThumbSmall: { width: 40, height: 40, borderRadius: 8 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 4 },
  btnPrimary: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#caa24d", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12 },
  btnPrimaryTxt: { color: "#141414", fontFamily: FontFamilies.bodyBold, fontSize: 12 },
  btnOk: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#7ee29a", borderRadius: 8, paddingVertical: 9, paddingHorizontal: 12 },
  btnOkTxt: { color: "#141414", fontFamily: FontFamilies.bodyBold, fontSize: 12 },
  btnGhostSmall: { flexDirection: "row", alignItems: "center", gap: 5, borderWidth: 1, borderColor: "rgba(212,165,75,0.35)", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10 },
  btnGhostSmallTxt: { color: "#f0c96f", fontSize: 11, fontFamily: FontFamilies.bodyMedium },
  btnGhostActive: { borderColor: "#e5484d", backgroundColor: "rgba(229,72,77,0.08)" },
  btnPrimarySmall: { flexDirection: "row", alignItems: "center", gap: 5, backgroundColor: "#caa24d", borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10 },
  btnPrimarySmallTxt: { color: "#141414", fontSize: 11, fontFamily: FontFamilies.bodyBold },
  // Sección recogidas
  seccion: { backgroundColor: "#161616", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", borderRadius: 14, padding: 14, gap: 10 },
  seccionHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  seccionTitulo: { color: "#fff", fontSize: 14, fontFamily: FontFamilies.bodyBold, flex: 1 },
  countBadge: { backgroundColor: "#caa24d", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  countTxt: { color: "#141414", fontSize: 11, fontFamily: FontFamilies.bodyBold },
  recogidaCard: { flexDirection: "row", justifyContent: "space-between", backgroundColor: "rgba(255,255,255,0.04)", borderWidth: 1, borderColor: "rgba(255,255,255,0.07)", borderRadius: 12, padding: 12, gap: 10 },
  recogidaInfo: { flex: 1, gap: 4 },
  // Modales
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 16 },
  modalCard: { backgroundColor: "#121212", borderRadius: 16, borderWidth: 1, borderColor: "rgba(212,165,75,0.28)", padding: 16, gap: 10 },
  modalTitle: { color: "#fff", fontSize: 16, fontFamily: FontFamilies.bodyBold, textAlign: "center" },
  confirmBox: { backgroundColor: "rgba(212,165,75,0.08)", borderWidth: 1, borderColor: "rgba(212,165,75,0.18)", borderRadius: 10, padding: 10, marginTop: 6, gap: 4 },
  btnGhost: { flex: 1, borderRadius: 10, borderWidth: 1, borderColor: "rgba(212,165,75,0.35)", paddingVertical: 11, alignItems: "center" },
  btnGhostTxt: { color: "#f0c96f", fontFamily: FontFamilies.button, fontSize: 13 },
  toastWrap: { position: "absolute", left: 0, right: 0, bottom: 90, alignItems: "center" },
  toast: { backgroundColor: "rgba(0,0,0,0.92)", borderWidth: 1, borderColor: "#c9a227", borderRadius: 40, paddingVertical: 9, paddingHorizontal: 16 },
  toastTxt: { color: "#f0c96f", fontSize: 12.5 },
});
