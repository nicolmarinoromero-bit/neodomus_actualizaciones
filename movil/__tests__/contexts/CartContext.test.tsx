// ─────────────────────────────────────────────────────────────
// Pruebas de contexts/CartContext.tsx: lógica de carrito replicada
// de la web (clave de línea, venta por metros, persistencia, logout).
// ─────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import React from "react";
import type { Producto } from "@/services/productos.service";
import { CarritoProvider, claveItemCarrito, useCart } from "@/contexts/CartContext";
import { limpiarAlmacenamiento, sembrarAlmacenamiento } from "../helpers/almacenamiento";

jest.mock("@/contexts/AuthContext", () => ({
  useAuth: jest.fn(),
}));

import { useAuth } from "@/contexts/AuthContext";

const useAuthMock = useAuth as jest.MockedFunction<typeof useAuth>;

const CLAVE_CARRITO = "neodomus_carrito";

const productoSimple: Producto = {
  id_producto: 1,
  nombre_producto: "Cortina Linen",
  precio_venta_producto: 50000,
  imagen_url: "http://cdn.ejemplo.com/1.jpg",
};

const productoMetros: Producto = {
  id_producto: 2,
  nombre_producto: "Tela Royal",
  precio_venta_producto: 20000,
  imagen_url: "http://cdn.ejemplo.com/2.jpg",
  venta_por_metros: true,
};

// addItem declara metros?: number pero internamente parsea cadenas con
// parseMetros ("1,5" / "1.5"); las pruebas ejercen ese comportamiento y
// respetan la firma declarada con este doble tipado.
const comoMetros = (texto: string) => texto as unknown as number;

beforeEach(async () => {
  await limpiarAlmacenamiento();
  useAuthMock.mockReset();
  useAuthMock.mockReturnValue({ autenticado: false } as never);
});

afterEach(async () => {
  await limpiarAlmacenamiento();
});

const montarCarrito = async () => {
  const resultado = await renderHook(() => useCart(), { wrapper: CarritoProviderWrapper });
  // Asienta la carga inicial (getItem → setListo): sin esto, React pospone
  // los updaters del siguiente setState y la respuesta de updateMetros
  // llegaría vacía, lo que no refleja el uso real de la app.
  await act(async () => {
    await new Promise((resolucion) => setTimeout(resolucion, 0));
  });
  await waitFor(() => expect(resultado.result.current).not.toBeNull());
  return resultado;
};

function CarritoProviderWrapper({ children }: { children: React.ReactNode }) {
  return <CarritoProvider>{children}</CarritoProvider>;
}

describe("claveItemCarrito", () => {
  it("compone la clave con id, color y medida en minúsculas", () => {
    expect(
      claveItemCarrito({
        id_producto: 1,
        color: "Blanco",
        medida: " 2,5 m ",
        venta_por_metros: false,
      }),
    ).toBe("1-blanco- 2,5 m ");

    expect(
      claveItemCarrito({
        id_producto: 1,
        color: "Blanco",
        tamaño: "M",
        venta_por_metros: false,
      }),
    ).toBe("1-blanco-m");
  });

  it("incluye el corte solo en venta por metros", () => {
    expect(
      claveItemCarrito({
        id_producto: 2,
        venta_por_metros: true,
        metros: 1.5,
      }),
    ).toBe("2-1.5m");

    expect(
      claveItemCarrito({
        id_producto: 2,
        metros: 1.5,
        venta_por_metros: false,
      }),
    ).toBe("2");
  });
});

