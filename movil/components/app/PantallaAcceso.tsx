import React from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";

type PantallaAccesoProps = {
  titulo: string;
  tituloAcceso: string;
  mensaje: string;
  onIniciarSesion: () => void;
  onCrearCuenta?: () => void;
};

export default function PantallaAcceso({
  titulo,
  tituloAcceso,
  mensaje,
  onIniciarSesion,
  onCrearCuenta,
}: PantallaAccesoProps) {
  return (
    <AppScreen titulo={titulo}>
      <Text style={S.titulo}>{tituloAcceso}</Text>
      <Text style={S.texto}>{mensaje}</Text>
      <Pressable
        style={({ pressed }) => [S.botonOro, pressed && S.presionado]}
        onPress={onIniciarSesion}
      >
        <Text style={S.textoBotonOro}>Iniciar sesión</Text>
      </Pressable>
      {onCrearCuenta && (
        <Pressable
          style={({ pressed }) => [S.botonOutline, pressed && S.presionado]}
          onPress={onCrearCuenta}
        >
          <Text style={S.textoOutline}>Crear cuenta</Text>
        </Pressable>
      )}
    </AppScreen>
  );
}

const S = StyleSheet.create({
  titulo: {
    color: "#ffffff",
    fontSize: 18,
    fontFamily: FontFamilies.bodyBold,
    textAlign: "center",
  },
  texto: {
    color: "#bdbdbd",
    fontSize: 13.5,
    lineHeight: 20,
    textAlign: "center",
    marginBottom: 10,
  },
  botonOro: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "#caa24d",
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  textoBotonOro: {
    color: "#141414",
    fontFamily: FontFamilies.button,
    fontSize: 14,
  },
  botonOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.45)",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  textoOutline: {
    color: "#f0c96f",
    fontFamily: FontFamilies.button,
    fontSize: 13.5,
  },
  presionado: { opacity: 0.85 },
});