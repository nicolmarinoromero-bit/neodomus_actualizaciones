// Semana 5 del bootcamp — E2E de la gestión de citas y tarifas del admin.
// La sesión y los datos se sirven con `page.route`: el recorrido valida la UI
// real de AdminInstalaciones sin depender de fixtures en la base de datos.
// Ejecutar mediante scripts/e2e_semana5.py (Vite efímero + Playwright).
import { test, expect, type Page } from '@playwright/test';
import { interceptarApiJson, prepararSesion, type LlamadaApi } from './support/apiMock';

const USER = {
  id: 1,
  nombre: 'Admin E2E',
  correo: 'admin.e2e@example.com',
  rol: 'administrador',
};

const CITA_PENDIENTE = {
  id_cita: 1,
  cliente_nombre: 'Carolina Méndez',
  cliente_email: 'carolina@example.com',
  tipo_servicio: 'instalacion',
  fecha: '2026-11-16',
  hora: '09:00',
  estado: 'Pendiente',
  id_tecnico: null,
  nombre_tecnico: null,
  direccion: 'Calle 100 # 20-30',
  descripcion: 'Instalar dos cámaras',
  costo_cita: 120000,
  estado_pago: 'aprobado',
  comision_porcentaje: null,
  comision_valor: null,
  metodo_pago: 'tarjeta_credito',
  numero_transaccion: 'TX-0001',
  id_tecnico_2: null,
  id_tecnico_3: null,
  nombre_tecnico_2: null,
  nombre_tecnico_3: null,
};

const CITA_CONFIRMADA = {
  ...CITA_PENDIENTE,
  id_cita: 2,
  cliente_nombre: 'Luis Pérez',
  cliente_email: 'luis@example.com',
  tipo_servicio: 'mantenimiento',
  fecha: '2026-11-17',
  hora: '11:00',
  estado: 'Confirmada',
  descripcion: 'Mantenimiento de ascensor',
  id_tecnico: 1,
  nombre_tecnico: 'Andrés Técnico',
  costo_cita: 80000,
  estado_pago: 'pendiente',
  comision_porcentaje: 10,
  comision_valor: 8000,
  metodo_pago: null,
  numero_transaccion: null,
};

const TECNICOS = [
  { id_tecnico: 1, id_usuario: 10, first_name: 'Andrés', last_name: 'Técnico', is_active: true },
  { id_tecnico: 2, id_usuario: 11, first_name: 'Beto', last_name: 'Campo', is_active: true },
];

const TARIFAS = [
  { tipo_servicio: 'instalacion', costo: 120000 },
  { tipo_servicio: 'mantenimiento', costo: 80000 },
];

const HISTORIAL = [
  {
    id_historial: 1,
    id_cita: 90,
    accion: 'cancelacion',
    fecha_cita: '2026-11-05',
    hora_cita: '08:00',
    tipo_servicio: 'instalacion',
    estado_cita: 'Cancelada',
    cliente_nombre: 'Cliente Histórico',
    tecnico_anterior_nombre: 'Andrés Técnico',
    tecnico_nuevo_nombre: null,
    motivo: 'Solicitud del cliente',
    detalle: null,
    created_at: '2026-11-04T12:00:00',
    reembolso: {
      id_reembolso: 1,
      monto: 120000,
      estado: 'Pendiente',
      numero_transaccion_reembolso: null,
    },
  },
];

async function interceptarApi(page: Page, llamadas: LlamadaApi[]) {
  await interceptarApiJson(page, async ({ ruta, metodo, cuerpo, responder }) => {

    if (ruta === '/auth/session' && metodo === 'GET') {
      return responder({ user_type: 'employee', rol: 'administrador' });
    }
    if (ruta === '/users/me' && metodo === 'GET') {
      return responder({
        first_name: 'Admin',
        last_name: 'E2E',
        email: USER.correo,
        id_usuario: USER.id,
      });
    }
    if (ruta === '/citas/all-admin' && metodo === 'GET') {
      return responder([CITA_PENDIENTE, CITA_CONFIRMADA]);
    }
    if (ruta === '/tecnicos' && metodo === 'GET') {
      return responder(TECNICOS);
    }
    if (ruta === '/tarifas' && metodo === 'GET') {
      return responder(TARIFAS);
    }
    if (ruta === '/citas/admin/reasignaciones-historial' && metodo === 'GET') {
      return responder(HISTORIAL);
    }
    if (/^\/citas\/admin\/\d+\/tecnicos-disponibles$/.test(ruta) && metodo === 'GET') {
      return responder([
        {
          id_tecnico: 1,
          id_usuario: 10,
          nombre: 'ANDRÉS TÉCNICO',
          cubre_especializacion: true,
        },
        {
          id_tecnico: 2,
          id_usuario: 11,
          nombre: 'BETO CAMPO',
          cubre_especializacion: true,
        },
      ]);
    }
    if (ruta === '/tarifas/instalacion' && metodo === 'PUT') {
      llamadas.push({ metodo, ruta, cuerpo });
      return responder({ tipo_servicio: 'instalacion', costo: cuerpo?.costo ?? 0 });
    }
    if (/^\/citas\/admin\/\d+$/.test(ruta) && metodo === 'PUT') {
      llamadas.push({ metodo, ruta, cuerpo });
      const id = Number(ruta.split('/').pop());
      const base = [CITA_PENDIENTE, CITA_CONFIRMADA].find((c) => c.id_cita === id) ?? CITA_PENDIENTE;
      return responder({ ...base, ...cuerpo });
    }
    if (/^\/citas\/admin\/\d+\/reasignar$/.test(ruta) && metodo === 'POST') {
      llamadas.push({ metodo, ruta, cuerpo });
      return responder({ ...CITA_PENDIENTE, id_tecnico: cuerpo?.id_tecnico ?? null });
    }
    return responder([]);
  });
}

