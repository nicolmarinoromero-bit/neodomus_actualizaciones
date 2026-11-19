import type { Page, Route } from '@playwright/test';

type UsuarioE2E = { id: number; nombre: string; correo: string; rol: string };

export type LlamadaApi = { metodo: string; ruta: string; cuerpo: any };

type SolicitudApi = {
  ruta: string;
  metodo: string;
  cuerpo: any;
  responder: (json: unknown, status?: number) => Promise<void>;
};

export async function prepararSesion(page: Page, usuario: UsuarioE2E) {
  await page.addInitScript((user) => {
    sessionStorage.setItem('neodomus_tab_session_id', 'e2e');
    localStorage.setItem('e2e__tab__access_token', 'e2e-access-token');
    localStorage.setItem('e2e__tab__refresh_token', 'e2e-refresh-token');
    localStorage.setItem('e2e__tab__user', JSON.stringify(user));
    localStorage.setItem('pf_idioma', 'es');
  }, usuario);
}

export async function interceptarApiJson(
  page: Page,
  resolver: (solicitud: SolicitudApi) => Promise<void>,
) {
  await page.route('**/api/v1/**', async (route: Route) => {
    const request = route.request();
    const url = new URL(request.url());
    const contentType = request.headers()['content-type'] || '';
    const body = contentType.includes('application/json') ? request.postDataJSON() : null;
    const responder = (json: unknown, status = 200) =>
      route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(json) });

    await resolver({
      ruta: url.pathname.replace('/api/v1', ''),
      metodo: request.method(),
      cuerpo: body,
      responder,
    });
  });
}