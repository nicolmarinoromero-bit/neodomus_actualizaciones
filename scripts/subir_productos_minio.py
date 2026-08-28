"""
Sube las imágenes de fe/public/productos/ a MinIO y actualiza la BD.

Uso dentro del contenedor api:
    docker compose exec api uv run python scripts/subir_productos_minio.py
"""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.config import settings  # noqa: E402
from app.database import SessionLocal  # noqa: E402
from app.models.producto import Producto  # noqa: E402
from app.services import minio_service  # noqa: E402

IMAGES_DIR = Path("/app/productos_local")


def main() -> None:
    if not IMAGES_DIR.is_dir():
        print(f"Directorio no encontrado: {IMAGES_DIR}")
        sys.exit(1)

    imagenes = sorted(IMAGES_DIR.iterdir())
    print(f"Imágenes encontradas: {len(imagenes)}")
    print(f"Bucket destino: {settings.MINIO_BUCKET} @ {settings.MINIO_ENDPOINT}\n")

    db = SessionLocal()
    subidas, omitidas, errores = 0, 0, 0

    for img in imagenes:
        if not img.is_file():
            continue

        nombre = img.name
        ext = img.suffix.lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp", ".gif"):
            print(f"  [!] {nombre}: extensión no soportada, se omite")
            omitidas += 1
            continue

        # El nombre del archivo es el id del producto (ej: 1.jpg, 2.jpg, ...)
        try:
            producto_id = int(img.stem)
        except ValueError:
            print(f"  [!] {nombre}: no se pudo extraer ID del producto, se omite")
            omitidas += 1
            continue

        producto = db.query(Producto).filter(Producto.id_producto == producto_id).first()
        if not producto:
            print(f"  [!] {nombre}: producto #{producto_id} no existe en la BD, se omite")
            omitidas += 1
            continue

        # Subir a MinIO
        try:
            contenido = img.read_bytes()
            url = minio_service.subir_imagen("productos", nombre, contenido)
            producto.imagen_url = url
            db.add(producto)
            subidas += 1
            print(f"  [✓] #{producto_id} → {url}")
        except Exception as e:
            errores += 1
            print(f"  [✗] #{producto_id}: {e}")

    db.commit()
    db.close()

    print(f"\nResultado: {subidas} subidas, {omitidas} omitidas, {errores} errores")


if __name__ == "__main__":
    main()
