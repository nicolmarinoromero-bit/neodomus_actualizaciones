API Endpoints — Neodomus
<!-- ¿Qué? Documentación de referencia de todos los endpoints de la API REST del backend de Neodomus. ¿Para qué? Que cualquier desarrollador (frontend, móvil, QA) pueda integrar o probar la API sin necesidad de leer el código fuente ni acceder a Swagger UI. ¿Impacto? En producción, Swagger UI (/docs) está deshabilitado por seguridad (OWASP A05 — Security Misconfiguration). Este documento es la única referencia pública de la API para entornos de producción. -->
Base URL: https://api.neodomus.com (producción) / http://localhost:8000 (desarrollo)
Versionamiento: Todos los endpoints usan el prefijo /api/v1/
Formato: JSON en request y response (Content-Type: application/json)
Autenticación: JWT Bearer Token — Authorization: Bearer <access_token>
Roles: usuario, tecnico, admin (embebidos en el token JWT)

Resumen de Endpoints por Módulo
Módulo	Método	Ruta	Descripción	Auth	Roles permitidos
Auth	POST	/api/v1/auth/register	Registrar nuevo usuario	No	—
POST	/api/v1/auth/login	Iniciar sesión	No	—
POST	/api/v1/auth/refresh	Renovar access token	No †	—
POST	/api/v1/auth/logout	Cerrar sesión (invalidar refresh)	Sí	usuario,tecnico,admin
POST	/api/v1/auth/change-password	Cambiar contraseña (autenticado)	Sí	usuario,tecnico,admin
POST	/api/v1/auth/forgot-password	Solicitar recuperación por email	No	—
POST	/api/v1/auth/reset-password	Restablecer contraseña con token	No †	—
POST	/api/v1/auth/verify-email	Verificar email con token	No †	—
Usuarios	GET	/api/v1/users/me	Obtener perfil propio	Sí	usuario,tecnico,admin
PUT	/api/v1/users/me	Actualizar perfil propio	Sí	usuario,tecnico,admin
DELETE	/api/v1/users/me	Eliminar cuenta propia (baja blanda)	Sí	usuario,tecnico,admin
Servicios	GET	/api/v1/servicios	Listar catálogo de servicios	Opcional	cualquier
GET	/api/v1/servicios/{id}	Obtener detalle de servicio	Opcional	cualquier
GET	/api/v1/servicios/categorias	Listar categorías disponibles	No	—
Citas	POST	/api/v1/citas	Solicitar nuevo servicio (cita)	Sí	usuario
GET	/api/v1/citas/mis-citas	Listar citas del usuario autenticado	Sí	usuario
GET	/api/v1/citas/{id}	Obtener detalle de una cita	Sí	usuario o técnico asignado
PUT	/api/v1/citas/{id}	Modificar cita (antes de confirmación)	Sí	usuario
DELETE	/api/v1/citas/{id}	Cancelar cita (validar 48h)	Sí	usuario
GET	/api/v1/citas/horarios-disponibles	Consultar horarios disponibles	Sí	usuario
Pagos	POST	/api/v1/pagos/iniciar	Iniciar intención de pago	Sí	usuario
POST	/api/v1/pagos/webhook	Webhook de pasarela (MercadoPago/Stripe)	No	— (firma)
GET	/api/v1/pagos/mis-pagos	Listar pagos del usuario	Sí	usuario
GET	/api/v1/pagos/{id}/comprobante	Descargar comprobante PDF	Sí	usuario o admin
POST	/api/v1/pagos/abono	Realizar pago parcial (abono)	Sí	usuario
Técnico	GET	/api/v1/tech/mis-tareas	Listar tareas asignadas	Sí	tecnico, admin
GET	/api/v1/tech/tarea/{id}	Detalle de tarea	Sí	tecnico (solo sus tareas)
PUT	/api/v1/tech/tarea/{id}/estado	Actualizar estado (pendiente→en_progreso→completado)	Sí	tecnico
POST	/api/v1/tech/tarea/{id}/evidencias	Subir fotos y observaciones	Sí	tecnico
GET	/api/v1/tech/mis-calificaciones	Ver calificaciones recibidas	Sí	tecnico
GET	/api/v1/tech/reportes	Descargar reporte de servicios (PDF/Excel)	Sí	tecnico
PUT	/api/v1/tech/disponibilidad	Configurar disponibilidad laboral	Sí	tecnico
GET	/api/v1/tech/mis-tareas-mapa	Obtener tareas con coordenadas para mapa	Sí	tecnico
Admin	GET	/api/v1/admin/stats/dashboard	Métricas del dashboard	Sí	admin
CRUD	/api/v1/admin/tecnicos	Gestionar técnicos	Sí	admin
PUT	/api/v1/admin/tecnicos/{id}/reactivar	Reactivar técnico suspendido	Sí	admin
GET	/api/v1/admin/solicitudes	Listar todas las solicitudes	Sí	admin
PUT	/api/v1/admin/solicitudes/{id}/aprobar	Aprobar solicitud	Sí	admin
PUT	/api/v1/admin/solicitudes/{id}/rechazar	Rechazar solicitud	Sí	admin
POST	/api/v1/admin/solicitudes/{id}/asignar-tecnico	Asignar técnico a servicio	Sí	admin
CRUD	/api/v1/admin/servicios	Gestionar catálogo de servicios	Sí	admin
CRUD	/api/v1/admin/promociones	Gestionar promociones/descuentos	Sí	admin
GET	/api/v1/admin/pagos	Monitorear todas las transacciones	Sí	admin
GET	/api/v1/admin/reportes/exportar	Exportar reportes (PDF/Excel)	Sí	admin
GET/PUT	/api/v1/admin/config/horarios	Configurar horarios generales	Sí	admin
GET/PUT	/api/v1/admin/config/roles	Gestionar roles y permisos	Sí	admin
POST	/api/v1/admin/backup	Solicitar copia de seguridad manual	Sí	admin
POST	/api/v1/admin/comunicados	Enviar comunicado masivo	Sí	admin
Chat	POST	/api/v1/chat/enviar	Enviar mensaje	Sí	usuario o técnico
GET	/api/v1/chat/conversacion/{servicio_id}	Obtener conversación de un servicio	Sí	usuario o técnico
PUT	/api/v1/chat/marcar-leido/{mensaje_id}	Marcar mensaje como leído	Sí	usuario o técnico
Notificaciones	GET	/api/v1/notifications/mis-notificaciones	Listar notificaciones del usuario	Sí	usuario,tecnico,admin
PUT	/api/v1/notifications/{id}/leida	Marcar notificación como leída	Sí	usuario,tecnico,admin
Calificaciones	POST	/api/v1/calificaciones	Calificar un servicio completado	Sí	usuario
GET	/api/v1/tecnicos/{id}/calificaciones	Ver calificaciones de un técnico	Sí	cualquier autenticado
† No requiere Authorization header, pero sí un token específico en el body (refresh token, reset token, verification token).

