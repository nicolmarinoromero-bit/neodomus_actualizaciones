// Componente reutilizable para estados vacíos: solo icono + texto corto.
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { FontFamilies } from "@/constants/theme";

interface Props {
  icono: string;
  texto: string;
}

export default function EmptyState({ icono, texto }: Props) {
  return (
    <View style={styles.wrap}>
      <FontAwesome6 name={icono as never} size={28} color="#5a5a5a" />
      <Text style={styles.texto}>{texto}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    paddingVertical: 32,
    gap: 10,
  },
  texto: {
    color: "#8a8a8a",
    fontSize: 13,
    fontFamily: FontFamilies.bodyMedium,
    textAlign: "center",
  },
});
