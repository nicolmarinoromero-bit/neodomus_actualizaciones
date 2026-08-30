// ─────────────────────────────────────────────────────────────
// Nueva contraseña — adaptación móvil del ResetPassword.tsx.
// Recibe el token (código de 6 dígitos validado), misma regex y
// checklist, mismos mensajes. Actualiza la contraseña REAL en BD
// vía POST /auth/reset-password.
// ─────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import AuthScreen from "@/components/auth/AuthScreen";
import PasswordChecklist from "@/components/auth/PasswordChecklist";
import PasswordInput from "@/components/auth/PasswordInput";
import { restablecerPassword } from "@/services/auth.services";
import { ApiError } from "@/services/api";
import {
  contrasenaValida,
  evaluarContrasena,
} from "@/utils/validaciones";

export default function NuevaPasswordScreen() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [nuevaPassword, setNuevaPassword] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [requisitos, setRequisitos] = useState(evaluarContrasena(""));
  const [cargando, setCargando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const programarLimpiezaError = () => {
    // La web limpia el error a los 5000 ms.
    setTimeout(() => setError(null), 5000);
  };

  const restablecer = async () => {
    if (!token) {
      setError("Token no válido");
      return;
    }
    if (nuevaPassword !== confirmar) {
      setError("Las contraseñas no coinciden");
      programarLimpiezaError();
      return;
    }
    if (!contrasenaValida(requisitos)) {
      setError("La contraseña no cumple los requisitos.");
      programarLimpiezaError();
      return;
    }

    setCargando(true);
    setError(null);
    try {
      await restablecerPassword(token, nuevaPassword);
      setMensajeExito(
        "Contraseña actualizada correctamente. Volviendo al inicio de sesión...",
      );
      setTimeout(() => router.replace("/login"), 2000);
    } catch (e) {
      if (e instanceof ApiError && e.status === 403) {
        setError(
          "Este enlace fue solicitado desde otra IP. Solicita un nuevo restablecimiento.",
        );
      } else {
        setError(
          e instanceof ApiError
            ? e.message
            : "Error al restablecer la contraseña",
        );
      }
    } finally {
      setCargando(false);
    }
  };

  if (!token) {
    // Guard igual que la web ("Enlace inválido").
    return (
      <AuthScreen>
        <View style={styles.tarjeta}>
          <Text style={styles.titulo}>Enlace inválido</Text>
          <Text style={styles.error}>
            El enlace ha expirado o no es válido.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.botonSecundario,
              pressed && styles.presionado,
            ]}
            onPress={() => router.replace("/recuperar-password")}
          >
            <Text style={styles.textoBotonSecundario}>Solicitar nuevamente</Text>
          </Pressable>
        </View>
      </AuthScreen>
    );
  }

  const todoValido = contrasenaValida(requisitos);

  return (
    <AuthScreen>
      <View style={styles.tarjeta}>
        <View style={styles.iconoCandado}>
          <FontAwesome6 name="lock" size={20} color={C.oroSuave} />
        </View>
        <Text style={styles.titulo}>Nueva contraseña</Text>
        <Text style={styles.instruccion}>
          Crea una nueva contraseña segura para acceder nuevamente a tu cuenta.
        </Text>

        <Text style={styles.label}>Nueva contraseña</Text>
        <PasswordInput
          placeholder="Nueva contraseña"
          value={nuevaPassword}
          onChangeText={(valor) => {
            setNuevaPassword(valor);
            setRequisitos(evaluarContrasena(valor));
          }}
        />

        {nuevaPassword.length > 0 && (
          <PasswordChecklist requisitos={requisitos} />
        )}

        <Text style={styles.label}>Confirmar contraseña</Text>
        <PasswordInput
          placeholder="Confirmar contraseña"
          value={confirmar}
          onChangeText={setConfirmar}
          onSubmitEditing={() => void restablecer()}
        />

        {confirmar.length > 0 && (
          <Text
            style={
              confirmar === nuevaPassword ? styles.matchOk : styles.matchError
            }
          >
            {confirmar === nuevaPassword
              ? "✓ Las contraseñas coinciden"
              : "Las contraseñas no coinciden"}
          </Text>
        )}

        {error && <Text style={styles.error}>{error}</Text>}
        {mensajeExito && <Text style={styles.exito}>{mensajeExito}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.boton,
            pressed && styles.presionado,
            (cargando || !todoValido) && styles.deshabilitado,
          ]}
          onPress={() => void restablecer()}
          disabled={cargando || !todoValido}
        >
          <Text style={styles.textoBoton}>
            {cargando ? "Actualizando..." : "Restablecer contraseña"}
          </Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: "rgba(10,10,14,0.82)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.bordeOro,
    padding: 18,
    gap: 10,
  },

  iconoCandado: {
    alignSelf: "center",
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: C.bordeOro,
    backgroundColor: "rgba(212,165,75,0.08)",
    alignItems: "center",
    justifyContent: "center",
  },

  titulo: {
    color: C.blanco,
    fontSize: 22,
    fontFamily: FontFamilies.bodyBold,
    textAlign: "center",
  },

  instruccion: {
    color: C.grisTexto,
    fontSize: 13.5,
    lineHeight: 21,
    textAlign: "center",
  },

  label: {
    color: C.blanco,
    fontSize: 13,
    fontFamily: FontFamilies.bodyMedium,
    marginTop: 4,
    marginBottom: -3,
  },

  inputWrap: {
    position: "relative",
    justifyContent: "center",
  },

  input: {
    backgroundColor: C.inputFondo,
    borderWidth: 1,
    borderColor: C.grisBorde,
    borderRadius: 12,
    color: C.blanco,
    paddingHorizontal: 13,
    paddingRight: 44,
    paddingVertical: 11,
    fontSize: 14.5,
    minHeight: 46,
  },

  ojo: {
    position: "absolute",
    right: 14,
  },

  matchOk: {
    color: C.verdeExito,
    fontSize: 12.5,
  },

  matchError: {
    color: C.rojoError,
    fontSize: 12.5,
  },

  exito: {
    color: C.verdeExito,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },

  error: {
    color: C.rojoError,
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },

  boton: {
    backgroundColor: C.oro,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },

  deshabilitado: { opacity: 0.55 },

  presionado: { opacity: 0.85 },

  textoBoton: {
    color: C.textoSobreOro,
    fontFamily: FontFamilies.button,
    fontSize: 14.5,
  },

  botonSecundario: {
    alignSelf: "center",
    borderWidth: 1.5,
    borderColor: C.blanco,
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 6,
  },

  textoBotonSecundario: {
    color: C.blanco,
    fontSize: 13.5,
    fontFamily: FontFamilies.bodyMedium,
  },
});
