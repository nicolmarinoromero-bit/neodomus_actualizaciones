// ─────────────────────────────────────────────────────────────
// Calendario mensual — estructura por COLUMNAS uniformes:
//
//     L    M    X    J    V    S    D
//     3    4    5    6    7    8    9
//    10   11   12   13   14   15   16
//
// - Cada semana se renderiza como una FILA y cada día ocupa
//   exactamente 1/7 del ancho (flex: 1): nunca quedan amontonados.
// - Cada columna corresponde SIEMPRE al mismo día de la semana.
// - Lunes a sábado: estilo normal de disponible (texto blanco),
//   seleccionables si no son anteriores a `minFecha`.
// - Domingo: NO disponible (gris, no seleccionable);
//   también grises las fechas anteriores a `minFecha`.
// - Día seleccionado: fondo dorado con texto oscuro.
// ─────────────────────────────────────────────────────────────

import React, { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import FontAwesome6 from "@expo/vector-icons/FontAwesome6";

import { FontFamilies } from "@/constants/theme";

interface CalendarioMesProps {
  valor: string; // YYYY-MM-DD
  onChange: (valor: string) => void;
  /** Fecha mínima seleccionable (ISO); anteriores quedan deshabilitadas. */
  minFecha?: string;
}

const DIAS_SEMANA = ["L", "M", "X", "J", "V", "S", "D"];
const MESES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

interface Celda {
  dia: number;
  iso: string;
  /** Lunes a viernes y posterior a minFecha → seleccionable. */
  seleccionable: boolean;
  /** Fin de semana o fecha pasada → gris. */
  bloqueado: boolean;
}

export default function CalendarioMes({
  valor,
  onChange,
  minFecha,
}: CalendarioMesProps) {
  const hoy = new Date();
  const [mesVisible, setMesVisible] = useState(
    new Date(hoy.getFullYear(), hoy.getMonth(), 1),
  );

  const anio = mesVisible.getFullYear();
  const mes = mesVisible.getMonth();

  // Semanas del mes: cada semana es una lista de 7 celdas (L→D) o null
  // para los huecos previos al día 1. Así la columna N siempre es el
  // mismo día de la semana y la distribución es perfectamente uniforme.
  const semanas = useMemo<(Celda | null)[][]>(() => {
    const primerDia = new Date(anio, mes, 1);
    // Lunes como primera columna (getDay(): 0 dom → 6 huecos).
    let offset = primerDia.getDay() - 1;
    if (offset < 0) offset = 6;
    const diasEnMes = new Date(anio, mes + 1, 0).getDate();

    const celdas: (Celda | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= diasEnMes; d++) {
      const fecha = new Date(anio, mes, d);
      const iso =
        `${fecha.getFullYear()}-` +
        `${String(fecha.getMonth() + 1).padStart(2, "0")}-` +
        `${String(d).padStart(2, "0")}`;
      const diaSemana = fecha.getDay(); // 0 dom · 6 sáb
      const esDomingo = diaSemana === 0;
      const esPasada = !!minFecha && iso < minFecha;
      celdas.push({
        dia: d,
        iso,
        seleccionable: !esDomingo && !esPasada,
        bloqueado: esDomingo || esPasada,
      });
    }

    // Trocear en filas de 7 (semana incompleta final → rellenar con null).
    const filas: (Celda | null)[][] = [];
    for (let i = 0; i < celdas.length; i += 7) {
      const semana = celdas.slice(i, i + 7);
      while (semana.length < 7) semana.push(null);
      filas.push(semana);
    }
    return filas;
  }, [anio, mes, minFecha]);

  return (
    <View style={S.calendario}>
      {/* Cabecera: navegación de mes */}
      <View style={S.cabecera}>
        <Pressable onPress={() => setMesVisible(new Date(anio, mes - 1, 1))} hitSlop={8}>
          <FontAwesome6 name="chevron-left" size={13} color="#f0c96f" />
        </Pressable>
        <Text style={S.mesTexto}>
          {MESES[mes]} {anio}
        </Text>
        <Pressable onPress={() => setMesVisible(new Date(anio, mes + 1, 1))} hitSlop={8}>
          <FontAwesome6 name="chevron-right" size={13} color="#f0c96f" />
        </Pressable>
      </View>

      {/* Nombres de columna: L M X J V S D (mismo reparto que los días) */}
      <View style={S.fila}>
        {DIAS_SEMANA.map((d) => (
          <View key={d} style={S.celda}>
            <Text style={[S.diaTexto, S.diaNombre]}>{d}</Text>
          </View>
        ))}
      </View>

      {/* Filas de semanas */}
      {semanas.map((semana, f) => (
        <View key={`sem-${f}`} style={S.fila}>
          {semana.map((celda, i) =>
            celda === null ? (
              <View key={`v-${f}-${i}`} style={S.celda} />
            ) : (
              <Pressable
                key={celda.iso}
                disabled={!celda.seleccionable}
                onPress={() => onChange(celda.iso)}
                style={[
                  S.celda,
                  celda.iso === valor && S.celdaActiva,
                  celda.bloqueado && S.celdaBloqueada,
                ]}
              >
                <Text
                  style={[
                    S.diaTexto,
                    celda.bloqueado && S.diaBloqueado,
                    celda.iso === valor && S.diaActivo,
                  ]}
                >
                  {celda.dia}
                </Text>
              </Pressable>
            ),
          )}
        </View>
      ))}
    </View>
  );
}

const S = StyleSheet.create({
  calendario: {
    backgroundColor: "#0f0f0f",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "rgba(212,165,75,0.28)",
    padding: 10,
  },

  cabecera: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 4,
    paddingBottom: 8,
  },

  mesTexto: {
    color: "#ffffff",
    fontSize: 13.5,
    fontFamily: FontFamilies.bodyBold,
  },

  // Cada fila reparte 7 celdas iguales: columnas perfectamente alineadas.
  fila: {
    flexDirection: "row",
    width: "100%",
  },

  celda: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 7,
  },

  diaTexto: {
    color: "#ffffff",
    fontSize: 12.5,
    fontFamily: FontFamilies.bodyMedium,
    textAlign: "center",
  },

  diaNombre: {
    color: "#f0c96f",
    fontFamily: FontFamilies.bodyBold,
  },

  celdaActiva: {
    backgroundColor: "#caa24d",
    borderRadius: 10,
  },

  diaActivo: { color: "#141414", fontWeight: "700" as const },

  // Solo domingo (y fechas pasadas) se muestran en gris. Sábado es laborable.
  celdaBloqueada: { opacity: 0.35 },

  diaBloqueado: { color: "#6b6b6b" },
});
