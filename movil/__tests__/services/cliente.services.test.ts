// ─────────────────────────────────────────────────────────────
// Pruebas de services/cliente.services.ts: servicios del cliente
// autenticado (construcción de queries, checkout y factura PDF).
// ─────────────────────────────────────────────────────────────

import * as cliente from "@/services/cliente.services";
import { fetchActual, instalarFetch, restaurarFetch } from "../helpers/fetch";

const BASE = "http://10.0.2.2:8000/api/v1";

jest.mock("expo-file-system/legacy", () => ({
  cacheDirectory: "/cache/",
  downloadAsync: jest.fn(),
  getInfoAsync: jest.fn(),
}));

jest.mock("expo-sharing", () => ({
  isAvailableAsync: jest.fn(),
  shareAsync: jest.fn(),
}));

import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";

beforeEach(() => {
  instalarFetch({ cuerpo: {} });
  jest.mocked(FileSystem.downloadAsync).mockReset();
  jest.mocked(FileSystem.getInfoAsync).mockReset();
  jest.mocked(Sharing.isAvailableAsync).mockReset();
  jest.mocked(Sharing.shareAsync).mockReset();
});

afterEach(() => {
  restaurarFetch();
});

function url(indice = 0): string {
  return fetchActual().mock.calls[indice][0] as string;
}

function init(indice = 0): RequestInit {
  return fetchActual().mock.calls[indice][1] as RequestInit;
}

describe("perfil y cuenta", () => {
  it("obtiene el perfil del cliente", async () => {
    await cliente.obtenerPerfilCliente();
    expect(url()).toBe(`${BASE}/clients/me`);
  });

  it("actualiza el perfil con PUT y el body completo", async () => {
    const datos = {
      email: "ana@neodomus.com",
      first_name: "Ana",
      last_name: "Pérez",
      id_tipo_documento_c: 1,
      documento_cliente: 1234567890,
      telefono_cliente: 3001234567,
      address: "Calle 1",
    };

    await cliente.actualizarPerfilCliente(datos);

    expect(url()).toBe(`${BASE}/clients/me`);
    expect(init().method).toBe("PUT");
    expect(JSON.parse(String(init().body))).toEqual(datos);
  });

  it("crea la solicitud de inhabilitación con tipo y motivo", async () => {
    await cliente.crearSolicitudInhabilitar("Ya no uso el servicio");

    expect(url()).toBe(`${BASE}/clients/me/cuenta-solicitud`);
    expect(init().method).toBe("POST");
    expect(JSON.parse(String(init().body))).toEqual({
      tipo: "inhabilitar",
      motivo: "Ya no uso el servicio",
    });
  });
});

describe("citas", () => {
  it("lista horas disponibles con query string sin campos vacíos", async () => {
    await cliente.listarHorasDisponibles({
      fecha: "2026-03-01",
      tecnico_id: 4,
      tipo_servicio: "instalacion",
    });

    expect(url()).toBe(
      `${BASE}/citas/horas-disponibles?fecha=2026-03-01&tecnico_id=4&tipo_servicio=instalacion`,
    );
  });

  it("omite tecnico_id y tipo_servicio si no vienen", async () => {
    await cliente.listarHorasDisponibles({ fecha: "2026-03-01" });

    expect(url()).toBe(`${BASE}/citas/horas-disponibles?fecha=2026-03-01`);
  });

  it("cancela la cita con DELETE", async () => {
    await cliente.cancelarCita(12);

    expect(url()).toBe(`${BASE}/citas/12`);
    expect(init().method).toBe("DELETE");
  });
});

describe("técnicos públicos", () => {
  it("lista sin filtros", async () => {
    await cliente.listarTecnicosPublicos();
    expect(url()).toBe(`${BASE}/tecnicos/publicos`);
  });

  it("lista con filtros aplicados (los vacíos se descartan)", async () => {
    await cliente.listarTecnicosPublicos({
      tipo_servicio: "instalacion",
      fecha: "2026-03-01",
      hora: "",
    });

    expect(url()).toBe(`${BASE}/tecnicos/publicos?tipo_servicio=instalacion&fecha=2026-03-01`);
  });
});

