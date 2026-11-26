import { test, expect } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { LoginPage } from './pages/LoginPage';
import { CartCheckoutPage } from './pages/CartCheckoutPage';
import {
  AdminProductosPage,
  type FiltroProductos,
} from './pages/AdminProductosPage';

// Semana 7 — el flujo crítico de compra se expresa con Page Objects
// (LoginPage, CartCheckoutPage y AdminProductosPage) y se eliminan las
// esperas fijas: la estabilidad se comprueba con expect.poll determinista.

const required = (name: string) => {
  const value = process.env[name];
  if (!value) throw new Error(`Falta ${name}; ejecutar mediante scripts/e2e_cart_checkout.py`);
  return value;
};

/** Espera una ventana de tranquilidad y falla si llegan peticiones nuevas. */
const esperarSinNuevasPeticiones = async (contar: () => number) => {
  const antes = contar();
  await expect
    .poll(
      async () => {
        await new Promise((resolve) => setTimeout(resolve, 600));
        return contar();
      },
      { timeout: 3000, intervals: [600] },
    )
    .toBe(antes);
};

test('checkout real por variante y metros con refresco de precio y sin solicitudes repetidas', async ({ page }) => {
  const email = required('E2E_CLIENT_EMAIL');
  const password = required('E2E_CLIENT_PASSWORD');
  const unitId = Number(required('E2E_UNIT_PRODUCT_ID'));
  const metresId = Number(required('E2E_METRES_PRODUCT_ID'));
  const variantId = Number(required('E2E_UNIT_VARIANT_ID'));

  const loginPage = new LoginPage(page);
  const cart = new CartCheckoutPage(page);

  await loginPage.login(email, password, /\/productos$/);

  await cart.addUnitProduct(unitId, 2);
  await cart.addMetresProduct(metresId, 3, '0.5 m', /1[.,]5 m en total/);
  await cart.openCart(2);

  const stale = await cart.storedItems<{ precio_venta_producto: number }>();
  expect(stale).toHaveLength(2);
  for (const item of stale) item.precio_venta_producto = 1;
  await cart.replaceStoredItems(stale);

  const detailRequests: string[] = [];
  page.on('request', (request) => {
    if (request.method() !== 'GET') return;
    const pathname = new URL(request.url()).pathname;
    if (pathname.endsWith(`/api/v1/productos/${unitId}`) || pathname.endsWith(`/api/v1/productos/${metresId}`)) {
      detailRequests.push(pathname);
    }
  });

  await cart.reloadCart(2);
  await expect(cart.subtotals.nth(0)).toContainText('$1.500');
  await expect(cart.subtotals.nth(1)).toContainText('$1.500');
  await expect(cart.total).toContainText('$3.000');

  // El refresco de precios ocurre una sola vez: tras la ventana de espera no
  // deben aparecer nuevas peticiones de detalle (no hay bucle de efectos).
  await expect.poll(() => detailRequests.length, { timeout: 3000 }).toBeGreaterThan(0);
  await esperarSinNuevasPeticiones(() => detailRequests.length);

  await cart.goToCheckout();
  await expect(page.locator('.checkout-resumen-items')).toContainText(/1[.,]5 m/);

  const pay = cart.payButton;
  let orderPosts = 0;
  page.on('request', (request) => {
    if (request.method() === 'POST' && new URL(request.url()).pathname.endsWith('/api/v1/pedidos')) {
      orderPosts += 1;
    }
  });

  await pay.click();
  await expect(page.locator('.checkout-error')).toContainText('Completa los datos de la tarjeta');
  expect(orderPosts).toBe(0);

  await page.locator('button.checkout-metodo').filter({ hasText: 'PSE' }).click();
  await expect(cart.cardNumber).toHaveCount(0);
  // SelectorBanco compartido: botón con popup listbox (no <select> nativo);
  // el placeholder visible es "Selecciona tu banco".
  const bancoTrigger = page.locator('button.checkout-banco-trigger');
  await expect(bancoTrigger).toBeVisible();
  await expect(bancoTrigger).toContainText('Selecciona tu banco');
  await page.locator('button.checkout-metodo').filter({ hasText: 'Tarjeta' }).first().click();
  await expect(cart.cardNumber).toHaveValue('');
  await expect(pay).toBeEnabled();

  await cart.fillCard({
    numero: '4242424242424242',
    titular: 'Cliente E2E',
    expiracion: '12/30',
    cvv: '123',
  });
  await cart.selectSimulation('rechazado');

  const rejectedPromise = page.waitForResponse(
    (r) => r.url().endsWith('/api/v1/pedidos') && r.request().method() === 'POST',
  );
  await pay.click();
  const rejectedResponse = await rejectedPromise;
  expect(rejectedResponse.status()).toBe(200);
  const rejected = await rejectedResponse.json();
  expect(rejected.pago.estado).toBe('rechazado');
  await expect(page.getByRole('heading', { name: 'Pago rechazado' })).toBeVisible();
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem('neodomus_carrito') || '[]').length)).toBe(2);
  expect(orderPosts).toBe(1);

  await page.getByRole('button', { name: /Reintentar pago/ }).click();
  await expect(cart.cardHolder).toHaveValue('Cliente E2E');
  await expect(cart.cardExpiry).toHaveValue('12/30');
  await expect(cart.cardNumber).toHaveValue('');
  await expect(cart.cardCvv).toHaveValue('');
  await cart.cardNumber.fill('4242424242424242');
  await cart.cardCvv.fill('123');
  await cart.selectSimulation('aprobado');

  let retryPosts = 0;
  page.on('request', (request) => {
    if (
      request.method() === 'POST' &&
      /\/api\/v1\/pedidos\/\d+\/reintentar-pago$/.test(new URL(request.url()).pathname)
    ) {
      retryPosts += 1;
    }
  });
  const retryPromise = page.waitForResponse(
    (r) =>
      r.request().method() === 'POST' &&
      /\/api\/v1\/pedidos\/\d+\/reintentar-pago$/.test(new URL(r.url()).pathname),
  );
  await pay.dblclick();
  const retryResponse = await retryPromise;
  expect(retryResponse.status()).toBe(200);
  await expect(cart.successDialog).toBeVisible();
  expect(retryPosts).toBe(1);
  expect(orderPosts).toBe(1);

  const payload = rejectedResponse.request().postDataJSON();
  expect(payload.items).toHaveLength(2);
  const unitItem = payload.items.find((item: any) => item.id_producto === unitId);
  const metresItem = payload.items.find((item: any) => item.id_producto === metresId);
  expect(unitItem).toMatchObject({ id_producto: unitId, cantidad: 2, id_variante: variantId });
  expect(metresItem).toMatchObject({ id_producto: metresId, cantidad: 1, metros: 1.5 });

  const body = await retryResponse.json();
  const orderId = body.pedido.id_pedido;
  expect(orderId).toBe(rejected.pedido.id_pedido);
  expect(body.pago.estado).toBe('aprobado');
  expect(Number(body.factura.monto_total)).toBe(3000);

  await expect(cart.successDialog).toContainText(`#${orderId}`);
  await expect(cart.successDialog.locator('.checkout-success-datos')).toContainText(/3[.,\s]*000/);

  writeFileSync(required('E2E_RESULT_PATH'), JSON.stringify({
    pedido_id: orderId,
    cliente_email: email,
    unidad_id: unitId,
    variante_id: variantId,
    metros_id: metresId,
  }));
});

test('admin conserva filtro de categoria o proveedor al volver', async ({ page }) => {
  const loginPage = new LoginPage(page);
  const adminProductos = new AdminProductosPage(page);

  await loginPage.login(
    required('E2E_ADMIN_EMAIL'),
    required('E2E_ADMIN_PASSWORD'),
    /\/dashboard\/admin$/,
  );

  const filters: FiltroProductos[] = [
    { nombre: 'categoria', valor: required('E2E_CATEGORY_ID') },
    { nombre: 'proveedor', valor: required('E2E_PROVIDER_ID') },
  ];
  for (const filter of filters) {
    await adminProductos.gotoNew(filter);
    await adminProductos.expectBackKeepsFilter(filter);
  }
});