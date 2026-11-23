// Checkout — réplica móvil de CheckoutPage WEB:
// gate cliente · servicios técnicos opcionales (mín. 3 días de
// anticipación) · dirección del perfil (solo lectura) · métodos de
// pago reales con simulador · POST /pedidos · aprobado/pendiente/
// rechazado · modal de éxito con factura PDF real.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import CalendarioMes from "@/components/app/CalendarioMes";
import AppScreen from "@/components/app/AppScreen";
import Dropdown from "@/components/ui/Dropdown";
import PaymentMethodCards from "@/components/public/PaymentMethodCards";
import { FontFamilies } from "@/constants/theme";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { ApiError, apiFetch } from "@/services/api";
import {
  crearPedido,
  descargarFacturaPdf,
  listarTecnicosPublicos,
  obtenerMetodosPago,
  obtenerPerfilCliente,
  type MetodosPago,
  type TecnicoPublico,
} from "@/services/cliente.services";

const SERVICIOS = [
  { nombre: "Instalación", tipo: "instalacion", precio: 120000 },
  { nombre: "Mantenimiento", tipo: "mantenimiento", precio: 80000 },
  { nombre: "Reparación", tipo: "reparacion", precio: 90000 },
  { nombre: "Revisión", tipo: "revision", precio: 60000 },
  { nombre: "Soporte técnico", tipo: "soporte", precio: 70000 },
];



interface ServicioElegido {
  tipo: string;
  nombre: string;
  precio: number;
  fecha: string;
  hora: string;
  id_tecnico?: number;
  id_tecnico_2?: number;
  id_tecnico_3?: number;
}

interface RecomendacionTecnicos {
  horas_por_tecnico?: number;
  tecnicos_necesarios: number;
  especializaciones_requeridas: { id_especializacion: number; nombre: string }[];
  tecnicos_sugeridos: { id_tecnico: number; nombre: string; cubiertas: number }[];
}

interface CuponCheckout {
  id_cupon: number;
  codigo: string;
  tipo_descuento: string;
  valor_descuento: number;
  fecha_vencimiento: string | null;
  compra_minima: number;
  usos_maximos: number;
  usos_realizados: number;
}

