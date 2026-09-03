# Neodomus

Sistema integral de gestión para domótica y servicios técnicos. Neodomus conecta **clientes**, **técnicos** y **administradores** en una plataforma unificada para la venta de productos domóticos, agendamiento de citas/instalaciones, gestión de pedidos con entrega técnica y seguimiento post-venta.

## Descripción del proyecto

Neodomus es una plataforma e-commerce especializada en domótica con capa de servicios:

- **Catálogo** de productos (sensores, controladores, iluminación, seguridad, etc.) con stock, variantes de color/medida, venta por metros y promociones.
- **Carrito de compras** con cálculo de técnicos requeridos y tiempo estimado por producto.
- **Pedidos** con asignación de técnico para entrega, rango horario, evidencia fotográfica y estados de entrega.
- **Citas / Instalaciones** por tipo de servicio (`instalacion`, `mantenimiento`, `reparacion`, `revision`, `soporte`) con tarifa fija, pago al agendar y asignación de hasta 3 técnicos por cita.
- **Dashboards**: administrativo (reportes, reembolsos, reasignación), técnico (citas, entregas, historial, evidencias) y cliente (pedidos, citas, perfil, facturas, devoluciones).
- **Gestión de imágenes** centralizada en almacenamiento S3 compatible vía `minio_data` (MinIO).
- **Notificaciones** internas (plataforma) y por correo para citas, cambios de técnico, promociones y recordatorios.
- **Autenticación** JWT (access + refresh) con verificación por email, recuperación por código y **Google Sign-In** para clientes y empleados.
- **Roles**: cliente, técnico, administrador y visitante (sin login).
- **Módulos adicionales**: especializaciones técnicas, tarifas de servicio, calificaciones de técnicos y productos, solicitudes de habilitación, devoluciones y reembolsos, reportes PDF/Excel.

Todas las funcionalidades documentadas existen y son verificables en `be/app/routers/`, `fe/src/` y `movil/app/`.

---

## Tecnologías y frameworks

### Frontend Web
- **React 18.3.1** — UI declarativa.
- **Vite 5.4.21** — bundler y dev server (`fe/vite.config.ts:20` puerto 5173, `Cross-Origin-Opener-Policy` para Google).
- **TypeScript 5.9.3**
- **React Router DOM 7.18.0** — ruteo SPA.
- Estilos CSS puro por módulo (`fe/src/styles/producto-detalle.css`, `productos-publicos.css`, etc.) sin Tailwind/MUI/Bootstrap.

### Backend
- **Python 3.12** (`be/.python-version`), **FastAPI 0.115.0** (`be/app/main.py:68`), **Uvicorn 0.30.0**.
- **SQLAlchemy 2.0.30** + **Pymysql 1.1.0** + **Alembic 1.13.2** para MySQL.
- **Pydantic 2.7.0** / **pydantic-settings 2.3.0** para esquemas y `app/config.py`.
- **python-jose[cryptography] 3.3.0**, **passlib[bcrypt] 1.7.4**, **bcrypt 4.0.1** para JWT y hashing.
- **slowapi 0.1.9** rate-limit, **APScheduler 3.11.3** para tareas programadas (`app/services/scheduler.py`).
- **ReportLab 4.2.0**, **openpyxl 3.1.5**, **Pillow >=10** para facturas y exportaciones.

### Aplicación móvil
- **React Native 0.81.5** con **Expo 54.0.37** y **Expo Router 6.0.24** (`movil/package.json:2`, `movil/app.json`).
- **TypeScript 5.9.2**, **React Navigation** (bottom-tabs, native).
- **Expo Image 3.0.11**, **Image Picker 17.0.11**, **File System 19**, **Location 19**, **AsyncStorage 2.2.0**, **expo-auth-session**, **expo-constants**.

### Base de datos
- **MySQL 8.0** (`docker-compose.yml:3` imagen `mysql:8.0`, puerto `3307:3306`).
- ORM **SQLAlchemy** con `DeclarativeBase` (`be/app/database.py`), sesiones vía `get_db()`.
- Migraciones versionadas en `be/alembic/versions/` (50 revisiones, ej. `0001_baseline_esquema_inicial.py` hasta `0050_cliente_foto_url.py`).

