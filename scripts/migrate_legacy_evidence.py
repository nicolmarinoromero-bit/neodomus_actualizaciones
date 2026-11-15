"""Move legacy evidence references from the public MinIO bucket to private storage.

Dry-run is the default. Applying updates copies and verifies each object before
conditionally changing its database reference. Original public objects are never
deleted by this command.

Reports and rollback manifests must live inside NEODOMUS_EVIDENCE_REPORT_DIR
(default: <repository>/reports) so user-supplied paths cannot escape it.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
from dataclasses import asdict, dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.parse import unquote

from minio import Minio
from sqlalchemy import MetaData, Table, inspect, select

PROJECT_ROOT = Path(__file__).resolve().parents[1]
BACKEND_ROOT = PROJECT_ROOT / "be"
DEFAULT_REPORT_ROOT = PROJECT_ROOT / "reports"
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.config import settings  # noqa: E402
from app.database import engine  # noqa: E402
from app.services import minio_service  # noqa: E402

PRIVATE_PREFIX = minio_service.PRIVATE_PREFIX
EVIDENCE_COLUMNS = (
    ("evidencias_entrega", "id", "url_archivo"),
    ("evidencias", "id_evidencia", "url_archivo"),
    ("evidencias_novedad", "id_evidencia_n", "url_archivo"),
    ("devoluciones", "id_devolucion", "evidencia_recogida"),
    ("devoluciones", "id_devolucion", "evidencia_cambio"),
    ("novedades", "id_novedad", "evidencia_url"),
)
EVIDENCE_PREFIXES = (
    "evidencias/",
    "evidencias_entrega/",
    "evidencias_novedad/",
    "devoluciones/",
    "novedades/",
    "evidencias_migradas/",
)
ALLOWED_SUFFIXES = {".jpg", ".jpeg", ".png", ".webp", ".gif", ".pdf"}


@dataclass(frozen=True)
class EvidenceRef:
    table: str
    record_id: int
    field: str
    value: str
    source_key: str | None = None


def _source_key(value: str) -> str:
    """Normalize a legacy URL or bucket key without accepting other hosts."""
    if value.startswith("http"):
        key = minio_service._clave_desde_referencia(value)
        if key == value:
            raise ValueError("URL de evidencia no pertenece a un bucket conocido")
    else:
        key = value
        if key.startswith(f"{settings.MINIO_BUCKET}/"):
            key = key[len(settings.MINIO_BUCKET) + 1 :]
    key = unquote(key.split("?", 1)[0]).lstrip("/")
    if not key or ".." in Path(key).parts:
        raise ValueError("Clave de evidencia inválida")
    return key


def _legacy_ref(table: str, record_id: int, field: str, value: Any) -> EvidenceRef | None:
    if not isinstance(value, str) or not value.strip() or value.startswith(PRIVATE_PREFIX):
        return None
    return EvidenceRef(table, int(record_id), field, value, _source_key(value))


def _fetch_refs() -> list[EvidenceRef]:
    refs: list[EvidenceRef] = []
    inspector = inspect(engine)
    with engine.connect() as connection:
        metadata = MetaData()
        for table_name, id_field, field in EVIDENCE_COLUMNS:
            if not inspector.has_table(table_name):
                continue
            table = Table(table_name, metadata, autoload_with=connection)
            if id_field not in table.c or field not in table.c:
                continue
            rows = connection.execute(
                select(table.c[id_field], table.c[field]).where(table.c[field].is_not(None))
            )
            for record_id, value in rows:
                ref = _legacy_ref(table_name, record_id, field, value)
                if ref is not None:
                    refs.append(ref)
    return refs


def _counts(refs: list[EvidenceRef]) -> dict[str, int]:
    unique_rows = {(ref.table, ref.record_id, ref.field) for ref in refs}
    return {
        "referencias": len(refs),
        "referencias_legadas_unicas_por_tabla": len(unique_rows),
    }


def private_target_key(data: bytes, source_key: str) -> str:
    digest = hashlib.sha256(data).hexdigest()
    suffix = Path(source_key).suffix.lower()
    if suffix not in ALLOWED_SUFFIXES:
        suffix = ".bin"
    return f"evidencias_migradas/{digest[:2]}/{digest}{suffix}"


def _copy_verified(data: bytes, target_key: str) -> bool:
    """Create a private copy if absent and verify its bytes; return if created."""
    try:
        existing = minio_service.leer_objeto_privado(target_key)
    except FileNotFoundError:
        folder, name = target_key.rsplit("/", 1)
        minio_service.subir_imagen_privada(folder, name, data)
        copied = minio_service.leer_objeto_privado(target_key)
        if copied != data:
            raise RuntimeError("El objeto privado copiado tiene contenido diferente")
        return True
    if existing != data:
        raise RuntimeError("El destino privado existente tiene contenido diferente")
    return False


def _readonly_client() -> Minio:
    """Create a MinIO client used only for read-only inventory operations."""
    return Minio(
        settings.MINIO_ENDPOINT,
        access_key=settings.MINIO_ACCESS_KEY,
        secret_key=settings.MINIO_SECRET_KEY,
        secure=settings.MINIO_SECURE,
    )


def _storage_inventory() -> dict[str, list[dict[str, Any]]]:
    client = _readonly_client()
    inventory: dict[str, list[dict[str, Any]]] = {
        "public_objects": [],
        "private_objects": [],
    }
    for bucket, key in (
        (settings.MINIO_BUCKET, "public_objects"),
        (settings.MINIO_PRIVATE_BUCKET, "private_objects"),
    ):
        if not client.bucket_exists(bucket):
            continue
        found: dict[str, dict[str, Any]] = {}
        for prefix in EVIDENCE_PREFIXES:
            for obj in client.list_objects(bucket, prefix=prefix, recursive=True):
                name = obj.object_name
                if name:
                    found[name] = {"key": name, "size": obj.size}
        inventory[key] = sorted(found.values(), key=lambda item: item["key"])
    return inventory


def _update_reference(ref: EvidenceRef, old_value: str, new_value: str) -> None:
    id_field = next(
        (pk for table, pk, field in EVIDENCE_COLUMNS if table == ref.table and field == ref.field),
        None,
    )
    if id_field is None:
        raise ValueError("Referencia de evidencia no admitida")
    with engine.begin() as connection:
        table = Table(ref.table, MetaData(), autoload_with=connection)
        result = connection.execute(
            table.update()
            .where(table.c[id_field] == ref.record_id)
            .where(table.c[ref.field] == old_value)
            .values({ref.field: new_value})
        )
        if result.rowcount != 1:
            raise RuntimeError("La referencia cambió durante la migración; no se actualizó")


def _entry(ref: EvidenceRef, status: str, **extra: Any) -> dict[str, Any]:
    return {**asdict(ref), "status": status, **extra}


def _run_dry_run(report: dict[str, Any], refs: list[EvidenceRef]) -> None:
    for ref in refs:
        try:
            data = minio_service.leer_objeto_publico(ref.source_key or "")
            report["entries"].append(
                _entry(
                    ref,
                    "ready",
                    target_key=private_target_key(data, ref.source_key or ""),
                    sha256=hashlib.sha256(data).hexdigest(),
                    size=len(data),
                )
            )
        except Exception as exc:
            report["errors"] += 1
            report["entries"].append(_entry(ref, "error", error=str(exc)))


def _run_apply(report: dict[str, Any], refs: list[EvidenceRef]) -> None:
    for ref in refs:
        try:
            data = minio_service.leer_objeto_publico(ref.source_key or "")
            target_key = private_target_key(data, ref.source_key or "")
            created = _copy_verified(data, target_key)
            target_ref = f"{PRIVATE_PREFIX}{target_key}"
            _update_reference(ref, ref.value, target_ref)
            report["entries"].append(
                _entry(
                    ref,
                    "updated",
                    new_value=target_ref,
                    target_key=target_key,
                    sha256=hashlib.sha256(data).hexdigest(),
                    size=len(data),
                    object_created=created,
                )
            )
        except Exception as exc:
            report["errors"] += 1
            report["entries"].append(_entry(ref, "error", error=str(exc)))


def _run_rollback(manifest: dict[str, Any], report: dict[str, Any]) -> None:
    for entry in manifest.get("entries", []):
        if entry.get("status") != "updated":
            continue
        ref = EvidenceRef(
            entry["table"],
            int(entry["record_id"]),
            entry["field"],
            entry["value"],
            entry.get("source_key"),
        )
        try:
            _update_reference(ref, entry["new_value"], entry["value"])
            report["entries"].append(_entry(ref, "rolled_back", previous=entry["new_value"]))
        except Exception as exc:
            report["errors"] += 1
            report["entries"].append(_entry(ref, "conflict", error=str(exc)))


def _report_root() -> Path:
    configured = os.environ.get("NEODOMUS_EVIDENCE_REPORT_DIR")
    root = Path(configured).expanduser() if configured else DEFAULT_REPORT_ROOT
    return root.resolve()


def _restricted_report_path(path: Path) -> Path:
    """Resolve a user-supplied path and keep it inside the approved directory."""
    root = _report_root()
    candidate = path.expanduser().resolve()
    try:
        candidate.relative_to(root)
    except ValueError as exc:
        raise ValueError(
            f"Ruta fuera del directorio permitido para reportes: {root}"
        ) from exc
    return candidate


def _write_report(path: Path, report: dict[str, Any]) -> None:
    path = _restricted_report_path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    temporary.write_text(json.dumps(report, indent=2, ensure_ascii=False), encoding="utf-8")
    temporary.replace(path)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    action = parser.add_mutually_exclusive_group()
    action.add_argument("--apply", action="store_true", help="Copia archivos y actualiza referencias")
    action.add_argument("--rollback", type=Path, help="Restaura referencias desde un manifiesto de apply")
    parser.add_argument("--report", required=True, type=Path, help="Ruta restringida para el reporte JSON")
    args = parser.parse_args(argv)
    mode = "rollback" if args.rollback else "apply" if args.apply else "dry-run"
    report: dict[str, Any] = {
        "version": 1,
        "mode": mode,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "counts": {},
        "inventory": {},
        "entries": [],
        "errors": 0,
    }
    try:
        report_path = _restricted_report_path(args.report)
        manifest_path = _restricted_report_path(args.rollback) if args.rollback else None
        if manifest_path is not None and not manifest_path.is_file():
            raise ValueError(f"Manifiesto no encontrado: {manifest_path}")
        report["inventory"] = _storage_inventory()
        if manifest_path is not None:
            manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
            _run_rollback(manifest, report)
        else:
            refs = _fetch_refs()
            report["counts"] = _counts(refs)
            if args.apply:
                _run_apply(report, refs)
            else:
                _run_dry_run(report, refs)
        _write_report(report_path, report)
    except Exception as exc:
        print(f"Migración detenida: {exc}", file=sys.stderr)
        return 2
    print(
        f"Modo={mode}; referencias={report['counts'].get('referencias', 0)}; "
        f"errores={report['errors']}; reporte={report_path}"
    )
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
