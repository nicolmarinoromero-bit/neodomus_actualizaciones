// Citas — réplica móvil de CitasPage WEB:
// Agendar (POST /citas, horarios desde /citas/horas-disponibles,
// L–V 8:00-18:00 según backend, pago con simulación) + Mis citas
// (editar/cancelar regla 48 h, calificar técnico obligatorio).
import React, { useCallback, useEffect, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams } from "expo-router";

import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import CalendarioMes from "@/components/app/CalendarioMes";
import AppScreen from "@/components/app/AppScreen";
import { FontFamilies } from "@/constants/theme";
import { ApiError } from "@/services/api";
import {
  actualizarCita,
  cancelarCita,
  calificarTecnico,
  crearCita,
  listarHorasDisponibles,
  listarMisCitas,
  listarTarifas,
  obtenerPerfilCliente,
  obtenerMetodosPago,
  type Cita,
  type Tarifa,
} from "@/services/cliente.services";

const TIPOS = ["instalacion", "mantenimiento", "reparacion", "revision", "soporte"];
const METODOS = ["tarjeta_debito", "tarjeta_credito", "pse", "paypal", "punto_pago"];

/** Hoy en ISO local (YYYY-MM-DD) sin desfases de zona horaria. */
const hoyIso = () => {
  const h = new Date();
  return `${h.getFullYear()}-${String(h.getMonth() + 1).padStart(2, "0")}-${String(
    h.getDate(),
  ).padStart(2, "0")}`;
};

