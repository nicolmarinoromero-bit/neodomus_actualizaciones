# Migración de evidencias legadas a MinIO privado

## Diagnóstico inicial

- Las subidas actuales de entregas, citas, novedades y devoluciones escriben en `MINIO_PRIVATE_BUCKET` y guardan referencias `privado:<clave>`.
- Las rutas autenticadas conservan lectura de referencias antiguas del bucket público; las evidencias de citas también tienen fallback al directorio `be/app/static/evidencias`.
- El bucket público aplica lectura anónima a todos sus objetos. Cambiar una referencia de base de datos no revoca por sí solo una URL pública antigua.
- El directorio local `be/app/static/evidencias` contiene **0 archivos** en el checkout auditado. No se dispone de `DATABASE_URL`, `TEST_DATABASE_URL` ni variables de MinIO en el entorno de esta sesión; no se consultó ningún servicio ni base de datos real. Por ello, el conteo histórico real sigue pendiente.
- Las referencias que cubre el migrador son `evidencias_entrega.url_archivo`, `evidencias.url_archivo`, `evidencias_novedad.url_archivo`, `devoluciones.evidencia_recogida`, `devoluciones.evidencia_cambio` y `novedades.evidencia_url`.
- El inventario cloud del migrador lista objetos bajo los prefijos de evidencia conocidos en los buckets público y privado, además de las referencias de base de datos. Objetos en prefijos no inventariados deben identificarse con Nicol antes de aprobar el resultado.

## Secuencia operativa

1. Coordinar con Nicol el inventario, la ventana de ejecución y la aprobación del retiro de los objetos públicos.
2. Restaurar una copia reciente de la base y MinIO en un entorno aislado. Validar allí credenciales y permisos del bucket privado.
3. Crear un respaldo verificable de la base y de los objetos públicos candidatos. Mantener el respaldo fuera del bucket público.
4. Desde la raíz del repositorio, ejecutar un dry-run con un reporte nuevo:

   ```powershell
   $env:NEODOMUS_EVIDENCE_REPORT_DIR = 'D:\ruta-restringida' # Directorio permitido (fuera del repositorio)
   $report = 'D:\ruta-restringida\n30d-77-dry-run.json' # Sustituir por una ruta aprobada dentro del directorio permitido
   python -m scripts.migrate_legacy_evidence --report $report
   ```

5. Revisar referencias sin origen, hashes, conteos y destino con Nicol. No continuar con errores ni discrepancias.
6. Ejecutar con un nuevo reporte:

   ```powershell
   $env:NEODOMUS_EVIDENCE_REPORT_DIR = 'D:\ruta-restringida'
   $report = 'D:\ruta-restringida\n30d-77-apply.json' # Usar un archivo nuevo
   python -m scripts.migrate_legacy_evidence --apply --report $report
   ```

7. Repetir dry-run con otro nombre. Debe mostrar `heredadas: 0` para las filas migrables y cero errores. Confirmar que cada `privado:<clave>` se puede leer por la API autorizada y que una lectura anónima directa al bucket privado recibe 403.
8. Tras la aprobación del responsable y el plazo de rollback acordado, retirar las copias públicas respaldadas y verificar que las URL antiguas ya no responden. El migrador **no borra** fuentes: la purga es una acción separada y requiere autorización operativa explícita.

El reporte JSON registra conteos de referencias y fuentes únicas, conteo y tamaño de objetos por bucket, fila/campo, hash SHA-256, origen, destino y estado. Objetos privados con contenido idéntico se reutilizan; un objeto de destino ya existente con bytes distintos aborta esa fila. Cada referencia se confirma por separado, por lo que una ejecución interrumpida puede repetirse sin crear duplicados. Los reportes contienen claves/rutas internas y deben guardarse en una ubicación restringida, fuera del bucket público.

## Reversión

Mientras las fuentes originales sigan presentes, restaurar las referencias desde el manifiesto de aplicación:

```powershell
$env:NEODOMUS_EVIDENCE_REPORT_DIR = 'D:\ruta-restringida'
$manifest = 'D:\ruta-restringida\n30d-77-apply.json'
$report = 'D:\ruta-restringida\n30d-77-rollback.json'
python -m scripts.migrate_legacy_evidence --rollback $manifest --report $report
```

El script rechaza `--report` y `--rollback` fuera de `NEODOMUS_EVIDENCE_REPORT_DIR` (por defecto `reports/` en la raíz del repositorio). La validación ocurre antes de leer el manifiesto o conectar con MySQL/MinIO.

La reversión compara la referencia actual con la anterior/nueva y registra conflictos sin sobrescribirlos. Conserva los objetos privados copiados. Después de purgar las fuentes públicas, no se debe ejecutar rollback a referencias públicas; se requiere restaurar desde el respaldo aprobado o mantener las referencias privadas.

## Pruebas

Desde `be/`:

```powershell
python -m unittest app.tests.test_migracion_evidencias_legacy -v
python -m unittest app.tests.test_evidencia_novedad_cliente -v
python -m unittest app.tests.test_t1_2_minio -v
```

Las dos últimas suites requieren `TEST_DATABASE_URL`; las pruebas MinIO además necesitan el MinIO de pruebas configurado mediante `TEST_MINIO_*`. Nunca apuntar los tests a producción.
