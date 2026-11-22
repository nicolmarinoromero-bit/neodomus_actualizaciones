# Plan de Respaldo y Recuperación de NeoDomus

**Revisión:** 22 de noviembre de 2026
**Alcance:** arquitectura y scripts presentes en este repositorio. Este documento describe el diseño y el procedimiento recomendado; no confirma que haya copias programadas ni un entorno productivo en operación.

## 1. Propósito

Proteger los datos de operación y permitir recuperar NeoDomus después de una falla, borrado accidental, corrupción o pérdida del host. Una recuperación completa requiere coordinar la base de datos MySQL, los objetos de MinIO y la versión/configuración de la aplicación.

## 2. Componentes que deben respaldarse

| Componente | Contenido | Método previsto |
|---|---|---|
| MySQL 8.0 | Usuarios, catálogo, pedidos, pagos, citas, devoluciones, auditoría y demás registros | `mysqldump` con transacción consistente, rutinas, triggers y eventos; gzip y SHA-256 |
| MinIO | Medios del catálogo y evidencias privadas | Copia del directorio `/data` del contenedor, con API y MinIO detenidos para evitar escrituras concurrentes; manifiesto SHA-256 |
| Código y despliegue | Aplicación, migraciones, Compose, Caddy/Nginx y scripts | Snapshot del repositorio de despliegue incluido por `BACKUP_SOURCE_DIR`; mantener además tags/releases en Git |
| Configuración y secretos | `.env.prod`, credenciales, claves de cifrado y contraseñas | No incluir secretos en el repositorio Restic de datos. Custodiarlos aparte en un gestor seguro y asegurar que estén disponibles durante una recuperación |

La base de datos guarda referencias a archivos. Por ello MySQL y MinIO deben corresponder al mismo punto de respaldo. Los volúmenes persistentes de Docker no son copias de seguridad.

## 3. Objetivos operativos

Los siguientes valores son una propuesta inicial que el responsable del servicio debe aprobar según el impacto de negocio y la capacidad de almacenamiento:

| Objetivo | Propuesta inicial | Observación |
|---|---:|---|
| RPO (pérdida máxima de cambios) | 24 horas | Requiere respaldo diario satisfactorio y alerta ante ausencia |
| RTO (tiempo para recuperar servicio) | 8 horas | Debe confirmarse mediante simulacro cronometrado |
| Retención local | 7 diarios, 4 semanales, 12 mensuales | El script aplica estos límites al repositorio principal |
| Copia fuera del host | Obligatoria para producción | Configurar `RESTIC_OFFSITE_REPOSITORY` en almacenamiento independiente y protegido |

Hasta que se acuerden estos objetivos y se pruebe la restauración, deben considerarse metas, no niveles de servicio alcanzados.

## 4. Preparación y seguridad

1. Asignar responsables titular y suplente para ejecución, alertas y autorización de recuperación.
2. Instalar `restic`, `gzip`, `sha256sum` y Docker en el host operativo; `curl` es necesario si se usa el heartbeat.
3. Crear los repositorios Restic en almacenamiento persistente y, para producción, fuera del host. Inicializarlos de forma segura y verificar acceso.
4. Guardar `RESTIC_PASSWORD_FILE` y el archivo de contraseña MySQL en rutas legibles solo por la cuenta de respaldo (permisos `0600`). No poner secretos en Git, argumentos de comandos, logs ni este documento.
5. Crear un archivo de entorno protegido para la tarea con `RESTIC_REPOSITORY`, `RESTIC_PASSWORD_FILE`, `BACKUP_SOURCE_DIR`, nombres reales de contenedores y variables de conexión. En modo Compose, el contenedor MySQL debe tener `MYSQL_BACKUP_USER` y `MYSQL_BACKUP_PASSWORD` configurados.
6. Revisar que `BACKUP_SOURCE_DIR` apunte a la configuración y al checkout desplegado, sin datos efímeros innecesarios. El script excluye patrones de secretos conocidos, pero esa exclusión no sustituye revisar qué rutas se incluyen.
7. Configurar un programador del sistema operativo para ejecutar `scripts/backup-restic.sh` cada día y alertar por fallo o heartbeat vencido. El programador/timer no está versionado aquí; debe documentarse en el host y probarse.

## 5. Ejecución y comprobación

Ejecutar el script usando la cuenta operativa y su archivo de entorno protegido. No copiar contraseñas a la línea de comandos. Con `BACKUP_INCLUDE_MINIO_VOLUME=true` (valor predeterminado), el script detiene temporalmente API y MinIO, crea el dump y la copia de objetos y luego reanuda los servicios. Programar una ventana de baja actividad y avisar del breve corte de escritura.

Una ejecución se considera satisfactoria solo si:

- el proceso termina con código cero;
- `gzip -t` valida el dump (lo hace el script) y se generan sus sumas SHA-256;
- el manifiesto de MinIO no está vacío y el contenido se copia al snapshot;
- Restic crea el snapshot y aplica retención;
- si se configuró repositorio externo, `restic copy` finaliza correctamente;
- API y MinIO vuelven a estado saludable;
- se registra el heartbeat únicamente después de completar los pasos anteriores.

