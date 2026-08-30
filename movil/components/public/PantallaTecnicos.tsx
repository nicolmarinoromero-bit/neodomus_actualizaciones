// Técnicos — GET /tecnicos/publicos (misma fuente que la WEB).
// ♥ Favoritos de técnicos 100% locales (AsyncStorage) igual que la WEB
//   (utils/tecnicosFavoritos.ts): visitante vs correo, migración automática.
//   Los marcados aparecen luego en "Mis técnicos" sin necesidad de backend.
import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { ApiError } from "@/services/api";
import { listarTecnicosPublicos, type TecnicoPublico } from "@/services/cliente.services";
import { useTecnicosFavoritos } from "@/contexts/TecnicosFavoritosContext";

export default function PantallaTecnicos({
  enTab = false,
}: {
  enTab?: boolean;
}) {
  const [tecnicos, setTecnicos] = useState<TecnicoPublico[]>([]);
  const { favoritosTecnicos: favoritos, toggleFavoritoTecnico } = useTecnicosFavoritos();

  const alternarFavorito = (id: number) => {
    toggleFavoritoTecnico(id);
  };
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    listarTecnicosPublicos()
      .then(setTecnicos)
      .catch((e) =>
        setError(e instanceof ApiError ? e.message : "Error al cargar técnicos."),
      )
      .finally(() => setCargando(false));
  }, []);

  const capitalizar = (t: string) =>
    t ? t.charAt(0).toUpperCase() + t.slice(1).toLowerCase() : "";

  const seleccionar = (tecnico: TecnicoPublico) => {
    router.push({
      pathname: "/(tabs)/citas-tab",
      params: {
        tecnico: String(tecnico.id_tecnico),
        nombre: encodeURIComponent(
          `${capitalizar(tecnico.first_name)} ${capitalizar(tecnico.last_name)}`.trim(),
        ),
      },
    });
  };

  return (
    <AppScreen
      titulo="Técnicos"
      ocultarVolver={enTab}
    >
      {cargando && <Text style={S.gris}>Cargando...</Text>}
      {error && <Text style={S.error}>{error}</Text>}

      {tecnicos.map((tecnico) => {
        const disponible = tecnico.disponible && tecnico.is_active;
        return (
          <View key={tecnico.id_tecnico} style={S.tarjeta}>
            {tecnico.foto_url ? (
              <Image source={{ uri: tecnico.foto_url }} style={S.foto} />
            ) : (
              <View style={[S.foto, S.fotoVacia]}>
                <FontAwesome6 name="user" size={20} color="#f0c96f" />
              </View>
            )}

            <View style={{ flex: 1, gap: 3 }}>
              <Text style={S.nombre}>
                {capitalizar(tecnico.first_name)} {capitalizar(tecnico.last_name)}
              </Text>
              {!!tecnico.certificacion_t && (
                <Text style={S.especialidad}>{tecnico.certificacion_t}</Text>
              )}
              <Text
                style={[
                  S.estado,
                  { color: disponible ? "#7ee29a" : "#bdbdbd" },
                ]}
              >
                {disponible ? "● Disponible" : "● Ocupado"}
              </Text>
            </View>

            {/* ♥ Favorito persistente por cuenta */}
            <Pressable
              onPress={() => alternarFavorito(tecnico.id_tecnico)}
              hitSlop={8}
              accessibilityLabel={
                favoritos.has(tecnico.id_tecnico)
                  ? "Quitar de favoritos"
                  : "Agregar a favoritos"
              }
            >
              <FontAwesome6
                name="heart"
                size={16}
                solid={favoritos.has(tecnico.id_tecnico)}
                color={favoritos.has(tecnico.id_tecnico) ? "#e5484d" : "#ffffff"}
              />
            </Pressable>

            <Pressable
              style={({ pressed }) => [S.boton, pressed && S.presionado]}
              onPress={() => seleccionar(tecnico)}
            >
              <Text style={S.textoBoton}>Seleccionar</Text>
            </Pressable>
          </View>
        );
      })}
    </AppScreen>
  );
}

const S = StyleSheet.create({
  gris: { color: "#bdbdbd", fontSize: 13 },
  error: { color: "#f0858a", fontSize: 13 },
  tarjeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 13,
  },
  foto: { width: 52, height: 52, borderRadius: 26 },
  fotoVacia: {
    backgroundColor: "rgba(212,165,75,0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  nombre: { color: "#ffffff", fontSize: 14.5, fontFamily: FontFamilies.bodyBold },
  especialidad: { color: "#f0c96f", fontSize: 12.5 },
  estado: { fontSize: 12 },
  boton: {
    backgroundColor: "#caa24d",
    borderRadius: 10,
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  presionado: { opacity: 0.85 },
  textoBoton: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 12.5 },
});
