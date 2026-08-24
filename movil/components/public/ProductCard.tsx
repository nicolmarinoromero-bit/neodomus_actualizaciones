// ─────────────────────────────────────────────────────────────
// Tarjeta de producto — adaptación móvil de las tarjetas del
// catálogo WEB (mismos datos, precios y textos).
// ─────────────────────────────────────────────────────────────

import React, { useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router, type Href } from "expo-router";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { NeodomusColors as C, FontFamilies } from "@/constants/theme";
import {
  formatearPrecio,
  precioFinalDe,
  tieneDescuento,
  urlImagenProducto,
  type Producto,
} from "@/services/productos.service";
import { useFavoritos } from "@/contexts/FavoritosContext";
import { useCart } from "@/contexts/CartContext";

interface ProductCardProps {
  producto: Producto;
}

export default function ProductCard({ producto }: ProductCardProps) {
  const { esFavorito, toggleFavorito } = useFavoritos();
  const { addItem } = useCart();
  const [falloImagen, setFalloImagen] = useState(false);
  const [cantidad, setCantidad] = useState(1);

  const favorito = esFavorito(producto.id_producto);
  const conDescuento = tieneDescuento(producto);
  const precioFinal = precioFinalDe(producto);
  const imagen = falloImagen ? null : urlImagenProducto(producto);

  // Depuración temporal (solo desarrollo): URL final que intenta cargar RN.
  if (__DEV__) {
    console.log(`[imagen] producto ${producto.id_producto} →`, imagen);
  }

  const abrirDetalle = () =>
    router.push(`/(tabs)/producto/${producto.id_producto}` as Href);

  return (
    <View style={styles.tarjeta}>
      <View style={styles.zonaImagen}>
        <Pressable onPress={abrirDetalle} style={styles.imagenContenedor}>
          {imagen ? (
            <Image
              source={{ uri: imagen }}
              style={styles.imagen}
              resizeMode="cover"
              onError={() => setFalloImagen(true)}
            />
          ) : (
            <View style={[styles.imagen, styles.imagenPlaceholder]}>
              <FontAwesome6 name="box-open" size={30} color={C.oroClaro} />
            </View>
          )}
        </Pressable>

        {conDescuento && (
          <View style={styles.badgeDescuento}>
            <Text style={styles.badgeTexto}>-{producto.descuento_activo}%</Text>
          </View>
        )}

        {!!producto.es_nuevo && (
          <View style={styles.badgeNuevo}>
            <Text style={styles.badgeNuevoTexto}>Nuevo</Text>
          </View>
        )}

        <Pressable
          style={styles.corazon}
          onPress={() => toggleFavorito(producto.id_producto)}
          accessibilityLabel={
            favorito ? "Quitar de favoritos" : "Agregar a favoritos"
          }
          hitSlop={8}
        >
          <FontAwesome6
            name="heart"
            size={17}
            solid={favorito}
            color={favorito ? "#e5484d" : C.blanco}
          />
        </Pressable>
      </View>

      <View style={styles.contenido}>
        {!!producto.nombre_categoria && (
          <View style={styles.chipsFila}>
            <View style={styles.chipCategoria}>
              <Text style={styles.categoria} numberOfLines={1}>
                {producto.nombre_categoria}
              </Text>
            </View>
            {(producto.tecnicos_requeridos ?? 0) > 0 && (
              <View style={styles.chipTecnico}>
                <FontAwesome6
                  name="screwdriver-wrench"
                  size={9}
                  color="#141414"
                />
                <Text style={styles.chipTecnicoTexto}>
                  {(producto.tecnicos_requeridos ?? 1) > 1
                    ? `Requiere ${producto.tecnicos_requeridos} técnicos`
                    : "Requiere un técnico"}
                </Text>
              </View>
            )}
          </View>
        )}

        <Pressable onPress={abrirDetalle}>
          <Text style={styles.nombre} numberOfLines={2}>
            {producto.nombre_producto}
          </Text>
        </Pressable>

        <View style={styles.precioFila}>
          {conDescuento && (
            <Text style={styles.precioOriginal}>
              {formatearPrecio(producto.precio_venta_producto)}
            </Text>
          )}
          <Text style={styles.precioMonto}>{formatearPrecio(precioFinal)}</Text>
          <Text style={styles.precioSufijo}>COP</Text>
        </View>

        {producto.stock_estado === "agotado" && (
          <Text style={styles.stockAgotado}>Sin stock</Text>
        )}

        {/* Selector de cantidad [-] n [+] (solo productos por unidad;
            los de metros se configuran en el detalle). */}
        {!producto.venta_por_metros && (
          <View style={styles.cantidadFila}>
            <Pressable
              style={({ pressed }) => [
                styles.cantidadBoton,
                pressed && styles.presionado,
              ]}
              onPress={() => setCantidad((actual) => Math.max(1, actual - 1))}
              accessibilityLabel="Reducir cantidad"
              hitSlop={6}
            >
              <FontAwesome6 name="minus" size={11} color={C.blanco} />
            </Pressable>
            <Text style={styles.cantidadValor}>{cantidad}</Text>
            <Pressable
              style={({ pressed }) => [
                styles.cantidadBoton,
                pressed && styles.presionado,
              ]}
              onPress={() => setCantidad((actual) => actual + 1)}
              accessibilityLabel="Aumentar cantidad"
              hitSlop={6}
            >
              <FontAwesome6 name="plus" size={11} color={C.blanco} />
            </Pressable>
          </View>
        )}

        {/* Botón de agregar a ancho completo dentro de la card.
            TEXTO a la izquierda · ICONO a la derecha (space-between).
            El favorito vive SOLO sobre la imagen (arriba a la derecha). */}
        <Pressable
          style={({ pressed }) => [
            styles.agregar,
            pressed && styles.presionado,
          ]}
          onPress={() => addItem(producto, { cantidad })}
        >
          <Text style={styles.agregarTexto}>Agregar al carrito</Text>
          <View style={styles.agregarIconoCaja}>
            <FontAwesome6
              name="cart-shopping"
              size={14}
              color={C.textoSobreOro}
            />
          </View>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  tarjeta: {
    flex: 1,
    backgroundColor: C.cardOscura,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.grisBorde,
    overflow: "hidden",
  },

  zonaImagen: {
    width: "100%",
    aspectRatio: 4 / 3,
    backgroundColor: C.cardOscuraAlt,
  },

  imagenContenedor: { flex: 1 },

  imagen: { width: "100%", height: "100%" },

  imagenPlaceholder: {
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: C.inputFondo,
  },

  badgeDescuento: {
    position: "absolute",
    left: 8,
    bottom: 8,
    backgroundColor: "#e5484d",
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 8,
  },

  badgeTexto: {
    color: C.blanco,
    fontSize: 11,
    fontWeight: "700",
  },

  badgeNuevo: {
    position: "absolute",
    left: 8,
    top: 8,
    backgroundColor: C.oroClaro,
    borderRadius: 999,
    paddingVertical: 3,
    paddingHorizontal: 9,
  },

  badgeNuevoTexto: {
    color: C.textoSobreOro,
    fontSize: 11,
    fontWeight: "700",
  },

  corazon: {
    position: "absolute",
    right: 8,
    top: 8,
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: "rgba(0,0,0,0.55)",
    borderWidth: 1,
    borderColor: C.grisBorde,
    alignItems: "center",
    justifyContent: "center",
  },

  contenido: {
    padding: 12,
    paddingTop: 10,
    gap: 7,
    flex: 1,
  },

  categoria: {
    color: C.oroSuave,
    fontSize: 11,
    fontFamily: FontFamilies.bodyMedium,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },

  chipsFila: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    width: "100%",
  },

  chipCategoria: {
    borderRadius: 999,
    borderWidth: 1,
    borderColor: C.bordeOro,
    backgroundColor: "rgba(212,165,75,0.08)",
    paddingVertical: 4,
    paddingHorizontal: 9,
    maxWidth: "100%",
    flexShrink: 1,
    minWidth: 0,
  },

  chipTecnico: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 999,
    backgroundColor: C.oroClaro,
    paddingVertical: 4,
    paddingHorizontal: 9,
    maxWidth: "100%",
    flexShrink: 1,
    minWidth: 0,
  },

  chipTecnicoTexto: {
    color: C.textoSobreOro,
    fontSize: 10,
    fontFamily: FontFamilies.button,
    flexShrink: 1,
  },

  nombre: {
    color: C.blanco,
    fontSize: 14,
    lineHeight: 19,
    fontFamily: FontFamilies.bodyBold,
    flexShrink: 1,
  },

  precioFila: {
    flexDirection: "row",
    alignItems: "baseline",
    flexWrap: "wrap",
    gap: 6,
  },

  precioOriginal: {
    color: C.grisTexto,
    fontSize: 12.5,
    textDecorationLine: "line-through",
  },

  precioMonto: {
    color: C.oroSuave,
    fontSize: 16.5,
    fontFamily: FontFamilies.bodyBold,
  },

  precioSufijo: {
    color: C.grisTexto,
    fontSize: 11.5,
  },

  stockAgotado: {
    color: C.rojoError,
    fontSize: 12,
    fontFamily: FontFamilies.bodyMedium,
  },

  acciones: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 2,
  },

  cantidadFila: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    marginVertical: 2,
  },

  cantidadBoton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: C.oroClaro,
    backgroundColor: "rgba(212,165,75,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  cantidadValor: {
    color: C.blanco,
    fontSize: 15.5,
    fontFamily: FontFamilies.bodyBold,
    minWidth: 26,
    textAlign: "center",
  },

  agregar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: C.oro,
    borderRadius: 10,
    minHeight: 46,
    paddingLeft: 14,
    paddingRight: 10,
    gap: 8,
    marginTop: "auto",
  },

  agregarIconoCaja: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.12)",
  },

  presionado: { opacity: 0.85 },

  agregarTexto: {
    color: C.textoSobreOro,
    fontSize: 13.5,
    fontFamily: FontFamilies.button,
    flexShrink: 1,
  },
});