Códigos de Estado HTTP Comunes
Código	Significado
200	OK — Operación exitosa
201	Created — Recurso creado exitosamente
204	No Content — Eliminación exitosa (sin cuerpo)
400	Bad Request — Datos inválidos (email duplicado, lógica de negocio)
401	Unauthorized — Token inválido, expirado o ausente
403	Forbidden — Autenticado pero sin permiso (rol incorrecto o email no verificado)
404	Not Found — Recurso no encontrado
422	Unprocessable Entity — Validación Pydantic fallida (tipos, formato)
429	Too Many Requests — Rate limit superado
500	Internal Server Error — Error no controlado del servidor
Autenticación — Endpoints Auth
POST /api/v1/auth/register
Registra un nuevo usuario en el sistema. Por defecto se asigna rol usuario (los técnicos y admins solo pueden ser creados por otro admin). Envía email de verificación.

Rate limit: 5 peticiones/minuto por IP

Request body:

json
{
  "email": "cliente@example.com",
  "password": "MiCasaSegura2025!",
  "nombre": "Carlos",
  "apellido": "Gómez",
  "tipo_documento": "DNI",
  "numero_documento": "12345678",
  "telefono": "+5491122334455",
  "direccion": "Av. Siempreviva 742"
}
Campo	Tipo	Requerido	Validación
email	string	Sí	Formato email válido, único
password	string	Sí	≥8 chars, mayúscula, minúscula, número, especial
nombre	string	Sí	Mínimo 2 caracteres
apellido	string	Sí	Mínimo 2 caracteres
tipo_documento	string	Sí	Valores: DNI, NIE, PASAPORTE
numero_documento	string	Sí	Único, formato validado según tipo
telefono	string	Sí	Formato internacional (E.164)
direccion	string	Sí	Mínimo 5 caracteres
Respuesta exitosa (201 Created):

json
{
  "id": 42,
  "email": "cliente@example.com",
  "nombre": "Carlos",
  "apellido": "Gómez",
  "rol": "usuario",
  "is_active": true,
  "is_email_verified": false,
  "created_at": "2026-05-27T10:30:00Z"
}
Errores:

Código	Condición
400	Email o documento ya registrado
422	Validación fallida (password débil)
429	Rate limit superado (5/min)
POST /api/v1/auth/login
Autentica y retorna tokens JWT con el rol del usuario embebido.

Rate limit: 10 peticiones/minuto por IP

Request body:

