"""
Sube imágenes REALES de productos a MinIO y actualiza la BD.

Los archivos deben estar en fe/public/productos/reales/ (montado en el
contenedor como /app/productos_local/reales/). Cada archivo se asocia a un
producto de dos formas:

  1. Por ID: el nombre es el id del producto (ej: 17.jpg, 25.webp).
  2. Por referencia: el nombre es la referencia (ej: NEO-SEN-001.jpg).

Formatos soportados: .jpg .jpeg .png .webp .gif (máx 5 MB).

Uso dentro del contenedor api:
    docker compose exec api uv run python scripts/subir_imagenes_reales.py
"""

import io
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models.producto import Producto  # noqa: E402
from app.services import minio_service  # noqa: E402

REALES_DIR = Path("/app/productos_local/reales")
EXTENSIONES = {".jpg", ".jpeg", ".png", ".webp", ".gif"}
MAX_BYTES = 5 * 1024 * 1024


def _buscar_producto(db, stem: str) -> Producto | None:
    """Busca por id numérico o por referencia exacta."""
    if stem.isdigit():
        p = db.query(Producto).filter(Producto.id_producto == int(stem)).first()
        if p:
            return p
    return db.query(Producto).filter(Producto.referencia_producto == stem).first()


def main() -> None:
    if not REALES_DIR.is_dir():
        print(f"Directorio no encontrado: {REALES_DIR}")
        print("Crea la carpeta 'fe/public/productos/reales/' y deja ahí las imágenes.")
        sys.exit(1)

    archivos = sorted(f for f in REALES_DIR.iterdir() if f.is_file() and f.suffix.lower() in EXTENSIONES)
    if not archivos:
        print("No hay imágenes en fe/public/productos/reales/.")
        return

    print(f"Imágenes encontradas: {len(archivos)}\n")

    db = SessionLocal()
    subidas = 0
    omitidas = 0
    errores = 0
    try:
        for img in archivos:
            stem = img.stem
            ext = img.suffix.lower()
            producto = _buscar_producto(db, stem)
            if not producto:
                omitidas += 1
                print(f"  [!] {img.name}: no coincide con ningún producto (id o referencia), se omite")
                continue

            contenido = img.read_bytes()
            if len(contenido) > MAX_BYTES:
                omitidas += 1
                print(f"  [!] {img.name}: supera los 5 MB, se omite")
                continue

            try:
                Image.open(io.BytesIO(contenido)).verify()
            except Exception:
                omitidas += 1
                print(f"  [!] {img.name}: no es una imagen válida, se omite")
                continue

            nombre = f"real-{producto.referencia_producto.lower()}{ext}"
            try:
                url = minio_service.subir_imagen("productos", nombre, contenido)
            except Exception as e:
                errores += 1
                print(f"  [✗] {img.name}: {e}")
                continue

            producto.imagen_url = url
            for v in producto.variantes:
                v.imagen_url = url
            subidas += 1
            print(f"  [✓] {img.name} → #{producto.id_producto} {producto.nombre_producto}")

        db.commit()
        print(f"\nResultado: {subidas} subidas, {omitidas} omitidas, {errores} errores")
    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
