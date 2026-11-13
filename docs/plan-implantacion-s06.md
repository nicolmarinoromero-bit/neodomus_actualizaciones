# NEODOMUS — Plan de Implantación: Semana 6

> **Entregable:** Sección 3 final (respaldo y recuperación) y Sección 7 (seguridad, usuarios y permisos)
> **Fecha:** 13/11/2026 · **Sistema:** Ubuntu Server 24.04 LTS, Docker Compose, FastAPI y MySQL
> **Estado de validación:** diseño y artefactos preparados; el simulacro de restauración debe ejecutarse en infraestructura aislada y registrarse en la bitácora de §3.7. No se declara una restauración ejecutada por este documento.

## 1. Alcance y decisiones

La configuración aplica mínimo privilegio al host y MySQL, limita el acceso administrativo por llave SSH y documenta un respaldo cifrado con Restic. El stack real de NEODOMUS usa MySQL; PostgreSQL (5432) solo se bloquea expresamente en el firewall como defensa adicional. MySQL debe permanecer en la red privada de Compose y sin publicación en interfaces públicas.

**Metas heredadas de Semana 2:** RPO ≤ 24 horas y RTO ≤ 4 horas. Se ejecuta una copia diaria; no hay PITR/binlogs en esta solución, por lo que no se promete recuperación a minutos. Si el registro rector de Semana 2 establece otro objetivo aprobado, prevalece ese registro.

## 3. Plan de Respaldo Final y Recuperación

### 3.1 Estrategia 3-2-1

| Copia | Medio/ubicación | Protección |
|---|---|---|
| 1 | Repositorio Restic local en volumen/disco dedicado distinto del volumen de datos | Cifrado nativo Restic, contraseña desde archivo root-only |
| 2 | Repositorio Restic remoto S3 o Backblaze B2 en cuenta/proyecto separado | TLS, cifrado Restic de extremo a extremo, credencial IAM de mínimo privilegio y versionado/retención protegida del bucket |
| 3 | Snapshot/replicación administrada del proveedor o medio desconectado periódico | Cuenta/ubicación y credenciales separadas; prueba de recuperación trimestral |

El repositorio local y remoto no cuentan como medios independientes si comparten el mismo disco, credencial administrativa o dominio de fallo. El responsable de plataforma confirma la separación física/lógica y activa Object Lock cuando esté disponible. Restic cifra el contenido y los metadatos del repositorio; la contraseña debe guardarse separada del host en gestor de secretos y sobre sellado de emergencia probado.

### 3.2 Script, configuración y programación

Script: [`scripts/backup-restic.sh`](../scripts/backup-restic.sh). El proceso usa `mysqldump --single-transaction`, comprime el dump temporal, valida gzip, calcula SHA-256, crea snapshot Restic y aplica `keep-daily 7`, `keep-weekly 4`, `keep-monthly 12`. `RESTIC_OFFSITE_REPOSITORY` activa `restic copy` al repositorio remoto. Restic cifra antes de persistir el contenido.

Instalar dependencias (`restic`, cliente compatible `mysqldump`, `gzip`, `sha256sum`) y crear secretos en archivos protegidos:

```bash
sudo install -d -o root -g root -m 0700 /etc/neodomus /var/backups/neodomus /var/tmp/neodomus-backup
sudo sh -c 'printf %s "CHANGE_ME_IN_PROD" > /etc/neodomus/restic-password'
sudo chmod 600 /etc/neodomus/*
sudo install -o root -g root -m 0750 scripts/backup-restic.sh /usr/local/sbin/neodomus-backup-restic
```

Reemplazar los placeholders a través del gestor de secretos; no usar `echo` con valores reales en historiales. Exportar las variables en un archivo `/etc/neodomus/backup.env` modo 0600, por ejemplo:

