import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { ActivityIndicator, Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import * as ImagePicker from "expo-image-picker";
import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import { apiFetch } from "@/services/api";
import { useScrollTopAlEntrar } from "@/hooks/useScrollTopAlEntrar";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useIdioma } from "@/contexts/IdiomaContext";
import {
  SearchBar,
  FilterChip,
  FilterRow,
  ClearFiltersBtn,
  CalendarPicker,
  PickerModal,
  formatDateDisplay,
  HORAS_OPCIONES_12H,
} from "@/components/tecnico/Filtros";

const ESTADOS_ACTIVAS = ["Pendiente", "Confirmada"];

const TIPO_SERVICIO: Record<string, string> = {
  instalacion: "Instalación",
  reparacion: "Reparación",
  mantenimiento: "Mantenimiento",
  revision: "Revisión técnica",
  soporte: "Soporte",
};

const API_HOST = "http://192.168.1.13:9000";
const urlEvidencia = (url: string) => (url.startsWith("http") ? url : `${API_HOST}${url}`);

function formatFechaLarga(fecha: string, idioma: string) {
  try {
    const d = new Date(`${fecha}T00:00:00`);
    return d.toLocaleDateString(idioma === "en" ? "en-US" : "es-ES", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  } catch { return fecha; }
}

export default function TecnicoCitasScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { t, idioma } = useIdioma();
  useScrollTopAlEntrar(scrollRef);
  const insets = useSafeAreaInsets();
  const [citas, setCitas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<any>(null);
  const [modal, setModal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  // filtros
  const [busqueda, setBusqueda] = useState("");
  const [fechaFiltro, setFechaFiltro] = useState("");
  const [horaFiltro, setHoraFiltro] = useState("");
  const [showCal, setShowCal] = useState(false);
  const [showHora, setShowHora] = useState(false);

  // evidencia
  const [subiendoEvidencia, setSubiendoEvidencia] = useState<number | null>(null);
  const [showCalReagendar, setShowCalReagendar] = useState(false);

  // reagendar
  const [reagendando, setReagendando] = useState<any>(null);
  const [nuevaFecha, setNuevaFecha] = useState("");
  const [nuevaHora, setNuevaHora] = useState("");
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>([]);
  const [cargandoHoras, setCargandoHoras] = useState(false);
  const [enviandoReagendamiento, setEnviandoReagendamiento] = useState(false);

  const hayFiltros = Boolean(busqueda.trim()) || Boolean(fechaFiltro) || Boolean(horaFiltro);

  const limpiarFiltros = () => { setBusqueda(""); setFechaFiltro(""); setHoraFiltro(""); };

  const fetchCitas = async () => {
    try { const res = await apiFetch<any[]>("/tecnicos/mis-citas"); setCitas(res || []); } catch {}
    setLoading(false);
  };
  useEffect(() => { fetchCitas(); }, []);
  useEffect(() => { if (!toast) return; const tm = setTimeout(() => setToast(null), 2500); return () => clearTimeout(tm); }, [toast]);

  const actualizarEstado = async (id: number, estado: string) => {
    try {
      await apiFetch(`/tecnicos/citas/${id}/estado`, { method: "PUT", body: JSON.stringify({ estado }) });
      setToast("Estado actualizado");
      setModal(false);
      setSelected(null);
      fetchCitas();
    } catch (e: any) { setToast(e.message || "Error"); }
  };

  // ── Evidencia de citas ──
  const subirEvidenciaCita = async (idCita: number, fromCamera: boolean) => {
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
    setSubiendoEvidencia(idCita);
    try {
      const fd = new FormData();
      fd.append("file", { uri: asset.uri, name: "evidencia.jpg", type: "image/jpeg" } as any);
      fd.append("descripcion", "Evidencia del servicio");
      await apiFetch(`/tecnicos/citas/${idCita}/evidencias`, { method: "POST", body: fd, headers: {} as any });
      setToast("Evidencia subida");
      fetchCitas();
      const updated = await apiFetch<any[]>(`/tecnicos/mis-citas`);
      const found = (updated || []).find((c: any) => c.id_cita === idCita);
      if (found) setSelected(found);
    } catch (e: any) { setToast(e.message || "Error al subir evidencia"); }
    setSubiendoEvidencia(null);
  };

  const elegirEvidenciaCita = (idCita: number) => {
    Alert.alert("Evidencia de cita", "¿Cómo deseas capturar la evidencia?", [
      { text: "Cámara", onPress: () => subirEvidenciaCita(idCita, true) },
      { text: "Galería", onPress: () => subirEvidenciaCita(idCita, false) },
    ]);
  };

  const eliminarEvidenciaCita = async (idCita: number, idEvidencia: number) => {
    try {
      await apiFetch(`/tecnicos/citas/${idCita}/evidencias/${idEvidencia}`, { method: "DELETE" });
      setToast("Evidencia eliminada");
      fetchCitas();
      const updated = await apiFetch<any[]>(`/tecnicos/mis-citas`);
      const found = (updated || []).find((c: any) => c.id_cita === idCita);
      if (found) setSelected(found);
    } catch (e: any) { setToast(e.message || "Error"); }
  };

  // ── Reagendar ──
  const cargarHorasDisponibles = useCallback(async (citaId: number, fecha: string) => {
    if (!fecha) { setHorasDisponibles([]); return; }
    setCargandoHoras(true);
    try {
      const res = await apiFetch<string[]>(`/tecnicos/citas/${citaId}/horas-disponibles?fecha=${fecha}`);
      setHorasDisponibles(res || []);
      setNuevaHora("");
    } catch { setHorasDisponibles([]); }
    setCargandoHoras(false);
  }, []);

  useEffect(() => {
    if (reagendando && nuevaFecha) cargarHorasDisponibles(reagendando.id_cita, nuevaFecha);
    else setHorasDisponibles([]);
  }, [reagendando, nuevaFecha, cargarHorasDisponibles]);

  const iniciarReagendar = (cita: any) => { setReagendando(cita); setNuevaFecha(cita.fecha); setNuevaHora(""); };
  const cancelarReagendar = () => { setReagendando(null); setNuevaFecha(""); setNuevaHora(""); setHorasDisponibles([]); };

  const confirmarReagendar = async () => {
    if (!reagendando || !nuevaFecha || !nuevaHora) return;
    setEnviandoReagendamiento(true);
    try {
      await apiFetch(`/tecnicos/citas/${reagendando.id_cita}/reagendar`, {
        method: "PUT",
        body: JSON.stringify({ fecha: nuevaFecha, hora: nuevaHora, id_comision: reagendando.id_comision_c || 0 }),
      });
      setToast("Cita reagendada");
      fetchCitas();
      setTimeout(() => cancelarReagendar(), 1500);
    } catch (e: any) { setToast(e?.message || "Error al reagendar"); }
    setEnviandoReagendamiento(false);
  };

  const citasFiltradas = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return citas
      .filter((c) => ESTADOS_ACTIVAS.includes(c.estado))
      .filter((c) => {
        if (fechaFiltro && c.fecha !== fechaFiltro) return false;
        if (horaFiltro && (c.hora || "").slice(0, 5) !== horaFiltro) return false;
        if (!q) return true;
        const servicioLabel = TIPO_SERVICIO[c.tipo_servicio] || c.tipo_servicio || "";
        return [c.cliente || "", c.documento_numero?.toString() || "", c.telefono?.toString() || "", c.email || "", servicioLabel, formatFechaLarga(c.fecha || "", idioma), c.fecha || "", c.hora || "", c.direccion || "", c.nombre_tecnico || "", c.nombre_tecnico_2 || "", c.estado || "", c.descripcion || ""].some((v) => v.toLowerCase().includes(q));
      })
      .sort((a, b) => (a.fecha + a.hora).localeCompare(b.fecha + b.hora));
  }, [citas, busqueda, fechaFiltro, horaFiltro, idioma]);

  const sinResultados = citasFiltradas.length === 0 && citas.filter((c) => ESTADOS_ACTIVAS.includes(c.estado)).length > 0 && hayFiltros;

  const hoyMinimo = (() => { const h = new Date(); h.setDate(h.getDate() + 1); return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(h.getDate()).padStart(2, "0")}`; })();

  if (loading) return <View style={styles.centro}><ActivityIndicator color={C.oro} /><Text style={styles.gris}>{t("common.cargando")}</Text></View>;

  return (
    <View style={styles.pantalla}>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.contenido, { paddingBottom: insets.bottom + 72 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.titulo}>{t("tecnico.proximasCitas")}</Text>
        <Text style={styles.sub}>{t("tecnico.resumenJornada")}</Text>

        <SearchBar value={busqueda} onChange={setBusqueda} placeholder={t("tecnico.buscarPlaceholder") || "Buscar por cliente, dirección, servicio..."} />

        <FilterRow>
          <FilterChip label={fechaFiltro ? formatDateDisplay(fechaFiltro) : "Fecha"} icon="calendar-days" active={Boolean(fechaFiltro)} onPress={() => setShowCal(true)} />
          <FilterChip label={horaFiltro || "Hora"} icon="clock" active={Boolean(horaFiltro)} onPress={() => setShowHora(true)} />
          {hayFiltros ? <ClearFiltersBtn onPress={limpiarFiltros} /> : null}
          {hayFiltros ? (
            <View style={styles.countPill}><Text style={styles.countPillTxt}>{citasFiltradas.length}</Text></View>
          ) : (
            <View style={styles.countPillGhost}><Text style={styles.countPillGhostTxt}>{citasFiltradas.length} citas</Text></View>
          )}
        </FilterRow>

        {citas.filter((c) => ESTADOS_ACTIVAS.includes(c.estado)).length === 0 ? (
          <View style={styles.empty}><FontAwesome6 name="calendar-check" size={24} color="#5a5a5a" /><Text style={styles.emptyTxt}>{t("tecnico.sinCitasHoy")}</Text></View>
        ) : sinResultados || citasFiltradas.length === 0 ? (
          <View style={styles.empty}>
            <FontAwesome6 name="magnifying-glass" size={22} color="#5a5a5a" />
            <Text style={styles.emptyTxt}>Sin resultados</Text>
            <Pressable onPress={limpiarFiltros} style={styles.btnGhostSm}><Text style={styles.btnGhostSmTxt}>Limpiar filtros</Text></Pressable>
          </View>
        ) : (
          citasFiltradas.map((c) => (
            <Pressable key={c.id_cita} onPress={() => { setSelected(c); setModal(true); }} style={({ pressed }) => [styles.card, pressed && { opacity: 0.85 }]}>
              <View style={styles.cardHead}>
                <Text style={styles.cardCliente}>{c.cliente}</Text>
                <View style={[styles.badge, c.estado === "Finalizada" ? styles.bOk : c.estado === "Cancelada" ? styles.bErr : styles.bInfo]}><Text style={styles.badgeTxt}>{c.estado}</Text></View>
              </View>
              <Text style={styles.cardSub}>{TIPO_SERVICIO[c.tipo_servicio] || c.tipo_servicio} · {c.fecha} {c.hora}</Text>
              <Text style={styles.cardSub}>{c.direccion}</Text>
              {c.descripcion ? <Text style={styles.cardSub} numberOfLines={1}>{c.descripcion}</Text> : null}
              {/* Técnicos asignados */}
              {c.nombre_tecnico_2 ? <Text style={styles.cardSubSmall}>Técnicos: {c.nombre_tecnico || ""}, {c.nombre_tecnico_2}{c.nombre_tecnico_3 ? `, ${c.nombre_tecnico_3}` : ""}</Text> : null}
              {/* Costo */}
              {c.costo_cita != null && <Text style={styles.cardSubSmall}>Costo: ${Number(c.costo_cita).toLocaleString()}</Text>}
            </Pressable>
          ))
        )}
      </ScrollView>

      <CalendarPicker visible={showCal} value={fechaFiltro} onSelect={setFechaFiltro} onClose={() => setShowCal(false)} />
      <CalendarPicker visible={showCalReagendar} value={nuevaFecha} onSelect={(v) => { setNuevaFecha(v); setShowCalReagendar(false); }} onClose={() => setShowCalReagendar(false)} />
      <PickerModal visible={showHora} title="Filtrar por hora" options={HORAS_OPCIONES_12H} value={horaFiltro} onSelect={setHoraFiltro} onClose={() => setShowHora(false)} />

      {/* ── Modal Detalle Cita ── */}
      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Detalle cita #{selected?.id_cita}</Text>
              <Pressable onPress={() => setModal(false)} style={styles.modalClose}><FontAwesome6 name="xmark" size={14} color="#fff" /></Pressable>
            </View>
            {selected && (
              <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 8 }}>
                  <Text style={styles.label}>Cliente</Text><Text style={styles.value}>{selected.cliente}</Text>
                  <Text style={styles.label}>Servicio</Text><Text style={styles.value}>{TIPO_SERVICIO[selected.tipo_servicio] || selected.tipo_servicio}</Text>
                  <Text style={styles.label}>Fecha y hora</Text><Text style={styles.value}>{selected.fecha} · {selected.hora}</Text>
                  <Text style={styles.label}>Dirección</Text><Text style={styles.value}>{selected.direccion}</Text>
                  {selected.telefono ? <><Text style={styles.label}>Teléfono</Text><Text style={styles.value}>{selected.telefono}</Text></> : null}
                  {selected.email ? <><Text style={styles.label}>Email</Text><Text style={styles.value}>{selected.email}</Text></> : null}
                  {selected.descripcion ? <><Text style={styles.label}>Descripción</Text><Text style={styles.gris}>{selected.descripcion}</Text></> : null}
                  {selected.documento_numero ? <><Text style={styles.label}>Documento</Text><Text style={styles.value}>{selected.documento_tipo || "CC"} {selected.documento_numero}</Text></> : null}

                  {/* Técnicos */}
                  {selected.nombre_tecnico ? <><Text style={styles.label}>Técnico</Text><Text style={styles.value}>{selected.nombre_tecnico}</Text></> : null}
                  {selected.nombre_tecnico_2 ? <><Text style={styles.label}>Técnico 2</Text><Text style={styles.value}>{selected.nombre_tecnico_2}</Text></> : null}
                  {selected.nombre_tecnico_3 ? <><Text style={styles.label}>Técnico 3</Text><Text style={styles.value}>{selected.nombre_tecnico_3}</Text></> : null}

                  {/* Costo / Comisión */}
                  {selected.costo_cita != null && <><Text style={styles.label}>Costo</Text><Text style={styles.value}>${Number(selected.costo_cita).toLocaleString()}</Text></>}
                  {selected.comision_valor != null && (
                    <><Text style={styles.label}>Comisión</Text><Text style={styles.value}>{selected.comision_porcentaje ? `${selected.comision_porcentaje}% ` : ""}${Number(selected.comision_valor).toLocaleString()}</Text></>
                  )}

                  {/* Calificación */}
                  {selected.calificacion && (
                    <View style={styles.califBox}>
                      <Text style={styles.label}>Calificación</Text>
                      <Text style={{ color: "#ffc94d", fontSize: 16 }}>{"★".repeat(selected.calificacion.calificacion)}{"☆".repeat(5 - selected.calificacion.calificacion)}</Text>
                      {selected.calificacion.comentario ? <Text style={styles.gris}>{selected.calificacion.comentario}</Text> : null}
                    </View>
                  )}

                  {/* Evidencias */}
                  <Text style={styles.label}>Evidencias</Text>
                  {selected.evidencias && selected.evidencias.length > 0 ? (
                    <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
                      {selected.evidencias.map((ev: any) => (
                        <View key={ev.id_evidencia} style={styles.evidenciaWrap}>
                          <Image source={{ uri: urlEvidencia(ev.url) }} style={styles.evidenciaThumb} />
                          {ev.descripcion ? <Text style={styles.evidenciaDesc} numberOfLines={1}>{ev.descripcion}</Text> : null}
                          <Pressable onPress={() => eliminarEvidenciaCita(selected.id_cita, ev.id_evidencia)} style={styles.evidenciaDelete}>
                            <FontAwesome6 name="trash" size={10} color="#e5484d" />
                          </Pressable>
                        </View>
                      ))}
                    </View>
                  ) : (
                    <Text style={styles.gris}>Sin evidencias</Text>
                  )}

                  <Pressable
                    onPress={() => elegirEvidenciaCita(selected.id_cita)}
                    disabled={subiendoEvidencia === selected.id_cita}
                    style={[styles.btnCamera, subiendoEvidencia === selected.id_cita && { opacity: 0.5 }]}
                  >
                    <FontAwesome6 name="camera" size={12} color="#141414" />
                    <Text style={styles.btnCameraTxt}>{subiendoEvidencia === selected.id_cita ? "Subiendo..." : "Subir evidencia"}</Text>
                  </Pressable>

                  <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                    {selected.estado !== "Finalizada" && (
                      <Pressable onPress={() => actualizarEstado(selected.id_cita, "Finalizada")} style={styles.btnPrimary}><Text style={styles.btnPrimaryTxt}>Finalizar</Text></Pressable>
                    )}
                    {(selected.estado === "Pendiente" || selected.estado === "Confirmada") && (
                      <Pressable onPress={() => { setModal(false); iniciarReagendar(selected); }} style={styles.btnSecondary}><Text style={styles.btnSecondaryTxt}>Reagendar</Text></Pressable>
                    )}
                    <Pressable onPress={() => setModal(false)} style={styles.btnGhost}><Text style={styles.btnGhostTxt}>Cerrar</Text></Pressable>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {/* ── Modal Reagendar ── */}
      <Modal visible={!!reagendando} transparent animationType="fade" onRequestClose={cancelarReagendar}>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <View style={styles.modalHead}>
              <Text style={styles.modalTitle}>Reagendar cita #{reagendando?.id_cita}</Text>
              <Pressable onPress={cancelarReagendar} style={styles.modalClose}><FontAwesome6 name="xmark" size={14} color="#fff" /></Pressable>
            </View>
            {reagendando && (
              <ScrollView style={{ maxHeight: 400 }} showsVerticalScrollIndicator={false}>
                <View style={{ gap: 10 }}>
                  {/* Datos actuales */}
                  <View style={styles.confirmBox}>
                    <Text style={styles.label}>Cliente</Text><Text style={styles.value}>{reagendando.cliente}</Text>
                    <Text style={styles.label}>Fecha actual</Text><Text style={styles.value}>{reagendando.fecha}</Text>
                    <Text style={styles.label}>Hora actual</Text><Text style={styles.value}>{reagendando.hora}</Text>
                    <Text style={styles.label}>Dirección</Text><Text style={styles.value}>{reagendando.direccion}</Text>
                  </View>

                  {/* Nueva fecha */}
                  <Text style={styles.label}>Nueva fecha</Text>
                  <Pressable onPress={() => setShowCalReagendar(true)} style={styles.calendarBtn}>
                    <FontAwesome6 name="calendar-days" size={13} color="#f0c96f" />
                    <Text style={styles.calendarBtnTxt}>{nuevaFecha || "Seleccionar fecha"}</Text>
                  </Pressable>

                  {/* Nueva hora */}
                  {nuevaFecha ? (
                    <>
                      <Text style={styles.label}>Nueva hora</Text>
                      {cargandoHoras ? (
                        <ActivityIndicator color={C.oro} style={{ marginVertical: 12 }} />
                      ) : horasDisponibles.length > 0 ? (
                        <View style={styles.horasGrid}>
                          {horasDisponibles.map((h) => (
                            <Pressable key={h} onPress={() => setNuevaHora(h)} style={[styles.horaBtn, nuevaHora === h && styles.horaBtnActive]}>
                              <Text style={[styles.horaBtnTxt, nuevaHora === h && { color: "#141414" }]}>{h}</Text>
                            </Pressable>
                          ))}
                        </View>
                      ) : (
                        <Text style={styles.gris}>Sin horas disponibles para esta fecha</Text>
                      )}
                    </>
                  ) : (
                    <Text style={styles.gris}>Selecciona una fecha primero</Text>
                  )}

                  <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                    <Pressable onPress={cancelarReagendar} style={styles.btnGhost}><Text style={styles.btnGhostTxt}>Cancelar</Text></Pressable>
                    <Pressable
                      onPress={confirmarReagendar}
                      disabled={!nuevaFecha || !nuevaHora || enviandoReagendamiento}
                      style={[styles.btnPrimary, { flex: 1 }, (!nuevaFecha || !nuevaHora) && { opacity: 0.5 }]}
                    >
                      <Text style={styles.btnPrimaryTxt}>{enviandoReagendamiento ? "Guardando..." : "Confirmar"}</Text>
                    </Pressable>
                  </View>
                </View>
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

      {toast && <View style={styles.toastWrap} pointerEvents="none"><View style={styles.toast}><Text style={styles.toastTxt}>{toast}</Text></View></View>}
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#000" },
  contenido: { padding: 14, gap: 12, paddingBottom: 32 },
  centro: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 40 },
  gris: { color: "#bdbdbd", fontSize: 12.5 },
  titulo: { color: "#fff", fontSize: 18, fontFamily: FontFamilies.bodyBold },
  sub: { color: "#bdbdbd", fontSize: 13, marginTop: -8 },
  countPill: { backgroundColor: "#caa24d", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, marginLeft: "auto" },
  countPillTxt: { color: "#141414", fontSize: 11, fontFamily: FontFamilies.bodyBold },
  countPillGhost: { marginLeft: "auto", backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: "rgba(255,255,255,0.07)" },
  countPillGhostTxt: { color: "#bdbdbd", fontSize: 11, fontFamily: FontFamilies.bodyMedium },
  card: { backgroundColor: "#161616", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", borderRadius: 12, padding: 12, gap: 4 },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardCliente: { color: "#fff", fontSize: 14, fontFamily: FontFamilies.bodyBold, flex: 1 },
  cardSub: { color: "#bdbdbd", fontSize: 12 },
  cardSubSmall: { color: "#8a8a8a", fontSize: 11 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  bOk: { backgroundColor: "rgba(126,226,154,0.15)", borderColor: "rgba(126,226,154,0.3)" },
  bInfo: { backgroundColor: "rgba(212,165,75,0.12)", borderColor: "rgba(212,165,75,0.25)" },
  bErr: { backgroundColor: "rgba(240,133,138,0.12)", borderColor: "rgba(240,133,138,0.25)" },
  badgeTxt: { color: "#fff", fontSize: 10, fontFamily: FontFamilies.bodyBold },
  empty: { alignItems: "center", paddingVertical: 30, gap: 8 },
  emptyTxt: { color: "#8a8a8a", fontSize: 13, fontFamily: FontFamilies.bodyBold },
  emptyHint: { color: "#6b6b6b", fontSize: 12, textAlign: "center" },
  btnGhostSm: { marginTop: 6, borderWidth: 1, borderColor: "rgba(212,165,75,0.35)", borderRadius: 999, paddingVertical: 7, paddingHorizontal: 14 },
  btnGhostSmTxt: { color: "#f0c96f", fontSize: 12, fontFamily: FontFamilies.bodyMedium },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.72)", justifyContent: "center", padding: 16 },
  modalCard: { backgroundColor: "#121212", borderRadius: 16, borderWidth: 1, borderColor: "rgba(212,165,75,0.28)", padding: 16, gap: 10, maxHeight: "85%" },
  modalHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  modalTitle: { color: "#fff", fontSize: 16, fontFamily: FontFamilies.bodyBold },
  modalClose: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", alignItems: "center", justifyContent: "center" },
  label: { color: "#f0c96f", fontSize: 11, fontFamily: FontFamilies.bodyBold, textTransform: "uppercase" },
  value: { color: "#fff", fontSize: 13 },
  confirmBox: { backgroundColor: "rgba(212,165,75,0.08)", borderWidth: 1, borderColor: "rgba(212,165,75,0.18)", borderRadius: 10, padding: 10, gap: 4 },
  califBox: { backgroundColor: "rgba(255,201,77,0.08)", borderWidth: 1, borderColor: "rgba(255,201,77,0.18)", borderRadius: 10, padding: 10, gap: 4 },
  evidenciaWrap: { alignItems: "center", gap: 4 },
  evidenciaThumb: { width: 60, height: 60, borderRadius: 8 },
  evidenciaDesc: { color: "#bdbdbd", fontSize: 10, maxWidth: 64 },
  evidenciaDelete: { position: "absolute", top: -4, right: -4, backgroundColor: "#1a1a1a", borderRadius: 10, padding: 4 },
  horasGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  horaBtn: { borderWidth: 1, borderColor: "rgba(212,165,75,0.25)", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 14 },
  horaBtnActive: { backgroundColor: "#caa24d", borderColor: "#caa24d" },
  horaBtnTxt: { color: "#f0c96f", fontSize: 13, fontFamily: FontFamilies.bodyMedium },
  // Botones
  btnPrimary: { backgroundColor: "#caa24d", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", flex: 1 },
  btnPrimaryTxt: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 13 },
  btnSecondary: { backgroundColor: "rgba(212,165,75,0.15)", borderWidth: 1, borderColor: "rgba(212,165,75,0.35)", borderRadius: 10, paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", flex: 1 },
  btnSecondaryTxt: { color: "#f0c96f", fontFamily: FontFamilies.button, fontSize: 13 },
  btnGhost: { borderRadius: 10, borderWidth: 1, borderColor: "rgba(212,165,75,0.35)", paddingVertical: 11, paddingHorizontal: 14, alignItems: "center", flex: 1 },
  btnGhostTxt: { color: "#f0c96f", fontFamily: FontFamilies.button, fontSize: 13 },
  btnCamera: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, backgroundColor: "#caa24d", borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12, marginTop: 6 },
  btnCameraTxt: { color: "#141414", fontFamily: FontFamilies.bodyBold, fontSize: 12 },
  calendarBtn: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: "#0f0f0f", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  calendarBtnTxt: { color: "#fff", fontSize: 13 },
  toastWrap: { position: "absolute", left: 0, right: 0, bottom: 90, alignItems: "center" },
  toast: { backgroundColor: "rgba(0,0,0,0.92)", borderWidth: 1, borderColor: "#c9a227", borderRadius: 40, paddingVertical: 9, paddingHorizontal: 16 },
  toastTxt: { color: "#f0c96f", fontSize: 12.5 },
});