### Almacenamiento de imágenes — `ninio_data`
- En el repositorio el directorio **`./minio_data`** es el volumen Docker de **MinIO** (`docker-compose.yml:88` ` ./minio_data:/data`), servicio S3 compatible. El prompt lo denomina `ninio_data`; la implementación real es **MinIO**.
- Bucket `neodomus-media` (`MINIO_BUCKET`), endpoint interno `minio:9000` y público `http://localhost:9000` (`be/app/config.py:72`-`76`, `docker-compose.yml:61`-`65`).
- Cliente centralizado `be/app/services/minio_service.py:32` (`_cliente()`, `subir_imagen()`, `url_publica()`) crea el bucket con política `s3:GetObject` pública y devuelve `{MINIO_PUBLIC_ENDPOINT}/{MINIO_BUCKET}/{objeto}`.
- Evidencias de entrega y de citas se almacenan bajo `evidencias_citas/` y `evidencias_entrega/` (migradas en `be/scripts/migrar_a_minio.py`).

### Contenedores
- **Docker** + **Docker Compose** (`docker-compose.yml:1`-`116`) con servicios `db`, `api`, `minio`, `frontend` y red `neodomus_net`.
- **uv** como gestor de dependencias en el backend (`be/Dockerfile`, `be/pyproject.toml`).

---

## Librerías y dependencias principales

### Backend (`be/pyproject.toml:6`)
| Librería | Uso |
|---|---|
| `fastapi`, `uvicorn[standard]` | API REST (`/api/v1`) y servidor ASGI |
| `sqlalchemy`, `pymysql`, `alembic` | ORM, driver MySQL y migraciones |
| `pydantic`, `pydantic-settings` | Validación y `Settings` desde `.env` |
| `python-jose`, `passlib`, `bcrypt` | JWT y hash de contraseñas |
| `python-multipart` | `UploadFile` para `POST /productos/upload-imagen` |
| `slowapi` | Rate limiting |
| `email-validator` | Validación de emails |
| `reportlab`, `openpyxl`, `Pillow` | PDFs de facturas/reportes, Excel, verificación de imágenes |
| `alembic` | Versionado de esquema |
| `google-auth`, `requests` | Google OAuth para clientes/empleados |
| `minio` | Cliente S3 para imágenes |
| `tzdata`, `apscheduler` | Zona `America/Bogota` y cron de recordatorios/ofertas |

### Frontend (`fe/package.json:11`)
| Librería | Uso |
|---|---|
| `react`, `react-dom` | UI |
| `react-router-dom` | Navegación SPA (`fe/src/App.tsx`) |
| `axios` | Cliente HTTP con interceptores JWT (`fe/src/services/api.ts`) |
| `framer-motion` | Animaciones |
| `react-icons` | Iconos (`FaArrowLeft`, `FaHeart`, etc.) |
| `@react-oauth/google` | Google Identity Services |

### Móvil (`movil/package.json:14`)
| Librería | Uso |
|---|---|
| `expo`, `expo-router` | Framework y file-based routing |
| `expo-image`, `expo-image-picker` | Carga y selección de imágenes |
| `expo-location`, `expo-file-system`, `expo-sharing` | Ubicación y manejo de archivos |
| `@react-native-async-storage/async-storage` | Sesión local |
| `react-native-reanimated`, `gesture-handler`, `safe-area-context` | UI nativa |

---

## Arquitectura del proyecto

Estructura real (raíz):