const hoyLocal = () => {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, "0")}-${String(fecha.getDate()).padStart(2, "0")}`;
};

export default function CheckoutScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { autenticado, userType } = useAuth();
  const { items, totalPrice, clearCart } = useCart();

  const [paso, setPaso] = useState<"servicio" | "pago">("servicio");
  const [direccionPerfil, setDireccionPerfil] = useState("");
  const [metodosPagoInfo, setMetodosPagoInfo] = useState<MetodosPago | null>(null);

  // Servicios elegidos (0..n)
  const [serviciosElegidos, setServiciosElegidos] = useState<ServicioElegido[]>([]);
  const [tipoActivo, setTipoActivo] = useState<string | null>(null);
  const [fechaServicio, setFechaServicio] = useState("");
  const [horaServicio, setHoraServicio] = useState("");
  const [tecnicosDisponibles, setTecnicosDisponibles] = useState<TecnicoPublico[]>([]);
  const [tecnicosSeleccionados, setTecnicosSeleccionados] = useState<number[]>([]);
  const [modoAsignacion, setModoAsignacion] = useState<"auto" | "lista">("auto");
  const [recomendacion, setRecomendacion] = useState<RecomendacionTecnicos | null>(null);
  const [horasDisponibles, setHorasDisponibles] = useState<string[]>([]);
  const [cargandoHoras, setCargandoHoras] = useState(false);
  const [cuponesDisponibles, setCuponesDisponibles] = useState<CuponCheckout[]>([]);
  const [codigoCupon, setCodigoCupon] = useState("");
  const [cuponAplicado, setCuponAplicado] = useState<CuponCheckout | null>(null);
  const [mensajeCupon, setMensajeCupon] = useState("");
  const [validandoCupon, setValidandoCupon] = useState(false);

  // Pago — estado independiente por método (igual que web)
  const [metodoPago, setMetodoPago] = useState<string>("tarjeta_credito");
  const [numeroTarjeta, setNumeroTarjeta] = useState("");
  const [titular, setTitular] = useState("");
  const [expiracion, setExpiracion] = useState("");
  const [cvv, setCvv] = useState("");
  const [cuotas, setCuotas] = useState("1");
  const [banco, setBanco] = useState("");
  const [correoPaypal, setCorreoPaypal] = useState("");
  const [puntoPago, setPuntoPago] = useState("");
  const [simulacion, setSimulacion] = useState("");

  const [procesando, setProcesando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [exitoDatos, setExitoDatos] = useState<{
    id_pedido?: number;
    numero_factura?: string;
    pdf_url?: string;
    numero_transaccion?: string;
  } | null>(null);
  const [pendienteDatos, setPendienteDatos] = useState<{
    id_pedido?: number;
    codigo_punto_pago?: string;
    referencia_pago?: string;
    fecha_limite?: string;
  } | null>(null);
  const [rechazadoDatos, setRechazadoDatos] = useState<{ id_pedido?: number } | null>(null);

  // Gate: solo clientes autenticados (igual que la web).
  useEffect(() => {
    if (!autenticado || userType !== "client") return;
    obtenerPerfilCliente()
      .then((p) => setDireccionPerfil(p.address ?? ""))
      .catch(() => {});
    obtenerMetodosPago()
      .then(setMetodosPagoInfo)
      .catch(() => {});
    apiFetch<CuponCheckout[]>("/novedades/cliente/mis-cupones")
      .then(setCuponesDisponibles)
      .catch(() => setCuponesDisponibles([]));
  }, [autenticado, userType]);

  const totalServicios = serviciosElegidos.reduce((s, x) => s + x.precio, 0);
  const subtotal = totalPrice + totalServicios;
  const cuponCumpleCompraMinima = Boolean(cuponAplicado && subtotal >= Number(cuponAplicado.compra_minima || 0));
  const recomendacionActiva = items.length > 0 ? recomendacion : null;
  const descuentoCupon = cuponCumpleCompraMinima && cuponAplicado
    ? Math.min(subtotal, cuponAplicado.tipo_descuento === "porcentaje"
      ? Math.round(subtotal * Number(cuponAplicado.valor_descuento) / 100)
      : Number(cuponAplicado.valor_descuento))
    : 0;
  const totalGeneral = Math.max(0, subtotal - descuentoCupon);
  const tecnicosNecesarios = Math.max(
    1,
    Math.min(3, recomendacionActiva?.tecnicos_necesarios ?? Math.max(1, ...items.map((item) => Number(item.tecnicos_requeridos) || 1))),
  );
  const tecnicosElegibles = useMemo(() => tecnicosDisponibles.filter((tecnico) => {
    if (tecnico.disponible === false) return false;
    if (tipoActivo !== "instalacion" || !recomendacionActiva?.tecnicos_sugeridos?.length) return true;
    return recomendacionActiva.tecnicos_sugeridos.some(
      (sugerido) => sugerido.id_tecnico === tecnico.id_tecnico && sugerido.cubiertas > 0,
    );
  }), [tecnicosDisponibles, tipoActivo, recomendacionActiva]);

  const aplicarCupon = async (codigo = codigoCupon) => {
    const normalizado = codigo.trim().toUpperCase();
    if (!normalizado) {
      setMensajeCupon("Escribe el código del cupón.");
      return;
    }
    setValidandoCupon(true);
    setMensajeCupon("");
    try {
      const cupon = await apiFetch<CuponCheckout>(`/novedades/cupones/validar?codigo=${encodeURIComponent(normalizado)}`);
      if (subtotal < Number(cupon.compra_minima || 0)) {
        setCuponAplicado(null);
        setMensajeCupon(`La compra mínima para este cupón es $${Number(cupon.compra_minima).toLocaleString("es-CO")} COP.`);
        return;
      }
      setCuponAplicado(cupon);
      setCodigoCupon(cupon.codigo);
      setMensajeCupon("Cupón aplicado.");
    } catch (e) {
      setCuponAplicado(null);
      setMensajeCupon(e instanceof ApiError ? e.message : "No se pudo validar el cupón.");
    } finally {
      setValidandoCupon(false);
    }
  };

  // Al entrar a checkout para una nueva compra, limpiar estados residuales de una compra anterior.
  // Evita que "Pago exitoso" aparezca directamente al pulsar Finalizar compra.
  useFocusEffect(
    useCallback(() => {
      if ((exitoDatos || pendienteDatos || rechazadoDatos) && items.length > 0) {
        setExitoDatos(null);
        setPendienteDatos(null);
        setRechazadoDatos(null);
        setError(null);
        setPaso("servicio");
      }
      if (!exitoDatos && !pendienteDatos && !rechazadoDatos && items.length === 0) {
        // Carrito vacío sin pago en curso → asegurar paso inicial
        setPaso("servicio");
      }
    }, [exitoDatos, pendienteDatos, rechazadoDatos, items.length]),
  );

  // Técnicos disponibles cuando hay servicio con fecha/hora.
  useEffect(() => {
    if (!tipoActivo || !fechaServicio || !horaServicio) {
      return;
    }
    let activo = true;
    listarTecnicosPublicos({
      tipo_servicio: tipoActivo,
      fecha: fechaServicio,
      hora: horaServicio,
    })
      .then((lista) => activo && setTecnicosDisponibles(lista))
      .catch(() => {});
    return () => {
      activo = false;
    };
  }, [tipoActivo, fechaServicio, horaServicio]);

  useEffect(() => {
    if (!tipoActivo || !fechaServicio) {
      return;
    }
    let activo = true;
    const params = new URLSearchParams({ fecha: fechaServicio, tipo_servicio: tipoActivo });
    if (items.length) {
      params.set("items", JSON.stringify(items.map((item) => ({
        id_producto: item.id_producto,
        cantidad: item.venta_por_metros ? 1 : item.cantidad,
        ...(item.venta_por_metros ? { metros: (item.metros || 0) * item.cantidad } : {}),
      }))));
    }
    apiFetch<string[]>(`/citas/horas-disponibles?${params.toString()}`)
      .then((horas) => activo && setHorasDisponibles(Array.isArray(horas) ? horas : []))
      .catch(() => activo && setHorasDisponibles([]))
      .finally(() => activo && setCargandoHoras(false));
    return () => { activo = false; };
  }, [tipoActivo, fechaServicio, items]);

  useEffect(() => {
    if (!items.length) {
      return;
    }
    let activo = true;
    apiFetch<RecomendacionTecnicos>("/pedidos/recomendacion-tecnicos", {
      method: "POST",
      body: JSON.stringify({
        items: items.map((item) => ({
          id_producto: item.id_producto,
          cantidad: item.venta_por_metros ? 1 : item.cantidad,
          ...(item.venta_por_metros ? { metros: (item.metros || 0) * item.cantidad } : {}),
        })),
        fecha: tipoActivo === "instalacion" ? fechaServicio || undefined : undefined,
        hora: tipoActivo === "instalacion" ? horaServicio || undefined : undefined,
      }),
    }).then((resultado) => {
      if (activo) setRecomendacion(resultado);
    }).catch(() => {
      if (activo) setRecomendacion(null);
    });
    return () => { activo = false; };
  }, [items, tipoActivo, fechaServicio, horaServicio]);

  const agregarServicio = () => {
    if (!tipoActivo || !fechaServicio || !horaServicio) return;

    // La web permite reservar desde hoy si el horario tiene 3 horas de anticipación.
    const fechaHora = new Date(`${fechaServicio}T${horaServicio}:00`);
    if (Number.isNaN(fechaHora.getTime()) || fechaHora < new Date(Date.now() + 3 * 60 * 60 * 1000)) {
      setError("Selecciona un horario con al menos 3 horas de anticipación.");
      return;
    }
    if (!horasDisponibles.includes(horaServicio)) {
      setError("Ese horario ya no está disponible. Selecciona otra hora.");
      return;
    }
    if (modoAsignacion === "lista" && tecnicosSeleccionados.length !== (tipoActivo === "instalacion" ? tecnicosNecesarios : 1)) {
      setError(`Selecciona ${tipoActivo === "instalacion" ? tecnicosNecesarios : 1} técnico(s) o usa la asignación automática.`);
      return;
    }

    const def = SERVICIOS.find((s) => s.tipo === tipoActivo)!;
    setServiciosElegidos((prev) => [
      ...prev,
      {
        tipo: tipoActivo,
        nombre: def.nombre,
        precio: def.precio,
        fecha: fechaServicio,
        hora: horaServicio,
        ...(modoAsignacion === "lista" && tecnicosSeleccionados[0] ? { id_tecnico: tecnicosSeleccionados[0] } : {}),
        ...(modoAsignacion === "lista" && tecnicosSeleccionados[1] ? { id_tecnico_2: tecnicosSeleccionados[1] } : {}),
        ...(modoAsignacion === "lista" && tecnicosSeleccionados[2] ? { id_tecnico_3: tecnicosSeleccionados[2] } : {}),
      },
    ]);
    setTipoActivo(null);
    setFechaServicio("");
    setHoraServicio("");
    setTecnicosSeleccionados([]);
    setModoAsignacion("auto");
    setError(null);
  };

  const datosPagoValidos = (): Record<string, unknown> | null => {
    // El backend exige `pago.metodo` (DatosPago.metodo): sin este campo
    // POST /pedidos responde 422 "Field required".
    switch (metodoPago) {
      case "tarjeta_debito":
      case "tarjeta_credito":
        if (
          numeroTarjeta.replace(/\s/g, "").length < 15 ||
          !titular.trim() ||
          !expiracion ||
          cvv.length < 3
        ) {
          setError("Completa los datos de la tarjeta.");
          return null;
        }
        if (!simulacion) {
          setError("Selecciona el resultado de simulación.");
          return null;
        }
        return {
          metodo: metodoPago,
          numero: numeroTarjeta.replace(/\s/g, ""),
          titular: titular.trim(),
          expiracion,
          cvv,
          cuotas: Number(cuotas) || 1,
          resultado_simulacion: simulacion,
        };
      case "pse":
        if (!banco) {
          setError("Selecciona un banco para pagar por PSE.");
          return null;
        }
        if (!titular.trim()) {
          setError("Ingresa el titular de la cuenta.");
          return null;
        }
        if (!simulacion) {
          setError("Selecciona el resultado de simulación.");
          return null;
        }
        return {
          metodo: metodoPago,
          banco,
          titular: titular.trim(),
          resultado_simulacion: simulacion,
        };
      case "paypal":
        if (!correoPaypal.trim()) {
          setError("Ingresa el correo de tu cuenta PayPal.");
          return null;
        }
        if (!simulacion) {
          setError("Selecciona el resultado de simulación.");
          return null;
        }
        return {
          metodo: metodoPago,
          correo_paypal: correoPaypal.trim(),
          resultado_simulacion: simulacion,
        };
      case "punto_pago":
        if (!puntoPago) {
          setError("Selecciona el punto de pago (Efecty, Servientrega u otro).");
          return null;
        }
        return { metodo: metodoPago, punto_pago: puntoPago, resultado_simulacion: simulacion || "pendiente" };
      default:
        setError("Selecciona un método de pago.");
        return null;
    }
  };

  const pagar = async () => {
    setError(null);
    const pago = datosPagoValidos();
    if (!pago) return;

    setProcesando(true);
    try {
      const respuesta = await crearPedido({
        items: items.map((item) => ({
          id_producto: item.id_producto,
          cantidad: item.cantidad,
          ...(item.metros ? { metros: item.metros } : {}),
          ...(item.color ? { color: item.color } : {}),
          ...(item.tamaño ? { tamaño: item.tamaño } : {}),
          ...(item.id_variante ? { id_variante: item.id_variante } : {}),
        })),
        servicios: serviciosElegidos.map((s) => ({
          nombre: s.nombre,
          tipo_servicio: s.tipo,
          precio: s.precio,
          fecha: s.fecha,
          hora: s.hora,
          ...(s.id_tecnico ? { id_tecnico: s.id_tecnico } : {}),
          ...(s.id_tecnico_2 ? { id_tecnico_2: s.id_tecnico_2 } : {}),
          ...(s.id_tecnico_3 ? { id_tecnico_3: s.id_tecnico_3 } : {}),
        })),
        pago,
        ...(cuponCumpleCompraMinima && cuponAplicado ? { codigo_cupon: cuponAplicado.codigo } : {}),
      });

      if (respuesta.redirect_url) {
        Linking.openURL(respuesta.redirect_url).catch(() => {});
        return;
      }

      const estado = respuesta.pago?.estado;
      if (estado === "aprobado") {
        clearCart();
        setExitoDatos({
          id_pedido: respuesta.pedido?.id_pedido,
          numero_factura: respuesta.factura?.numero_factura,
          pdf_url: respuesta.pdf_url,
          numero_transaccion: respuesta.pago?.numero_transaccion,
        });
        setRechazadoDatos(null);
        setPendienteDatos(null);
      } else if (estado === "pendiente") {
        setPendienteDatos({
          id_pedido: respuesta.pedido?.id_pedido,
          codigo_punto_pago: respuesta.pago?.codigo_punto_pago,
          referencia_pago: respuesta.pago?.referencia_pago,
          fecha_limite: respuesta.pago?.fecha_limite,
        });
        setRechazadoDatos(null);
      } else {
        setRechazadoDatos({ id_pedido: respuesta.pedido?.id_pedido });
        setError(null);
      }
    } catch (e) {
      setError(
        e instanceof ApiError
          ? e.message
          : "No se pudo procesar el pedido. Intenta de nuevo.",
      );
    } finally {
      setProcesando(false);
    }
  };

  const confirmarPagoPendiente = async () => {
    if (!pendienteDatos?.id_pedido) return;
    setProcesando(true);
    try {
      await import("@/services/cliente.services").then((m) =>
        m.confirmarPagoPedido(pendienteDatos.id_pedido!),
      );
      clearCart();
      setPendienteDatos(null);
      setError(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "No se pudo confirmar el pago.");
    } finally {
      setProcesando(false);
    }
  };

  const descargarPdfExito = async () => {
    if (!exitoDatos?.pdf_url) {
      setError("La factura aún no está disponible. Intenta de nuevo en unos segundos.");
      return;
    }
    try {
      const { obtenerSesion } = await import("@/services/storage");
      const sesion = await obtenerSesion();
      if (__DEV__) console.log("[checkout] Descargando PDF", exitoDatos.pdf_url);
      await descargarFacturaPdf(exitoDatos.pdf_url, sesion?.accessToken ?? "");
    } catch (e: any) {
      console.log("[checkout] Error descargando PDF", e);
      setError(e?.message || "No se pudo descargar la factura. Verifica tu conexión.");
    }
  };

  // ── Gate visitante / no cliente ─────────────────────────────
  if (!autenticado || userType !== "client") {
    return (
      <AppScreen titulo="Finalizar compra">
        <Text style={S.gateTitulo}>Inicia sesión para continuar</Text>
        <Text style={S.gateTexto}>
          Para finalizar tu compra necesitas una cuenta de cliente Neodomus.
        </Text>
        <Pressable
          style={({ pressed }) => [S.botonOro, pressed && S.presionado]}
          onPress={() => router.push("/login")}
        >
          <Text style={S.textoBotonOro}>Iniciar sesión</Text>
        </Pressable>
        <Pressable
          style={({ pressed }) => [S.botonOutline, pressed && S.presionado]}
          onPress={() => router.push("/registro")}
        >
          <Text style={S.textoOutline}>Crear cuenta</Text>
        </Pressable>
      </AppScreen>
    );
  }

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
    <AppScreen titulo="Finalizar compra">
      {/* Dirección (solo lectura desde perfil, como la web) */}
      <View style={S.tarjeta}>
        <Text style={S.subtitulo}>Dirección de entrega/servicio</Text>
        <Text style={S.texto}>{direccionPerfil || "—"}</Text>
        {!direccionPerfil && (
          <Text style={S.avisoAmarillo}>
            Agrega tu dirección en tu perfil para poder coordinar la entrega.
          </Text>
        )}
      </View>

      {/* Resumen de productos */}
      <View style={S.tarjeta}>
        <Text style={S.subtitulo}>Productos</Text>
        {items.map((item) => (
          <View key={`${item.id_producto}-${item.color ?? ""}-${item.medida ?? item.tamaño ?? ""}`} style={S.fila}>
            <Text style={S.texto} numberOfLines={2}>
              {item.nombre_producto} × {item.metros ? `${item.metros} m` : item.cantidad}
              {item.color ? ` (${item.color})` : ""}
            </Text>
            <Text style={S.gris}>
              ${Math.round(item.precio_venta_producto * (item.metros || item.cantidad)).toLocaleString("es-CO")}
            </Text>
          </View>
        ))}
      </View>

      {/* Servicio técnico opcional */}
      {paso === "servicio" && (
        <View style={S.tarjeta}>
          <Text style={S.subtitulo}>¿Deseas agregar servicio técnico?</Text>
          <Text style={S.gris}>
            Opcional. Selecciona una fecha y un horario disponible de lunes a sábado.
          </Text>

          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
            {SERVICIOS.map((s) => (
              <Pressable
                key={s.tipo}
                onPress={() => {
                  setTipoActivo(s.tipo);
                  setHorasDisponibles([]);
                  setTecnicosDisponibles([]);
                  setCargandoHoras(false);
                  setFechaServicio("");
                  setHoraServicio("");
                  setTecnicosSeleccionados([]);
                  setModoAsignacion("auto");
                }}
                style={[S.chip, tipoActivo === s.tipo && S.chipActivo]}
              >
                <Text style={[S.chipTexto, tipoActivo === s.tipo && S.chipTextoActivo]}>
                  {s.nombre} · ${s.precio.toLocaleString("es-CO")}
                </Text>
              </Pressable>
            ))}
          </View>

          {tipoActivo && (
            <View style={{ gap: 8 }}>
              <CalendarioMes
                valor={fechaServicio}
                onChange={(fecha) => {
                  setFechaServicio(fecha);
                  setHorasDisponibles([]);
                  setTecnicosDisponibles([]);
                  setCargandoHoras(true);
                  setHoraServicio("");
                  setTecnicosSeleccionados([]);
                }}
                minFecha={hoyLocal()}
              />
              {cargandoHoras ? <Text style={S.gris}>Buscando horarios disponibles...</Text> : null}
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {horasDisponibles.map((h) => (
                  <Pressable
                    key={h}
                    onPress={() => {
                      setHoraServicio(h);
                      setTecnicosDisponibles([]);
                      setTecnicosSeleccionados([]);
                    }}
                    style={[S.chip, horaServicio === h && S.chipActivo]}
                  >
                    <Text style={[S.chipTexto, horaServicio === h && S.chipTextoActivo]}>{h}</Text>
                  </Pressable>
                ))}
              </View>

              {!cargandoHoras && fechaServicio && horasDisponibles.length === 0 ? (
                <Text style={S.avisoAmarillo}>No hay horarios disponibles para esta fecha.</Text>
              ) : null}

              {tipoActivo === "instalacion" ? (
                <View style={S.recomendacion}>
                  <Text style={S.recomendacionTitulo}>
                    {`Esta instalación requiere ${tecnicosNecesarios} técnico${tecnicosNecesarios === 1 ? "" : "s"}`}
                    {recomendacionActiva?.horas_por_tecnico ? ` · ${recomendacionActiva.horas_por_tecnico} h por técnico` : ""}
                  </Text>
                  {recomendacionActiva?.especializaciones_requeridas?.length ? (
                    <Text style={S.gris}>Especialidades: {recomendacionActiva.especializaciones_requeridas.map((x) => x.nombre).join(", ")}</Text>
                  ) : null}
                </View>
              ) : null}

              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 7 }}>
                {(["auto", "lista"] as const).map((modo) => (
                  <Pressable key={modo} onPress={() => setModoAsignacion(modo)} style={[S.chip, modoAsignacion === modo && S.chipActivo]}>
                    <Text style={[S.chipTexto, modoAsignacion === modo && S.chipTextoActivo]}>
                      {modo === "auto"
                        ? tipoActivo === "instalacion" && tecnicosNecesarios > 1
                          ? `Asignar ${tecnicosNecesarios} técnicos automáticamente`
                          : "Asignación automática"
                        : "Elegir técnicos"}
                    </Text>
                  </Pressable>
                ))}
              </View>

              {modoAsignacion === "lista" && (
                <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                  {tecnicosElegibles.map((tecnico) => {
                      const seleccionado = tecnicosSeleccionados.includes(tecnico.id_tecnico);
                      return (
                        <Pressable
                          key={tecnico.id_tecnico}
                          onPress={() => setTecnicosSeleccionados((prev) => seleccionado
                            ? prev.filter((id) => id !== tecnico.id_tecnico)
                            : prev.length < (tipoActivo === "instalacion" ? tecnicosNecesarios : 1)
                              ? [...prev, tecnico.id_tecnico]
                              : prev)}
                          style={[S.chip, seleccionado && S.chipActivo]}
                        >
                          <Text style={[S.chipTexto, seleccionado && S.chipTextoActivo]}>
                            {tecnico.first_name} {tecnico.last_name}{tecnico.calificacion ? ` · ★ ${Number(tecnico.calificacion).toFixed(1)}` : ""}
                          </Text>
                        </Pressable>
                      );
                    })}
                  <Text style={S.gris}>
                    {tecnicosSeleccionados.length}/{tipoActivo === "instalacion" ? tecnicosNecesarios : 1} seleccionados
                  </Text>
                  {tecnicosElegibles.length === 0 ? (
                    <Text style={S.avisoAmarillo}>No hay técnicos sugeridos y disponibles para ese horario. Prueba otro o usa la asignación automática.</Text>
                  ) : null}
                </View>
              )}

              <Pressable
                style={({ pressed }) => [S.botonOutline, pressed && S.presionado]}
                onPress={agregarServicio}
              >
                <Text style={S.textoOutline}>Agregar este servicio</Text>
              </Pressable>
            </View>
          )}

          {serviciosElegidos.length > 0 && (
            <View style={{ gap: 5 }}>
              {serviciosElegidos.map((s, i) => (
                <View key={`${s.tipo}-${i}`} style={S.fila}>
                  <Text style={S.texto} numberOfLines={1}>
                    {s.nombre} · {s.fecha} {s.hora}
                  </Text>
                  <Pressable
                    hitSlop={6}
                    onPress={() =>
                      setServiciosElegidos((prev) => prev.filter((_, idx) => idx !== i))
                    }
                  >
                    <FontAwesome6 name="trash-can" size={12} color="#f0858a" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>
      )}

      {/* Método de pago — tarjetas visuales estilo WEB */}
      {paso === "pago" && (
        <View style={S.tarjeta}>
          <Text style={S.subtitulo}>Selecciona tu método de pago</Text>
          <Text style={S.avisoAmarillo}>
            Modo de prueba: pagos simulados (no se realizan cobros reales).
          </Text>
          <PaymentMethodCards
            metodos={
              metodosPagoInfo
                ? Object.keys(metodosPagoInfo.metodos)
                : ["tarjeta_credito", "pse", "paypal", "punto_pago", "tarjeta_debito"]
            }
            seleccionado={metodoPago}
            onSelect={(m) => {
              setMetodoPago(m);
              setSimulacion("");
            }}
          />

          <View style={S.cuponCard}>
            <Text style={S.subtitulo}>Cupón de descuento</Text>
            {cuponCumpleCompraMinima && cuponAplicado ? (
              <View style={S.fila}>
                <Text style={S.gris}>{cuponAplicado.codigo} · Ahorro ${descuentoCupon.toLocaleString("es-CO")} COP</Text>
                <Pressable onPress={() => { setCuponAplicado(null); setCodigoCupon(""); setMensajeCupon(""); }}>
                  <Text style={S.quitarCupon}>Quitar</Text>
                </Pressable>
              </View>
            ) : (
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput
                  style={[inputEstilo, { flex: 1 }]}
                  placeholder="Ingresa tu código"
                  placeholderTextColor="#8a8a8a"
                  autoCapitalize="characters"
                  value={codigoCupon}
                  onChangeText={setCodigoCupon}
                />
                <Pressable disabled={validandoCupon} onPress={() => void aplicarCupon()} style={[S.botonOro, validandoCupon && S.deshabilitado]}>
                  <Text style={S.textoBotonOro}>{validandoCupon ? "Validando..." : "Aplicar"}</Text>
                </Pressable>
              </View>
            )}
            {mensajeCupon ? <Text style={cuponAplicado ? S.cuponOk : S.error}>{mensajeCupon}</Text> : null}
            {cuponesDisponibles.length > 0 && !cuponCumpleCompraMinima ? (
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6 }}>
                {cuponesDisponibles.map((cupon) => (
                  <Pressable key={cupon.id_cupon} onPress={() => { setCodigoCupon(cupon.codigo); void aplicarCupon(cupon.codigo); }} style={S.chip}>
                    <Text style={S.chipTexto}>{cupon.codigo}</Text>
                  </Pressable>
                ))}
              </View>
            ) : null}
          </View>

          {(metodoPago === "tarjeta_debito" || metodoPago === "tarjeta_credito") && (
            <View style={{ gap: 10, marginTop: 6 }}>
              <TextInput style={inputEstilo} placeholder="Número de tarjeta (4242 4242 4242 4242)" placeholderTextColor="#8a8a8a" keyboardType="number-pad" value={numeroTarjeta} onChangeText={setNumeroTarjeta} />
              <TextInput style={inputEstilo} placeholder="Titular de la tarjeta" placeholderTextColor="#8a8a8a" value={titular} onChangeText={setTitular} autoCapitalize="words" />
              <View style={{ flexDirection: "row", gap: 8 }}>
                <TextInput style={[inputEstilo, { flex: 1 }]} placeholder="MM/AA" placeholderTextColor="#8a8a8a" value={expiracion} onChangeText={(v) => setExpiracion(v.slice(0, 5))} maxLength={5} />
                <TextInput style={[inputEstilo, { flex: 1 }]} placeholder="CVV" placeholderTextColor="#8a8a8a" secureTextEntry keyboardType="number-pad" value={cvv} onChangeText={(v) => setCvv(v.replace(/\D/g, "").slice(0, 4))} maxLength={4} />
              </View>
              <Dropdown
                label="Número de cuotas"
                value={cuotas}
                placeholder="Seleccionar cuotas"
                options={[
                  { label: "1 cuota", value: "1" },
                  { label: "3 cuotas", value: "3" },
                  { label: "6 cuotas", value: "6" },
                  { label: "12 cuotas", value: "12" },
                ]}
                onChange={setCuotas}
              />
              <Dropdown
                label="Resultado de simulación"
                value={simulacion}
                placeholder="Seleccionar resultado"
                options={[
                  { label: "Aprobado", value: "aprobado" },
                  { label: "Rechazado", value: "rechazado" },
                ]}
                onChange={setSimulacion}
              />
              <Text style={S.gris}>Prueba: 4242 4242 4242 4242 (aprobada) · 4242 4242 4242 0001 (rechazada)</Text>
            </View>
          )}

          {metodoPago === "pse" && (
            <View style={{ gap: 10, marginTop: 6 }}>
              <Dropdown
                label="Resultado de simulación"
                value={simulacion}
                placeholder="Seleccionar resultado"
                options={[
                  { label: "Aprobado", value: "aprobado" },
                  { label: "Rechazado", value: "rechazado" },
                  { label: "Pendiente", value: "pendiente" },
                ]}
                onChange={setSimulacion}
              />
              <Dropdown
                label="Selecciona tu banco"
                value={banco}
                placeholder="Seleccionar banco"
                options={(metodosPagoInfo?.bancos?.length ? metodosPagoInfo.bancos : ["Bancolombia", "Banco de Bogotá", "Banco Davivienda", "BBVA Colombia", "Banco de Occidente", "Banco Popular", "Itaú Colombia", "Banco Caja Social", "Scotiabank Colpatria", "Banco Agrario", "Nequi", "Daviplata"]).map((b) => ({ label: b, value: b }))}
                onChange={setBanco}
              />
              <View style={{ gap: 6 }}>
                <Text style={S.label}>Titular de la cuenta</Text>
                <TextInput style={inputEstilo} placeholder="Nombre del titular" placeholderTextColor="#8a8a8a" value={titular} onChangeText={setTitular} autoCapitalize="words" />
              </View>
            </View>
          )}

          {metodoPago === "paypal" && (
            <View style={{ gap: 10, marginTop: 6 }}>
              <TextInput style={inputEstilo} placeholder="Correo de PayPal" placeholderTextColor="#8a8a8a" autoCapitalize="none" keyboardType="email-address" value={correoPaypal} onChangeText={setCorreoPaypal} />
              <Dropdown
                label="Resultado de simulación"
                value={simulacion}
                placeholder="Seleccionar resultado"
                options={[
                  { label: "Aprobado", value: "aprobado" },
                  { label: "Rechazado", value: "rechazado" },
                ]}
                onChange={setSimulacion}
              />
            </View>
          )}

          {metodoPago === "punto_pago" && (
            <View style={{ gap: 10, marginTop: 6 }}>
              <Dropdown
                label="Punto de pago"
                value={puntoPago}
                placeholder="Seleccionar punto"
                options={[
                  { label: "Efecty", value: "Efecty" },
                  { label: "Servientrega", value: "Servientrega" },
                  { label: "Otro punto de pago", value: "Otro punto de pago" },
                ]}
                onChange={setPuntoPago}
              />
              <Text style={S.gris}>Al confirmar se generará referencia y código para pagar en el punto físico. Quedará pendiente hasta confirmar.</Text>
            </View>
          )}
        </View>
      )}

      {error && <Text style={S.error}>{error}</Text>}

      {/* Navegación de pasos + pagar */}
      {!exitoDatos && !pendienteDatos && (
        <>
          <View style={{ flexDirection: "row", gap: 10 }}>
            {paso === "pago" && (
              <Pressable
                style={({ pressed }) => [S.botonOutline, { flex: 1 }, pressed && S.presionado]}
                onPress={() => setPaso("servicio")}
              >
                <Text style={S.textoOutline}>← Atrás</Text>
              </Pressable>
            )}
            <Pressable
              style={({ pressed }) => [
                S.botonOro,
                { flex: 2 },
                pressed && S.presionado,
                procesando && S.deshabilitado,
              ]}
              onPress={() => {
                setError(null);
                if (paso === "servicio") setPaso("pago");
                else void pagar();
              }}
              disabled={procesando}
            >
              <Text style={S.textoBotonOro}>
                {procesando
                  ? "Procesando..."
                  : paso === "servicio"
                    ? "Continuar al pago"
                    : `Pagar $${Math.round(totalGeneral).toLocaleString("es-CO")} COP`}
              </Text>
            </Pressable>
          </View>
          <Text style={S.totalLinea}>
            Productos: ${Math.round(totalPrice).toLocaleString("es-CO")} COP · Servicios: $
            {Math.round(totalServicios).toLocaleString("es-CO")} COP{descuentoCupon > 0 ? ` · Descuento: -$${descuentoCupon.toLocaleString("es-CO")} COP` : ""} · Total: $
            {Math.round(totalGeneral).toLocaleString("es-CO")} COP
          </Text>
        </>
      )}

      {/* PENDIENTE (punto de pago / PSE pendiente) */}
      {pendienteDatos && (
        <View style={S.tarjeta}>
          <FontAwesome6 name="clock" size={20} color="#f6c344" />
          <Text style={S.subtitulo}>Pago pendiente</Text>
          <Text style={S.gris}>
            Tu pago está siendo procesado. Te notificaremos cuando se confirme.
          </Text>
          {pendienteDatos.codigo_punto_pago && (
            <Text style={S.texto}>Código: {pendienteDatos.codigo_punto_pago}</Text>
          )}
          {pendienteDatos.referencia_pago && (
            <Text style={S.gris}>Referencia: {pendienteDatos.referencia_pago}</Text>
          )}
          {pendienteDatos.fecha_limite && (
            <Text style={S.gris}>Límite: {pendienteDatos.fecha_limite.slice(0, 10)}</Text>
          )}
          <Pressable
            style={({ pressed }) => [
              S.botonOro,
              pressed && S.presionado,
              procesando && S.deshabilitado,
            ]}
            onPress={() => void confirmarPagoPendiente()}
            disabled={procesando}
          >
            <Text style={S.textoBotonOro}>
              {procesando ? "Confirmando..." : "Confirmar pago"}
            </Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [S.botonOutline, pressed && S.presionado]}
            onPress={() => {
              setPendienteDatos(null);
              setRechazadoDatos(null);
            }}
          >
            <Text style={S.textoOutline}>Seguir comprando</Text>
          </Pressable>
        </View>
      )}

      {/* RECHAZADO */}
      {rechazadoDatos && (
        <View style={S.tarjeta}>
          <FontAwesome6 name="circle-xmark" size={20} color="#f0858a" />
          <Text style={S.subtitulo}>Pago rechazado</Text>
          <Text style={S.gris}>No fue posible procesar tu pago. Revisa los datos e inténtalo de nuevo.</Text>
          <Pressable
            style={({ pressed }) => [S.botonOro, pressed && S.presionado]}
            onPress={() => setRechazadoDatos(null)}
          >
            <Text style={S.textoBotonOro}>Intentar nuevamente</Text>
          </Pressable>
          <Pressable
            style={({ pressed }) => [S.botonOutline, pressed && S.presionado]}
            onPress={() => {
              setRechazadoDatos(null);
              setPendienteDatos(null);
              setExitoDatos(null);
              router.replace("/(tabs)/productos");
            }}
          >
            <Text style={S.textoOutline}>Seguir viendo productos</Text>
          </Pressable>
        </View>
      )}

      {/* ÉXITO — modal Neodomus centrado verticalmente (ligeramente
          por debajo del centro) con detalles + PDF real */}
      <Modal transparent visible={!!exitoDatos} animationType="fade">
        <View style={S.exitoOverlay}>
          <ScrollView
            contentContainerStyle={S.exitoContenido}
            showsVerticalScrollIndicator={false}
          >
            <View style={S.exitoTarjeta}>
              <Pressable
                style={S.cerrarX}
                onPress={() => setExitoDatos(null)}
                hitSlop={8}
                accessibilityLabel="Cerrar"
              >
                <FontAwesome6 name="xmark" size={14} color="#bdbdbd" />
              </Pressable>
              <FontAwesome6 name="circle-check" size={40} color="#7ee29a" />
              <Text style={S.exitoTitulo}>¡Pago exitoso!</Text>
              <Text style={S.exitoTexto}>
                Tu pedido fue registrado correctamente. La factura fue enviada a
                tu correo electrónico.
              </Text>

              {exitoDatos?.numero_factura && (
                <Text style={S.exitoDato}>Factura: {exitoDatos.numero_factura}</Text>
              )}
              {exitoDatos?.numero_transaccion && (
                <Text style={S.exitoDato}>
                  Transacción: {exitoDatos.numero_transaccion}
                </Text>
              )}
              {!!(exitoDatos as { ordenes_instalacion?: unknown[] })?.ordenes_instalacion
                ?.length && (
                <Text style={S.exitoDato}>Instalación agendada ✓</Text>
              )}

              <View style={{ alignSelf: "stretch", gap: 10, marginTop: 10 }}>
                {exitoDatos?.pdf_url && (
                  <Pressable
                    style={({ pressed }) => [S.botonOro, pressed && S.presionado]}
                    onPress={() => void descargarPdfExito()}
                  >
                    <FontAwesome6 name="file-pdf" size={14} color="#141414" />
                    <Text style={S.textoBotonOro}>Descargar factura PDF</Text>
                  </Pressable>
                )}
                <Pressable
                  style={({ pressed }) => [S.botonOutline, pressed && S.presionado]}
                  onPress={() => {
                    setExitoDatos(null);
                    setPaso("servicio");
                    router.replace("/(tabs)/productos");
                  }}
                >
                  <Text style={S.textoOutline}>Seguir viendo productos</Text>
                </Pressable>
              </View>
            </View>
          </ScrollView>
        </View>
      </Modal>

      <View style={{ height: insets.bottom }} />
    </AppScreen>
  );
}

const S = StyleSheet.create({
  gateTitulo: { color: "#ffffff", fontSize: 18, fontFamily: FontFamilies.bodyBold, textAlign: "center" },
  gateTexto: { color: "#bdbdbd", fontSize: 13.5, textAlign: "center", lineHeight: 20, marginBottom: 10 },
  botonOro: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    backgroundColor: "#caa24d",
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: 16,
  },
  textoBotonOro: { color: "#141414", fontFamily: FontFamilies.button, fontSize: 14 },
  botonOutline: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.45)",
    minHeight: 48,
    paddingHorizontal: 16,
  },
  textoOutline: { color: "#f0c96f", fontFamily: FontFamilies.button, fontSize: 13.5 },
  tarjeta: {
    backgroundColor: "#161616",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    padding: 14,
    gap: 9,
  },
  recomendacion: {
    gap: 5,
    padding: 11,
    borderRadius: 10,
    backgroundColor: "rgba(212,165,75,0.07)",
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.2)",
  },
  recomendacionTitulo: { color: "#f0c96f", fontSize: 12.5, fontFamily: FontFamilies.bodyBold },
  cuponCard: {
    gap: 9,
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.24)",
    backgroundColor: "rgba(212,165,75,0.05)",
  },
  cuponOk: { color: "#7ee29a", fontSize: 12 },
  quitarCupon: { color: "#f0858a", fontSize: 12, fontFamily: FontFamilies.bodyBold },
  subtitulo: { color: "#f0c96f", fontSize: 13.5, fontFamily: FontFamilies.bodyBold },
  label: { color: "#ffffff", fontSize: 13, fontFamily: FontFamilies.bodyMedium, marginTop: 4 },
  texto: { color: "#ffffff", fontSize: 13.5, flexShrink: 1 },
  fila: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: 10 },
  gris: { color: "#bdbdbd", fontSize: 12.5 },
  avisoAmarillo: { color: "#f6c344", fontSize: 12.5 },
  chip: { borderRadius: 999, borderWidth: 1, borderColor: "rgba(212,165,75,0.35)", paddingVertical: 7, paddingHorizontal: 12, backgroundColor: "rgba(212,165,75,0.06)" },
  chipActivo: { backgroundColor: "#caa24d", borderColor: "#caa24d" },
  chipTexto: { color: "#f0c96f", fontSize: 12.5, fontFamily: FontFamilies.bodyMedium },
  chipTextoActivo: { color: "#141414", fontFamily: FontFamilies.button },
  error: { color: "#f0858a", fontSize: 13, lineHeight: 19 },
  deshabilitado: { opacity: 0.55 },
  presionado: { opacity: 0.85 },
  totalLinea: { color: "#bdbdbd", fontSize: 12.5, textAlign: "center" },
  exitoOverlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.88)" },
  // flexGrow + justifyContent center: centrado vertical en pantallas
  // normales y scroll automático si el contenido no cabe. El paddingTop
  // extra lo baja un poco del centro exacto para un equilibrio visual.
  exitoContenido: {
    flexGrow: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 22,
    paddingTop: 96,
  },
  exitoTarjeta: {
    width: "100%",
    maxWidth: 420,
    backgroundColor: "#121212",
    borderRadius: 22,
    borderWidth: 1,
    borderColor: "rgba(126,226,154,0.4)",
    padding: 20,
    alignItems: "center",
    gap: 10,
  },
  cerrarX: {
    position: "absolute",
    top: 12,
    right: 12,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.09)",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1,
  },
  exitoTitulo: { color: "#ffffff", fontSize: 19, fontFamily: FontFamilies.bodyBold },
  exitoTexto: { color: "#bdbdbd", fontSize: 13, lineHeight: 19, textAlign: "center" },
  exitoDato: { color: "#f0c96f", fontSize: 13 },
});
