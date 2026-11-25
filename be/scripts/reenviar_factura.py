"""Reenvío de UNA factura específica por correo (herramienta operativa).

Uso (dentro del contenedor del API):
    python scripts/reenviar_factura.py <numero_factura> [--para <email>] [--forzar]

- Reutiliza pedidos_service._enviar_factura (misma generación de PDF y
  mensaje que el flujo de compra).
- Idempotente: si la factura ya está marcada enviada_por_correo=1, NO hace
  nada salvo que se pase --forzar (reenvío explícito).
- Atomicidad: el flag enviada_por_correo se marca SOLO si el envío retorna
  exitoso (igual que el flujo original).
- --para: envía a otra dirección (por defecto, el correo del comprador).
- Si el proveedor de correo no está configurado, el script falla con el
  diagnóstico del propio backend (no inventa configuraciones).
"""
from __future__ import annotations

import argparse
import asyncio
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models.cliente import Cliente  # noqa: E402
from app.models.factura import Factura  # noqa: E402
from app.models.user import User  # noqa: E402
from app.services.pedidos_service import _enviar_factura  # noqa: E402


async def reenviar(numero_factura: str, para: str | None, forzar: bool) -> int:
    with SessionLocal() as db:
        factura = (
            db.query(Factura).filter(Factura.numero_factura == numero_factura).first()
        )
        if factura is None:
            print(f"ERROR: no existe la factura {numero_factura}")
            return 2
        pedido = factura.pedido
        cliente = None
        if pedido is not None and pedido.id_cliente_pe:
            cliente = db.query(Cliente).filter(Cliente.id_cliente == pedido.id_cliente_pe).first()
        if cliente is None:
            # Facturas de citas/servicios: el pedido puede no existir; el
            # comprador queda en la factura via pedido o se pasa --para.
            print("ERROR: la factura no tiene pedido/cliente asociado; usa --para <email>")
            return 2

        destino = para or cliente.email
        if factura.enviada_por_correo and not forzar:
            print(
                f"YA_ENVIADA: {numero_factura} tiene enviada_por_correo=1 "
                f"(destino original {cliente.email}). Usa --forzar para reenviar."
            )
            return 0

        print(f"Reenviando {numero_factura} a {destino} (pedido {pedido.id_pedido})…")
        await _enviar_factura(db, factura, pedido, cliente)
        db.expire(factura)
        db.refresh(factura)
        if factura.enviada_por_correo:
            print(f"REENVIADA_OK: enviada_por_correo=1 (destino {destino})")
            return 0
        print(
            "REENVIO_FALLIDO: el envío no retornó exitoso (revisa los logs del "
            "backend: [email] …). El flag NO se marcó; se puede reintentar."
        )
        return 1


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("numero_factura")
    parser.add_argument("--para", help="correo destino distinto al del comprador")
    parser.add_argument("--forzar", action="store_true", help="reenvía aunque ya esté marcada")
    args = parser.parse_args()
    return asyncio.run(reenviar(args.numero_factura, args.para, args.forzar))


if __name__ == "__main__":
    sys.exit(main())
