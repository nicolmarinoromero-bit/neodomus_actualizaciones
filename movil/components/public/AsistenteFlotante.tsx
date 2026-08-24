// ─────────────────────────────────────────────────────────────
// Botón flotante ARRASTRABLE del asistente virtual.
// - Se arrastra por toda la pantalla sin salirse jamás
//   (clamp entre navbar y tab bar, respetando safe areas).
// - Posición persistente durante la sesión de la app.
// - X pequeña para ocultarlo + botón discreto para traerlo de vuelta.
// - Al tocarlo (sin arrastre) abre el MISMO ChatBot de Ayuda.
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useRef, useState } from "react";
import {
  Animated,
  Dimensions,
  Modal,
  PanResponder,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { NeodomusColors as C } from "@/constants/theme";
import ChatBot from "@/components/chat/ChatBot";

const TAM_FAB = 50;
const TAB_BAR_ESTIMADO = 66;
const MARGEN = 10;

// Persistencia durante la sesión (sobrevive al cambio de pestaña).
let fabPosicionGuardada: { x: number; y: number } | null = null;
let fabOcultoSesion = false;

export default function AsistenteFlotante() {
  const [chatAbierto, setChatAbierto] = useState(false);
  const insets = useSafeAreaInsets();
  const { width: ancho, height: alto } = Dimensions.get("window");

  const limites = useMemo(() => {
    const minY = insets.top + 74;
    const maxY = alto - TAB_BAR_ESTIMADO - insets.bottom - MARGEN - TAM_FAB;
    const maxX = ancho - TAM_FAB - MARGEN;
    return {
      minX: MARGEN,
      maxX: Math.max(MARGEN, maxX),
      minY,
      maxY: Math.max(minY, maxY),
    };
  }, [insets.top, insets.bottom, alto, ancho]);

  const [posicion, setPosicion] = useState(
    fabPosicionGuardada ?? {
      x: ancho - TAM_FAB - MARGEN,
      y: limites.maxY,
    },
  );
  const [oculto, setOculto] = useState(fabOcultoSesion);
  const posicionRef = useRef(posicion);
  const inicioArrastre = useRef<{
    px: number;
    py: number;
    ox: number;
    oy: number;
  } | null>(null);
  const distanciaMovida = useRef(0);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onPanResponderGrant: (evento) => {
        inicioArrastre.current = {
          px: evento.nativeEvent.pageX,
          py: evento.nativeEvent.pageY,
          ox: posicionRef.current.x,
          oy: posicionRef.current.y,
        };
        distanciaMovida.current = 0;
      },
      onPanResponderMove: (_evento, gesto) => {
        const inicio = inicioArrastre.current;
        if (!inicio) return;
        distanciaMovida.current = Math.max(
          distanciaMovida.current,
          Math.abs(gesto.dx) + Math.abs(gesto.dy),
        );
        const nx = Math.min(
          limites.maxX,
          Math.max(limites.minX, inicio.ox + gesto.dx),
        );
        const ny = Math.min(
          limites.maxY,
          Math.max(limites.minY, inicio.oy + gesto.dy),
        );
        posicionRef.current = { x: nx, y: ny };
        setPosicion({ x: nx, y: ny });
      },
      onPanResponderRelease: () => {
        // Toque sin arrastre → abrir asistente; arrastre → guardar posición.
        if (distanciaMovida.current < 8) {
          setChatAbierto(true);
        } else {
          fabPosicionGuardada = { ...posicionRef.current };
        }
        inicioArrastre.current = null;
      },
    }),
  ).current;

  const ocultarFab = () => {
    fabOcultoSesion = true;
    setOculto(true);
    fabPosicionGuardada = { ...posicionRef.current };
  };

  const mostrarFab = () => {
    fabOcultoSesion = false;
    setOculto(false);
  };

  return (
    <>
      {!oculto ? (
        <Animated.View
          {...panResponder.panHandlers}
          style={[styles.fabWrap, { left: posicion.x, top: posicion.y }]}
          accessible
          accessibilityRole="button"
          accessibilityLabel="Asistente virtual"
        >
          <View style={styles.fab}>
            <FontAwesome6 name="robot" size={19} color={C.textoSobreOro} />
          </View>
          <Pressable
            style={({ pressed }) => [
              styles.fabCerrar,
              pressed && styles.presionado,
            ]}
            onPress={ocultarFab}
            hitSlop={6}
            accessibilityLabel="Ocultar asistente virtual"
          >
            <FontAwesome6 name="xmark" size={9} color="#ffffff" />
          </Pressable>
        </Animated.View>
      ) : (
        <Pressable
          style={[
            styles.fabMini,
            {
              left: Math.min(limites.maxX, Math.max(limites.minX, posicion.x)),
              top: Math.min(limites.maxY, Math.max(limites.minY, posicion.y)),
            },
          ]}
          onPress={mostrarFab}
          accessibilityLabel="Mostrar asistente virtual"
        >
          <FontAwesome6 name="robot" size={13} color={C.oroSuave} />
        </Pressable>
      )}

      {/* Ventana COMPACTA del chat: esquina inferior derecha, sobre el FAB.
          El Modal permanece montado → la conversación se conserva al cerrar. */}
      <Modal
        visible={chatAbierto}
        transparent
        animationType="fade"
        onRequestClose={() => setChatAbierto(false)}
      >
        {/* Toque fuera de la ventana → cerrar (el contenido detrás sigue visible) */}
        <Pressable
          style={StyleSheet.absoluteFill}
          onPress={() => setChatAbierto(false)}
          accessibilityLabel="Cerrar asistente virtual"
        />

        <View style={[styles.panelWrap, { bottom: TAB_BAR_ESTIMADO + insets.bottom + 74 }]}>
          <View
            style={[
              styles.panel,
              {
                height: Math.min(480, alto * 0.6),
                width: Math.min(ancho - 24, 340),
              },
            ]}
          >
            <ChatBot
              altura={Math.min(480, alto * 0.6)}
              onCerrar={() => setChatAbierto(false)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  fabWrap: {
    position: "absolute",
    width: TAM_FAB,
    height: TAM_FAB,
  },

  fab: {
    flex: 1,
    borderRadius: TAM_FAB / 2,
    backgroundColor: "#d4a54b",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 2,
    borderColor: "#b8860b",
    shadowColor: "#d4a54b",
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 3 },
    elevation: 6,
  },

  fabCerrar: {
    position: "absolute",
    top: -3,
    right: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: "#2c3e2f",
    borderWidth: 1,
    borderColor: "#caa24d",
    alignItems: "center",
    justifyContent: "center",
  },

  fabMini: {
    position: "absolute",
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "rgba(212,165,75,0.22)",
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.5)",
    alignItems: "center",
    justifyContent: "center",
    opacity: 0.85,
  },

  // Ventana compacta anclada a la esquina inferior derecha.
  panelWrap: {
    position: "absolute",
    right: 12,
  },

  panel: {
    borderRadius: 18,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.35)",
    backgroundColor: "#0a0a0e",
    shadowColor: "#000000",
    shadowOpacity: 0.6,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 12,
  },

  presionado: { opacity: 0.7 },
});