json
{
  "email": "cliente@example.com",
  "password": "MiCasaSegura2025!"
}
Respuesta exitosa (200 OK):

json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer",
  "expires_in": 900,
  "rol": "usuario"
}
Campo	Tipo	Descripción
access_token	string	JWT de acceso (15 min)
refresh_token	string	JWT de renovación (7 días)
expires_in	int	Segundos hasta expiración del access_token
rol	string	usuario, tecnico o admin
Errores:

Código	Condición
401	Credenciales incorrectas (respuesta genérica)
403	Email no verificado
429	Rate limit superado (10/min)
Seguridad: La respuesta es idéntica tanto si el email no existe como si la contraseña es incorrecta. No se permite el login si el email no está verificado.

POST /api/v1/auth/refresh
Renueva el par de tokens usando refresh token válido (rotación de tokens). Invalida el refresh token anterior.

Request body:

json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
Respuesta exitosa (200 OK):

json
{
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "token_type": "bearer"
}
Errores:

Código	Condición
401	Refresh token inválido, expirado o ya usado
POST /api/v1/auth/logout
Cierra la sesión activa invalidando el refresh token (el access_token se deja expirar naturalmente).

Auth requerida: Authorization: Bearer <access_token>

Request body: (vacío)

Respuesta exitosa (200 OK):

json
{
  "message": "Sesión cerrada exitosamente"
}
Errores:

Código	Condición
401	Token ausente, inválido o expirado
POST /api/v1/auth/change-password
Cambia la contraseña del usuario autenticado.

Auth requerida: Authorization: Bearer <access_token>

Request body:

json
{
  "current_password": "MiCasaSegura2025!",
  "new_password": "MiNuevaCasa2026@"
}
Respuesta exitosa (200 OK):

json
{
  "message": "Contraseña actualizada exitosamente"
}
Errores:

Código	Condición
400	Contraseña actual incorrecta
401	Token inválido
422	Nueva contraseña no cumple requisitos
POST /api/v1/auth/forgot-password
Envía un email con enlace para restablecer contraseña.

Rate limit: 5 peticiones/minuto por IP

Request body:

json
{
  "email": "cliente@example.com"
}
Respuesta exitosa (200 OK) (siempre la misma):

json
{
  "message": "Si el email está registrado, recibirás un enlace de recuperación"
}
Errores:

Código	Condición
422	Email inválido
429	Rate limit superado (5/min)
POST /api/v1/auth/reset-password
Restablece la contraseña usando el token recibido por email.

Request body:

json
{
  "token": "550e8400-e29b-41d4-a716-446655440000",
  "new_password": "MiNuevaCasa2026@"
}
Respuesta exitosa (200 OK):

json
{
  "message": "Contraseña restablecida exitosamente. Ya puedes iniciar sesión."
}
Errores:

Código	Condición
400	Token inválido, expirado (1h) o ya usado
422	Nueva contraseña débil
POST /api/v1/auth/verify-email
Verifica la dirección de email usando el token enviado al registrarse.

Request body:

json
{
  "token": "550e8400-e29b-41d4-a716-446655440000"
}
Respuesta exitosa (200 OK):

json
{
  "message": "Email verificado exitosamente. Ya puedes iniciar sesión."
}
Errores:

Código	Condición
400	Token inválido, expirado (24h) o ya usado
Usuarios — Endpoints Users
GET /api/v1/users/me
Obtiene el perfil del usuario autenticado (sin exponer contraseña).

Auth requerida: Authorization: Bearer <access_token>

Respuesta exitosa (200 OK):

json
{
  "id": 42,
  "email": "cliente@example.com",
  "nombre": "Carlos",
  "apellido": "Gómez",
  "rol": "usuario",
  "direccion": "Av. Siempreviva 742",
  "telefono": "+5491122334455",
  "is_active": true,
  "is_email_verified": true,
  "created_at": "2026-05-27T10:30:00Z"
}
PUT /api/v1/users/me
Actualiza el perfil del usuario autenticado (campos permitidos: nombre, apellido, dirección, teléfono). El email no puede modificarse sin verificación adicional.

Auth requerida: Authorization: Bearer <access_token>

Request body (todos opcionales):

json
{
  "nombre": "Carlos Alberto",
  "apellido": "Gómez",
  "direccion": "Av. Siempreviva 999",
  "telefono": "+5491122339988"
}
Respuesta exitosa (200 OK):

json
{
  "message": "Perfil actualizado correctamente",
  "usuario": { ... }  // mismo objeto que GET /me
}
Errores:

Código	Condición
401	No autenticado
422	Validación de algún campo
DELETE /api/v1/users/me
Solicita la baja de la cuenta (eliminación blanda). La cuenta se marca como deleted_at. El usuario puede cancelar la solicitud dentro de 30 días contactando a soporte.

