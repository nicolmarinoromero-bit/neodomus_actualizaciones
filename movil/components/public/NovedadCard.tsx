import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import type { Novedad } from "@/services/novedades.service";
import { formatearFechaNovedad } from "@/utils/novedades";

export const COLORES_ESTADO_NOVEDAD: Record<string, { fondo: string; borde: string }> = {
  Pendiente: { fondo: "rgba(246,195,68,0.12)", borde: "rgba(246,195,68,0.25)" },
  "En revisión": { fondo: "rgba(131,165,233,0.12)", borde: "rgba(131,165,233,0.25)" },
  Aprobada: { fondo: "rgba(126,226,154,0.12)", borde: "rgba(126,226,154,0.25)" },
  Resuelta: { fondo: "rgba(126,226,154,0.15)", borde: "rgba(126,226,154,0.3)" },
  Cerrada: { fondo: "rgba(255,255,255,0.06)", borde: "rgba(255,255,255,0.1)" },
  Rechazada: { fondo: "rgba(240,133,138,0.12)", borde: "rgba(240,133,138,0.25)" },
};


interface NovedadCardProps {
  novedad: Novedad;
  onPress: () => void;
  colorPrioridad: string;
  mostrarMensajesCliente?: boolean;
}

export function NovedadCard({
  novedad,
  onPress,
  colorPrioridad,
  mostrarMensajesCliente = false,
}: NovedadCardProps) {
  const coloresEstado = COLORES_ESTADO_NOVEDAD[novedad.estado_novedad];

  return (
    <Pressable style={styles.card} onPress={onPress}>
      <View style={styles.cardTop}>
        <Text style={styles.cardId}>#{novedad.id_novedad}</Text>
        <View
          style={[
            styles.badge,
            {
              backgroundColor: coloresEstado?.fondo ?? "#222",
              borderColor: coloresEstado?.borde ?? "#444",
            },
          ]}
        >
          <Text style={styles.badgeText}>
            {novedad.estado_novedad_label || novedad.estado_novedad}
          </Text>
        </View>
      </View>

      <Text style={styles.cardTipo}>
        {novedad.tipo_novedad_label || novedad.tipo_novedad}
      </Text>

      <View style={styles.cardMeta}>
        {novedad.cliente_nombre && (
          <View style={styles.cardMetaItem}>
            <FontAwesome6 name="user" size={10} color="#8a8a8a" />
            <Text style={styles.cardMetaText}>{novedad.cliente_nombre}</Text>
          </View>
        )}
        {novedad.id_pedido && (
          <View style={styles.cardMetaItem}>
            <FontAwesome6 name="file-invoice" size={10} color="#8a8a8a" />
            <Text style={styles.cardMetaText}>#{novedad.id_pedido}</Text>
          </View>
        )}
        {novedad.id_cita && (
          <View style={styles.cardMetaItem}>
            <FontAwesome6 name="calendar-check" size={10} color="#8a8a8a" />
            <Text style={styles.cardMetaText}>Cita #{novedad.id_cita}</Text>
          </View>
        )}
      </View>

      <View style={styles.cardBottom}>
        <Text style={styles.cardFecha}>{formatearFechaNovedad(novedad.fecha_reporte)}</Text>
        <View style={[styles.prioridadDot, { backgroundColor: colorPrioridad }]} />
      </View>

      {!!novedad.evidencias?.length && (
        <View style={styles.evidenciaCount}>
          <FontAwesome6 name="camera" size={10} color={C.oro} />
          <Text style={styles.evidenciaCountText}>{novedad.evidencias.length} evidencia(s)</Text>
        </View>
      )}

      {mostrarMensajesCliente && novedad.mensaje_cliente && (
        <View style={styles.cardMensaje}>
          <FontAwesome6 name="paper-plane" size={10} color="#d4a54b" />
          <Text style={styles.cardMensajeText}>Mensaje del admin</Text>
        </View>
      )}
      {mostrarMensajesCliente && novedad.solucion_cliente && (
        <View style={styles.cardSolucion}>
          <FontAwesome6 name="check-circle" size={10} color="#46d06f" />
          <Text style={styles.cardSolucionText}>Solución disponible</Text>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: "rgba(24,24,24,0.9)", borderWidth: 1, borderColor: "rgba(211,172,77,0.2)", borderRadius: 14, padding: 14, marginBottom: 10 },
  cardTop: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  cardId: { fontFamily: FontFamilies.bodyBold, fontSize: 14, color: C.oro },
  badge: { paddingVertical: 3, paddingHorizontal: 10, borderRadius: 20, borderWidth: 1 },
  badgeText: { fontFamily: FontFamilies.bodyBold, fontSize: 10, color: C.oro },
  cardTipo: { fontFamily: FontFamilies.bodyBold, fontSize: 13, color: "#fff", marginBottom: 6 },
  cardMeta: { flexDirection: "row", flexWrap: "wrap", gap: 10, marginBottom: 6 },
  cardMetaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  cardMetaText: { fontFamily: FontFamilies.body, fontSize: 11, color: "#8a8a8a" },
  cardBottom: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  cardFecha: { fontFamily: FontFamilies.body, fontSize: 11, color: "#666" },
  prioridadDot: { width: 8, height: 8, borderRadius: 4 },
  evidenciaCount: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: "rgba(255,255,255,0.06)" },
  evidenciaCountText: { fontFamily: FontFamilies.body, fontSize: 11, color: C.oro },
  cardMensaje: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  cardMensajeText: { fontFamily: FontFamilies.body, fontSize: 10, color: "#d4a54b" },
  cardSolucion: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 4 },
  cardSolucionText: { fontFamily: FontFamilies.body, fontSize: 10, color: "#46d06f" },
});