```dotenv
RESTIC_PASSWORD_FILE=/etc/neodomus/restic-password
RESTIC_REPOSITORY=/var/backups/neodomus
RESTIC_OFFSITE_REPOSITORY=s3:https://s3.<REGION>.amazonaws.com/<BUCKET>/<PREFIX>
AWS_ACCESS_KEY_ID=CHANGE_ME_IN_PROD
AWS_SECRET_ACCESS_KEY=CHANGE_ME_IN_PROD
MYSQL_DUMP_MODE=docker
MYSQL_DOCKER_CONTAINER=neodomus-prod-db-1
BACKUP_INCLUDE_MINIO_VOLUME=true
API_DOCKER_CONTAINER=neodomus-prod-api-1
MINIO_DOCKER_CONTAINER=neodomus-prod-minio-1
BACKUP_SOURCE_DIR=/opt/neodomus
BACKUP_WORK_DIR=/var/tmp/neodomus-backup
BACKUP_EXTRA_PATHS=
```

El modo predeterminado usa `docker exec` para volcar la BD con `neodomus_backup` y copia el volumen MinIO nombrado sin exponer MySQL. Para una vista consistente entre DB y objetos, el script detiene brevemente API y MinIO, copia `/data`, crea un manifiesto SHA-256 de objetos y los reanuda antes de subir el snapshot. Programar ventana de mantenimiento, medir duración y disponer de espacio cifrado en `BACKUP_WORK_DIR` suficiente para una copia adicional completa de MinIO. Si falla el proceso, una trampa intenta reanudar los servicios y el backup falla. `BACKUP_SOURCE_DIR` no debe incluir `.env` ni llaves privadas; `BACKUP_EXTRA_PATHS` admite rutas separadas por `:`.

Inicializar los repositorios una sola vez, después de custodiar la contraseña definitiva. Como root y leyendo la configuración protegida:

```bash
set -a; . /etc/neodomus/backup.env; set +a
restic -r "$RESTIC_REPOSITORY" init
RESTIC_REPOSITORY="$RESTIC_OFFSITE_REPOSITORY" restic init
restic snapshots
RESTIC_REPOSITORY="$RESTIC_OFFSITE_REPOSITORY" restic snapshots
```

No repetir `restic init` ni cambiar la contraseña sin ejecutar el procedimiento de rotación y probar la custodia de la nueva clave.

Cron diario 02:15, ejecutado como root, con salida a syslog y alerta externa ante código distinto de cero o snapshot con más de 26 horas:

```cron
15 2 * * * root . /etc/neodomus/backup.env; export RESTIC_REPOSITORY RESTIC_OFFSITE_REPOSITORY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY RESTIC_PASSWORD_FILE MYSQL_DUMP_MODE MYSQL_DOCKER_CONTAINER BACKUP_INCLUDE_MINIO_VOLUME API_DOCKER_CONTAINER MINIO_DOCKER_CONTAINER BACKUP_SOURCE_DIR BACKUP_WORK_DIR BACKUP_EXTRA_PATHS; /usr/local/sbin/neodomus-backup-restic >> /var/log/neodomus-backup.log 2>&1
```

El log debe tener rotación y permisos 0640. Verificar diariamente estado/edad de snapshot y trimestralmente ejecutar `restic check` y una restauración aislada. Si se desea separar secretos del entorno, usar un wrapper que lea el gestor de secretos; no registrar entorno en diagnósticos.

### 3.3 Comprobación SHA-256

El script produce SHA-256 del dump comprimido durante la ejecución y lo incorpora al snapshot. Para evidencia externa, exportar el dump solo a un directorio temporal cifrado y controlado durante el simulacro, recalcular `sha256sum` antes de copiar/importar y comparar con el valor registrado; eliminarlo al cerrar el simulacro. La comprobación adicional de Restic es `restic check --read-data-subset=10%` periódica y `restic check --read-data` durante la prueba de desastre (tiempo/costo planificado). SHA-256 valida igualdad del artefacto, no reemplaza la verificación de aplicación ni el cifrado.

### 3.4 Restauración en servidor limpio

