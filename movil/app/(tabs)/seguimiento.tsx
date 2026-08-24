// Rastrear pedido — GET /pedidos/{id}/seguimiento (igual que WEB).
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useLocalSearchParams } from "expo-router";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { ApiError } from "@/services/api";
import {
  obtenerSeguimiento,
  type SeguimientoPedido,
} from "@/services/cliente.services";

export default function SeguimientoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [datos, setDatos] = useState<SeguimientoPedido | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let activo = true;
    obtenerSeguimiento(Number(id))
      .then((d) => activo && setDatos(d))
      .catch((e) =>
        activo && setError(e instanceof ApiError ? e.message : "Error al cargar el seguimiento."),
      );
    return () => {
      activo = false;
    };
  }, [id]);

  return (
    <AppScreen titulo={`Rastrear pedido #${id}`}>
      {error && <Text style={S.error}>{error}</Text>}
      {!datos && !error && <Text style={S.gris}>Cargando...</Text>}

      {datos && (
        <View style={{ gap: 14 }}>
          <View style={S.tarjeta}>
            <FontAwesome6 name="box" size={16} color="#f0c96f" />
            <View style={{ flex: 1 }}>
              <Text style={S.titulo}>Estado de entrega</Text>
              <Text style={S.texto}>{datos.estado_entrega || "—"}</Text>
            </View>
          </View>

          {(datos.pasos ?? []).map((paso) => (
            <View key={paso.paso} style={[S.tarjeta, { flexDirection: "row", gap: 10 }]}>
              <FontAwesome6
                name={paso.completado ? "circle-check" : "circle"}
                size={15}
                color={paso.completado ? "#7ee29a" : "#6b6b6b"}
              />
              <Text style={S.texto}>{paso.paso}</Text>
            </View>
          ))}

          {datos.tecnico?.nombre && (
            <View style={S.tarjeta}>
              <Text style={S.subtitulo}>Técnico asignado</Text>
              <Text style={S.texto}>{datos.tecnico.nombre}</Text>
              {datos.tecnico.telefono && (
                <Text style={S.gris}>Tel: {datos.tecnico.telefono}</Text>
              )}
            </View>
          )}

          {datos.rango_entrega && (
            <Text style={S.gris}>Entrega estimada: {datos.rango_entrega}</Text>
          )}

          {datos.ubicacion && datos.estado_entrega === "En camino" && (
            <Text style={S.gris}>
              Ubicación actual del técnico: {datos.ubicacion.latitud.toFixed(5)},{" "}
              {datos.ubicacion.longitud.toFixed(5)}
            </Text>
          )}
        </View>
      )}
    </AppScreen>
  );
}

const S = StyleSheet.create({
  gris: { color: "#bdbdbd", fontSize: 13 },
  error: { color: "#f0858a", fontSize: 13 },
  tarjeta: {
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 14,
    gap: 4,
  },
  titulo: { color: "#f0c96f", fontSize: 13, fontFamily: FontFamilies.bodyBold },
  subtitulo: { color: "#ffffff", fontSize: 14, fontFamily: FontFamilies.bodyBold },
  texto: { color: "#ffffff", fontSize: 13.5 },
});
