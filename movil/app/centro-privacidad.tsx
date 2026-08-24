// ─────────────────────────────────────────────────────────────
// Centro de privacidad — pantalla pública de Neodomus.
//
// Hub que agrupa la información legal REAL existente en la WEB
// (Términos, Política de Privacidad, Política de Cookies) y el
// acceso a Configurar cookies (modal del CookieConsentContext).
// Los textos legales NO se inventan: viven en las pantallas que
// replican literalmente los documentos de la web.
// ─────────────────────────────────────────────────────────────

import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import PublicScreen from "@/components/public/PublicScreen";
import { useCookieConsent } from "@/contexts/CookieConsentContext";

const SECCIONES = [
  {
    icono: "file-contract",
    titulo: "Términos y condiciones",
    descripcion:
      "Regulan el acceso y uso de los servicios ofrecidos por Neodomus.",
    destino: "/terminos",
  },
  {
    icono: "shield-halved",
    titulo: "Política de privacidad",
    descripcion:
      "Qué información recopilamos, cómo la utilizamos y tus derechos sobre ella.",
    destino: "/privacidad",
  },
  {
    icono: "cookie-bite",
    titulo: "Política de cookies",
    descripcion:
      "Qué son las cookies, cómo las utilizamos y cómo gestionarlas.",
    destino: "/cookies",
  },
] as const;

export default function CentroPrivacidadScreen() {
  const { estado, mostrarConfiguracion } = useCookieConsent();

  return (
    <PublicScreen>
      <View style={styles.contenedor}>
        <Text style={styles.titulo}>Centro de privacidad</Text>
        <Text style={styles.subtitulo}>
          En Neodomus nos comprometemos a proteger tu privacidad. Desde aquí
          puedes consultar nuestras políticas y configurar tus preferencias de
          cookies.
        </Text>

        <View style={styles.tarjetas}>
          {SECCIONES.map((seccion) => (
            <Pressable
              key={seccion.titulo}
              style={({ pressed }) => [
                styles.tarjeta,
                pressed && styles.presionado,
              ]}
              onPress={() => router.push(seccion.destino as never)}
            >
              <View style={styles.iconoWrap}>
                <FontAwesome6
                  name={seccion.icono}
                  size={16}
                  color={C.oroSuave}
                />
              </View>
              <View style={styles.tarjetaTexto}>
                <Text style={styles.tarjetaTitulo}>{seccion.titulo}</Text>
                <Text style={styles.tarjetaDescripcion}>
                  {seccion.descripcion}
                </Text>
              </View>
              <FontAwesome6
                name="chevron-right"
                size={13}
                color={C.grisTexto}
              />
            </Pressable>
          ))}
        </View>

        {/* Configuración de cookies */}
        <Pressable
          style={({ pressed }) => [
            styles.tarjetaConfigurar,
            pressed && styles.presionado,
          ]}
          onPress={mostrarConfiguracion}
        >
          <View style={[styles.iconoWrap, styles.iconoOro]}>
            <FontAwesome6 name="sliders" size={16} color={C.textoSobreOro} />
          </View>
          <View style={styles.tarjetaTexto}>
            <Text style={[styles.tarjetaTitulo, { color: C.oroSuave }]}>
              Configurar cookies
            </Text>
            <Text style={styles.tarjetaDescripcion}>
              {estado.decidido
                ? `Preferencias guardadas el ${new Date(estado.preferencias.fecha).toLocaleDateString("es-CO")}. Puedes modificarlas cuando quieras.`
                : "Aún no has configurado tus preferencias. Elige qué cookies puede utilizar Neodomus."}
            </Text>
          </View>
          <FontAwesome6 name="chevron-right" size={13} color={C.grisTexto} />
        </Pressable>

        <Text style={styles.contacto}>
          ¿Dudas sobre tus datos? escríbenos a soporte@neodomus.com
        </Text>
      </View>
    </PublicScreen>
  );
}

const styles = StyleSheet.create({
  contenedor: {
    flex: 1,
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 14,
  },

  titulo: {
    color: "#ffffff",
    fontSize: 25,
    fontFamily: FontFamilies.bodyBold,
  },

  subtitulo: {
    color: "#bdbdbd",
    fontSize: 14,
    lineHeight: 21,
    marginTop: -6,
  },

  tarjetas: {
    gap: 10,
  },

  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 14,
  },

  presionado: { opacity: 0.8 },

  iconoWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.28)",
    alignItems: "center",
    justifyContent: "center",
  },

  iconoOro: {
    backgroundColor: "#caa24d",
    borderColor: "#caa24d",
  },

  tarjetaTexto: {
    flex: 1,
    gap: 2,
  },

  tarjetaTitulo: {
    color: "#ffffff",
    fontSize: 15,
    fontFamily: FontFamilies.bodyBold,
  },

  tarjetaDescripcion: {
    color: "#bdbdbd",
    fontSize: 12.5,
    lineHeight: 18,
  },

  tarjetaConfigurar: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "rgba(212,165,75,0.08)",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.4)",
    padding: 14,
  },

  contacto: {
    color: "#bdbdbd",
    fontSize: 12.5,
    textAlign: "center",
    marginTop: 4,
  },
});