1. Abrir incidente, declarar hora de desastre y responsable de recuperación. Aprovisionar Ubuntu parcheado con disco cifrado, Docker/Compose y acceso fuera de banda. Aplicar reglas de firewall de §7.3.
2. La persona que restaura debe ser distinta del operador que generó el respaldo. Recuperar del gestor de secretos la contraseña Restic y credenciales de solo lectura del remoto mediante doble control. Montar/inicializar repositorio local si hay copia local; de lo contrario apuntar `RESTIC_REPOSITORY` al remoto.
3. Ejecutar `restic snapshots`; elegir snapshot más reciente cuyo timestamp sea anterior al evento. Ejecutar `restic check --read-data` si la ventana lo permite.
4. Restaurar a un directorio aislado: `restic restore <ID> --target /restore/neodomus`. No sobrescribir el host ni la única copia original.
5. Localizar el dump con `find /restore/neodomus -type f -name 'neodomus.sql.gz' -print`; verificar su sidecar `.sha256` y comparar con la huella registrada fuera del repositorio. Revisar `gzip -t <RUTA_DUMP>` antes de importarlo.
6. Desplegar MySQL en red privada, crear base vacía y roles/cuentas con secretos recién rotados. Importar: `gzip -dc <RUTA_DUMP> | mysql --host=<DB_PRIVADA> --user=<RESTORE_USER> -p neodomus`. No colocar contraseña en línea de comandos.
7. Localizar los datos MinIO con `find /restore/neodomus -type d -name minio-data -print`; localizar al lado `minio-data.sha256` y verificar con `(cd <RUTA_MINIO_DATA> && sha256sum -c ../minio-data.sha256)`. Con MinIO nuevo detenido y su volumen montado, copiar datos con `docker cp <RUTA_MINIO_DATA>/. neodomus-prod-minio-1:/data/`, iniciar MinIO y validar salud, conteo de objetos y descarga representativa antes de habilitar API.
8. Desplegar versión de aplicación compatible con backup, verificar `alembic current` sin aplicar migraciones hasta aprobación, y realizar smoke checks de salud, login y consultas representativas.
9. Mantener el destino aislado hasta aprobar conciliación y controles de seguridad. Cambiar DNS/tráfico mediante cambio autorizado. Conservar origen y evidencia según política de incidentes.

### 3.5 Evaluación RPO/RTO

| Métrica | Meta Semana 2 | Cálculo del simulacro | Criterio |
|---|---:|---|---|
| RPO | ≤ 24 h | Hora del incidente menos hora del último snapshot válido | Cumple si delta ≤ 24 h; registrar pérdida real observada |
| RTO | ≤ 4 h | Hora de servicio básico verificado menos inicio de recuperación | Cumple si delta ≤ 4 h; incluir provisión, descarga, importación y validación |

No declarar cumplimiento sin simulacro medido. Si falla: documentar causa, volumen, tiempos por etapa, responsable y plan correctivo; ajustar capacidad, frecuencia o meta formalmente.

### 3.6 Retención y operación

Restic aplica 7 diarios, 4 semanales y 12 mensuales y elimina snapshots obsoletos tras copiar al remoto. Verificar que el remoto recibió todos los snapshots antes de podar localmente. Restringir borrado/expiración del bucket; alertar por job fallido, falta de espacio y snapshot >26 h. Trimestralmente, recuperar una muestra de objetos y base en ambiente aislado y actualizar evidencia.

### 3.7 Bitácora de evidencia de desastre

Completar durante un ejercicio real, adjuntando logs redactados de secretos y datos personales:

| Campo | Registro |
|---|---|
| Fecha / operador de backup / restaurador independiente / aprobador | PENDIENTE DE SIMULACRO |
| ID snapshot y timestamp UTC | PENDIENTE |
| SHA-256 origen / restaurado / coincidencia | PENDIENTE |
| Estado `restic check` / gzip / conteos | PENDIENTE |
| RPO medido / meta / resultado | PENDIENTE |
| RTO medido / meta / resultado | PENDIENTE |
| Incidencias, aprobador y acciones | PENDIENTE |

## 7. Seguridad, Usuarios y Permisos