export default function PantallaCitas({
  enTab = false,
}: {
  /** En tab: usa navbar público sin botón volver. */
  enTab?: boolean;
}) {
  const params = useLocalSearchParams<{
    tecnico?: string;
    nombre?: string;
    vista?: string;
  }>();

  const [vista, setVista] = useState<"agendar" | "mis">(params.vista === "mis-citas" ? "mis" : "agendar");
  const [tipoServicio, setTipoServicio] = useState("instalacion");
  const [fecha, setFecha] = useState("");
  const [hora, setHora] = useState("");
  const [direccion, setDireccion] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tecnicoId] = useState<number | null>(
    params.tecnico ? Number(params.tecnico) : null,
  );
  const [nombreTecnico] = useState<string | null>(
    params.nombre ? decodeURIComponent(params.nombre) : null,
  );
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>([]);
    const [tarifas, setTarifas] = useState<Tarifa[]>([]);
  const [bancos, setBancos] = useState<string[]>([]);

  const [metodoPago, setMetodoPago] = useState<string>("tarjeta_debito");
  const [numeroTarjeta, setNumeroTarjeta] = useState("");
  const [titular, setTitular] = useState("");
  const [expiracion, setExpiracion] = useState("");
  const [cvv, setCvv] = useState("");
  const [banco, setBanco] = useState("");
  const [correoPaypal, setCorreoPaypal] = useState("");
  const [puntoPago, setPuntoPago] = useState("");
  const [simulacion, setSimulacion] = useState("");

  const [misCitas, setMisCitas] = useState<Cita[]>([]);
  const [editandoId, setEditandoId] = useState<number | null>(null);
  // Confirmación de cancelación con MODAL: la cita NO se toca hasta que
  // el usuario pulse "Aceptar".
  const [citaACancelar, setCitaACancelar] = useState<Cita | null>(null);
  const [cancelando, setCancelando] = useState(false);
  const [calificarCita, setCalificarCita] = useState<Cita | null>(null);
  const [calificacion, setCalificacion] = useState(5);
  const [comentarioCalif, setComentarioCalif] = useState("");

  const [enviando, setEnviando] = useState(false);
  const [exito, setExito] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Cargar dirección del perfil + tarifas + bancos.
  useEffect(() => {
    let activo = true;
    obtenerPerfilCliente().then((p) => {
      if (activo && p.address) setDireccion(p.address);
    }).catch(() => {});
    listarTarifas().then((t) => activo && setTarifas(t)).catch(() => {});
    obtenerMetodosPago().then((m) => activo && setBancos(m.bancos ?? [])).catch(() => {});
    return () => {
      activo = false;
    };
  }, []);

  const cargarMisCitas = useCallback(() => {
    listarMisCitas()
      .then(setMisCitas)
      .catch(() => {});
  }, []);

  useEffect(() => {
    cargarMisCitas();
  }, [cargarMisCitas]);

  // Horarios disponibles (regla WEB): solo cuando hay fecha válida L-V.
  // Sábado y domingo NO disponibles: ni se consultan horas.
  useEffect(() => {
    const diaSemana = fecha ? new Date(fecha + "T12:00:00").getDay() : null;
    if (!fecha || diaSemana === 0 || diaSemana === 6) {
      setHorasDisponibles([]);
      return;
    }
    let activo = true;
    listarHorasDisponibles({
      fecha,
      tecnico_id: tecnicoId ?? undefined,
      tipo_servicio: tipoServicio,
    })
      .then((horas) => activo && setHorasDisponibles(horas))
      .catch(() => activo && setHorasDisponibles([]));
    return () => {
      activo = false;
    };
  }, [fecha, tecnicoId, tipoServicio]);


  const esFinDeSemana = fecha
    ? [0, 6].includes(new Date(fecha + "T12:00:00").getDay())
    : false;

  const tarifaActual =
    tarifas.find((tf) => tf.tipo_servicio === tipoServicio)?.costo ?? null;

  const payloadBase = () => ({
    tipo_servicio: tipoServicio,
    fecha,
    hora,
    direccion: direccion.trim(),
    descripcion: descripcion.trim(),
    id_tecnico: tecnicoId,
    nombre_tecnico: nombreTecnico,
  });

  const datosPagoValidos = (): Record<string, unknown> | null => {
    switch (metodoPago) {
      case "tarjeta_debito":
      case "tarjeta_credito":
        if (!numeroTarjetAvalida()) {
          setError("Completa los datos de la tarjeta.");
          return null;
        }
        if (!simulacion) {
          setError("Selecciona el resultado de simulación.");
          return null;
        }
        return {
          numero: numeroTarjeta.replace(/\s/g, ""),
          titular: titular.trim(),
          expiracion,
          cvv,
          cuotas: 1,
          resultado_simulacion: simulacion,
        };
      case "pse":
        if (!banco) {
          setError("Selecciona un banco para pagar por PSE.");
          return null;
        }
        return { banco, resultado_simulacion: simulacion || "aprobado" };
      case "paypal":
        if (!correoPaypal.trim()) {
          setError("Ingresa el correo de tu cuenta PayPal.");
          return null;
        }
        return {
          correo_paypal: correoPaypal.trim(),
          resultado_simulacion: simulacion || "aprobado",
        };
      case "punto_pago":
        if (!puntoPago) {
          setError("Selecciona el punto de pago (Efecty, Servientrega u otro).");
          return null;
        }
        return { punto_pago: puntoPago };
      default:
        setError("Selecciona un método de pago.");
        return null;
    }
  };

  const numeroTarjetAvalida = () =>
    numeroTarjeta.replace(/\s/g, "").length >= 15 && !!titular.trim() && !!expiracion && cvv.length >= 3;

  const agendarOEditar = async () => {
    setError(null);
    if (!fecha) {
      setError("Selecciona una fecha.");
      return;
    }
    if (!hora) {
      setError("Selecciona una hora disponible.");
      return;
    }

    setEnviando(true);
    try {
      if (editandoId) {
        await actualizarCita(editandoId, payloadBase());
        setExito("Cita actualizada correctamente");
        setEditandoId(null);
      } else {
        const datosPago = datosPagoValidos();
        if (!datosPago) {
          setEnviando(false);
          return;
        }
        const respuesta = await crearCita({
          ...payloadBase(),
          metodo_pago: metodoPago,
          datos_pago: datosPago,
        });
        if (respuesta.redirect_url) {
          // Pasarela externa (igual que la web).
          const { Linking } = await import("react-native");
          Linking.openURL(respuesta.redirect_url).catch(() => {});
        }
        setExito("Cita agendada correctamente");
      }
      setVista("mis");
      cargarMisCitas();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al procesar la cita");
    } finally {
      setEnviando(false);
    }
  };

  const editarCita = (cita: Cita) => {
    setEditandoId(cita.id_cita);
    setTipoServicio(cita.tipo_servicio);
    setFecha(String(cita.fecha).slice(0, 10));
    setHora(String(cita.hora).slice(0, 5));
    setDireccion(cita.direccion);
    setDescripcion(cita.descripcion ?? "");
    setVista("agendar");
  };

  const puedeModificar = (cita: Cita): boolean => {
    if (cita.estado === "Finalizada" || cita.estado === "Cancelada") return false;
    const fechaHora = new Date(`${cita.fecha}T${cita.hora}:00`);
    return fechaHora.getTime() - Date.now() >= 48 * 60 * 60 * 1000; // regla 48 h
  };

  const confirmarCancelar = async () => {
    if (!citaACancelar) return;
    setCancelando(true);
    setError(null);
    try {
      await cancelarCita(citaACancelar.id_cita);
      setExito("Cita cancelada correctamente");
      setCitaACancelar(null);
      cargarMisCitas();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Error al procesar la cita");
    } finally {
      setCancelando(false);
    }
  };

  const enviarCalificacion = async () => {
    if (!calificarCita) return;
    try {
      await calificarTecnico({
        id_cita: calificarCita.id_cita,
        calificacion,
        comentario: comentarioCalif.trim() || undefined,
      });
      setCalificarCita(null);
      setComentarioCalif("");
      setExito("¡Gracias por tu calificación!");
      cargarMisCitas();
    } catch {
      setError("No se pudo enviar la calificación.");
    }
  };

  const inputEstilo = {
    backgroundColor: "#0f0f0f",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    borderRadius: 12,
    color: "#ffffff",
    paddingHorizontal: 13,
    paddingVertical: 11,
    fontSize: 14.5,
    minHeight: 46,
  } as const;

  return (
    <AppScreen titulo="Citas" ocultarVolver={enTab}>
      {/* Vistas */}
      <View style={S.vistas}>
        <Pressable style={[S.tab, vista === "agendar" && S.tabActivo]} onPress={() => setVista("agendar")}>
          <Text style={[S.tabTexto, vista === "agendar" && S.tabTextoActivo]}>
            {editandoId ? "Editando cita" : "Agendar"}
          </Text>
        </Pressable>
        <Pressable style={[S.tab, vista === "mis" && S.tabActivo]} onPress={() => { setVista("mis"); setEditandoId(null); }}>
          <Text style={[S.tabTexto, vista === "mis" && S.tabTextoActivo]}>Mis citas</Text>
        </Pressable>
      </View>

      {exito && <Text style={S.exito}>{exito}</Text>}

      {/* ── AGENDAR ── */}
      {vista === "agendar" && (
        <View style={{ gap: 8 }}>
          {!!nombreTecnico && (
            <View style={S.bannerTecnico}>
              <FontAwesome6 name="user" size={11} color="#141414" />
              <Text style={S.bannerTexto}>Técnico asociado: {nombreTecnico}</Text>
            </View>
          )}

          <Text style={S.label}>Tipo de servicio *</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {TIPOS.map((tipo) => (
              <Pressable
                key={tipo}
                onPress={() => setTipoServicio(tipo)}
                style={[S.chip, tipoServicio === tipo && S.chipActivo]}
              >
                <Text style={[S.chipTexto, tipoServicio === tipo && S.chipTextoActivo]}>
                  {tipo.charAt(0).toUpperCase() + tipo.slice(1)}
                </Text>
              </Pressable>
            ))}
          </View>

          {tarifaActual != null && (
            <Text style={S.tarifa}>
              Tarifa del servicio: ${Math.round(tarifaActual).toLocaleString("es-CO")} COP
            </Text>
          )}

          <Text style={S.label}>Fecha * (lunes a viernes)</Text>
          <CalendarioMes valor={fecha} onChange={setFecha} minFecha={hoyIso()} />
          {esFinDeSemana && (
            <Text style={S.error}>
              No hay horarios disponibles para esta fecha (sábados y domingos no
              laborables).
            </Text>
          )}

          <Text style={S.label}>Hora * (disponibilidad real del sistema)</Text>
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {(horasDisponibles.length > 0
              ? horasDisponibles
              : []
            ).map((h) => (
              <Pressable
                key={h}
                onPress={() => setHora(h.slice(0, 5))}
                style={[S.chip, hora === h.slice(0, 5) && S.chipActivo]}
              >
                <Text style={[S.chipTexto, hora === h.slice(0, 5) && S.chipTextoActivo]}>
                  {h.slice(0, 5)}
                </Text>
              </Pressable>
            ))}
            {horasDisponibles.length === 0 && !esFinDeSemana && !!fecha && (
              <Text style={S.gris}>No hay horas disponibles para esta combinación.</Text>
            )}
          </View>

          <Text style={S.label}>Dirección *</Text>
          <TextInput
            style={inputEstilo}
            value={direccion}
            onChangeText={setDireccion}
            placeholder="Dirección del servicio"
            placeholderTextColor="#8a8a8a"
          />

          <Text style={S.label}>Descripción</Text>
          <TextInput
            style={[inputEstilo, { minHeight: 76, paddingTop: 11, textAlignVertical: "top" }]}
            value={descripcion}
            onChangeText={setDescripcion}
            placeholder="Describe tu necesidad..."
            placeholderTextColor="#8a8a8a"
            multiline
          />

          {!editandoId && (
            <>
              <Text style={S.label}>Método de pago *</Text>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {METODOS.map((m) => (
                  <Pressable
                    key={m}
                    onPress={() => setMetodoPago(m)}
                    style={[S.chip, metodoPago === m && S.chipActivo]}
                  >
                    <Text style={[S.chipTexto, metodoPago === m && S.chipTextoActivo]}>
                      {m.replace("_", " ")}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {/* Campos mínimos por método, mismos que la web */}
              {(metodoPago === "tarjeta_debito" || metodoPago === "tarjeta_credito") && (
                <View style={{ gap: 8 }}>
                  <TextInput style={inputEstilo} placeholder="Número de tarjeta (4242 4242 4242 4242)" placeholderTextColor="#8a8a8a" keyboardType="number-pad" value={numeroTarjeta} onChangeText={(v) => setNumeroTarjeta(v)} />
                  <TextInput style={inputEstilo} placeholder="Titular" placeholderTextColor="#8a8a8a" value={titular} onChangeText={setTitular} />
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    <TextInput style={[inputEstilo, { flex: 1 }]} placeholder="MM/AA" placeholderTextColor="#8a8a8a" value={expiracion} onChangeText={(v) => setExpiracion(v.slice(0, 5))} />
                    <TextInput style={[inputEstilo, { flex: 1 }]} placeholder="CVV" placeholderTextColor="#8a8a8a" keyboardType="number-pad" secureTextEntry value={cvv} onChangeText={(v) => setCvv(v.replace(/\D/g, "").slice(0, 4))} />
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {["aprobado", "rechazado"].map((r) => (
                      <Pressable key={r} onPress={() => setSimulacion(r)} style={[S.chip, simulacion === r && S.chipActivo]}>
                        <Text style={[S.chipTexto, simulacion === r && S.chipTextoActivo]}>
                          Simular: {r}
                        </Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {metodoPago === "pse" && (
                <View style={{ gap: 8 }}>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {bancos.map((b) => (
                      <Pressable key={b} onPress={() => setBanco(b)} style={[S.chip, banco === b && S.chipActivo]}>
                        <Text style={[S.chipTexto, banco === b && S.chipTextoActivo]}>{b}</Text>
                      </Pressable>
                    ))}
                  </View>
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {["aprobado", "rechazado", "pendiente"].map((r) => (
                      <Pressable key={r} onPress={() => setSimulacion(r)} style={[S.chip, simulacion === r && S.chipActivo]}>
                        <Text style={[S.chipTexto, simulacion === r && S.chipTextoActivo]}>Simular: {r}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {metodoPago === "paypal" && (
                <View style={{ gap: 8 }}>
                  <TextInput style={inputEstilo} placeholder="Correo de PayPal" placeholderTextColor="#8a8a8a" autoCapitalize="none" value={correoPaypal} onChangeText={setCorreoPaypal} />
                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                    {["aprobado", "rechazado"].map((r) => (
                      <Pressable key={r} onPress={() => setSimulacion(r)} style={[S.chip, simulacion === r && S.chipActivo]}>
                        <Text style={[S.chipTexto, simulacion === r && S.chipTextoActivo]}>Simular: {r}</Text>
                      </Pressable>
                    ))}
                  </View>
                </View>
              )}

              {metodoPago === "punto_pago" && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                  {["Efecty", "Servientrega", "Otro punto de pago"].map((p) => (
                    <Pressable key={p} onPress={() => setPuntoPago(p)} style={[S.chip, puntoPago === p && S.chipActivo]}>
                      <Text style={[S.chipTexto, puntoPago === p && S.chipTextoActivo]}>{p}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </>
          )}

          {error && <Text style={S.error}>{error}</Text>}

          <Pressable
            style={({ pressed }) => [
              S.botonPrimario,
              pressed && S.presionado,
              enviando && S.deshabilitado,
            ]}
            onPress={() => void agendarOEditar()}
            disabled={enviando}
          >
            <Text style={S.textoBotonPrimario}>
              {enviando ? "Procesando..." : editandoId ? "Actualizar cita" : "Agendar y pagar"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* ── MIS CITAS ── */}
      {vista === "mis" && (
        <View style={{ gap: 12 }}>
          {misCitas.length === 0 && (
            <Text style={S.gris}>No tienes citas agendadas.</Text>
          )}

          {[...misCitas]
            .sort((a, b) => String(b.fecha).localeCompare(String(a.fecha)))
            .map((cita) => {
              const modificable = puedeModificar(cita);
              return (
                <View key={cita.id_cita} style={S.tarjeta}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={S.tipoCita}>{cita.tipo_servicio}</Text>
                    <Text style={[S.estadoCita, { color: cita.estado === "Cancelada" ? "#f0858a" : cita.estado === "Finalizada" ? "#7ee29a" : "#f6c344" }]}>
                      {cita.estado}
                    </Text>
                  </View>
                  <Text style={S.fecha}>
                    {String(cita.fecha).slice(0, 10)} · {String(cita.hora).slice(0, 5)}
                  </Text>
                  <Text style={S.gris}>{cita.direccion}</Text>
                  {cita.descripcion && <Text style={S.gris}>{cita.descripcion}</Text>}
                  {cita.nombre_tecnico && (
                    <Text style={S.tecnico}>Técnico: {cita.nombre_tecnico}</Text>
                  )}
                  {cita.estado_pago && (
                    <Text style={S.gris}>Pago: {cita.estado_pago}</Text>
                  )}

                  <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 8 }}>
                    {modificable && (
                      <Pressable style={({ pressed }) => [S.botonOutline, pressed && S.presionado]} onPress={() => editarCita(cita)}>
                        <Text style={S.textoOutline}>Editar</Text>
                      </Pressable>
                    )}
                    {modificable && (
                      <Pressable
                        style={({ pressed }) => [S.botonOutlineRojo, pressed && S.presionado]}
                        onPress={() => setCitaACancelar(cita)}
                      >
                        <Text style={S.textoOutlineRojo}>Cancelar</Text>
                      </Pressable>
                    )}
                    {!modificable && cita.estado !== "Cancelada" && (
                      <Text style={S.gris}>Esta cita ya no puede modificarse ni cancelarse.</Text>
                    )}
                    {cita.estado === "Finalizada" && cita.calificada === false && (
                      <Pressable
                        style={({ pressed }) => [S.botonOutline, pressed && S.presionado]}
                        onPress={() => setCalificarCita(cita)}
                      >
                        <Text style={S.textoOutline}>Calificar técnico (obligatorio)</Text>
                      </Pressable>
                    )}
                  </View>
                </View>
              );
            })}
        </View>
      )}

      {/* Modal calificar */}
      {calificarCita && (
        <View style={S.califOverlay}>
          <View style={S.califTarjeta}>
            <Text style={S.califTitulo}>Califica a tu técnico</Text>
            <Text style={S.califNota}>
              Esta calificación es obligatoria para poder agendar una nueva cita.
            </Text>
            <View style={{ flexDirection: "row", gap: 10, justifyContent: "center" }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Pressable key={n} onPress={() => setCalificacion(n)}>
                  <FontAwesome6 name="star" size={26} solid={n <= calificacion} color={n <= calificacion ? "#f6c344" : "#4a4a4a"} />
                </Pressable>
              ))}
            </View>
            <TextInput
              style={inputEstilo}
              placeholder="Comentario (opcional, máx. 500)"
              placeholderTextColor="#8a8a8a"
              value={comentarioCalif}
              onChangeText={(v) => setComentarioCalif(v.slice(0, 500))}
              multiline
            />
            <View style={{ flexDirection: "row", gap: 10 }}>
              <Pressable style={[S.botonOutline, { flex: 1 }]} onPress={() => setCalificarCita(null)}>
                <Text style={S.textoOutline}>Cerrar</Text>
              </Pressable>
              <Pressable
                style={({ pressed }) => [S.botonPrimario, { flex: 1 }, pressed && S.presionado]}
                onPress={() => void enviarCalificacion()}
              >
                <Text style={S.textoBotonPrimario}>Enviar</Text>
              </Pressable>
            </View>
          </View>
        </View>
      )}

      {/* ── MODAL: confirmar cancelación de cita ── */}
      <Modal transparent visible={!!citaACancelar} animationType="fade">
        <View style={S.cancelarOverlay}>
          <View style={S.cancelarTarjeta}>
            <FontAwesome6 name="calendar-xmark" size={26} color="#f0858a" />
            <Text style={S.cancelarTitulo}>
              ¿Estás seguro que quieres cancelar la cita?
            </Text>
            {!!citaACancelar && (
              <Text style={S.cancelarDetalle}>
                {citaACancelar.tipo_servicio} ·{" "}
                {String(citaACancelar.fecha).slice(0, 10)} ·{" "}
                {String(citaACancelar.hora).slice(0, 5)}
              </Text>
            )}
            <View style={{ flexDirection: "row", gap: 12, marginTop: 16 }}>
              {/* Rechazar: cierra el modal, la cita queda exactamente igual */}
              <Pressable
                style={({ pressed }) => [
                  S.cancelarBotonRechazar,
                  { flex: 1 },
                  pressed && S.presionado,
                ]}
                onPress={() => setCitaACancelar(null)}
                disabled={cancelando}
              >
                <Text style={S.cancelarTextoRechazar}>Rechazar</Text>
              </Pressable>
              {/* Aceptar: ejecuta la cancelación en backend */}
              <Pressable
                style={({ pressed }) => [
                  S.cancelarBotonAceptar,
                  { flex: 1 },
                  pressed && S.presionado,
                  cancelando && S.deshabilitado,
                ]}
                onPress={() => void confirmarCancelar()}
                disabled={cancelando}
              >
                <Text style={S.cancelarTextoAceptar}>
                  {cancelando ? "Cancelando..." : "Aceptar"}
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Text style={S.notaHorario}>
        Horario de atención: lunes a viernes, 8:00 a. m. – 6:00 p. m.
      </Text>
    </AppScreen>
  );
}

const S = StyleSheet.create({
  vistas: { flexDirection: "row", gap: 8 },
  tab: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(212,165,75,0.28)", paddingVertical: 9, paddingHorizontal: 16 },
  tabActivo: { backgroundColor: "#caa24d", borderColor: "#caa24d" },
  tabTexto: { color: "#f0c96f", fontSize: 13, fontFamily: FontFamilies.bodyMedium },
  tabTextoActivo: { color: "#141414", fontFamily: FontFamilies.button },
  label: { color: "#ffffff", fontSize: 13, fontFamily: FontFamilies.bodyMedium, marginTop: 4, marginBottom: -2 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(212,165,75,0.35)", paddingVertical: 7, paddingHorizontal: 12, backgroundColor: "rgba(212,165,75,0.06)" },
  chipActivo: { backgroundColor: "#caa24d", borderColor: "#caa24d" },
  chipTexto: { color: "#f0c96f", fontSize: 12.5, fontFamily: FontFamilies.bodyMedium },
  chipTextoActivo: { color: "#141414", fontFamily: FontFamilies.button },
  tarifa: { color: "#f0c96f", fontSize: 13, fontFamily: FontFamilies.bodyBold },
  bannerTecnico: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#caa24d",
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 13,
  },
  bannerTexto: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 12.5 },
  error: { color: "#f0858a", fontSize: 13, lineHeight: 19 },
  exito: { color: "#7ee29a", fontSize: 13, lineHeight: 19 },
  gris: { color: "#bdbdbd", fontSize: 12.5, lineHeight: 18 },
  botonPrimario: { backgroundColor: "#caa24d", borderRadius: 12, minHeight: 48, alignItems: "center", justifyContent: "center", marginTop: 10 },
  deshabilitado: { opacity: 0.55 },
  presionado: { opacity: 0.85 },
  textoBotonPrimario: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 14.5 },
  botonOutline: { borderRadius: 10, borderWidth: 1, borderColor: "rgba(212,165,75,0.45)", paddingVertical: 9, paddingHorizontal: 13, alignItems: "center" },
  textoOutline: { color: "#f0c96f", fontFamily: FontFamilies.button, fontSize: 12.5 },
  botonOutlineRojo: { borderRadius: 10, borderWidth: 1, borderColor: "rgba(240,133,138,0.55)", paddingVertical: 9, paddingHorizontal: 13, alignItems: "center" },
  textoOutlineRojo: { color: "#f0858a", fontFamily: FontFamilies.button, fontSize: 12.5 },
  tarjeta: {
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 14,
    gap: 5,
  },
  tipoCita: { color: "#ffffff", fontSize: 14.5, fontFamily: FontFamilies.bodyBold, textTransform: "capitalize" },
  estadoCita: { fontSize: 12.5, fontFamily: FontFamilies.bodyMedium },
  fecha: { color: "#bdbdbd", fontSize: 12.5 },
  tecnico: { color: "#f0c96f", fontSize: 12.5 },
  notaHorario: { color: "#bdbdbd", fontSize: 12, textAlign: "center", lineHeight: 18 },
  califOverlay: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0, backgroundColor: "rgba(0,0,0,0.75)", alignItems: "center", justifyContent: "center", padding: 22, zIndex: 50 },
  califTarjeta: { width: "100%", maxWidth: 400, backgroundColor: "#121212", borderRadius: 20, borderWidth: 1, borderColor: "rgba(212,165,75,0.28)", padding: 18, gap: 12 },
  califTitulo: { color: "#ffffff", fontSize: 17, fontFamily: FontFamilies.bodyBold, textAlign: "center" },
  califNota: { color: "#bdbdbd", fontSize: 12.5, textAlign: "center", lineHeight: 18 },

  // Modal de cancelación: centrado en pantalla, estilo Neodomus.
  cancelarOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
  },
  cancelarTarjeta: {
    width: "100%",
    maxWidth: 400,
    backgroundColor: "#121212",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.28)",
    padding: 20,
    alignItems: "center",
    gap: 8,
  },
  cancelarTitulo: {
    color: "#ffffff",
    fontSize: 16.5,
    fontFamily: FontFamilies.bodyBold,
    textAlign: "center",
    lineHeight: 23,
  },
  cancelarDetalle: {
    color: "#f0c96f",
    fontSize: 12.5,
    textAlign: "center",
    textTransform: "capitalize",
  },
  cancelarBotonRechazar: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.5)",
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    minHeight: 48,
  },
  cancelarTextoRechazar: {
    color: "#f0c96f",
    fontSize: 14,
    fontFamily: FontFamilies.button,
  },
  cancelarBotonAceptar: {
    backgroundColor: "#e5484d",
    borderRadius: 12,
    paddingVertical: 13,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  cancelarTextoAceptar: {
    color: "#ffffff",
    fontSize: 14,
    fontFamily: FontFamilies.button,
  },
});
