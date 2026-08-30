# RNF-001 — Seguridad

<!--
  ¿Qué? Requisito no funcional que define los estándares de seguridad del sistema.
  ¿Para qué? Garantizar que los datos sensibles estén protegidos contra ataques comunes.
  ¿Impacto? Un fallo de seguridad podría exponer contraseñas, tokens y datos personales.
-->

---

## Identificación

| Campo             | Valor                                                  |
| ----------------- | ------------------------------------------------------ |
| **ID**            | RNF-001                                                |
| **Nombre**        | Seguridad                                              |
| **Categoría**     | Seguridad de la información                            |
| **Prioridad**     | Crítica                                                |
| **Estado**        | Implementado                                           |

---

## Requisitos

### RNF-001.1 — Hashing de contraseñas
Las contraseñas de los usuarios deben almacenarse mediante hashing con el algoritmo **bcrypt**. Nunca se almacenan en texto plano ni se incluyen en respuestas de la API.

### RNF-001.2 — Tokens JWT
La autenticación debe basarse en tokens JWT (JSON Web Tokens) firmados con algoritmo **HS256**:
- **Access token**: duración de 60 minutos (`be/app/config.py:19` `ACCESS_TOKEN_EXPIRE_MINUTES=60`; históricamente 15 min).
- **Refresh token**: duración de 30 días (`be/app/config.py:20` `REFRESH_TOKEN_EXPIRE_DAYS=30`; históricamente 7 días).
- La clave secreta debe tener mínimo 32 caracteres y almacenarse en variable de entorno (`SECRET_KEY` en `.env`, ver `RNF-001.7`).

### RNF-001.3 — Prevención de enumeración de usuarios
Los mensajes de error en endpoints de autenticación deben ser genéricos:
- En login: "Incorrect email or password" (sin distinguir si el email existe).
- En forgot-password: siempre retornar el mismo mensaje, sin revelar si el email está registrado.

### RNF-001.4 — Validación de entradas
Todas las entradas del usuario deben validarse tanto en el frontend como en el backend:
- Frontend: validación con lógica React antes de enviar.
- Backend: validación con Pydantic (schemas tipados y restrictivos).

### RNF-001.5 — Protección contra inyección SQL
El sistema debe usar SQLAlchemy ORM para todas las consultas a la base de datos. No se permite SQL crudo sin parametrizar.

### RNF-001.6 — CORS (Cross-Origin Resource Sharing)
- En desarrollo: permitir `http://localhost:5173` y `http://localhost:8000` y, para Expo Go LAN, orígenes dinámicos controlados por `CORS_ORIGINS` / `ENVIRONMENT`. **Nunca** `allow_origins=["*"]` en producción (`be/app/middleware/cors.py:7-17` usa `*` solo si `ENVIRONMENT=development`; en producción usa `CORS_ORIGINS`).
- En producción: configurar orígenes específicos vía `CORS_ORIGINS` (`docker-compose.yml` / `.env`).

### RNF-001.7 — Variables de entorno
Toda información sensible (claves secretas, credenciales de BD, configuraciones SMTP) debe almacenarse en archivos `.env` no versionados. Se debe proveer un `.env.example` como plantilla.

### RNF-001.8 — Fortaleza de contraseñas
Las contraseñas deben cumplir requisitos mínimos (`be/app/schemas/auth.py:5-14` `_validate_password_strength`, `fe/src/pages/auth/Register.tsx:111`):
- Mínimo 8 caracteres.
- Al menos 1 letra mayúscula.
- Al menos 1 letra minúscula.
- Al menos 1 número.
- Carácter especial recomendado (validado en frontend `fe/src/pages/auth/CambioPasswordObligatorio.tsx:40` `!@#$%^&*`, pero no exigido en backend para clientes; discrepancia documentada).

### RNF-001.9 — Rate limiting (implementado)
Endpoints sensibles con `slowapi` (`be/app/middleware/rate_limit.py:5`, `be/app/routers/auth.py:65,82`): `POST /auth/register/client` 3/min, `POST /auth/login` 5/min, `POST /auth/forgot-password` 3/min. Ver `docs/referencia-tecnica/api-endpoints.md` para tabla completa.