### 7.1 Identidades Linux y grupos

La matriz de referencia: `sysadmin` administra servicios seleccionados; `deployer` realiza despliegues aprobados; `appuser` ejecuta la aplicación sin login interactivo en producción; `sysdevs` accede a logs de API. Una persona por cuenta, llaves SSH individuales y membresía revisada trimestralmente. No compartir cuentas ni añadir al grupo `docker` (equivale a root).

[`deploy/security/provision-users.sh`](../deploy/security/provision-users.sh) crea los grupos y el usuario de servicio `appuser` (shell `nologin`) y aplica sudoers. Para personas, crear una identidad por integrante —no una cuenta compartida— con [`deploy/security/add-team-member.sh`](../deploy/security/add-team-member.sh): `sudo bash deploy/security/add-team-member.sh <usuario_individual> <sysadmin|deployer|sysdevs> <llave_ed25519.pub>`. Confirmar el fingerprint con la persona por un canal independiente. Nunca instalar llaves privadas en el servidor.

### 7.2 Sudo de mínimo privilegio

[`deploy/security/sudoers.d/neodomus`](../deploy/security/sudoers.d/neodomus) limita sudo a comandos concretos de systemd/journalctl. Instalar en `/etc/sudoers.d/neodomus`, propietario `root:root`, modo `0440`, validar con `visudo -cf`. Los comodines `neodomus*` se limitan a unidades nombradas y deben revisarse si se añaden servicios. No conceder `NOPASSWD`, shell, editor, intérprete ni comodines de argumentos.

### 7.3 SSH y firewall

Instalar [`deploy/security/sshd_config.d/60-neodomus.conf`](../deploy/security/sshd_config.d/60-neodomus.conf) en `/etc/ssh/sshd_config.d/`, validar `sshd -t`, probar sesión nueva con llave Ed25519 y luego recargar `systemctl reload ssh`. Antes de activarlo, incorporar la cuenta administrativa existente a uno de los grupos permitidos; mantener sesión actual y acceso fuera de banda hasta verificar. Desactiva root remoto y autenticación por contraseña; solo llaves públicas Ed25519. Para SFTP, verificar primero la huella del host por canal independiente y conectar con `sftp -i <RUTA_LLAVE_PRIVADA_LOCAL> <usuario_individual>@<HOST>`; la llave privada permanece en el equipo del integrante.

Aplicar [`deploy/security/ufw-neodomus.sh`](../deploy/security/ufw-neodomus.sh) desde consola o tras confirmar SSH operativo, definiendo `SSH_ADMIN_CIDR` a la VPN/red administrativa autorizada: política entrante deny, saliente allow, permitir SSH solo desde ese CIDR, 80/443 y denegar 5432/3306/3307. UFW en Ubuntu no controla necesariamente puertos publicados directamente por Docker; por ello producción no publica DB, y el firewall del proveedor/VPC debe bloquear también acceso público. Usar TLS por 443 y permitir 80 solo para redirección/ACME.

### 7.4 Roles y separación de BD

Scripts [`deploy/scripts/01_init_db_roles.sql`](../deploy/scripts/01_init_db_roles.sql) y [`deploy/scripts/02_create_db_users.sh`](../deploy/scripts/02_create_db_users.sh), ejecutados automáticamente al inicializar un volumen MySQL vacío en producción, crean roles y cuentas independientes:

| Rol | Uso | Permisos |
|---|---|---|
| `neodomus_owner` | Alembic/migraciones por identidad separada | `ALL` en esquema `neodomus` (DDL/DML) |
| `neodomus_app` | API en runtime | `SELECT, INSERT, UPDATE, DELETE` únicamente |
| `neodomus_read_only` | reportes/auditoría | `SELECT` únicamente |
| Rol `neodomus_backup` (cuenta predeterminada `neodomus_backup_runtime`) | `mysqldump` | `SELECT`, metadatos, `TRIGGER`, `EVENT`, `LOCK TABLES` |

