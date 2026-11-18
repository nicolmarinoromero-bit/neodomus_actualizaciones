// Semana 5 del bootcamp — E2E del historial y reporte de novedades del técnico.
// La sesión y los datos se sirven con `page.route`: el recorrido valida la UI
// real de TecnicoNovedades sin depender de fixtures en la base de datos.
// Ejecutar mediante scripts/e2e_semana5.py (Vite efímero + Playwright).
import { test, expect, type Page } from '@playwright/test';
import { interceptarApiJson, prepararSesion, type LlamadaApi } from './support/apiMock';

const USER = {
  id: 10,
  nombre: 'Tecnico E2E',
  correo: 'tecnico.e2e@example.com',
  rol: 'tecnico',
};

const NOVEDADES = [
  {
    id_novedad: 1,
    tipo_novedad: 'Producto danado',
    tipo_novedad_label: 'Producto danado',
    descripcion_novedad: 'La caja llegó abollada',
    prioridad: 'alta',
    prioridad_label: 'Alta',
    estado_novedad: 'Pendiente',
    estado_novedad_label: 'Pendiente',
    fecha_reporte: '2026-11-03T10:00:00',
    lugar_ocurrencia: 'Bodega principal',
    evidencia_url: null,
    id_pedido: 77,
    id_cita: null,
    id_cliente: 5,
    id_devolucion: null,
    id_tecnico: 10,
    tecnico_nombre: 'Tecnico E2E',
    cliente_nombre: 'Carolina Méndez',
    accion_admin: null,
    mensaje_cliente: null,
    solucion_cliente: null,
    cliente_visible: false,
    fecha_resolucion: null,
    evidencias: [],
  },
  {
    id_novedad: 2,
    tipo_novedad: 'Cita no realizada',
    tipo_novedad_label: 'Cita no realizada',
    descripcion_novedad: 'El cliente no estaba en la dirección',
    prioridad: 'urgente',
    prioridad_label: 'Urgente',
    estado_novedad: 'En revision',
    estado_novedad_label: 'En revisión',
    fecha_reporte: '2026-11-04T12:30:00',
    lugar_ocurrencia: null,
    evidencia_url: null,
    id_pedido: null,
    id_cita: 88,
    id_cliente: 6,
    id_devolucion: null,
    id_tecnico: 10,
    tecnico_nombre: 'Tecnico E2E',
    cliente_nombre: 'Luis Pérez',
    accion_admin: null,
    mensaje_cliente: null,
    solucion_cliente: null,
    cliente_visible: false,
    fecha_resolucion: null,
    evidencias: [],
  },
];

const DETALLE = {
  ...NOVEDADES[1],
  accion_admin: 'Se validó con el cliente y se reprogramó',
  historial: [
    {
      id_historial: 1,
      accion: 'Novedad creada',
      detalle: 'Reportada por el técnico',
      fecha: '2026-11-04T12:30:00',
      usuario_nombre: 'Tecnico E2E',
    },
  ],
};

// Arranque de sesión sin backend: tokens y usuario por pestaña + stubs de
// /auth/session y /users/me para que AuthContext restaure la sesión.

async function interceptarApi(page: Page, llamadas: LlamadaApi[]) {
  await interceptarApiJson(page, async ({ ruta, metodo, cuerpo, responder }) => {

    if (ruta === '/auth/session' && metodo === 'GET') {
      return responder({ user_type: 'employee', rol: 'tecnico' });
    }
    if (ruta === '/users/me' && metodo === 'GET') {
      return responder({
        first_name: 'Tecnico',
        last_name: 'E2E',
        email: USER.correo,
        id_usuario: USER.id,
      });
    }
    if (ruta === '/novedades/mis-novedades' && metodo === 'GET') {
      return responder(NOVEDADES);
    }
    if (ruta === '/novedades/clientes-buscar' && metodo === 'GET') {
      return responder([
        {
          id_cliente: 5,
          nombre: 'Carolina Méndez',
          email: 'carolina@example.com',
          telefono: 3105027488,
          documento: 10203040,
          direccion: 'Calle 100 # 20-30',
        },
      ]);
    }
    if (ruta === '/novedades/clientes/5/pedidos' && metodo === 'GET') {
      return responder([
        {
          id_pedido: 77,
          fecha_pedido: '2026-11-01T09:00:00',
          estado_pedido: 'En camino',
          total: 120000,
          fecha_entrega: '2026-11-05',
          hora_entrega: '09:00',
          hora_entrega_fin: '11:00',
          estado_entrega: 'Pendiente',
          nombre_tecnico: 'Tecnico E2E',
          detalles: [{ producto: 'Panel LED', cantidad: 2, precio: 60000 }],
        },
      ]);
    }
    if (ruta === '/novedades/clientes/5/citas' && metodo === 'GET') {
      return responder([]);
    }
    if (/^\/novedades\/\d+$/.test(ruta) && metodo === 'GET') {
      return responder(DETALLE);
    }
    if (ruta === '/novedades' && metodo === 'POST') {
      llamadas.push({ metodo, ruta, cuerpo });
      return responder({ id_novedad: 99, mensaje: 'ok' }, 201);
    }
    if (/^\/novedades\/\d+\/evidencia$/.test(ruta) && metodo === 'POST') {
      llamadas.push({ metodo, ruta, cuerpo: null });
      return responder({ mensaje: 'ok' });
    }
    return responder([]);
  });
}

