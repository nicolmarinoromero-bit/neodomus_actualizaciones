// ─────────────────────────────────────────────────────────────
// Pantalla legal compartida — adaptación móvil del LegalPage WEB.
// Misma estructura: icono, título dorado, chip "Última actualización",
// secciones numeradas con párrafos y listas (check/punto).
// ─────────────────────────────────────────────────────────────

import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";

export interface SeccionLegal {
  titulo: string;
  parrafos?: string[];
  items?: { texto: string; tipo: "check" | "punto" }[];
}

interface LegalScreenProps {
  icono: string;
  titulo: string;
  actualizacion: string;
  secciones: SeccionLegal[];
}

export default function LegalScreen({
  icono,
  titulo,
  actualizacion,
  secciones,
}: LegalScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={styles.pantalla}>
      {/* Cabecera FIJA con botón Volver: arriba, con safe area, y SIEMPRE
          disponible durante el scroll (es un hermano del scroll, no flota
          sobre el texto). */}
      <View style={[styles.cabeceraFija, { paddingTop: insets.top + 10 }]}>
        <Pressable
          style={({ pressed }) => [
            styles.volver,
            pressed && styles.presionado,
          ]}
          onPress={() => router.back()}
          hitSlop={6}
          accessibilityLabel="Volver a la pantalla anterior"
        >
          <FontAwesome6 name="chevron-left" size={13} color={C.oroSuave} />
          <Text style={styles.volverTexto}>Volver</Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.contenido,
          { paddingBottom: insets.bottom + 40 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.cristal}>
        <View style={styles.lineaSuperior} />

        <View style={styles.cabecera}>
          <View style={styles.iconoWrap}>
            <FontAwesome6 name={(icono as never) || "file-lines"} size={20} color={C.oroSuave} />
          </View>
          <Text style={styles.titulo}>{titulo}</Text>
        </View>

        <View style={styles.chipActualizacion}>
          <Text style={styles.chipTexto}>
            Última actualización: {actualizacion}
          </Text>
        </View>

        {secciones.map((seccion, indice) => (
          <View key={seccion.titulo} style={styles.seccion}>
            <Text style={styles.tituloSeccion}>
              {indice + 1}. {seccion.titulo}
            </Text>

            {(seccion.parrafos ?? []).map((parrafo) => (
              <Text key={parrafo} style={styles.parrafo}>
                {parrafo}
              </Text>
            ))}

            {(seccion.items ?? []).map((item) => (
              <View key={item.texto} style={styles.item}>
                <FontAwesome6
                  name={item.tipo === "check" ? "circle-check" : "circle"}
                  size={12}
                  color={C.oroClaro}
                />
                <Text style={styles.itemTexto}>{item.texto}</Text>
              </View>
            ))}
          </View>
        ))}

        <Pressable
          style={({ pressed }) => [styles.botonInicio, pressed && styles.presionado]}
          onPress={() => router.navigate("/(tabs)")}
        >
          <Text style={styles.textoBoton}>Volver al inicio</Text>
        </Pressable>

        <Text style={styles.copy}>
          © 2026 NEODOMUS. Todos los derechos reservados.
        </Text>
      </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  pantalla: {
    flex: 1,
    backgroundColor: C.negro,
  },

  // Cabecera fija: el botón Volver vive aquí (nunca tapa contenido).
  cabeceraFija: {
    paddingHorizontal: 14,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: C.grisBorde,
    backgroundColor: C.negro,
  },

  contenido: {
    flexGrow: 1,
    paddingHorizontal: 14,
    paddingTop: 14,
  },

  // Píldora Volver (en la cabecera fija superior).
  volver: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 8,
    backgroundColor: "rgba(16,16,16,0.96)",
    borderWidth: 1,
    borderColor: C.bordeOro,
    borderRadius: 999,
    paddingVertical: 9,
    paddingLeft: 13,
    paddingRight: 17,
  },

  volverTexto: {
    color: C.oroSuave,
    fontSize: 13.5,
    fontFamily: FontFamilies.bodyMedium,
  },

  cristal: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.bordeOro,
    backgroundColor: "rgba(10,10,14,0.55)",
    padding: 20,
    overflow: "hidden",
  },

  lineaSuperior: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: C.oroClaro,
  },

  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 6,
  },

  iconoWrap: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.bordeOro,
    alignItems: "center",
    justifyContent: "center",
  },

  titulo: {
    flex: 1,
    color: C.oroSuave,
    fontSize: 21,
    lineHeight: 27,
    fontFamily: FontFamilies.bodyBold,
  },

  chipActualizacion: {
    alignSelf: "flex-start",
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.bordeOro,
    backgroundColor: "rgba(212,165,75,0.08)",
    paddingVertical: 5,
    paddingHorizontal: 12,
    marginTop: 12,
  },

  chipTexto: {
    color: C.oroSuave,
    fontSize: 12,
    fontFamily: FontFamilies.bodyMedium,
  },

  seccion: {
    marginTop: 18,
    gap: 8,
  },

  tituloSeccion: {
    color: C.blanco,
    fontSize: 16,
    fontFamily: FontFamilies.bodyBold,
  },

  parrafo: {
    color: C.grisTexto,
    fontSize: 14,
    lineHeight: 22,
  },

  item: {
    flexDirection: "row",
    gap: 9,
    alignItems: "flex-start",
  },

  itemTexto: {
    color: C.grisTexto,
    fontSize: 13.5,
    lineHeight: 21,
    flex: 1,
  },

  botonInicio: {
    alignSelf: "center",
    backgroundColor: "#d4a54b",
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 24,
    marginTop: 24,
  },

  textoBoton: {
    color: C.textoSobreOro,
    fontFamily: FontFamilies.button,
    fontSize: 13.5,
  },

  copy: {
    color: C.grisTexto,
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },

  presionado: { opacity: 0.85 },
});
