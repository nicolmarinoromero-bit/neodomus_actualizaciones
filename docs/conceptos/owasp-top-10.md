# OWASP Top 10 — Guía Pedagógica de Seguridad para Neodomus

<!--
  ¿Qué? Documento que explica cada una de las 10 vulnerabilidades más críticas
        según OWASP (Open Worldwide Application Security Project) y cómo Neodomus
        las mitiga o por qué no aplican.
  ¿Para qué? Educar al equipo sobre seguridad web práctica en el contexto de
             una plataforma de servicios domóticos: autenticación, solicitudes,
             pagos, chat, geolocalización y roles.
  ¿Impacto? Neodomus maneja datos personales de clientes, información financiera
             y ubicaciones de técnicos. Una brecha afectaría la confianza, la
             reputación y podría tener consecuencias legales (LOPD, RGPD).
-->

> **Referencia oficial**: [OWASP Top 10 — 2021](https://owasp.org/Top10/)
> **Edición usada en este proyecto**: 2021 (vigente al inicio del proyecto, 2026)

---

## ¿Qué es OWASP?

**OWASP** (Open Worldwide Application Security Project) es una fundación internacional
sin fines de lucro dedicada a mejorar la seguridad del software. Su **Top 10** es el
listado de las vulnerabilidades más críticas y frecuentes en aplicaciones web, actualizado
periódicamente con datos reales de miles de organizaciones.

> En el sector de servicios domóticos, la seguridad es crítica: accesos no autorizados
> a sistemas de control del hogar, robo de datos de pago o suplantación de técnicos
> pueden tener consecuencias graves. Conocer y mitigar el OWASP Top 10 es obligatorio.

---

## Resumen de Estado — Neodomus

| #   | Categoría                     | Estado          | Implementación en Neodomus                                                                 |
| --- | ----------------------------- | --------------- | ------------------------------------------------------------------------------------------- |
| A01 | Broken Access Control         | ✅ Implementado | JWT + roles (usuario/técnico/admin) + `Depends(get_current_user)` + permisos en cada router |
| A02 | Cryptographic Failures        | ✅ Implementado | bcrypt para contraseñas, JWT HS256, HTTPS en producción, validación de SECRET_KEY ≥32 chars |
| A03 | Injection                     | ✅ Implementado | SQLAlchemy ORM (sin SQL crudo), validación Pydantic, escape automático en React             |
| A04 | Insecure Design               | ✅ Implementado | Rate limiting por IP (slowapi), límites por endpoint (login 10/min, registro 5/min)         |
| A05 | Security Misconfiguration     | ✅ Implementado | CORS restringido, headers de seguridad, docs API deshabilitados en producción               |
| A06 | Vulnerable Components         | ✅ Monitoreado  | Versiones fijadas en frontend (pnpm) y backend (poetry/pip-tools), auditorías periódicas    |
| A07 | Auth & Session Failures       | ✅ Implementado | Tokens de corta duración (15 min access, 7 días refresh), validación de contraseña fuerte   |
| A08 | Software & Data Integrity     | ⚠️ Parcial      | JWT firmados, pero sin firma de artefactos de despliegue (fuera de alcance académico)       |
| A09 | Logging & Monitoring Failures | ✅ Implementado | Audit logs estructurados (login, asignaciones, cambios de estado, pagos)                    |
| A10 | Server-Side Request Forgery   | ✅ N/A / Controlado | No hay endpoints que hagan peticiones HTTP a URLs externas controladas por el usuario       |

---

## A01 — Broken Access Control (Control de Acceso Roto)

### ¿Qué es?

Un usuario puede acceder a recursos o realizar acciones **para las que no tiene permiso**.
En Neodomus, esto significaría que un cliente normal pudiera ver el panel de administración,
o que un técnico pudiera modificar pedidos de otros técnicos.

### Ejemplos de ataque específicos para Neodomus


Cliente intenta ver el panel de administración:
GET /api/admin/usuarios → debería devolver 403, pero si el control de acceso está roto, devuelve datos.

Técnico intenta asignarse un servicio que no es suyo:
POST /api/tech/servicio/123/asignar → sin verificar que el servicio le pertenezca.

Usuario autenticado intenta ver el chat de otro usuario:
GET /api/chat/conversacion/456 → debería devolver 403 si la conversación no le pertenece.

text

### Cómo lo mitiga Neodomus

**1. Dependencia `get_current_user` con extracción de rol** (backend en `app/core/auth.py`):

```python
# Cada endpoint protegido obtiene el usuario desde el token JWT,
# no desde un parámetro que el cliente pueda manipular.
async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: Session = Depends(get_db)
) -> User:
    payload = jwt.decode(token, settings.SECRET_KEY, algorithms=["HS256"])
    user_id = payload.get("sub")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(401)
    return user

# Los endpoints verifican el rol explícitamente:
@router.get("/admin/usuarios")
def list_users(current_user: User = Depends(get_current_user)):
    if current_user.rol != "admin":
        raise HTTPException(403, "Se requiere rol de administrador")
    ...
2. Permisos a nivel de recurso (ej. técnico solo ve sus servicios):

python
# En `app/routers/tech.py`:
@router.get("/mis-servicios")
def get_my_services(
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    # El técnico solo puede ver servicios donde `tecnico_id` coincida con su ID
    servicios = db.query(Servicio).filter(Servicio.tecnico_id == current_user.id).all()
    return servicios
3. Middleware de auditoría para acciones sensibles (asignaciones, cambios de estado, pagos):

python
# Cada cambio de estado se registra con quién lo hizo
audit_log(
    user_id=current_user.id,
    action="asignar_tecnico",
    target_id=servicio_id,
    ip_address=request.client.host
)
Principio clave: Nunca confiar en el cliente. El ID del usuario y su rol se extraen del token, nunca se aceptan como parámetros de query/body.

A02 — Cryptographic Failures (Fallas Criptográficas)
¿Qué es?
Uso incorrecto o insuficiente de criptografía: contraseñas en texto plano, algoritmos débiles (MD5, SHA1), claves cortas, o datos sensibles transmitidos sin cifrado.

Ejemplos en Neodomus
sql
-- Si las contraseñas se guardaran en texto plano:
SELECT password FROM usuario WHERE email = 'cliente@example.com';
-- "MiCasa123" → el atacante puede usarla directamente

-- Si se usara MD5 (rompible en segundos):
-- "5d41402abc4b2a76b9719d911017c592" → diccionario online lo descifra
Cómo lo mitiga Neodomus
1. bcrypt para contraseñas (backend app/utils/security.py):

python
from passlib.context import CryptContext

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)  # "$2b$12$..."

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)
¿Por qué bcrypt? Es un hash adaptativo (lento por diseño). Un atacante solo puede probar miles de contraseñas por segundo, en lugar de miles de millones con SHA-256.

2. JWT con SECRET_KEY robusta (validada en configuración):

python
# app/core/config.py
SECRET_KEY: str = os.getenv("SECRET_KEY", "")

@validator("SECRET_KEY")
def validate_secret_key(cls, v):
    if len(v) < 32:
        raise ValueError("SECRET_KEY debe tener al menos 32 caracteres. Genera con: openssl rand -hex 32")
    return v
3. HTTPS obligatorio en producción:

El frontend (React/Vite) se sirve solo sobre HTTPS.

El backend (FastAPI) configura CORS para orígenes HTTPS y utiliza HSTS.

Los tokens JWT y las credenciales nunca viajan en texto plano.

A03 — Injection (Inyección)
¿Qué es?
Datos no confiables del usuario se interpretan como código o consultas. En Neodomus, esto podría ser SQL Injection en búsquedas de servicios, XSS en comentarios de calificaciones, o NoSQL injection si usáramos MongoDB.

Ejemplo de SQL Injection en Neodomus (malo)
python
# ❌ VULNERABLE: concatenación directa en un buscador
servicio_nombre = request.args.get("nombre")  # "limpieza' OR '1'='1"
query = f"SELECT * FROM servicio WHERE nombre = '{servicio_nombre}'"
# → SELECT * FROM servicio WHERE nombre = 'limpieza' OR '1'='1'
# Retorna TODOS los servicios, incluso los no visibles para el usuario
Cómo lo mitiga Neodomus
1. SQLAlchemy ORM con queries parametrizadas:

python
# ✅ SEGURO: SQLAlchemy escapa automáticamente
servicios = db.query(Servicio).filter(Servicio.nombre == nombre_busqueda).all()
# SQL generado: SELECT * FROM servicio WHERE nombre = $1
# El parámetro $1 se sanitiza; inyección imposible
2. Validación de entradas con Pydantic:

python
class ServicioCreate(BaseModel):
    nombre: str = Field(..., min_length=3, max_length=100)
    descripcion: str = Field(..., max_length=500)
    precio: float = Field(..., gt=0)
3. Prevención de XSS en el frontend:

React escapa automáticamente el contenido en JSX. Para contenido HTML (ej. comentarios de usuarios), se debe usar dangerouslySetInnerHTML nunca sin sanitización previa.

tsx
// ❌ PELIGROSO: permite XSS si el comentario contiene <script>
<div dangerouslySetInnerHTML={{ __html: comentario }} />

// ✅ SEGURO: sanitizar con DOMPurify o similar
import DOMPurify from 'dompurify';
<div dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(comentario) }} />
A04 — Insecure Design (Diseño Inseguro)
¿Qué es?
La arquitectura carece de controles fundamentales: falta de rate limiting, ausencia de límites de reintentos, flujos sin validaciones.

Ataque típico: fuerza bruta en login
Un atacante puede probar miles de contraseñas contra una cuenta conocida (ej. admin@neodomus.com) si no hay límites.

Cómo lo mitiga Neodomus
Rate limiting con slowapi (backend app/utils/limiter.py):

python
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address

limiter = Limiter(key_func=get_remote_address)

# En routers:
@router.post("/auth/login")
@limiter.limit("10/minute")
async def login(request: Request, ...):
    ...

@router.post("/auth/register")
@limiter.limit("5/minute")

@router.post("/auth/recuperar")
@limiter.limit("5/minute")
Límites por IP:

Endpoint	Límite	Justificación
/auth/login	10 intentos/min	Un humano escribe mal la contraseña 2-3 veces
/auth/register	5 registros/min	Prevención de bots creando cuentas masivas
/auth/recuperar	5 solicitudes/h	Evita spam de correos de recuperación
/api/services/buscar	30 requests/min	Búsquedas normales, pero no scraping intensivo
Respuesta al exceder el límite:

json
HTTP 429 Too Many Requests
{
  "error": "Demasiadas solicitudes. Espera 1 minuto antes de reintentar."
}
A05 — Security Misconfiguration (Configuración Incorrecta)
¿Qué es?
El sistema funciona pero está mal configurado: CORS excesivo, cabeceras de seguridad ausentes, documentación expuesta en producción.

Configuraciones inseguras comunes en Neodomus
python
# ❌ CORS demasiado abierto (cualquier origen puede llamar a la API)
app.add_middleware(CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"]
)

# ❌ Documentación Swagger expuesta en producción
# https://api.neodomus.com/docs → cualquiera puede ver todos los endpoints
Cómo lo mitiga Neodomus
1. CORS restringido:

python
# ✅ Solo el dominio del frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[settings.FRONTEND_URL],  # https://app.neodomus.com
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE"],
    allow_headers=["Content-Type", "Authorization"]
)
2. Cabeceras de seguridad (middleware en app/main.py):

python
@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["Permissions-Policy"] = "geolocation=(self), camera=()"
    # No exponer el servidor
    response.headers["Server"] = ""
    return response
3. Ocultar documentación en producción:

python
# app/main.py
is_prod = settings.ENVIRONMENT == "production"

app = FastAPI(
    docs_url=None if is_prod else "/docs",
    redoc_url=None if is_prod else "/redoc",
)
4. Variables de entorno para todo secreto:

text
# .env.production (no versionado)
DATABASE_URL=mysql://user:pass@host:3306/neodomus
SECRET_KEY=9a3f2c8e1b7d4a6f8c0e2a4b6d8f1a3c5e7g9i1k3m5o7q9s1u3w5y7
SMTP_PASSWORD=xxxx
PAYMENT_SECRET=sk_test_xxxx
MAPBOX_TOKEN=pk.xxxx
A06 — Vulnerable and Outdated Components (Componentes Vulnerables)
¿Qué es?
Usar librerías con CVEs conocidos (vulnerabilidades públicas). Una dependencia vulnerable puede comprometer toda la aplicación.

Ejemplo real (Log4Shell en 2021)
Una vulnerabilidad en la librería Log4j (Java) permitía ejecución remota de código. Afectó a miles de aplicaciones que no actualizaron a tiempo.

Cómo lo mitiga Neodomus
1. Versionado exacto en frontend (pnpm, sin ^ ni ~):

json
// package.json
{
  "dependencies": {
    "react": "18.2.0",        // ✅ exacta
    "axios": "1.6.2",         // ✅ exacta
    "leaflet": "1.9.4"        // ✅ exacta
  }
}
2. En backend, poetry con lockfile (pyproject.toml + poetry.lock):

toml
[tool.poetry.dependencies]
python = "3.10"
fastapi = "0.115.0"
sqlalchemy = "2.0.25"
3. Auditorías automáticas en CI:

yaml
# .github/workflows/audit.yml
name: Security Audit
on: [push]
jobs:
  audit-frontend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pnpm audit --audit-level moderate
  audit-backend:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: pip install safety && safety check
4. Dependencias conocidas y controladas:

Frontend: React, Leaflet, Axios, React Hook Form, Zod.

Backend: FastAPI, SQLAlchemy, PyJWT, bcrypt, slowapi.

Se evitan librerías con poco mantenimiento o historial de vulnerabilidades.

A07 — Authentication and Session Failures (Fallas de Autenticación)
¿Qué es?
Debilidades en cómo se identifican los usuarios: contraseñas débiles permitidas, tokens sin expiración, recuperación insegura, falta de bloqueo por intentos.

Ejemplos en Neodomus
Un técnico usa la contraseña "123456" porque el sistema lo permite.

El token JWT no expira nunca → si se filtra, el atacante tiene acceso indefinido.

El flujo de "olvidé mi contraseña" permite enumerar emails (mensajes de error diferentes).

Cómo lo mitiga Neodomus
1. Validación de fortaleza de contraseña (Pydantic schema):

python
class UserRegister(BaseModel):
    password: str

    @validator("password")
    def strong_password(cls, v):
        if len(v) < 8:
            raise ValueError("Mínimo 8 caracteres")
        if not re.search(r"[A-Z]", v):
            raise ValueError("Al menos una mayúscula")
        if not re.search(r"[a-z]", v):
            raise ValueError("Al menos una minúscula")
        if not re.search(r"\d", v):
            raise ValueError("Al menos un número")
        if not re.search(r"[!@#$%^&*(),.?\":{}|<>]", v):
            raise ValueError("Al menos un carácter especial")
        return v
2. Tokens de corta duración:

python
ACCESS_TOKEN_EXPIRE_MINUTES = 15   # 15 minutos
REFRESH_TOKEN_EXPIRE_DAYS = 7      # 7 días
3. Bloqueo temporal por intentos fallidos (en auth_service.py):

python
max_attempts = 5
window_minutes = 15

# Contar intentos fallidos recientes desde la misma IP
attempts = db.query(LoginAttempt).filter(
    LoginAttempt.ip == ip,
    LoginAttempt.success == False,
    LoginAttempt.created_at > datetime.utcnow() - timedelta(minutes=window_minutes)
).count()

if attempts >= max_attempts:
    raise HTTPException(429, "Demasiados intentos. Espera 15 minutos.")
4. Mensajes de error genéricos:

python
# ❌ Inseguro: revela si el email existe
# "El email no está registrado" vs "Contraseña incorrecta"

# ✅ Seguro: mismo mensaje siempre
raise HTTPException(401, "Credenciales incorrectas")
5. Verificación de email obligatoria (previene uso de emails ajenos):

El usuario no puede iniciar sesión hasta hacer clic en el enlace de verificación enviado al correo.

A08 — Software and Data Integrity Failures
¿Qué es?
El código o los datos pueden ser modificados sin detección: actualizaciones sin firma, deserialización insegura, pipelines CI/CD sin protección.

Estado en Neodomus
Parcialmente mitigado:

✅ JWT firmados: cualquier modificación del payload invalida la firma.

python
# El token se firma al crear
access_token = jwt.encode(payload, SECRET_KEY, algorithm="HS256")

# Al recibirlo, se verifica la firma
try:
    payload = jwt.decode(token, SECRET_KEY, algorithms=["HS256"])
except jwt.InvalidSignatureError:
    raise HTTPException(401, "Token manipulado")
✅ Integridad de datos: Las tablas tienen restricciones de integridad referencial (claves foráneas) y triggers (ej. cancelación con 48h de anticipación).

⚠️ Sin firma de artefactos: En un entorno productivo real, se firmarían las imágenes Docker o se usarían checksums. Por alcance académico, se asume que el despliegue se hace sobre repositorios controlados y pipelines seguros.

A09 — Security Logging and Monitoring Failures
¿Qué es?
La aplicación no registra eventos críticos (intentos de login fallidos, cambios de rol, pagos anómalos) ni genera alertas. Sin logs, un ataque puede pasar desapercibido durante meses.

Cómo lo mitiga Neodomus
Módulo de auditoría (app/utils/audit_log.py):

python
def log_event(
    user_id: int | None,
    action: str,
    target_type: str,
    target_id: int | None,
    ip: str,
    details: dict = None
):
    entry = AuditLog(
        user_id=user_id,
        action=action,          # "login_failed", "asignar_tecnico", "cambiar_estado"
        target_type=target_type, # "usuario", "servicio", "pago"
        target_id=target_id,
        ip_address=ip,
        details=json.dumps(details),
        created_at=datetime.utcnow()
    )
    db.add(entry)
    db.commit()
Eventos registrados:

Acción	¿Quién?	¿Por qué?
login_failed	cualquiera	Detectar ataques de fuerza bruta
login_success	cualquiera	Trazabilidad de accesos
cambio_estado_servicio	técnico/admin	Seguimiento del flujo de trabajo
asignar_tecnico	admin	Auditoría de asignaciones
pago_realizado	usuario	Registrar transacciones para reclamaciones
cambio_rol	admin	Control de cambios de privilegios
eliminar_cuenta	usuario/admin	Cumplimiento de RGPD
Formato de logs (JSON estructurado):

json
{
  "timestamp": "2026-05-27T10:23:45.123Z",
  "user_id": 42,
  "action": "asignar_tecnico",
  "target_type": "servicio",
  "target_id": 101,
  "ip": "203.0.113.45",
  "details": {
    "tecnico_anterior": null,
    "tecnico_nuevo": 7,
    "admin_id": 1
  }
}
Monitoreo básico (puede extenderse con herramientas como Sentry, DataDog):

Alertar si > 50 login_failed desde misma IP en 5 minutos.

Alertar si hay cambio_rol no esperado.

Alertar si un técnico cambia estado de "completado" a "pendiente".

A10 — Server-Side Request Forgery (SSRF)
¿Qué es?
El servidor hace peticiones HTTP a URLs controladas por el atacante, lo que puede exponer servicios internos o metadatos de la nube.

Ejemplo en Neodomus (hipotético)
Si hubiera un endpoint para validar imágenes de perfil desde una URL externa:

text
POST /api/usuario/avatar
{"url": "http://169.254.169.254/latest/meta-data/iam/security-credentials/"}
El servidor haría una petición a la IP de metadatos de AWS y devolvería credenciales.

Estado en Neodomus
No aplica (N/A): La API de Neodomus no realiza peticiones HTTP a URLs proporcionadas por el usuario. Los únicos clientes HTTP externos son:

Envío de correos (SMTP fijo)

Integración con pasarela de pagos (webhooks salientes pero no basados en URL del usuario)

Mapas (Leaflet usa tiles de OpenStreetMap, pero la URL es fija)

Si en el futuro se agregaran integraciones con webhooks externos configurables por el administrador, se debe:

Validar la URL contra una lista blanca de dominios permitidos.

Bloquear rangos de IP privados (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, 169.254.0.0/16).

Usar un tiempo de espera (timeout) bajo para evitar ataques de denegación de servicio.

Resumen Visual de Seguridad en Neodomus
text
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Neodomus Security                                 │
│                                                                             │
│  Cliente (React)                Backend (FastAPI)            MySQL          │
│  ────────────────                ─────────────────           ─────          │
│                                                                             │
│  POST /login ─────────────────► Rate Limiting (A04)                        │
│                                  slowapi: 10/min                           │
│                                       │                                     │
│                              Pydantic Validation (A03)                      │
│                              email, contraseña fuerte                       │
│                                       │                                     │
│                              Auth Service (A07)                            │
│                              bcrypt.verify() (A02)                         │
│                                       │                                     │
│                              Audit Log (A09) ──────────────► audit_log     │
│                              "login_success/failed"          (JSON)        │
│                                       │                                     │
│  JWT Token ◄───────────────── JWT signed HS256 (A02)                       │
│                              ACCESS: 15min, REFRESH: 7d                    │
│                                                                             │
│  GET /mis-servicios ────────► get_current_user (A01)                       │
│                              JWT verification + rol                         │
│                              Filtro por técnico_id                          │
│                                                                             │
│  GET /admin/usuarios ───────► get_current_user + rol admin (A01)          │
│                              Si no es admin → 403                           │
│                                                                             │
│  All requests ──────────────► Security Headers (A05)                       │
│                           ◄──  X-Frame-Options: DENY                       │
│                                X-Content-Type-Options                       │
│                                Permissions-Policy                           │
│                                                                             │
│  Documentación ─────────────► /docs solo si development (A05)             │
│                              En producción → 404                            │
└─────────────────────────────────────────────────────────────────────────────┘
Checklist de Seguridad para el Equipo de Neodomus
Antes de desplegar cualquier cambio a producción:

¿Los endpoints sensibles tienen rate limiting?

¿Se usa Depends(get_current_user) en todas las rutas protegidas?

¿Se verifica el rol del usuario antes de permitir acciones administrativas?

¿Las contraseñas se almacenan con bcrypt (no texto plano ni MD5)?

¿La SECRET_KEY tiene al menos 32 caracteres y está en .env?

¿Las consultas a la BD usan SQLAlchemy (no SQL crudo concatenado)?

¿Los mensajes de error de login son genéricos (no enumeran emails)?

¿Se registran en audit log las acciones críticas?

¿El CORS está limitado al dominio del frontend?

¿La documentación Swagger está deshabilitada en producción?

¿Se han auditado las dependencias (pnpm audit, safety check)?

¿El frontend escapa contenido de usuarios (o sanitiza con DOMPurify)?

¿Las notificaciones por correo no exponen información sensible en los enlaces?

Recursos de Aprendizaje
Recurso	URL	Para qué
OWASP Top 10 oficial	https://owasp.org/Top10/	Referencia completa actualizada
OWASP Cheat Sheets (FastAPI)	https://cheatsheetseries.owasp.org/	Guías específicas por tecnología
JWT.io	https://jwt.io/	Decodificar y entender tokens JWT
Security Headers	https://securityheaders.com/	Verificar cabeceras de seguridad de un sitio
Have I Been Pwned	https://haveibeenpwned.com/	Verificar si un email fue comprometido
bcrypt calculator	https://bcrypt-generator.com/	Entender la salida de bcrypt
Conclusión pedagógica para Neodomus: La seguridad no es un añadido final. Integrar
controles de acceso, cifrado, validación de entrada, rate limiting y auditoría desde
el principio protege a los clientes, a los técnicos y a la empresa. Una vulnerabilidad
en el sistema de citas podría permitir a un atacante cancelar servicios ajenos;
una falla en pagos podría exponer datos de tarjetas. Conocer el OWASP Top 10 y aplicarlo
en cada endpoint y cada componente es responsabilidad de todo el equipo de desarrollo.