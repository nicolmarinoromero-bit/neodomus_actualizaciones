// ─────────────────────────────────────────────────────────────
// Tests de CookieConsentContext: banner de primera visita, aceptar /
// rechazar / configurar, persistencia en AsyncStorage y apertura del
// centro de privacidad.
//
// Se usa el provider real (su árbol incluye el banner y el modal) con
// una sonda que expone el estado por testID. safe-area con el mock
// oficial y expo-router con funciones de navegación estables.
// ─────────────────────────────────────────────────────────────

jest.mock("expo-router", () => {
  const push = jest.fn();
  return {
    router: { push },
    useRouter: () => ({ push, back: jest.fn(), navigate: jest.fn() }),
    useFocusEffect: jest.fn(),
  };
});

jest.mock("react-native-safe-area-context", () =>
  require("react-native-safe-area-context/jest/mock").default,
);

import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
  waitFor,
} from "@testing-library/react-native";
import React from "react";
import { Linking, Text } from "react-native";
import {
  CookieConsentProvider,
  useCookieConsent,
} from "@/contexts/CookieConsentContext";
import { limpiarAlmacenamiento, sembrarAlmacenamiento } from "../helpers/almacenamiento";

const CLAVE = "neodomus_cookie_consent";
const pushMock = (require("expo-router") as { router: { push: jest.Mock } }).router.push;

function Sonda() {
  const { estado, mostrarConfiguracion } = useCookieConsent();
  return (
    <React.Fragment>
      <Text testID="estado-sonda">{estado.decidido ? "decidido" : "pendiente"}</Text>
      <Text onPress={mostrarConfiguracion}>ABRIR-CONFIG</Text>
    </React.Fragment>
  );
}

async function montar() {
  await act(async () => {
    render(
      <CookieConsentProvider>
        <Sonda />
      </CookieConsentProvider>,
    );
    // Drena la carga asíncrona de AsyncStorage iniciada por el efecto del proveedor.
    await AsyncStorage.getItem(CLAVE);
  });
  await waitFor(() => expect(screen.getByTestId("estado-sonda")).toBeTruthy());
}

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(async () => {
  await limpiarAlmacenamiento();
});

describe("useCookieConsent", () => {
  it("lanza error fuera del proveedor", async () => {
    await expect(renderHook(() => useCookieConsent())).rejects.toThrow(
      "useCookieConsent debe usarse dentro de <CookieConsentProvider>",
    );
  });
});

describe("primera visita", () => {
  it("muestra el banner hasta que el usuario decide", async () => {
    await montar();
    await waitFor(() =>
      expect(
        screen.getByText("Usamos cookies para mejorar tu experiencia en Neodomus."),
      ).toBeTruthy(),
    );
    expect(screen.getByTestId("estado-sonda").props.children).toBe("pendiente");
  });

  it("Aceptar cookies guarda todo activado y el banner desaparece", async () => {
    await montar();
    await waitFor(() =>
      expect(screen.getByText("Aceptar cookies")).toBeTruthy(),
    );

    fireEvent.press(screen.getByText("Aceptar cookies"));

    await waitFor(() =>
      expect(screen.getByTestId("estado-sonda").props.children).toBe("decidido"),
    );
    const crudo = await AsyncStorage.getItem(CLAVE);
    const guardado = JSON.parse(crudo ?? "{}") as Record<string, unknown>;
    expect(guardado.esenciales).toBe(true);
    expect(guardado.preferencias).toBe(true);
    expect(guardado.analisis).toBe(true);
    expect(typeof guardado.fecha).toBe("string");
    await waitFor(() =>
      expect(
        screen.queryByText("Usamos cookies para mejorar tu experiencia en Neodomus."),
      ).toBeNull(),
    );
  });

  it("Rechazar guarda solo esenciales", async () => {
    await montar();
    await waitFor(() => expect(screen.getByText("Rechazar")).toBeTruthy());

    fireEvent.press(screen.getByText("Rechazar"));

    await waitFor(() =>
      expect(screen.getByTestId("estado-sonda").props.children).toBe("decidido"),
    );
    const crudo = await AsyncStorage.getItem(CLAVE);
    const guardado = JSON.parse(crudo ?? "{}") as Record<string, unknown>;
    expect(guardado.esenciales).toBe(true);
    expect(guardado.preferencias).toBe(false);
    expect(guardado.analisis).toBe(false);
  });

  it("el enlace al centro de privacidad navega a su ruta", async () => {
    await montar();
    await waitFor(() =>
      expect(screen.getByText("Centro de privacidad")).toBeTruthy(),
    );

    fireEvent.press(screen.getByText("Centro de privacidad"));
    expect(pushMock).toHaveBeenCalledWith("/centro-privacidad");
  });
});

