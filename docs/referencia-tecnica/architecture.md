# Arquitectura del Sistema — Neodomus

<!--
  ¿Qué? Documentación de la arquitectura general del sistema Neodomus.
  ¿Para qué? Que cualquier desarrollador entienda cómo interconectan los módulos,
             capas y responsabilidades antes de leer el código fuente.
  ¿Impacto? Sin este documento, un desarrollador nuevo tardaría horas en entender
             por qué el código está estructurado así y cuál es el flujo de cada operación.
             Este documento reduce significativamente el tiempo de onboarding.
-->

> **Proyecto**: Neodomus — Plataforma de gestión de servicios domóticos  
> **Stack**: FastAPI (Python 3.10+) + React 18 (TypeScript) + MySQL 8.0 + Leaflet + Docker  
> **Tests**: Backend ≥ 70% · Frontend ≥ 80%  
> **Roles**: `usuario`, `tecnico`, `admin`

---

## Vista General del Sistema

El sistema sigue una **arquitectura Cliente–Servidor de 3 capas**, donde cada capa tiene una responsabilidad única y se comunica solo con la capa adyacente:
┌────────────────────────────────────────────────────────────────────────────┐
│ CAPA 3 — CLIENTE (Navegador Web / Móvil) │
│ │
│ React 18 + TypeScript + Vite + TailwindCSS + React Router │
│ https://app.neodomus.com │
│ │
│ ┌─────────────┐ ┌─────────────────┐ ┌──────────────────────────────┐ │
│ │ Pages │ │ Components │ │ Context / Hooks │ │
│ │ (vistas) │ │ (UI + Layout) │ │ (Auth, Notificaciones, Chat) │ │
│ └──────┬──────┘ └────────┬────────┘ └──────────────────────────────┘ │
│ │ │ │
│ └──────────────────┤ │
│ ▼ │
│ ┌─────────────────────────────────────────────────────┐ │
│ │ api/ (axios + interceptors JWT) + Map (Leaflet) │ (HTTP + JWT) │
│ └─────────────────────────────────────────────────────┘ │
└────────────────────────────────────────████████████████████████────────────┘
↕ JSON / HTTPS
┌────────────────────────────────────────████████████████████████────────────┐
│ CAPA 2 — SERVIDOR (Backend API) │
│ │
│ FastAPI + Uvicorn (ASGI) + SQLAlchemy + Pydantic │
│ https://api.neodomus.com │
│ │
│ ┌──────────────┐ ┌─────────────┐ ┌────────────────┐ │
│ │ Routers │ → │ Services │ → │ Utils │ │
│ │ (endpoints) │ │ (lógica) │ │ (sec/email/ │ │
│ └──────────────┘ └─────────────┘ │ pagos/chat/ │ │
│ │ │ │ audit) │ │
│ ▼ ▼ └────────────────┘ │
│ ┌──────────────────────────────────────────────────────┐ │
│ │ Schemas (Pydantic) + Models (SQLAlchemy ORM) │ │
│ └──────────────────────────────────────────────────────┘ │
└────────────────────────────────────────████████████████████████────────────┘
↕ SQL (PyMySQL)
┌────────────────────────────────────────████████████████████████────────────┐
│ CAPA 1 — DATOS (Base de Datos) │
│ │
│ MySQL 8.0 (Docker Container o Cloud) │
│ localhost:3306 │
│ │
│ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────┐ │
│ │ usuarios │ │ tecnicos │ │ servicios │ │ citas │ │
│ ├────────────┤ ├────────────┤ ├────────────┤ ├────────────┤ │
│ │ pagos │ │calificacion│ │ chat │ │notificacion│ │
│ └────────────┘ └────────────┘ └────────────┘ └────────────┘ │
│ También: password_reset_tokens, email_verification_tokens, audit_log │
└────────────────────────────────────────────────────────────────────────────┘

text

---

## Arquitectura del Backend (`backend/`)

