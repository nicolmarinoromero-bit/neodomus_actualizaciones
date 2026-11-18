# RB-02 — Respaldo atrasado o fallido

- **Objetivo:** restablecer respaldos verificables y localizar la última copia válida.
- **Activa:** alarma de heartbeat vencido o registro de error del proceso de respaldo.
- **Impacto:** aumenta el riesgo de pérdida de datos y de incumplir RPO.
- **Responsable inicial:** operador de infraestructura; escalar al responsable de datos.

## Diagnóstico

1. Revisar el estado y registro del job de respaldo con el mecanismo de programación configurado en ese host; aún no existe un timer systemd versionado en el repositorio.
2. Verificar espacio y permisos del repositorio de respaldos.
3. Comprobar que el archivo de password de Restic existe y es legible para el servicio; no mostrar su contenido.
4. Comprobar la disponibilidad de MySQL, MinIO y el repositorio. El contenedor activo por sí solo no prueba un respaldo.

## Recuperación

1. Corregir la causa identificada (espacio, permisos, conectividad o credenciales) sin borrar copias previas.
2. Ejecutar `scripts/backup-restic.sh` bajo la cuenta operativa configurada.
3. Confirmar salida exitosa, snapshot reciente con `restic snapshots`, y hashes/manifest del respaldo.
4. Enviar el heartbeat de éxito solo después de que el script complete todas las comprobaciones. No actualizarlo manualmente ante un fallo.
5. Si no se obtiene una copia válida, escalar y activar el procedimiento de contingencia del Plan de Implantación.

Registrar job, snapshot, hora, duración, resultado de verificación y responsable, sin secretos. La restauración se ensaya únicamente en un entorno aislado; nunca sobre producción durante el diagnóstico.
