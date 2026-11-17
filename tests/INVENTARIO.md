# Inventario de pruebas de NeoDomus

> Generado a partir de la auditoría del **2026-11-05** (conteos medidos con
> `def test_` / `it|test` por archivo, no estimados). Actualizar al añadir o
> retirar pruebas. Las clases de soporte (`testdb.py`) no son pruebas.

**Totales:** backend **291** casos (24 módulos unittest, medición 2026-11-12) ·
frontend **118** casos (30 archivos Vitest) · E2E **28** casos (9 specs
Playwright) · móvil **253** casos (24 archivos Jest, medición 2026-11-17).

---

## 1. Backend — `be/app/tests/` (unittest)

Ejecución: `tests/run_backend_tests.ps1`. Infraestructura de aislamiento: `testdb.py`
(exige `TEST_DATABASE_URL` ≠ base de aplicación; neutraliza correo/scheduler;
configura `TEST_MINIO_*` si existe).

| # | Archivo | Casos | Tipo | Funcionalidad | MySQL | MinIO | Externos | Estado |
|---|---|---|---|---|---|---|---|---|
| 1 | `test_precio_service.py` | 5 | Unitaria | Reglas de precio (promos, variantes, metros) | No | No | No | Activo |
| 2 | `test_factura_pdf_logo.py` | 5 | Unitaria | Factura PDF (ReportLab): contenido y logo | No | No | mocks | Activo |
| 3 | `test_aislamiento.py` | 8 | Infraestructura | Verifica aislamiento total (bd autorea, scheduler, correo, MinIO no instanciado) | Inspección | Inspección | No | Activo |
| 4 | `test_auth.py` | 3 | Integración HTTP | Registro de clientes (esquema, contraseña, anti-escalada de rol) | Sí | No | correo neutralizado | Activo |
| 5 | `test_auth_session.py` | 8 | Integración HTTP | Restauración de sesión (Bearer/cookie, refresh, inactivo, inválido) | Sí | No | No | Activo |
| 6 | `test_t1_identidad.py` | 21 | Integración HTTP | Autenticación/autorización/propiedad (matriz T1) | Sí | No | No | Activo |
| 7 | `test_t1_1_cuentas.py` | 15 | Integración HTTP | Verificación de correo, recuperación de contraseña, expiración de tokens | Sí | No | correo neutralizado | Activo |
| 8 | `test_t1_1_archivos.py` | 9 | Integración HTTP | Evidencias privadas por ruta autorizada; desactivación del montaje legado; propiedad de notificaciones | Sí | No (FS legado `app/static/evidencias`) | No | Activo |
| 9 | `test_t1_2_minio.py` | 4 | Integración | Privacidad bucket privado vs catálogo público | Sí | **Sí (con `TEST_MINIO_*`; si no, skip honesto)** | URL pública | Activo (condicional) |
| 10 | `test_t1_3_permisos.py` | 6 | Integración HTTP | Evidencia de entrega al cliente + permisos de varios routers | Sí | opcional | No | Activo (condicional) |
| 11 | `test_bloque_2.py` | 18 | Integración | Agenda: capacidad por técnico, solapamientos, aptitud, jornada | Sí | No | No | Activo |
| 12 | `test_bloque_11.py` | 16 | Integración | Entregas: transiciones, reasignación prohibida, desactivación con custodia | Sí | No | No | Activo |
| 13 | `test_bloque_21.py` | 12 | Integración | Capacidad aplicada en flujos reales (creación/reagendar/autoasignar) | Sí | No | No | Activo |
| 14 | `test_bloque_21_cierre.py` | 14 | Integración | Coordinación transaccional en asignación/edición/desactivación | Sí | No | pago simulado anulado | Activo |
| 15 | `test_entregas_comportamiento.py` | 19 | Unitarias (2 clases puras) + Integración | Máquina de estados de entrega + endpoint real | 1 clase Sí | No | No | Activo |
| 16 | `test_reasignacion_transacciones.py` | 8 | Integración | Commit/rollback/cancelación en reasignación | Sí | No | No | Activo |
| 17 | `test_checkout_metros_http.py` | 15 | Integración HTTP | Checkout por metros con simulador (punto de pago) hasta Pagado | Sí | No | simulador | Activo |
| 18 | `test_t2_pago_pendiente.py` | 25 | Integración | `confirmar_pago_pendiente`: atomicidad, reintentos, concurrencia | Sí | No | simulador | Activo |
| 19 | `test_citas_reembolsos_admin.py` | 9 | Integración | Dashboard admin de citas + cancelación → reembolso | Sí | No | No | Activo |
| 20 | `test_disponibilidad_productos.py` | 7 | Integración | Disponibilidad: stock, última unidad, variantes, metros | Sí | No | No | Activo |
| 21 | `test_reportes_ventas.py` | 11 | Integración | Reporte de ventas: estados, decimales, permisos, PDF | Sí | No | PDF local | Activo |
| 22 | `test_factura_descarga_http.py` | 3 | Integración HTTP | Descarga de factura (dueño OK; 403 a anónimos y a otros clientes) | Sí | No | No | Activo |
| 23 | `test_foto_perfil_tecnico.py` | 8 | Integración | Foto de perfil técnico (Pillow valida contenido, reemplazo) | Sí | **Sí (con `TEST_MINIO_*`; si no, skip)** | No | Activo (condicional) |
| — | `testdb.py` | — | (no es test) | Aislamiento BD + neutralización de transportes + MinIO de pruebas | — | — | — | Infra |

