# Aceptación operativa — Semana 6

**Proyecto:** NEODOMUS · **Versión/commit:** PENDIENTE · **Ventana UTC:** PENDIENTE
**Host productivo:** Sin asignar · **Restaurador independiente:** Sin asignar · **Aprobador:** Sin asignar

> Esta acta es el registro de ejecución, no una declaración anticipada de éxito. Cada control se marca **APROBADO** solo al adjuntar evidencia redactada y verificable. No adjuntar secretos, llaves privadas, datos personales, ni salida de `env`/`docker inspect` sin redactar.

## Ensayo técnico aislado

**2026-11-13:** se validaron `01_init_db_roles.sql`, `02_create_db_users.sh`, `verify_db_app_privileges.sh` y `mysqldump` en MySQL 8.0 dentro de un contenedor temporal con red deshabilitada, sin puertos publicados y `/var/lib/mysql` en tmpfs. DML pasó; `ALTER` y `DROP` fueron rechazados por permisos; `mysqldump` terminó con código 0. El contenedor se eliminó al terminar. Esta evidencia valida los artefactos SQL/scripts, no la configuración ni las cuentas del servidor real.

## Estado actual y restricciones de autorización

- Acceso SSH al servidor real: **pendiente de configuración**. No hay alias/host, puerto, usuario no-root ni CIDR/VPN administrativo definidos.
- La persona confirma que una llave aparece cargada en el agente SSH del equipo Windows, pero su disponibilidad y autorización en producción **no están verificadas**. La llave que funciona con GitHub no se considera autorizada en el servidor.
- El equipo técnico informado consta de cuatro integrantes Full Stack, independientes del equipo habitual. Solo se ha identificado a Integrante 1 como SENA; faltan los nombres restantes, la asignación de grupos Linux y las rutas de sus llaves públicas.
- Restaurador independiente, aprobador operativo y ventana para la interrupción de API/MinIO: **pendientes de asignación**.
- La persona usuaria indica expresamente que **no se autoriza el acceso ni la intervención en producción** hasta recibir y validar datos de conexión y permisos correspondientes.

**Decisión actual:** NO APROBADO / BLOQUEADO POR AUTORIZACIÓN Y DATOS OPERATIVOS. No ejecutar comandos SSH, UFW, migración, backup con interrupción, ni restauración en producción hasta levantar esta restricción y completar los responsables.

## Puerta 0 — Preparación y protección del servicio

| Control | Criterio de aprobación | Estado / evidencia |
|---|---|---|
| Copia pre-cambio | Snapshot Restic válido, local y offsite; verificar que se puede leer antes de tocar cuentas, SSH, firewall o base | PENDIENTE |
| Ventana y rollback | Responsable, ventana, consola fuera de banda y origen preservado | BLOQUEADO — ventana no asignada |
| Secretos | `.env.prod` y configuración Restic provisionados desde gestor; únicos por rol; permisos `0600`; ningún placeholder presente | PENDIENTE |
| Cuenta inicial | Cuenta humana individual con llave probada y `sudo` restringido antes de deshabilitar root/password | BLOQUEADO — host y usuario no definidos |

```bash
chmod 600 deploy/.env.prod
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml config --quiet
```

## Puerta 1 — Identidades Linux, SSH y SFTP

1. Ejecutar `sudo bash deploy/security/provision-users.sh` desde consola o sesión existente.
2. Por integrante, ejecutar `sudo bash deploy/security/add-team-member.sh <usuario> <sysadmin|deployer|sysdevs> <llave_ed25519.pub>`. Comparar fingerprint con la persona por un canal independiente y registrar solo usuario/grupo/fingerprint público.
3. Instalar `deploy/security/sshd_config.d/60-neodomus.conf` en `/etc/ssh/sshd_config.d/`. Antes de recargar, confirmar que la cuenta actual pertenece a uno de los grupos permitidos.
4. Validar `sudo sshd -t`; mantener la sesión actual abierta y recargar `sudo systemctl reload ssh`.
5. Desde otra sesión y otra terminal, probar llave Ed25519 y SFTP. Verificar la huella del host por canal independiente. Probar rechazo de password y `root@HOST`.

| Control | Evidencia de aprobación | Estado |
|---|---|---|
| Cuenta única por integrante | Tabla usuario/grupo/fingerprint público verificado | BLOQUEADO — faltan nombres completos, grupos Linux y rutas de llaves públicas |
| Root remoto deshabilitado | `sshd -T` redactado + intento SSH root rechazado | PENDIENTE |
| Password SSH deshabilitado | `sshd -T` muestra `passwordauthentication no`, `kbdinteractiveauthentication no`; intento password rechazado | PENDIENTE |
| Ed25519/SFTP funcional | Login llave positivo y transferencia de archivo de prueba con hash | PENDIENTE |