### Estructura de capas
backend/
│
├── app/
│ ├── main.py ← Punto de entrada: FastAPI app, CORS, middleware, routers
│ ├── config.py ← Variables de entorno con Pydantic Settings
│ ├── database.py ← Engine + Session de SQLAlchemy
│ ├── dependencies.py ← Dependencias inyectables: get_db(), get_current_user(), require_rol()
│ │
│ ├── routers/ ← CAPA DE PRESENTACIÓN (HTTP)
│ │ ├── auth.py ← /register, /login, /refresh, /change-password, etc.
│ │ ├── usuarios.py ← /me, /me (PUT), /me (DELETE)
│ │ ├── servicios.py ← catálogo y detalles
│ │ ├── citas.py ← solicitar, listar, modificar, cancelar
│ │ ├── pagos.py ← iniciar, webhook, abono, comprobante
│ │ ├── tech.py ← mis-tareas, estado, evidencias, disponibilidad, mapa
│ │ ├── admin.py ← gestión de técnicos, aprobación, asignación, reportes
│ │ ├── chat.py ← enviar, conversación, marcar leído
│ │ ├── notificaciones.py ← listar, marcar leída
│ │ └── calificaciones.py ← calificar, listar
│ │
│ ├── services/ ← CAPA DE LÓGICA DE NEGOCIO
│ │ ├── auth_service.py
│ │ ├── usuario_service.py
│ │ ├── cita_service.py ← validación de 48h, horarios, conflictos
│ │ ├── pago_service.py ← abonos, actualización de estado de pedido
│ │ ├── tech_service.py ← asignación, evidencias
│ │ ├── admin_service.py
│ │ ├── chat_service.py
│ │ └── notificacion_service.py
│ │
│ ├── models/ ← CAPA DE DATOS (ORM)
│ │ ├── usuario.py
│ │ ├── tecnico.py (hereda de usuario o relación 1:1)
│ │ ├── servicio.py
│ │ ├── cita.py
│ │ ├── pedido.py
│ │ ├── pago.py
│ │ ├── calificacion.py
│ │ ├── mensaje.py
│ │ ├── notificacion.py
│ │ ├── promocion.py
│ │ ├── password_reset_token.py
│ │ └── email_verification_token.py
│ │
│ ├── schemas/ ← VALIDACIÓN (Pydantic)
│ │ ├── usuario.py (UserCreate, UserLogin, UserResponse, etc.)
│ │ ├── servicio.py
│ │ ├── cita.py
│ │ ├── pago.py
│ │ └── ...
│ │
│ ├── core/ ← NÚCLEO
│ │ ├── security.py ← hash_password, verify_password, create_access_token,
│ │ │ create_refresh_token, decode_token (con rol embebido)
│ │ └── audit_log.py ← log_login_success/failed, log_asignacion, log_pago
│ │
│ └── utils/ ← UTILIDADES TRANSVERSALES
│ ├── email.py ← send_verification_email, send_password_reset_email,
│ │ send_notificacion, send_recordatorio
│ ├── limiter.py ← Instancia de SlowAPI (rate limiter)
│ ├── geocoding.py ← convertir dirección a coordenadas (lat/lng)
│ └── payment_gateway.py ← cliente de pasarela de pagos (MercadoPago/Stripe)
│
├── requirements.txt
├── Dockerfile
└── .env.example

text

### Flujo de una petición HTTP (ej. solicitud de servicio)
Cliente envía: POST /api/v1/citas
Authorization: Bearer <access_token>
Body: { servicio_id, fecha, hora, direccion }
↓

FastAPI valida El schema CitaCreate (Pydantic) valida tipos y formato
el body: Si hay errores de validación → 422 automático
↓

Rate limiting: @limiter.limit("20/minute") verifica por IP + usuario
Si sí → 429 Too Many Requests
↓

Dependencia: current_user: Usuario = Depends(get_current_user) extrae del token
(valida JWT, extrae rol, obtiene usuario de BD)
Si token inválido/ausente → 401
↓

Router: routers/citas.py::solicitar_cita()
Llama a cita_service.crear_solicitud(db, datos, current_user.id)
↓

Service: cita_service.crear_solicitud():

Verifica que servicio exista y esté activo

Valida fecha >= hoy + 24h

Valida hora dentro del horario general (tabla config)

Verifica que el usuario no tenga otra cita en el mismo horario

Crea cita en estado "pendiente"

Registra en audit_log (action="solicitar_servicio")

Envía notificación por email al usuario (confirmación)
↓

Response: Router retorna CitaResponse (con datos de la cita)
FastAPI serializa a JSON con response_model

text