Cobertura medida en T0 (línea base): 37,29 % líneas / 10,65 % ramas sobre el paquete `app`.

## 2. Frontend — unit/integración de UI (Vitest + Testing Library)

Ejecución: `tests/run_frontend_tests.ps1`. No necesitan MySQL/Docker (red mockeada con `vi.mock`).

| # | Archivo (ruta bajo `fe/src/`) | Casos | Tipo | Funcionalidad |
|---|---|---|---|---|
| 1 | `utils/metros.test.ts` | 6 | Unitaria | Cálculo de corte por metros |
| 2 | `utils/productoPrecio.test.ts` | 4 | Unitaria | Precio calculado en UI |
| 3 | `utils/productoDisponibilidad.test.ts` | 5 | Unitaria | Disponibilidad comercial |
| 4 | `i18n/pedidos.test.ts` | 2 (`it.each` es/en) | Unitaria | Claves de traducción de AdminPedidos |
| 5 | `hooks/usePaginacion.test.ts` | 5 | Unitaria (hook) | Paginación |
| 6 | `hooks/useAuthImage.test.ts` | 7 | Unitaria (hook) | Imagen privada (blob lifecycle) |
| 7 | `hooks/useNotificaciones.test.tsx` | 3 | Unitaria (hook) | Notificaciones usuario |
| 8 | `hooks/useAdminNotificaciones.test.tsx` | 4 | Unitaria (hook) | Notificaciones admin |
| 9 | `contexts/CartContext.test.tsx` | 8 | Unitaria (context) | Carrito de compras |
| 10 | `contexts/AuthImagesSession.test.tsx` | 2 (`it.each`) | Integración (mock red) | Sesión + invalidación de imágenes privadas |
| 11 | `components/chat/ChatBotWidget.test.tsx` | 5 | Unitaria | Widget chatbot |
| 12 | `components/common/AvatarFoto.test.tsx` | 4 | Unitaria | Avatar y fallback de iniciales |
| 13 | `components/common/MetrosSelect.test.tsx` | 3 | Unitaria | Selector de metros |
| 14 | `components/common/Paginacion.test.tsx` | 3 | Unitaria | Controles de paginación |
| 15 | `components/common/CardPaymentInput.test.tsx` | 1 | Unitaria | Input de tarjeta (simulador) |
| 16 | `components/layout/NotificacionesBell.test.tsx` | 2 | Unitaria | Campana de notificaciones |
| 17 | `components/productos/ProductoCard.test.tsx` | 2 | Unitaria | Tarjeta de producto |
| 18 | `pages/public/CarritoPage.test.tsx` | 12 | Integración de página | Carrito |
| 19 | `pages/public/Notificaciones.test.tsx` | 3 | Integración de página | Notificaciones |
| 20 | `pages/public/ProductoDetalle.integration.test.tsx` | 2 | Integración de página | Detalle de producto |
| 21 | `pages/admin/AdminDashboard.test.tsx` | 1 | Integración de página | Dashboard admin |
| 22 | `pages/admin/AdminProductoDetalle.test.tsx` | 1 | Integración de página | Ficha de producto admin |
| 23 | `pages/cliente/Perfil.test.tsx` | 1 | Integración de página | Perfil del cliente |

