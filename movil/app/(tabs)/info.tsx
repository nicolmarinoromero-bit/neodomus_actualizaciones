// ─────────────────────────────────────────────────────────────
// Info — adaptación móvil de /info de la WEB
// (InfoSectionsContainer): Sobre Nosotros + Porque contratar
// NEODOMUS + Blog. Textos e imágenes literales de la web.
// ─────────────────────────────────────────────────────────────

import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import React from "react";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import PublicScreen from "@/components/public/PublicScreen";

const VENTAJAS = [
  {
    dorada: true,
    fuerte: "Confianza y seriedad:",
    texto:
      " trabajamos con transparencia y compromiso en cada proyecto.",
  },
  {
    dorada: false,
    fuerte: "Innovación real:",
    texto: " ofrecemos soluciones modernas que se adaptan a tus necesidades.",
  },
  {
    dorada: true,
    fuerte: "Calidad garantizada:",
    texto: " resultados eficientes y duraderos que generan valor.",
  },
];

const BLOGS = [
  {
    imagen: require("@/assets/images/blog1.jpeg"),
    texto:
      "La automatización del hogar ya no es cosa del futuro: en Neodomus hacemos posible que vivas en una casa inteligente hoy mismo.",
  },
  {
    imagen: require("@/assets/images/blog2.jpeg"),
    texto:
      "Confort, seguridad y ahorro de energía en un solo lugar. Así es la experiencia que solo Neodomus puede ofrecerte.",
  },
  {
    imagen: require("@/assets/images/blog3.jpeg"),
    texto:
      "¿Sabías que Neodomus es pionera en llevar la domótica a los hogares de Colombia, convirtiéndose en referente de innovación y tecnología?",
  },
];

function TituloSeccion({ children }: { children: string }) {
  return (
    <View style={styles.tituloContainer}>
      <View style={styles.bloqueOro} />
      <Text style={styles.titulo}>{children}</Text>
    </View>
  );
}

export default function InfoScreen() {
  return (
    <PublicScreen>
      <View style={styles.cristal}>
        {/* ── Sobre Nosotros ── */}
        <TituloSeccion>Sobre Nosotros</TituloSeccion>
        <Image
          source={require("@/assets/images/sobre.jpeg")}
          style={styles.imagenSobre}
          resizeMode="cover"
        />
        <Text style={styles.parrafo}>
          En Neodomus ofrecemos soluciones innovadoras y confiables que generan
          valor real a nuestros clientes. Nos enfocamos en la calidad, la
          tecnología y la confianza, brindando servicios eficientes que se
          adaptan a cada necesidad.
        </Text>
        <Text style={styles.parrafo}>
          Nuestra misión es transformar ideas en resultados y nuestra visión,
          consolidarnos como un aliado estratégico que impulse el crecimiento y
          la evolución de quienes confían en nosotros.
        </Text>

        <Pressable
          style={({ pressed }) => [styles.botonProductos, pressed && styles.presionado]}
          onPress={() => router.navigate("/(tabs)/productos")}
        >
          <Text style={styles.textoBoton}>Explorar productos</Text>
        </Pressable>

        {/* ── Porque contratar NEODOMUS ── */}
        <TituloSeccion>Porque contratar NEODOMUS</TituloSeccion>
        <View style={styles.ventajas}>
          {VENTAJAS.map((ventaja) => (
            <View
              key={ventaja.fuerte}
              style={[
                styles.tarjetaVentaja,
                ventaja.dorada ? styles.tarjetaDorada : styles.tarjetaOscura,
              ]}
            >
              <Text
                style={
                  ventaja.dorada ? styles.ventajaTextoOro : styles.ventajaTextoOscura
                }
              >
                <Text style={styles.ventajaFuerte}>{ventaja.fuerte}</Text>
                {ventaja.texto}
              </Text>
            </View>
          ))}
        </View>

        {/* ── Blog ── */}
        <TituloSeccion>Blog</TituloSeccion>
        <View style={styles.blog}>
          {BLOGS.map((post) => (
            <View key={post.texto} style={styles.tarjetaBlog}>
              <Image source={post.imagen} style={styles.imagenBlog} resizeMode="cover" />
              <Text style={styles.blogTexto}>{post.texto}</Text>
            </View>
          ))}
        </View>
      </View>
    </PublicScreen>
  );
}

const styles = StyleSheet.create({
  cristal: {
    marginHorizontal: 14,
    marginTop: 12,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: C.bordeOro,
    backgroundColor: "rgba(10,10,14,0.55)",
    padding: 18,
    gap: 14,
  },

  tituloContainer: {
    position: "relative",
    alignSelf: "flex-start",
    marginTop: 10,
    marginBottom: 4,
  },

  bloqueOro: {
    position: "absolute",
    left: -2,
    bottom: 3,
    width: "72%",
    height: 13,
    backgroundColor: C.oro,
    zIndex: 0,
  },

  titulo: {
    color: C.blanco,
    fontSize: 25,
    fontFamily: FontFamilies.bodyBold,
    zIndex: 1,
  },

  imagenSobre: {
    width: "100%",
    height: 190,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.grisBorde,
  },

  parrafo: {
    color: C.blanco,
    fontSize: 15,
    lineHeight: 24,
    fontFamily: FontFamilies.body,
  },

  botonProductos: {
    alignSelf: "flex-start",
    backgroundColor: C.oro,
    borderRadius: 12,
    paddingVertical: 11,
    paddingHorizontal: 20,
  },

  textoBoton: {
    color: C.textoSobreOro,
    fontFamily: FontFamilies.button,
    fontSize: 13.5,
  },

  presionado: { opacity: 0.85 },

  ventajas: {
    gap: 12,
  },

  tarjetaVentaja: {
    borderRadius: 18,
    padding: 18,
    minHeight: 96,
    justifyContent: "center",
  },

  tarjetaDorada: {
    backgroundColor: C.oro,
  },

  tarjetaOscura: {
    backgroundColor: "rgba(0,0,0,0.85)",
    borderWidth: 1,
    borderColor: C.oro,
  },

  ventajaTextoOro: {
    color: C.blanco,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: FontFamilies.bodyMedium,
  },

  ventajaTextoOscura: {
    color: C.blanco,
    fontSize: 15,
    lineHeight: 23,
    fontFamily: FontFamilies.bodyMedium,
  },

  ventajaFuerte: {
    fontFamily: FontFamilies.bodyBold,
  },

  blog: {
    gap: 14,
  },

  tarjetaBlog: {
    borderRadius: 18,
    overflow: "hidden",
    backgroundColor: C.cardOscura,
    borderWidth: 1,
    borderColor: C.grisBorde,
  },

  imagenBlog: {
    width: "100%",
    height: 150,
  },

  blogTexto: {
    color: C.blanco,
    fontSize: 14,
    lineHeight: 21,
    fontFamily: FontFamilies.body,
    padding: 14,
  },
});
