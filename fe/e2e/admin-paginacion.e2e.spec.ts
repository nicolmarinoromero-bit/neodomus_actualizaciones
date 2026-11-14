import { test, expect } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { AdminPaginationPage } from './pages/AdminPaginationPage';

// Semana 7 — los listados administrativos usan LoginPage y
// AdminPaginationPage; la numeración se espera con expect.poll (sin esperas
// fijas) y se conservan los recorridos de escritorio y móvil.

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}; ejecutar mediante scripts/e2e_admin_paginacion.py`);
  return value;
};

const PREFIXO = required('E2E_PREFIXO');

const abrirAdmin = async (page: import('@playwright/test').Page) => {
  const loginPage = new LoginPage(page);
  await loginPage.login(
    required('E2E_ADMIN_EMAIL'),
    required('E2E_ADMIN_PASSWORD'),
    /\/dashboard\/admin$/,
  );
  return new AdminPaginationPage(page);
};

test('clientes: paginación, numeración y vacío', async ({ page }) => {
  const admin = await abrirAdmin(page);
  await admin.goto('clientes');

  await admin.search(PREFIXO);
  await expect(admin.tableRows).toHaveCount(10);
  await admin.expectRowNumbers(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

  await admin.goToPage(2);
  await expect(admin.tableRows).toHaveCount(5);
  await admin.expectRowNumbers(['11', '12', '13', '14', '15']);

  await admin.search('zzz-no-existe');
  await expect(admin.table).toHaveCount(0);
});

test('proveedores: paginación, numeración y vacío', async ({ page }) => {
  const admin = await abrirAdmin(page);
  await admin.goto('proveedores');

  await admin.search(PREFIXO);
  await expect(admin.tableRows).toHaveCount(10);
  await admin.expectRowNumbers(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

  await admin.goToPage(2);
  await expect(admin.tableRows).toHaveCount(5);
  await admin.expectRowNumbers(['11', '12', '13', '14', '15']);

  await admin.search('zzz-no-existe');
  await expect(admin.table).toHaveCount(0);
});

test('novedades: paginación, número vs ID y vacío', async ({ page }) => {
  const admin = await abrirAdmin(page);
  await admin.goto('novedades');

  await admin.search(PREFIXO);
  await expect(admin.tableRows).toHaveCount(10);
  await admin.expectRowNumbers(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);
  // El ID real se muestra aparte (columna Tipo), no como número de fila.
  await expect(admin.tableRows.first()).toContainText('ID ');

  await admin.goToPage(2);
  await expect(admin.tableRows).toHaveCount(5);
  await admin.expectRowNumbers(['11', '12', '13', '14', '15']);

  await admin.search('zzz-no-existe');
  await expect(admin.table).toHaveCount(0);
});

test('técnicos: paginación, numeración y vacío', async ({ page }) => {
  const admin = await abrirAdmin(page);
  await admin.goto('tecnicos');

  await admin.search(PREFIXO);
  await expect(admin.gridItems).toHaveCount(12);
  await expect(admin.gridItems.first()).toContainText('#1');

  await admin.goToPage(2);
  await expect(admin.gridItems).toHaveCount(1);
  await expect(admin.gridItems.first()).toContainText('#13');

  await admin.search('zzz-no-existe');
  await expect(admin.grid).toHaveCount(0);
});

test('novedades: error de carga muestra reintento, no lista vacía', async ({ page }) => {
  const loginPage = new LoginPage(page);
  await loginPage.login(
    required('E2E_ADMIN_EMAIL'),
    required('E2E_ADMIN_PASSWORD'),
    /\/dashboard\/admin$/,
  );
  await page.route(/\/api\/v1\/novedades(\?.*)?$/, (route) =>
    route.fulfill({ status: 500, body: '{}' }),
  );
  // La vista de error no monta la tabla: se navega sin exigirla.
  await page.goto('/admin/novedades');

  await expect(page.getByRole('button', { name: /Reintentar/ })).toBeVisible();
  await expect(page.getByText('No se pudieron cargar las novedades')).toBeVisible();
});

test.use({ viewport: { width: 390, height: 844 } });
test('clientes móvil: controles de paginación visibles y utilizables', async ({ page }) => {
  const admin = await abrirAdmin(page);
  await admin.goto('clientes');

  await admin.search(PREFIXO);
  await expect(admin.tableRows).toHaveCount(10);

  await admin.expectPage2Visible();
  await admin.goToPage(2);
  await expect(admin.tableRows).toHaveCount(5);
});

test('proveedores móvil: paginación accesible y numeración', async ({ page }) => {
  const admin = await abrirAdmin(page);
  await admin.goto('proveedores');

  await admin.search(PREFIXO);
  await expect(admin.tableRows).toHaveCount(10);
  await admin.expectRowNumbers(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

  await admin.expectPage2Visible();
  await admin.goToPage(2);
  await expect(admin.tableRows).toHaveCount(5);
  await admin.expectRowNumbers(['11', '12', '13', '14', '15']);
});

test('novedades móvil: paginación accesible y numeración', async ({ page }) => {
  const admin = await abrirAdmin(page);
  await admin.goto('novedades');

  await admin.search(PREFIXO);
  await expect(admin.tableRows).toHaveCount(10);
  await admin.expectRowNumbers(['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']);

  await admin.expectPage2Visible();
  await admin.goToPage(2);
  await expect(admin.tableRows).toHaveCount(5);
  await admin.expectRowNumbers(['11', '12', '13', '14', '15']);
});

test('técnicos móvil: paginación accesible y numeración', async ({ page }) => {
  const admin = await abrirAdmin(page);
  await admin.goto('tecnicos');

  await admin.search(PREFIXO);
  await expect(admin.gridItems).toHaveCount(12);
  await expect(admin.gridItems.first()).toContainText('#1');

  await admin.expectPage2Visible();
  await admin.goToPage(2);
  await expect(admin.gridItems).toHaveCount(1);
  await expect(admin.gridItems.first()).toContainText('#13');
});