// ─────────────────────────────────────────────────────────────
// Hook: scroll al inicio cuando la sección GANA foco viniendo de
// OTRA sección (cambio de tab), sin resetear mientras el usuario
// navega dentro de la misma pestaña (pop de detalle → conserva
// posición).
//
// Criterio: si el stack propio de esta tab solo contiene la ruta
// raíz (routes.length <= 1), el foco viene de un cambio de tab o
// de la apertura inicial → scroll a y=0. Si hay pantallas hijas
// apiladas, es un regreso (atrás) → NO tocamos el scroll.
// ─────────────────────────────────────────────────────────────

import { useCallback } from "react";
import { useFocusEffect, useNavigation } from "expo-router";

export function useScrollTopAlEntrar(ref: { current: unknown }) {
  const navigation = useNavigation();

  useFocusEffect(
    useCallback(() => {
      const state = navigation.getState();
      const esEntradaDeSeccion = !state || state.routes.length <= 1;

      if (esEntradaDeSeccion) {
        // Al siguiente frame: la lista ya está medida.
        requestAnimationFrame(() => {
          const componente = ref.current as
            | { scrollTo?: (o: { y: number; animated?: boolean }) => void }
            | null;
          if (componente && typeof componente.scrollTo === "function") {
            componente.scrollTo({ y: 0, animated: false });
          }
        });
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [navigation]),
  );
}