### Seguridad en el backend (capas)
┌────────────────────────────────────────────────────────────────┐
│ Capas de seguridad (de afuera hacia adentro) │
│ │
│ 1. CORS Middleware → Solo FRONTEND_URL │
│ 2. Security Headers → X-Frame-Options, nosniff │
│ 3. Rate Limiter (slowapi) → Por IP, por endpoint sensible │
│ 4. Pydantic Validation → Tipos, rangos, formatos │
│ 5. JWT Verification → get_current_user + roles │
│ 6. Business Logic Checks → dueño del recurso, 48h, estado │
│ 7. SQLAlchemy ORM → No raw SQL, no injection │
│ 8. bcrypt Hashing → Contraseñas nunca en plano │
│ 9. Audit Logging → Trazabilidad de eventos críticos│
└────────────────────────────────────────────────────────────────┘

text

---

## Arquitectura del Frontend (`frontend/`)

### Estructura de capas
frontend/
│
├── src/
│ ├── main.tsx ← Punto de entrada: renderiza <App /> en el DOM
│ ├── App.tsx ← Rutas de la aplicación (React Router)
│ ├── index.css ← Estilos globales + TailwindCSS
│ │
│ ├── context/ ← ESTADO GLOBAL
│ │ ├── AuthContext.tsx ← Provider: usuario, rol, tokens
│ │ └── NotificationContext.tsx ← campana, notificaciones no leídas
│ │
│ ├── hooks/ ← LÓGICA REUTILIZABLE
│ │ ├── useAuth.ts
│ │ ├── useHasRol.ts
│ │ ├── useNotificaciones.ts
│ │ └── useChat.ts
│ │
│ ├── api/ ← COMUNICACIÓN HTTP
│ │ ├── auth.ts, citas.ts, pagos.ts, tech.ts, admin.ts, etc.
│ │ └── axios.ts ← Instancia de Axios con interceptores JWT + refresh
│ │
│ ├── components/ ← COMPONENTES REUTILIZABLES
│ │ ├── ProtectedRoute.tsx ← guarda de rutas por rol
│ │ ├── layout/
│ │ │ ├── AppLayout.tsx (navbar + campana + sidebar)
│ │ │ └── Navbar.tsx
│ │ ├── ui/
│ │ │ ├── Button.tsx
│ │ │ ├── InputField.tsx
│ │ │ ├── Alert.tsx
│ │ │ ├── NotificationBell.tsx
│ │ │ └── RatingStars.tsx
│ │ └── map/
│ │ └── TechMap.tsx (Leaflet con marcadores)
│ │
│ ├── pages/ ← VISTAS (una por ruta)
│ │ ├── auth/ (Login, Register, ForgotPassword, ResetPassword)
│ │ ├── usuario/ (Dashboard, MisServicios, SolicitarServicio, Historial)
│ │ ├── tecnico/ (TechDashboard, TechMap, TechTareas, TechDisponibilidad)
│ │ └── admin/ (AdminTecnicos, AdminSolicitudes, AdminServicios, AdminReportes)
│ │
│ └── types/ ← TIPOS TYPESCRIPT
│ ├── auth.ts
│ ├── servicio.ts
│ ├── cita.ts
│ └── ...
│
├── package.json (versiones exactas, pnpm)
├── vite.config.ts
└── .env.example

text

### Rutas de la aplicación (protegidas por rol)
/ → Redirige según rol o a /login
/login → LoginPage (pública)
/register → RegisterPage (pública)
/forgot-password → ForgotPasswordPage (pública)
/reset-password → ResetPasswordPage (pública)
/verify-email → manejado con token

/panel/dashboard → DashboardPage (usuario) PROTEGIDO
/panel/servicios/solicitar → SolicitarServicioPage (usuario) PROTEGIDO
/panel/mis-servicios → MisServiciosPage (usuario) PROTEGIDO

/tech/mapa → TechMapPage (técnico) PROTEGIDO
/tech/mis-tareas → TechTareasPage (técnico) PROTEGIDO
/tech/disponibilidad → TechDisponibilidadPage (técnico) PROTEGIDO

/admin/tecnicos → AdminTecnicosPage (admin) PROTEGIDO
/admin/solicitudes → AdminSolicitudesPage (admin) PROTEGIDO
/admin/servicios → AdminServiciosPage (admin) PROTEGIDO
/admin/reportes → AdminReportesPage (admin) PROTEGIDO

text

### Flujo de autenticación + roles en frontend
Arranque de la app:

AuthContext se monta → lee access_token de sessionStorage (no localStorage)

Si hay token → verifica con GET /api/v1/users/me

Si 200 → usuario autenticado, guarda rol

Si 401 → intenta refresh con POST /api/v1/auth/refresh

