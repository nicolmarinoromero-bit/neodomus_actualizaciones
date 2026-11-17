// ─────────────────────────────────────────────────────────────
// Pruebas de services/storage.ts (persistencia local de la sesión).
// Usa el mock oficial en memoria de AsyncStorage (jest.setup.js).
// ─────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";
import { limpiarAlmacenamiento } from "../helpers/almacenamiento";
import {
  borrarSesion,
  guardarSesion,
  obtenerSesion,
  type SesionGuardada,
} from "@/services/storage";

const sesionCompleta: SesionGuardada = {
  accessToken: "access-1",
  refreshToken: "refresh-1",
  userType: "client",
  correo: "ana@neodomus.com",
  rol: "cliente",
};

const CLAVES = [
  "neodomus.session.access_token",
  "neodomus.session.refresh_token",
  "neodomus.session.user_type",
  "neodemus.session.correo",
  "neodomus.session.rol",
];

beforeEach(async () => {
  await limpiarAlmacenamiento();
});

describe("guardarSesion", () => {
  it("persiste tokens, tipo de usuario, correo y rol", async () => {
    await guardarSesion(sesionCompleta);

    for (const [indice, clave] of CLAVES.entries()) {
      expect(await AsyncStorage.getItem(clave)).not.toBeNull();
    }
    expect(await AsyncStorage.getItem(CLAVES[2])).toBe("client");
    expect(await AsyncStorage.getItem(CLAVES[3])).toBe("ana@neodomus.com");
    expect(await AsyncStorage.getItem(CLAVES[4])).toBe("cliente");
  });

  it("no persiste correo ni rol cuando no vienen", async () => {
    await guardarSesion({ accessToken: "a", refreshToken: "r", userType: "employee" });

    expect(await AsyncStorage.getItem(CLAVES[3])).toBeNull();
    expect(await AsyncStorage.getItem(CLAVES[4])).toBeNull();
  });
});

describe("obtenerSesion", () => {
  it("reconstruye la sesión guardada", async () => {
    await guardarSesion(sesionCompleta);
    await expect(obtenerSesion()).resolves.toEqual(sesionCompleta);
  });

  it("devuelve null sin tokens completos", async () => {
    await guardarSesion({ accessToken: "a", refreshToken: "r", userType: "client" });
    await AsyncStorage.removeItem("neodomus.session.refresh_token");
    await expect(obtenerSesion()).resolves.toBeNull();

    await AsyncStorage.setItem("neodomus.session.refresh_token", "r");
    await AsyncStorage.removeItem("neodomus.session.access_token");
    await expect(obtenerSesion()).resolves.toBeNull();
  });

  it("devuelve null con un userType desconocido", async () => {
    await AsyncStorage.multiSet([
      ["neodomus.session.access_token", "a"],
      ["neodomus.session.refresh_token", "r"],
      ["neodomus.session.user_type", "invitado"],
    ]);
    await expect(obtenerSesion()).resolves.toBeNull();
  });

  it("devuelve null con el almacenamiento vacío", async () => {
    await expect(obtenerSesion()).resolves.toBeNull();
  });

  it("usa rol null y correo indefinido cuando faltan", async () => {
    await guardarSesion({ accessToken: "a", refreshToken: "r", userType: "employee" });
    const sesion = await obtenerSesion();
    expect(sesion).toEqual({
      accessToken: "a",
      refreshToken: "r",
      userType: "employee",
      correo: undefined,
      rol: null,
    });
  });
});

describe("borrarSesion", () => {
  it("elimina todas las claves de sesión", async () => {
    await guardarSesion(sesionCompleta);
    await borrarSesion();

    for (const clave of CLAVES) {
      expect(await AsyncStorage.getItem(clave)).toBeNull();
    }
    await expect(obtenerSesion()).resolves.toBeNull();
  });
});
