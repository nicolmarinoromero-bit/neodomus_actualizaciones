"""
Pruebas de la capa de persistencia: modelos SQLAlchemy sobre MySQL REAL.

Cubre, sin mocks:

* Lectura/escritura de los modelos principales: Cliente, User, Producto,
  Categoria, Tecnico, Pedido, Cita, Pago y Calificacion.
* Restricciones UNIQUE (email de cliente/usuario, documento, referencia de
  producto) y NOT NULL (usuarios.password_hash, usuarios.first_name)
  traducidas a ``IntegrityError`` por MySQL, y la sesión sigue usable
  después del ``rollback``.
* Claves foráneas: registro con id inexistente -> ``IntegrityError``, y una
  transacción con error deja la sesión sin datos parciales (rollback real).
* Relaciones declaradas: 1:N (pedido->cliente, pedido->detalles->producto,
  pago->pedido) y N:M (tecnico->especializaciones, producto->especializaciones).
* Cascadas reales definidas en las migraciones: ON DELETE CASCADE,
  ON DELETE SET NULL y FK sin cascade que BLOQUEAN el borrado.
* Valores por defecto y transiciones de ``is_active``, ``estado_pedido`` y
  ``estado`` de las citas.
* Transacciones: commit, rollback y visibilidad entre dos sesiones.

La infraestructura (conftest) limpia todas las tablas con TRUNCATE después
de cada test; aun así, los tests que dejan datos o una sesión sucia hacen
rollback/dejan la sesión en un estado limpio antes de terminar.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta

import pytest
from sqlalchemy import text
from sqlalchemy.exc import IntegrityError

from app.models.calificacion import Calificacion
from app.models.categoria import Categoria
from app.models.cita import Cita
from app.models.cliente import Cliente
from app.models.especializacion import Especializacion
from app.models.pago import Pago
from app.models.pedido import DetallePedido, Pedido
from app.models.producto import Producto
from app.models.tecnico import Tecnico
from app.models.user import User
from app.tests.factories import (
    crear_categoria,
    crear_cliente,
    crear_empleado,
    crear_producto,
    crear_tecnico,
)
from app.utils.security import hash_password


# ──────────────────────────────────────────────────────────────
# Helpers locales (datos mínimos válidos para cada modelo)
# ──────────────────────────────────────────────────────────────
def _cliente(**kw) -> Cliente:
    datos = dict(
        first_name="Modelo",
        last_name="Cliente",
        email="cliente.modelos@test.neodomus.com",
        password_hash=hash_password("Test1234!"),
        id_tipo_documento_c=1,
        documento_cliente=2100000001,
        telefono_cliente=3001112223,
        address="Cra 10 #12-34",
        is_active=True,
    )
    datos.update(kw)
    return Cliente(**datos)


def _usuario(**kw) -> User:
    datos = dict(
        first_name="Modelo",
        last_name="Usuario",
        email="usuario.modelos@test.neodomus.com",
        password_hash=hash_password("Test1234!"),
        id_rol_u=1,
        is_active=True,
    )
    datos.update(kw)
    return User(**datos)


def _cita(db, cliente: Cliente, **kw) -> Cita:
    """Cita mínima válida (los FK de citas son id_cliente y, opcionalmente,
    id_especializacion; id_tecnico NO es clave foránea en la BD)."""
    datos = dict(
        id_cliente=cliente.id_cliente,
        tipo_servicio="instalacion",
        fecha=date.today() + timedelta(days=1),
        hora="11:00",
        direccion="Cra 1 #2-3",
    )
    datos.update(kw)
    obj = Cita(**datos)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    db.commit()
    return obj


def _tab(db, sql: str, **params) -> int:
    """Ejecuta SQL crudo y confirma; devuelve filas afectadas."""
    result = db.execute(text(sql), params)
    db.commit()
    return result.rowcount


def _count(db, sql: str, **params) -> int:
    return int(db.execute(text(sql), params).scalar() or 0)


# ──────────────────────────────────────────────────────────────
# Lectura / escritura de los modelos
# ──────────────────────────────────────────────────────────────
def test_cliente_crear_leer_y_actualizar(db):
    """Cliente: alta, consulta por email y actualización persisten en MySQL."""
    alta = _cliente(email="cliente.crud@test.neodomus.com")
    db.add(alta)
    db.commit()
    db.refresh(alta)
    db.commit()

    leido = db.query(Cliente).filter(Cliente.email == "cliente.crud@test.neodomus.com").first()
    assert leido is not None
    assert leido.id_cliente == alta.id_cliente
    assert leido.is_active is True
    assert leido.created_at is not None  # server_default CURRENT_TIMESTAMP

    leido.last_name = "Actualizado"
    leido.is_active = False
    db.commit()
    db.expire_all()
    assert db.query(Cliente).get(alta.id_cliente).last_name == "Actualizado"
    assert db.query(Cliente).get(alta.id_cliente).is_active is False


def test_usuario_crear_leer_y_actualizar(db):
    """Empleado (tabla usuarios): alta con rol y actualización de campos."""
    alta = _usuario(email="usuario.crud@test.neodomus.com")
    db.add(alta)
    db.commit()
    db.refresh(alta)
    db.commit()

    leido = db.query(User).filter(User.email == "usuario.crud@test.neodomus.com").first()
    assert leido is not None
    assert leido.id_rol_u == 1  # administrador (catálogo sembrado)
    assert leido.password_reset_required is False  # server_default 0

    leido.is_active = False
    db.commit()
    db.expire_all()
    assert db.query(User).get(alta.id_usuario).is_active is False


def test_categoria_crear_leer_y_actualizar(db):
    cat = crear_categoria(db, nombre_categoria="Categoría modelos", descripcion="Para tests")
    leida = db.query(Categoria).filter(Categoria.id_categoria == cat.id_categoria).first()
    assert leida.nombre_categoria == "Categoría modelos"
    assert leida.descripcion == "Para tests"

    leida.descripcion = "Descripción nueva"
    db.commit()
    db.expire_all()
    assert db.query(Categoria).get(cat.id_categoria).descripcion == "Descripción nueva"


def test_producto_crear_leer_y_actualizar(db):
    cat = crear_categoria(db, nombre_categoria="Categoría producto")
    prod = crear_producto(
        db,
        nombre_producto="Termostato modelos",
        referencia_producto="REF-MODELOS-1",
        id_cate_pr=cat.id_categoria,
    )
    leido = db.query(Producto).filter(Producto.referencia_producto == "REF-MODELOS-1").first()
    assert leido is not None
    assert leido.id_cate_pr == cat.id_categoria
    assert leido.estado_producto == "activo"
    assert leido.stock_producto == 50

    leido.stock_producto = 12
    leido.estado_producto = "inactivo"
    db.commit()
    db.expire_all()
    recargado = db.query(Producto).get(prod.id_producto)
    assert recargado.stock_producto == 12
    assert recargado.estado_producto == "inactivo"


def test_tecnico_crear_y_leer(db):
    ficha = crear_tecnico(db, certificacion_t="Certificación ISO 9000")
    leida = db.query(Tecnico).filter(Tecnico.id_tecnico == ficha.id_tecnico).first()
    assert leida is not None
    assert leida.certificacion_t == "Certificación ISO 9000"
    assert leida.usuario is not None  # relación con la ficha de usuario
    assert leida.usuario.id_rol_u == 2  # rol técnico


def test_pedido_crear_leer_y_actualizar(db):
    cli = crear_cliente(db, email="pedido.modelos@test.neodomus.com")
    pedido = Pedido(id_cliente_pe=cli.id_cliente, total_pedido=150000.0, estado_pedido="Pagado")
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    db.commit()

    leido = db.query(Pedido).filter(Pedido.id_cliente_pe == cli.id_cliente).first()
    assert leido is not None
    # HALLAZGO (comportamiento ACTUAL): el modelo declara
    # server_default=func.now(), pero la migración 0001 creó la columna
    # `fecha_peedido DATETIME` SIN DEFAULT; el INSERT omite la columna y
    # MySQL almacena NULL. La fecha la rellena la capa de servicio.
    assert leido.fecha_peedido is None
    assert leido.total_pedido == 150000.0

    leido.estado_pedido = "Entregado"
    db.commit()
    db.expire_all()
    assert db.query(Pedido).get(pedido.id_pedido).estado_pedido == "Entregado"


def test_cita_crear_leer_y_actualizar(db):
    cli = crear_cliente(db, email="cita.modelos@test.neodomus.com")
    cita = _cita(db, cli)
    leida = db.query(Cita).filter(Cita.id_cliente == cli.id_cliente).first()
    assert leida is not None
    assert leida.estado == "Pendiente"  # valor por defecto del modelo
    assert leida.recordatorio_enviado is False  # server_default 0

    leida.estado = "Confirmada"
    db.commit()
    db.expire_all()
    assert db.query(Cita).get(cita.id_cita).estado == "Confirmada"


def test_pago_crear_leer_y_actualizar(db):
    cli = crear_cliente(db, email="pago.modelos@test.neodomus.com")
    pedido = Pedido(id_cliente_pe=cli.id_cliente, total_pedido=99000.0, estado_pedido="Pagado")
    db.add(pedido)
    db.commit()
    db.refresh(pedido)

    pago = Pago(id_pedido=pedido.id_pedido, metodo_pago="paypal", monto=99000.0)
    db.add(pago)
    db.commit()
    db.refresh(pago)
    db.commit()

    leido = db.query(Pago).filter(Pago.id_pedido == pedido.id_pedido).first()
    assert leido is not None
    assert leido.estado == "pendiente"  # valor por defecto
    assert leido.monto == 99000.0

    leido.estado = "aprobado"
    db.commit()
    db.expire_all()
    assert db.query(Pago).get(pago.id_pago).estado == "aprobado"


def test_calificacion_crear_leer(db):
    cli = crear_cliente(db, email="calif.modelos@test.neodomus.com")
    tec = crear_tecnico(db)
    cita = _cita(db, cli, id_tecnico=tec.id_tecnico)

    cal = Calificacion(
        id_cliente_c=cli.id_cliente,
        id_tecnico_c=tec.id_tecnico,
        id_cita_c=cita.id_cita,
        calificacion=5,
        comentario="Trabajo impecable",
    )
    db.add(cal)
    db.commit()
    db.refresh(cal)
    db.commit()

    leida = db.query(Calificacion).filter(Calificacion.id_cita_c == cita.id_cita).first()
    assert leida is not None
    assert leida.calificacion == 5
    assert leida.id_cliente_c == cli.id_cliente
    assert leida.id_tecnico_c == tec.id_tecnico
    assert leida.created_at is not None


# ──────────────────────────────────────────────────────────────
# Restricciones UNIQUE
# ──────────────────────────────────────────────────────────────
def test_email_cliente_duplicado_integrity_error_y_sesion_usable(db):
    """El UNIQUE de clientes.email dispara IntegrityError; tras el rollback
    la sesión sigue utilizándose normalmente."""
    db.add(_cliente(email="dup.cliente@test.neodomus.com"))
    db.commit()

    db.add(_cliente(email="dup.cliente@test.neodomus.com", documento_cliente=2100000002))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    # La sesión quedó usable: se puede consultar y escribir de nuevo.
    assert db.query(Cliente).filter(Cliente.email == "dup.cliente@test.neodomus.com").count() == 1
    db.add(_cliente(email="otro.cliente@test.neodomus.com", documento_cliente=2100000003))
    db.commit()
    assert db.query(Cliente).filter(Cliente.email == "otro.cliente@test.neodomus.com").count() == 1


def test_email_usuario_duplicado_integrity_error(db):
    db.add(_usuario(email="dup.usuario@test.neodomus.com"))
    db.commit()

    db.add(_usuario(email="dup.usuario@test.neodomus.com"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert db.query(User).filter(User.email == "dup.usuario@test.neodomus.com").count() == 1


def test_documento_cliente_duplicado_integrity_error(db):
    """clientes.documento_cliente es UNIQUE en la BD."""
    db.add(_cliente(email="doc.uno@test.neodomus.com", documento_cliente=2500000001))
    db.commit()

    db.add(_cliente(email="doc.dos@test.neodomus.com", documento_cliente=2500000001))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert db.query(Cliente).filter(Cliente.documento_cliente == 2500000001).count() == 1


def test_referencia_producto_duplicada_integrity_error(db):
    crear_producto(db, referencia_producto="REF-UNICA")
    db.add(
        Producto(
            nombre_producto="Otro producto",
            referencia_producto="REF-UNICA",
            precio_compra_producto=1000.0,
            precio_venta_producto=2000.0,
            stock_producto=1,
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert db.query(Producto).filter(Producto.referencia_producto == "REF-UNICA").count() == 1


# ──────────────────────────────────────────────────────────────
# NOT NULL
# ──────────────────────────────────────────────────────────────
def test_usuario_password_hash_nulo_integrity_error(db):
    """usuarios.password_hash es NOT NULL en la BD (INSERT con NULL falla)."""
    db.add(_usuario(email="sin.password@test.neodomus.com", password_hash=None))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert db.query(User).filter(User.email == "sin.password@test.neodomus.com").count() == 0


def test_usuario_first_name_nulo_integrity_error(db):
    """usuarios.first_name es NOT NULL en la BD."""
    db.add(_usuario(email="sin.nombre@test.neodomus.com", first_name=None))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert db.query(User).filter(User.email == "sin.nombre@test.neodomus.com").count() == 0


# ──────────────────────────────────────────────────────────────
# Claves foráneas y rollback de transacciones
# ──────────────────────────────────────────────────────────────
def test_pedido_con_cliente_inexistente_integrity_error(db):
    db.add(Pedido(id_cliente_pe=99999999, total_pedido=10.0, estado_pedido="Pagado"))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert _count(db, "SELECT COUNT(*) FROM pedidos WHERE id_cliente_pe = 99999999") == 0


def test_calificacion_con_cita_inexistente_integrity_error(db):
    cli = crear_cliente(db, email="calif.fk@test.neodomus.com")
    tec = crear_tecnico(db)
    db.add(
        Calificacion(
            id_cliente_c=cli.id_cliente,
            id_tecnico_c=tec.id_tecnico,
            id_cita_c=99999999,
            calificacion=3,
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()
    assert _count(db, "SELECT COUNT(*) FROM calificaciones WHERE id_cita_c = 99999999") == 0


def test_pago_con_pedido_inexistente_no_falla_sin_fk(db):
    """HALLAZGO: el modelo Pago declara ForeignKey('pedidos.id_pedido'), pero
    la migración 0002 creó `pagos.id_pedido` SOLO con un índice (sin
    constraint). Por eso MySQL NO valida ese id y el INSERT no falla.

    Se documenta el comportamiento ACTUAL: no hay integridad referencial en
    esa columna a nivel de BD (ver be/app/tests/hallazgos/)."""
    db.add(Pago(id_pedido=99999999, metodo_pago="paypal", monto=100.0))
    db.commit()  # no lanza IntegrityError: la FK no existe en MySQL

    guardado = db.query(Pago).filter(Pago.id_pedido == 99999999).first()
    assert guardado is not None
    assert guardado.estado == "pendiente"
    # Limpieza del dato inválido para no arrastrarlo a otros tests.
    db.delete(guardado)
    db.commit()


def test_transaccion_con_error_no_deja_datos_parciales(db):
    """Un INSERT válido + uno con FK inválida en la misma transacción:
    el commit falla y el rollback descarta también el INSERT válido."""
    db.add(_cliente(email="parcial.valido@test.neodomus.com"))
    db.flush()  # el INSERT del cliente ya ejecutó en la transacción

    db.add(Pedido(id_cliente_pe=99999999, total_pedido=50.0))
    with pytest.raises(IntegrityError):
        db.commit()
    db.rollback()

    assert db.query(Cliente).filter(
        Cliente.email == "parcial.valido@test.neodomus.com"
    ).count() == 0
    assert _count(db, "SELECT COUNT(*) FROM pedidos") == 0


# ──────────────────────────────────────────────────────────────
# Relaciones 1:N y N:M
# ──────────────────────────────────────────────────────────────
def test_relacion_pedido_cliente_n_a_1(db):
    """Pedido -> Cliente (muchos a uno). NOTA: Cliente NO declara la
    relación inversa `pedidos` (solo existe desde el lado de Pedido)."""
    cli = crear_cliente(db, email="rel.pedido@test.neodomus.com")
    for total in (1000.0, 2000.0):
        db.add(Pedido(id_cliente_pe=cli.id_cliente, total_pedido=total, estado_pedido="Pagado"))
    db.commit()

    pedidos = db.query(Pedido).filter(Pedido.id_cliente_pe == cli.id_cliente).all()
    assert len(pedidos) == 2
    assert all(p.cliente.id_cliente == cli.id_cliente for p in pedidos)
    assert pedidos[0].cliente.email == "rel.pedido@test.neodomus.com"
    assert not hasattr(Cliente, "pedidos"), (
        "El modelo Cliente no expone la relación inversa a pedidos"
    )


def test_relacion_pedido_detalles_producto(db):
    """Pedido -> DetallePedido (1:N) y DetallePedido -> Producto (N:1)."""
    cli = crear_cliente(db, email="rel.detalles@test.neodomus.com")
    prod = crear_producto(db, referencia_producto="REF-DETALLE")
    pedido = Pedido(id_cliente_pe=cli.id_cliente, total_pedido=40000.0, estado_pedido="Pagado")
    db.add(pedido)
    db.commit()
    db.refresh(pedido)

    detalle = DetallePedido(
        id_pedido_d=pedido.id_pedido,
        id_producto_d=prod.id_producto,
        cantidad_detalle=2,
        precio_unitario_detalle=20000.0,
        subtotal_detalle=40000.0,
        descripcion_detalle="Detalle de prueba",
    )
    db.add(detalle)
    db.commit()

    db.expire_all()
    pedido = db.query(Pedido).get(pedido.id_pedido)
    assert len(pedido.detalles) == 1
    assert pedido.detalles[0].producto.referencia_producto == "REF-DETALLE"
    assert pedido.detalles[0].subtotal_detalle == 40000.0


def test_relacion_producto_categoria(db):
    cat = crear_categoria(db, nombre_categoria="Categoría navegación")
    prod = crear_producto(db, referencia_producto="REF-CATEGORIA", id_cate_pr=cat.id_categoria)

    db.expire_all()
    leido = db.query(Producto).get(prod.id_producto)
    assert leido.categoria is not None
    assert leido.categoria.id_categoria == cat.id_categoria
    assert leido.categoria.nombre_categoria == "Categoría navegación"


def test_relacion_tecnico_especializaciones_muchos_a_muchos(db):
    """Tecnico <-> Especializacion por la tabla asociativa tecnico_especializacion
    (ondelete CASCADE en ambas columnas)."""
    tec = crear_tecnico(db)
    esp_a = Especializacion(nombre="Domótica")
    esp_b = Especializacion(nombre="Iluminación")
    db.add_all([esp_a, esp_b])
    db.commit()

    tec.especializaciones.extend([esp_a, esp_b])
    db.commit()

    assert _count(
        db,
        "SELECT COUNT(*) FROM tecnico_especializacion WHERE id_tecnico = :t",
        t=tec.id_tecnico,
    ) == 2
    db.expire_all()
    recargado = db.query(Tecnico).get(tec.id_tecnico)
    assert {e.nombre for e in recargado.especializaciones} == {"Domótica", "Iluminación"}


def test_relacion_producto_especializaciones_muchos_a_muchos(db):
    """Producto <-> Especializacion por la tabla asociativa producto_especializacion."""
    esp = Especializacion(nombre="Seguridad")
    db.add(esp)
    db.commit()
    prod = crear_producto(db, referencia_producto="REF-ESP")
    prod.especializaciones_requeridas.append(esp)
    db.commit()

    assert _count(
        db,
        "SELECT COUNT(*) FROM producto_especializacion WHERE id_producto = :p",
        p=prod.id_producto,
    ) == 1
    db.expire_all()
    recargado = db.query(Producto).get(prod.id_producto)
    assert [e.nombre for e in recargado.especializaciones_requeridas] == ["Seguridad"]


def test_relacion_pago_pedido(db):
    """Pago -> Pedido (relación ORM declarada; ver test de FK inexistente
    para el detalle de que la constraint no existe en MySQL)."""
    cli = crear_cliente(db, email="rel.pago@test.neodomus.com")
    pedido = Pedido(id_cliente_pe=cli.id_cliente, total_pedido=77000.0, estado_pedido="Pagado")
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    db.add(Pago(id_pedido=pedido.id_pedido, metodo_pago="tarjeta_credito", monto=77000.0))
    db.commit()

    db.expire_all()
    pago = db.query(Pago).filter(Pago.id_pedido == pedido.id_pedido).first()
    assert pago.pedido is not None
    assert pago.pedido.id_pedido == pedido.id_pedido
    assert pago.pedido.cliente.email == "rel.pago@test.neodomus.com"


# ──────────────────────────────────────────────────────────────
# Cascadas / ondelete reales (comportamiento de MySQL, no del ORM)
# ──────────────────────────────────────────────────────────────
def test_ondelete_cita_se_borra_con_su_cliente(db):
    """citas.id_cliente -> ON DELETE CASCADE (migración 0001)."""
    cli = crear_cliente(db, email="cascade.cita@test.neodomus.com")
    cita = _cita(db, cli)
    id_cita = cita.id_cita  # se guarda antes del DELETE (la fila ya no existirá)
    assert _count(db, "SELECT COUNT(*) FROM citas WHERE id_cita = :c", c=id_cita) == 1

    filas = _tab(db, "DELETE FROM clientes WHERE id_cliente = :i", i=cli.id_cliente)
    assert filas == 1
    assert _count(db, "SELECT COUNT(*) FROM citas WHERE id_cita = :c", c=id_cita) == 0


def test_ondelete_pedido_bloquea_borrado_del_cliente(db):
    """pedidos.id_cliente_pe NO tiene ON DELETE: la FK BLOQUEA el borrado
    (MySQL responde 1451 -> IntegrityError) y no se pierde ningún dato."""
    cli = crear_cliente(db, email="bloqueo.pedido@test.neodomus.com")
    db.add(Pedido(id_cliente_pe=cli.id_cliente, total_pedido=10.0, estado_pedido="Pagado"))
    db.commit()

    with pytest.raises(IntegrityError):
        db.execute(text("DELETE FROM clientes WHERE id_cliente = :i"), {"i": cli.id_cliente})
        db.commit()
    db.rollback()

    assert _count(db, "SELECT COUNT(*) FROM clientes WHERE id_cliente = :i", i=cli.id_cliente) == 1
    assert _count(db, "SELECT COUNT(*) FROM pedidos WHERE id_cliente_pe = :i", i=cli.id_cliente) == 1


def test_ondelete_borra_filas_asociadas_de_especializaciones(db):
    """tecnico_especializacion usa ON DELETE CASCADE en id_tecnico: al borrar
    el técnico desaparece la asociación pero el catálogo queda intacto.

    HALLAZGO (comportamiento ACTUAL): el borrado del técnico queda
    BLOQUEADO (MySQL 1451) mientras alguna fila lo referencie. La tabla
    `insumos` no tiene modelo SQLAlchemy, por lo que el TRUNCATE del
    conftest NO la limpia y sus 10 filas sembradas (migración 0001)
    apuntan a los técnicos 1..10: borrar cualquiera de esos técnicos
    falla. Por eso el técnico de este test se crea con id >= 11 y el
    bloqueo se reproduce además con una fila propia de `insumos`."""
    # El técnico nace con id >= 11 para no quedar referenciado por las
    # filas sembradas de insumos/servicios (ids 1..10).
    db.execute(text("ALTER TABLE tecnicos AUTO_INCREMENT = 11"))
    db.commit()

    tec = crear_tecnico(db)
    # El id se guarda en una variable: tras el DELETE la instancia ORM queda
    # expirada y leer `tec.id_tecnico` lanza ObjectDeletedError.
    id_tec = tec.id_tecnico
    assert id_tec >= 11
    esp = Especializacion(nombre="Climatización")
    db.add(esp)
    db.commit()
    tec.especializaciones.append(esp)
    db.commit()
    assert _count(
        db,
        "SELECT COUNT(*) FROM tecnico_especializacion WHERE id_tecnico = :t",
        t=id_tec,
    ) == 1

    # (1) HALLAZGO: una fila de `insumos` que referencie al técnico
    # bloquea el DELETE (FK sin ON DELETE, migración 0001).
    bloqueo = f"Insumo bloqueo {id_tec}"
    _tab(db, "DELETE FROM insumos WHERE nombre_insumo = :n", n=bloqueo)
    _tab(
        db,
        "INSERT INTO insumos (nombre_insumo, ubicacion_insumo, capacidad_insumo, "
        "id_tecnico_insumo) VALUES (:n, 'Bodega de prueba', 1, :t)",
        n=bloqueo,
        t=id_tec,
    )
    with pytest.raises(IntegrityError):
        db.execute(
            text("DELETE FROM tecnicos WHERE id_tecnico = :t"), {"t": id_tec}
        )
        db.commit()
    db.rollback()
    assert (
        _count(db, "SELECT COUNT(*) FROM tecnicos WHERE id_tecnico = :t", t=id_tec)
        == 1
    )

    # (2) Retirado el bloqueo, el borrado procede y la cascada limpia la
    # asociación sin tocar el catálogo de especializaciones.
    _tab(db, "DELETE FROM insumos WHERE nombre_insumo = :n", n=bloqueo)
    _tab(db, "DELETE FROM tecnicos WHERE id_tecnico = :t", t=id_tec)

    assert _count(
        db,
        "SELECT COUNT(*) FROM tecnico_especializacion WHERE id_tecnico = :t",
        t=id_tec,
    ) == 0
    assert db.query(Especializacion).filter(Especializacion.nombre == "Climatización").count() == 1


def test_ondelete_especializacion_pone_a_null_en_cita(db):
    """citas.id_especializacion -> ON DELETE SET NULL (migración 0025)."""
    cli = crear_cliente(db, email="setnull.cita@test.neodomus.com")
    esp = Especializacion(nombre="Control de acceso")
    db.add(esp)
    db.commit()
    cita = _cita(db, cli, id_especializacion=esp.id_especializacion)
    assert (
        _count(db, "SELECT COUNT(*) FROM citas WHERE id_cita = :c", c=cita.id_cita) == 1
    )

    _tab(db, "DELETE FROM especializaciones WHERE id_especializacion = :e", e=esp.id_especializacion)

    valor = db.execute(
        text("SELECT id_especializacion FROM citas WHERE id_cita = :c"), {"c": cita.id_cita}
    ).scalar()
    assert valor is None
    assert _count(db, "SELECT COUNT(*) FROM citas WHERE id_cita = :c", c=cita.id_cita) == 1


# ──────────────────────────────────────────────────────────────
# Soft delete / estados: defaults y transiciones a nivel de datos
# ──────────────────────────────────────────────────────────────
def test_is_active_defaults_y_transicion(db):
    """Cliente nace inactivo (default False del modelo y de la columna en
    la BD) y usuario activo (default True); el soft delete es una
    transición de la columna, no un borrado físico.

    Los objetos se crean SIN indicar `is_active` para leer el default real
    (el helper `_cliente`/`_usuario` fuerza is_active=True y ocultaría el
    comportamiento por defecto)."""
    cli = Cliente(
        first_name="Modelo",
        last_name="Cliente",
        email="activo.false@test.neodomus.com",
        password_hash=hash_password("Test1234!"),
        id_tipo_documento_c=1,
        documento_cliente=2600000001,
        telefono_cliente=3001112223,
        address="Cra 10 #12-34",
    )
    usr = User(
        first_name="Modelo",
        last_name="Usuario",
        email="activo.true@test.neodomus.com",
        password_hash=hash_password("Test1234!"),
        id_rol_u=1,
    )
    db.add_all([cli, usr])
    db.commit()
    db.refresh(cli)
    db.refresh(usr)
    db.commit()

    assert cli.is_active is False  # default del modelo/BD: FALSE
    assert usr.is_active is True  # default del modelo/BD: TRUE

    # "Borrado lógico": desactivar al usuario sin eliminar la fila.
    usr.is_active = False
    db.commit()
    db.expire_all()
    assert db.query(User).get(usr.id_usuario) is not None
    assert db.query(User).get(usr.id_usuario).is_active is False


def test_estado_pedido_sin_valor_por_defecto_y_transiciones(db):
    """HALLAZGO/estado actual: pedidos.estado_pedido NO tiene DEFAULT en la
    BD ni default en el modelo -> se guarda NULL hasta que la capa de
    servicio lo asigna. Las transiciones son texto libre (sin CHECK)."""
    cli = crear_cliente(db, email="estado.pedido@test.neodomus.com")
    pedido = Pedido(id_cliente_pe=cli.id_cliente, total_pedido=100.0)
    db.add(pedido)
    db.commit()
    db.refresh(pedido)
    db.commit()

    assert pedido.estado_pedido is None

    for estado in ("Pagado", "En preparación", "Entregado"):
        pedido.estado_pedido = estado
        db.commit()
        db.expire_all()
        assert db.query(Pedido).get(pedido.id_pedido).estado_pedido == estado


def test_estado_cita_default_y_transiciones(db):
    """Las citas nacen 'Pendiente' y admiten las transiciones del catálogo
    de estados (Pendiente -> Confirmada -> Finalizada / Cancelada)."""
    cli = crear_cliente(db, email="estado.cita@test.neodomus.com")
    cita = _cita(db, cli)
    assert cita.estado == "Pendiente"

    for estado in ("Confirmada", "Finalizada"):
        cita.estado = estado
        db.commit()
        db.expire_all()
        assert db.query(Cita).get(cita.id_cita).estado == estado


def test_producto_defaults_de_estado_y_visibilidad(db):
    """Defaults de catálogo: estado 'activo', stock 0, visible para clientes
    y venta por unidades (venta_por_metros = 0)."""
    prod = Producto(
        nombre_producto="Producto con defaults",
        referencia_producto="REF-DEFAULTS",
        precio_compra_producto=1000.0,
        precio_venta_producto=2000.0,
    )
    db.add(prod)
    db.commit()
    db.refresh(prod)
    db.commit()

    assert prod.estado_producto == "activo"
    assert prod.stock_producto == 0
    assert prod.visible_cliente is True
    assert prod.venta_por_metros == 0  # columna Integer: unidades, no metros
    assert prod.es_nuevo_producto is True
    assert prod.tiene_medidas is False


# ──────────────────────────────────────────────────────────────
# Transacciones: commit y rollback con sesión explícita
# ──────────────────────────────────────────────────────────────
def test_commit_persiste_y_rollback_descarta(db):
    """Commit deja el cambio en MySQL; el rollback de la sesión lo descarta."""
    persistido = _cliente(email="tx.commit@test.neodomus.com")
    db.add(persistido)
    db.commit()

    descartado = _cliente(email="tx.rollback@test.neodomus.com", documento_cliente=2100000099)
    db.add(descartado)
    db.flush()  # INSERT dentro de la transacción, aún sin commit
    assert (
        db.query(Cliente).filter(Cliente.email == "tx.rollback@test.neodomus.com").count() == 1
    )

    db.rollback()
    db.expire_all()

    assert (
        db.query(Cliente).filter(Cliente.email == "tx.rollback@test.neodomus.com").count() == 0
    )
    assert db.query(Cliente).filter(Cliente.email == "tx.commit@test.neodomus.com").count() == 1


def test_lo_no_commiteado_no_lo_ve_otra_sesion(db, db_session_factory):
    """Aislamiento de transacciones: otra sesión (REPEATABLE READ) no ve lo
    que no está commiteado y lo ve en cuanto hay commit."""
    otra = db_session_factory()
    try:
        assert otra.query(Cliente).count() == 0

        db.add(_cliente(email="visibilidad@test.neodomus.com"))
        db.flush()  # sin commit
        otra.rollback()  # cierra la instantánea anterior
        assert otra.query(Cliente).count() == 0

        db.commit()
        otra.rollback()
        assert otra.query(Cliente).count() == 1
    finally:
        otra.close()
        db.rollback()  # la sesión queda limpia para los tests siguientes
