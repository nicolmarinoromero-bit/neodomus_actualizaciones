// Mis reembolsos + Mis solicitudes de devolución — pestañas combinadas.
import React, { useCallback, useMemo, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { ApiError } from "@/services/api";
import {
  listarMisReembolsos,
  listarMisSolicitudesDevolucion,
  type Reembolso,
  type SolicitudDevolucion,
} from "@/services/cliente.services";

const COLOR_ESTADO_REEMBOLSO = (estado: string) =>
  estado === "Reembolsado"
    ? "#7ee29a"
    : estado === "Rechazado"
      ? "#f0858a"
      : "#f6c344";

const COLOR_ESTADO_DEVOLUCION = (estado: string) =>
  estado === "Reembolso procesado" || estado === "Recibida"
    ? "#7ee29a"
    : estado === "Rechazada"
      ? "#f0858a"
      : "#f6c344";

export default function ReembolsosScreen() {
  const [pestana, setPestana] = useState<"reembolsos" | "devoluciones">("reembolsos");
  const [reembolsos, setReembolsos] = useState<Reembolso[]>([]);
  const [devoluciones, setDevoluciones] = useState<SolicitudDevolucion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargar = useCallback(async () => {
    try {
      const [r, d] = await Promise.all([
        listarMisReembolsos(),
        listarMisSolicitudesDevolucion(),
      ]);
      setReembolsos(r);
      setDevoluciones(d);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar datos.");
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
      intervaloRef.current = setInterval(() => void cargar(), 30_000);
      return () => {
        if (intervaloRef.current) clearInterval(intervaloRef.current);
      };
    }, [cargar]),
  );

  const resumenReembolsos = useMemo(() => {
    const devueltos = reembolsos.filter((r) => r.estado === "Reembolsado");
    return {
      totalDevuelto: devueltos.reduce((s, r) => s + (r.monto || 0), 0),
      enProceso: reembolsos.filter((r) => r.estado !== "Reembolsado" && r.estado !== "Rechazado").length,
    };
  }, [reembolsos]);

  return (
    <AppScreen titulo="Mis reembolsos y devoluciones">
      {/* Pestañas */}
      <View style={S.pestanas}>
        <Pressable style={[S.pestana, pestana === "reembolsos" && S.pestanaActiva]} onPress={() => setPestana("reembolsos")}>
          <Text style={[S.pestanaTexto, pestana === "reembolsos" && S.pestanaTextoActivo]}>
            Reembolsos ({reembolsos.length})
          </Text>
        </Pressable>
        <Pressable style={[S.pestana, pestana === "devoluciones" && S.pestanaActiva]} onPress={() => setPestana("devoluciones")}>
          <Text style={[S.pestanaTexto, pestana === "devoluciones" && S.pestanaTextoActivo]}>
            Devoluciones ({devoluciones.length})
          </Text>
        </Pressable>
      </View>

      {cargando && <Text style={S.gris}>Cargando...</Text>}
      {error && <Text style={S.error}>{error}</Text>}

      {/* ── REEMBOLSOS ── */}
      {pestana === "reembolsos" && !cargando && (
        <>
          {reembolsos.length === 0 && (
            <Text style={S.gris}>No tienes reembolsos registrados.</Text>
          )}

          {reembolsos.length > 0 && (
            <View style={S.resumen}>
              <Text style={S.resumenTitulo}>
                Total devuelto: ${Math.round(resumenReembolsos.totalDevuelto).toLocaleString("es-CO")} COP
              </Text>
              <Text style={S.gris}>{resumenReembolsos.enProceso} en proceso · {reembolsos.length} en total</Text>
            </View>
          )}

          {reembolsos.map((r) => (
            <View key={r.id_reembolso} style={S.tarjeta}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={S.referencia}>{r.referencia}</Text>
                <Text style={[S.estado, { color: COLOR_ESTADO_REEMBOLSO(r.estado) }]}>
                  {r.estado}
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
        </>
      )}

      {/* ── SOLICITUDES DE DEVOLUCIÓN ── */}
      {pestana === "devoluciones" && !cargando && (
        <>
          {devoluciones.length === 0 && (
            <Text style={S.gris}>No tienes solicitudes de devolución.</Text>
          )}

          {devoluciones.map((d) => (
            <View key={d.id_solicitud} style={S.tarjeta}>
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <Text style={S.referencia}>{d.numero}</Text>
                <Text style={[S.estado, { color: COLOR_ESTADO_DEVOLUCION(d.estado) }]}>
                  {d.estado}
                </Text>
              </View>
              <Text style={S.gris}>Pedido #{d.id_pedido}</Text>
              {d.monto_total != null && d.monto_total > 0 && (
                <Text style={S.monto}>${Math.round(d.monto_total).toLocaleString("es-CO")} COP</Text>
              )}
              {d.motivo_label && <Text style={S.gris}>Motivo: {d.motivo_label}</Text>}
              {d.resolucion && <Text style={S.gris}>Resolución: {d.resolucion}</Text>}
              {d.motivo_rechazo && <Text style={S.error}>Rechazo: {d.motivo_rechazo}</Text>}
              {!!d.created_at && (
                <Text style={S.gris}>Fecha: {String(d.created_at).slice(0, 10)}</Text>
              )}
              {d.lineas && d.lineas.length > 0 && (
                <View style={{ marginTop: 6, gap: 3 }}>
                  {d.lineas.map((l, i) => (
                    <Text key={i} style={S.gris}>
                      {l.cantidad}× {l.nombre_producto} — ${Math.round(l.subtotal).toLocaleString("es-CO")} COP
                    </Text>
                  ))}
                </View>
              )}
            </View>
          ))}
        </>
      )}
    </AppScreen>
  );
}

const S = StyleSheet.create({
  pestanas: { flexDirection: "row", gap: 8, marginBottom: 12 },
  pestana: { flex: 1, borderRadius: 999, borderWidth: 1, borderColor: "rgba(212,165,75,0.28)", paddingVertical: 9, alignItems: "center" },
  pestanaActiva: { backgroundColor: "#caa24d", borderColor: "#caa24d" },
  pestanaTexto: { color: "#f0c96f", fontSize: 13, fontFamily: FontFamilies.bodyMedium },
  pestanaTextoActivo: { color: "#141414", fontFamily: FontFamilies.button },
  gris: { color: "#bdbdbd", fontSize: 12.5 },
  error: { color: "#f0858a", fontSize: 13 },
  resumen: {
    backgroundColor: "rgba(212,165,75,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.28)",
    padding: 14,
    gap: 4,
    marginBottom: 12,
  },
  resumenTitulo: { color: "#f0c96f", fontFamily: FontFamilies.bodyBold, fontSize: 14.5 },
  tarjeta: {
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 14,
    gap: 5,
    marginBottom: 10,
  },
  referencia: { color: "#ffffff", fontFamily: FontFamilies.bodyBold, fontSize: 13.5 },
  estado: { fontSize: 12.5, fontFamily: FontFamilies.bodyMedium },
  monto: { color: "#f0c96f", fontFamily: FontFamilies.bodyBold, fontSize: 15 },
});