```
/
├── be/                      # Backend FastAPI
│   ├── app/
│   │   ├── main.py          # FastAPI app, lifespan scheduler, routers, /uploads y /evidencias
│   │   ├── config.py        # Settings (DB, JWT, MinIO, SMTP, etc.)
│   │   ├── database.py      # engine + SessionLocal + Base + get_db()
│   │   ├── models/          # cliente, user, tecnico, producto, pedido, cita, etc. (28 modelos)
│   │   ├── schemas/         # pydantic: producto, cita, cliente, auth
│   │   ├── routers/         # 15 routers (auth, users, clientes, tecnicos, productos, citas, pedidos, tarifas, calificaciones, notificaciones, especializaciones, reembolsos, devoluciones, consultas, reports, solicitudes)
│   │   ├── services/        # minio_service, pagos_service, factura_service, scheduler, recomendaciones
│   │   ├── middleware/      # cors, rate_limit, security_headers
│   │   ├── utils/           # security (JWT), email, audit_log, gmail_api, fechas
│   │   └── static/          # productos/ y evidencias/ (legado, ahora MinIO)
│   ├── alembic/             # env.py + versions/ (0001 … 0050)
│   ├── scripts/             # migrar_a_minio.py
│   ├── productos_local/     # montado desde fe/public/productos para seed de MinIO
│   ├── pyproject.toml       # dependencias (uv)
│   └── Dockerfile
├── fe/                      # Frontend web
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── services/api.ts  # axios con refresh auto
│   │   ├── contexts/        # AuthContext, CartContext, AuthModalContext
│   │   ├── pages/           # Home, public (ProductosPublicos, ProductoDetalle, Carrito, Checkout), cliente, tecnico, admin, auth
│   │   ├── components/      # productos/ProductoCard, layout (Navbar, AdminLayout...), profile, chat, etc.
│   │   ├── styles/          # producto-detalle.css, productos-publicos.css (detalle-recomendados incluido)
│   │   ├── i18n/            # IdiomaContext + translations
│   │   └── utils/           # favoritos, tecnicosFavoritos, google
│   ├── public/productos/    # imágenes seed (1.jpg … 17.jpg) y default.png
│   ├── vite.config.ts       # alias @components, @styles, etc. + server.port 5173
│   ├── package.json
│   └── Dockerfile
├── movil/                   # App Expo
│   ├── app/(tabs)/          # producto/[id].tsx, productos, carrito, etc.
│   ├── components/public/   # PublicNavbar, AsistenteFlotante
│   ├── contexts/            # FavoritosContext, CartContext
│   ├── services/            # api.ts (fetch + refresh), productos.service.ts (normalizarUrlImagen, urlImagenProducto)
│   ├── constants/           # api.ts (API_BASE_URL, BACKEND_HOST_URL), theme, variantes
│   ├── app.json             # expo config (splash, android permissions, expo-router)
│   └── package.json
├── scripts/                 # init_db.sql, seed_test_users.py, subir_productos_minio.py, export_seed.py
├── docs/                    # documentación funcional/técnica
├── docker-compose.yml       # db, api, minio, frontend
├── .env / .env.example
└── README.md
```

---

## Cómo funciona el sistema

1. El usuario entra como **visitante** (sin auth) y puede ver el catálogo, detalle de producto, imágenes desde MinIO y recomendaciones.
2. Al registrarse/loguearse (local o Google), el frontend guarda `access_token`/`refresh_token` por pestaña (`fe/src/services/api.ts:69` `tabSet`) y el móvil en `AsyncStorage` (`movil/services/storage.ts`).
3. El frontend/móvil consumen `VITE_API_URL` o `EXPO_PUBLIC_API_URL` bajo prefijo `/api/v1` (`movil/constants/api.ts:35` `API_BASE_URL`).
4. El backend valida JWT en `get_current_client`/`get_current_employee`, ejecuta lógica de negocio y consulta MySQL vía SQLAlchemy.
5. Imágenes de productos: se suben a MinIO (`POST /productos/upload-imagen` → `minio_service.subir_imagen("productos", nombre, bytes)`), se guarda la URL pública en `productos.imagen_url` y frontend/móvil la renderizan (`fe/src/components/productos/ProductoCard.tsx:80` `getImagen`, `movil/services/productos.service.ts:137` `normalizarUrlImagen` reescribe `localhost:9000` → host LAN para dispositivo físico/emulador).
6. Pedido: se crea desde el carrito, calcula técnicos requeridos/tiempo, asigna técnico de entrega y genera factura PDF (`factura_service`).
7. Cita: se agenda con tarifa fija por `tipo_servicio`, valida día laboral y franja `08:00-18:00`, verifica disponibilidad del técnico (`tecnico_ocupado`), procesa pago simulado y genera factura si es aprobado; la cancelación dispara reembolsos y ofertas de horario (`citas.py:138`-`255`).
8. El scheduler (`apscheduler`, `app/main.py:28` lifespan) envía recordatorios y limpia ofertas expiradas.

---

## API y comunicación