La configuración productiva usa `MYSQL_APP_USER`/`MYSQL_APP_PASSWORD` solo en API, `MYSQL_OWNER_USER`/`MYSQL_OWNER_PASSWORD` solo en la tarea manual `migrate`, y `MYSQL_BACKUP_USER`/`MYSQL_BACKUP_PASSWORD` para los dumps. Las contraseñas deben ser diferentes, generadas con `openssl rand -hex 32` y guardadas en `.env.prod` modo `0600` o en el gestor de secretos. El bootstrap valida formato hexadecimal. MySQL no publica puertos al host.

La API productiva no corre Alembic al arrancar. Después de un respaldo aprobado y antes de liberar una versión, ejecutar `docker compose --env-file .env.prod -f compose.prod.yaml --profile ops run --rm migrate`; solo ese job usa el rol propietario. Luego actualizar `api` y `web`. En bases existentes, los scripts de `/docker-entrypoint-initdb.d` no se repiten automáticamente: respaldar primero, aplicar el SQL de roles como DBA y ejecutar el bootstrap de cuentas manualmente con el entorno nuevo; verificar credenciales, roles y healthcheck antes de continuar. No borrar el volumen para forzar inicialización.

Para una base existente, conservar la credencial root actual al cambiar el archivo de entorno, desplegar primero solo `db`, aplicar `01_init_db_roles.sql` y ejecutar el bootstrap de cuentas dentro del contenedor (el healthcheck puede fallar hasta crear la cuenta app). Confirmar login con las cuentas nuevas; después correr el job `migrate` y levantar API/web. Los scripts de init no modifican ni eliminan datos, pero deben ejecutarse solo tras copia válida. Desde la raíz del repositorio: `docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"' < deploy/scripts/01_init_db_roles.sql` y luego `docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml exec db bash /docker-entrypoint-initdb.d/02_create_db_users.sh`.

La prueba repetible [`deploy/scripts/verify_db_app_privileges.sh`](../deploy/scripts/verify_db_app_privileges.sh) crea una tabla temporal aleatoria con owner, verifica `SELECT/INSERT/UPDATE/DELETE` con la cuenta API y confirma que `ALTER` y `DROP` se rechazan por permisos; luego elimina la tabla de prueba. Ejecutar solo contra un entorno aprobado, exportando credenciales desde un gestor seguro. Guardar la salida redactada y fecha en evidencia; no afirmar ejecución hasta que la realice el operador.

### 7.5 Inventario de secretos y protección de archivos

| Secreto | Ubicación/gestión | Acceso |
|---|---|---|
| `.env` de despliegue / credenciales MySQL, MinIO | `/opt/neodomus/.env` o secret manager; excluido de Git | `root:appuser`, modo `0640` solo si grupo necesita lectura; preferir secretos Docker montados |
| Contraseña Restic | Secret manager + archivo `/etc/neodomus/restic-password` | root, `0600`; copia de emergencia fuera del host |
| Usuario/clave dump MySQL | archivo root-only o secret manager | `0600`, usuario dedicado de respaldo |
| Llaves privadas SSH | agente personal/llavero del operador | nunca copiar al servidor; en host solo `authorized_keys` públicas, `0600` |
| JWT `SECRET_KEY` | gestor de secretos/archivo de despliegue | restringido al servicio API; no Git/logs |
| API keys SMTP/OAuth/pagos | secret manager y proveedor emisor | scopes mínimos; inventario de propietario y vencimiento |

Para instalación manual requerida: `chown root:root /opt/neodomus/.env && chmod 600 /opt/neodomus/.env`. Si el contenedor requiere lectura, montar el secreto con UID/GID dedicados en vez de relajar permisos globales. Verificar `.gitignore`, no imprimir `env`, `docker inspect` ni valores de secrets en logs/tickets.

### 7.6 Revocación y rotación tras salida de miembro

