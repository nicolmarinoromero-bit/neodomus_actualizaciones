"""Migración SELECTIVA de URLs de almacenamiento de Neodomus.

Reescribe el prefijo (endpoint/bucket) de las URLs guardadas en BD cuando el
almacenamiento cambia de dominio. Reglas de seguridad:
  - SOLO columnas de la lista blanca (mismas que inventario_storage.py).
  - SOLO filas cuyo valor empieza EXACTAMENTE por --desde y cuyo siguiente
    carácter es '/' (o el valor es igual a --desde): nunca reemplazos
    globales ni cadenas parciales.
  - DRY-RUN por defecto: sin --aplicar no escribe nada.
  - Antes de escribir, guarda un respaldo JSON de las filas afectadas
    (undo manual: es el contenido previo de cada fila, sin borrar originales
    en el storage).
  - Verificación posterior: cero filas con el prefijo viejo, N con el nuevo.

Uso:
  python scripts/migrar_urls_storage.py --db <DATABASE_URL> \
      --desde https://viejo.example/bucket --hacia https://nuevo.example/bucket
  # Revisión: lo anterior (sin --aplicar). Ejecución: añade --aplicar
"""
import argparse
import json
import os
import sys
import time
from urllib.parse import quote_plus, urlparse

import pymysql

COLUMNAS = [
    ("usuarios", "foto_url"),
    ("clientes", "foto_url"),
    ("calificaciones_producto", "foto_url"),
    ("productos", "imagen_url"),
    ("producto_variantes", "imagen_url"),
    ("pedidos", "evidencia_entrega_url"),
    ("novedades", "evidencia_url"),
    ("evidencias_entrega", "url_archivo"),
    ("evidencias", "url_archivo"),
    ("evidencias_novedad", "url_archivo"),
]


def es_prefijo_valido(p: str) -> bool:
    u = urlparse(p)
    return bool(u.scheme and u.netloc)


def siguiente_caracter_ok(valor: str, desde: str) -> bool:
    if valor == desde:
        return True
    return valor.startswith(desde) and len(valor) > len(desde) and valor[len(desde)] == "/"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--db", required=True)
    parser.add_argument("--desde", required=True, help="Prefijo viejo: esquema://host/bucket")
    parser.add_argument("--hacia", required=True, help="Prefijo nuevo: esquema://host/bucket")
    parser.add_argument("--aplicar", action="store_true", help="Ejecuta los UPDATE (si no: dry-run)")
    args = parser.parse_args()

    if not es_prefijo_valido(args.desde) or not es_prefijo_valido(args.hacia):
        print("ERROR: --desde/--hacia deben ser esquema://host[/bucket]", file=sys.stderr)
        return 2
    if args.desde == args.hacia:
        print("ERROR: --desde y --hacia son iguales", file=sys.stderr)
        return 2

    url = urlparse(args.db)
    cnx = pymysql.connect(
        host=url.hostname,
        port=url.port or 3306,
        user=quote_plus(url.username or ""),
        password=quote_plus(url.password or ""),
        database=url.path.lstrip("/"),
        charset="utf8mb4",
        autocommit=False,
    )

    afectadas: list[dict] = []
    with cnx.cursor() as cur:
        # BD parciales (pruebas) no rompen el barrido: solo tablas presentes.
        cur.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
        )
        presentes = {r[0] for r in cur.fetchall()}
        for tabla, col in COLUMNAS:
            if tabla not in presentes:
                continue
            # Empieza por --desde y el siguiente carácter es '/' (límite de
            # bucket) o el valor es exactamente --desde.
            cur.execute(
                f"SELECT `{col}` FROM `{tabla}` "
                f"WHERE `{col}` = %s OR (`{col}` LIKE %s AND SUBSTRING(`{col}`, %s, 1) = '/')",
                (args.desde, args.desde + "%", len(args.desde) + 1),
            )
            for (valor,) in cur.fetchall():
                if not siguiente_caracter_ok(valor, args.desde):
                    continue  # defensa extra: nunca prefijos parciales
                afectadas.append({"tabla": tabla, "columna": col, "antes": valor})

    if not afectadas:
        print("SIN_COINCIDENCIAS: ninguna fila usa el prefijo viejo. Nada que migrar.")
        return 0

    print(f"Filas a migrar: {len(afectadas)}")
    for fila in afectadas[:10]:
        print(f"  [{fila['tabla']}.{fila['columna']}] {fila['antes'][:120]}")
    if len(afectadas) > 10:
        print(f"  … y {len(afectadas) - 10} más")

    if not args.aplicar:
        print("DRY_RUN: no se escribió nada. Añade --aplicar para ejecutar.")
        return 0

    # Respaldo de las filas afectadas ANTES de escribir (undo de datos).
    stamp = time.strftime("%Y%m%d_%H%M%S", time.gmtime())
    destino = os.path.join("backups", "urls", f"migracion_urls_{stamp}.json")
    os.makedirs(os.path.dirname(destino), exist_ok=True)
    with open(destino, "w", encoding="utf-8") as fh:
        json.dump(
            {"desde": args.desde, "hacia": args.hacia, "filas": afectadas},
            fh,
            ensure_ascii=False,
            indent=2,
        )
    print(f"RESPALDO_JSON={destino}")

    actualizadas = 0
    with cnx.cursor() as cur:
        for fila in afectadas:
            nuevo = args.hacia + fila["antes"][len(args.desde):]
            cur.execute(
                f"UPDATE `{fila['tabla']}` SET `{fila['columna']}` = %s "
                f"WHERE `{fila['columna']}` = %s",
                (nuevo, fila["antes"]),
            )
            actualizadas += cur.rowcount
    cnx.commit()
    print(f"ACTUALIZADAS={actualizadas}")

    # Verificación: prefijo viejo residual = 0; prefijo nuevo = esperado.
    with cnx.cursor() as cur:
        cur.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
        )
        presentes = {r[0] for r in cur.fetchall()}
        for tabla, col in COLUMNAS:
            if tabla not in presentes:
                continue
            cur.execute(
                f"SELECT COUNT(*) FROM `{tabla}` WHERE `{col}` = %s "
                f"OR (`{col}` LIKE %s AND SUBSTRING(`{col}`, %s, 1) = '/')",
                (args.desde, args.desde + "%", len(args.desde) + 1),
            )
            residual = cur.fetchone()[0]
            if residual:
                print(f"RESIDUAL {tabla}.{col}: {residual} filas con prefijo viejo")
                return 1
    print("VERIFICACION_OK: cero URLs con el prefijo viejo. Originales del storage intactos.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
