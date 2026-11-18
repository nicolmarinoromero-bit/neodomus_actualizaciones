// ─────────────────────────────────────────────────────────────
// Setup global de pruebas.
//
// AsyncStorage se sustituye por la implementación oficial en memoria del
// propio paquete (@react-native-async-storage/async-storage/jest): conserva
// el contrato real (getItem/multiGet/multiSet/multiRemove) sin tocar disco.
// ─────────────────────────────────────────────────────────────

jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// requestAnimationFrame asíncrono de respaldo: el preset nativo puede no
// exponerlo; componentes como AppScreen lo invocan indirectamente.
if (typeof globalThis.requestAnimationFrame !== "function") {
  globalThis.requestAnimationFrame = function (callback) {
    return setTimeout(function () {
      callback(Date.now());
    }, 0);
  };
}

// Requisito de React 19 para que act() funcione en pruebas (los helpers de
// @testing-library/react-native lo asumen).
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
