# RB-01 — API no disponible

- **Objetivo:** recuperar y verificar la API del stack Compose.
- **Activa:** alerta HTTP fallida de `/health/readiness` o servicio `api` no saludable.
- **Impacto:** las funciones web y móvil que requieren backend pueden fallar.
- **Responsable inicial:** operador de infraestructura; escalar a desarrollo si persiste.

## Diagnóstico

Desde la raíz del repositorio y en el host autorizado:

```sh
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml ps
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml logs --tail=100 api
curl --fail --show-error --max-time 10 http://127.0.0.1:8080/health/readiness
```

No copiar logs con secretos o datos personales a incidencias. Revisar salud de `db` y `minio` antes de reiniciar servicios.

## Recuperación

1. Confirmar espacio disponible y estado de MySQL/MinIO.
2. Corregir únicamente la causa identificada (configuración, dependencia o recurso agotado).
3. Si se requiere reinicio, acordarlo con el responsable de servicio y usar `docker compose -f deploy/compose.prod.yaml up -d api`.
4. No ejecutar migraciones ni borrar volúmenes como parte del diagnóstico.
5. Si el fallo comenzó tras una versión nueva, seguir el procedimiento de reversión de la sección 5.2 del Plan de Implantación y confirmar respaldo válido antes de tocar datos.

## Validación y cierre

Ejecutar `curl --fail --show-error http://127.0.0.1:8080/health/readiness` y `bash scripts/smoke-test.sh http://127.0.0.1:8080` con `SMOKE_EMAIL` y `SMOKE_PASSWORD` de una cuenta sintética suministrados por el gestor de secretos. Registrar fecha, versión, causa, acciones y resultado en la bitácora operativa. Escalar a desarrollo si readiness falla tras recuperar dependencias. Prevención: revisar cambios, salud, recursos y alertas después de cada liberación.
