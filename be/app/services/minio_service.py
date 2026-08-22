"""
Módulo: services/minio_service.py

Cliente centralizado de MinIO (compatible S3) para almacenar las imágenes
del sistema (productos, evidencias). Reemplaza el guardado en disco local
(app/static/...).

El bucket se crea automáticamente en el primer uso y queda con política
pública de lectura, de modo que los navegadores cargan las imágenes por
URL directa: {MINIO_PUBLIC_ENDPOINT}/{MINIO_BUCKET}/{objeto}.
"""

import io
import json
from pathlib import Path

from minio import Minio
from minio.error import S3Error

from app.config import settings

CONTENT_TYPES = {
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".png": "image/png",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".pdf": "application/pdf",
}


def _cliente() -> Minio:
    """Cliente único de MinIO; crea el bucket público-lectura si no existe."""
    global _client
    if _client is None:
        _client = Minio(
            settings.MINIO_ENDPOINT,
            access_key=settings.MINIO_ACCESS_KEY,
            secret_key=settings.MINIO_SECRET_KEY,
            secure=settings.MINIO_SECURE,
        )
        _asegurar_bucket(_client)
    return _client


_client: Minio | None = None


def _asegurar_bucket(client: Minio) -> None:
    bucket = settings.MINIO_BUCKET
    try:
        if not client.bucket_exists(bucket):
            client.make_bucket(bucket)
        politica = {
            "Version": "2012-10-17",
            "Statement": [
                {
                    "Effect": "Allow",
                    "Principal": {"AWS": ["*"]},
                    "Action": ["s3:GetObject"],
                    "Resource": [f"arn:aws:s3:::{bucket}/*"],
                }
            ],
        }
        client.set_bucket_policy(bucket, json.dumps(politica))
    except S3Error as e:
        raise RuntimeError(
            f"No se pudo preparar el bucket MinIO '{bucket}' en {settings.MINIO_ENDPOINT}: {e}"
        ) from e


def url_publica(objeto: str) -> str:
    """URL pública de un objeto del bucket (para <img src=...>)."""
    return f"{settings.MINIO_PUBLIC_ENDPOINT}/{settings.MINIO_BUCKET}/{objeto}"


def subir_imagen(carpeta: str, nombre_archivo: str, contenido: bytes) -> str:
    """Sube un archivo al bucket bajo '{carpeta}/{nombre_archivo}' y devuelve su URL pública."""
    cliente = _cliente()
    objeto = f"{carpeta.strip('/')}/{nombre_archivo}"
    ext = Path(nombre_archivo).suffix.lower()
    try:
        cliente.put_object(
            settings.MINIO_BUCKET,
            objeto,
            io.BytesIO(contenido),
            length=len(contenido),
            content_type=CONTENT_TYPES.get(ext, "application/octet-stream"),
        )
    except S3Error as e:
        raise RuntimeError(f"Error subiendo '{objeto}' a MinIO: {e}") from e
    return url_publica(objeto)


def eliminar_objeto(objeto: str) -> None:
    """Elimina un objeto del bucket (ignora errores para no bloquear la operación)."""
    try:
        _cliente().remove_object(settings.MINIO_BUCKET, objeto)
    except Exception:
        pass


def eliminar_imagen_producto(imagen_url: str) -> None:
    """Elimina del bucket la imagen de producto apuntada por su URL pública."""
    prefijo = f"{settings.MINIO_PUBLIC_ENDPOINT}/{settings.MINIO_BUCKET}/"
    if imagen_url and imagen_url.startswith(prefijo):
        eliminar_objeto(imagen_url[len(prefijo):])
