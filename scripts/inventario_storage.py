"""Inventario READ-ONLY del almacenamiento de archivos de Neodomus.

Recorre las columnas de BD que guardan URLs de imágenes/evidencias y agrupa
por prefijo (esquema://host/bucket) para responder: ¿dónde están hoy los
archivos del despliegue? No modifica nada, no imprime credenciales.

Columnas (models): usuarios.foto_url, clientes.foto_url,
calificaciones_producto.foto_url, productos.imagen_url,
producto_variantes.imagen_url, pedidos.evidencia_entrega_url,
novedades.evidencia_url, evidencias_entrega.url_archivo,
evidencias.url_archivo, evidencias_novedad.url_archivo.

Uso (necesita DATABASE_URL en el entorno o en .env):
  python scripts/inventario_storage.py            # contra la BD de DATABASE_URL
  python scripts/inventario_storage.py --db <url> # URL explícita (p. ej. de pruebas)
"""
import argparse
import os
import sys
from collections import defaultdict
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


def prefijo(url: str) -> str:
    """Clasifica una URL: esquema://host[/bucket] | 'relativa' | 'otra'."""
    u = url.strip()
    if not u:
        return "vacia"
    if u.startswith(("/", "productos/")) or "://" not in u:
        return "ruta-relativa"
    p = urlparse(u)
    bucket = p.path.lstrip("/").split("/", 1)[0] if p.path and "/" in p.path.lstrip("/") else ""
    host = f"{p.scheme}://{p.netloc}"
    return f"{host}/{bucket}" if bucket else host


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--db",
        default=os.environ.get("DATABASE_URL"),
        help="URL de BD; por defecto usa DATABASE_URL del entorno (evita pasar "
        "contraseñas por argv visible).",
    )
    args = parser.parse_args()
    if not args.db:
        print(
            "ERROR: sin --db ni DATABASE_URL en el entorno", file=sys.stderr
        )
        return 2
    url = urlparse(args.db)
    cnx = pymysql.connect(
        host=url.hostname,
        port=url.port or 3306,
        user=quote_plus(url.username or ""),
        password=quote_plus(url.password or ""),
        database=url.path.lstrip("/"),
        charset="utf8mb4",
    )
    total_urls = 0
    with cnx.cursor() as cur:
        # Tablas presentes en la BD conectada (una BD parcial, p. ej. de
        # pruebas, no debe romper el inventario).
        cur.execute(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE()"
        )
        presentes = {r[0] for r in cur.fetchall()}
        for tabla, col in COLUMNAS:
            if tabla not in presentes:
                continue
            cur.execute(
                f"SELECT COUNT(*), COUNT(`{col}`) FROM `{tabla}`"
            )
            total, no_nulos = cur.fetchone()
            if not no_nulos:
                print(f"{tabla}.{col}: 0/{total} filas con valor — vacío")
                continue
            cur.execute(
                f"SELECT `{col}` FROM `{tabla}` WHERE `{col}` IS NOT NULL AND `{col}` <> ''"
            )
            grupos: dict[str, list[str]] = defaultdict(list)
            for (valor,) in cur.fetchall():
                grupos[prefijo(valor)].append(valor)
            print(
                f"{tabla}.{col}: {no_nulos}/{total} filas con valor "
                f"({len(grupos)} grupo(s) de ubicación)"
            )
            for clave, valores in sorted(grupos.items(), key=lambda kv: -len(kv[1])):
                muestra = valores[0]
                if len(muestra) > 110:
                    muestra = muestra[:107] + "..."
                print(f"    [{len(valores):5d}] {clave}   ej: {muestra}")
            total_urls += no_nulos
    print(f"TOTAL: {total_urls} URLs/valores inventariados (solo lectura)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
