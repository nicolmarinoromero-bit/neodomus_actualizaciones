import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import EvidenciaImagen from "@/components/EvidenciaImagen";
import { FontFamilies } from "@/constants/theme";
import type { EvidenciaNovedad } from "@/services/novedades.service";
import { formatearFechaNovedad } from "@/utils/novedades";

export function NovedadEvidencias({ evidencias }: { evidencias: EvidenciaNovedad[] }) {
  if (evidencias.length === 0) return null;

  return (
    <View style={styles.section}>
      <Text style={styles.title}>Evidencia</Text>
      <View style={styles.grid}>
        {evidencias.map((evidencia) => (
          <Pressable key={evidencia.id_evidencia_n} style={styles.thumbnail}>
            <EvidenciaImagen url={evidencia.url} estilo={styles.image} />
            {evidencia.fecha_subida && (
              <Text style={styles.date}>{formatearFechaNovedad(evidencia.fecha_subida)}</Text>
            )}
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginBottom: 18 },
  title: { fontFamily: FontFamilies.bodyBold, fontSize: 13, color: "#d4a54b", marginBottom: 8 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  thumbnail: { width: 90, borderRadius: 10, overflow: "hidden", backgroundColor: "#222" },
  image: { width: "100%", height: 90 },
  date: { fontFamily: FontFamilies.body, fontSize: 9, color: "#8a8a8a", textAlign: "center", padding: 4 },
});
