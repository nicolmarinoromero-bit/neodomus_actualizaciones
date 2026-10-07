// Tests de la lógica del carrito de compras (CartContext):
// cálculo de totales, reglas de stock, venta por metros y persistencia.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

// El carrito depende de useAuth (para vaciarse al cerrar sesión); se mockea
// solo ese hook para aislar la lógica del carrito.
const sesion = vi.hoisted(() => ({ autenticado: true }));

vi.mock('@contexts/AuthContext', () => ({
  useAuth: () => ({ isAuthenticated: sesion.autenticado }),
}));

import { CartProvider, useCart, type CartItem } from '../../contexts/CartContext';

const wrapper = ({ children }: { children: ReactNode }) => (
  <CartProvider>{children}</CartProvider>
);

const renderCart = () => renderHook(() => useCart(), { wrapper });

const producto = (extra: Partial<CartItem> = {}): Omit<CartItem, 'cantidad'> => ({
  id_producto: 1,
  nombre_producto: 'Sensor de puerta',
  precio_venta_producto: 10000,
  imagen: '/img/sensor.jpg',
  ...extra,
});

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  sesion.autenticado = true;
});

describe('CartContext — alta de productos', () => {
  it('addItem agrega un producto y calcula totales', () => {
    const { result } = renderCart();

    let error: string | null = null;
    act(() => {
      error = result.current.addItem(producto(), 2);
    });

    expect(error).toBeNull();
    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalItems).toBe(2);
    expect(result.current.totalPrice).toBe(20000);
  });

  it('addItem del mismo producto incrementa la cantidad en lugar de duplicar', () => {
    const { result } = renderCart();
    act(() => {
      result.current.addItem(producto(), 1);
      result.current.addItem(producto(), 3);
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].cantidad).toBe(4);
    expect(result.current.totalItems).toBe(4);
  });

  it('productos con distinto color generan líneas separadas', () => {
    const { result } = renderCart();
    act(() => {
      result.current.addItem(producto({ color: 'blanco' }), 1);
      result.current.addItem(producto({ color: 'negro' }), 1);
    });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.totalItems).toBe(2);
  });

  it('rechaza agregar por encima del stock máximo', () => {
    const { result } = renderCart();
    let error: string | null = null;
    act(() => {
      error = result.current.addItem(producto({ stock_maximo: 3 }), 5);
    });
    expect(error).toBe('Stock insuficiente: solo hay 3 unidades disponibles');
    expect(result.current.items).toHaveLength(0);
  });

  it('permite agregar hasta el stock máximo exacto', () => {
    const { result } = renderCart();
    let error: string | null = null;
    act(() => {
      error = result.current.addItem(producto({ stock_maximo: 3 }), 3);
    });
    expect(error).toBeNull();
    expect(result.current.items).toHaveLength(1);
  });
});

describe('CartContext — venta por metros', () => {
  it('valida que la longitud sea mayor que cero', () => {
    const { result } = renderCart();
    let error: string | null = null;
    act(() => {
      error = result.current.addItem(producto({ venta_por_metros: true }), 1, 0);
    });
    expect(error).toBe('Selecciona una longitud válida');
    expect(result.current.items).toHaveLength(0);
  });

  it('acumula unidades con el mismo largo y crea líneas distintas para largos distintos', () => {
    const { result } = renderCart();

    // Los mensajes de error se generan DENTRO del updater de React: solo el
    // primer dispatch (síncrono) puede devolverlos, así que aquí se comprueba
    // el estado resultante. El retorno del mensaje se testea aparte.
    act(() => {
      result.current.addItem(producto({ venta_por_metros: true, stock_maximo: 20, metros: 3 }), 2, 3);
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].metros).toBe(3);
    expect(result.current.items[0].cantidad).toBe(2);

    // Mismo largo → suma unidades en la misma línea (6 m + 6 m = 12 m).
    act(() => {
      result.current.addItem(producto({ venta_por_metros: true, stock_maximo: 20, metros: 3 }), 2, 3);
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].cantidad).toBe(4);
    expect(result.current.totalItems).toBe(4);
    expect(result.current.totalPrice).toBe(10000 * 3 * 4);

    // 12 m + 3 × 3 m = 21 m > 20 m disponibles: no cambia el estado.
    act(() => {
      result.current.addItem(producto({ venta_por_metros: true, stock_maximo: 20, metros: 3 }), 3, 3);
    });
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].cantidad).toBe(4);
    expect(result.current.totalPrice).toBe(10000 * 3 * 4);

    // Otro largo → línea separada en el carrito.
    act(() => {
      result.current.addItem(producto({ venta_por_metros: true, stock_maximo: 20, metros: 5 }), 1, 5);
    });
    expect(result.current.items).toHaveLength(2);
    expect(result.current.totalItems).toBe(5);
    expect(result.current.totalPrice).toBe(10000 * 3 * 4 + 10000 * 5 * 1);
  });

  it('devuelve el mensaje de error al superar el stock en metros', () => {
    // Ítem ya presente: el primer dispatch devuelve el mensaje de error.
    localStorage.setItem(
      'neodomus_carrito',
      JSON.stringify([
        { ...producto({ venta_por_metros: true, stock_maximo: 10, metros: 3 }), cantidad: 2, metros: 3 },
      ]),
    );
    const { result } = renderCart();

    let error: string | null = null;
    act(() => {
      error = result.current.addItem(
        producto({ venta_por_metros: true, stock_maximo: 10, metros: 3 }),
        1,
        5,
      );
    });
    expect(error).toBe('Stock insuficiente: solo hay 10 m disponibles');
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].metros).toBe(3);
  });
});