Después, revisar el snapshot reciente, ejecutar periódicamente `restic check` y comprobar la copia externa. El script actual no programa estas verificaciones ni administra una política de retención del repositorio externo; deben configurarse y monitorearse por separado.

### Datos de referencia del scrip

`scripts/backup-restic.sh` usa por defecto `MYSQL_DATABASE=neodomus`, `MYSQL_DUMP_MODE=docker`, `BACKUP_INCLUDE_MINIO_VOLUME=true`, retención local de 7 diarios/4 semanales/12 mensuales y permite definir `RESTIC_OFFSITE_REPOSITORY`. Los nombres de contenedor por defecto corresponden al proyecto Compose de producción actual; verificarlos si cambia el nombre del proyecto. El heartbeat (`BACKUP_HEARTBEAT_URL`) es opcional.

## 6. Procedimiento de recuperación

1. **Declarar el incidente.** Registrar hora, alcance, responsable y punto temporal solicitado. Evitar escrituras en los recursos afectados y preservar evidencia si se sospecha compromiso.
2. **Elegir un snapshot válido.** Consultar snapshots de Restic local y externo; verificar fecha, tags y disponibilidad de todos los datos. No elegir solo por ser el más reciente si coincide con el daño.
3. **Preparar entorno aislado.** Usar host y volúmenes separados de producción. Recuperar también el tag/commit de aplicación compatible, migraciones y configuración necesaria desde el gestor seguro.
4. **Restaurar el snapshot.** Usar `restic restore <snapshot> --target <directorio-temporal>` apuntando al repositorio y contraseña correctos. Restringir permisos del destino.
5. **Validar archivos.** Verificar las sumas del dump y manifiesto de MinIO; revisar integridad del archivo gzip. No restaurar encima de producción durante el diagnóstico.
6. **Restaurar MySQL y MinIO.** Arrancar servicios aislados con la versión compatible de MySQL/MinIO, importar el dump descomprimido en una base vacía y recuperar los datos de MinIO en su volumen. Mantener API/web fuera de servicio hasta completar las comprobaciones.
7. **Validar la aplicación.** Revisar revisión Alembic, salud/readiness, acceso a catálogo y evidencias, correspondencia de referencias entre BD y objetos y logs de error. Ejecutar pruebas funcionales de lectura y flujos críticos con cuentas sintéticas.
8. **Autorizar retorno.** El responsable del servicio aprueba el punto de recuperación y el cambio a producción. Conservar intacto el origen del incidente y documentar cualquier pérdida de datos.
9. **Cerrar y aprender.** Registrar snapshot, duración, RPO/RTO observado, errores, acciones y responsables; reponer la programación y verificar el siguiente backup completo.

Los comandos exactos de restauración dependen de las rutas restauradas, proyecto Compose, configuración y volúmenes del host. Validarlos primero en el entorno aislado; no ejecutar `docker compose down -v` ni sobrescribir volúmenes de producción como parte del diagnóstico.

## 7. Pruebas y registros

- Ensayar una restauración aislada al menos trimestralmente y después de cambios relevantes en el script, Compose o formato de almacenamiento.
- Verificar los repositorios Restic local y externo al menos mensualmente con `restic check`.
- Mantener un registro por ejecución: fecha/hora, duración, resultado, snapshot, repositorios, validaciones, estado de servicios y operador. Nunca registrar secretos.
- El runbook [RB-02 — Respaldo atrasado o fallido](runbooks/RB-02-respaldo-atrasado.md) cubre diagnóstico de fallos y escalamiento.

## 8. Riesgos y pendientes identificados

- No se encontró una tarea programada versionada; la existencia del script no demuestra que se ejecute.
- No se comprobó un backup real, repositorio Restic configurado, almacenamiento externo, alertas ni restauración ensayada.
- La copia de MinIO detiene API y MinIO; confirmar que los nombres de contenedor y healthchecks coinciden con el despliegue real.
- La copia de configuración excluye secretos conocidos. La disponibilidad de secretos cifrados y de claves Restic debe probarse por separado; perder la contraseña Restic hace irrecuperable el repositorio.
- La retención se aplica en el repositorio principal. Definir retención, acceso y ciclo de vida para la copia externa.
- Confirmar responsable, RPO, RTO, horario de respaldo, ubicación externa y evidencia de simulacro antes de declarar el plan operativo.

## 9. Referencias

- [Script de backup Restic](../scripts/backup-restic.sh)
- [Compose de producción](../deploy/compose.prod.yaml)
- [Puesta en marcha de producción](deploy/puesta-en-marcha-produccion.md)
- [Arquitectura](referencia-tecnica/architecture.md)
- [Esquema de base de datos](referencia-tecnica/database-schema.md)
- [Runbook de respaldo atrasado](runbooks/RB-02-respaldo-atrasado.md)
