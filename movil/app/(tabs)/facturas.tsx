// Mis facturas — FacturasTab de la WEB: pedidos con factura + PDF real.
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useFocusEffect } from "expo-router";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/services/api";
import {
  descargarFacturaPdf,
  listarMisPedidos,
  type Pedido,
} from "@/services/cliente.services";

export default function FacturasScreen() {
  const { usuario } = useAuth();
  const [pedidos, setPedidos] = useState<Pedido[]>([]);
  const [cargando, setCargando] = useState(true);
  const [, setError] = useState<string | null>(null);
  const [descargandoId, setDescargandoId] = useState<number | null>(null);
  const intervaloRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cargar = useCallback(async () => {
    try {
      const lista = await listarMisPedidos();
      setPedidos(lista.filter((p) => p.factura));
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cargar facturas.");
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

  const descargar = async (pedido: Pedido) => {
    if (!usuario || !pedido.factura?.pdf_url) return;
    setDescargandoId(pedido.id_pedido);
    try {
      const { obtenerSesion } = await import("@/services/storage");
      const sesion = await obtenerSesion();
      await descargarFacturaPdf(pedido.factura.pdf_url, sesion?.accessToken ?? "");
    } catch {
      setError("No se pudo descargar la factura.");
    } finally {
      setDescargandoId(null);
    }
  };

  return (
    <AppScreen titulo="Mis facturas">
      {cargando && <Text style={S.gris}>Cargando...</Text>}
      {!cargando && pedidos.length === 0 && (
        <Text style={S.gris}>No tienes facturas disponibles.</Text>
      )}

      {pedidos.map((p) => (
        <View key={p.id_pedido} style={S.tarjeta}>
          <View>
            <Text style={S.numero}>{p.factura?.numero_factura}</Text>
            <Text style={S.gris}>
              Pedido #{p.id_pedido} ·{" "}
              ${Math.round(p.total).toLocaleString("es-CO")} COP
            </Text>
            {p.pago?.metodo_pago_nombre && (
              <Text style={S.gris}>Método: {p.pago.metodo_pago_nombre}</Text>
            )}
            <Text style={S.gris}>
              Enviada a tu correo: {p.factura?.enviada_por_correo ? "Sí" : "—"}
            </Text>
          </View>

          <Pressable
            disabled={descargandoId === p.id_pedido}
            onPress={() => void descargar(p)}
            style={({ pressed }) => [
              S.boton,
              pressed && S.presionado,
              descargandoId === p.id_pedido && S.deshabilitado,
            ]}
          >
            <Text style={S.textoBoton}>
              {descargandoId === p.id_pedido ? "Descargando..." : "PDF"}
            </Text>
          </Pressable>
        </View>
      ))}
    </AppScreen>
  );
}

const S = StyleSheet.create({
  gris: { color: "#bdbdbd", fontSize: 12.5 },
  error: { color: "#f0858a", fontSize: 13 },
  tarjeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 14,
  },
  numero: { color: "#ffffff", fontFamily: FontFamilies.bodyBold, fontSize: 14.5 },
  boton: {
    backgroundColor: "#caa24d",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 15,
  },
  deshabilitado: { opacity: 0.55 },
  presionado: { opacity: 0.85 },
  textoBoton: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 13 },
});
