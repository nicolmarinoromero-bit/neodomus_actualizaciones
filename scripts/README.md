# Carpeta `scripts/`

Scripts de base de datos de NEODOMUS. Todo lo relacionado con datos iniciales,
seeds y utilidades de base de datos se organiza aquí.

## Contenido

| Archivo | Descripción |
|---|---|
| `seed_test_users.py` | Crea automáticamente los usuarios de prueba (clientes, administrador y técnico) con contraseña temporal con hash. Idempotente: no duplica ni sobrescribe usuarios existentes. |
| `reset_passwords.py` | Resetea la contraseña de **TODOS** los usuarios y clientes con el patrón documentado abajo. Idempotente; al terminar regenera la sección autogenerada de `init_db.sql` para que el script de init quede sincronizado. Soporta `--verificar` (comprueba sin modificar) y `--mostrar-claves`. |
| `export_seed.py` | Guarda los registros actuales de la BD (clientes, usuarios, técnicos) dentro de `init_db.sql`, regenerando su sección final con `INSERT IGNORE`. |
| `init_db.sql` | Esquema y datos iniciales en SQL (no destructivo e idempotente). Este archivo es la fuente de datos que regenera `export_seed.py`. |

> Nota: el **versionado real del esquema** (tablas, columnas, seeds) se gestiona
> con **Alembic** en `be/alembic/versions/`, que es el que ejecuta el contenedor
> `api` al arrancar. `init_db.sql` se conserva como respaldo/referencia SQL.

## Usuarios de prueba

Los usuarios de prueba usan una contraseña temporal con este patrón:

```
12345678 + inicial del nombre en MAYÚSCULA + inicial del primer apellido en minúscula + .
```

| Email | Nombre | Contraseña temporal |
|---|---|---|
| `prueba.cliente@neodomus.com` | Prueba Cliente | `12345678Pc.` |
| `cliente.demo@neodomus.com` | Carolina Mendez | `12345678Cm.` |
| `admin@neodomus.com` | Admin Neodomus | `12345678An.` |
| `tecnico@neodomus.com` | Tecnico Prueba | `12345678Tp.` |

> ⚠️ Seguridad: la base de datos solo guarda el **hash bcrypt** de la contraseña,
> nunca el texto plano. Las contraseñas de esta tabla son solo de referencia
> para pruebas. Para verlas en consola ejecuta el script con `--mostrar-claves`.

## Ejecución

Dentro del contenedor `api` (recomendado, usa la BD de Docker; `scripts/` está
montado en `/app/scripts` vía `docker-compose.yml`):

```bash
docker exec -it neodomus_api uv run python /app/scripts/seed_test_users.py
```

Para ver las contraseñas temporales en consola (solo pruebas):

```bash
docker exec -it neodomus_api uv run python /app/scripts/seed_test_users.py --mostrar-claves
```

O desde el host con el backend disponible:

```bash
cd be && uv run python ../scripts/seed_test_users.py
```

Para regenerar el SQL inicial desde la BD actual:

```bash
python scripts/export_seed.py
```

### Resetear todas las contraseñas (`reset_passwords.py`)

Aplica el patrón de arriba a **todos** los registros de `clientes` y
`usuarios` (los que crea `init_db.sql` y cualquier otro existente) y
sincroniza la sección autogenerada de `init_db.sql` con los nuevos hashes:

```bash
# Resetear todo (+ regenerar init_db.sql)
docker exec -it neodomus_api uv run python /app/scripts/reset_passwords.py

# Ver qué cuentas NO cumplen el patrón (no modifica nada)
docker exec -it neodomus_api uv run python /app/scripts/reset_passwords.py --verificar

# Resetear mostrando las contraseñas generadas (solo pruebas)
docker exec -it neodomus_api uv run python /app/scripts/reset_passwords.py --mostrar-claves
```

## Reglas de idempotencia

- Si un email ya existe, no se duplica ni se sobrescribe su contraseña.
- No elimina usuarios existentes.
- Solo inserta datos si faltan.

## Migraciones

El esquema de base de datos se gestiona con **Alembic** en `be/alembic/versions/`.
Las nuevas tablas/columnas del proyecto (marcas, venta por metros, pagos,
facturas) están en las migraciones `0002_*`.
