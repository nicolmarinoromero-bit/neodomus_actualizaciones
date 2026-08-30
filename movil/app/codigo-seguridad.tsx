// ─────────────────────────────────────────────────────────────
// Código de seguridad — adaptación móvil del VerifyCode.tsx.
// 6 boxes, countdown 10:00 (600s), reenvío bloqueado mientras
// countdown > 480 (8 min, igual que la web). Al validar OK el
// CÓDIGO se convierte en el token de nueva-password.
// ─────────────────────────────────────────────────────────────

import React, { useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import AuthScreen from "@/components/auth/AuthScreen";
import OtpInput from "@/components/ui/OtpInput";
import {
  solicitarRecuperacionPassword,
  verificarCodigoRecuperacion,
} from "@/services/auth.services";
import { ApiError } from "@/services/api";

export default function CodigoSeguridadScreen() {
  const { email } = useLocalSearchParams<{ email?: string }>();
  const [codigo, setCodigo] = useState("");
  const [cargando, setCargando] = useState(false);
  const [reenviando, setReenviando] = useState(false);
  const [countdown, setCountdown] = useState(600);
  const [exito, setExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (countdown <= 0) return;
    const temporizador = setTimeout(() => setCountdown((t) => t - 1), 1000);
    return () => clearTimeout(temporizador);
  }, [countdown]);

  const formatoTiempo = () => {
    const mins = Math.floor(countdown / 60);
    const secs = countdown % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const confirmar = async () => {
    if (!email) return;
    if (codigo.length !== 6) {
      setError("Ingresa el código de 6 dígitos");
      return;
    }

    setCargando(true);
    setError(null);
    try {
      await verificarCodigoRecuperacion(email, codigo);
      // El código validado ES el token (igual que la web).
      router.replace({
        pathname: "/nueva-password",
        params: { token: codigo },
      });
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Código inválido o expirado",
      );
      setCodigo("");
    } finally {
      setCargando(false);
    }
  };

  const reenviar = async () => {
    if (!email || countdown > 480) return; // bloqueo silencioso como la web
    setReenviando(true);
    setError(null);
    try {
      await solicitarRecuperacionPassword(email);
      setExito("Se ha enviado un nuevo código a tu correo");
      setCountdown(600);
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "Error al reenviar el código",
      );
    } finally {
      setReenviando(false);
    }
  };

  if (!email) {
    return (
      <AuthScreen>
        <View style={styles.tarjeta}>
          <Text style={styles.titulo}>Error</Text>
          <Text style={styles.error}>
            No se proporcionó un correo electrónico válido.
          </Text>
          <Pressable
            style={({ pressed }) => [
              styles.botonSecundario,
              pressed && styles.presionado,
            ]}
            onPress={() => router.replace("/recuperar-password")}
          >
            <Text style={styles.textoBotonSecundario}>← Volver</Text>
          </Pressable>
        </View>
      </AuthScreen>
    );
  }

  return (
    <AuthScreen>
      <View style={styles.tarjeta}>
        <Text style={styles.titulo}>Código de seguridad</Text>
        <Text style={styles.instruccion}>
          Ingresa el código de 6 dígitos enviado a{" "}
          <Text style={styles.correoUsuario}>{email}</Text>
        </Text>

        <View style={styles.zonaCodigo}>
          <OtpInput valor={codigo} onChange={setCodigo} deshabilitado={cargando} error={!!error} />
        </View>

        <Text style={styles.notaUnUso}>
          Por seguridad, este código solo puede utilizarse una vez.
        </Text>

        <View style={styles.expiracionFila}>
          <FontAwesome6Fallback />
          <Text style={styles.expiracionTexto}>
            El código expirará en{" "}
            <Text style={styles.dorado}>{formatoTiempo()}</Text>
          </Text>
        </View>

        {exito && <Text style={styles.exito}>{exito}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}

        <Pressable
          style={({ pressed }) => [
            styles.boton,
            pressed && styles.presionado,
            cargando && styles.deshabilitado,
          ]}
          onPress={() => void confirmar()}
          disabled={cargando}
        >
          <Text style={styles.textoBoton}>
            {cargando ? "Confirmando..." : "Confirmar código →"}
          </Text>
        </Pressable>

        <View style={styles.separador}>
          <View style={styles.lineaSeparador} />
          <Text style={styles.separadorTexto}>¿No recibiste el código?</Text>
          <View style={styles.lineaSeparador} />
        </View>

        <Pressable
          onPress={() => void reenviar()}
          disabled={reenviando}
          hitSlop={8}
        >
          <Text
            style={[
              styles.enlaceReenvio,
              reenviando || countdown > 480
                ? styles.enlaceReenvioDeshabilitado
                : null,
            ]}
          >
            {reenviando ? "Reenviando..." : "Reenviar código"}
          </Text>
        </Pressable>

        <Pressable
          style={({ pressed }) => [
            styles.volverLogin,
            pressed && styles.presionado,
          ]}
          onPress={() => router.replace("/login")}
        >
          <Text style={styles.textoVolverLogin}>← Volver al inicio de sesión</Text>
        </Pressable>
      </View>
    </AuthScreen>
  );
}

function FontAwesome6Fallback() {
  // Icono pequeño sin depender del import en dos lugares.
  return (
    <Text style={{ color: C.grisTexto, fontSize: 11 }}>⏱</Text>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    backgroundColor: "rgba(10,10,14,0.82)",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: C.bordeOro,
    padding: 18,
    gap: 12,
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
    lineHeight: 20,
    textAlign: "center",
  },

  correoUsuario: {
    color: C.oroSuave,
    fontFamily: FontFamilies.bodyBold,
  },

  zonaCodigo: {
    alignItems: "center",
    paddingVertical: 8,
  },

  notaUnUso: {
    color: C.grisTexto,
    fontSize: 12,
    textAlign: "center",
    fontStyle: "italic",
  },

  expiracionFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
  },

  expiracionTexto: {
    color: C.grisTexto,
    fontSize: 12.5,
  },

  dorado: {
    color: C.oroSuave,
    fontFamily: FontFamilies.bodyBold,
  },

  exito: {
    color: C.verdeExito,
    fontSize: 13,
    textAlign: "center",
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
  },

  deshabilitado: { opacity: 0.55 },

  presionado: { opacity: 0.85 },

  textoBoton: {
    color: C.textoSobreOro,
    fontFamily: FontFamilies.button,
    fontSize: 14.5,
  },

  separador: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 4,
  },

  lineaSeparador: {
    flex: 1,
    height: 1,
    backgroundColor: C.grisBorde,
  },

  separadorTexto: {
    color: C.grisTexto,
    fontSize: 12.5,
  },

  enlaceReenvio: {
    color: C.oroSuave,
    fontSize: 14,
    fontFamily: FontFamilies.bodyBold,
    textAlign: "center",
  },

  enlaceReenvioDeshabilitado: {
    color: C.grisTexto,
  },

  volverLogin: {
    alignItems: "center",
    paddingVertical: 4,
  },

  textoVolverLogin: {
    color: C.grisTexto,
    fontSize: 13,
  },

  botonSecundario: {
    alignSelf: "center",
    borderWidth: 1.5,
    borderColor: "#ffffff",
    borderRadius: 4,
    paddingVertical: 10,
    paddingHorizontal: 18,
    marginTop: 6,
  },

  textoBotonSecundario: {
    color: "#ffffff",
    fontSize: 13.5,
    fontFamily: "Inter_500Medium",
  },
});
