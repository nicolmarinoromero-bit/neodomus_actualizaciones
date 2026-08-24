// ─────────────────────────────────────────────────────────────
// GateCliente — protección REAL de rutas exclusivas del cliente:
// no basta con ocultar el tab; si un visitante accede directamente a la
// ruta (deep-link), se le muestra el flujo de acceso en lugar de la
// pantalla. Usa la fuente de autenticación EXISTENTE (AuthContext):
// - cargando → null (evita pestañas/parpadeos mientras se restaura la
//   sesión guardada en AsyncStorage).
// - visitante / no-cliente → pantalla "Inicia sesión para continuar"
//   con Iniciar sesión / Crear cuenta.
// - cliente autenticado → children.
// ─────────────────────────────────────────────────────────────

import React, { type ReactNode } from "react";
import { Pressable, StyleSheet, Text } from "react-native";
import { useRouter } from "expo-router";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";

export default function GateCliente({
  titulo,
  children,
}: {
  titulo: string;
  children: ReactNode;
}) {
  const { cargando, autenticado, userType } = useAuth();
  const router = useRouter();

  // Restaurando sesión: no renderizar nada para evitar tabs/pantallas
  // incorrectas momentáneas (el splash raíz cubre este periodo).
  if (cargando) return null;

  // Visitante o rol distinto a cliente → flujo de acceso.
  if (!autenticado || userType !== "client") {
    return (
      <AppScreen titulo={titulo}>
        <Text style={S.titulo}>Inicia sesión para continuar</Text>
        <Text style={S.texto}>
          {titulo} es una sección para usuarios con cuenta Neodomus
          verificada. Inicia sesión o crea tu cuenta para acceder.
        </Text>
        <Pressable
          style={({ pressed }) => [S.botonOro, pressed && S.presionado]}
          onPress={() => router.push("/login")}
        >
          <Text style={S.textoBotonOro}>Iniciar sesión</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [S.botonOutline, pressed && S.presionado]}
          onPress={() => router.push("/registro")}
        >
          <Text style={S.textoOutline}>Crear cuenta</Text>
        </Pressable>
      </AppScreen>
    );
  }

  return <>{children}</>;
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
  textoBotonOro: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 14 },
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
  textoOutline: { color: "#f0c96f", fontFamily: FontFamilies.button, fontSize: 13.5 },
  presionado: { opacity: 0.85 },
});