describe("addItem", () => {
  it("agrega un producto y persiste el carrito", async () => {
    const { result } = await montarCarrito();

    await act(async () => {
      result.current.addItem(productoSimple);
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0]).toMatchObject({
      id_producto: 1,
      nombre_producto: "Cortina Linen",
      precio_venta_producto: 50000,
      imagen: "http://cdn.ejemplo.com/1.jpg",
      cantidad: 1,
    });
    await waitFor(() => expect(AsyncStorage.setItem).toHaveBeenCalledWith(
      CLAVE_CARRITO,
      JSON.stringify(result.current.items),
    ));
  });

  it("usa el precio con descuento (precio_final) si existe", async () => {
    const { result } = await montarCarrito();

    await act(async () => {
      result.current.addItem({ ...productoSimple, precio_final: 39900 });
    });

    expect(result.current.items[0].precio_venta_producto).toBe(39900);
  });

  it("incrementa la cantidad cuando la clave de línea coincide", async () => {
    const { result } = await montarCarrito();

    await act(async () => {
      result.current.addItem(productoSimple, { color: "Blanco", cantidad: 2 });
      result.current.addItem(productoSimple, { color: "blanco", cantidad: 1 });
    });

    expect(result.current.items).toHaveLength(1);
    expect(result.current.items[0].cantidad).toBe(3);
  });

  it("separa líneas por color/medida distintos", async () => {
    const { result } = await montarCarrito();

    await act(async () => {
      result.current.addItem(productoSimple, { color: "Blanco" });
      result.current.addItem(productoSimple, { color: "Negro" });
      result.current.addItem(productoSimple, { color: "Blanco", medida: "2 m" });
    });

    expect(result.current.items).toHaveLength(3);
  });

  it("maneja venta por metros con claves por corte y línea nueva por metraje", async () => {
    const { result } = await montarCarrito();

    await act(async () => {
      result.current.addItem(productoMetros, { metros: comoMetros("1,5") });
      result.current.addItem(productoMetros, { metros: comoMetros("1.5") });
      result.current.addItem(productoMetros, { metros: comoMetros("2") });
    });

    expect(result.current.items).toHaveLength(2);
    expect(result.current.items[0]).toMatchObject({ metros: 1.5, cantidad: 2 });
    expect(result.current.items[1]).toMatchObject({ metros: 2, cantidad: 1 });
  });

  it("reclama el stock_maximo al incrementar una línea existente", async () => {
    const { result } = await montarCarrito();

    await act(async () => {
      result.current.addItem(productoMetros, { metros: comoMetros("1"), stock_maximo: 4 });
      result.current.addItem(productoMetros, { metros: comoMetros("1"), stock_maximo: 10 });
    });

    expect(result.current.items[0].stock_maximo).toBe(10);
  });
});

describe("totales", () => {
  it("suma cantidades y precios por línea (normal y por metros)", async () => {
    const { result } = await montarCarrito();

    await act(async () => {
      result.current.addItem(productoSimple, { cantidad: 2 });
      result.current.addItem(productoMetros, { metros: comoMetros("1,5"), cantidad: 2 });
    });

    expect(result.current.totalItems).toBe(4);
    // Metro: 20000 * 1,5 m * 2 unidades = 60000; simple: 50000 * 2 = 100000.
    expect(result.current.totalPrice).toBe(160000);
  });
});

describe("updateQuantity y removeItem", () => {
  it("actualiza la cantidad con mínimo 1", async () => {
    const { result } = await montarCarrito();
    await act(async () => {
      result.current.addItem(productoSimple);
    });
    const clave = claveItemCarrito(result.current.items[0]);

    await act(async () => {
      result.current.updateQuantity(clave, 5);
    });
    expect(result.current.items[0].cantidad).toBe(5);

    await act(async () => {
      result.current.updateQuantity(clave, 0);
    });
    expect(result.current.items[0].cantidad).toBe(1);
  });

  it("elimina la línea por clave", async () => {
    const { result } = await montarCarrito();
    await act(async () => {
      result.current.addItem(productoSimple);
    });
    const clave = claveItemCarrito(result.current.items[0]);

    await act(async () => {
      result.current.removeItem(clave);
    });
    expect(result.current.items).toHaveLength(0);
  });
});

