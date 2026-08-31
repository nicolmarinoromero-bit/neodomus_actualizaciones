// Solicitar devolución — wizard paso a paso:
// 1. Seleccionar productos y cantidades
// 2. Elegir motivo
// 3. Confirmar y enviar
import React, { useCallback, useEffect, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, router } from "expo-router";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { ApiError } from "@/services/api";
import {
  verificarElegibilidadDevolucion,
  solicitarDevolucion,
  type ProductoElegible,
  type ElegibilidadDevolucion,
} from "@/services/cliente.services";

interface ItemSeleccionado {
  id_producto: number;
  cantidad: number;
  maximo: number;
  precio_unitario: number;
  nombre: string;
}

export default function SolicitarDevolucionScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const idPedido = Number(id);

  const [paso, setPaso] = useState<1 | 2 | 3>(1);
  const [elegibilidad, setElegibilidad] = useState<ElegibilidadDevolucion | null>(null);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [seleccionados, setSeleccionados] = useState<ItemSeleccionado[]>([]);
  const [motivoTipo, setMotivoTipo] = useState("");
  const [motivoOtro, setMotivoOtro] = useState("");
  const [comentario, setComentario] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState(false);

  useEffect(() => {
    verificarElegibilidadDevolucion(idPedido)
      .then((e) => {
        setElegibilidad(e);
        if (!e.elegible && e.razon) setError(e.razon);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Error al verificar elegibilidad."))
      .finally(() => setCargando(false));
  }, [idPedido]);

  const toggleProducto = useCallback((producto: ProductoElegible) => {
    setSeleccionados((prev) => {
      const existe = prev.find((s) => s.id_producto === producto.id_producto);
      if (existe) return prev.filter((s) => s.id_producto !== producto.id_producto);
      return [
        ...prev,
        {
          id_producto: producto.id_producto,
          cantidad: 1,
          maximo: producto.cantidad_disponible,
          precio_unitario: producto.precio_unitario,
          nombre: producto.nombre,
        },
      ];
    });
  }, []);

  const actualizarCantidad = useCallback((idProducto: number, cantidad: number) => {
    setSeleccionados((prev) =>
      prev.map((s) =>
        s.id_producto === idProducto
          ? { ...s, cantidad: Math.max(1, Math.min(s.maximo, cantidad)) }
          : s,
      ),
    );
  }, []);

  const montoTotal = seleccionados.reduce((s, i) => s + i.cantidad * i.precio_unitario, 0);

  const enviar = async () => {
    if (!motivoTipo) {
      setError("Selecciona un motivo de devolución.");
      return;
    }
    if (motivoTipo === "otro" && !motivoOtro.trim()) {
      setError("Describe el motivo.");
      return;
    }
    setEnviando(true);
    setError(null);
    try {
      await solicitarDevolucion({
        id_pedido: idPedido,
        items: seleccionados.map((s) => ({ id_producto: s.id_producto, cantidad: s.cantidad })),
        motivo_tipo: motivoTipo,
        motivo_otro: motivoTipo === "otro" ? motivoOtro.trim() : undefined,
        comentario: comentario.trim() || undefined,
      });
      setExito(true);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al enviar la solicitud.");
    } finally {
      setEnviando(false);
    }
  };

  if (exito) {
    return (
      <AppScreen titulo="Devolución">
        <View style={S.centro}>
          <FontAwesome6 name="circle-check" size={48} color="#7ee29a" />
          <Text style={S.exitoTitulo}>Solicitud enviada</Text>
          <Text style={S.gris}>Tu solicitud de devolución está pendiente de revisión. Te notificaremos cuando sea procesada.</Text>
          <Pressable
            style={({ pressed }) => [S.botonPrimario, pressed && S.presionado]}
            onPress={() => router.replace("/(tabs)/pedidos")}
          >
            <Text style={S.textoBotonPrimario}>Volver a pedidos</Text>
          </Pressable>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen titulo="Solicitar devolución">
      {cargando && <Text style={S.gris}>Cargando productos...</Text>}
      {error && <Text style={S.error}>{error}</Text>}

      {!cargando && elegibilidad && (
        <ScrollView style={{ flex: 1 }}>
          {/* Indicador de pasos */}
          <View style={S.pasos}>
            {[1, 2, 3].map((p) => (
              <View key={p} style={[S.paso, paso >= p && S.pasoActivo]}>
                <Text style={[S.pasoTexto, paso >= p && S.pasoTextoActivo]}>{p}</Text>
              </View>
            ))}
          </View>

          {/* PASO 1: Seleccionar productos */}
          {paso === 1 && (
            <View style={{ gap: 10 }}>
              <Text style={S.titulo}>Selecciona los productos a devolver</Text>
              {elegibilidad.productos.map((prod) => {
                const sel = seleccionados.find((s) => s.id_producto === prod.id_producto);
                const seleccionado = !!sel;
                return (
                  <View key={prod.id_producto} style={[S.tarjeta, seleccionado && S.tarjetaSeleccionada]}>
                    <Pressable style={S.filaProducto} onPress={() => toggleProducto(prod)}>
                      <View style={[S.checkbox, seleccionado && S.checkboxActivo]}>
                        {seleccionado && <FontAwesome6 name="check" size={11} color="#141414" />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={S.productoNombre}>{prod.nombre}</Text>
                        <Text style={S.gris}>
                          Comprado: {prod.cantidad_comprada} · Disponible: {prod.cantidad_disponible}
                        </Text>
                        <Text style={S.precio}>${Math.round(prod.precio_unitario).toLocaleString("es-CO")} COP c/u</Text>
                      </View>
                    </Pressable>
                    {seleccionado && (
                      <View style={S.cantidadRow}>
                        <Pressable style={S.cantidadBtn} onPress={() => sel && actualizarCantidad(sel.id_producto, sel.cantidad - 1)}>
                          <FontAwesome6 name="minus" size={12} color="#f0c96f" />
                        </Pressable>
                        <Text style={S.cantidadText}>{sel.cantidad}</Text>
                        <Pressable style={S.cantidadBtn} onPress={() => sel && actualizarCantidad(sel.id_producto, sel.cantidad + 1)}>
                          <FontAwesome6 name="plus" size={12} color="#f0c96f" />
                        </Pressable>
                      </View>
                    )}
                  </View>
                );
              })}
              <Pressable
                style={({ pressed }) => [S.botonPrimario, pressed && S.presionado, seleccionados.length === 0 && S.deshabilitado]}
                disabled={seleccionados.length === 0}
                onPress={() => { setError(null); setPaso(2); }}
              >
                <Text style={S.textoBotonPrimario}>Siguiente</Text>
              </Pressable>
            </View>
          )}

          {/* PASO 2: Motivo */}
          {paso === 2 && (
            <View style={{ gap: 10 }}>
              <Text style={S.titulo}>¿Cuál es el motivo?</Text>
              {(elegibilidad.motivos || []).map((m) => (
                <Pressable
                  key={m.key}
                  style={[S.tarjeta, motivoTipo === m.key && S.tarjetaSeleccionada]}
                  onPress={() => setMotivoTipo(m.key)}
                >
                  <View style={S.filaProducto}>
                    <View style={[S.checkbox, motivoTipo === m.key && S.checkboxActivo]}>
                      {motivoTipo === m.key && <FontAwesome6 name="check" size={11} color="#141414" />}
                    </View>
                    <Text style={S.productoNombre}>{m.label}</Text>
                  </View>
                </Pressable>
              ))}
              {motivoTipo === "otro" && (
                <TextInput
                  style={S.input}
                  placeholder="Describe el motivo..."
                  placeholderTextColor="#8a8a8a"
                  value={motivoOtro}
                  onChangeText={setMotivoOtro}
                  multiline
                />
              )}
              <TextInput
                style={[S.input, { minHeight: 60 }]}
                placeholder="Comentario adicional (opcional)"
                placeholderTextColor="#8a8a8a"
                value={comentario}
                onChangeText={setComentario}
                multiline
              />
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable style={[S.botonOutline, { flex: 1 }]} onPress={() => setPaso(1)}>
                  <Text style={S.textoOutline}>Atrás</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [S.botonPrimario, { flex: 1 }, pressed && S.presionado, !motivoTipo && S.deshabilitado]}
                  disabled={!motivoTipo}
                  onPress={() => { setError(null); setPaso(3); }}
                >
                  <Text style={S.textoBotonPrimario}>Siguiente</Text>
                </Pressable>
              </View>
            </View>
          )}

          {/* PASO 3: Confirmar */}
          {paso === 3 && (
            <View style={{ gap: 10 }}>
              <Text style={S.titulo}>Resumen de tu devolución</Text>
              <View style={S.tarjeta}>
                <Text style={S.subtitulo}>Pedido #{idPedido}</Text>
                {seleccionados.map((s) => (
                  <Text key={s.id_producto} style={S.gris}>
                    {s.cantidad}× {s.nombre} — ${Math.round(s.cantidad * s.precio_unitario).toLocaleString("es-CO")} COP
                  </Text>
                ))}
                <View style={S.divider} />
                <Text style={S.total}>Total a devolver: ${Math.round(montoTotal).toLocaleString("es-CO")} COP</Text>
                <Text style={S.gris}>Motivo: {elegibilidad.motivos?.find((m) => m.key === motivoTipo)?.label ?? motivoTipo}</Text>
              </View>
              <View style={{ flexDirection: "row", gap: 10 }}>
                <Pressable style={[S.botonOutline, { flex: 1 }]} onPress={() => setPaso(2)}>
                  <Text style={S.textoOutline}>Atrás</Text>
                </Pressable>
                <Pressable
                  style={({ pressed }) => [S.botonPrimario, { flex: 1 }, pressed && S.presionado, enviando && S.deshabilitado]}
                  disabled={enviando}
                  onPress={() => void enviar()}
                >
                  <Text style={S.textoBotonPrimario}>{enviando ? "Enviando..." : "Confirmar devolución"}</Text>
                </Pressable>
              </View>
            </View>
          )}
        </ScrollView>
      )}
    </AppScreen>
  );
}

const S = StyleSheet.create({
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 14, paddingHorizontal: 30 },
  exitoTitulo: { color: "#ffffff", fontSize: 18, fontFamily: FontFamilies.bodyBold, textAlign: "center" },
  gris: { color: "#bdbdbd", fontSize: 12.5 },
  error: { color: "#f0858a", fontSize: 13 },
  titulo: { color: "#ffffff", fontSize: 15, fontFamily: FontFamilies.bodyBold },
  subtitulo: { color: "#f0c96f", fontSize: 13, fontFamily: FontFamilies.bodyBold },
  pasos: { flexDirection: "row", gap: 8, marginBottom: 16, justifyContent: "center" },
  paso: { width: 32, height: 32, borderRadius: 16, borderWidth: 1, borderColor: "rgba(212,165,75,0.28)", alignItems: "center", justifyContent: "center" },
  pasoActivo: { backgroundColor: "#caa24d", borderColor: "#caa24d" },
  pasoTexto: { color: "#f0c96f", fontSize: 13, fontFamily: FontFamilies.bodyBold },
  pasoTextoActivo: { color: "#141414" },
  tarjeta: {
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 14,
    gap: 8,
  },
  tarjetaSeleccionada: { borderColor: "rgba(212,165,75,0.45)", backgroundColor: "rgba(212,165,75,0.06)" },
  filaProducto: { flexDirection: "row", alignItems: "center", gap: 10 },
  checkbox: { width: 22, height: 22, borderRadius: 6, borderWidth: 1.5, borderColor: "rgba(212,165,75,0.45)", alignItems: "center", justifyContent: "center" },
  checkboxActivo: { backgroundColor: "#caa24d", borderColor: "#caa24d" },
  productoNombre: { color: "#ffffff", fontSize: 13.5, fontFamily: FontFamilies.bodyBold, flex: 1 },
  precio: { color: "#f0c96f", fontSize: 12.5 },
  cantidadRow: { flexDirection: "row", alignItems: "center", gap: 14, justifyContent: "center", marginTop: 6 },
  cantidadBtn: { width: 30, height: 30, borderRadius: 15, borderWidth: 1, borderColor: "rgba(212,165,75,0.45)", alignItems: "center", justifyContent: "center" },
  cantidadText: { color: "#ffffff", fontSize: 15, fontFamily: FontFamilies.bodyBold, minWidth: 24, textAlign: "center" },
  input: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 12,
    color: "#ffffff",
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14,
    minHeight: 46,
  },
  divider: { height: 1, backgroundColor: "rgba(255,255,255,0.09)", marginVertical: 6 },
  total: { color: "#f0c96f", fontSize: 14, fontFamily: FontFamilies.bodyBold },
  botonPrimario: { backgroundColor: "#caa24d", borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 10 },
  textoBotonPrimario: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 14 },
  botonOutline: { borderRadius: 10, borderWidth: 1, borderColor: "rgba(212,165,75,0.45)", paddingVertical: 13, paddingHorizontal: 13, alignItems: "center", marginTop: 10 },
  textoOutline: { color: "#f0c96f", fontFamily: FontFamilies.button, fontSize: 13 },
  deshabilitado: { opacity: 0.55 },
  presionado: { opacity: 0.85 },
});
