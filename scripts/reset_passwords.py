"""
Resetea las contraseñas de usuarios existentes (clientes y empleados)
con contraseñas ALEATORIAS (secrets.token_urlsafe), nunca predecibles.

- Cada contraseña se genera aleatoriamente por usuario (≈18 caracteres).
- El script solo se ejecuta en desarrollo (aborta en otros entornos sin
  --forzar) y NUNCA debe usarse en producción.
- Solo se guarda el hash bcrypt (nunca texto plano).
- --mostrar-claves imprime la contraseña temporal UNA vez, para entrega
  directa al usuario; quien la capture es responsable de repartirla.
- Idempotente: se puede reejecutar; cada usuario sin contraseña recibe una
  aleatoria nueva.

Uso (dentro del contenedor api):

    python scripts/reset_passwords.py [--mostrar-claves] [--forzar]
"""

from __future__ import annotations

import os
import secrets
import sys
from pathlib import Path

sys.path.append(str(Path(__file__).resolve().parent.parent))

from sqlalchemy import select

from app.database import SessionLocal
from app.models.cliente import Cliente
from app.models.user import User
from app.utils.security import hash_password


def generar_password_temporal() -> str:
    """Contraseña temporal aleatoria e impredecible (~18 caracteres)."""
    return secrets.token_urlsafe(12)


def run(mostrar_claves: bool = False, forzar: bool = False) -> int:
    """
    Establece contraseñas temporales aleatorias.

    - Si forzar=False (por defecto): solo establece contraseña en usuarios
      que actualmente tienen password_hash nulo o vacío (no sobrescribe
      contraseñas ya establecidas por los usuarios).
    - Si forzar=True: reestablece contraseña en TODOS los usuarios.
    """
    actualizados = 0
    omitidos = 0
    with SessionLocal() as db:
        for entidad, tabla in ((Cliente, "clientes"), (User, "empleados")):
            for registro in db.execute(select(entidad)).scalars():
                # Si no se fuerza, saltar usuarios que ya tienen contraseña establecida
                if not forzar and registro.password_hash:
                    omitidos += 1
                    continue
                pwd = generar_password_temporal()
                registro.password_hash = hash_password(pwd)
                actualizados += 1
                print(f"[actualizado] {tabla:10s} {registro.email} -> {pwd if mostrar_claves else ''}")
        db.commit()
    if omitidos:
        print(f"[omitidos] {omitidos} usuarios ya tienen contraseña establecida (usa --forzar para sobrescribir).")
    return actualizados


if __name__ == "__main__":
    mostrar = "--mostrar-claves" in sys.argv or "-v" in sys.argv
    forzar = "--forzar" in sys.argv
    # En entornos no desarrollo, abortar a menos que se use --forzar explícitamente
    if os.getenv("ENVIRONMENT", "development") != "development" and not forzar:
        print("ABORTA: este script solo debe ejecutarse en entorno de desarrollo. "
              "Usa --forzar para sobreescribir en otros entornos.")
        sys.exit(1)
    total = run(mostrar_claves=mostrar, forzar=forzar)
    print(f"\nContraseñas actualizadas: {total}")