Auth requerida: Authorization: Bearer <access_token>

Request body:

json
{
  "confirmation": true,
  "password": "MiCasaSegura2025!"
}
Respuesta exitosa (200 OK):

json
{
  "message": "Tu cuenta ha sido marcada para eliminación. Tienes 30 días para cancelar."
}
Errores:

Código	Condición
400	Contraseña incorrecta
401	No autenticado
Servicios (Catálogo)
GET /api/v1/servicios
Lista los servicios disponibles en el catálogo. Soporta paginación y filtros.

Auth: No requerida (público) o cualquier rol autenticado.

Query parameters:

Parámetro	Tipo	Descripción	Ejemplo
categoria	string	Filtrar por categoría	instalacion
buscar	string	Búsqueda en nombre y descripción	domotica
page	int	Número de página (default 1)	2
per_page	int	Elementos por página (default 20, max 50)	10
Respuesta exitosa (200 OK):

json
{
  "data": [
    {
      "id": 1,
      "nombre": "Instalación de domótica básica",
      "descripcion": "Sensores, actuadores y control central",
      "precio": 25000.00,
      "duracion_estimada": 120,
      "categoria": "instalacion",
      "imagen_url": "https://cdn.neodomus.com/servicios/instalacion_basica.jpg",
      "promocion": null
    }
  ],
  "total": 15,
  "page": 1,
  "per_page": 20
}
GET /api/v1/servicios/{id}
Obtiene el detalle completo de un servicio específico.

Auth: No requerida (público) o cualquier rol.

Respuesta exitosa (200 OK):

json
{
  "id": 1,
  "nombre": "Instalación de domótica básica",
  "descripcion_larga": "Incluye sensores de puertas, termostato inteligente...",
  "precio": 25000.00,
  "duracion_estimada": 120,
  "categoria": "instalacion",
  "imagen_url": "...",
  "requisitos": "Conexión a internet estable",
  "promocion": {
    "tipo": "porcentaje",
    "valor": 15,
    "vigencia_hasta": "2026-12-31"
  }
}
Errores:

Código	Condición
404	Servicio no existe
GET /api/v1/servicios/categorias
Lista las categorías disponibles.

Respuesta exitosa (200 OK):

json
{
  "categorias": ["instalacion", "mantenimiento", "automatizacion", "asesoria"]
}
Citas (Solicitud de Servicios)
POST /api/v1/citas
Solicita un nuevo servicio (crea una cita en estado pendiente).

Auth requerida: Authorization: Bearer <access_token> (rol usuario)

Request body:

json
{
  "servicio_id": 1,
  "fecha": "2026-06-15",
  "hora": "10:00:00",
  "direccion": "Av. Siempreviva 742",
  "comentarios": "Timbre roto, tocar el timbre"
}
Validaciones:

La fecha debe ser al menos 24 horas posterior a la actual.

La hora debe estar dentro del horario de atención configurado por el admin.

El usuario no debe tener otra cita en el mismo horario.

Respuesta exitosa (201 Created):

json
{
  "id": 101,
  "servicio": { "id": 1, "nombre": "Instalación..." },
  "fecha": "2026-06-15",
  "hora": "10:00:00",
  "estado": "pendiente",
  "direccion": "Av. Siempreviva 742",
  "comentarios": "Timbre roto...",
  "created_at": "2026-05-27T12:00:00Z"
}
Errores:

Código	Condición
400	Fecha inválida (menos de 24h), conflicto horario
401	No autenticado
403	Rol no es usuario
404	Servicio no existe
GET /api/v1/citas/mis-citas
Lista las citas del usuario autenticado. Soporta filtros por estado.

Auth requerida: Authorization: Bearer <access_token> (rol usuario)

Query parameters:

Parámetro	Tipo	Descripción	Valores posibles
estado	string	Filtrar por estado	pendiente,confirmada,en_progreso,completada,cancelada
Respuesta exitosa (200 OK):

json
{
  "citas": [
    {
      "id": 101,
      "servicio_nombre": "Instalación...",
      "fecha": "2026-06-15",
      "hora": "10:00:00",
      "estado": "pendiente",
      "tecnico_asignado": null
    }
  ]
}
GET /api/v1/citas/{id}
Obtiene el detalle de una cita específica. Solo visible por el usuario propietario o el técnico asignado (o admin).

Auth requerida: Authorization: Bearer <access_token>

Respuesta exitosa (200 OK):

json
{
  "id": 101,
  "servicio": { ... },
  "usuario": { "id": 42, "nombre": "Carlos", ... },
  "tecnico": null,
  "fecha": "2026-06-15",
  "hora": "10:00:00",
  "estado": "pendiente",
  "direccion": "Av. Siempreviva 742",
  "comentarios": "...",
  "created_at": "..."
}
Errores:

Código	Condición
401	No autenticado
403	Usuario no es propietario ni técnico asignado
404	Cita no existe
PUT /api/v1/citas/{id}
Modifica una cita en estado pendiente (antes de confirmación por admin). Solo el usuario propietario.

Auth requerida: Authorization: Bearer <access_token> (rol usuario)

Request body (todos opcionales, pero al menos uno):

json
{
  "fecha": "2026-06-16",
  "hora": "11:00:00",
  "direccion": "Nueva dirección",
  "comentarios": "Actualización"
}
Respuesta exitosa (200 OK):

json
{
  "message": "Cita modificada exitosamente",
  "cita": { ... }
}
Errores:

Código	Condición
400	La cita ya fue confirmada o cancelada, o nueva fecha inválida
403	No es el propietario
404	Cita no existe
DELETE /api/v1/citas/{id}
Cancela una cita. Solo el propietario puede cancelar y solo si faltan más de 48 horas para la fecha/hora.

Auth requerida: Authorization: Bearer <access_token> (rol usuario)

Respuesta exitosa (200 OK):

json
{
  "message": "Cita cancelada exitosamente"
}
Errores:

Código	Condición
400	No se puede cancelar con menos de 48h de anticipación
403	No es el propietario
404	Cita no existe
GET /api/v1/citas/horarios-disponibles
Consulta los horarios disponibles para un servicio y fecha determinados.

Auth requerida: Authorization: Bearer <access_token> (rol usuario)

Query parameters:

Parámetro	Tipo	Requerido	Descripción
servicio_id	int	Sí	ID del servicio
fecha	string	Sí	Fecha en formato YYYY-MM-DD
Respuesta exitosa (200 OK):

json
{
  "horarios_disponibles": ["09:00", "10:00", "11:00", "14:00", "15:00"]
}
Pagos
POST /api/v1/pagos/iniciar
Inicia una intención de pago. Para pago completo del pedido o abono parcial.

Auth requerida: Authorization: Bearer <access_token> (rol usuario)

Request body:

json
{
  "cita_id": 101,
  "monto": 25000.00,
  "metodo_pago": "tarjeta",   // o "transferencia"
  "tipo": "completo"          // o "abono"
}
Respuesta exitosa (200 OK):

json
{
  "payment_intent_id": "pi_123456789",
  "client_secret": "pi_123456789_secret_abc",
  "amount": 25000.00,
  "currency": "ARS"
}
El frontend debe usar el client_secret para completar el pago con la pasarela (MercadoPago/Stripe).

POST /api/v1/pagos/webhook
Webhook llamado por la pasarela de pagos para notificar el resultado. No requiere autenticación, pero debe validar la firma del webhook.

Request body (según pasarela):

json
{
  "type": "payment_intent.succeeded",
  "data": { "object": { "id": "pi_123456789", ... } }
}
Respuesta exitosa (200 OK):

json
{
  "received": true
}
GET /api/v1/pagos/mis-pagos
Lista los pagos realizados por el usuario autenticado.

Auth requerida: Authorization: Bearer <access_token>

Respuesta exitosa (200 OK):

json
{
  "pagos": [
    {
      "id": 1001,
      "cita_id": 101,
      "monto": 25000.00,
      "estado": "aprobado",
      "fecha_pago": "2026-05-27T12:30:00Z",
      "comprobante_url": "/api/v1/pagos/1001/comprobante"
    }
  ]
}
GET /api/v1/pagos/{id}/comprobante
Descarga el comprobante de pago en formato PDF.

Auth requerida: Authorization: Bearer <access_token> (usuario dueño del pago o admin)

Respuesta: archivo PDF (Content-Type: application/pdf)

Errores:

Código	Condición
403	No autorizado
404	Pago no existe
POST /api/v1/pagos/abono
Registra un pago parcial (abono) sobre un pedido.

Auth requerida: Authorization: Bearer <access_token> (rol usuario)

Request body:

json
{
  "cita_id": 101,
  "monto_abonado": 10000.00,
  "metodo_pago": "tarjeta"
}
Respuesta exitosa (200 OK):

json
{
  "message": "Abono registrado. Monto total abonado: 10000.00. Restante: 15000.00",
  "pendiente": 15000.00
}
Técnico (Módulo Tech)
GET /api/v1/tech/mis-tareas
Lista las tareas (servicios) asignadas al técnico autenticado.

Auth requerida: Authorization: Bearer <access_token> (rol tecnico o admin)

Query parameters:

Parámetro	Tipo	Descripción	Valores posibles
estado	string	Filtrar por estado	pendiente,en_progreso,completado
Respuesta exitosa (200 OK):

