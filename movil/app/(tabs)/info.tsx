// ─────────────────────────────────────────────────────────────
// Info — adaptación móvil de /info de la WEB
// (InfoSectionsContainer): Sobre Nosotros + Porque contratar
// NEODOMUS + Blog. Textos e imágenes literales de la web.
// ─────────────────────────────────────────────────────────────

import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import React, { useRef } from "react";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import PublicScreen from "@/components/public/PublicScreen";
import { useScrollTopAlEntrar } from "@/hooks/useScrollTopAlEntrar";

const VENTAJAS = [
  {
    dorada: true,
    fuerte: "Confianza y seriedad:",
    texto: " trabajamos con transparencia y compromiso en cada proyecto.",
    icono: "shield-halved" as const,
  },
  {
    dorada: false,
    fuerte: "Innovación real:",
    texto: " ofrecemos soluciones modernas que se adaptan a tus necesidades.",
    icono: "lightbulb" as const,
  },
  {
    dorada: true,
    fuerte: "Calidad garantizada:",
    texto: " resultados eficientes y duraderos que generan valor.",
    icono: "award" as const,
  },
];

const BLOGS = [
  {
    imagen: require("@/assets/images/blog1.jpeg"),
    categoria: "Domótica",
    titulo: "Automatización al alcance",
    texto:
      "La automatización del hogar ya no es cosa del futuro: en Neodomus hacemos posible que vivas en una casa inteligente hoy mismo.",
  },
  {
    imagen: require("@/assets/images/blog2.jpeg"),
    categoria: "Confort & Ahorro",
    titulo: "Confort, seguridad y ahorro",
    texto:
      "Confort, seguridad y ahorro de energía en un solo lugar. Así es la experiencia que solo Neodomus puede ofrecerte.",
  },
  {
    imagen: require("@/assets/images/blog3.jpeg"),
    categoria: "Innovación · Colombia",
    titulo: "Pioneros en Colombia",
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
  const scrollRef = useRef(null);
  useScrollTopAlEntrar(scrollRef as any);
  return (
    <PublicScreen scrollRef={scrollRef as any}>
      <View style={styles.cristal}>
        {/* ── Sobre Nosotros — referencia WEB mejorada ── */}
        <TituloSeccion>Sobre Nosotros</TituloSeccion>
        <View style={styles.sobreBadgeWrap}>
          <Image
            source={require("@/assets/images/sobre.jpeg")}
            style={styles.imagenSobre}
            resizeMode="cover"
          />
          <View style={styles.sobreBadge}>
            <FontAwesome6 name="house-chimney-window" size={12} color={C.oro} />
            <Text style={styles.sobreBadgeTexto}>Hogar inteligente</Text>
          </View>
        </View>
        <View style={styles.kickerWrap}>
          <Text style={styles.kicker}>Más que tecnología, una evolución</Text>
        </View>
        <Text style={styles.parrafoDestacado}>
          En <Text style={styles.negrita}>Neodomus</Text> ofrecemos soluciones innovadoras y confiables que generan valor real a nuestros clientes.
        </Text>
        <Text style={styles.parrafo}>
          Nos enfocamos en la calidad, la tecnología y la confianza, brindando servicios eficientes que se adaptan a cada necesidad. Transformamos ideas en resultados.
        </Text>

        <View style={styles.featuresGrid}>
          <View style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <FontAwesome6 name="shield-halved" size={14} color="#111" />
            </View>
            <Text style={styles.featureTitulo}>Nuestra misión</Text>
            <Text style={styles.featureTexto}>Transformar ideas en resultados tangibles con tecnología confiable.</Text>
          </View>
          <View style={styles.featureCard}>
            <View style={styles.featureIcon}>
              <FontAwesome6 name="lightbulb" size={14} color="#111" />
            </View>
            <Text style={styles.featureTitulo}>Nuestra visión</Text>
            <Text style={styles.featureTexto}>Ser el aliado estratégico que impulse el crecimiento inteligente.</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statValor} numberOfLines={1} adjustsFontSizeToFit>100%</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Compromiso</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValor} numberOfLines={1} adjustsFontSizeToFit>24/7</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Soporte</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValor} numberOfLines={1} adjustsFontSizeToFit>+500</Text>
            <Text style={styles.statLabel} numberOfLines={1} adjustsFontSizeToFit>Clientes</Text>
          </View>
        </View>

        {/* ── Porque contratar NEODOMUS — con íconos ── */}
        <TituloSeccion>Porque contratar NEODOMUS</TituloSeccion>
        <Text style={styles.subtituloSeccion}>Tres razones para confiar tu hogar a la innovación.</Text>
        <View style={styles.ventajas}>
          {VENTAJAS.map((ventaja) => (
            <View
              key={ventaja.fuerte}
              style={[
                styles.tarjetaVentaja,
                ventaja.dorada ? styles.tarjetaDorada : styles.tarjetaOscura,
              ]}
            >
              <View style={[styles.ventajaIcono, ventaja.dorada ? styles.iconoOro : styles.iconoOscuro]}>
                <FontAwesome6 name={ventaja.icono} size={16} color={ventaja.dorada ? "#fff" : C.oro} />
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={styles.ventajaFuerte}>{ventaja.fuerte}</Text>
                <Text style={ventaja.dorada ? styles.ventajaTextoOro : styles.ventajaTextoOscura}>
                  {ventaja.texto.trim()}
                </Text>
              </View>
            </View>
          ))}
        </View>

        {/* ── Blog — 3 tarjetas con jerarquía ── */}
        <TituloSeccion>Blog</TituloSeccion>
        <Text style={styles.subtituloSeccion}>Inspiración, tecnología y hogar inteligente.</Text>
        <View style={styles.blog}>
          {BLOGS.map((post) => (
            <View key={post.texto} style={styles.tarjetaBlog}>
              <Image source={post.imagen} style={styles.imagenBlog} resizeMode="cover" />
              <View style={styles.blogContenido}>
                <View style={styles.blogCategoria}>
                  <Text style={styles.blogCategoriaTexto}>{post.categoria}</Text>
                </View>
                <Text style={styles.blogTitulo}>{post.titulo}</Text>
                <Text style={styles.blogTexto}>{post.texto}</Text>
              </View>
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
    height: 210,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.grisBorde,
  },

  sobreBadgeWrap: {
    position: "relative",
    width: "100%",
  },

  sobreBadge: {
    position: "absolute",
    bottom: 10,
    left: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "rgba(0,0,0,0.72)",
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.3)",
    borderRadius: 999,
    paddingVertical: 5,
    paddingHorizontal: 10,
  },

  sobreBadgeTexto: {
    color: C.oro,
    fontSize: 11,
    fontFamily: FontFamilies.bodyBold,
  },

  kickerWrap: {
    alignSelf: "flex-start",
    marginTop: 2,
  },

  kicker: {
    color: C.oro,
    fontSize: 11,
    fontFamily: FontFamilies.bodyBold,
    letterSpacing: 1,
    textTransform: "uppercase",
    backgroundColor: "rgba(212,165,75,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.22)",
    borderRadius: 999,
    paddingVertical: 4,
    paddingHorizontal: 10,
    overflow: "hidden",
  },

  parrafoDestacado: {
    color: "#f0e6d2",
    fontSize: 15,
    lineHeight: 24,
    fontFamily: FontFamilies.bodyMedium,
  },

  negrita: {
    fontFamily: FontFamilies.bodyBold,
    color: C.blanco,
  },

  featuresGrid: {
    flexDirection: "row",
    gap: 10,
  },

  featureCard: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.04)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.07)",
    borderRadius: 14,
    padding: 14,
    gap: 6,
    alignItems: "center",
    minHeight: 110,
  },

  featureIcon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: C.oro,
    alignItems: "center",
    justifyContent: "center",
  },

  featureTitulo: {
    color: C.blanco,
    fontSize: 12,
    fontFamily: FontFamilies.bodyBold,
    textAlign: "center",
    lineHeight: 16,
  },

  featureTexto: {
    color: "#b8b0a2",
    fontSize: 11,
    lineHeight: 16,
    fontFamily: FontFamilies.body,
    textAlign: "center",
  },

  statsRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },

  statCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(212,165,75,0.08)",
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.18)",
    borderRadius: 14,
    paddingVertical: 13,
    paddingHorizontal: 4,
    gap: 3,
    minHeight: 74,
    minWidth: 0,
  },

  statValor: {
    color: C.blanco,
    fontSize: 15,
    fontFamily: FontFamilies.bodyBold,
    lineHeight: 16,
    textAlign: "center",
    includeFontPadding: false,
  },

  statLabel: {
    color: C.oro,
    fontSize: 7.8,
    fontFamily: FontFamilies.button,
    letterSpacing: 0.2,
    textTransform: "uppercase",
    textAlign: "center",
    lineHeight: 10,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "100%",
    includeFontPadding: false,
  },

  subtituloSeccion: {
    color: "#b8b0a2",
    fontSize: 13,
    lineHeight: 19,
    fontFamily: FontFamilies.body,
    marginBottom: 4,
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
    padding: 16,
    minHeight: 96,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  ventajaIcono: {
    width: 38,
    height: 38,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },

  iconoOro: {
    backgroundColor: "rgba(0,0,0,0.18)",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.12)",
  },

  iconoOscuro: {
    backgroundColor: "rgba(212,165,75,0.14)",
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.22)",
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
    height: 160,
  },

  blogContenido: {
    padding: 14,
    gap: 6,
  },

  blogCategoria: {
    alignSelf: "flex-start",
    backgroundColor: "rgba(212,165,75,0.12)",
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.22)",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },

  blogCategoriaTexto: {
    color: C.oro,
    fontSize: 10,
    fontFamily: FontFamilies.bodyBold,
    letterSpacing: 0.5,
    textTransform: "uppercase",
  },

  blogTitulo: {
    color: C.blanco,
    fontSize: 15,
    lineHeight: 21,
    fontFamily: FontFamilies.bodyBold,
  },

  blogTexto: {
    color: "#d6d0be",
    fontSize: 13.5,
    lineHeight: 20,
    fontFamily: FontFamilies.body,
  },
});
