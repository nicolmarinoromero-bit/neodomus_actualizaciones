import { test, expect, type Page } from '@playwright/test';

// Semana 1 del bootcamp — primer E2E de NeoDomus con estructura AAA.
// Flujo: inicio de sesión del cliente (autenticación real contra el backend).
// Ejecutar SIEMPRE mediante scripts/e2e_login.py (fixtures aislados + limpieza).
// Las credenciales llegan por entorno; nunca se hardcodean cuentas reales.

const EMAIL = process.env.E2E_LOGIN_EMAIL;
const PASSWORD = process.env.E2E_LOGIN_PASSWORD;
const BAD_PASSWORD = process.env.E2E_LOGIN_BAD_PASSWORD;
const MENSAJE_CREDENCIALES_INVALIDAS =
  'Correo o contraseña incorrectos. Verifica tus datos e inténtalo de nuevo.';

if (!EMAIL || !PASSWORD || !BAD_PASSWORD) {
  throw new Error('Ejecutar mediante scripts/e2e_login.py con fixtures aislados');
}

// Arrange compartido: formularios de login accesibles (rol/label, no CSS frágil).
async function abrirLogin(page: Page) {
  await page.goto('/login');
  const correo = page.getByLabel('Correo electrónico');
  const contrasena = page.getByLabel('Contraseña');
  await expect(correo).toBeEditable();
  await expect(contrasena).toBeEditable();
  return { correo, contrasena };
}

test('inicio de sesión con credenciales válidas abre la sesión del cliente', async ({ page }) => {
  // ── Arrange ──────────────────────────────────────────────────────────────
  // Cliente de prueba creado por el orquestador con contraseña conocida.
  const { correo, contrasena } = await abrirLogin(page);

  // ── Act ──────────────────────────────────────────────────────────────────
  await correo.fill(EMAIL!);
  await contrasena.fill(PASSWORD!);
  const respuestaLogin = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/auth/login') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  const login = await respuestaLogin;

  // ── Assert ───────────────────────────────────────────────────────────────
  // El contrato responde 200 y la UI muestra la sesión iniciada al usuario.
  expect(login.status()).toBe(200);
  await expect(page.locator('.user-welcome')).toBeVisible();
});

test('inicio de sesión con contraseña incorrecta muestra el error y no abre sesión', async ({ page }) => {
  // ── Arrange ──────────────────────────────────────────────────────────────
  const { correo, contrasena } = await abrirLogin(page);

  // ── Act ──────────────────────────────────────────────────────────────────
  await correo.fill(EMAIL!);
  await contrasena.fill(BAD_PASSWORD!);
  const respuestaLogin = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/auth/login') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Ingresar', exact: true }).click();
  const login = await respuestaLogin;

  // ── Assert ───────────────────────────────────────────────────────────────
  // El backend rechaza con 401 y el usuario ve el mensaje real de credenciales.
  expect(login.status()).toBe(401);
  await expect(page.locator('.login-error-box')).toBeVisible();
  await expect(page.locator('.login-error-box')).toContainText(MENSAJE_CREDENCIALES_INVALIDAS);
  // La sesión no se abre: el saludo de usuario permanece oculto.
  await expect(page.locator('.user-welcome')).toHaveCount(0);
});
