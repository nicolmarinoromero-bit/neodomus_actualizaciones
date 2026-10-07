# Hallazgos: users / clientes / seguridad

Tests que documentan el **comportamiento actual** del código (no se modificó
nada de producción). Archivos: `test_users.py`, `test_clientes.py`,
`test_seguridad.py`.

## 1. Un *refresh token* funciona como *access token* (seguridad) — ✅ CORREGIDO

**Dónde:** `app/utils/security.py` → `get_current_user()` llamaba a
`decode_token()`, que **no valida el claim `type`**. La función
`verify_token(token, token_type)` que sí lo valida no se usaba en ese flujo.

**Efecto (antes del fix):** un refresh token (vida de 30 días) servía como
Bearer para cualquier endpoint protegido (`/users/me`, `/clients`,
`/auth/session`, …). El endpoint `POST /auth/refresh` sí exige
`type == "refresh"` (así que la dirección inversa sí se rechazaba).

**Corrección aplicada:** se valida `payload.get("type") == "access"` en
tres puntos:
- `app/utils/security.py` → `get_current_user()` (todos los endpoints
  protegidos por Depends).
- `app/routers/auth.py` → `session_actual()` (`GET /auth/session`).
- `app/routers/citas.py` → identificación opcional de cliente para la
  exención 3h por oferta (ruta blanda sin autenticación obligatoria).

**Test:** `test_seguridad.py::test_refresh_token_usado_como_access_es_rechazado`
(401) + `test_refresh_token_no_sirve_para_session` (401).

## 2. La rama "habilitar" de `POST /clients/me/cuenta-solicitud` es inalcanzable

**Dónde:** `app/routers/clientes.py` → `crear_solicitud()`.

* Cliente **activo** + `tipo="habilitar"` → 400 «Tu cuenta ya está activa».
* Cliente **inactivo** → no puede autenticarse: `get_current_client()` →
  `get_current_user()` devuelve 401 si `is_active` es False.

**Efecto:** ninguna petición puede llegar al bloque
`if data.tipo == "habilitar" and current_client.is_active` con una cuenta
inactiva; la solicitud de habilitación desde este endpoint es código
inalcanzable (el flujo real de habilitación pasa por
`POST /auth/solicitar-habilitacion` y por el panel de administración).

**Tests:** `test_clientes.py::test_cuenta_solicitud_habilitar_con_cuenta_activa_devuelve_400`
y `test_clientes.py::test_cuenta_solicitud_habilitar_con_cuenta_inactiva_devuelve_401`.

## 3. La foto de perfil valida el `Content-Type`, no la extensión

**Dónde:** `app/routers/users.py` y `app/routers/clientes.py` →
`subir_foto_perfil()`.

**Efecto:** un archivo `payload.exe` enviado con cabecera
`Content-Type: image/png` pasa la validación y se persiste en MinIO con
nombre `perfil_usuario_{id}.exe` / `perfil_cliente_{id}.exe`.

**Test:** `test_users.py::test_foto_perfil_extension_no_validada_solo_content_type`
(comportamiento ACTUAL: 200). Los archivos sin `image/*` o de más de 5 MB
sí se rechazan con 400.

## 4. Contraseña débil en `POST /users` → 400 (no 422)

**Dónde:** `app/routers/users.py` → `crear_empleado()` comprueba
`len(data.password) < 6` a mano y devuelve **400**.

**Efecto:** inconsistencia con el resto de validaciones de entrada (que
responden 422) y con el registro de clientes, que exige 8+ caracteres con
mayúscula, minúscula y dígito. Un empleado puede recibir una contraseña
muy débil (`abc12`).

**Test:** `test_users.py::test_crear_empleado_password_corta_devuelve_400`.

## 5. `GET /api/v1/users` sin la barra final responde 405

**Dónde:** `app/routers/users.py` → el listado está registrado como
`@router.get("/")` (ruta efectiva `/users/`) y `/users` sólo existe para
POST.

**Efecto:** un cliente que pida `GET /api/v1/users` recibe
**405 Method Not Allowed** (Starlette no redirige porque sí hay una ruta
con ese path para otro método).

**Test:** `test_users.py::test_listar_usuarios_sin_barra_final_devuelve_405`.

## 6. Prefijo real del router de clientes: `/clients`

El archivo `app/routers/clientes.py` declara
`APIRouter(prefix="/clients")`, así que las rutas son
`/api/v1/clients/...` (no `/api/v1/clientes/...`). Todos los tests usan el
prefijo real.

## 7. Comportamientos correctos que se dejan documentados

* `DELETE /users/{id}` **no borra** la fila: desactiva (`is_active=False`)
  y prohíbe la autodesactivación con **400** (no 403).
* `get_current_employee()` responde **401** (no 403) cuando quien llama es
  un cliente; `_admin()` responde **403** cuando es un empleado sin rol
  administrador.
* `GET /pedidos/{id}` filtra por `id_cliente`: el cliente A obtiene **404**
  al pedir el pedido del cliente B (sin filtrar datos).
* Los endpoints `/clients/me*` no aceptan id en la URL: siempre operan
  sobre la cuenta autenticada.
* Ninguna respuesta de `/users`, `/users/me`, `/clients`, `/clients/me` ni
  `/auth/session` expone `password_hash`, `password`, `secret` ni tokens.

## 8. `GET /auth/session` ignoraba el header Authorization — ✅ CORREGIDO

**Dónde:** `app/routers/auth.py` → `session_actual()` llamaba a
`_token_desde_request(request, None)`, pasando `token=None`. Ese helper sólo
recibe el header cuando se le pasa el token de `Depends(oauth2_scheme)`; con
`None` **sólo leía la cookie** `access_token`, ignorando por completo el
header `Authorization` — al contrario de lo que decía su propia docstring
(«Prioriza el header Authorization (cada pestaña envía su propio token
desde localStorage)»).

**Efecto (antes del fix):** un token Bearer inválido o de refresh en el
header era ignorado y la petición se autenticaba con la cookie; la
multi-pestaña que envía tokens distintos por header no funcionaba.

**Corrección aplicada:** `session_actual()` ahora recibe
`token: str = Depends(oauth2_scheme)` y se lo pasa a
`_token_desde_request(request, token)` (header primero, cookie como
respaldo). Combinado con la validación `type == "access"` (hallazgo 1).

**Test:** `test_seguridad.py::test_refresh_token_no_sirve_para_session` (401)
y los tests de `/auth/session` de `test_auth.py` (62 en verde).