- **Tipo**: **API REST** bajo `/api/v1` (`be/app/main.py:113`).
- **Autenticación**: **JWT** (`HS256`, `SECRET_KEY` en `config.py:28`). Login devuelve `access_token` (60 min) y `refresh_token` (30 días). Renovación vía `POST /api/v1/auth/refresh` (`fe/src/services/api.ts:106`, `movil/services/api.ts:86`). **Google Sign-In** para clientes/empleados con `GOOGLE_SIGNIN_CLIENT_ID` / `VITE_GOOGLE_CLIENT_ID`.
- **Frontend ↔ Backend**: `axios` con interceptor que añade `Authorization: Bearer` y reintenta tras `401` con refresh; normaliza errores `422` a string para no crashear React (`fe/src/services/api.ts:246`).
- **Móvil ↔ Backend**: `fetch` con `AbortController` 15s, `ApiError` con `status`, mismo flujo de refresh (`movil/services/api.ts:119`).
- **Principales módulos / prefijos**:
  - `/auth` login/refresh/verify-email/reset-password/google
  - `/productos` CRUD catálogo, `/productos/upload-imagen` (MinIO), categorías/proveedores/reabastecimiento
  - `/citas` crear, horas-disponibles, admin CRUD y reasignación
  - `/pedidos` crear, recomendación técnicos, entregas
  - `/tecnicos`, `/clientes`, `/users`, `/tarifas`, `/especializaciones`, `/calificaciones`, `/notificaciones`, `/consultas`, `/reports`, `/reembolsos`, `/devoluciones`, `/solicitudes`
- **CORS** (`app/middleware/cors.py`) y **Security Headers** (`security_headers.py`) registrados en orden LIFO correcto (`main.py:100`-`102`).

---

## Gestión de imágenes con `ninio_data`

> **Aclaración**: el prompt habla de `ninio_data`; en el repositorio esa capa es **MinIO** y su volumen local es `./minio_data` (`docker-compose.yml:88`). No existe una segunda implementación paralela.

- **Qué es**: `minio_data/` es el directorio del host montado en el contenedor `neodomus_minio` como `/data` (`minio_data:/data`). Allí MinIO persiste objetos del bucket `neodomus-media` en formato S3.
- **Para qué se usa**: almacenar imágenes de **productos** (`productos/<uuid>.ext`) y evidencias (`evidencias_citas/`, `evidencias_entrega/`). Reemplaza el guardado previo en `app/static/productos`.
- **Cómo se cargan**: `fe/src/pages` admin → `POST /productos/upload-imagen` con `UploadFile`; backend valida extensión (`.jpg/.jpeg/.png/.webp/.gif`), tamaño ≤5 MB y `Pillow` (`be/app/routers/productos.py:808`), genera `uuid.hex+ext` y hace `minio_service.subir_imagen("productos", nombre, contenido)` (`minio_service.py:77`).
- **Cómo se relacionan**: la URL pública retornada se guarda en `productos.imagen_url` (y `producto_variante.imagen_url`, `evidencias.url_archivo`). Los registros heredados se migraron con `scripts/subir_productos_minio.py` y `be/scripts/migrar_a_minio.py`.
- **Cómo se recuperan (web)**: el API lista productos con `imagen_url` absoluta (`http://localhost:9000/neodomus-media/productos/1.jpg`); `ProductoCard.tsx:80` prioriza `imagen_url`, si falta usa `/productos/{id}.jpg` (Vite `public/`) y `onError` cae a `/productos/default.png`.
- **Cómo se recuperan (móvil)**: `movil/services/productos.service.ts:88` `normalizarUrlImagen()` reescribe cualquier `localhost:9000`, `127.0.0.1:9000`, `minio:9000` → host real de `BACKEND_HOST_URL` (LAN IP del PC o `10.0.2.2` para emulador Android) derivado de `EXPO_PUBLIC_API_URL` o `Constants.expoConfig.hostUri` (`movil/constants/api.ts:12`). Si no hay URL, usa `${BACKEND_HOST_URL}/uploads/{id}.jpg` y si la carga falla muestra placeholder `box-open`.
- **Configuración necesaria**: variables `MINIO_ENDPOINT` (`minio:9000` dentro de Docker), `MINIO_PUBLIC_ENDPOINT` (`http://localhost:9000` para navegadores), `MINIO_BUCKET`, `MINIO_ROOT_USER`/`MINIO_ROOT_PASSWORD` en `.env` y `docker-compose.yml`. No hardcodear secretos en código (`config.py` los lee de env).

---

## Requisitos previos

- **Node.js 22** + **pnpm 10** (frontend) o **npm**.
- **Python 3.10+** + **uv** (`pip install uv`) para backend (o `pip`).
- **Docker** y **Docker Compose** (recomendado para DB + MinIO + API + frontend).
- **MySQL 8.0** si se ejecuta sin Docker.
- **Expo** (para móvil): `npm i -g expo-cli` o `pnpm dlx expo`, **Android Studio** + emulador o dispositivo físico en la misma LAN, y **Expo Go** si se usa escaneo QR.