describe('CartContext — cantidades y eliminación', () => {
  it('updateQuantity incrementa y decrementa sin bajar de 1', () => {
    const { result } = renderCart();
    act(() => {
      result.current.addItem(producto(), 1);
      result.current.updateQuantity('1', 5);
    });
    expect(result.current.items[0].cantidad).toBe(5);

    act(() => {
      result.current.updateQuantity('1', -10);
    });
    expect(result.current.items[0].cantidad).toBe(1);
  });

  it('updateQuantity devuelve error si excede el stock', () => {
    // Ítem sembrado para que updateQuantity sea el primer dispatch y su
    // retorno síncrono lleve el mensaje de error.
    localStorage.setItem(
      'neodomus_carrito',
      JSON.stringify([{ ...producto({ stock_maximo: 4 }), cantidad: 2 }]),
    );
    const { result } = renderCart();

    let error: string | null = null;
    act(() => {
      error = result.current.updateQuantity('1', 9);
    });
    expect(error).toBe('Stock insuficiente: solo hay 4 unidades disponibles');
    expect(result.current.items[0].cantidad).toBe(2);
  });

  it('updateMetros redondea y aplica el cambio', () => {
    const { result } = renderCart();
    act(() => {
      result.current.addItem(producto({ venta_por_metros: true, stock_maximo: 10, metros: 2 }), 1, 2);
    });
    // La clave de un ítem vendido por metros incluye el largo (id-metros).
    expect(result.current.items[0]).toMatchObject({ metros: 2 });

    act(() => {
      result.current.updateMetros('1-2m', 3.6);
    });
    expect(result.current.items[0].metros).toBe(4);
  });

  it('updateMetros devuelve error si excede el stock en metros', () => {
    localStorage.setItem(
      'neodomus_carrito',
      JSON.stringify([
        {
          ...producto({ venta_por_metros: true, stock_maximo: 10, metros: 2 }),
          cantidad: 1,
          metros: 2,
        },
      ]),
    );
    const { result } = renderCart();

    let error: string | null = null;
    act(() => {
      error = result.current.updateMetros('1-2m', 50);
    });
    expect(error).toBe('Stock insuficiente: solo hay 10 m disponibles');
    expect(result.current.items[0].metros).toBe(2);
  });

  it('removeItem y clearCart vacían lo pedido', () => {
    const { result } = renderCart();
    act(() => {
      result.current.addItem(producto(), 1);
      result.current.addItem(producto({ id_producto: 2 }), 1);
    });
    expect(result.current.items).toHaveLength(2);

    act(() => result.current.removeItem('1'));
    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].id_producto).toBe(2);

    act(() => result.current.clearCart());
    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
    expect(result.current.totalPrice).toBe(0);
  });

  it('actualizarStock cambia el stock y marca falta de stock si aplica', () => {
    const { result } = renderCart();
    act(() => {
      result.current.addItem(producto(), 3);
    });
    expect(result.current.tieneStockInsuficiente).toBe(false);

    act(() => result.current.actualizarStock('1', 2));
    expect(result.current.tieneStockInsuficiente).toBe(true);
    expect(result.current.items[0].stock_maximo).toBe(2);
  });
});

describe('CartContext — persistencia y sesión', () => {
  it('persiste el carrito en localStorage', async () => {
    const { result } = renderCart();
    act(() => {
      result.current.addItem(producto(), 2);
    });
    await waitFor(() => {
      const guardado = JSON.parse(localStorage.getItem('neodomus_carrito') || '[]');
      expect(guardado).toHaveLength(1);
      expect(guardado[0].cantidad).toBe(2);
    });
  });

  it('recupera el carrito guardado al montar', () => {
    localStorage.setItem(
      'neodomus_carrito',
      JSON.stringify([{ ...producto(), cantidad: 7 }]),
    );
    const { result } = renderCart();
    expect(result.current.items).toHaveLength(1);
    expect(result.current.totalItems).toBe(7);
  });

  it('vacía el carrito cuando se cierra la sesión', async () => {
    const { result, rerender } = renderCart();
    act(() => {
      result.current.addItem(producto(), 2);
    });
    expect(result.current.items).toHaveLength(1);

    sesion.autenticado = false;
    rerender();

    await waitFor(() => expect(result.current.items).toHaveLength(0));
  });
});
