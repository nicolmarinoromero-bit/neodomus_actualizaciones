// ─────────────────────────────────────────────────────────────
// Helper de AsyncStorage: el mock global (jest.setup.js) es en memoria,
// así que cada prueba parte limpio llamando a esta función.
// ─────────────────────────────────────────────────────────────

import AsyncStorage from "@react-native-async-storage/async-storage";

export async function limpiarAlmacenamiento(): Promise<void> {
  await AsyncStorage.clear();
}

/** Guarda valores crudos (JSON como texto) para preparar escenarios. */
export async function sembrarAlmacenamiento(valores: Record<string, string>): Promise<void> {
  for (const [clave, valor] of Object.entries(valores)) {
    await AsyncStorage.setItem(clave, valor);
  }
}
