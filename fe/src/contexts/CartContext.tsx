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

const itemKey = (item: { id_producto: number; color?: string }) =>
  item.color ? `${item.id_producto}-${item.color.toLowerCase()}` : `${item.id_producto}`;

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
      const key = itemKey(producto);
      const existing = prev.find(i => itemKey(i) === key);
      if (existing) {
        return prev.map(i =>
          itemKey(i) === key
            ? {
                ...i,
                // En venta por metros se acumulan metros (no unidades).
                cantidad: producto.venta_por_metros ? 1 : i.cantidad + cantidad,
                metros: producto.venta_por_metros ? (i.metros || 0) + (metros || 0) : i.metros,
              }
            : i
        );
      }
      return [...prev, { ...producto, cantidad: producto.venta_por_metros ? 1 : cantidad, metros: producto.venta_por_metros ? metros || 0 : metros }];
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
          i.precio_venta_producto * (i.venta_por_metros ? i.metros || 0 : i.cantidad),
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
