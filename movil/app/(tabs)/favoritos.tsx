// Mis favoritos — productos marcados con ♥ (misma lógica local que la
// web: favoritos por identidad) filtrando el catálogo REAL del backend.
// Usa AppScreen: mantiene el NAVBAR global y el botón de regreso,
// igual que todas las secciones del usuario autenticado.
import React, { useEffect, useMemo, useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import AppScreen from "@/components/app/AppScreen";
import ProductCard from "@/components/public/ProductCard";
import { FontFamilies } from "@/constants/theme";
import { useFavoritos } from "@/contexts/FavoritosContext";
import {
  listarProductos,
  type Producto,
} from "@/services/productos.service";

export default function FavoritosScreen() {
  const { favoritos } = useFavoritos();
  const [productos, setProductos] = useState<Producto[]>([]);
  const [cargando, setCargando] = useState(true);

  useEffect(() => {
    listarProductos()
      .then((r) => setProductos(r.data ?? []))
      .catch(() => {})
      .finally(() => setCargando(false));
  }, []);

  // El Set de favoritos cambia al quitar → recalcular.
  const visibles = useMemo(
    () =>
      productos
        .filter((p) => favoritos.has(p.id_producto))
        .slice(0, 12),
    [productos, favoritos],
  );

  return (
    <AppScreen titulo="Mis favoritos">
      <Text style={S.subtitulo}>
        Productos que has guardado para comprarlos más tarde.
      </Text>

      {cargando && <Text style={S.gris}>Cargando...</Text>}

      {!cargando && visibles.length === 0 ? (
        <>
          <Text style={S.vacioTitulo}>No tienes productos en favoritos aún.</Text>
          <Text style={S.vacioTexto}>
            Navega por el catálogo y marca productos con el corazón.
          </Text>
        </>
      ) : (
        <View style={S.grid}>
          {visibles.map((producto) => (
            <View key={producto.id_producto} style={S.celda}>
              <ProductCard producto={producto} />
            </View>
          ))}
        </View>
      )}
    </AppScreen>
  );
}

const S = StyleSheet.create({
  subtitulo: { color: "#bdbdbd", fontSize: 13.5 },
  gris: { color: "#bdbdbd", fontSize: 13 },
  vacioTitulo: { color: "#ffffff", fontSize: 16.5, fontFamily: FontFamilies.bodyBold },
  vacioTexto: { color: "#bdbdbd", fontSize: 13 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12, marginTop: 6 },
  celda: { flexBasis: "47%", flexGrow: 1 },
});
