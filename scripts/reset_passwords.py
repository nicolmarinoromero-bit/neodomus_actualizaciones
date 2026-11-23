"""
Resetea las contraseñas de TODOS los usuarios existentes (clientes y empleados,
independientemente del rol) con el patrón:

    iniciales del correo (minúsculas) + 12345678

Las iniciales son la primera letra de cada segmento de la parte local del
correo (separada por puntos, guiones, guiones bajos o "+").

Ejemplos:
    carlos.andres.gomez@gmail.com  ->  cag12345678
    admin@neodomus.com             ->  a12345678
    demo001@example.com            ->  d12345678

Solo se guarda el hash bcrypt (nunca texto plano).
Es idempotente: puede ejecutarse varias veces con el mismo resultado.

Usa --forzar para reestablecer contraseñas en todos los usuarios (sobrescribe
las contraseñas ya establecidas). Sin --forzar solo afecta a los usuarios sin
contraseña.

Uso (dentro del contenedor api):

    docker exec -it neodomus_api uv run python /app/scripts/reset_passwords.py
    docker exec -it neodomus_api uv run python /app/scripts/reset_passwords.py --forzar
"""

from __future__ import annotations

import os
import re
import sys
from pathlib import Path


def _agregar_backend_al_path() -> None:
    candidatos = [
        Path.cwd(),
        Path(__file__).resolve().parent.parent / "be",
        Path(__file__).resolve().parent.parent,
        Path("/app"),
    ]
    for candidato in candidatos:
        ruta = str(candidato.resolve())
        if ruta not in sys.path:
            sys.path.insert(0, ruta)
        try:
            import app  # noqa: F401
            return
        except ImportError:
            continue


_agregar_backend_al_path()

from sqlalchemy import select

from app.database import SessionLocal
from app.models.cliente import Cliente
from app.models.user import User
from app.utils.security import hash_password

PASSWORD_SUFFIX = "12345678"


def iniciales_de_correo(email: str) -> str:
    """Extrae las iniciales de la parte local del correo (minúsculas).

    Toma la primera letra de cada segmento separado por ".", "-", "_" o "+".
    Ej: "carlos.andres.gomez" -> "cag"; "demo001" -> "d".
    """
    local = (email or "").split("@")[0].strip().lower()
    iniciales = []
    for parte in re.split(r"[._\-+]+", local):
        coincidencia = re.search(r"[a-z]", parte)
        if coincidencia:
            iniciales.append(coincidencia.group(0))
    return "".join(iniciales)


def password_temporal_de(email: str) -> str:
    """Construye la contraseña temporal: iniciales del correo + 12345678."""
    iniciales = iniciales_de_correo(email)
    return f"{iniciales}{PASSWORD_SUFFIX}"


def run(mostrar_claves: bool = False, forzar: bool = False) -> int:
    """
    Establece contraseñas temporales.

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
                pwd = password_temporal_de(registro.email)
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
