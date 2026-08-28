# RF-040 — Copias de seguridad automáticas de la información del sistema

<!--
  ¿Qué? El sistema realiza copias de seguridad automáticas periódicamente.
  ¿Para qué? Proteger la información contra pérdidas o desastres.
  ¿Impacto? Garantiza la recuperación de datos en caso de fallo.
-->

## Identificación

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| **ID**        | RF-040                                         |
| **Nombre**    | Copias de seguridad automáticas de la información |
| **Módulo**    | Administrador / Infraestructura                |
| **Prioridad** | Alta                                           |
| **Estado**    | Propuesta                                      |
| **Fecha**     | Mayo 2026                                      |

## Descripción

El sistema debe realizar copias de seguridad automáticas de la base de datos y los archivos subidos (fotos de evidencias) cada 24 horas. Las copias deben almacenarse en una ubicación segura y externa al servidor principal.

## Entradas

No aplica entradas de usuario; es un proceso automático.

## Proceso

1. Un cron job o tarea programada se ejecuta a las 2:00 AM (horario de baja actividad).
2. Se realiza un volcado (dump) de la base de datos MySQL.
3. Se copian los archivos del almacenamiento (fotos, comprobantes) a un bucket de backup.
4. Se comprime el backup y se sube a un servicio externo (AWS S3, Google Cloud Storage, o servidor separado).
5. Se envía un reporte por correo al administrador con el resultado (éxito o fallo).

## Salidas

| Escenario                     | Código HTTP | Respuesta (efecto secundario) |
| ----------------------------- | ----------- | ----------------------------- |
| Backup exitoso                | (automático) | Correo de confirmación       |
| Backup fallido                | (automático) | Correo de alerta con error    |

## Endpoints asociados

| Método | Ruta                         | Auth  | Descripción                              |
| ------ | ---------------------------- | ----- | ---------------------------------------- |
| POST   | `/api/v1/admin/backup`       | Sí (admin) | Solicita una copia de seguridad manual   |

## Reglas de negocio

- **RN-092:** Las copias de seguridad se retienen por 30 días (rotación automática).
- **RN-093:** El administrador puede solicitar un backup manual bajo demanda.
- **RN-094:** Los backups deben estar cifrados antes de ser enviados a almacenamiento externo.