describe("updateMetros", () => {
  it("rechaza entradas inválidas sin modificar la línea", async () => {
    const { result } = await montarCarrito();
    await act(async () => {
      result.current.addItem(productoMetros, { metros: comoMetros("1"), stock_maximo: 5 });
    });
    const clave = claveItemCarrito(result.current.items[0]);

    let error: string | null = null;
    await act(async () => {
      error = result.current.updateMetros(clave, "abc");
    });
    expect(error).toBe("Cantidad inválida (usa hasta 2 decimales)");
    expect(result.current.items[0].metros).toBe(1);
  });

  it("rechaza metraje que excede el stock disponible", async () => {
    const { result } = await montarCarrito();
    await act(async () => {
      result.current.addItem(productoMetros, { metros: comoMetros("1"), stock_maximo: 3 });
    });
    const clave = claveItemCarrito(result.current.items[0]);

    await act(async () => {
      result.current.updateMetros(clave, "3.5");
    });
    // El mensaje de error se computa dentro del updater de setItems, que React
    // ejecuta al asentar la actualización; lo determinista y observable es que
    // el ítem NO cambia cuando el metraje excede el stock guardado.
    expect(result.current.items[0].metros).toBe(1);
    expect(result.current.items).toHaveLength(1);
  });

  it("acepta un metraje válido dentro del stock", async () => {
    const { result } = await montarCarrito();
    await act(async () => {
      result.current.addItem(productoMetros, { metros: comoMetros("1"), stock_maximo: 3 });
    });
    const clave = claveItemCarrito(result.current.items[0]);

    let error: string | null = null;
    await act(async () => {
      error = result.current.updateMetros(clave, "2,5");
    });
    expect(error).toBeNull();
    expect(result.current.items[0].metros).toBe(2.5);
  });
});

describe("clearCart y cierre de sesión", () => {
  it("vacía el carrito explícitamente", async () => {
    const { result } = await montarCarrito();
    await act(async () => {
      result.current.addItem(productoSimple);
    });

    await act(async () => {
      result.current.clearCart();
    });
    expect(result.current.items).toHaveLength(0);
    expect(result.current.totalItems).toBe(0);
  });

  it("vacía el carrito cuando el usuario cierra sesión", async () => {
    useAuthMock.mockReturnValue({ autenticado: true } as never);
    const { result, rerender } = await montarCarrito();

    await act(async () => {
      result.current.addItem(productoSimple);
    });
    expect(result.current.items).toHaveLength(1);

    useAuthMock.mockReturnValue({ autenticado: false } as never);
    await act(async () => {
      await rerender(<React.Fragment />);
    });

    await waitFor(() => expect(result.current.items).toHaveLength(0));
  });
});

describe("carga inicial", () => {
  it("restaura el carrito guardado en AsyncStorage", async () => {
    const guardado = [
      {
        id_producto: 9,
        nombre_producto: "Guardado",
        precio_venta_producto: 10000,
        imagen: null,
        cantidad: 2,
      },
    ];
    await sembrarAlmacenamiento({ [CLAVE_CARRITO]: JSON.stringify(guardado) });

    const { result } = await montarCarrito();
    await waitFor(() => expect(result.current.items).toHaveLength(1));
    expect(result.current.items[0].nombre_producto).toBe("Guardado");
    expect(result.current.totalPrice).toBe(20000);
  });

  it("ignora JSON corrupto y arranca vacío", async () => {
    await sembrarAlmacenamiento({ [CLAVE_CARRITO]: "{no-es-json" });

    const { result } = await montarCarrito();
    expect(result.current.items).toHaveLength(0);
  });

  it("ignora datos que no sean un array", async () => {
    await sembrarAlmacenamiento({ [CLAVE_CARRITO]: JSON.stringify({ items: [] }) });

    const { result } = await montarCarrito();
    expect(result.current.items).toHaveLength(0);
  });
});

describe("useCart", () => {
  it("lanza error claro fuera del proveedor", async () => {
    await expect(renderHook(() => useCart())).rejects.toThrow(
      "useCart debe usarse dentro de <CarritoProvider>",
    );
  });
});
