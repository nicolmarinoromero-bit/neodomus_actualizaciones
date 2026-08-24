// Técnicos — GET /tecnicos/publicos (misma fuente que la WEB).
// ♥ Favoritos de técnicos PERSISTIDOS EN BACKEND por cliente
//   (GET/POST/DELETE /tecnicos/favoritos...). Los marcados como
//   favoritos aparecen luego en "Mis técnicos". Si hay favoritos
//   guardados de versiones anteriores (solo local), se migran al
//   backend una sola vez. Visitante: fallback local en AsyncStorage.
// Seleccionar un técnico redirige a agendar cita con él preasignado.
import React, { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { router } from "expo-router";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import AsyncStorage from "@react-native-async-storage/async-storage";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { ApiError } from "@/services/api";
import {
  agregarTecnicoFavorito,
  eliminarTecnicoFavorito,
  listarTecnicosFavoritos,
  listarTecnicosPublicos,
  type TecnicoPublico,
} from "@/services/cliente.services";

export default function PantallaTecnicos({
  enTab = false,
}: {
  enTab?: boolean;
}) {
  const { autenticado, usuario } = useAuth();
  const [tecnicos, setTecnicos] = useState<TecnicoPublico[]>([]);
  // ♥ Favoritos del cliente autenticado — fuente de verdad: BACKEND.
  const claveLocalAnterior = `neodomus_tecnicos_favoritos_${usuario?.correo ?? "visitante"}`;
  const [favoritos, setFavoritos] = useState<Set<number>>(new Set());

  useEffect(() => {
    let activo = true;

    if (!autenticado) {
      // Visitante: los tabs de técnicos no están visibles; se conserva
      // un fallback local por si se llega aquí sin sesión.
      AsyncStorage.getItem(claveLocalAnterior)
        .then((crudo) => {
          if (!crudo || !activo) return;
          const lista: unknown = JSON.parse(crudo);
          if (Array.isArray(lista))
            setFavoritos(
              new Set(lista.filter((v): v is number => typeof v === "number")),
            );
        })
        .catch(() => {});
      return;
    }

    // Autenticado: cargar favoritos reales del usuario desde el backend
    // y migrar (una vez) los que quedaron guardados solo en local.
    Promise.all([
      listarTecnicosFavoritos(),
      AsyncStorage.getItem(claveLocalAnterior).catch(() => null),
    ])
      .then(([listaBackend, crudo]) => {
        if (!activo) return;
        const idsBackend = new Set(listaBackend.map((t) => t.id_tecnico));
        let locales: number[] = [];
        try {
          const parsed: unknown = crudo ? JSON.parse(crudo) : null;
          if (Array.isArray(parsed))
            locales = parsed.filter(
              (v): v is number => typeof v === "number" && !idsBackend.has(v),
            );
        } catch {}
        setFavoritos(new Set([...idsBackend, ...locales]));

        if (locales.length > 0) {
          Promise.allSettled(locales.map((id) => agregarTecnicoFavorito(id)))
            .then(() =>
              AsyncStorage.removeItem(claveLocalAnterior).catch(() => {}),
            )
            .catch(() => {});
        }
      })
      .catch(() => {});

    return () => {
      activo = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autenticado]);

  const alternarFavorito = (id: number) => {
    const yaEraFavorito = favoritos.has(id);
    // Actualización optimista + reversión si el backend falla.
    setFavoritos((prev) => {
      const nueva = new Set(prev);
      if (yaEraFavorito) nueva.delete(id);
      else nueva.add(id);
      return nueva;
    });

    if (!autenticado) {
      AsyncStorage.setItem(
        claveLocalAnterior,
        JSON.stringify(
          yaEraFavorito
            ? [...favoritos].filter((f) => f !== id)
            : [...favoritos, id],
        ),
      ).catch(() => {});
      return;
    }

    const peticion = yaEraFavorito
      ? eliminarTecnicoFavorito(id)
      : agregarTecnicoFavorito(id);
    peticion.catch(() => {
      setFavoritos((prev) => {
        const revertida = new Set(prev);
        if (yaEraFavorito) revertida.add(id);
        else revertida.delete(id);
        return revertida;
      });
    });
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
