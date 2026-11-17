// ─────────────────────────────────────────────────────────────
// Pruebas de services/user.service.ts, contacto.service.ts y
// dispositivos.service.ts: servicios pequeños con contrato simple.
// ─────────────────────────────────────────────────────────────

import * as contacto from "@/services/contacto.service";
import * as dispositivos from "@/services/dispositivos.service";
import { obtenerPerfil } from "@/services/user.service";
import { fetchActual, instalarFetch, restaurarFetch } from "../helpers/fetch";

const BASE = "http://10.0.2.2:8000/api/v1";

beforeEach(() => {
  instalarFetch({ cuerpo: {} });
});

afterEach(() => {
  restaurarFetch();
});

function init(indice = 0): RequestInit {
  return fetchActual().mock.calls[indice][1] as RequestInit;
}

function url(indice = 0): string {
  return fetchActual().mock.calls[indice][0] as string;
}

describe("user.service — obtenerPerfil", () => {
  it("consulta /clients/me para clientes", async () => {
    await obtenerPerfil("client");
    expect(url()).toBe(`${BASE}/clients/me`);
  });

  it("consulta /users/me para empleados", async () => {
    await obtenerPerfil("employee");
    expect(url()).toBe(`${BASE}/users/me`);
  });
});

describe("contacto.service — enviarConsulta", () => {
  it("publica la consulta con el body completo", async () => {
    const datos = {
      nombre: "Ana",
      email: "ana@neodomus.com",
      asunto: "Soporte técnico",
      mensaje: "Mi cortina no responde",
      categoria: "soporte-tecnico",
    };

    await contacto.enviarConsulta(datos);

    expect(url()).toBe(`${BASE}/contacto`);
    expect(init().method).toBe("POST");
    expect(JSON.parse(String(init().body))).toEqual(datos);
  });

  it("declara las 7 categorías válidas del backend", () => {
    expect(Object.keys(contacto.CATEGORIAS_CONSULTA).sort()).toEqual([
      "consulta-general",
      "otro",
      "pago",
      "pedido",
      "reclamo",
      "reembolso",
      "soporte-tecnico",
    ]);
  });
});

describe("dispositivos.service", () => {
  it("consulta los dispositivos", async () => {
    await dispositivos.obtenerDispositivos();
    expect(url()).toBe(`${BASE}/dispositivos`);
  });

  it("enciende por POST /dispositivos/{id}/encender", async () => {
    await dispositivos.encenderDispositivo(3);
    expect(url()).toBe(`${BASE}/dispositivos/3/encender`);
    expect(init().method).toBe("POST");
  });

  it("apaga por POST /dispositivos/{id}/apagar", async () => {
    await dispositivos.apagarDispositivo(5);
    expect(url()).toBe(`${BASE}/dispositivos/5/apagar`);
    expect(init().method).toBe("POST");
  });
});
