// Semana 7 del bootcamp — Page Object del carrito y el checkout.
// Agrupa las acciones del flujo crítico de compra: agregar variantes y metros,
// refrescar precios desde localStorage, elegir método de pago y confirmar.
import { expect, type Page } from '@playwright/test';

export interface DatosTarjeta {
  numero: string;
  titular: string;
  expiracion: string;
  cvv: string;
}

export class CartCheckoutPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get items() {
    return this.page.locator('article.carrito-item');
  }

  get subtotals() {
    return this.page.locator('.carrito-item-subtotal');
  }

  get total() {
    return this.page.locator('.carrito-resumen-total');
  }

  get finalizeButton() {
    return this.page.locator('button.carrito-finalizar-btn');
  }

  get payButton() {
    return this.page.locator('button.checkout-pagar-btn');
  }

  get cardNumber() {
    return this.page.getByPlaceholder('4242 4242 4242 4242');
  }

  get cardHolder() {
    return this.page.getByPlaceholder('Como aparece en la tarjeta');
  }

  get cardExpiry() {
    return this.page.getByPlaceholder('MM/AA');
  }

  get cardCvv() {
    return this.page.getByPlaceholder('123');
  }

  get successDialog() {
    return this.page.getByRole('dialog', { name: /Confirmación de compra/ });
  }

  async addUnitProduct(productId: number, quantity: number) {
    await this.page.goto(`/producto/${productId}?cantidad=${quantity}`);
    const add = this.page.locator('button.detalle-agregar-btn');
    await expect(add).toBeEnabled();
    await add.click();
    await expect(this.page.locator('.detalle-toast')).toBeVisible();
  }

  async addMetresProduct(
    productId: number,
    units: number,
    metrosLabel: string,
    expectedTotal: RegExp,
  ) {
    await this.page.goto(`/producto/${productId}?unidades=${units}`);
    const metros = this.page.getByRole('button', { name: 'Metros por unidad' });
    await expect(metros).toBeEnabled();
    await metros.click();
    await this.page.getByRole('option', { name: metrosLabel }).click();
    await expect(this.page.locator('.detalle-metros-bloque')).toContainText(
      expectedTotal,
    );
    await this.page.locator('button.detalle-agregar-btn').click();
  }

  async openCart(expectedItems: number) {
    await this.page.goto('/carrito');
    await expect(this.items).toHaveCount(expectedItems);
  }

  async reloadCart(expectedItems: number) {
    await this.page.reload();
    await expect(this.items).toHaveCount(expectedItems);
  }

  async storedItems<T = Record<string, unknown>>(): Promise<T[]> {
    return this.page.evaluate(
      () => JSON.parse(localStorage.getItem('neodomus_carrito') || '[]') as T[],
    );
  }

  async replaceStoredItems(items: unknown[]) {
    await this.page.evaluate((value) => {
      localStorage.setItem('neodomus_carrito', JSON.stringify(value));
    }, items);
  }

  async goToCheckout() {
    await this.finalizeButton.click();
    await expect(this.page).toHaveURL(/\/checkout$/);
  }

  async fillCard(data: DatosTarjeta) {
    await this.cardNumber.fill(data.numero);
    await this.cardHolder.fill(data.titular);
    await this.cardExpiry.fill(data.expiracion);
    await this.cardCvv.fill(data.cvv);
  }

  get simulationSelect() {
    return this.page
      .locator('.checkout-field', { hasText: 'Resultado de simulaci' })
      .locator('select');
  }

  async selectSimulation(estado: 'aprobado' | 'rechazado') {
    await this.simulationSelect.selectOption(estado);
  }

  /** Registra las peticiones POST a un patrón y devuelve un lector del conteo. */
  countRequests(method: string, urlPattern: RegExp) {
    let total = 0;
    this.page.on('request', (request) => {
      if (
        request.method() === method &&
        urlPattern.test(new URL(request.url()).pathname)
      ) {
        total += 1;
      }
    });
    return () => total;
  }
}