Si refresh falla → logout y redirige a /login

Login exitoso:

POST /auth/login → { access_token, refresh_token, rol }

AuthContext guarda tokens en sessionStorage y rol en estado

GET /users/me → guarda perfil completo

Redirige según rol: /panel/dashboard (usuario), /tech/mapa (técnico), /admin/tecnicos (admin)

Expiración del access_token (15 min):

Axios interceptor detecta 401

Automáticamente llama refresh

Si refresh OK → reintenta petición original

Si refresh falla → logout + redirect

text

---

## Flujos de Negocio (End-to-End)

### Flujo 1 — Registro, verificación y login
Usuario Frontend Backend MySQL
│ │ │ │
│ Rellena form │ │ │
│─────────────────►│ POST /auth/register │ │
│ │────────────────────────────►│ │
│ │ │ Validación, bcrypt │
│ │ │ INSERT usuario (is_verified=0)
│ │ │──────────────────────────►│
│ │ │ Envía email de verificación
│ │◄────────────────────────────│ │
│"Verifica email" │ 201 UserResponse │ │
│◄─────────────────│ │ │
│ │ │ │
│ Clic en enlace │ │ │
│─────────────────►│ POST /auth/verify-email │ │
│ │────────────────────────────►│ │
│ │ │ UPDATE is_verified=1 │
│ │ │──────────────────────────►│
│ │◄────────────────────────────│ │
│"Verificado" │ 200 │ │
│◄─────────────────│ │ │
│ │ │ │
│ email+password │ POST /auth/login │ │
│─────────────────►│────────────────────────────►│ │
│ │ │ SELECT user │
│ │ │──────────────────────────►│
│ │ │ verify_password │
│ │ │ create tokens │
│ │◄────────────────────────────│ │
│ │ 200 { access, refresh, rol }│ │
│ │ │ │
│ Redirige a dashboard según rol │ │

text

### Flujo 2 — Solicitud de servicio con pago y asignación de técnico
Usuario Frontend Backend Admin Técnico
│ │ │ │ │
│ Selecciona servicio, fecha, hora │ │
│─────────────►│ POST /citas │ │
│ │────────────────►│ │ │
│ │ │ Validaciones (24h, conflicto) │
│ │ │ Crear cita: estado="pendiente" │
│ │◄────────────────│ │ │
│"Solicitado" │ │ │ │
│◄─────────────│ │ │ │
│ │ │ │ │
│ │ POST /pagos/iniciar (opcional) │ │
│ │────────────────►│ │ │
│ │ │ Crear intención de pago │
│ │◄────────────────│ │ │
│ │ │ │ │
│(Paga por pasarela) │ │ │
│ │ │ │ │
│ │ │ Webhook de pago│ │
│ │ │◄───────────────│ (pasarela) │
│ │ │ Marcar pedido pagado │
│ │ │ │ │
│ │ │ │ │
│ │ │ │ Admin aprueba │
│ │ │ │ asignando técnico
│ │ │◄───────────────│ │
│ │ │ cita.estado="confirmada" │
│ │ │ notificar técnico │
│ │ │────────────────────────────────►│
│ │ │ │ técnico recibe
│ │ │ │ notificación
│ │ │ │ │
│ │ │ │ Técnico ve tarea
│ │ │ │ en mapa y lista

text

### Flujo 3 — Técnico actualiza estado y sube evidencias
Técnico Frontend Backend MySQL
│ │ │ │
│ Abre tarea │ │ │
│──────────────►│ GET /tech/tarea/101 │ │
│ │────────────────────────►│ │
│ │ │ SELECT cita + cliente │
│ │ │────────────────────────►│
│ │◄────────────────────────│ │
│ Ve detalles │ │ │
│ │ │ │
│ Marca "en_progreso" │ │
│──────────────►│ PUT /tech/tarea/101/estado {"estado":"en_progreso"}
│ │────────────────────────►│ │
│ │ │ UPDATE estado │
│ │ │────────────────────────►│
│ │ │ audit_log: cambio_estado │
│ │◄────────────────────────│ │
│ │ │ │
│ Finaliza y sube fotos │ │
│──────────────►│ POST /tech/tarea/101/evidencias (multipart) │
│ │────────────────────────►│ │
│ │ │ Guardar fotos en Storage │
│ │ │ UPDATE estado="completado"
│ │ │────────────────────────►│
│ │ │ Notificar al usuario │
│ │◄────────────────────────│ │
│ │ │ │
│ │ │ (Usuario califica después)

