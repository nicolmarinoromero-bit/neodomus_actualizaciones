// Mis reembolsos — GET /reembolsos/mis (solo lectura, como la WEB).
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { ApiError } from "@/services/api";
import {
  listarMisReembolsos,
  type Reembolso,
} from "@/services/cliente.services";

const COLOR_ESTADO = (estado: string) =>
  estado === "Reembolsado"
    ? "#7ee29a"
    : estado === "Rechazado"
      ? "#f0858a"
      : "#f6c344";

const LABEL_ESTADO = (estado: string) =>
  estado === "Reembolsado" ? "Reembolsado" : estado === "Rechazado" ? "Rechazado" : "En proceso";

export default function ReembolsosScreen() {
  const [lista, setLista] = useState<Reembolso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarMisReembolsos()
      .then(setLista)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Error al cargar reembolsos."),
      )
      .finally(() => setCargando(false));
  }, []);

  const resumen = useMemo(() => {
    const devueltos = lista.filter((r) => r.estado === "Reembolsado");
    return {
      totalDevuelto: devueltos.reduce((s, r) => s + (r.monto || 0), 0),
      enProceso: lista.filter((r) => r.estado !== "Reembolsado" && r.estado !== "Rechazado").length,
    };
  }, [lista]);

  return (
    <AppScreen titulo="Mis reembolsos">
      {cargando && <Text style={S.gris}>Cargando...</Text>}
      {error && <Text style={S.error}>{error}</Text>}
      {!cargando && lista.length === 0 && (
        <Text style={S.gris}>No tienes reembolsos registrados.</Text>
      )}

      {lista.length > 0 && (
        <View style={S.resumen}>
          <Text style={S.resumenTitulo}>
            Total devuelto: ${Math.round(resumen.totalDevuelto).toLocaleString("es-CO")} COP
          </Text>
          <Text style={S.gris}>{resumen.enProceso} en proceso · {lista.length} en total</Text>
        </View>
      )}

      {lista.map((r) => (
        <View key={r.id_reembolso} style={S.tarjeta}>
          <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
            <Text style={S.referencia}>{r.referencia}</Text>
            <Text style={[S.estado, { color: COLOR_ESTADO(r.estado) }]}>
              {LABEL_ESTADO(r.estado)}
            </Text>
          </View>
          <Text style={S.monto}>
            ${Math.round(r.monto).toLocaleString("es-CO")} COP
          </Text>
          {r.motivo && <Text style={S.gris}>Motivo: {r.motivo}</Text>}
          {!!r.created_at && (
            <Text style={S.gris}>Fecha: {String(r.created_at).slice(0, 10)}</Text>
          )}
        </View>
      ))}
    </AppScreen>
  );
}

const S = StyleSheet.create({
  gris: { color: "#bdbdbd", fontSize: 12.5 },
  error: { color: "#f0858a", fontSize: 13 },
  resumen: {
    backgroundColor: "rgba(212,165,75,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.28)",
    padding: 14,
    gap: 4,
  },
  resumenTitulo: { color: "#f0c96f", fontFamily: FontFamilies.bodyBold, fontSize: 14.5 },
  tarjeta: {
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 14,
    gap: 5,
  },
  referencia: { color: "#ffffff", fontFamily: FontFamilies.bodyBold, fontSize: 13.5 },
  estado: { fontSize: 12.5, fontFamily: FontFamilies.bodyMedium },
  monto: { color: "#f0c96f", fontFamily: FontFamilies.bodyBold, fontSize: 15 },
});
