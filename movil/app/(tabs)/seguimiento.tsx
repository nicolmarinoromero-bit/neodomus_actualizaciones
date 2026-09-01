// Rastrear pedido — mapa OpenStreetMap + compartir ubicación GPS al técnico.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useLocalSearchParams, useFocusEffect } from "expo-router";
import * as Location from "expo-location";
import { WebView } from "react-native-webview";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { ApiError } from "@/services/api";
import {
  compartirUbicacionCliente,
  obtenerSeguimiento,
  type SeguimientoPedido,
} from "@/services/cliente.services";

const MAP_HEIGHT = 260;

function buildMapHtml(
  lat: number,
  lng: number,
  techLat?: number | null,
  techLng?: number | null,
  clientLabel?: string,
  techLabel?: string,
): string {
  const markers: string[] = [];
  markers.push(
    `<div class="marker client">${clientLabel || "Tu ubicación"}</div>`,
  );
  let centerLat = lat;
  let centerLng = lng;
  let zoom = 15;

  if (techLat != null && techLng != null) {
    centerLat = (lat + techLat) / 2;
    centerLng = (lng + techLng) / 2;
    const dist = Math.sqrt((lat - techLat) ** 2 + (lng - techLng) ** 2);
    zoom = dist < 0.005 ? 14 : dist < 0.02 ? 13 : 12;
    markers.push(
      `<div class="marker tech">${techLabel || "Técnico"}</div>`,
    );
  }

  return `<!DOCTYPE html>
<html><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1"/>
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>body,html,#map{margin:0;padding:0;height:100%;width:100%;}
.leaflet-control-attribution{display:none!important;}
.marker{background:#caa24d;color:#000;font:bold 11px sans-serif;padding:3px 7px;border-radius:8px;white-space:nowrap;box-shadow:0 1px 4px rgba(0,0,0,.5);}
.marker.tech{background:#4a90d9;color:#fff;}
</style></head><body>
<div id="map"></div>
<script>
var map=L.map('map',{zoomControl:false,attributionControl:false}).setView([${centerLat},${centerLng}],${zoom});
L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19}).addTo(map);
L.marker([${lat},${lng}]).addTo(map).bindPopup('<b>${clientLabel || "Tu ubicación"}</b>').openPopup();
${techLat != null && techLng != null ? `L.marker([${techLat},${techLng}],{icon:L.divIcon({className:'',html:'<div style="background:#4a90d9;color:#fff;padding:2px 6px;border-radius:6px;font:bold 10px sans-serif;">Técnico</div>',iconSize:[60,20],iconAnchor:[30,10]})}).addTo(map).bindPopup('<b>${techLabel || "Técnico"}</b>');` : ""}
</script></body></html>`;
}

export default function SeguimientoScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const [datos, setDatos] = useState<SeguimientoPedido | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [compartiendo, setCompartiendo] = useState(false);
  const [ubicacionCompartida, setUbicacionCompartida] = useState(false);

  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargar = useCallback(async () => {
    try {
      const d = await obtenerSeguimiento(Number(id));
      setDatos(d);
      if (d.ubicacion_cliente) setUbicacionCompartida(true);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar el seguimiento.");
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      void cargar();
      intervaloRef.current = setInterval(() => void cargar(), 30_000);
      return () => {
        if (intervaloRef.current) clearInterval(intervaloRef.current);
      };
    }, [cargar]),
  );

  const compartirUbicacion = async () => {
    try {
      setCompartiendo(true);
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        Alert.alert(
          "Permiso requerido",
          "Activa el permiso de ubicación para que el técnico pueda encontrarte.",
        );
        return;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      await compartirUbicacionCliente(Number(id), loc.coords.latitude, loc.coords.longitude);
      setUbicacionCompartida(true);
      Alert.alert("Ubicación compartida", "Tu ubicación fue enviada al técnico.");
      await cargar();
    } catch (e) {
      Alert.alert("Error", e instanceof ApiError ? e.message : "No se pudo compartir la ubicación.");
    } finally {
      setCompartiendo(false);
    }
  };

  const mostrarMapa = datos?.ubicacion && datos.estado_entrega === "En camino";
  const mostrarMapaCliente = ubicacionCompartida || datos?.ubicacion_cliente;

  const mapHtml =
    mostrarMapa && mostrarMapaCliente && datos?.ubicacion
      ? buildMapHtml(
          datos.ubicacion_cliente!.latitud,
          datos.ubicacion_cliente!.longitud,
          datos.ubicacion.latitud,
          datos.ubicacion.longitud,
          "Tu ubicación",
          datos.tecnico?.nombre || "Técnico",
        )
      : mostrarMapaCliente && datos?.ubicacion_cliente
        ? buildMapHtml(
            datos.ubicacion_cliente.latitud,
            datos.ubicacion_cliente.longitud,
          )
        : null;

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

          {/* Mapa del técnico en camino */}
          {mapHtml && (
            <View style={S.mapa}>
              <WebView
                source={{ html: mapHtml }}
                style={{ flex: 1, borderRadius: 12 }}
                scrollEnabled={false}
              />
            </View>
          )}

          {/* Coordenadas del técnico (fallback si no hay mapa) */}
          {datos.ubicacion && datos.estado_entrega === "En camino" && !mapHtml && (
            <View style={S.tarjeta}>
              <FontAwesome6 name="location-dot" size={14} color="#4a90d9" />
              <View>
                <Text style={S.subtitulo}>Ubicación del técnico</Text>
                <Text style={S.gris}>
                  {datos.ubicacion.latitud.toFixed(5)}, {datos.ubicacion.longitud.toFixed(5)}
                </Text>
              </View>
            </View>
          )}

          {/* Compartir ubicación */}
          {!ubicacionCompartida && (
            <Pressable
              style={({ pressed }) => [S.botonCompartir, pressed && S.presionado]}
              onPress={() => void compartirUbicacion()}
              disabled={compartiendo}
            >
              {compartiendo ? (
                <ActivityIndicator size="small" color="#141414" />
              ) : (
                <FontAwesome6 name="location-arrow" size={14} color="#141414" />
              )}
              <Text style={S.textoBoton}>
                {compartiendo ? "Enviando..." : "Compartir mi ubicación"}
              </Text>
            </Pressable>
          )}

          {ubicacionCompartida && (
            <View style={S.tarjeta}>
              <FontAwesome6 name="check-circle" size={14} color="#7ee29a" />
              <Text style={S.gris}>Ubicación compartida con el técnico</Text>
            </View>
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
    flexDirection: "row",
    alignItems: "center",
  },
  titulo: { color: "#f0c96f", fontSize: 13, fontFamily: FontFamilies.bodyBold },
  subtitulo: { color: "#ffffff", fontSize: 14, fontFamily: FontFamilies.bodyBold },
  texto: { color: "#ffffff", fontSize: 13.5 },
  mapa: {
    height: MAP_HEIGHT,
    borderRadius: 12,
    overflow: "hidden",
    backgroundColor: "#161616",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
  },
  botonCompartir: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#caa24d",
    borderRadius: 12,
    minHeight: 48,
  },
  textoBoton: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 14 },
  presionado: { opacity: 0.85 },
});
