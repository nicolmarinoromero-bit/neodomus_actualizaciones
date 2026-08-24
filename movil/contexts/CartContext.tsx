// ─────────────────────────────────────────────────────────────
// Carrito — réplica del CartContext de la WEB (contexts/CartContext.tsx).
//
// - Persistencia en 'neodomus_carrito' (misma clave que la web, aquí AsyncStorage).
// - Clave de línea para dedupe: id + color + medida/tamaño (igual que web).
// - Venta por metros: acumula metros con cantidad fija 1.
// - Al cerrar sesión el carrito se vacía (igual que la web, transición
//   autenticado → visitante detectada con ref).
// ─────────────────────────────────────────────────────────────

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import AsyncStorage from "@react-native-async-storage/async-storage";

import type { Producto } from "@/services/productos.service";
import { urlImagenProducto } from "@/services/productos.service";
import { useAuth } from "./AuthContext";

const CLAVE_CARRITO = "neodomus_carrito";

export interface ItemCarrito {
  id_producto: number;
  nombre_producto: string;
  precio_venta_producto: number;
  imagen: string | null;
  cantidad: number;
  color?: string;
  tamaño?: string;
  medida?: string;
  id_variante?: number;
  venta_por_metros?: boolean;
  metros?: number;
  tecnicos_requeridos?: number;
}

export const claveItemCarrito = (
  item: Pick<ItemCarrito, "id_producto" | "color" | "medida" | "tamaño">,
): string =>
  [item.id_producto, item.color?.toLowerCase(), (item.medida || item.tamaño || "").toLowerCase()]
    .filter(Boolean)
    .join("-");

interface CarritoContextValue {
  items: ItemCarrito[];
  totalItems: number;
  totalPrice: number;
  addItem: (
    producto: Producto,
    opciones?: { cantidad?: number; metros?: number; color?: string; tamaño?: string; medida?: string; id_variante?: number },
  ) => void;
  updateQuantity: (clave: string, cantidad: number) => void;
  updateMetros: (clave: string, metros: number) => void;
  removeItem: (clave: string) => void;
  clearCart: () => void;
}

const CarritoContext = createContext<CarritoContextValue | null>(null);

function cargarItemsGuardados(): ItemCarrito[] {
  return [];
}

export function CarritoProvider({ children }: { children: React.ReactNode }) {
  const { autenticado } = useAuth();
  const [items, setItems] = useState<ItemCarrito[]>(cargarItemsGuardados);
  const [listo, setListo] = useState(false);
  const estabaAutenticado = useRef(autenticado);

  // Cargar carrito guardado una sola vez.
  useEffect(() => {
    let activo = true;
    AsyncStorage.getItem(CLAVE_CARRITO)
      .then((crudo) => {
        if (!activo || !crudo) return;
        try {
          const datos: unknown = JSON.parse(crudo);
          if (Array.isArray(datos)) setItems(datos as ItemCarrito[]);
        } catch {
          // JSON corrupto → se empieza con carrito vacío.
        }
      })
      .finally(() => {
        if (activo) setListo(true);
      });
    return () => {
      activo = false;
    };
  }, []);

  // Persistir en cada cambio (una vez cargado el inicial).
  useEffect(() => {
    if (!listo) return;
    AsyncStorage.setItem(CLAVE_CARRITO, JSON.stringify(items)).catch(() => {});
  }, [items, listo]);

  // Cerrar sesión vacía el carrito (comportamiento de la WEB).
  useEffect(() => {
    if (estabaAutenticado.current && !autenticado) {
      setItems([]);
    }
    estabaAutenticado.current = autenticado;
  }, [autenticado]);

  const addItem = useCallback<CarritoContextValue["addItem"]>(
    (producto, opciones = {}) => {
      const {
        cantidad = 1,
        metros,
        color,
        tamaño,
        medida,
        id_variante,
      } = opciones;

      setItems((prev) => {
        const esMetros = !!producto.venta_por_metros;
        const nuevaCantidad = esMetros ? 1 : Math.max(1, cantidad);
        const nuevosMetros = esMetros ? Math.max(0.1, metros ?? 10) : undefined;

        const claveNueva = claveItemCarrito({
          id_producto: producto.id_producto,
          color,
          medida,
          tamaño,
        });

        const existente = prev.find(
          (item) =>
            claveItemCarrito(item) === claveNueva && item.id_variante === id_variante,
        );

        if (existente) {
          return prev.map((item) =>
            item === existente
              ? {
                  ...item,
                  // Ya está en el carrito → AUMENTAR cantidad, no duplicar línea.
                  cantidad:
                    esMetros
                      ? 1
                      : Math.max(1, (item.cantidad ?? 0) + nuevaCantidad),
                  metros: esMetros
                    ? (item.metros ?? 0) + (nuevosMetros ?? 0)
                    : item.metros,
                }
              : item,
          );
        }

        return [
          ...prev,
          {
            id_producto: producto.id_producto,
            nombre_producto: producto.nombre_producto,
            precio_venta_producto:
              producto.precio_final ?? producto.precio_venta_producto,
            // MISMA resolución que Productos (convención /uploads/{id}.jpg).
            imagen: urlImagenProducto(producto),
            cantidad: nuevaCantidad,
            color,
            tamaño,
            medida,
            id_variante,
            venta_por_metros: producto.venta_por_metros,
            metros: nuevosMetros,
            tecnicos_requeridos: producto.tecnicos_requeridos,
          },
        ];
      });
    },
    [],
  );

  const updateQuantity = useCallback((clave: string, cantidad: number) => {
    setItems((prev) =>
      prev.map((item) =>
        claveItemCarrito(item) === clave
          ? { ...item, cantidad: Math.max(1, cantidad) }
          : item,
      ),
    );
  }, []);

  const updateMetros = useCallback((clave: string, metros: number) => {
    setItems((prev) =>
      prev.map((item) =>
        claveItemCarrito(item) === clave
          ? { ...item, metros: Math.max(0.1, metros), cantidad: 1 }
          : item,
      ),
    );
  }, []);

  const removeItem = useCallback((clave: string) => {
    setItems((prev) => prev.filter((item) => claveItemCarrito(item) !== clave));
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const valor = useMemo<CarritoContextValue>(() => {
    const totalItems = items.reduce((suma, item) => suma + item.cantidad, 0);
    const totalPrice = items.reduce(
      (suma, item) => suma + item.precio_venta_producto * (item.metros || item.cantidad),
      0,
    );
    return {
      items,
      totalItems,
      totalPrice,
      addItem,
      updateQuantity,
      updateMetros,
      removeItem,
      clearCart,
    };
  }, [items, addItem, updateQuantity, updateMetros, removeItem, clearCart]);

  return <CarritoContext.Provider value={valor}>{children}</CarritoContext.Provider>;
}

export function useCart(): CarritoContextValue {
  const contexto = useContext(CarritoContext);
  if (!contexto) {
    throw new Error("useCart debe usarse dentro de <CarritoProvider>");
  }
  return contexto;
}