---

## Instalación y ejecución

### Docker (recomendado, levanta todo)

```bash
cp .env.example .env
# Rellena MYSQL_ROOT_PASSWORD, MYSQL_PASSWORD, SECRET_KEY (openssl rand -hex 32), MINIO_ROOT_PASSWORD

docker compose up --build -d
# Servicios: db (3307), api (8000), minio (9000/9001), frontend (5173)
# La API ejecuta automáticamente: uv run alembic upgrade head

# Subir imágenes seed a MinIO (primera vez)
docker compose exec api uv run python scripts/subir_productos_minio.py
# o migrar si ya había imágenes locales:
docker compose exec api uv run python scripts/migrar_a_minio.py

docker compose logs -f api
```

### Backend sin Docker

```bash
cd be
uv sync
cp ../.env.example ../.env  # ajustar DATABASE_URL a mysql+pymysql://user:pass@localhost:3306/neodomus
uv run alembic upgrade head
uv run uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
# o: uv run python -m app.main
```

### Frontend Web

```bash
cd fe
pnpm install
# .env: VITE_API_URL=http://localhost:8000/api/v1
#       VITE_GOOGLE_CLIENT_ID=...
pnpm dev      # vite en http://localhost:5173
pnpm build    # tsc && vite build
```

### Aplicación móvil

```bash
cd movil
pnpm install
cp .env.example .env
# Edita EXPO_PUBLIC_API_URL:
#   Emulador Android: http://10.0.2.2:8000
#   Dispositivo físico (misma Wi-Fi): http://<IP-LAN-PC>:8000  (ipconfig → IPv4)
#   EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=...

pnpm start           # expo start (QR para Expo Go)
pnpm android         # expo start --android
pnpm ios             # expo start --ios
pnpm typecheck       # tsc --noEmit
```

> Desde un dispositivo físico, abre el firewall TCP 8000 para la LAN: `New-NetFirewallRule -DisplayName "Neodomus API 8000 (LAN)" -Direction Inbound -Protocol TCP -LocalPort 8000 -RemoteAddress LocalSubnet -Action Allow`.

---

## Variables de entorno

Archivo **`.env`** en la raíz (ver `.env.example:1`). Grupos:

**Base de datos**
```
MYSQL_ROOT_PASSWORD=
MYSQL_DATABASE=neodomus
MYSQL_USER=neodomus
MYSQL_PASSWORD=
DATABASE_URL=mysql+pymysql://neodomus:pass@db:3306/neodomus?charset=utf8mb4
```

**Backend / JWT**
```
SECRET_KEY=openssl rand -hex 32
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=60
REFRESH_TOKEN_EXPIRE_DAYS=30
ENVIRONMENT=development
```

**MinIO (`ninio_data`)**
```
MINIO_ROOT_USER=neodomus
MINIO_ROOT_PASSWORD=
MINIO_ENDPOINT=minio:9000
MINIO_PUBLIC_ENDPOINT=http://localhost:9000
MINIO_BUCKET=neodomus-media
```

**SMTP / Resend / Gmail OAuth**
```
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=
SMTP_PASSWORD=
EMAIL_PROVIDER=smtp   # smtp | gmail_api | resend
RESEND_API_KEY=
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=
GOOGLE_REFRESH_TOKEN=
GOOGLE_SIGNIN_CLIENT_ID=
```

**Frontend**
```
FRONTEND_URL=http://localhost:5173
VITE_API_URL=http://localhost:8000/api/v1
VITE_GOOGLE_CLIENT_ID=
```

**Móvil (movil/.env)**
```
EXPO_PUBLIC_API_URL=http://10.0.2.2:8000   # sin /api/v1
EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID=
```

Nunca commitear `.env` real (`.gitignore:60` ignora `minio_data/` y `.env`).

---

## Roles del sistema

