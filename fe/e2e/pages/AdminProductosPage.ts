// Semana 7 del bootcamp — Page Object del alta de productos del admin.
// Verifica que el enlace de volver conserve el filtro de categoría/proveedor.
import { expect, type Page } from '@playwright/test';

export interface FiltroProductos {
  nombre: 'categoria' | 'proveedor';
  valor: string;
}

export class AdminProductosPage {
  readonly page: Page;

  constructor(page: Page) {
    this.page = page;
  }

  get backLink() {
    return this.page.getByRole('link', { name: /Volver a productos/i });
  }

  async gotoNew(filter: FiltroProductos) {
    await this.page.goto(
      `/admin/productos/nuevo?${filter.nombre}=${filter.valor}`,
    );
  }

  async expectBackKeepsFilter(filter: FiltroProductos) {
    await expect(this.backLink).toHaveAttribute(
      'href',
      `/admin/productos?${filter.nombre}=${filter.valor}`,
    );
  }
}