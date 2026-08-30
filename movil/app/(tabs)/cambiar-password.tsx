// Cambiar contraseña — POST /auth/change-password con las reglas y
// mensajes EXACTOS de la WEB (PasswordTab/ChangePassword).
import React, { useState } from "react";
import { Pressable, StyleSheet, Text } from "react-native";

import AppScreen from "@/components/app/AppScreen";
import PasswordChecklist from "@/components/auth/PasswordChecklist";
import PasswordInput from "@/components/auth/PasswordInput";
import { FontFamilies } from "@/constants/theme";

import { ApiError } from "@/services/api";
import { cambiarPassword } from "@/services/cliente.services";
import {
  contrasenaValida,
  evaluarContrasena,
} from "@/utils/validaciones";

export default function CambiarPasswordScreen() {

  const [actual, setActual] = useState("");
  const [nueva, setNueva] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [requisitos, setRequisitos] = useState(evaluarContrasena(""));
  const [guardando, setGuardando] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const guardar = async () => {
    setError(null);
    if (nueva !== confirmar) {
      setError("Las nuevas contraseñas no coinciden");
      return;
    }
    if (!contrasenaValida(requisitos)) {
      setError(
        "La contraseña debe tener al menos 8 caracteres, una mayúscula, una minúscula, un número y un carácter especial",
      );
      return;
    }
    if (actual === nueva) {
      setError("La nueva contraseña debe ser diferente a la actual");
      return;
    }

    setGuardando(true);
    try {
      await cambiarPassword(actual, nueva);
      setExito("Contraseña actualizada correctamente");
      setActual("");
      setNueva("");
      setConfirmar("");
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al cambiar contraseña");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <AppScreen titulo="Cambiar contraseña">
      <Text style={S.label}>Contraseña actual</Text>
      <PasswordInput placeholder="Contraseña actual" value={actual} onChangeText={setActual} editable={!guardando} />

      <Text style={S.label}>Nueva contraseña</Text>
      <PasswordInput
        placeholder="Nueva contraseña"
        value={nueva}
        onChangeText={(v) => {
          setNueva(v);
          setRequisitos(evaluarContrasena(v));
        }}
        editable={!guardando}
      />
      {nueva.length > 0 && <PasswordChecklist requisitos={requisitos} />}

      <Text style={S.label}>Confirmar nueva contraseña</Text>
      <PasswordInput placeholder="Confirmar nueva contraseña" value={confirmar} onChangeText={setConfirmar} editable={!guardando} />

      {error && <Text style={S.error}>{error}</Text>}
      {exito && <Text style={S.exito}>{exito}</Text>}

      <Pressable
        style={({ pressed }) => [
          S.boton,
          pressed && S.presionado,
          guardando && S.deshabilitado,
        ]}
        onPress={() => void guardar()}
        disabled={guardando}
      >
        <Text style={S.textoBoton}>{guardando ? "Guardando..." : "Guardar"}</Text>
      </Pressable>
    </AppScreen>
  );
}

const S = StyleSheet.create({
  label: { color: "#ffffff", fontSize: 13, fontFamily: FontFamilies.bodyMedium, marginTop: 8, marginBottom: 5 },
  error: { color: "#f0858a", fontSize: 13, textAlign: "center", lineHeight: 19 },
  exito: { color: "#7ee29a", fontSize: 13, textAlign: "center", lineHeight: 19 },
  boton: { backgroundColor: "#caa24d", borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 14 },
  deshabilitado: { opacity: 0.55 },
  presionado: { opacity: 0.85 },
  textoBoton: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 14.5 },
});
