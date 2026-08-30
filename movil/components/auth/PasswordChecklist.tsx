// ─────────────────────────────────────────────────────────────
// Checklist visual de contraseña — mismos textos que la WEB
// ("La contraseña debe contener:" + ✓/✗ items).
// ─────────────────────────────────────────────────────────────

import React from "react";
import { StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import type { RequisitosContrasena } from "@/utils/validaciones";

const ITEMS: {
  clave: keyof RequisitosContrasena;
  texto: string;
}[] = [
  { clave: "length", texto: "8+ caracteres" },
  { clave: "uppercase", texto: "Una mayúscula" },
  { clave: "lowercase", texto: "Una minúscula" },
  { clave: "number", texto: "Un número" },
  { clave: "special", texto: "Carácter especial" },
];

export default function PasswordChecklist({
  requisitos,
}: {
  requisitos: RequisitosContrasena;
}) {
  return (
    <View style={styles.contenedor}>
      <Text style={styles.titulo}>La contraseña debe contener:</Text>
      {ITEMS.map((item) => {
        const ok = requisitos[item.clave];
        return (
          <View key={item.clave} style={styles.item}>
            <FontAwesome6
              name={ok ? "circle-check" : "circle-xmark"}
              size={13}
              color={ok ? C.verdeExito : C.rojoError}
            />
            <Text style={[styles.texto, ok && styles.textoOk]}>{item.texto}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    gap: 5,
  },

  titulo: {
    color: C.grisTexto,
    fontSize: 12.5,
    fontFamily: FontFamilies.bodyMedium,
    marginBottom: 2,
  },

  item: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  texto: {
    color: C.rojoError,
    fontSize: 12.5,
  },

  textoOk: {
    color: C.verdeExito,
  },
});
