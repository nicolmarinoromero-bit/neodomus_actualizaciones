# Almacenamiento compartido entre réplicas

## Estado auditado

- Los servicios API usan el mismo `MINIO_ENDPOINT`, `MINIO_BUCKET` y `MINIO_PRIVATE_BUCKET` desde configuración. Cada proceso mantiene su propio cliente MinIO, pero los objetos viven en el servicio central y no en la memoria de proceso.
- Las evidencias nuevas y las migradas usan referencias `privado:<clave>` en `MINIO_PRIVATE_BUCKET`. Las descargas siguen pasando por endpoints autenticados que validan propietario o asignación/rol.
- `deploy/compose.prod.yaml` usa un servicio MinIO único con volumen persistente `minio_data`; varias réplicas API del mismo proyecto Compose comparten endpoint, credenciales y buckets. Los contenedores API no montan un directorio de evidencias.
- El Compose local de `docker-compose.yml` contiene un solo API con recarga de desarrollo y bind mounts. No representa una topología multi-host ni alta disponibilidad de MinIO.
- Esta configuración no ejecuta la migración histórica N30D-77. Referencias antiguas a archivos locales/públicos deben migrarse y verificarse antes de retirar el fallback legado o afirmar que todos los adjuntos están centralizados.

## Configuración de producción

La configuración de API ya permite definir endpoint, bucket público, bucket privado, endpoint para URLs públicas y TLS mediante variables de entorno. Cada réplica debe recibir exactamente los mismos valores. `MINIO_ACCESS_KEY` y `MINIO_SECRET_KEY` deben corresponder a una cuenta existente en el servidor MinIO; el ejemplo mantiene compatibilidad con la cuenta raíz del Compose.

Para varias réplicas en el mismo host/proyecto Compose:

```powershell
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml up -d --scale api=3
```

Usa el nombre real del archivo de entorno aprobado. Todas las réplicas comparten el volumen de MinIO del proyecto. Si las réplicas están en hosts diferentes, sustituye el servicio MinIO local por un endpoint S3/MinIO distribuido, accesible desde todos los hosts, con almacenamiento compartido y TLS; no montes `minio_data` como discos locales independientes.

El bucket privado no debe recibir una política anónima. `MINIO_PUBLIC_ENDPOINT` se usa para contenido deliberadamente público, como catálogo; no debe utilizarse para generar accesos a evidencias privadas.

## Prueba entre clientes de almacenamiento

Desde `be/`, configura una base MySQL aislada en `TEST_DATABASE_URL` y `TEST_MINIO_*` con buckets exclusivos de prueba. Ejecuta:

```powershell
python -m unittest app.tests.test_t1_2_minio.PrivacidadMinioTestCase.test_objeto_es_compartido_entre_clientes_de_replicas -v
```

La prueba escribe mediante un cliente MinIO independiente y descarga el objeto por el endpoint autenticado usando un segundo cliente con estado propio. Comprueba bytes idénticos y asignación del técnico. La suite también conserva pruebas de acceso anónimo y de aislamiento.

Para verificar la topología desplegada, subir una evidencia sintética a través de una réplica, registrar la clave `privado:` y descargarla mediante otra réplica usando una sesión autorizada. Repetir sin token debe responder 401; una cuenta no propietaria/no asignada debe recibir 403 o 404 según la ruta. No usar archivos de clientes ni buckets de producción en pruebas.

El volumen nombrado de MinIO persiste reinicios del servicio en ese host, pero no es por sí mismo una réplica, respaldo off-site ni alta disponibilidad. Para esas garantías se necesita un backend S3 administrado o un clúster MinIO distribuido más respaldo verificado.