Config: `fe/vitest.config.ts` (jsdom, globals, setup `fe/src/test/setup.ts` con shim de `URL.createObjectURL`).

## 3. Móvil — `movil/__tests__/` (Jest + jest-expo + RNTL)

Ejecución: `tests/run_movil_tests.ps1`. Sin BD ni red: `fetch` mockeado con los
helpers de `movil/__tests__/helpers/` (respuestas programadas) y
AsyncStorage/SecureStore en memoria; nunca llaman al backend real. Config:
`movil/jest.config.js` (preset `jest-expo`, umbrales de cobertura trinquete
90/80/75/90) y `movil/jest-globals.d.ts`.

| # | Archivo (ruta bajo `movil/__tests__/`) | Casos | Tipo | Funcionalidad |
|---|---|---|---|---|
| 1 | `utils/metros.test.ts` | 15 | Unitaria | Parseo y cálculo de metros |
| 2 | `utils/validaciones.test.ts` | 14 | Unitaria | Validaciones de formularios |
| 3 | `constants/variantes.test.ts` | 12 | Unitaria | Variantes de estilo de UI |
| 4 | `services/api.test.ts` | 14 | Unitaria | Cliente HTTP base (respuestas programadas, errores) |
| 5 | `services/auth.services.test.ts` | 12 | Unitaria | Endpoints de sesión (registro/login/OTP) |
| 6 | `services/cliente.services.test.ts` | 14 | Unitaria | Pedidos/factura/direcciones del cliente |
| 7 | `services/productos.service.test.ts` | 11 | Unitaria | Catálogo/detalle/favoritos de productos |
| 8 | `services/novedades.service.test.ts` | 11 | Unitaria | Novedades y home |
| 9 | `services/otros.servicios.test.ts` | 7 | Unitaria | Resto de endpoints |
| 10 | `services/storage.test.ts` | 8 | Unitaria | Almacenamiento seguro de sesión |
| 11 | `contexts/AuthContext.test.tsx` | 9 | Context | Sesión: login/logout/restore + persistencia |
| 12 | `contexts/CartContext.test.tsx` | 20 | Context | Carrito: unidades/metros, totales, vaciado al salir |
| 13 | `contexts/FavoritosContext.test.tsx` | 16 | Context | Favoritos de productos |
| 14 | `contexts/TecnicosFavoritosContext.test.tsx` | 14 | Context | Técnicos favoritos |
| 15 | `contexts/IdiomaContext.test.tsx` | 11 | Context | Idioma es/en + persistencia |
| 16 | `hooks/useAuthImage.test.ts` | 9 | Hook | Imagen privada con token (lifecycle) |
| 17 | `hooks/useScrollTopAlEntrar.test.ts` | 8 | Hook | Scroll al entrar en pantalla |
| 18 | `components/CookieConsent.test.tsx` | 10 | Componente | Banner de cookies RGPD (aceptar/rechazar/configurar) |
| 19 | `components/GateCliente.test.tsx` | 6 | Componente | Puerta de sesión del área cliente |
| 20 | `components/OtpInput.test.tsx` | 13 | Componente | Código OTP (autofocus, borrado) |
| 21 | `components/PasswordInput.test.tsx` | 7 | Componente | Contraseña (mostrar/ocultar) |
| 22 | `components/PasswordChecklist.test.tsx` | 3 | Componente | Requisitos de contraseña |
| 23 | `components/Dropdown.test.tsx` | 6 | Componente | Selector desplegable |
| 24 | `piloto.test.tsx` | 3 | Integración | Pantallas piloto (smoke de navegación) |

Cobertura (2026-11-17): 90,26 % sentencias / 81,29 % ramas / 78,12 % funciones /
90,7 % líneas sobre 35 archivos de `movil` (`components|contexts|hooks|
services|utils|constants`, más icon-symbol); `movil/app/**` y `movil/data/`
quedan fuera del objetivo de cobertura.

