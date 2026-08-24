// Mis servicios — ServiciosTab de la WEB: citas con tracker de 4 pasos
// (Solicitud → Técnico asignado → Confirmada → Realizada).
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { ApiError } from "@/services/api";
import {
  listarMisCitas,
  type Cita,
} from "@/services/cliente.services";

function pasosDe(cita: Cita) {
  const tecnicoAsignado = !!cita.id_tecnico || !!cita.nombre_tecnico;
  return [
    { paso: "Solicitud registrada", ok: true },
    { paso: "Técnico asignado", ok: tecnicoAsignado },
    { paso: "Cita confirmada", ok: cita.estado === "Confirmada" },
    { paso: "Servicio realizado", ok: cita.estado === "Finalizada" },
  ];
}

export default function MisServiciosScreen() {
  const [citas, setCitas] = useState<Cita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarMisCitas()
      .then(setCitas)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Error al cargar servicios."),
      )
      .finally(() => setCargando(false));
  }, []);

  return (
    <AppScreen titulo="Mis servicios">
      {cargando && <Text style={S.gris}>Cargando...</Text>}
      {error && <Text style={S.error}>{error}</Text>}
      {!cargando && citas.length === 0 && (
        <Text style={S.gris}>No tienes servicios asociados.</Text>
      )}

      {citas.map((cita) => (
        <View key={cita.id_cita} style={S.tarjeta}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={S.tipo}>{cita.tipo_servicio}</Text>
            <Text style={[S.estado, { color: "#f0c96f" }]}>{cita.estado}</Text>
          </View>
          <Text style={S.fecha}>
            {String(cita.fecha).slice(0, 10)} · {String(cita.hora).slice(0, 5)}
          </Text>

          {/* Tracker de pasos */}
          <View style={{ gap: 6, marginTop: 8 }}>
            {pasosDe(cita).map((paso) => (
              <View key={paso.paso} style={{ flexDirection: "row", gap: 9, alignItems: "center" }}>
                <FontAwesome6
                  name={paso.ok ? "circle-check" : "circle"}
                  size={13}
                  color={paso.ok ? "#7ee29a" : "#4a4a4a"}
                />
                <Text style={S.pasoTexto}>{paso.paso}</Text>
              </View>
            ))}
          </View>

          {cita.nombre_tecnico && (
            <View style={{ flexDirection: "row", alignItems: "center", gap: 9, marginTop: 10 }}>
              <FontAwesome6 name="screwdriver-wrench" size={12} color="#f0c96f" />
              <Text style={S.tecnico}>Técnico: {cita.nombre_tecnico}</Text>
            </View>
          )}
        </View>
      ))}
    </AppScreen>
  );
}

const S = StyleSheet.create({
  gris: { color: "#bdbdbd", fontSize: 12.5 },
  error: { color: "#f0858a", fontSize: 13 },
  tarjeta: {
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 14,
    gap: 6,
  },
  tipo: { color: "#ffffff", fontSize: 14.5, fontFamily: FontFamilies.bodyBold, textTransform: "capitalize" },
  estado: { fontSize: 12.5, fontFamily: FontFamilies.bodyMedium },
  fecha: { color: "#bdbdbd", fontSize: 12.5 },
  pasoTexto: { color: "#ffffff", fontSize: 13 },
  tecnico: { color: "#f0c96f", fontSize: 13 },
});
