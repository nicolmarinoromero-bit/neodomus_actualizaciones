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
  stock_maximo?: number;
}

interface CartContextValue {
  items: CartItem[];
  totalItems: number;
  totalPrice: number;
  addItem: (producto: Omit<CartItem, 'cantidad'>, cantidad?: number, metros?: number) => string | null;
  updateQuantity: (key: string, cantidad: number) => string | null;
  updateMetros: (key: string, metros: number) => string | null;
  removeItem: (key: string) => void;
  clearCart: () => void;
  actualizarStock: (key: string, stock: number) => void;
  tieneStockInsuficiente: boolean;
}

const CartContext = createContext<CartContextValue | undefined>(undefined);

const itemKey = (item: { id_producto: number; color?: string; medida?: string; tamaño?: string }) =>
  [
    item.id_producto,
    item.color?.toLowerCase(),
    (item.medida || item.tamaño || '').toLowerCase(),
  ]
    .filter(Boolean)
    .join('-');

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

  const addItem = (producto: Omit<CartItem, 'cantidad'>, cantidad = 1, metros?: number): string | null => {
    let error: string | null = null;
    setItems(prev => {
      const key = itemKey(producto);
      const existing = prev.find(i => itemKey(i) === key);
      if (existing) {
        const stockMax = existing.stock_maximo ?? Infinity;
        if (producto.venta_por_metros) {
          const nuevosMetros = (existing.metros || 0) + (metros || 0);
          if (nuevosMetros > stockMax) {
            error = `Stock insuficiente: solo hay ${stockMax} m disponibles`;
            return prev;
          }
          return prev.map(i =>
            itemKey(i) === key
              ? { ...i, metros: nuevosMetros }
              : i
          );
        }
        const nuevaCantidad = existing.cantidad + cantidad;
        if (nuevaCantidad > stockMax) {
          error = `Stock insuficiente: solo hay ${stockMax} unidades disponibles`;
          return prev;
        }
        return prev.map(i =>
          itemKey(i) === key
            ? { ...i, cantidad: nuevaCantidad }
            : i
        );
      }
      const stockMax = producto.stock_maximo ?? Infinity;
      if (producto.venta_por_metros) {
        if ((metros || 0) > stockMax) {
          error = `Stock insuficiente: solo hay ${stockMax} m disponibles`;
          return prev;
        }
      } else {
        if (cantidad > stockMax) {
          error = `Stock insuficiente: solo hay ${stockMax} unidades disponibles`;
          return prev;
        }
      }
      return [...prev, {
        ...producto,
        cantidad: producto.venta_por_metros ? 1 : cantidad,
        metros: producto.venta_por_metros ? metros || 0 : metros,
      }];
    });
    return error;
  };

  const updateQuantity = (key: string, cantidad: number): string | null => {
    let error: string | null = null;
    setItems(prev =>
      prev.map(i => {
        if (itemKey(i) !== key) return i;
        const nuevaCantidad = Math.max(1, cantidad);
        const stockMax = i.stock_maximo ?? Infinity;
        if (nuevaCantidad > stockMax) {
          error = `Stock insuficiente: solo hay ${stockMax} unidades disponibles`;
          return i;
        }
        return { ...i, cantidad: nuevaCantidad };
      })
    );
    return error;
  };

  const updateMetros = (key: string, metros: number): string | null => {
    let error: string | null = null;
    setItems(prev =>
      prev.map(i => {
        if (itemKey(i) !== key) return i;
        const nuevosMetros = Math.max(0.1, metros);
        const stockMax = i.stock_maximo ?? Infinity;
        if (nuevosMetros > stockMax) {
          error = `Stock insuficiente: solo hay ${stockMax} m disponibles`;
          return i;
        }
        return { ...i, metros: nuevosMetros };
      })
    );
    return error;
  };

  const removeItem = (key: string) => {
    setItems(prev => prev.filter(i => itemKey(i) !== key));
  };

  const clearCart = () => setItems([]);

  const actualizarStock = (key: string, stock: number) => {
    setItems(prev =>
      prev.map(i => (itemKey(i) === key ? { ...i, stock_maximo: stock } : i))
    );
  };

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

  const tieneStockInsuficiente = useMemo(
    () => items.some(i => {
      const stockMax = i.stock_maximo ?? Infinity;
      const cantidadActual = i.venta_por_metros ? (i.metros || 0) : i.cantidad;
      return cantidadActual > stockMax;
    }),
    [items]
  );

  return (
    <CartContext.Provider value={{ items, totalItems, totalPrice, addItem, updateQuantity, updateMetros, removeItem, clearCart, actualizarStock, tieneStockInsuficiente }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart debe usarse dentro de CartProvider');
  return ctx;
};