## Puerta 2 — Firewall

Aplicar desde consola o con recuperación fuera de banda disponible. `SSH_ADMIN_CIDR` debe ser la VPN/red administrativa real, no un placeholder:

```bash
sudo env SSH_ADMIN_CIDR='<CIDR_ADMIN_REAL>' bash deploy/security/ufw-neodomus.sh
sudo ufw status numbered
```

| Control | Evidencia de aprobación | Estado |
|---|---|---|
| Entrante limitado | UFW default deny; SSH solo desde CIDR aprobado; 80/443 según exposición real | PENDIENTE |
| Bases no públicas | Escaneo autorizado desde red externa confirma 3306/3307/5432 cerrados | PENDIENTE |
| Puertos de desarrollo/MinIO cerrados | 5173/8000/9000/9001 no alcanzables desde Internet; reglas del proveedor/VPC adjuntas | PENDIENTE |

## Puerta 3 — Base de datos de mínimo privilegio

1. Generar cuentas `MYSQL_APP_*`, `MYSQL_OWNER_*`, `MYSQL_BACKUP_*` con secretos únicos. No cambiar la contraseña root de un volumen existente durante este corte.
2. En volumen nuevo, Compose ejecuta el SQL/bootstrap en orden. En volumen existente, seguir la migración sin pérdida de datos de §7.4 de [`plan-implantacion-s06.md`](../plan-implantacion-s06.md); nunca borrar el volumen para forzar init.
3. Tomar respaldo antes de migraciones, ejecutar el job `migrate`, desplegar API y verificar:

```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml --profile ops run --rm migrate
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml up -d api web
```

4. Correr `deploy/scripts/verify_db_app_privileges.sh` en una ventana autorizada con variables cargadas desde el gestor, sin escribir valores secretos en shell history.

| Control | Evidencia de aprobación | Estado |
|---|---|---|
| API usa `neodomus_app` | Configuración efectiva redactada + conexión saludable | PENDIENTE |
| DML permitido | Script informa DML autorizado | ENSAYO AISLADO APROBADO; host pendiente |
| DDL rechazado | Script informa `ALTER` y `DROP` denegados por permisos; tabla de prueba eliminada | ENSAYO AISLADO APROBADO; host pendiente |
| Owner separado | Cuenta de migración no aparece en entorno del servicio API (evidencia redactada) | PENDIENTE |

## Puerta 4 — Backup cifrado y restauración independiente

1. Confirmar `RESTIC_PASSWORD_FILE` y repositorios local/offsite; credenciales en gestor y política de borrado protegida.
2. Revisar que `BACKUP_WORK_DIR` tiene espacio cifrado para una copia completa adicional de MinIO. El backup detiene API y MinIO para una captura consistente; aprobar la breve interrupción y medirla.
3. Ejecutar una copia y conservar log restringido con snapshot ID, SHA-256 del dump y manifiesto de MinIO. Confirmar copia local/offsite y `restic check`.
4. **Una persona distinta del operador del backup** crea/usa un servidor limpio aislado, recupera credenciales de emergencia mediante doble control, restaura DB y MinIO y verifica ambos SHA-256, conteos y smoke test antes de habilitar tráfico.
5. Calcular RPO desde hora del incidente a timestamp del snapshot y RTO desde inicio del ejercicio hasta readiness/login/lecturas confirmados.

| Campo | Resultado |
|---|---|
| Operador del backup | PENDIENTE |
| Restaurador independiente | PENDIENTE |
| Snapshot ID / hora UTC | PENDIENTE |
| SHA-256 dump — origen / restaurado / coincide | PENDIENTE |
| SHA-256 manifiesto MinIO — origen / restaurado / coincide | PENDIENTE |
| Restic check / DB import / MinIO health / smoke test | PENDIENTE |
| RPO medido / objetivo ≤ 24 h | PENDIENTE — restaurador y entorno no asignados |
| RTO medido / objetivo ≤ 4 h | PENDIENTE — restaurador y entorno no asignados |
| Interrupción del backup / salud posterior | PENDIENTE |
| Incidencias y acciones correctivas | PENDIENTE |

## Decisión de aceptación

**Resultado:** NO APROBADO — pendiente de autorización, responsables y ejecución en servidor real.
**Aprobador de infraestructura/seguridad:** ____________________ · **Fecha UTC:** __________
**Responsable funcional:** ____________________ · **Fecha UTC:** __________

No firmar aprobado si queda algún control crítico pendiente, si restauró la misma persona que generó el backup, si falla cualquier huella, o si RPO/RTO exceden los objetivos sin una excepción formal aprobada.
