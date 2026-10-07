"""
Fábricas y helpers reutilizables de datos de prueba.

Todos los objetos generados usan emails/refs únicos (hash del kwargs) para
evitar colisiones UNIQUE entre tests. Las contraseñas siempre son de prueba
("Test1234!") — nunca secretos reales.

Uso en tests:

    from app.tests.factories import (
        crear_cliente, crear_empleado, crear_tecnico,
        crear_categoria, crear_producto, auth_headers, login,
    )
"""

from __future__ import annotations

from app.utils.security import hash_password


def crear_cliente(db, **kw):
    """Cliente activo con perfil completo por defecto."""
    from app.models.cliente import Cliente

    semilla = abs(hash(str(kw))) % 10 ** 8
    datos = dict(
        first_name="Prueba",
        last_name="Cliente",
        email=f"cliente.{semilla}@test.neodomus.com",
        password_hash=hash_password("Test1234!"),
        id_tipo_documento_c=1,
        documento_cliente=1000000000 + semilla,
        telefono_cliente=3001234567,
        address="Cra 10 #12-34",
        is_active=True,
    )
    datos.update(kw)
    obj = Cliente(**datos)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    # refresh() deja abierta una transacción de lectura (REPEATABLE READ en
    # MySQL); se cierra para que escrituras de background tasks (otra
    # conexión) sean visibles a consultas posteriores.
    db.commit()
    return obj


def crear_empleado(db, rol="administrador", **kw):
    """Empleado (tabla usuarios) con el rol indicado ('administrador' o
    'tecnico'). Sobrescribe cualquier campo con kwargs, p. ej.
    id_rol_u=None o is_active=False."""
    from app.models.user import User
    from app.models.roles_usuario import RolesUsuario

    rol_row = (
        db.query(RolesUsuario)
        .filter(RolesUsuario.nombre_rol.ilike(f"%{rol}%"))
        .first()
    )
    semilla = abs(hash(str(kw))) % 10 ** 8
    datos = dict(
        first_name="Prueba",
        last_name="Empleado",
        email=f"empleado.{semilla}@test.neodomus.com",
        password_hash=hash_password("Test1234!"),
        id_rol_u=rol_row.id_rol if rol_row else 1,
        is_active=True,
    )
    datos.update(kw)
    obj = User(**datos)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    db.commit()
    return obj


def crear_tecnico(db, usuario=None, **kw):
    """Ficha técnica; si no se pasa `usuario`, crea un empleado con rol
    técnico. Retorna la ficha Tecnico."""
    from app.models.tecnico import Tecnico

    if usuario is None:
        usuario = crear_empleado(db, rol="tecnico")
    datos = dict(id_usuario_t=usuario.id_usuario, certificacion_t="Certificación de prueba")
    datos.update(kw)
    obj = Tecnico(**datos)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    db.commit()
    return obj


def crear_categoria(db, **kw):
    from app.models.categoria import Categoria

    semilla = abs(hash(str(kw))) % 10 ** 8
    datos = dict(nombre_categoria=f"Categoría {semilla}")
    datos.update(kw)
    obj = Categoria(**datos)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    db.commit()
    return obj


def crear_producto(db, **kw):
    """Producto activo y visible por defecto (apto para catálogo público)."""
    from app.models.producto import Producto

    semilla = abs(hash(str(kw))) % 10 ** 8
    datos = dict(
        nombre_producto=f"Producto {semilla}",
        referencia_producto=f"REF-{semilla}",
        precio_compra_producto=10000.0,
        precio_venta_producto=20000.0,
        stock_producto=50,
        estado_producto="activo",
        visible_cliente=True,
    )
    datos.update(kw)
    obj = Producto(**datos)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    db.commit()
    return obj


# ──────────────────────────────────────────────────────────────
# Helpers de autenticación (login real contra la API)
# ──────────────────────────────────────────────────────────────
async def login(client, email: str, password: str, user_type: str) -> dict:
    """POST /auth/login; falla con assert si no devuelve 200."""
    resp = await client.post(
        "/api/v1/auth/login",
        json={"email": email, "password": password, "user_type": user_type},
    )
    assert resp.status_code == 200, resp.text
    return resp.json()


def auth_headers(tokens: dict) -> dict:
    return {"Authorization": f"Bearer {tokens['access_token']}"}
