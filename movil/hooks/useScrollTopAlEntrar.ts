// ─────────────────────────────────────────────────────────────
// Hook: scroll al inicio cuando la sección GANA foco.
//
// Cada vez que el usuario entra a una pantalla/tab diferente,
// esa pantalla debe empezar desde ARRIBA (y=0).
// - Tab switch: Inicio → Productos → Carrito → etc. → siempre arriba.
// - Montaje inicial: también arriba.
// - No interfiere con el scroll normal dentro de la misma pantalla.
//
// Soporte universal: ScrollView (scrollTo) y FlatList (scrollToOffset).
// Doble rAF asegura que la lista ya está medida después del layout.
// ─────────────────────────────────────────────────────────────

import { useCallback } from "react";
import { useFocusEffect } from "expo-router";

export function useScrollTopAlEntrar(ref: { current: unknown }) {
  useFocusEffect(
    useCallback(() => {
      const intentarScroll = () => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => {
            const componente: any = ref.current;
            if (!componente) return;
            // 1) FlatList → scrollToOffset
            if (typeof componente.scrollToOffset === "function") {
              try {
                componente.scrollToOffset({ offset: 0, animated: false });
                return;
              } catch {}
            }
            // 2) ScrollView → scrollTo (soporta ambas firmas)
            if (typeof componente.scrollTo === "function") {
              try {
                componente.scrollTo({ y: 0, animated: false });
              } catch {}
              try {
                componente.scrollTo({ x: 0, y: 0, animated: false });
              } catch {}
              return;
            }
            // 3) Ref nativo expuesto (getNativeScrollRef) — FlatList envuelta
            if (typeof componente.getNativeScrollRef === "function") {
              try {
                const nativo = componente.getNativeScrollRef();
                if (nativo?.scrollTo) nativo.scrollTo({ y: 0, animated: false });
                else if (nativo?.scrollToOffset) nativo.scrollToOffset({ offset: 0, animated: false });
              } catch {}
            }
          });
        });
      };

      intentarScroll();
    }, []),
  );
}
