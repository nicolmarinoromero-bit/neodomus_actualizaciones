# Administración, permisos y auditoría

## Alcance y fuentes

Revisión de `be/app/utils/security.py`, dependencias `_admin` y `_tecnico` en routers, `be/app/models/roles_usuario.py`, `be/app/routers/users.py`, `be/app/utils/audit_log.py`, `be/app/services/auth_service.py`, `fe/src/App.tsx` y el inventario previo `docs/T1_identidad_permisos.md`. El servidor es la autoridad para datos protegidos; una ruta o menú de interfaz no concede permisos.

## Identidades implementadas

El sistema distingue clientes (`clientes`) y empleados (`usuarios`), y para estos registra rol asociado en `roles_usuario`. Las cuentas de empleado identificadas en flujos son administrador y técnico; el cliente no es un rol de `roles_usuario`, sino un tipo de identidad separado. Algunas normalizaciones aceptan `admin` como alias de `administrador`. No se encontró un RBAC granular configurable por permisos; los routers usan comprobaciones por rol y por propietario.

## Matriz de permisos basada en rutas y controles observados

`C`: cliente autenticado; `T`: técnico; `A`: administrador; `E`: empleado (técnico o administrador); `P`: público. Esta matriz es resumen de familias de ruta; para excepciones y endpoints concretos ver `docs/T1_identidad_permisos.md` y el router enlazado.

| Actor | Consultar | Crear | Modificar / cancelar | Eliminar / resolver |
|---|---|---|---|---|
| Público | Catálogo y algunas consultas públicas explícitas. | Registro/verificación de cliente pendiente. | Sin acceso general a registros existentes. | No. |
| Cliente | Perfil y registros propios: pedidos, citas, notificaciones, solicitudes y devoluciones propias. | Pedidos, citas, calificaciones y solicitudes permitidas. | Perfil y recursos propios dentro de las reglas de cada flujo; confirmar/cancelar solo si endpoint lo permite. | Solicitud de eliminación de cuenta; no equivale a borrado directo general. |
| Técnico | Entregas, citas, evidencias y novedades vinculadas a su ficha/asignaciones; perfil empleado propio. | Evidencias/novedades en flujos asignados. | Actualizar estados de servicio/entrega asignados y datos propios autorizados. | No gestiona usuarios/roles; eliminación/cancelación global no comprobada. |
| Administrador | Listados globales y módulos administrativos protegidos. | Altas de usuarios/técnicos y registros administrativos habilitados. | Gestión de productos, pedidos, asignaciones y estados administrativos según router. | Deshabilitación/gestión de usuarios y resolución de solicitudes/devoluciones/reembolsos según endpoint; no presumir borrado físico de todo registro. |

### Control concreto de acceso

- JWT se valida en `security.py`; la dependencia obtiene el usuario y valida tipo de token. Rol de empleado se consulta en base de datos para controles de ruta, no se confía únicamente en un claim de rol.
- `get_current_client` y `get_current_employee` distinguen tipos de identidad. `require_roles` y las funciones `_admin`/`_tecnico` limitan grupos de rutas.
- Varias rutas de cliente filtran por identidad propietaria y responden 404 para recurso ajeno. Administración requiere `_admin`; técnico asignado queda limitado a registros asociados.
- La interfaz web y móvil también ocultan o redirigen pantallas por rol, pero son controles de navegación y no sustituyen autorización de API.

## Auditoría y trazabilidad

Existe `be/app/utils/audit_log.py` con funciones de registro relacionadas con actividad de autenticación (incluye accesos, verificación de correo y eventos de limitación, según llamadas desde servicios). Hay registros de negocio en tablas específicas (por ejemplo, estado/actor en solicitudes de devolución o reembolso cuando aplica). No se comprobó un registro transversal e inmutable para toda modificación administrativa, ni un historial universal de antes/después.

Por ello, no se declara auditada cada consulta, alta, edición, eliminación, autorización o cambio de estado. Deben verificarse retención, acceso, integridad y datos capturados en la configuración real antes de usar estos registros como evidencia formal.

## Información sensible y hallazgos

- La autorización por rol y propiedad está cubierta por pruebas descritas en `docs/T1_identidad_permisos.md`; revisar su alcance antes de extrapolarlo a nuevas rutas.
- El mismo informe documenta que el bucket MinIO conserva lectura pública de objetos, por lo que no debe suponerse privacidad solo por proteger una ruta de API.
- Logout borra cookies, pero la documentación de T1 indica que los JWT previos no quedan revocados hasta expirar; cambio de contraseña tampoco revoca sesiones existentes.
- No se detectó una matriz de permisos granulares administrable desde UI. La matriz de este documento es una síntesis por actor y dominio, no un contrato por endpoint exhaustivo.
- Las acciones de borrado físico, retención legal y anonimización deben tratarse como pendientes donde no estén explícitas en el código.

## Recomendaciones pendientes (sin cambiar comportamiento)

1. Definir acciones de alto impacto que requieren motivo, segunda aprobación o revisión posterior.
2. Acordar catálogo mínimo de auditoría (actor, acción, recurso, fecha, resultado y correlación), retención y quién puede consultarlo.
3. Resolver el acceso público a archivos con el responsable de infraestructura/producto antes de almacenar contenido privado.
4. Ejecutar pruebas de autorización por endpoint crítico y comprobar que cada rechazo de escritura no altere datos.