text

### Flujo 4 — Cancelación de cita (regla de 48h)
Usuario Frontend Backend MySQL
│ │ │ │
│ Solicita cancelación de cita #101 (fecha en 3 días) │
│────────────────►│ DELETE /citas/101 │
│ │────────────────►│ │
│ │ │ 1. Obtener cita │
│ │ │ 2. Calcular diferencia (fecha - now)
│ │ │ 3. Si >= 48h → permitido │
│ │ │ 4. Soft delete o estado="cancelado"
│ │ │─────────────────────────────►│
│ │ │ 5. audit_log: cancelacion │
│ │ │ 6. Notificar técnico (si asignado)
│ │◄────────────────│ │
│"Cancelado" │ │ │
│◄────────────────│ │ │

text

---

## Decisiones Técnicas Clave

### ¿Por qué FastAPI y no Django o Flask?

| Criterio             | FastAPI                | Flask        | Django               |
| -------------------- | ---------------------- | ------------ | -------------------- |
| Velocidad            | ⚡ Ultra rápido (ASGI) | Medio (WSGI) | Medio (WSGI)         |
| Tipado               | ✅ Nativo (Pydantic)   | ❌ Manual    | ⚠️ Parcial           |
| Validación           | ✅ Automática          | ❌ Manual    | ✅ Forms/Serializers |
| Documentación        | ✅ Swagger auto        | ❌ Manual    | ❌ Manual (o DRF)    |
| Curva de aprendizaje | Baja                   | Muy baja     | Alta                 |

FastAPI fue elegido por su soporte nativo de tipos, validación automática con Pydantic, documentación Swagger auto-generada, y su rendimiento ASGI, adecuado para una API con múltiples roles y operaciones complejas.

### ¿Por qué JWT stateless con roles embebidos?

| Criterio           | JWT Stateless + roles     | Sesiones en servidor                |
| ------------------ | ------------------------- | ----------------------------------- |
| Escalabilidad      | ✅ Horizontal fácil       | ❌ Requiere sticky sessions o Redis |
| Estado en servidor | ✅ Ninguno                | ❌ Almacenamiento de sesiones       |
| Revocación         | ❌ Requiere blacklist     | ✅ Borrar sesión                    |
| Rol en cada petición | ✅ en el payload, sin consulta BD | ❌ requiere consultar BD cada vez |

Para Neodomus, tener el rol embebido en el JWT permite autorizar rápidamente sin hacer una consulta a la base de datos por cada petición, lo cual es crítico para el rendimiento cuando hay muchos técnicos y administradores.

### ¿Por qué MySQL y no PostgreSQL?

El proyecto original usaba MySQL 8.0 por requisitos del stack académico (triggers, vistas, procedimientos almacenados). MySQL es suficiente para la carga esperada (miles de usuarios, cientos de técnicos). Sin embargo, si se escalara, se podría migrar fácilmente gracias a SQLAlchemy (cambiar cadena de conexión).

### ¿Por qué Leaflet para el mapa del técnico?

- **Open-source** y gratuito (sin restricciones de API key como Google Maps)
- **Ligero** y compatible con React (react-leaflet)
- **Suficiente** para mostrar marcadores, popups y trayectorias
- **Accesible** (soporte de teclado y etiquetas ARIA)

### ¿Por qué React + Vite y no Next.js?

Neodomus es una **SPA (Single Page Application)** — no necesita SSR (Server-Side Rendering) porque el backend ya es una API separada. Vite ofrece desarrollo rápido y builds optimizados. Next.js agregaría complejidad innecesaria. Además, la navegación por roles se maneja completamente en el cliente con `ProtectedRoute`.

---

## Configuración de Entornos

| Variable                    | Desarrollo                                      | Producción                                        |
| --------------------------- | ----------------------------------------------- | ------------------------------------------------- |
| `ENVIRONMENT`               | `development`                                   | `production`                                      |
| `/docs` (Swagger)           | ✅ Disponible                                   | ❌ Deshabilitado (404)                            |
| `DATABASE_URL`              | `mysql://user:pass@localhost:3306/neodomus`     | Servidor MySQL en cloud (Aiven/Clever Cloud)      |
| `FRONTEND_URL`              | `http://localhost:5173`                         | `https://app.neodomus.com`                        |
| `SECRET_KEY`                | Clave de desarrollo (≥32 char)                  | Clave aleatoria (`openssl rand -hex 32`)          |
| `SMTP_*`                    | Mock (logs en consola)                          | Credenciales reales (Resend/SendGrid)             |
| `PAYMENT_SECRET`            | Sandbox (test)                                  | Clave de producción (MercadoPago/Stripe)          |
| `MAPBOX_TOKEN` (opcional)   | Token público de prueba                         | Token de producción (si se usa)                   |

