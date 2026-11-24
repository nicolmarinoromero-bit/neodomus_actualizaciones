// ─────────────────────────────────────────────────────────────
// Pruebas de services/productos.service.ts con ORIGEN SIN PUERTO
// y con BACKEND_HOST_URL inválida (ramas de normalizarUrlImagen).
// Se aíslan con jest.isolateModules porque constants/api lee el
// entorno en el momento de la importación.
// ─────────────────────────────────────────────────────────────

const productoBase = {
  id_producto: 7,
  nombre_producto: "Cortina Linen",
  precio_venta_producto: 50000,
};

describe("normalizarUrlImagen — origen sin puerto explícito", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.EXPO_PUBLIC_API_URL = "https://api.neodomus.example";
  });

  afterEach(() => {
    delete process.env.EXPO_PUBLIC_API_URL;
    jest.resetModules();
  });

  it("túnel HTTPS: un solo origen enruta tanto API como MinIO", () => {
    let productos: typeof import("@/services/productos.service");
    jest.isolateModules(() => {
      productos = require("@/services/productos.service");
    });

    const url = productos!.urlImagenProducto({
      ...productoBase,
      imagen_url: "http://localhost:9000/neodomus-media/x.jpg",
    });

    // El origen https sin puerto explícito reescribe localhost:9000 al
    // MISMO origen (el túnel enruta por ruta, no por puerto).
    expect(url).toBe("https://api.neodomus.example/neodomus-media/x.jpg");

    const urlApi = productos!.urlImagenProducto({
      ...productoBase,
      imagen_url: "http://127.0.0.1:8000/uploads/x.jpg",
    });
    expect(urlApi).toBe("https://api.neodomus.example/uploads/x.jpg");
  });

  it("BACKEND_HOST_URL no parseable: devuelve la URL cruda sin tocar", () => {
    jest.mock("@/constants/api", () => ({
      API_BASE_URL: "no-es-url/api/v1",
      BACKEND_HOST_URL: "no-es-url",
    }));
    let productos: typeof import("@/services/productos.service");
    jest.isolateModules(() => {
      productos = require("@/services/productos.service");
    });

    const cruda = "http://localhost:9000/neodomus-media/x.jpg";
    expect(productos!.urlImagenProducto({ ...productoBase, imagen_url: cruda })).toBe(cruda);
  });
});
