// ─────────────────────────────────────────────────────────────
// Pruebas de services/novedades.service.ts (técnicos):
// consultas, creación y subida de evidencias (multipart).
// ─────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { guardarSesion } from "@/services/storage";
import * as novedades from "@/services/novedades.service";
import { fetchActual, instalarFetch, restaurarFetch } from "../helpers/fetch";

const BASE = "http://10.0.2.2:8000/api/v1";

beforeEach(async () => {
  await AsyncStorage.clear();
  instalarFetch({ cuerpo: {} });
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

describe("consultas simples", () => {
  it("obtiene tipos, estados y prioridades", async () => {
    await novedades.obtenerTiposNovedad();
    await novedades.obtenerEstadosNovedad();
    await novedades.obtenerPrioridadesNovedad();

    expect(url(0)).toBe(`${BASE}/novedades/tipos`);
    expect(url(1)).toBe(`${BASE}/novedades/estados`);
    expect(url(2)).toBe(`${BASE}/novedades/prioridades`);
  });

  it("busca clientes codificando el término", async () => {
    await novedades.buscarClientes("María Gómez");

    expect(url()).toBe(`${BASE}/novedades/clientes-buscar?q=Mar%C3%ADa%20G%C3%B3mez`);
  });

  it("busca clientes sin término", async () => {
    await novedades.buscarClientes();

    expect(url()).toBe(`${BASE}/novedades/clientes-buscar`);
  });

  it("lista pedidos y citas de un cliente", async () => {
    await novedades.pedidosCliente(8);
    await novedades.citasCliente(8);

    expect(url(0)).toBe(`${BASE}/novedades/clientes/8/pedidos`);
    expect(url(1)).toBe(`${BASE}/novedades/clientes/8/citas`);
  });

  it("detalla, lista y obtiene evidencias de novedades", async () => {
    await novedades.obtenerNovedad(11);
    await novedades.listarMisNovedades();
    await novedades.listarNovedadesCliente();
    await novedades.listarCuponesCliente();
    await novedades.obtenerEvidencias(11);

    expect(url(0)).toBe(`${BASE}/novedades/11`);
    expect(url(1)).toBe(`${BASE}/novedades/mis-novedades`);
    expect(url(2)).toBe(`${BASE}/novedades/cliente/novedades`);
    expect(url(3)).toBe(`${BASE}/novedades/cliente/mis-cupones`);
    expect(url(4)).toBe(`${BASE}/novedades/11/evidencias`);
  });
});

describe("crearNovedad", () => {
  it("publica el payload completo", async () => {
    const payload = {
      tipo_novedad: "Producto dañado",
      descripcion: "El paquete llegó abierto",
      prioridad: "alta",
      id_pedido: 3,
      id_cliente: 8,
      lugar_ocurrencia: "Bogotá",
    };

    await novedades.crearNovedad(payload);

    expect(url()).toBe(`${BASE}/novedades`);
    expect(init().method).toBe("POST");
    expect(JSON.parse(String(init().body))).toEqual(payload);
  });
});

describe("enviarMensajeCliente", () => {
  it("publica el mensaje hacia el cliente", async () => {
    await novedades.enviarMensajeCliente(5, {
      mensaje_cliente: "Reprogramamos para mañana",
      solucion_cliente: "Nueva cita",
      cliente_visible: true,
    });

    expect(url()).toBe(`${BASE}/novedades/5/mensaje-cliente`);
    expect(init().method).toBe("POST");
    expect(JSON.parse(String(init().body))).toEqual({
      mensaje_cliente: "Reprogramamos para mañana",
      solucion_cliente: "Nueva cita",
      cliente_visible: true,
    });
  });
});

describe("subirEvidencia", () => {
  const archivo = { uri: "file:///tmp/foto.jpg", name: "foto.jpg", type: "image/jpeg" };

  it("envía multipart con Authorization de la sesión y la descripción", async () => {
    await guardarSesion({
      accessToken: "tok-n",
      refreshToken: "ref",
      userType: "employee",
    });
    instalarFetch({ cuerpo: { id_evidencia_n: 1, url: "http://x", mensaje: "ok" } });

    const respuesta = await novedades.subirEvidencia(5, archivo, "Foto del paquete");

    expect(respuesta).toEqual({ id_evidencia_n: 1, url: "http://x", mensaje: "ok" });
    expect(url()).toBe(`${BASE}/novedades/5/evidencia`);
    expect(init().method).toBe("POST");
    expect((init().headers as Record<string, string>).Authorization).toBe("Bearer tok-n");
    const formData = init().body as FormData;
    expect(formData).toBeInstanceOf(FormData);
    expect(formData.get("file")).toBeTruthy();
    expect(formData.get("descripcion")).toBe("Foto del paquete");
  });

  it("omite la descripción si no se pasa", async () => {
    instalarFetch({ cuerpo: { id_evidencia_n: 2, url: "http://x", mensaje: "ok" } });

    await novedades.subirEvidencia(6, archivo);

    const formData = init().body as FormData;
    expect(formData.get("descripcion")).toBeNull();
  });

  it("propaga el detail del backend ante un error", async () => {
    instalarFetch({ status: 500, cuerpo: { detail: "Archivo demasiado grande" } });

    await expect(novedades.subirEvidencia(6, archivo)).rejects.toThrow(
      "Archivo demasiado grande",
    );
  });

  it("usa un mensaje por defecto si el error no trae detail", async () => {
    instalarFetch({ status: 500, texto: "<html>" });

    await expect(novedades.subirEvidencia(6, archivo)).rejects.toThrow(
      "Error al subir evidencia",
    );
  });

  it("usa el texto por defecto cuando el detail viene vacío (rama del OR)", async () => {
    instalarFetch({ status: 500, cuerpo: {} });

    await expect(novedades.subirEvidencia(6, archivo)).rejects.toThrow(
      "Error al subir evidencia",
    );
  });
});