> Ver `backend/.env.example` y `frontend/.env.example` para la lista completa de variables.

---

## Diagrama de Componentes y Dependencias
┌───────────────────────────────────────────────────────────────────────────┐
│ Cliente (Navegador) │
│ ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────────┐ │
│ │ React │───▶│ Context │───▶│ Pages │───▶│ API (axios) │ │
│ │ Router │ │ Auth, Notif│ │ (vistas) │ │ + interceptors│ │
│ └───────────┘ └───────────┘ └───────────┘ └───────┬───────┘ │
│ │ │
│ ┌───────────────────────────────────────────────────────────┘ │
│ │ │
│ │ (HTTPS + JSON) │
└──┼─────────────────────────────────────────────────────────────────────────┘
│
▼
┌───────────────────────────────────────────────────────────────────────────┐
│ Backend (FastAPI) │
│ │
│ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ │
│ │ Middlewares │───▶│ Routers │───▶│ Services │ │
│ │ (CORS, Sec) │ │ (auth,citas, │ │ (lógica de │ │
│ └──────────────┘ │ tech, admin)│ │ negocio) │ │
│ └──────┬───────┘ └──────┬───────┘ │
│ │ │ │
│ ▼ ▼ │
│ ┌─────────────────────────────────┐ │
│ │ Models (SQLAlchemy ORM) │ │
│ │ + Schemas (Pydantic) │ │
│ └─────────────────────────────────┘ │
│ │ │
│ ▼ │
│ (SQL + PyMySQL) │
└──────────────────────────────────────┼─────────────────────────────────────┘
│
▼
┌───────────────────────────────────────────────────────────────────────────┐
│ MySQL 8.0 │
│ Tablas: usuarios, tecnicos, servicios, citas, pagos, calificaciones, │
│ mensajes, notificaciones, audit_log, tokens, promociones... │
└───────────────────────────────────────────────────────────────────────────┘

text

---

## Resumen de Componentes Clave

| Componente              | Tecnología               | Responsabilidad                                                   |
| ----------------------- | ------------------------ | ----------------------------------------------------------------- |
| **Frontend (SPA)**      | React 18 + Vite + TS     | UI, estado global, rutas protegidas por rol, mapa Leaflet         |
| **Backend API**         | FastAPI + SQLAlchemy     | Lógica de negocio, autenticación, roles, endpoints REST           |
| **Base de datos**       | MySQL 8.0                | Persistencia, triggers (48h), vistas, integridad referencial      |
| **Autenticación**       | JWT (bcrypt)             | Stateless, roles embebidos en token                               |
| **Mapa**                | Leaflet + react-leaflet  | Visualización de tareas para técnicos con marcadores              |
| **Pagos**               | MercadoPago/Stripe       | Pasarela, webhook, abonos parciales, comprobantes PDF             |
| **Notificaciones**      | SMTP + in-app (campana)  | Email de confirmación, recordatorios, asignaciones                |
| **Chat**                | REST (sin WebSockets v1) | Comunicación asíncrona con contexto de servicio                   |
| **Auditoría**           | Tabla `audit_log`        | Trazabilidad de eventos críticos (login, asignaciones, pagos)     |
| **Rate Limiting**       | slowapi (por IP)         | Protección contra fuerza bruta (login, registro, recuperación)    |
| **Seguridad**           | CORS, headers, HTTPS     | Configuración de producción deshabilita Swagger, limita orígenes  |

---

> **Conclusión**: Neodomus sigue una arquitectura limpia de 3 capas, con separación clara de responsabilidades, roles embebidos en JWT, y componentes bien definidos (citas, pagos, mapa, chat). Esta arquitectura permite escalar horizontalmente (stateless), es testeable (inyección de dependencias) y mantenible (capas independientes). El frontend está organizado por roles y protege rutas automáticamente, mientras que el backend valida cada operación con lógica de negocio y reglas como la cancelación con 48 horas de anticipación. Todo el sistema está diseñado para ser accesible (WCAG AA) y seguro (OWASP Top 10).

---