| Rol | Cómo entra | Qué puede hacer (implementado) |
|---|---|---|
| **Visitante** | Sin login | Ver catálogo, detalle, imágenes MinIO, recomendaciones; no puede comprar/agendar (el carrito pide login). |
| **Cliente** (`clientes`) | Registro con verificación por código email, login local o Google | Gestionar perfil, direcciones, carrito, pedidos, citas, calificar técnicos/productos, solicitar devoluciones, ver facturas/notificaciones/soporte. |
| **Técnico** (`usuarios` rol `tecnico` + `tecnicos`) | Cuenta creada por admin/seed (`scripts/seed_test_users.py`) | Dashboard técnico: citas asignadas (reassign si inactivo), entregas con evidencias y ubicación, historial, clientes, calificaciones, mensajes, devoluciones. |
| **Administrador** (`usuarios` rol `administrador`) | Seed `admin@neodomus.com` | CRUD productos/categorías/proveedores/variantes/visibilidad, gestionar citas (estado/técnico/comisión), reasignar pendientes, tarifas, especializaciones, reportes PDF/Excel, reembolsos, devoluciones, solicitudes de habilitación, consultas, notificaciones masivas. |

---

## Funcionalidades principales (verificadas)

- Autenticación local + Google, verificación por email y reset por código (`be/app/routers/auth.py`).
- Catálogo paginado con búsqueda/categoría/proveedor, stock derivado (`routers/productos.py:458`).
- Variantes por color/medida y venta por metros (`producto_variante`, `venta_por_metros`).
- Carga de imágenes a MinIO con validación Pillow y bucket público.
- Carrito con validación de stock y técnicos requeridos (`fe/src/contexts/CartContext.tsx`, `movil/contexts/CartContext`).
- Pedidos con pago simulado, entregas por rango horario y técnico (`routers/pedidos.py`).
- Citas con validación de día laboral, franja y disponibilidad de técnico, pago al agendar, facturación y reembolsos al cancelar (`routers/citas.py`).
- Ofertas de horario por cancelación a clientes frecuentes (`ofertas_horario`).
- Calificaciones de cita y de producto con foto (`routers/calificaciones.py`).
- Notificaciones in-app y por email (`routers/notificaciones.py`, `services/notificaciones.py`).
- Reportes administrativos y descarga de factura PDF protegida (`services/factura_service.py`, `routers/reports.py`).
- Gestión de devoluciones y reembolsos (`routers/devoluciones.py`, `routers/reembolsos.py`).

---

## Base de datos

Motor **MySQL 8.0**, charset `utf8mb4`. Entidades principales (ver `scripts/init_db.sql` y `be/app/models/`):

```
Cliente (clientes)
  ↓ 1—N
Pedido (pedidos) ──N—1 Tecnico_entrega (tecnicos → usuarios)
  ↓ 1—N
DetallePedido (detalle_pedido) ──N—1 Producto (productos → categorias, proveedores)
Producto ──N—N Especializacion (producto_especializacion)
Producto ──1—N ProductoVariante

Cliente ──1—N Cita (citas) ──N—1 Tecnico (id_tecnico, id_tecnico_2/3 → tecnicos)
Cita ──1—N CitaProducto ──N—1 Producto
Cita ──1—1 Comision / Factura / Calificacion / Evidencia
Pedido ──1—N Pago, Factura, EvidenciaEntrega, Devolucion, Reembolso

Tecnico ──1—1 User (usuarios → roles_usuario)
Tecnico ──N—N Especializacion (tecnico_especializacion)
Tecnico ──1—1 UbicacionTecnico
```

Relaciones clave: `citas.id_cliente → clientes.id_cliente (CASCADE)`, `pedidos.id_cliente_pe → clientes`, `detalle_pedido.id_pedido_d/id_producto_d`, `cita_producto.id_cita/id_producto/id_variante` con `ON DELETE CASCADE`, `producto_especializacion` y `tecnico_especializacion` como tablas pivote.

---

## Scripts de base de datos (`scripts/`)

| Archivo | Descripción |
|---|---|
| `init_db.sql` | Esquema y datos seed idempotentes (tipos documento, roles, proveedores, sucursales, categorías, clientes/usuarios, productos, tarifas). |
| `seed_test_users.py` | Crea usuarios de prueba (clientes/admin/técnico) con hash bcrypt, idempotente. |
| `subir_productos_minio.py` | Sube `fe/public/productos/` a MinIO y actualiza `productos.imagen_url`. |
| `migrar_a_minio.py` (en `be/scripts/`) | Migra `app/static/productos` y `app/static/evidencias` a MinIO. |
| `export_seed.py` | Regenera la sección `INSERT IGNORE` de `init_db.sql` desde la BD actual. |

Ejecución recomendada dentro del contenedor `api` (`scripts/README.md`):

```bash
docker exec -it neodomus_api uv run python /app/scripts/seed_test_users.py
```

---

## Licencia

Proyecto académico — Neodomus. Uso interno para demostración y evaluación.
