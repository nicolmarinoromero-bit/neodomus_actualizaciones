import React, { useEffect, useState, useRef } from "react";
import { useIdioma } from "@/contexts/IdiomaContext";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View, Modal } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import { apiFetch } from "@/services/api";
import { useScrollTopAlEntrar } from "@/hooks/useScrollTopAlEntrar";

export default function TecnicoEntregasScreen() {
  const scrollRef = useRef<ScrollView>(null);
  const { t } = useIdioma();
  useScrollTopAlEntrar(scrollRef);
  const insets = useSafeAreaInsets();
  const [entregas, setEntregas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [recogiendoId, setRecogiendoId] = useState<number | null>(null);
  const [confirmRecogida, setConfirmRecogida] = useState<any | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const cargar = async () => {
    try {
      const res = await apiFetch<any[]>("/tecnicos/mis-entregas");
      setEntregas(res || []);
    } catch {}
    setLoading(false);
  };
  useEffect(() => { cargar(); }, []);
  useEffect(() => { if (!toast) return; const t=setTimeout(()=>setToast(null),2500); return()=>clearTimeout(t); }, [toast]);

  const confirmarRecogida = async () => {
    if (!confirmRecogida) return;
    setRecogiendoId(confirmRecogida.id_pedido);
    try {
      await apiFetch(`/tecnicos/entregas/${confirmRecogida.id_pedido}/estado`, { method: "PUT", body: JSON.stringify({ estado: "Recogido" }) });
      setToast("Entrega marcada como recogida");
      setConfirmRecogida(null);
      cargar();
    } catch (e:any) { setToast(e?.message || "Error"); }
    setRecogiendoId(null);
  };

  if (loading) return <View style={styles.centro}><ActivityIndicator color={C.oro} /><Text style={styles.gris}>Cargando entregas...</Text></View>;
  return (
    <View style={styles.pantalla}>
      <ScrollView ref={scrollRef} contentContainerStyle={[styles.contenido, { paddingBottom: insets.bottom + 72 }]} showsVerticalScrollIndicator={false}>
        <Text style={styles.titulo}>{t("entregas.titulo")}</Text>
        <Text style={styles.sub}>{t("entregas.subtitulo")}</Text>
        {entregas.length === 0 ? (
          <View style={styles.empty}><FontAwesome6 name="truck-fast" size={24} color="#5a5a5a" /><Text style={styles.gris}>{t("tecnico.sinEntregas")}</Text></View>
        ) : entregas.map((e) => (
          <View key={e.id_pedido} style={styles.card}>
            <View style={styles.cardHead}>
              <Text style={styles.cardTitle}>{e.cliente} · Pedido #{e.id_pedido}</Text>
              <View style={[styles.badge, e.estado_entrega === "Entregado" ? styles.bOk : e.estado_entrega === "En camino" ? styles.bInfo : styles.bPend]}><Text style={styles.badgeTxt}>{e.estado_entrega || "Asignada"}</Text></View>
            </View>
            <Text style={styles.cardSub}>{e.fecha_entrega || ""} {e.hora_entrega || ""} · {e.direccion || ""}</Text>
            {e.telefono ? <Text style={styles.cardSub}>Tel: {e.telefono}</Text> : null}
            {(e.estado_entrega === "Asignada" || !e.estado_entrega) && (
              <Pressable onPress={() => setConfirmRecogida(e)} disabled={recogiendoId===e.id_pedido} style={[styles.btnRecogida, recogiendoId===e.id_pedido && {opacity:0.6}]}>
                <FontAwesome6 name="box-open" size={12} color="#141414" />
                <Text style={styles.btnRecogidaTxt}>{recogiendoId===e.id_pedido ? t("entregas.actualizando") : t("entregas.yaRecogi")}</Text>
              </Pressable>
            )}
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!confirmRecogida} transparent animationType="fade" onRequestClose={() => setConfirmRecogida(null)} statusBarTranslucent>
        <View style={styles.modalOverlay}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>{t("entregas.confirmarRecogida")}</Text>
            <Text style={styles.gris}>{t("entregas.confirmarRecogidaMsg")}</Text>
            {confirmRecogida ? <View style={styles.confirmBox}><Text style={styles.cardTitle}>Pedido #{confirmRecogida.id_pedido}</Text><Text style={styles.cardSub}>{confirmRecogida.cliente}</Text></View> : null}
            <View style={{ flexDirection:"row", gap:10, marginTop:12 }}>
              <Pressable onPress={() => setConfirmRecogida(null)} style={styles.btnGhost}><Text style={styles.btnGhostTxt}>Cancelar</Text></Pressable>
              <Pressable onPress={confirmarRecogida} style={[styles.btnPrimary, {flex:1}]}><Text style={styles.btnPrimaryTxt}>Confirmar</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {toast && <View style={styles.toastWrap} pointerEvents="none"><View style={styles.toast}><Text style={styles.toastTxt}>{toast}</Text></View></View>}
    </View>
  );
}
const styles = StyleSheet.create({
  pantalla: { flex: 1, backgroundColor: "#000" },
  contenido: { padding: 14, gap: 12 },
  centro: { flex: 1, backgroundColor: "#000", alignItems: "center", justifyContent: "center", gap: 10, paddingTop: 40 },
  gris: { color: "#bdbdbd", fontSize: 12.5 },
  titulo: { color: "#fff", fontSize: 18, fontFamily: FontFamilies.bodyBold },
  sub: { color: "#bdbdbd", fontSize: 13, marginTop: -8 },
  card: { backgroundColor: "#161616", borderWidth: 1, borderColor: "rgba(255,255,255,0.09)", borderRadius: 12, padding: 12, gap: 6 },
  cardHead: { flexDirection:"row", justifyContent:"space-between", alignItems:"center", gap:8 },
  cardTitle: { color: "#fff", fontSize: 14, fontFamily: FontFamilies.bodyBold, flex:1 },
  cardSub: { color: "#bdbdbd", fontSize: 12 },
  badge: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, borderWidth: 1 },
  bOk: { backgroundColor: "rgba(126,226,154,0.15)", borderColor: "rgba(126,226,154,0.3)" },
  bInfo: { backgroundColor: "rgba(212,165,75,0.12)", borderColor: "rgba(212,165,75,0.25)" },
  bPend: { backgroundColor: "rgba(246,195,68,0.12)", borderColor: "rgba(246,195,68,0.25)" },
  badgeTxt: { color: "#fff", fontSize: 10, fontFamily: FontFamilies.bodyBold },
  empty: { alignItems: "center", paddingVertical: 30, gap: 8 },
  btnRecogida: { flexDirection:"row", alignItems:"center", justifyContent:"center", gap:6, backgroundColor:"#caa24d", borderRadius:8, paddingVertical:8, marginTop:6 },
  btnRecogidaTxt: { color:"#141414", fontFamily: FontFamilies.bodyBold, fontSize:12 },
  modalOverlay: { flex:1, backgroundColor:"rgba(0,0,0,0.72)", justifyContent:"center", padding:16 },
  modalCard: { backgroundColor:"#121212", borderRadius:16, borderWidth:1, borderColor:"rgba(212,165,75,0.28)", padding:16, gap:10 },
  modalTitle: { color:"#fff", fontSize:16, fontFamily: FontFamilies.bodyBold, textAlign:"center" },
  confirmBox: { backgroundColor:"rgba(212,165,75,0.08)", borderWidth:1, borderColor:"rgba(212,165,75,0.18)", borderRadius:10, padding:10, marginTop:6 },
  btnPrimary: { backgroundColor:"#caa24d", borderRadius:10, paddingVertical:11, alignItems:"center", flex:1 },
  btnPrimaryTxt: { color:"#141414", fontFamily: FontFamilies.button, fontSize:13 },
  btnGhost: { flex:1, borderRadius:10, borderWidth:1, borderColor:"rgba(212,165,75,0.35)", paddingVertical:11, alignItems:"center" },
  btnGhostTxt: { color:"#f0c96f", fontFamily: FontFamilies.button, fontSize:13 },
  toastWrap: { position: "absolute", left: 0, right: 0, bottom: 90, alignItems: "center" },
  toast: { backgroundColor: "rgba(0,0,0,0.92)", borderWidth: 1, borderColor: "#c9a227", borderRadius: 40, paddingVertical: 9, paddingHorizontal: 16 },
  toastTxt: { color: "#f0c96f", fontSize: 12.5 },
});