// ─────────────────────────────────────────────────────────────
// Tests de useImagenAutenticada / fetchImagenAutenticada: descarga
// la evidencia con header Authorization y la convierte a data-URI
// (el <Image> nativo no puede adjuntar tokens).
//
// El entorno nativo de jest no tiene FileReader: se instala un
// sustituto mínimo que cumple el contrato usado por el hook.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import {
  fetchImagenAutenticada,
  useImagenAutenticada,
} from "@/hooks/useAuthImage";
import { API_BASE_URL } from "@/constants/api";
import {
  instalarFetch,
  fetchActual,
  restaurarFetch,
  type LlamadaFetch,
  type ReglaRespuesta,
} from "../helpers/fetch";
import { limpiarAlmacenamiento, sembrarAlmacenamiento } from "../helpers/almacenamiento";

// ── Sustituto de FileReader ──────────────────────────────────
class FileReaderFalso {
  result: string | null = null;
  onloadend: (() => void) | null = null;
  onerror: (() => void) | null = null;
  fallar = false;

  readAsDataURL(blob: Blob): void {
    if (this.fallar) {
      queueMicrotask(() => this.onerror?.());
      return;
    }
    blob
      .arrayBuffer()
      .then((bytes) => {
        let binaria = "";
        new Uint8Array(bytes).forEach((b) => {
          binaria += String.fromCharCode(b);
        });
        this.result = `data:image/jpeg;base64,${btoa(binaria)}`;
        queueMicrotask(() => this.onloadend?.());
      })
      .catch(() => this.onerror?.());
  }
}

const FileReaderOriginal = (globalThis as { FileReader?: unknown }).FileReader;
beforeAll(() => {
  (globalThis as { FileReader?: unknown }).FileReader = FileReaderFalso;
});
afterAll(() => {
  (globalThis as { FileReader?: unknown }).FileReader = FileReaderOriginal;
});

function router(
  reglas: Record<string, ReglaRespuesta>,
): (llamada: LlamadaFetch) => ReglaRespuesta {
  return (llamada: LlamadaFetch) => {
    const ruta = llamada.url.replace(API_BASE_URL, "");
    if (ruta in reglas) return reglas[ruta];
    return { status: 404, cuerpo: {} };
  };
}

const asentar = async () => {
  await act(async () => {
    await new Promise((r) => setTimeout(r, 0));
  });
};

afterEach(() => {
  restaurarFetch();
});

beforeEach(async () => {
  await limpiarAlmacenamiento();
});

describe("fetchImagenAutenticada", () => {
  it("descarga rutas relativas contra la API y devuelve data-URI", async () => {
    await sembrarAlmacenamiento({
      "neodomus.session.access_token": "tok",
      "neodomus.session.refresh_token": "tok-r",
      "neodomus.session.user_type": "client",
    });
    instalarFetch(router({ "/media/evidencias/1.jpg": { texto: "contenido" } }));

    const uri = await fetchImagenAutenticada("/media/evidencias/1.jpg");

    const [url, init] = fetchActual().mock.calls[0] as [string, RequestInit];
    expect(url).toBe(`${API_BASE_URL}/media/evidencias/1.jpg`);
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(uri).toMatch(/^data:image\/jpeg;base64,/);
  });

  it("conserva las URLs absolutas y adjunta el token si hay sesión", async () => {
    await sembrarAlmacenamiento({
      "neodomus.session.access_token": "tok",
      "neodomus.session.refresh_token": "tok-r",
      "neodomus.session.user_type": "client",
    });
    instalarFetch(router({ "http://cdn.ejemplo.com/foto.jpg": { texto: "contenido" } }));

    await fetchImagenAutenticada("http://cdn.ejemplo.com/foto.jpg");

    const [url] = fetchActual().mock.calls[0] as [string, RequestInit];
    expect(url).toBe("http://cdn.ejemplo.com/foto.jpg");
  });

  it("sin sesión descarga sin header Authorization", async () => {
    instalarFetch(router({ "/media/x.jpg": { texto: "contenido" } }));

    await fetchImagenAutenticada("/media/x.jpg");

    const [, init] = fetchActual().mock.calls[0] as [string, RequestInit];
    expect(init.headers).toEqual({});
  });

  it("respuestas que no son 200 lanzan HTTP <status>", async () => {
    instalarFetch(router({ "/media/rota.jpg": { status: 404, cuerpo: {} } }));

    await expect(fetchImagenAutenticada("/media/rota.jpg")).rejects.toThrow("HTTP 404");
  });

  it("si el lector de la evidencia falla, lanza un error claro", async () => {
    instalarFetch(router({ "/media/x.jpg": { texto: "contenido" } }));
    // Próxima instancia del lector fallará al leer.
    const lectorOriginal = FileReaderFalso.prototype.readAsDataURL;
    FileReaderFalso.prototype.readAsDataURL = function (this: FileReaderFalso) {
      this.fallar = true;
      lectorOriginal.call(this, new Blob());
    };

    await expect(fetchImagenAutenticada("/media/x.jpg")).rejects.toThrow(
      "No se pudo leer la evidencia",
    );

    FileReaderFalso.prototype.readAsDataURL = lectorOriginal;
  });
});

describe("useImagenAutenticada", () => {
  it("URL vacía: estado en reposo y sin peticiones", async () => {
    instalarFetch(router({}));
    const { result } = await renderHook(() => useImagenAutenticada(null));
    await asentar();

    expect(result.current).toEqual({ uri: null, loading: false, error: false });
    expect(fetchActual()).not.toHaveBeenCalled();
  });

  it("carga la imagen con URL y pasa por loading", async () => {
    instalarFetch(router({ "/media/1.jpg": { texto: "contenido" } }));
    const { result, rerender } = await renderHook(
      ({ url }: { url: string | null }) => useImagenAutenticada(url),
      { initialProps: { url: null as string | null } },
    );
    await asentar();
    expect(result.current.loading).toBe(false);

    await rerender({ url: "/media/1.jpg" });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.uri).toMatch(/^data:image\/jpeg;base64,/);
    expect(result.current.error).toBe(false);
  });

  it("fallo de descarga marca error y no deja URI", async () => {
    instalarFetch(router({ "/media/rota.jpg": { status: 500, cuerpo: {} } }));
    const { result, rerender } = await renderHook(
      ({ url }: { url: string | null }) => useImagenAutenticada(url),
      { initialProps: { url: null as string | null } },
    );
    await asentar();

    await rerender({ url: "/media/rota.jpg" });
    await waitFor(() => expect(result.current.error).toBe(true));
    expect(result.current.uri).toBeNull();
    expect(result.current.loading).toBe(false);
  });

  it("desmontar a null limpia el estado", async () => {
    instalarFetch(router({ "/media/1.jpg": { texto: "contenido" } }));
    const { result, rerender } = await renderHook(
      ({ url }: { url: string | null }) => useImagenAutenticada(url),
      { initialProps: { url: "/media/1.jpg" as string | null } },
    );
    await waitFor(() => expect(result.current.uri).not.toBeNull());

    await rerender({ url: null });
    expect(result.current).toEqual({ uri: null, loading: false, error: false });
  });
});
