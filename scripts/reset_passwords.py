"""
Resetea las contraseñas de TODOS los usuarios existentes (clientes y empleados)
con el patrón:

    12345678 + inicial del nombre en MAYÚSCULA + inicial del primer apellido
    en minúscula + "."

Ejemplos:
    LAURA GARCÍA ROJAS   ->  12345678Lg.
    CARLOS ANDRÉS GÓMEZ   ->  12345678Cg.

Solo se guarda el hash bcrypt (nunca texto plano). Es idempotente: puede
ejecutarse varias veces con el mismo resultado.

Al terminar regenera la sección "REGISTROS GUARDADOS AUTOMÁTICAMENTE"
de scripts/init_db.sql (vía respaldar_usuarios), de modo que el script
de init queda con las mismas contraseñas por patrón para TODOS los
usuarios y clientes.

Modo verificación (sin modificar nada):

    docker exec -it neodomus_api uv run python /app/scripts/reset_passwords.py --verificar

Uso (dentro del contenedor api):

    docker exec -it neodomus_api uv run python /app/scripts/reset_passwords.py
"""

from __future__ import annotations

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
from app.utils.respaldo_usuarios import respaldar_usuarios
from app.utils.security import hash_password, verify_password

PASSWORD_PREFIX = "12345678"


def password_de(first_name: str, last_name: str) -> str:
    nombre = (first_name or "").strip()
    apellido = (last_name or "").strip()
    inicial_nombre = (nombre[:1] or "").upper()
    primer_apellido = apellido.split()[0] if apellido else ""
    inicial_apellido = (primer_apellido[:1] or "").lower()
    return f"{PASSWORD_PREFIX}{inicial_nombre}{inicial_apellido}."


def run(mostrar_claves: bool = False, verificar: bool = False) -> int:
    """Resetea (o verifica con --verificar) las contraseñas de TODOS
    los usuarios y clientes. Retorna la cantidad de registros
    procesados."""
    procesados = 0
    with SessionLocal() as db:
        for entidad, tabla in ((Cliente, "clientes"), (User, "usuarios")):
            for registro in db.execute(select(entidad)).scalars():
                pwd = password_de(registro.first_name, registro.last_name)
                if verificar:
                    if not verify_password(pwd, registro.password_hash or ""):
                        print(
                            f"[NO COINCIDE] {tabla:10s} {registro.email} "
                            f"(se esperaba {pwd})"
                        )
                else:
                    registro.password_hash = hash_password(pwd)
                    procesados += 1
                    print(f"[actualizado] {tabla:10s} {registro.email} -> {pwd if mostrar_claves else ''}")
        if not verificar:
            db.commit()
            # Mantiene scripts/init_db.sql en sincronía: la sección
            # "REGISTROS GUARDADOS AUTOMÁTICAMENTE" se regenera con los
            # nuevos hashes, así quien importe init_db.sql entra con las
            # mismas contraseñas por patrón.
            if respaldar_usuarios():
                print("[respaldo] scripts/init_db.sql actualizado con los nuevos hashes")
    return procesados


if __name__ == "__main__":
    mostrar = "--mostrar-claves" in sys.argv or "-v" in sys.argv
    verificar = "--verificar" in sys.argv
    if verificar:
        run(verificar=True)
        print("\nVerificación finalizada (las líneas 'NO COINCIDE' son las que no siguen el patrón).")
    else:
        total = run(mostrar_claves=mostrar)
        print(f"\nContraseñas actualizadas: {total}")