test.beforeEach(async ({ page }) => {
  await prepararSesion(page, USER);
});

test('el técnico consulta, filtra y abre el detalle de sus novedades', async ({ page }) => {
  // ── Arrange ──────────────────────────────────────────────────────────
  const llamadas: LlamadaApi[] = [];
  await interceptarApi(page, llamadas);
  await page.goto('/tecnico/novedades');

  // ── Assert: listado ──────────────────────────────────────────────────
  await expect(page.getByRole('heading', { name: 'Historial de novedades' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Producto danado' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Cita no realizada' })).toBeVisible();
  await expect(page.getByText('#77')).toBeVisible();
  await expect(page.getByText('Cita #88')).toBeVisible();
  await expect(page.getByText('2 de 2 novedades')).toBeVisible();

  // ── Act: filtrar por cliente ─────────────────────────────────────────
  await page.getByPlaceholder(/Buscar por tipo, cliente, pedido/).fill('luis');

  // ── Assert: sólo queda la novedad de Luis ────────────────────────────
  await expect(page.getByRole('cell', { name: 'Cita no realizada' })).toBeVisible();
  await expect(page.getByRole('cell', { name: 'Producto danado' })).toHaveCount(0);
  await expect(page.getByText('1 de 2 novedades')).toBeVisible();

  // ── Act: abrir el detalle de la novedad visible ──────────────────────
  await page.getByRole('row', { name: /Cita no realizada/ }).getByRole('button', { name: /Ver/ }).click();

  // ── Assert: modal con datos, historial y respuesta del admin ─────────
  await expect(page.getByText('Novedad #2')).toBeVisible();
  await expect(page.getByText('El cliente no estaba en la dirección')).toBeVisible();
  await expect(page.getByText('Se validó con el cliente y se reprogramó')).toBeVisible();
  await expect(page.getByText('Novedad creada')).toBeVisible();

  // ── Act: cerrar con la X ─────────────────────────────────────────────
  await page.locator('.ap-modal-x').click();
  await expect(page.getByText('Novedad #2')).toHaveCount(0);

  // El recorrido no debe disparar escrituras.
  expect(llamadas.filter((l) => l.metodo !== 'GET')).toHaveLength(0);
});

test('el técnico reporta una novedad con cliente, pedido, prioridad y evidencia', async ({ page }) => {
  // ── Arrange ──────────────────────────────────────────────────────────
  const llamadas: LlamadaApi[] = [];
  await interceptarApi(page, llamadas);
  await page.goto('/tecnico/novedades');
  await expect(page.getByRole('cell', { name: 'Producto danado' })).toBeVisible();

  // ── Act: abrir el formulario y buscar al cliente ─────────────────────
  await page.getByRole('button', { name: 'Agregar novedad' }).click();
  await page.getByPlaceholder('Escribe para buscar...').fill('carolina');

  // ── Assert: resultado de la búsqueda ─────────────────────────────────
  const cliente = page.getByRole('button', { name: /Carolina Méndez/ });
  await expect(cliente).toBeVisible();

  // ── Act: seleccionar cliente y pedido ────────────────────────────────
  await cliente.click();
  await page.getByRole('button', { name: /Pedido #77/ }).click();

  // ── Assert: resumen del origen ───────────────────────────────────────
  await expect(page.getByText(/Pedidos y citas de Carolina Méndez/)).toHaveCount(0);
  await expect(page.getByText(/Pedido #77/)).toBeVisible();

  // ── Act: completar el detalle ────────────────────────────────────────
  await page.locator('select#novedad-tipo').selectOption('Producto danado');
  await page.getByRole('button', { name: 'Urgente' }).click();
  await page.getByPlaceholder('Ej: Av. Principal #123').fill('Bodega norte');
  await page
    .getByPlaceholder('Describe la situacion detalladamente...')
    .fill('La caja llegó abollada durante el transporte');
  await page.getByRole('button', { name: /Siguiente/ }).click();

  // ── Assert: paso de evidencia ────────────────────────────────────────
  await expect(page.getByText('Evidencia de la novedad')).toBeVisible();

  // ── Act: adjuntar la foto y enviar ───────────────────────────────────
  await page.locator('input[type="file"]').setInputFiles({
    name: 'evidencia.png',
    mimeType: 'image/png',
    buffer: Buffer.from('imagen-de-prueba'),
  });
  await expect(page.getByAltText('Evidencia')).toBeVisible();
  await page.getByRole('button', { name: /Enviar reporte/ }).click();

  // ── Assert: payload enviado y confirmación visible ───────────────────
  await expect(page.locator('.ap-toast')).toContainText('Novedad reportada correctamente');
  const creacion = llamadas.find((l) => l.metodo === 'POST' && l.ruta === '/novedades');
  expect(creacion?.cuerpo).toMatchObject({
    tipo_novedad: 'Producto danado',
    descripcion: 'La caja llegó abollada durante el transporte',
    prioridad: 'urgente',
    id_pedido: 77,
    id_cliente: 5,
    lugar_ocurrencia: 'Bodega norte',
  });
  expect(
    llamadas.some((l) => l.metodo === 'POST' && /^\/novedades\/99\/evidencia$/.test(l.ruta)),
  ).toBe(true);
});
