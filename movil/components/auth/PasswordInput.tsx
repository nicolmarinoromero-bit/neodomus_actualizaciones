// ─────────────────────────────────────────────────────────────
// Input de contraseña con toggle de visibilidad DENTRO del campo.
// El icono queda alineado verticalmente (centrado), sin salirse
// del contenedor ni superponerse al texto (paddingRight reservado).
// Reutilizado por Registro, Login y Nueva contraseña.
// ─────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

interface PasswordInputProps {
  placeholder: string;
  value: string;
  onChangeText: (texto: string) => void;
  editable?: boolean;
  onSubmitEditing?: () => void;
  autoCapitalize?: "none" | "sentences" | "words";
  /** Controlado (registro comparte un solo toggle, como la web). */
  visible?: boolean;
  onToggleVisible?: () => void;
}

export default function PasswordInput({
  placeholder,
  value,
  onChangeText,
  editable = true,
  onSubmitEditing,
  autoCapitalize = "none",
  visible: visibleProp,
  onToggleVisible,
}: PasswordInputProps) {
  const [visibleInterno, setVisibleInterno] = useState(false);
  const controlado = visibleProp !== undefined && !!onToggleVisible;
  const visible = controlado ? !!visibleProp : visibleInterno;

  const alternar = () => {
    if (controlado) {
      onToggleVisible();
    } else {
      setVisibleInterno(!visibleInterno);
    }
  };

  return (
    <View style={styles.contenedor}>
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        placeholderTextColor="#8a8a8a"
        secureTextEntry={!visible}
        value={value}
        onChangeText={onChangeText}
        editable={editable}
        onSubmitEditing={onSubmitEditing}
        autoCapitalize={autoCapitalize}
      />
      <Pressable
        onPress={alternar}
        style={({ pressed }) => [
          styles.ojo,
          pressed && styles.presionado,
          !editable && styles.deshabilitado,
        ]}
        disabled={!editable}
        accessibilityLabel={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        accessibilityRole="button"
        hitSlop={6}
      >
        <FontAwesome6 name={visible ? "eye-slash" : "eye"} size={15} color="#9e9e9e" />
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    position: "relative",
    justifyContent: "center",
  },

  input: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 12,
    color: "#ffffff",
    paddingHorizontal: 13,
    // Espacio reservado para el ojo: el texto nunca lo invade.
    paddingRight: 46,
    paddingVertical: 11,
    fontSize: 14.5,
    minHeight: 48,
  },

  ojo: {
    position: "absolute",
    right: 6,
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
  },

  presionado: {
    backgroundColor: "rgba(255,255,255,0.06)",
  },

  deshabilitado: {
    opacity: 0.4,
  },
});