describe("checkout — crearPedido", () => {
  it("publica el body exacto con items, servicios y pago", async () => {
    const payload = {
      items: [
        { id_producto: 1, cantidad: 2, color: "Blanco", tamaño: "M" },
        { id_producto: 2, cantidad: 1, metros: 2.5 },
      ],
      servicios: [
        { nombre: "Instalación", tipo_servicio: "instalacion", precio: 50000, hora: "10:00" },
      ],
      pago: { metodo_pago: "efectivo" },
    };

    await cliente.crearPedido(payload);

    expect(url()).toBe(`${BASE}/pedidos`);
    expect(init().method).toBe("POST");
    expect(JSON.parse(String(init().body))).toEqual(payload);
  });
});

describe("descargarFacturaPdf", () => {
  const prepararDescarga = (overrides: Partial<Record<string, unknown>> = {}) => {
    jest.mocked(FileSystem.downloadAsync).mockResolvedValue({
      uri: "/cache/factura_9.pdf",
      status: 200,
      ...(overrides.status !== undefined ? { status: overrides.status } : {}),
    } as never);
    jest.mocked(FileSystem.getInfoAsync).mockResolvedValue({
      exists: true,
      size: 1024,
      uri: "/cache/factura_9.pdf",
      isDirectory: false,
    } as never);
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(true);
  };

  it("descarga la factura relativa en la API base con Authorization", async () => {
    prepararDescarga();

    await cliente.descargarFacturaPdf("/api/v1/pedidos/9/factura", "tok-1");

    const [urlDescarga, destino, opciones] = jest.mocked(FileSystem.downloadAsync).mock
      .calls[0] as unknown as [string, string, { headers: Record<string, string> }];
    expect(urlDescarga).toBe(`${BASE}/pedidos/9/factura`);
    expect(destino).toBe("/cache/factura_9.pdf");
    expect(opciones.headers.Authorization).toBe("Bearer tok-1");
    expect(Sharing.shareAsync).toHaveBeenCalledWith("/cache/factura_9.pdf", {
      mimeType: "application/pdf",
      dialogTitle: "Factura Neodomus",
      UTI: "com.adobe.pdf",
    });
  });

  it("normaliza hosts internos en URLs absolutas", async () => {
    prepararDescarga();

    await cliente.descargarFacturaPdf("http://localhost:8000/api/v1/pedidos/3/factura", "tok");

    const [urlDescarga] = jest.mocked(FileSystem.downloadAsync).mock
      .calls[0] as unknown as [string];
    expect(urlDescarga).toBe("http://10.0.2.2:8000/api/v1/pedidos/3/factura");
  });

  it("lanza error con el estado HTTP si la descarga falla", async () => {
    prepararDescarga({ status: 500 });

    await expect(
      cliente.descargarFacturaPdf("/api/v1/pedidos/9/factura", "tok"),
    ).rejects.toThrow("No se pudo descargar la factura (HTTP 500)");
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it("no comparte si el sistema no soporta Sharing y devuelve el archivo en caché", async () => {
    prepararDescarga();
    jest.mocked(Sharing.isAvailableAsync).mockResolvedValue(false);

    const uri = await cliente.descargarFacturaPdf("/api/v1/pedidos/9/factura", "tok");

    expect(uri).toBe("/cache/factura_9.pdf");
    expect(Sharing.shareAsync).not.toHaveBeenCalled();
  });

  it("descarga sin Authorization cuando el token está vacío", async () => {
    prepararDescarga();

    await cliente.descargarFacturaPdf("/api/v1/pedidos/9/factura", "");

    const [, , opciones] = jest.mocked(FileSystem.downloadAsync).mock
      .calls[0] as unknown as [string, string, { headers: Record<string, string> }];
    expect(opciones.headers.Authorization).toBeUndefined();
  });
});
