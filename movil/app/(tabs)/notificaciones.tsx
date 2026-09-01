// Notificaciones — listado REAL del usuario autenticado
// (GET /notificaciones/mias; tipos visibles al cliente, igual que WEB:
// reembolso, entrega, producto, promoción).
// Al abrir la pantalla se marcan como leídas con el endpoint EXISTENTE
// del backend (PATCH /notificaciones/leer-todas): así nunca aparecen
// indicadores de "no leídas" falsos ni persistentes.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";

import AppScreen from "@/components/app/AppScreen";
import EmptyState from "@/components/ui/EmptyState";
import { FontFamilies } from "@/constants/theme";
import { ApiError } from "@/services/api";
import {
  listarNotificaciones,
  marcarNotificacionesLeidas,
  type Notificacion,
} from "@/services/cliente.services";

const TIPOS_CLIENTE = ["reembolso", "entrega", "producto", "promocion"];
const INTERVALO_POLLING_MS = 30_000;

export default function NotificacionesScreen() {
  const [lista, setLista] = useState<Notificacion[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargar = useCallback(async () => {
    try {
      const todas = await listarNotificaciones();
      setLista(todas.filter((n) => TIPOS_CLIENTE.includes(n.tipo)));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar notificaciones.");
    } finally {
      setCargando(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void cargar();
      intervaloRef.current = setInterval(() => void cargar(), INTERVALO_POLLING_MS);
      return () => {
        if (intervaloRef.current) clearInterval(intervaloRef.current);
      };
    }, [cargar]),
  );

  // Marcar todas como leídas al abrir la pantalla.
  useEffect(() => {
    if (!cargando && lista.length > 0) {
      marcarNotificacionesLeidas().catch(() => {});
      setLista((prev) => prev.map((n) => ({ ...n, leida: true })));
    }
  }, [cargando, lista.length]);

  return (
    <AppScreen titulo="Notificaciones">
      {cargando && <Text style={S.gris}>Cargando...</Text>}
      {error && <Text style={S.error}>{error}</Text>}
      {!cargando && lista.length === 0 && (
        <EmptyState icono="bell" texto="Sin notificaciones" />
      )}

      {lista.map((n) => (
        <View
          key={n.id_notificacion}
          style={[S.tarjeta, !n.leida && S.noLeida]}
        >
          <View style={{ flexDirection: "row", justifyContent: "space-between", gap: 8 }}>
            <Text style={S.titulo} numberOfLines={1}>
              {n.titulo}
            </Text>
            {!!n.fecha_creacion && (
              <Text style={S.fecha}>{String(n.fecha_creacion).slice(0, 10)}</Text>
            )}
          </View>
          <Text style={S.mensaje}>{n.mensaje}</Text>
          <Text style={S.tipo}>#{n.tipo}</Text>
        </View>
      ))}
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
    gap: 5,
  },
  noLeida: {
    borderColor: "rgba(212,165,75,0.45)",
    backgroundColor: "rgba(212,165,75,0.06)",
  },
  titulo: { color: "#ffffff", fontSize: 14.5, fontFamily: FontFamilies.bodyBold, flex: 1 },
  mensaje: { color: "#bdbdbd", fontSize: 13, lineHeight: 19 },
  fecha: { color: "#6f6f6f", fontSize: 11 },
  tipo: { color: "#f0c96f", fontSize: 11 },
});
