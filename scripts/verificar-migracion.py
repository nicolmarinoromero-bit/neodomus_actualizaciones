#!/usr/bin/env python3
"""Compara conteos exactos y huellas SHA-256 de tablas entre dos SQLAlchemy URLs."""

from __future__ import annotations

import hashlib
import json
import os
import sys
from datetime import date, datetime, time
from decimal import Decimal

from sqlalchemy import MetaData, create_engine, func, select


def canonical(value):
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return format(value.normalize(), "f")
    if isinstance(value, bytes):
        return {"bytes_sha256": hashlib.sha256(value).hexdigest(), "length": len(value)}
    if isinstance(value, dict):
        return {str(key): canonical(item) for key, item in sorted(value.items(), key=lambda pair: str(pair[0]))}
    if isinstance(value, (list, tuple)):
        return [canonical(item) for item in value]
    return value


def inventory(url: str) -> dict[str, tuple[int, str]]:
    engine = create_engine(url, pool_pre_ping=True)
    metadata = MetaData()
    try:
        metadata.reflect(bind=engine)
        report = {}
        with engine.connect() as connection:
            for table in sorted(metadata.tables.values(), key=lambda item: item.fullname):
                statement = select(table)
                primary_keys = list(table.primary_key.columns)
                if primary_keys:
                    statement = statement.order_by(*primary_keys)
                count = connection.scalar(select(func.count()).select_from(table))
                digest = hashlib.sha256()
                fallback_rows = []
                for row in connection.execute(statement).mappings():
                    payload = json.dumps(
                        [canonical(row[column.name]) for column in table.columns],
                        ensure_ascii=False,
                        sort_keys=True,
                        separators=(",", ":"),
                    ).encode("utf-8")
                    if primary_keys:
                        digest.update(payload + b"\n")
                    else:
                        fallback_rows.append(hashlib.sha256(payload).digest())
                if not primary_keys:
                    for row_hash in sorted(fallback_rows):
                        digest.update(row_hash + b"\n")
                # El esquema por defecto suele llamarse distinto entre MySQL y
                # PostgreSQL; la comparación se realiza por nombre de tabla.
                report[table.name] = (int(count or 0), digest.hexdigest())
        return report
    finally:
        engine.dispose()


def main() -> int:
    source_url = os.environ.get("SOURCE_DATABASE_URL", "")
    target_url = os.environ.get("TARGET_DATABASE_URL", "")
    if not source_url or not target_url:
        print("ERROR: define SOURCE_DATABASE_URL y TARGET_DATABASE_URL.", file=sys.stderr)
        return 2
    try:
        source, target = inventory(source_url), inventory(target_url)
    except Exception as exc:
        # No se imprime la excepción: controladores pueden incluir URL/credenciales.
        print(f"ERROR: no fue posible leer ambas bases ({type(exc).__name__}).", file=sys.stderr)
        return 2

    mismatches = []
    for name in sorted(source.keys() | target.keys()):
        left, right = source.get(name), target.get(name)
        match = left == right
        print(
            f"{'OK' if match else 'DIFERENCIA'} {name}: "
            f"origen={left[0] if left else 'tabla ausente'} / "
            f"destino={right[0] if right else 'tabla ausente'}; "
            f"sha256_origen={left[1] if left else '-'}; "
            f"sha256_destino={right[1] if right else '-'}"
        )
        if not match:
            mismatches.append(name)
    if mismatches:
        print(f"Verificación no conforme: {len(mismatches)} tabla(s) difieren.")
        return 1
    print(f"Verificación conforme: {len(source)} tabla(s), conteos y SHA-256 coinciden.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
