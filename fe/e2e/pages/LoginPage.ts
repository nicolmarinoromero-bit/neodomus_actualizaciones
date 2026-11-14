// Semana 7 del bootcamp — Page Object del inicio de sesión.
// Encapsula localizadores accesibles y la espera de la respuesta real del
// backend para que los specs no repitan selectores ni la secuencia de login.
import { expect, type Page, type Response } from '@playwright/test';

export class LoginPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get emailInput() {
    return this.page.getByPlaceholder('Correo electrónico', { exact: true });
  }

  get passwordInput() {
    return this.page.getByPlaceholder('Contraseña', { exact: true });
  }

  get submitButton() {
    return this.page.locator('button.btn-login-submit');
  }

  get errorBox() {
    return this.page.locator('.login-error-box');
  }

  get userWelcome() {
    return this.page.locator('.user-welcome');
  }

  async goto() {
    await this.page.goto('/login');
    await expect(this.emailInput).toBeEditable();
    await expect(this.passwordInput).toBeEditable();
  }

  async fill(email: string, password: string) {
    await this.emailInput.fill(email);
    await this.passwordInput.fill(password);
  }

  /** Envía el formulario y devuelve la respuesta del endpoint de login. */
  async submitAndWait(): Promise<Response> {
    const response = this.page.waitForResponse(
      (r) =>
        r.url().endsWith('/api/v1/auth/login') &&
        r.request().method() === 'POST',
    );
    await this.submitButton.click();
    return response;
  }

  /** Login completo: formulario, respuesta 200 y URL de destino opcional. */
  async login(email: string, password: string, destination?: RegExp) {
    await this.goto();
    await this.fill(email, password);
    const response = await this.submitAndWait();
    expect(response.status()).toBe(200);
    if (destination) await this.page.waitForURL(destination);
    return response;
  }
}