1. Registrar hora de revocación y custodio; retirar inmediatamente acceso SSO/VPN, llaves autorizadas, sesiones y tokens personales. Deshabilitar cuenta Linux (`usermod -L`, `passwd -l`), retirar grupos y revocar claves en `authorized_keys`; revisar `sudo` y auditoría.
2. Identificar secretos a los que tuvo acceso: DB, JWT, MinIO/S3, SMTP/OAuth, proveedor de pagos, CI/CD, backup remoto y certificados/API keys. Abrir inventario de propietarios/consumidores y priorizar exposición externa.
3. Crear secretos nuevos en el gestor, actualizar consumidores y reiniciar/recargar por etapas. Para DB crear credencial nueva y probar salud; revocar anterior tras confirmar API/jobs/migraciones. No reutilizar contraseñas.
4. JWT: generar nueva `SECRET_KEY`; programar invalidación de sesiones/tokens existentes (impacto: reautenticación) y desplegar en todos los workers coordinadamente. Revocar refresh tokens si existe almacén. Rotar API keys en el proveedor, actualizar CI y probar integración con permisos mínimos.
5. Rotar credenciales del bucket/Restic sin perder capacidad de descifrado: confirmar acceso con credencial nueva y conservar la contraseña de cifrado Restic según política de custodia, pues cambiarla requiere `restic key` y copias recuperables. Revocar IAM anterior y auditar accesos.
6. Invalidar sesiones SSH activas del usuario, revisar `last`, `journalctl`, registros de autenticación y cambios recientes. Si hubo sospecha de exfiltración, preservar evidencia y considerar comprometidos los secretos visibles.
7. Verificar funcionalidades, respaldo nuevo y acceso de emergencia; actualizar fecha/propietario del inventario, registrar aprobador y cerrar la revocación. Objetivo operativo: acceso humano revocado inmediatamente; credenciales compartidas rotadas el mismo día o antes si hay sospecha.

## Referencias de implementación

- Usuarios: [`deploy/security/provision-users.sh`](../deploy/security/provision-users.sh)
- SSH: [`deploy/security/sshd_config.d/60-neodomus.conf`](../deploy/security/sshd_config.d/60-neodomus.conf)
- Sudoers: [`deploy/security/sudoers.d/neodomus`](../deploy/security/sudoers.d/neodomus)
- Firewall: [`deploy/security/ufw-neodomus.sh`](../deploy/security/ufw-neodomus.sh)
- Roles MySQL: [`deploy/scripts/01_init_db_roles.sql`](../deploy/scripts/01_init_db_roles.sql)
- Respaldo cifrado: [`scripts/backup-restic.sh`](../scripts/backup-restic.sh)
- Prueba de mínimo privilegio MySQL: [`deploy/scripts/verify_db_app_privileges.sh`](../deploy/scripts/verify_db_app_privileges.sh)
- Alta de llave individual: [`deploy/security/add-team-member.sh`](../deploy/security/add-team-member.sh)

### 7.7 Evidencia operativa requerida para aceptar

| Control | Evidencia que se debe adjuntar | Estado de este artefacto |
|---|---|---|
| Cuentas individuales | Lista de usuarios sin datos personales innecesarios, grupos y huellas de llaves públicas confirmadas | Pendiente de aplicar en el host |
| Acceso SSH | Salida redactada de `sshd -T` mostrando root/password deshabilitados; prueba positiva con llave y negativa de password | Pendiente de aplicar y probar |
| Firewall | `ufw status numbered` y revisión de firewall del proveedor desde una red externa | Pendiente de aplicar y probar |
| Privilegios MySQL | Salida de `verify_db_app_privileges.sh` con DML aprobado y `ALTER`/`DROP` denegados | Script preparado; ejecución pendiente |
| Restauración independiente | Persona distinta del operador de backup, servidor limpio, ID snapshot, SHA-256, conteos, RPO/RTO y smoke test | Pendiente de simulacro |

La configuración del repositorio no puede demostrar la instalación de llaves, el filtrado efectivo del host ni una restauración por otra persona. La aceptación final requiere completar estas evidencias en el servidor real; no registrar secretos, llaves privadas ni datos personales en los artefactos.