describe("configuración de cookies", () => {
  it("Configurar cookies abre el modal con esenciales fijas y guarda la selección", async () => {
    await montar();
    await waitFor(() => expect(screen.getByText("Configurar cookies")).toBeTruthy());

    fireEvent.press(screen.getByText("Configurar cookies"));
    // Al abrir el modal el banner se oculta, así que "Configurar cookies"
    // queda solo en el título del modal.
    await waitFor(() =>
      expect(screen.getByText("Guardar preferencias")).toBeTruthy(),
    );
    expect(screen.getByText("Esenciales")).toBeTruthy();
    expect(screen.getByText("Preferencias")).toBeTruthy();
    expect(screen.getByText("Análisis")).toBeTruthy();
    // RN emite el onValueChange del Switch como onChange en el host
    // (RCTSwitch), con el valor dentro de nativeEvent.
    const interruptores = screen.getAllByRole("switch");
    expect(interruptores).toHaveLength(3);
    const [esenciales, interruptorPreferencias] = interruptores;
    expect(esenciales.props.disabled).toBe(true);
    // Activar "Preferencias" (Análisis queda en falso) y guardar.
    await fireEvent(interruptorPreferencias, "change", {
      nativeEvent: { value: true },
    });

    fireEvent.press(screen.getByText("Guardar preferencias"));
    await waitFor(() =>
      expect(screen.getByTestId("estado-sonda").props.children).toBe("decidido"),
    );
    const crudo = await AsyncStorage.getItem(CLAVE);
    const guardado = JSON.parse(crudo ?? "{}") as Record<string, unknown>;
    expect(guardado.preferencias).toBe(true);
    expect(guardado.analisis).toBe(false);
    // El modal se cierra al guardar.
    await waitFor(() =>
      expect(screen.queryByText("Guardar preferencias")).toBeNull(),
    );
  });

  it("el enlace de soporte abre el correo", async () => {
    const abrirURL = jest
      .spyOn(Linking, "openURL")
      .mockImplementation(async () => undefined);
    await montar();
    await waitFor(() => expect(screen.getByText("Configurar cookies")).toBeTruthy());

    fireEvent.press(screen.getByText("Configurar cookies"));
    await waitFor(() =>
      expect(screen.getByText("Guardar preferencias")).toBeTruthy(),
    );

    fireEvent.press(
      screen.getByText("¿Dudas? escríbenos a soporte@neodomus.com"),
    );
    expect(abrirURL).toHaveBeenCalledWith("mailto:soporte@neodomus.com");
  });
});

describe("consentimiento previo", () => {
  it("con decisión guardada el banner no reaparece", async () => {
    await sembrarAlmacenamiento({
      [CLAVE]: JSON.stringify({
        esenciales: true,
        preferencias: true,
        analisis: false,
        fecha: "2026-01-01T00:00:00.000Z",
      }),
    });
    await montar();

    expect(screen.getByTestId("estado-sonda").props.children).toBe("decidido");
    expect(
      screen.queryByText("Usamos cookies para mejorar tu experiencia en Neodomus."),
    ).toBeNull();
  });

  it("consentimiento corrupto se trata como primera visita", async () => {
    await sembrarAlmacenamiento({ [CLAVE]: "no-json" });
    await montar();

    expect(screen.getByTestId("estado-sonda").props.children).toBe("pendiente");
    await waitFor(() =>
      expect(
        screen.getByText("Usamos cookies para mejorar tu experiencia en Neodomus."),
      ).toBeTruthy(),
    );
  });

  it("mostrarConfiguracion reabre el modal con las preferencias guardadas", async () => {
    await sembrarAlmacenamiento({
      [CLAVE]: JSON.stringify({
        esenciales: true,
        preferencias: true,
        analisis: true,
        fecha: "2026-01-01T00:00:00.000Z",
      }),
    });
    await montar();
    expect(screen.queryByText("Guardar preferencias")).toBeNull();

    fireEvent.press(screen.getByText("ABRIR-CONFIG"));
    await waitFor(() => expect(screen.getByText("Guardar preferencias")).toBeTruthy());

    // Guardar sin tocar nada persiste la selección precargada: los
    // interruptores quedaron inicializados con lo guardado.
    fireEvent.press(screen.getByText("Guardar preferencias"));
    await waitFor(() =>
      expect(screen.queryByText("Guardar preferencias")).toBeNull(),
    );
    const crudo = await AsyncStorage.getItem(CLAVE);
    const guardado = JSON.parse(crudo ?? "{}") as Record<string, unknown>;
    expect(guardado.preferencias).toBe(true);
    expect(guardado.analisis).toBe(true);
    expect(typeof guardado.fecha).toBe("string");
  });
});
