// ─────────────────────────────────────────────────────────────
// FOOTER CONTEXTUAL de Neodomus (estructura inspirada en footers
// móviles tipo Mercado Libre: columnas agrupadas y claras, pero
// 100% identidad Neodomus — colores, textos y links propios).
//
// SOLO información pública de Neodomus:
//   NEODOMUS → Contacto · Ayuda · Mis favoritos*
//   INFORMACIÓN LEGAL → Términos · Privacidad · Cookies · Centro
//                       de privacidad
//   (* Mis favoritos respeta autenticación: al visitante le pide
//      iniciar sesión antes de continuar.)
// ─────────────────────────────────────────────────────────────

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";

export default function AppFooter() {
  const { autenticado } = useAuth();

  const irAFavoritos = () => {
    if (!autenticado) {
      // Contenido privado → solicitar login (igual que la web con el gate).
      router.push("/login");
      return;
    }
    router.navigate("/(tabs)/productos");
  };

  return (
    <View style={styles.footer}>
      <View style={styles.columnas}>
        {/* Marca */}
        <View style={styles.columna}>
          <Text style={styles.tituloColumna}>NEODOMUS</Text>
          <Pressable
            style={({ pressed }) => [styles.link, pressed && styles.presionado]}
            onPress={() => router.push("/contacto" as Href)}
          >
            <FontAwesome6 name="headset" size={12} color={C.grisTexto} />
            <Text style={styles.linkTexto}>Contacto</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.link, pressed && styles.presionado]}
            onPress={() => router.push("/ayuda")}
          >
            <FontAwesome6 name="circle-question" size={12} color={C.grisTexto} />
            <Text style={styles.linkTexto}>Ayuda</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.link, pressed && styles.presionado]}
            onPress={irAFavoritos}
          >
            <FontAwesome6 name="heart" size={12} color={C.grisTexto} />
            <Text style={styles.linkTexto}>Mis favoritos</Text>
          </Pressable>
        </View>

        {/* Legal */}
        <View style={styles.columna}>
          <Text style={styles.tituloColumna}>Información legal</Text>
          <Pressable
            style={({ pressed }) => [styles.link, pressed && styles.presionado]}
            onPress={() => router.push("/terminos" as Href)}
          >
            <Text style={styles.linkTexto}>Términos y condiciones</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.link, pressed && styles.presionado]}
            onPress={() => router.push("/privacidad" as Href)}
          >
            <Text style={styles.linkTexto}>Política de privacidad</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.link, pressed && styles.presionado]}
            onPress={() => router.push("/cookies" as Href)}
          >
            <Text style={styles.linkTexto}>Política de cookies</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [styles.link, pressed && styles.presionado]}
            onPress={() => router.push("/centro-privacidad")}
          >
            <Text style={[styles.linkTexto, styles.linkDestacado]}>
              Centro de privacidad
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.pie}>
        <Text style={styles.copy}>
          © 2026 NEODOMUS. Todos los derechos reservados.
        </Text>
        <Text style={styles.copyMini}>Más que tecnología, una evolución.</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  footer: {
    backgroundColor: "#000000",
    borderTopWidth: 1,
    borderTopColor: "#c9a227",
    paddingHorizontal: 18,
    paddingTop: 20,
    paddingBottom: 14,
  },

  columnas: {
    flexDirection: "row",
    gap: 18,
  },

  columna: {
    flex: 1,
    gap: 10,
  },

  tituloColumna: {
    color: C.oroFooter,
    fontSize: 12,
    fontFamily: FontFamilies.bodyBold,
    letterSpacing: 1,
    marginBottom: 2,
  },

  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  presionado: { opacity: 0.7 },

  linkTexto: {
    color: C.blanco,
    fontSize: 13,
    lineHeight: 18,
    flexShrink: 1,
  },

  linkDestacado: {
    color: C.oroSuave,
    fontFamily: FontFamilies.bodyMedium,
  },

  pie: {
    borderTopWidth: 1,
    borderTopColor: C.grisBorde,
    marginTop: 18,
    paddingTop: 12,
    alignItems: "center",
    gap: 3,
  },

  copy: {
    color: C.grisTexto,
    fontSize: 11.5,
    textAlign: "center",
  },

  copyMini: {
    color: "#6f6f6f",
    fontSize: 10.5,
    textAlign: "center",
  },
});
