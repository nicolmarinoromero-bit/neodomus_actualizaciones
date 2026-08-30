"""
Módulo: scripts/migrar_a_minio.py

Migra las imágenes existentes del disco local (app/static/) al bucket MinIO
y actualiza la base de datos para que apunten a su nueva ubicación.

- productos.imagen_url:  '/uploads/<archivo>' o URL absoluta -> URL pública MinIO
- evidencias.url_archivo: '<archivo>' (ambas tablas)        -> 'evidencias/<archivo>'

Las filas que ya usan MinIO se omiten, por lo que el script es re-ejecutable.

Uso dentro del contenedor api:
    docker compose exec api uv run python scripts/migrar_a_minio.py
Simulación sin escribir cambios:
    docker compose exec api uv run python scripts/migrar_a_minio.py --dry-run
"""

import argparse
import sys
from pathlib import Path
from urllib.parse import urlparse

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.evidencia import Evidencia, EvidenciaEntrega  # noqa: E402
from app.models.producto import Producto  # noqa: E402
from app.services import minio_service  # noqa: E402

STATIC_DIR = Path(__file__).resolve().parent.parent / "app" / "static"
PRODUCTOS_DIR = STATIC_DIR / "productos"
EVIDENCIAS_DIR = STATIC_DIR / "evidencias"


def _es_de_minio(valor: str) -> bool:
    """Una clave con '/' vive en MinIO (evidencias_citas/, evidencias_entrega/, ...)."""
    return "/" in valor or settings.MINIO_PUBLIC_ENDPOINT in valor


def _nombre_desde_url(imagen_url: str) -> str:
    """Extrae el nombre de archivo de '/uploads/x.jpg' o de una URL absoluta."""
    return Path(urlparse(imagen_url).path).name


def migrar_productos(db, dry_run: bool) -> tuple[int, int]:
    migradas, omitidas = 0, 0
    productos = db.query(Producto).filter(Producto.imagen_url.isnot(None)).all()
    for p in productos:
        if _es_de_minio(p.imagen_url):
            omitidas += 1
            continue
        nombre = _nombre_desde_url(p.imagen_url)
        archivo = PRODUCTOS_DIR / nombre
        if not archivo.is_file():
            print(f"  [!] Producto #{p.id_producto}: no existe {archivo}, se omite")
            omitidas += 1
            continue
        if not dry_run:
            url = minio_service.subir_imagen("productos", nombre, archivo.read_bytes())
            p.imagen_url = url
            db.add(p)
        migradas += 1
        print(f"  [✓] Producto #{p.id_producto}: {nombre}")
    return migradas, omitidas


CARPETA_POR_TABLA = {
    Evidencia.__tablename__: "evidencias_citas",
    EvidenciaEntrega.__tablename__: "evidencias_entrega",
}


def migrar_evidencias(db, dry_run: bool) -> tuple[int, int]:
    migradas, omitidas = 0, 0
    for modelo in (Evidencia, EvidenciaEntrega):
        filas = db.query(modelo).all()
        tabla = modelo.__tablename__
        carpeta = CARPETA_POR_TABLA[tabla]
        for f in filas:
            clave = f.url_archivo or ""
            fid = getattr(f, "id_evidencia", None) or getattr(f, "id")
            if clave.startswith(f"{carpeta}/"):
                omitidas += 1
                continue
            nombre_archivo = Path(clave).name
            archivo = EVIDENCIAS_DIR / nombre_archivo
            if not archivo.is_file():
                print(
                    f"  [!] {tabla} #{fid}: no existe {archivo}, se omite"
                )
                omitidas += 1
                continue
            if not dry_run:
                minio_service.subir_imagen(
                    carpeta, nombre_archivo, archivo.read_bytes()
                )
                f.url_archivo = f"{carpeta}/{nombre_archivo}"
                db.add(f)
            migradas += 1
            print(f"  [✓] {tabla} #{fid}: {carpeta}/{nombre_archivo}")
    return migradas, omitidas


def main() -> None:
    parser = argparse.ArgumentParser(description="Migra imágenes locales a MinIO")
    parser.add_argument(
        "--dry-run", action="store_true", help="Solo muestra lo que haría"
    )
    args = parser.parse_args()

    print(f"Bucket destino: {settings.MINIO_BUCKET} @ {settings.MINIO_ENDPOINT}")
    print(f"Modo: {'SIMULACIÓN' if args.dry_run else 'REAL'}\n")

    db = SessionLocal()
    try:
        print("Productos:")
        m, o = migrar_productos(db, args.dry_run)
        print(f"  -> {m} migradas, {o} omitidas\n")

        print("Evidencias:")
        m, o = migrar_evidencias(db, args.dry_run)
        print(f"  -> {m} migradas, {o} omitidas\n")

        if not args.dry_run:
            db.commit()
            print("Migración completada y guardada en la base de datos.")
        else:
            print("Simulación terminada; no se modificó nada.")
    except Exception as e:
        db.rollback()
        print(f"Error: {e}", file=sys.stderr)
        raise
    finally:
        db.close()


if __name__ == "__main__":
    main()
