// Mis reseñas — GET /calificaciones/mis-dadas + creación de reseñas
// reutilizando el sistema existente del backend:
// POST /calificaciones {id_cita, calificacion(1-5), comentario} sobre
// citas FINALIZADAS propias aún sin calificar. La reseña se guarda
// realmente en BD asociada a cliente + técnico + cita.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { ApiError } from "@/services/api";
import {
  calificarTecnico,
  listarMisCitas,
  listarMisResenas,
  type Cita,
  type ResenaTecnico,
} from "@/services/cliente.services";

export default function ResenasScreen() {
  const [lista, setLista] = useState<ResenaTecnico[]>([]);
  const [citasFinalizadas, setCitasFinalizadas] = useState<Cita[]>([]);
  const [cargando, setCargando] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [exito, setExito] = useState<string | null>(null);

  // Formulario de nueva reseña
  const [modalVisible, setModalVisible] = useState(false);
  const [citaSeleccionada, setCitaSeleccionada] = useState<Cita | null>(null);
  const [calificacion, setCalificacion] = useState(5);
  const [comentario, setComentario] = useState("");
  const [publicando, setPublicando] = useState(false);

  const cargar = useCallback(() => {
    let activo = true;
    Promise.all([listarMisResenas(), listarMisCitas()])
      .then(([resenas, citas]) => {
        if (!activo) return;
        setLista(resenas);
        // Elegibles para reseñar: finalizadas, con técnico y sin calificar.
        setCitasFinalizadas(
          citas.filter(
            (c) =>
              c.estado === "Finalizada" &&
              c.calificada === false &&
              c.id_tecnico != null,
          ),
        );
      })
      .catch((e) =>
        activo &&
        setError(e instanceof ApiError ? e.message : "Error al cargar reseñas."),
      )
      .finally(() => activo && setCargando(false));
    return () => {
      activo = false;
    };
  }, []);

  useEffect(() => {
    return cargar();
  }, [cargar]);

  const abrirModal = () => {
    setCitaSeleccionada(citasFinalizadas[0] ?? null);
    setCalificacion(5);
    setComentario("");
    setError(null);
    setModalVisible(true);
  };

  const publicar = async () => {
    if (!citaSeleccionada) {
      setError("Selecciona el técnico que quieres reseñar.");
      return;
    }
    setPublicando(true);
    setError(null);
    try {
      await calificarTecnico({
        id_cita: citaSeleccionada.id_cita,
        calificacion,
        comentario: comentario.trim() || undefined,
      });
      setModalVisible(false);
      setExito("¡Reseña publicada! Gracias por tu opinión.");
      setTimeout(() => setExito(null), 4000);
      cargar();
    } catch (e) {
      setError(
        e instanceof ApiError ? e.message : "No se pudo publicar la reseña.",
      );
    } finally {
      setPublicando(false);
    }
  };

  const hayPendientes = useMemo(() => citasFinalizadas.length > 0, [citasFinalizadas]);

  return (
    <AppScreen titulo="Mis reseñas">
      <Pressable
        style={({ pressed }) => [
          S.botonNueva,
          pressed && S.presionado,
          !hayPendientes && S.deshabilitado,
        ]}
        onPress={abrirModal}
        disabled={!hayPendientes}
        accessibilityLabel="Escribir una reseña"
      >
        <FontAwesome6 name="star" size={13} color="#141414" />
        <Text style={S.textoBotonNueva}>Escribir reseña</Text>
      </Pressable>
      {!hayPendientes && (
        <Text style={S.gris}>
          Podrás reseñar a un técnico cuando completes una cita con él.
        </Text>
      )}

      {exito && <Text style={S.exito}>{exito}</Text>}
      {cargando && <Text style={S.gris}>Cargando...</Text>}
      {!cargando && lista.length === 0 && (
        <Text style={S.gris}>No has calificado a ningún técnico aún.</Text>
      )}

      {lista.map((r) => (
        <View key={r.id_calificacion} style={S.tarjeta}>
          <View style={S.cabecera}>
            {/* Estrellas */}
            {[1, 2, 3, 4, 5].map((n) => (
              <FontAwesome6
                key={n}
                name="star"
                size={13}
                solid={n <= r.calificacion}
                color={n <= r.calificacion ? "#f6c344" : "#4a4a4a"}
              />
            ))}
            {!!r.fecha_cita && (
              <Text style={S.fecha}>{String(r.fecha_cita).slice(0, 10)}</Text>
            )}
          </View>

          {r.nombre_tecnico && (
            <Text style={S.tecnico}>Técnico: {r.nombre_tecnico}</Text>
          )}
          {!!r.tipo_servicio && (
            <Text style={S.gris}>{r.tipo_servicio}</Text>
          )}
          {r.comentario && <Text style={S.comentario}>“{r.comentario}”</Text>}
        </View>
      ))}

      {/* ── MODAL: escribir reseña ── */}
      <Modal transparent visible={modalVisible} animationType="fade">
        <View style={S.modalOverlay}>
          <View style={S.modalTarjeta}>
            <Text style={S.modalTitulo}>Escribir reseña</Text>

            {/* Técnico (cita finalizada elegida) */}
            <Text style={S.label}>Técnico</Text>
            {citasFinalizadas.length === 1 ? (
              <Text style={S.tecnicoSel}>
                {citasFinalizadas[0].nombre_tecnico ?? "Técnico"} ·{" "}
                {citasFinalizadas[0].tipo_servicio}
              </Text>
            ) : (
              <View style={{ gap: 6 }}>
                {citasFinalizadas.map((c) => (
                  <Pressable
                    key={c.id_cita}
                    onPress={() => setCitaSeleccionada(c)}
                    style={[S.chip, citaSeleccionada?.id_cita === c.id_cita && S.chipActivo]}
                  >
                    <Text
                      style={[
                        S.chipTexto,
                        citaSeleccionada?.id_cita === c.id_cita && S.chipTextoActivo,
                      ]}
                      numberOfLines={2}
                    >
                      {c.nombre_tecnico ?? `Técnico #${c.id_tecnico}`} · {c.tipo_servicio} ·{" "}
                      {String(c.fecha).slice(0, 10)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {/* Calificación */}
            <Text style={S.label}>Calificación</Text>
            <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setCalificacion(n)} hitSlop={6}>
                  <FontAwesome6
                    name="star"
                    size={28}
                    solid={n <= calificacion}
                    color={n <= calificacion ? "#f6c344" : "#4a4a4a"}
                  />
                </Pressable>
              ))}
            </View>

            {/* Comentario */}
            <Text style={S.label}>Escribe tu reseña</Text>
            <TextInput
              style={[S.input, S.textarea]}
              placeholder="Cuéntanos cómo fue el servicio..."
              placeholderTextColor="#8a8a8a"
              value={comentario}
              onChangeText={(v) => setComentario(v.slice(0, 500))}
              multiline
              textAlignVertical="top"
            />

            {error && <Text style={S.error}>{error}</Text>}

            <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
              <Pressable
                style={({ pressed }) => [S.botonFantasma, { flex: 1 }, pressed && S.presionado]}
                onPress={() => setModalVisible(false)}
                disabled={publicando}
              >
                <Text style={S.textoFantasma}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [
                  S.botonPrimario,
                  { flex: 1 },
                  pressed && S.presionado,
                  publicando && S.deshabilitado,
                ]}
                onPress={() => void publicar()}
                disabled={publicando}
              >
                <Text style={S.textoBotonPrimario}>
                  {publicando ? "Publicando..." : "Publicar reseña"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </AppScreen>
  );
}

const S = StyleSheet.create({
  botonNueva: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "#caa24d",
    borderRadius: 12,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  textoBotonNueva: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 14 },
  gris: { color: "#bdbdbd", fontSize: 12.5 },
  error: { color: "#f0858a", fontSize: 13, textAlign: "center", lineHeight: 19 },
  exito: { color: "#7ee29a", fontSize: 13, textAlign: "center", lineHeight: 19 },
  tarjeta: {
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 14,
    gap: 6,
  },
  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 4,
  },
  fecha: { color: "#6f6f6f", fontSize: 11 },
  tecnico: { color: "#ffffff", fontSize: 14, fontFamily: FontFamilies.bodyBold },
  comentario: { color: "#bdbdbd", fontSize: 13, fontStyle: "italic", lineHeight: 19 },

  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 22,
  },
  modalTarjeta: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#121212",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.28)",
    padding: 18,
    gap: 8,
  },
  modalTitulo: {
    color: "#ffffff",
    fontSize: 17,
    fontFamily: FontFamilies.bodyBold,
    textAlign: "center",
    marginBottom: 4,
  },
  label: {
    color: "#ffffff",
    fontSize: 13,
    fontFamily: FontFamilies.bodyMedium,
    marginTop: 4,
  },
  tecnicoSel: { color: "#f0c96f", fontSize: 13.5, fontFamily: FontFamilies.bodyBold },
  chip: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.35)",
    backgroundColor: "rgba(212,165,75,0.06)",
    paddingVertical: 9,
    paddingHorizontal: 12,
  },
  chipActivo: { backgroundColor: "#caa24d", borderColor: "#caa24d" },
  chipTexto: { color: "#f0c96f", fontSize: 12.5 },
  chipTextoActivo: { color: "#141414", fontFamily: FontFamilies.button },
  input: {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 12,
    color: "#ffffff",
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14.5,
    minHeight: 46,
  },
  textarea: { minHeight: 90, paddingTop: 11, textAlignVertical: "top" },
  botonPrimario: {
    backgroundColor: "#caa24d",
    borderRadius: 10,
    paddingVertical: 11,
    alignItems: "center",
  },
  textoBotonPrimario: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 13.5 },
  botonFantasma: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.5)",
    paddingVertical: 11,
    alignItems: "center",
  },
  textoFantasma: { color: "#f0c96f", fontSize: 12.5, fontFamily: FontFamilies.button },
  deshabilitado: { opacity: 0.55 },
  presionado: { opacity: 0.85 },
});
