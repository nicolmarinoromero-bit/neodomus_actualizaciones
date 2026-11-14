import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';

// Semana 1 del bootcamp — primer E2E de NeoDomus con estructura AAA.
// Semana 7 — el flujo se expresa con el Page Object LoginPage y se añaden
// pruebas de estabilidad: red lenta y doble envío del formulario.
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

const contarPostsLogin = (page: import('@playwright/test').Page) => {
  let posts = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      new URL(request.url()).pathname.endsWith('/api/v1/auth/login')
    ) {
      posts += 1;
    }
  });
  return () => posts;
};

test('inicio de sesión con credenciales válidas abre la sesión del cliente', async ({ page }) => {
  // ── Arrange ──────────────────────────────────────────────────────────────
  // Cliente de prueba creado por el orquestador con contraseña conocida.
  const loginPage = new LoginPage(page);
  await loginPage.goto();

  // ── Act ──────────────────────────────────────────────────────────────────
  await loginPage.fill(EMAIL!, PASSWORD!);
  const login = await loginPage.submitAndWait();

  // ── Assert ───────────────────────────────────────────────────────────────
  // El contrato responde 200 y la UI muestra la sesión iniciada al usuario.
  expect(login.status()).toBe(200);
  await expect(loginPage.userWelcome).toBeVisible();
});

test('inicio de sesión con contraseña incorrecta muestra el error y no abre sesión', async ({ page }) => {
  // ── Arrange ──────────────────────────────────────────────────────────────
  const loginPage = new LoginPage(page);
  await loginPage.goto();

  // ── Act ──────────────────────────────────────────────────────────────────
  await loginPage.fill(EMAIL!, BAD_PASSWORD!);
  const login = await loginPage.submitAndWait();

  // ── Assert ───────────────────────────────────────────────────────────────
  // El backend rechaza con 401 y el usuario ve el mensaje real de credenciales.
  expect(login.status()).toBe(401);
  await expect(loginPage.errorBox).toBeVisible();
  await expect(loginPage.errorBox).toContainText(MENSAJE_CREDENCIALES_INVALIDAS);
  // La sesión no se abre: el saludo de usuario permanece oculto.
  await expect(loginPage.userWelcome).toHaveCount(0);
});

test('red lenta: el formulario se bloquea mientras responde y no duplica el envío', async ({ page }) => {
  // ── Arrange ──────────────────────────────────────────────────────────────
  const loginPage = new LoginPage(page);
  const posts = contarPostsLogin(page);
  await page.route('**/api/v1/auth/login', async (route) => {
    // Simula 900 ms de latencia de red antes de llegar al backend real.
    await new Promise((resolve) => setTimeout(resolve, 900));
    await route.continue();
  });
  await loginPage.goto();
  await loginPage.fill(EMAIL!, PASSWORD!);

  // ── Act ──────────────────────────────────────────────────────────────────
  const respuesta = loginPage.submitAndWait();

  // ── Assert ───────────────────────────────────────────────────────────────
  // Mientras espera, el botón queda deshabilitado y muestra el estado de carga.
  await expect(loginPage.submitButton).toBeDisabled();
  await expect(loginPage.submitButton).toContainText(/Ingresando/);
  expect((await respuesta).status()).toBe(200);
  await expect(loginPage.userWelcome).toBeVisible();
  expect(posts()).toBe(1);
});

test('doble envío: dos submits simultáneos generan una sola petición', async ({ page }) => {
  // ── Arrange ──────────────────────────────────────────────────────────────
  const loginPage = new LoginPage(page);
  const posts = contarPostsLogin(page);
  await page.route('**/api/v1/auth/login', async (route) => {
    await new Promise((resolve) => setTimeout(resolve, 700));
    await route.continue();
  });
  await loginPage.goto();
  await loginPage.fill(EMAIL!, PASSWORD!);

  // ── Act ──────────────────────────────────────────────────────────────────
  // Dos envíos síncronos del mismo formulario, antes de que React re-renderice
  // el botón deshabilitado: el guard de la aplicación debe descartar el segundo.
  const respuesta = page.waitForResponse(
    (r) =>
      r.url().endsWith('/api/v1/auth/login') &&
      r.request().method() === 'POST',
  );
  await page.locator('form.login-card').evaluate((form) => {
    const formulario = form as HTMLFormElement;
    formulario.requestSubmit();
    formulario.requestSubmit();
  });

  // ── Assert ───────────────────────────────────────────────────────────────
  expect((await respuesta).status()).toBe(200);
  await expect(loginPage.userWelcome).toBeVisible();
  expect(posts()).toBe(1);
});