## 4. E2E — `fe/e2e/` (Playwright) y orquestadores `scripts/`

Ejecución: `tests/run_e2e_tests.ps1` → `python scripts/e2e_*.py`. Los
orquestadores exigen `TEST_DATABASE_URL` al importar, llaman
`testdb.ensure_test_schema()`, crean fixtures únicas, levantan API efímera
(`DISABLE_SCHEDULER=1`, pagos simulados) + Vite efímero, corren el spec y
validan la BD al final.

| Spec (`fe/e2e/`) | Casos | Orquestador (`scripts/`) | Requisitos | Estado |
|---|---|---|---|---|
| `login.e2e.spec.ts` | 2 | `e2e_login.py` (S1 bootcamp: AAA, login válido + error 401) | MySQL pruebas + fe deps + node | Activo |
| `admin-paginacion.e2e.spec.ts` | 9 | `e2e_admin_paginacion.py` | MySQL pruebas + fe deps + node | Activo |
| `foto-tecnico.e2e.spec.ts` | 5 | `e2e_foto_tecnico.py` | idem | Activo |
| `cart-checkout.e2e.spec.ts` | 2 | `e2e_cart_checkout.py` | idem (valida pedido en BD) | Activo |
| `register.e2e.spec.ts` | 2 | `e2e_register.py` | idem (`test.skip` si falta `E2E_REGISTER_EMAIL`) | Activo |
| `session.e2e.spec.ts` | 1 | `e2e_session.py` | idem + seed `e2e_seed.py` | Activo |
| `reporte-ventas.e2e.spec.ts` | 1 | `e2e_reporte_ventas.py` | idem | Activo |
| `metros.e2e.spec.ts` | 3 | **sin orquestador** (`e2e_verify.py` valida BD; env fallback IDs `139`/`140`) | stack manual + datos concretos | ⚠ Manual/frágil |
| `chatbot.e2e.spec.ts` | 3 | **sin orquestador** (sin env; usa `baseURL` 5174) | stack dev manual | ⚠ Manual/frágil |

Soporte de E2E (no son pruebas): `scripts/e2e_seed.py` (seed determinista con
`--reset` propio), `scripts/e2e_verify.py` (validador BD del spec metros),
`scripts/seed_test_users.py` (usuarios de prueba idempotentes).

## 5. Utilidades en `scripts/` (no tests)

`crear_admin.py`, `check_tecnico.py`, `reset_passwords.py`, `export_seed.py`,
`verify_syntax.py` — herramientas de administración de datos/sintaxis, fuera
del alcance de `tests/`.

## 6. Huecos de cobertura conocidos (para planificar nuevas pruebas)

Backend con poca/ninguna cobertura (según acta T0 y endpoints existentes sin
pruebas): `routers/products` CRUD admin (16 endpoints), `routers/reports` (9),
`routers/devoluciones` (16), `routers/novedades` + cupones (22),
`routers/consultas` (3), `tarifas` (2), `solicitudes` (7), `users` CRUD,
`services/recomendacion_service` (0 %), `services/notificaciones` (34,8 %),
`tareas_programadas`/scheduler, login con Google (`/auth/google`), logout.
Frontend sin pruebas: `CheckoutPage`, `Login/Register` (page-level), paneles
admin (Pedidos/Facturas/Consultas/Devoluciones), `utils/google.ts`,
`utils/favoritos.ts`, `profileStorage`. Móvil (nuevo 2026-11-17):
`components/public/PublicNavbar` (31 % líneas), `constants/api.ts` (60 %),
`services/cliente.services` (77 %); pantallas `movil/app/**` y `movil/data/`
fuera del objetivo de cobertura. E2E pendientes: flujo de citas del cliente,
devolución, notificaciones.

## 7. Riesgo de nomenclatura (documentado)

- `be/app/tests/testdb.py` **no** es un test (infraestructura); unittest no lo
  recoge por patrón (`test_*.py`). No renombrar: `testdb` es distinto de `test_<dominio>`.
- Bloques `bloque_2/11/21/21_cierre`, `t1_*`, `t2_*` remiten a actas T0/T1/T2 (`docs/`).
