// ─────────────────────────────────────────────────────────────
// Pruebas de services/productos.service.ts: catálogo público,
// resolución de imágenes y utilidades de precio/descuento.
// ─────────────────────────────────────────────────────────────

import * as productos from "@/services/productos.service";
import { fetchActual, instalarFetch, restaurarFetch } from "../helpers/fetch";

const BASE = "http://10.0.2.2:8000/api/v1";
const HOST = "http://10.0.2.2:8000";

const productoBase = {
  id_producto: 7,
  nombre_producto: "Cortina Linen",
  precio_venta_producto: 50000,
};

beforeEach(() => {
  instalarFetch({ cuerpo: {} });
  jest.spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  restaurarFetch();
  jest.restoreAllMocks();
});

describe("catálogo", () => {
  it("lista productos con la barra final que exige el backend", async () => {
    await productos.listarProductos();

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/productos/?limit=100`);
  });

  it("obtiene categorías", async () => {
    await productos.obtenerCategorias();

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/productos/categorias`);
  });

  it("obtiene un producto por id", async () => {
    await productos.obtenerProducto(42);

    expect(fetchActual().mock.calls[0][0]).toBe(`${BASE}/productos/42`);
  });
});

describe("urlImagenProducto", () => {
  it("usa el fallback /uploads/{id}.jpg sin imagen", () => {
    const url = productos.urlImagenProducto(productoBase);
    expect(url).toBe(`${HOST}/uploads/7.jpg`);
  });

  it("prioriza la imagen de la variante", () => {
    const url = productos.urlImagenProducto(
      { ...productoBase, imagen_url: "/uploads/producto.jpg" },
      { id: 1, nombre: "Blanco", stock: 2, imagen_url: "/uploads/variante.jpg" },
    );
    expect(url).toBe(`${HOST}/uploads/variante.jpg`);
  });

  it("prefija rutas relativas con el host del backend", () => {
    expect(productos.urlImagenProducto({ ...productoBase, imagen_url: "/uploads/a.jpg" })).toBe(
      `${HOST}/uploads/a.jpg`,
    );
    expect(productos.urlImagenProducto({ ...productoBase, imagen_url: "media/b.jpg" })).toBe(
      `${HOST}/media/b.jpg`,
    );
  });

  it("conserva las URLs absolutas no internas", () => {
    const cruda = "https://cdn.ejemplo.com/imagen.jpg";
    expect(productos.urlImagenProducto({ ...productoBase, imagen_url: cruda })).toBe(cruda);
  });

  it("reescribe localhost/127.0.0.1/minio hacia el host LAN accesible", () => {
    expect(
      productos.urlImagenProducto({
        ...productoBase,
        imagen_url: "http://localhost:9000/neodomus-media/x.jpg",
      }),
    ).toBe("http://10.0.2.2:9000/neodomus-media/x.jpg");

    expect(
      productos.urlImagenProducto({
        ...productoBase,
        imagen_url: "http://127.0.0.1:8000/uploads/x.jpg",
      }),
    ).toBe("http://10.0.2.2:8000/uploads/x.jpg");

    expect(
      productos.urlImagenProducto({
        ...productoBase,
        imagen_url: "http://minio:9000/neodomus-media/y.jpg",
      }),
    ).toBe("http://10.0.2.2:9000/neodomus-media/y.jpg");
  });
});

describe("precio y descuento", () => {
  it("tieneDescuento solo con precio_final y descuento_activo positivo", () => {
    expect(
      productos.tieneDescuento({
        ...productoBase,
        precio_final: 40000,
        descuento_activo: 20,
      }),
    ).toBe(true);
    expect(
      productos.tieneDescuento({ ...productoBase, precio_final: 40000, descuento_activo: 0 }),
    ).toBe(false);
    expect(
      productos.tieneDescuento({
        ...productoBase,
        precio_final: null,
        descuento_activo: 20,
      }),
    ).toBe(false);
    expect(productos.tieneDescuento({ ...productoBase })).toBe(false);
  });

  it("precioFinalDe prefiere precio_final y respalda con precio_venta", () => {
    expect(productos.precioFinalDe({ ...productoBase, precio_final: 39900 })).toBe(39900);
    expect(productos.precioFinalDe(productoBase)).toBe(50000);
    expect(productos.precioFinalDe({ ...productoBase, precio_final: null })).toBe(50000);
  });
});

describe("formatearPrecio", () => {
  it("prefija $ y formatea el monto redondeado como la web (es-CO)", () => {
    // El separador de miles depende del ICU de la plataforma; el contrato
    // es exactamente el resultado de toLocaleString("es-CO") del entero.
    const redondeado = Math.round(1500000).toLocaleString("es-CO");
    expect(productos.formatearPrecio(1500000)).toBe(`$${redondeado}`);
    expect(productos.formatearPrecio(100.4)).toBe(
      `$${Math.round(100.4).toLocaleString("es-CO")}`,
    );
    expect(productos.formatearPrecio(1500000).startsWith("$")).toBe(true);
  });
});
