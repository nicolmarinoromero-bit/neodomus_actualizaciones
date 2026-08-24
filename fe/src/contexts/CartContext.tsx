import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { loadItem, saveItem } from '@utils/profileStorage';
import { useAuth } from '@contexts/AuthContext';

const CART_KEY = 'neodomus_carrito';

export interface CartItem {
  id_producto: number;
  nombre_producto: string;
  precio_venta_producto: number;
  imagen: string;
  cantidad: number;
  color?: string;
  tamaño?: string;
  medida?: string;
  id_variante?: number;
  venta_por_metros?: boolean;
  metros?: number;
  tecnicos_requeridos?: number;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (producto: Omit<CartItem, 'cantidad'>, cantidad?: number, metros?: number) => void;
  updateQuantity: (key: string, cantidad: number) => void;
  updateMetros: (key: string, metros: number) => void;
  removeItem: (key: string) => void;
  clearCart: () => void;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const itemKey = (item: {
  id_producto: number;
  color?: string;
  medida?: string;
  tamaño?: string;
  venta_por_metros?: boolean;
  metros?: number;
}) =>
  [
    item.id_producto,
    item.color?.toLowerCase(),
    (item.medida || item.tamaño || '').toLowerCase(),
    // En venta por metros cada metraje es una línea propia: el mismo metraje
    // acumula cantidad (tramos) y uno distinto se guarda aparte.
    item.venta_por_metros && item.metros != null ? `${item.metros}m` : '',
  ]
    .filter(Boolean)
    .join('-');

// Clave pública para que las vistas operen sobre la MISMA identidad que el
// contexto (carrito, edición desde el detalle, etc.).
export const claveCarrito = itemKey;

export const totalMetrosItem = (item: { venta_por_metros?: boolean; metros?: number; cantidad: number }) =>
  item.venta_por_metros ? (item.metros || 0) * (item.cantidad || 1) : 0;

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const [items, setItems] = useState<CartItem[]>(() => loadItem<CartItem[]>(CART_KEY, []));
  const { isAuthenticated } = useAuth();
  const prevAutenticado = useRef(isAuthenticated);

  useEffect(() => {
    if (prevAutenticado.current && !isAuthenticated) {
      setItems([]);
    }
    prevAutenticado.current = isAuthenticated;
  }, [isAuthenticated]);

  useEffect(() => {
    saveItem(CART_KEY, items);
  }, [items]);

  const addItem = (producto: Omit<CartItem, 'cantidad'>, cantidad = 1, metros?: number) => {
    setItems(prev => {
      const esMetros = Boolean(producto.venta_por_metros);
      // Por metros: cantidad = número de tramos y metros = metros POR tramo.
      const nuevo: CartItem = esMetros
        ? { ...producto, cantidad: Math.max(1, cantidad), metros: metros || 0 }
        : { ...producto, cantidad };
      const key = itemKey(nuevo);
      const existing = prev.find(i => itemKey(i) === key);
      if (existing) {
        // Misma línea (incluido el mismo metraje): se suman unidades/tramos.
        return prev.map(i =>
          itemKey(i) === key ? { ...i, cantidad: i.cantidad + nuevo.cantidad } : i
        );
      }
      return [...prev, nuevo];
    });
  };

  const updateQuantity = (key: string, cantidad: number) => {
    setItems(prev =>
      prev.map(i => (itemKey(i) === key ? { ...i, cantidad: Math.max(1, cantidad) } : i))
    );
  };

  const updateMetros = (key: string, metros: number) => {
    setItems(prev =>
      prev.map(i => (itemKey(i) === key ? { ...i, metros: Math.max(0.1, metros) } : i))
    );
  };

  const removeItem = (key: string) => {
    setItems(prev => prev.filter(i => itemKey(i) !== key));
  };

  const clearCart = () => setItems([]);

  const totalItems = useMemo(() => items.reduce((acc, i) => acc + i.cantidad, 0), [items]);
  const totalPrice = useMemo(
    () =>
      items.reduce(
        (acc, i) =>
          acc +
          i.precio_venta_producto *
            (i.venta_por_metros ? (i.metros || 0) * (i.cantidad || 1) : i.cantidad),
        0
      ),
    [items]
  );

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, updateQuantity, updateMetros, removeItem, clearCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
};