test.beforeEach(async ({ page }) => {
  await prepararSesion(page, USER);
});

test('el admin filtra citas y cancela una con reembolso del 100%', async ({ page }) => {
  // ── Arrange ──────────────────────────────────────────────────────────
  const llamadas: LlamadaApi[] = [];
  await interceptarApi(page, llamadas);
  await page.goto('/admin/instalaciones');

  // ── Assert: tarjetas, tarifas e historial ────────────────────────────
  await expect(page.getByText('Carolina Méndez')).toBeVisible();
  await expect(page.getByText('Luis Pérez')).toBeVisible();
  await expect(page.getByText('Tarifas de servicio')).toBeVisible();
  await expect(page.getByText(/120\.000/).first()).toBeVisible();
  await expect(page.getByText('Citas canceladas por administrador')).toBeVisible();
  await expect(page.getByText(/Cliente Histórico/)).toBeVisible();

  // ── Act: filtrar por estado Pendiente ────────────────────────────────
  await page.getByRole('button', { name: /^Pendiente/ }).click();

  // ── Assert: sólo queda la cita pendiente ─────────────────────────────
  await expect(page.getByText('Carolina Méndez')).toBeVisible();
  await expect(page.getByText('Luis Pérez')).toHaveCount(0);

  // ── Act: cancelar la cita pendiente ──────────────────────────────────
  const tarjeta = page.locator('.ap-grid-item').filter({ hasText: 'Carolina Méndez' });
  await tarjeta.getByRole('button', { name: /Cancelar cita/ }).click();
  await expect(page.getByText('Cancelar cita #1')).toBeVisible();
  await expect(page.getByText(/reembolso del 100%/)).toBeVisible();
  await page.getByRole('button', { name: /Confirmar cancelaci/ }).click();

  // ── Assert: petición, confirmación y cierre del diálogo ──────────────
  await expect(page.locator('.ap-toast')).toContainText(/Reembolso del 100%/);
  expect(llamadas).toContainEqual({
    metodo: 'PUT',
    ruta: '/citas/admin/1',
    cuerpo: { estado: 'Cancelada' },
  });
  await expect(page.getByText('Cancelar cita #1')).toHaveCount(0);
});

test('el admin actualiza una tarifa, cambia el estado y reasigna la cita', async ({ page }) => {
  // ── Arrange ──────────────────────────────────────────────────────────
  const llamadas: LlamadaApi[] = [];
  await interceptarApi(page, llamadas);
  await page.goto('/admin/instalaciones');
  await expect(page.getByText('Carolina Méndez')).toBeVisible();

  // ── Act: editar la tarifa de instalación ─────────────────────────────
  const tarifaInstalacion = page.locator('.ap-tarifa-item').first();
  await tarifaInstalacion.getByRole('button', { name: 'Editar' }).click();
  const campo = tarifaInstalacion.locator('input');
  await campo.fill('150000');
  await tarifaInstalacion.getByRole('button', { name: 'Guardar' }).click();

  // ── Assert: PUT de la tarifa y confirmación ──────────────────────────
  await expect(page.locator('.ap-toast')).toContainText('Tarifa actualizada correctamente');
  expect(llamadas).toContainEqual({
    metodo: 'PUT',
    ruta: '/tarifas/instalacion',
    cuerpo: { costo: 150000 },
  });

  // ── Act: confirmar la cita desde su selector de estado ───────────────
  const tarjeta = page.locator('.ap-grid-item').filter({ hasText: 'Carolina Méndez' });
  await tarjeta.locator('select').first().selectOption('Confirmada');

  // ── Assert: PUT del estado ───────────────────────────────────────────
  await expect
    .poll(() => llamadas.some((l) => l.metodo === 'PUT' && l.ruta === '/citas/admin/1'))
    .toBe(true);
  expect(llamadas).toContainEqual({
    metodo: 'PUT',
    ruta: '/citas/admin/1',
    cuerpo: { estado: 'Confirmada' },
  });

  // ── Act: reasignar la cita a otro técnico ────────────────────────────
  await tarjeta.locator('select').nth(1).selectOption('2');

  // ── Assert: POST de reasignación y aviso ─────────────────────────────
  await expect(page.locator('.ap-toast')).toContainText('Cita reasignada correctamente');
  expect(llamadas).toContainEqual({
    metodo: 'POST',
    ruta: '/citas/admin/1/reasignar',
    cuerpo: { id_tecnico: 2 },
  });
});
