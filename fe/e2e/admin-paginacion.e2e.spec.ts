import { test, expect, type Page } from '@playwright/test';
import { LoginPage } from './pages/LoginPage';
import { AdminPaginationPage } from './pages/AdminPaginationPage';

// Semana 7 — recorridos de paginación de escritorio y móvil.
const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}; ejecutar mediante scripts/e2e_admin_paginacion.py`);
  return value;
};

const PREFIXO = required('E2E_PREFIXO');
const FILAS_PRIMERA_PAGINA = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10'];
const FILAS_SEGUNDA_PAGINA = ['11', '12', '13', '14', '15'];

async function abrirAdmin(page: Page) {
  const loginPage = new LoginPage(page);
  await loginPage.login(
    required('E2E_ADMIN_EMAIL'),
    required('E2E_ADMIN_PASSWORD'),
    /\/dashboard\/admin$/,
  );
  return new AdminPaginationPage(page);
}

async function verificarTablaPaginada(
  admin: AdminPaginationPage,
  seccion: 'clientes' | 'proveedores' | 'novedades',
  opciones: { movil?: boolean; verificarIdNovedad?: boolean; verificarVacio?: boolean } = {},
) {
  await admin.goto(seccion);
  await admin.search(PREFIXO);
  await expect(admin.tableRows).toHaveCount(10);
  await admin.expectRowNumbers(FILAS_PRIMERA_PAGINA);

  if (opciones.verificarIdNovedad) {
    // El ID real va aparte; la numeración representa la posición de la fila.
    await expect(admin.tableRows.first()).toContainText('ID ');
  }
  if (opciones.movil) await admin.expectPage2Visible();

  await admin.goToPage(2);
  await expect(admin.tableRows).toHaveCount(5);
  await admin.expectRowNumbers(FILAS_SEGUNDA_PAGINA);

  if (opciones.verificarVacio) {
    await admin.search('zzz-no-existe');
    await expect(admin.table).toHaveCount(0);
  }
}

async function verificarTecnicosPaginados(admin: AdminPaginationPage, movil = false) {
  await admin.goto('tecnicos');
  await admin.search(PREFIXO);
  await expect(admin.gridItems).toHaveCount(12);
  await expect(admin.gridItems.first()).toContainText('#1');
  if (movil) await admin.expectPage2Visible();

  await admin.goToPage(2);
  await expect(admin.gridItems).toHaveCount(1);
  await expect(admin.gridItems.first()).toContainText('#13');

  if (!movil) {
    await admin.search('zzz-no-existe');
    await expect(admin.grid).toHaveCount(0);
  }
}

test('clientes: paginación, numeración y vacío', async ({ page }) => {
  await verificarTablaPaginada(await abrirAdmin(page), 'clientes', { verificarVacio: true });
});

test('proveedores: paginación, numeración y vacío', async ({ page }) => {
  await verificarTablaPaginada(await abrirAdmin(page), 'proveedores', { verificarVacio: true });
});

test('novedades: paginación, número vs ID y vacío', async ({ page }) => {
  await verificarTablaPaginada(await abrirAdmin(page), 'novedades', {
    verificarIdNovedad: true,
    verificarVacio: true,
  });
});

test('técnicos: paginación, numeración y vacío', async ({ page }) => {
  await verificarTecnicosPaginados(await abrirAdmin(page));
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
  await verificarTablaPaginada(await abrirAdmin(page), 'clientes', { movil: true });
});

test('proveedores móvil: paginación accesible y numeración', async ({ page }) => {
  await verificarTablaPaginada(await abrirAdmin(page), 'proveedores', { movil: true });
});

test('novedades móvil: paginación accesible y numeración', async ({ page }) => {
  await verificarTablaPaginada(await abrirAdmin(page), 'novedades', {
    movil: true,
    verificarIdNovedad: true,
  });
});

test('técnicos móvil: paginación accesible y numeración', async ({ page }) => {
  await verificarTecnicosPaginados(await abrirAdmin(page), true);
});