json
{
  "tareas": [
    {
      "id": 101,
      "servicio_nombre": "Instalación...",
      "cliente": "Carlos Gómez",
      "direccion": "Av. Siempreviva 742",
      "fecha": "2026-06-15",
      "hora": "10:00:00",
      "estado": "pendiente",
      "latitud": -34.6037,
      "longitud": -58.3816
    }
  ]
}
GET /api/v1/tech/tarea/{id}
Detalle completo de una tarea asignada. Solo visible por el técnico asignado o admin.

Auth requerida: Authorization: Bearer <access_token> (rol tecnico o admin)

Respuesta exitosa (200 OK):

json
{
  "id": 101,
  "servicio": { ... },
  "cliente": { "nombre": "Carlos", "telefono": "+5491122334455" },
  "direccion": "Av. Siempreviva 742",
  "coordenadas": { "lat": -34.6037, "lng": -58.3816 },
  "fecha": "2026-06-15",
  "hora": "10:00:00",
  "estado": "pendiente",
  "comentarios_usuario": "...",
  "evidencias": []
}
PUT /api/v1/tech/tarea/{id}/estado
Actualiza el estado de una tarea.

Auth requerida: Authorization: Bearer <access_token> (rol tecnico o admin)

Request body:

json
{
  "estado": "en_progreso"   // o "completado"
}
Estados permitidos:

pendiente → en_progreso

en_progreso → completado

No se puede retroceder.

Respuesta exitosa (200 OK):

json
{
  "message": "Estado actualizado a 'en_progreso'",
  "estado": "en_progreso"
}
Errores:

Código	Condición
400	Transición de estado no permitida
403	No es el técnico asignado
404	Tarea no existe
POST /api/v1/tech/tarea/{id}/evidencias
Sube fotos y observaciones al finalizar un servicio.

Auth requerida: Authorization: Bearer <access_token> (rol tecnico)

Content-Type: multipart/form-data

Form data:

Campo	Tipo	Requerido	Descripción
fotos	archivo(s)	Sí	Hasta 5 fotos (jpg/png, max 5MB c/u)
observaciones	string	Opcional	Texto adicional
Respuesta exitosa (200 OK):

json
{
  "message": "Evidencias subidas correctamente",
  "urls": [
    "https://cdn.neodomus.com/evidencias/101/foto1.jpg",
    "https://cdn.neodomus.com/evidencias/101/foto2.jpg"
  ]
}
Errores:

Código	Condición
400	Archivo demasiado grande o formato inválido
403	No es el técnico asignado
404	Tarea no existe
GET /api/v1/tech/mis-calificaciones
Obtiene las calificaciones y comentarios que los usuarios han dejado para el técnico.

Auth requerida: Authorization: Bearer <access_token> (rol tecnico)

Respuesta exitosa (200 OK):

json
{
  "promedio": 4.8,
  "total": 12,
  "calificaciones": [
    {
      "puntuacion": 5,
      "comentario": "Excelente trabajo, muy profesional",
      "fecha": "2026-05-20",
      "servicio": "Instalación de domótica"
    }
  ]
}
GET /api/v1/tech/reportes
Genera y descarga un reporte de servicios realizados por el técnico en un rango de fechas.

Auth requerida: Authorization: Bearer <access_token> (rol tecnico)

Query parameters:

Parámetro	Tipo	Requerido	Descripción
desde	string	Sí	Fecha inicio (YYYY-MM-DD)
hasta	string	Sí	Fecha fin (YYYY-MM-DD)
formato	string	Opcional	pdf o excel (default pdf)
Respuesta: archivo PDF/Excel (Content-Type según formato).

PUT /api/v1/tech/disponibilidad
Configura la disponibilidad horaria del técnico.

Auth requerida: Authorization: Bearer <access_token> (rol tecnico)

Request body:

json
{
  "disponibilidad": {
    "lunes": { "activo": true, "desde": "09:00", "hasta": "18:00" },
    "martes": { "activo": true, "desde": "09:00", "hasta": "18:00" },
    "miercoles": { "activo": true, "desde": "09:00", "hasta": "18:00" },
    "jueves": { "activo": true, "desde": "09:00", "hasta": "18:00" },
    "viernes": { "activo": true, "desde": "09:00", "hasta": "18:00" },
    "sabado": { "activo": false },
    "domingo": { "activo": false }
  }
}
Respuesta exitosa (200 OK):

json
{
  "message": "Disponibilidad actualizada"
}
GET /api/v1/tech/mis-tareas-mapa
Obtiene las tareas del técnico con coordenadas geográficas para visualización en mapa (Leaflet).

Auth requerida: Authorization: Bearer <access_token> (rol tecnico)

Respuesta exitosa (200 OK):

