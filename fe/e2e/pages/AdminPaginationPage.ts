// Semana 7 del bootcamp — Page Object de los listados administrativos.
// Cubre búsqueda, paginación, numeración de filas y estados vacíos tanto en
// tablas (clientes/proveedores/novedades) como en tarjetas (técnicos).
import { expect, type Page } from '@playwright/test';

export type AdminSection = 'clientes' | 'proveedores' | 'novedades' | 'tecnicos';

export class AdminPaginationPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get table() {
    return this.page.locator('table.ap-table');
  }

  get tableRows() {
    return this.page.locator('table.ap-table tbody tr');
  }

  get grid() {
    return this.page.locator('.ap-grid');
  }

  get gridItems() {
    return this.page.locator('.ap-grid-item');
  }

  get searchInput() {
    return this.page.locator('.ap-search input').first();
  }

  async goto(section: AdminSection) {
    await this.page.goto(`/admin/${section}`);
    await expect(section === 'tecnicos' ? this.grid : this.table).toBeVisible();
  }

  async search(term: string) {
    await this.searchInput.fill(term);
  }

  async rowNumbers(): Promise<string[]> {
    const filas = this.tableRows;
    const total = await filas.count();
    const numeros: string[] = [];
    for (let i = 0; i < total; i++) {
      numeros.push(
        (await filas.nth(i).locator('td').first().textContent())?.trim() || '',
      );
    }
    return numeros;
  }

  async expectRowNumbers(expected: string[]) {
    await expect
      .poll(async () => (await this.rowNumbers()).join(','))
      .toBe(expected.join(','));
  }

  async goToPage(numero: number) {
    await this.page.getByLabel(`Ir a la página ${numero}`).click();
  }

  async expectPage2Visible() {
    await expect(this.page.getByLabel('Ir a la página 2')).toBeVisible();
  }
}