json
{
  "tareas": [
    {
      "id": 101,
      "tipo": "cita",
      "lat": -34.6037,
      "lng": -58.3816,
      "direccion": "Av. Siempreviva 742",
      "cliente_nombre": "Carlos Gómez",
      "fecha": "2026-06-15",
      "hora": "10:00:00"
    },
    {
      "id": 102,
      "tipo": "entrega",
      "lat": -34.6042,
      "lng": -58.3820,
      ...
    }
  ]
}
Administrador (Panel Admin)
Los endpoints de administrador requieren rol admin. Todos los endpoints devuelven 403 Forbidden si el usuario no tiene permisos. A continuación se documentan solo los más representativos.

GET /api/v1/admin/stats/dashboard
Obtiene métricas resumidas para el dashboard.

Auth requerida: Authorization: Bearer <access_token> (rol admin)

Respuesta exitosa (200 OK):

json
{
  "total_servicios_mes": 124,
  "ingresos_mes": 1250000.00,
  "tecnicos_activos": 8,
  "satisfaccion_promedio": 4.7,
  "solicitudes_pendientes": 5
}
PUT /api/v1/admin/solicitudes/{id}/aprobar
Aprueba una solicitud de servicio (cambia estado a confirmada y asigna técnico automática o manualmente).

Auth requerida: Authorization: Bearer <access_token> (rol admin)

Request body (opcional si la asignación es manual):

json
{
  "tecnico_id": 7   // opcional, si no se envía se asigna automáticamente
}
Respuesta exitosa (200 OK):

json
{
  "message": "Solicitud aprobada",
  "cita_id": 101,
  "tecnico_asignado": { "id": 7, "nombre": "Juan Técnico" }
}
POST /api/v1/admin/comunicados
Envía un comunicado masivo a usuarios y/o técnicos.

Auth requerida: Authorization: Bearer <access_token> (rol admin)

Request body:

json
{
  "titulo": "Mantenimiento programado",
  "mensaje": "El sistema estará en mantenimiento el domingo 20/06 de 2am a 4am",
  "destinatarios": ["usuarios", "tecnicos"]   // o "todos"
}
Respuesta exitosa (200 OK):

json
{
  "message": "Comunicado enviado a 125 destinatarios"
}
GET /api/v1/admin/reportes/exportar
Exporta reportes de desempeño general.

Auth requerida: Authorization: Bearer <access_token> (rol admin)

Query parameters:

Parámetro	Tipo	Requerido	Descripción
tipo	string	Sí	servicios, pagos, tecnicos, satisfaccion
desde	string	Sí	Fecha inicio (YYYY-MM-DD)
hasta	string	Sí	Fecha fin (YYYY-MM-DD)
formato	string	Opcional	pdf o excel (default pdf)
Respuesta: archivo PDF/Excel.

Chat
POST /api/v1/chat/enviar
Envía un mensaje en una conversación vinculada a un servicio. El destinatario (técnico si el remitente es usuario, o viceversa) recibe notificación.

Auth requerida: Authorization: Bearer <access_token> (roles usuario o tecnico)

Request body:

json
{
  "servicio_id": 101,
  "mensaje": "Hola técnico, ¿podrías llamar antes de llegar?"
}
Respuesta exitosa (201 Created):

json
{
  "id": 5001,
  "servicio_id": 101,
  "remitente_id": 42,
  "mensaje": "Hola técnico, ¿podrías llamar antes de llegar?",
  "leido": false,
  "created_at": "2026-05-27T13:00:00Z"
}
Errores:

Código	Condición
403	El usuario no está involucrado en ese servicio
404	Servicio no existe
GET /api/v1/chat/conversacion/{servicio_id}
Obtiene el historial de mensajes de un servicio específico.

Auth requerida: Authorization: Bearer <access_token> (solo participantes: usuario propietario o técnico asignado)

Respuesta exitosa (200 OK):

json
{
  "conversacion": [
    {
      "id": 5001,
      "remitente_nombre": "Carlos Gómez",
      "remitente_rol": "usuario",
      "mensaje": "Hola técnico...",
      "leido": true,
      "created_at": "2026-05-27T13:00:00Z"
    }
  ]
}
PUT /api/v1/chat/marcar-leido/{mensaje_id}
Marca un mensaje como leído (usado cuando el destinatario abre la conversación).

Auth requerida: Authorization: Bearer <access_token> (solo el destinatario del mensaje)

Respuesta exitosa (200 OK):

json
{
  "message": "Mensaje marcado como leído"
}
Notificaciones
GET /api/v1/notifications/mis-notificaciones
Lista las notificaciones del usuario autenticado (campana).

Auth requerida: Authorization: Bearer <access_token>

Query parameters:

Parámetro	Tipo	Descripción
solo_no_leidas	boolean	Filtrar no leídas
page	int	Página
Respuesta exitosa (200 OK):

json
{
  "notificaciones": [
    {
      "id": 2001,
      "titulo": "Servicio confirmado",
      "mensaje": "Tu servicio ha sido confirmado para el 15/06 a las 10:00",
      "leida": false,
      "created_at": "2026-05-27T12:00:00Z"
    }
  ],
  "total_no_leidas": 3
}
PUT /api/v1/notifications/{id}/leida
Marca una notificación como leída.

Auth requerida: Authorization: Bearer <access_token>

Respuesta exitosa (200 OK):

json
{
  "message": "Notificación marcada como leída"
}
Calificaciones
POST /api/v1/calificaciones
Califica un servicio ya completado. Solo puede calificar el usuario propietario del servicio y una sola vez.

Auth requerida: Authorization: Bearer <access_token> (rol usuario)

Request body:

json
{
  "servicio_id": 101,
  "puntuacion": 5,
  "comentario": "Excelente atención, muy puntual"
}
Respuesta exitosa (201 Created):

json
{
  "message": "Calificación registrada",
  "calificacion": {
    "id": 3001,
    "puntuacion": 5,
    "comentario": "Excelente...",
    "fecha": "2026-05-27"
  }
}
Errores:

Código	Condición
400	El servicio no está completado o ya fue calificado
403	No es el usuario propietario
404	Servicio no existe
GET /api/v1/tecnicos/{id}/calificaciones
Obtiene las calificaciones de un técnico específico (público para usuarios autenticados).

Auth requerida: Authorization: Bearer <access_token> (cualquier rol autenticado)

Respuesta exitosa (200 OK):

json
{
  "tecnico_id": 7,
  "promedio": 4.8,
  "total": 12,
  "calificaciones": [ ... ]
}
Rate Limiting
El rate limiting se aplica por IP a los siguientes endpoints públicos/sensibles:

Endpoint	Límite
POST /auth/register	5/min
POST /auth/login	10/min
POST /auth/forgot-password	5/min
POST /auth/reset-password	5/min
POST /auth/verify-email	10/min
POST /api/v1/citas	20/min (por usuario)
POST /api/v1/pagos/iniciar	10/min (por usuario)
Respuesta cuando se supera el límite:

json
HTTP 429 Too Many Requests
{
  "error": "Rate limit exceeded. Try again later."
}
Flujos de Uso Completos
Flujo de contratación de un servicio
text
1. Usuario navega por el catálogo: GET /api/v1/servicios?categoria=instalacion
2. Selecciona un servicio: GET /api/v1/servicios/1
3. Consulta horarios disponibles: GET /api/v1/citas/horarios-disponibles?servicio_id=1&fecha=2026-06-15
4. Solicita el servicio: POST /api/v1/citas → 201
5. Administrador aprueba: PUT /api/v1/admin/solicitudes/101/aprobar (asigna técnico)
6. El técnico ve su nueva tarea: GET /api/v1/tech/mis-tareas
7. Técnico actualiza estado: PUT /api/v1/tech/tarea/101/estado {"estado": "en_progreso"}
8. Al finalizar: POST /api/v1/tech/tarea/101/evidencias (sube fotos)
9. Usuario califica: POST /api/v1/calificaciones {"servicio_id": 101, "puntuacion": 5}
Flujo de pago con abono
text
1. Usuario solicita servicio (pasos anteriores)
2. Inicia pago parcial: POST /api/v1/pagos/abono {"cita_id": 101, "monto_abonado": 10000}
3. Pasarela procesa (interacción frontend)
4. Webhook de pasarela notifica a POST /api/v1/pagos/webhook (actualiza estado pago)
5. Usuario completa pago restante: POST /api/v1/pagos/iniciar con monto restante
6. Usuario descarga comprobante: GET /api/v1/pagos/123/comprobante
Seguridad de la Documentación
En producción (ENVIRONMENT=production), Swagger UI (/docs) y ReDoc (/redoc) están deshabilitados (devuelven 404) para evitar exposición de la superficie de ataque (OWASP A05). Esta documentación en Markdown es el único recurso público para integradores.

Notas Adicionales
Autenticación: Todos los endpoints con Auth: Sí requieren header Authorization: Bearer <access_token>.

Roles: Los endpoints verifican el rol embebido en el token JWT; no se confía en ningún parámetro del cliente.

Validaciones: Pydantic valida los request bodies; errores de validación devuelven 422.

Auditoría: Los cambios de estado de citas, asignaciones de técnicos, pagos y cambios de rol se registran en la tabla audit_log.

CORS: Configurado para permitir solo el origen del frontend (ej. https://app.neodomus.com).