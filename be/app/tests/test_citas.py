"""
Pruebas del router de citas (`/api/v1/citas`).

Cubre la creación de citas como cliente (métodos de pago reales del
simulador, validaciones de fecha/hora/franja/tarifa/técnico), `mis-citas`,
la visión de administrador (`all-admin`, PUT admin, reasignación,
historial, técnicos disponibles), horas-disponibles y técnico-ocupado,
reagendamiento/cancelación de la cita propia y los productos asociados a
una cita (admin o técnico asignado).

Se ejecuta con la infraestructura de `conftest.py`: BD de pruebas, SMTP
apagado y MinIO simulado.
"""

from __future__ import annotations

from datetime import date, datetime, time, timedelta

import pytest

from app.models.cita import Cita
from app.models.cita_producto import CitaProducto
from app.models.pedido import Pedido
from app.models.producto_variante import ProductoVariante
from app.models.tarifa_servicio import TarifaServicio
from app.tests.factories import (
    auth_headers,
    crear_cliente,
    crear_empleado,
    crear_producto,
    crear_tecnico,
)

API = "/api/v1/citas"

# Franjas reales de inicio (app/services/especialidades.py: 08, 11, 14, 17).
FRANJAS = ("08:00", "11:00", "14:00", "17:00")
COSTO_TARIFA = 150000.0


# ──────────────────────────────────────────────────────────────
# Helpers locales
# ──────────────────────────────────────────────────────────────
def _fecha_futura_laboral(dias: int = 10) -> date:
    """Fecha futura de lunes a sábado (los domingos no se agendan)."""
    d = date.today() + timedelta(days=dias)
    while d.weekday() == 6:
        d += timedelta(days=1)
    return d


def _crear_tarifa(db, tipo_servicio: str = "instalacion", costo: float = COSTO_TARIFA):
    """Tarifa fija obligatoria para poder agendar ese tipo de servicio."""
    tarifa = TarifaServicio(
        tipo_servicio=tipo_servicio.strip().lower(),
        costo=costo,
        descripcion="Tarifa de prueba",
    )
    db.add(tarifa)
    db.commit()
    db.refresh(tarifa)
    db.commit()
    return tarifa


def _crear_cita(db, cliente, **kw) -> Cita:
    """Cita directa en BD (para estados/franjas que la API no permite)."""
    datos = dict(
        id_cliente=cliente.id_cliente,
        tipo_servicio="instalacion",
        fecha=_fecha_futura_laboral(),
        hora="08:00",
        direccion="Cra 10 #12-34",
        descripcion="Cita de prueba",
        estado="Confirmada",
        costo_cita=COSTO_TARIFA,
    )
    datos.update(kw)
    cita = Cita(**datos)
    db.add(cita)
    db.commit()
    db.refresh(cita)
    db.commit()
    return cita


def _body_cita(fecha: date, hora: str = "08:00", **extra) -> dict:
    """Cuerpo válido de POST /citas (PayPal simulado por defecto)."""
    cuerpo = {
        "tipo_servicio": "instalacion",
        "fecha": fecha.isoformat(),
        "hora": hora,
        "direccion": "Cra 10 #12-34",
        "descripcion": "Instalación de prueba",
        "metodo_pago": "paypal",
        "datos_pago": {"correo_paypal": "cliente.pagos@test.neodomus.com"},
    }
    cuerpo.update(extra)
    return cuerpo


def _franja_dentro_de_3_horas() -> str | None:
    """Primera franja de HOY que ya no cumple la anticipación de 3 h
    (None si todavía no se incumple: entre 00:00 y 05:00)."""
    ahora = datetime.now()
    for hora in FRANJAS:
        candidata = datetime.combine(date.today(), time(int(hora[:2])))
        if candidata <= ahora + timedelta(hours=3):
            return hora
    return None


# Contador para emails/documentos únicos dentro de la misma corrida.
_nuevo = 0


def _siguiente() -> int:
    global _nuevo
    _nuevo += 1
    return _nuevo


def _cliente_unico(db, **kw):
    """Cliente con email/documento únicos.

    Las factories derivan el email del hash de los kwargs: llamar a
    `_cliente_unico(db)` sin kwargs produce siempre el mismo email y choca
    con el UNIQUE del cliente del fixture `cliente_logueado` (mismo
    criterio que `_otro_cliente` en test_pedidos.py).
    """
    n = _siguiente()
    kw.setdefault("first_name", f"Anonimo{n}")
    kw.setdefault("email", f"cliente.cita{n}@test.neodomus.com")
    kw.setdefault("documento_cliente", 5000000000 + n)
    return crear_cliente(db, **kw)


def _tecnico_unico(db):
    """Técnico con ficha y usuario propios de email único.

    Los fixtures `admin_logueado` y `tecnico_logueado` crean su empleado
    con las mismas kwargs por defecto, por lo que no pueden combinarse en
    un mismo test (colisión de email UNIQUE); aquí se evita esa colisión.
    """
    n = _siguiente()
    usuario = crear_empleado(
        db, rol="tecnico", email=f"tecnico.cita{n}@test.neodomus.com"
    )
    return crear_tecnico(db, usuario=usuario)


# ──────────────────────────────────────────────────────────────
# POST /citas — crear cita como cliente
# ──────────────────────────────────────────────────────────────
async def test_crear_cita_sin_token_401(client):
    """Sin token la API responde 401."""
    resp = await client.post(API, json=_body_cita(_fecha_futura_laboral()))
    assert resp.status_code == 401


async def test_crear_cita_con_token_de_empleado_401(client, tecnico_logueado):
    """Un empleado (técnico) no puede agendar como cliente: 401."""
    _, _, tokens = tecnico_logueado
    resp = await client.post(
        API,
        json=_body_cita(_fecha_futura_laboral()),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 401


async def test_crear_cita_campos_requeridos_422(client, cliente_logueado):
    """Cada campo obligatorio del esquema responde 422 si falta."""
    _, tokens = cliente_logueado
    fecha = _fecha_futura_laboral()
    for campo in ("tipo_servicio", "fecha", "hora", "direccion", "metodo_pago"):
        cuerpo = _body_cita(fecha)
        del cuerpo[campo]
        resp = await client.post(API, json=cuerpo, headers=auth_headers(tokens))
        assert resp.status_code == 422, f"falta {campo}: {resp.text}"


async def test_crear_cita_fecha_anterior_a_hoy_400(client, cliente_logueado):
    """No se pueden agendar citas en fechas pasadas."""
    _, tokens = cliente_logueado
    resp = await client.post(
        API,
        json=_body_cita(date.today() - timedelta(days=1)),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "no puede ser anterior a hoy" in resp.json()["detail"]


async def test_crear_cita_domingo_400(client, cliente_logueado):
    """Los domingos no son día laboral para agendar."""
    _, tokens = cliente_logueado
    domingo = date.today() + timedelta(days=1)
    while domingo.weekday() != 6:
        domingo += timedelta(days=1)

    resp = await client.post(
        API, json=_body_cita(domingo), headers=auth_headers(tokens)
    )
    assert resp.status_code == 400
    assert "lunes a sábado" in resp.json()["detail"]


async def test_crear_cita_hora_fuera_de_franja_400(client, cliente_logueado):
    """Solo se admiten las franjas de inicio 08:00, 11:00, 14:00 y 17:00."""
    _, tokens = cliente_logueado
    resp = await client.post(
        API,
        json=_body_cita(_fecha_futura_laboral(), hora="10:00"),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "franja" in resp.json()["detail"]


async def test_crear_cita_sin_tarifa_400(client, cliente_logueado):
    """Sin tarifa configurada para el servicio no se puede agendar."""
    _, tokens = cliente_logueado
    resp = await client.post(
        API,
        json=_body_cita(_fecha_futura_laboral(), tipo_servicio="reparacion"),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "tarifa" in resp.json()["detail"].lower()


async def test_crear_cita_metodo_pago_en_blanco_400(client, db, cliente_logueado):
    """`metodo_pago` viene en el esquema pero vacío → 400 de negocio."""
    _, tokens = cliente_logueado
    _crear_tarifa(db)
    resp = await client.post(
        API,
        json=_body_cita(_fecha_futura_laboral(), metodo_pago=""),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "método de pago" in resp.json()["detail"].lower()


async def test_crear_cita_metodo_pago_no_soportado_400(client, db, cliente_logueado):
    """El simulador solo acepta tarjeta_debito/tarjeta_credito/pse/paypal/
    punto_pago."""
    _, tokens = cliente_logueado
    _crear_tarifa(db)
    resp = await client.post(
        API,
        json=_body_cita(_fecha_futura_laboral(), metodo_pago="efectivo"),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Método de pago no soportado"


async def test_crear_cita_tecnico_inexistente_400(client, db, cliente_logueado):
    """El técnico debe existir, estar activo y tener rol técnico."""
    _, tokens = cliente_logueado
    _crear_tarifa(db)
    resp = await client.post(
        API,
        json=_body_cita(_fecha_futura_laboral(), id_tecnico=999999),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "no existe o no está activo" in resp.json()["detail"]


async def test_crear_cita_franja_ocupada_400(client, db, cliente_logueado):
    """Una fecha+hora solo puede reservarla un cliente a la vez."""
    _, tokens = cliente_logueado
    _crear_tarifa(db)
    fecha = _fecha_futura_laboral()

    primera = await client.post(
        API, json=_body_cita(fecha), headers=auth_headers(tokens)
    )
    assert primera.status_code == 200

    segunda = await client.post(
        API, json=_body_cita(fecha), headers=auth_headers(tokens)
    )
    assert segunda.status_code == 400
    assert "ya fue reservada" in segunda.json()["detail"]


async def test_crear_cita_tecnico_ocupado_400(
    client, db, cliente_logueado, tecnico_logueado
):
    """El técnico con una entrega (Pedido) activa en la franja no puede
    agendar ahí, aunque la franja siga libre para otros clientes."""
    _, ficha, _ = tecnico_logueado
    cliente, tokens = cliente_logueado
    _crear_tarifa(db)
    fecha = _fecha_futura_laboral()
    # HALLAZGO: si el bloqueo viniera de otra cita, `slot_tomado` se
    # valida antes que `tecnico_ocupado` y respondería "Esa fecha y hora
    # ya fue reservada por otro cliente"; la rama "el técnico seleccionado
    # no está disponible" solo se alcanza cuando el conflicto viene de una
    # entrega (Pedido), que `slot_tomado` no considera.
    db.add(
        Pedido(
            id_cliente_pe=cliente.id_cliente,
            fecha_peedido=datetime.now(),
            total_pedido=50000.0,
            estado_pedido="Pagado",
            fecha_entrega=fecha,
            hora_entrega="11:00",
            hora_entrega_fin="12:00",
            id_tecnico_entrega=ficha.id_tecnico,
            nombre_tecnico_entrega="Técnico ocupado",
            estado_entrega="Asignada",
        )
    )
    db.commit()

    resp = await client.post(
        API,
        json=_body_cita(fecha, hora="11:00", id_tecnico=ficha.id_tecnico),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "no está disponible en esa fecha y hora" in resp.json()["detail"]


async def test_crear_cita_exito_paypal(client, db, cliente_logueado):
    """Cita válida con PayPal simulado: 200, estado Confirmada y pago
    aprobado con el costo de la tarifa."""
    cliente, tokens = cliente_logueado
    _crear_tarifa(db)
    fecha = _fecha_futura_laboral()

    resp = await client.post(
        API, json=_body_cita(fecha, hora="11:00"), headers=auth_headers(tokens)
    )
    assert resp.status_code == 200, resp.text
    cuerpo = resp.json()
    assert cuerpo["id_cita"]
    assert cuerpo["id_cliente"] == cliente.id_cliente
    assert cuerpo["estado"] == "Confirmada"
    assert cuerpo["estado_pago"] == "aprobado"
    assert cuerpo["metodo_pago"] == "paypal"
    assert float(cuerpo["costo_cita"]) == COSTO_TARIFA
    assert cuerpo["redirect_url"] is None
    assert cuerpo["fecha"] == fecha.isoformat()


async def test_crear_cita_exito_punto_pago_pendiente(client, db, cliente_logueado):
    """Punto de pago (Efecty/Servientrega) deja el pago PENDIENTE."""
    _, tokens = cliente_logueado
    _crear_tarifa(db)

    resp = await client.post(
        API,
        json=_body_cita(
            _fecha_futura_laboral(),
            hora="14:00",
            metodo_pago="punto_pago",
            datos_pago={"punto_pago": "Efecty"},
        ),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["estado_pago"] == "pendiente"


async def test_crear_cita_tarjeta_invalida_400(client, db, cliente_logueado):
    """Los datos de tarjeta se validan en la pasarela simulada (400)."""
    _, tokens = cliente_logueado
    _crear_tarifa(db)
    resp = await client.post(
        API,
        json=_body_cita(
            _fecha_futura_laboral(),
            hora="17:00",
            metodo_pago="tarjeta_credito",
            datos_pago={"numero": "1111", "titular": "Cliente", "expiracion": "12/30", "cvv": "123"},
        ),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400


async def test_crear_cita_con_menos_de_3_horas_400(client, db, cliente_logueado):
    """Las citas exigen al menos 3 horas de anticipación (código 400)."""
    _, tokens = cliente_logueado
    _crear_tarifa(db)
    hora = _franja_dentro_de_3_horas()
    if hora is None:
        pytest.skip("Todavía no hay franja de hoy fuera de la ventana de 3 h")

    resp = await client.post(
        API,
        json=_body_cita(date.today(), hora=hora),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "3 horas" in resp.json()["detail"]


# ──────────────────────────────────────────────────────────────
# GET /citas/mis-citas
# ──────────────────────────────────────────────────────────────
async def test_mis_citas_sin_token_401(client):
    resp = await client.get(f"{API}/mis-citas")
    assert resp.status_code == 401


async def test_mis_citas_con_token_de_empleado_401(client, tecnico_logueado):
    _, _, tokens = tecnico_logueado
    resp = await client.get(f"{API}/mis-citas", headers=auth_headers(tokens))
    assert resp.status_code == 401


async def test_mis_citas_solo_las_propias(client, db, cliente_logueado):
    """Un cliente solo ve sus citas (las de otros no aparecen)."""
    cliente, tokens = cliente_logueado
    propia = _crear_cita(db, cliente)
    ajena = _crear_cita(db, _cliente_unico(db), hora="11:00")
    del ajena

    resp = await client.get(f"{API}/mis-citas", headers=auth_headers(tokens))
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert [c["id_cita"] for c in cuerpo] == [propia.id_cita]
    assert cuerpo[0]["tecnico_nombre"] is None or "tecnico_nombre" in cuerpo[0]
    assert "password_hash" not in resp.text


# ──────────────────────────────────────────────────────────────
# GET /citas/all-admin — visión de administración
# ──────────────────────────────────────────────────────────────
async def test_listar_citas_admin_sin_token_401(client):
    resp = await client.get(f"{API}/all-admin")
    assert resp.status_code == 401


async def test_listar_citas_admin_cliente_401(client, cliente_logueado):
    """El cliente NO administra citas: el código responde 401 (no 403),
    para que el frontend cierre sesión (ver hallazgos)."""
    _, tokens = cliente_logueado
    resp = await client.get(f"{API}/all-admin", headers=auth_headers(tokens))
    assert resp.status_code == 401


async def test_listar_citas_admin_tecnico_403(client, tecnico_logueado):
    _, _, tokens = tecnico_logueado
    resp = await client.get(f"{API}/all-admin", headers=auth_headers(tokens))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Permisos insuficientes"


async def test_listar_citas_admin_incluye_datos_del_cliente(client, db, admin_logueado):
    _, tokens = admin_logueado
    cliente = _cliente_unico(db)
    cita = _crear_cita(db, cliente)

    resp = await client.get(f"{API}/all-admin", headers=auth_headers(tokens))
    assert resp.status_code == 200
    filas = [c for c in resp.json() if c["id_cita"] == cita.id_cita]
    assert len(filas) == 1
    assert filas[0]["cliente_email"] == cliente.email
    assert filas[0]["cliente_nombre"]


# ──────────────────────────────────────────────────────────────
# PUT /citas/admin/{id} — gestión de estado y técnicos
# ──────────────────────────────────────────────────────────────
async def test_admin_actualizar_cita_sin_token_401(client):
    resp = await client.put(f"{API}/admin/1", json={"estado": "Finalizada"})
    assert resp.status_code == 401


async def test_admin_actualizar_cita_tecnico_403(client, tecnico_logueado):
    _, _, tokens = tecnico_logueado
    resp = await client.put(
        f"{API}/admin/1", json={"estado": "Finalizada"}, headers=auth_headers(tokens)
    )
    assert resp.status_code == 403


async def test_admin_actualizar_cita_inexistente_404(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.put(
        f"{API}/admin/999999", json={"estado": "Finalizada"}, headers=auth_headers(tokens)
    )
    assert resp.status_code == 404


async def test_admin_actualizar_cita_estado_invalido_400(client, db, admin_logueado):
    _, tokens = admin_logueado
    cita = _crear_cita(db, _cliente_unico(db))

    resp = await client.put(
        f"{API}/admin/{cita.id_cita}",
        json={"estado": "Volando"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "no válido" in resp.json()["detail"]


async def test_admin_actualizar_cita_cambia_estado(client, db, admin_logueado):
    """El administrador cambia el estado (notificación al cliente)."""
    _, tokens = admin_logueado
    cliente = _cliente_unico(db)
    cita = _crear_cita(db, cliente)

    resp = await client.put(
        f"{API}/admin/{cita.id_cita}",
        json={"estado": "Finalizada"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["estado"] == "Finalizada"
    assert resp.json()["cliente_email"] == cliente.email

    db.expire_all()
    assert cita.estado == "Finalizada"


async def test_admin_actualizar_cita_tecnico_invalido_400(client, db, admin_logueado):
    """Asignar un técnico inexistente responde 400."""
    _, tokens = admin_logueado
    cita = _crear_cita(db, _cliente_unico(db))

    resp = await client.put(
        f"{API}/admin/{cita.id_cita}",
        json={"id_tecnico": 999999},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400


async def test_admin_cancelar_cita_elimina_el_registro(client, db, admin_logueado):
    """Al cancelar desde el panel, la cita se elimina del listado
    (comportamiento actual: reembolso/historial preservados)."""
    _, tokens = admin_logueado
    cita = _crear_cita(db, _cliente_unico(db))
    # La fila se elimina en BD al cancelar: se guarda el id antes del PUT
    # para no tocar la instancia ya borrada (ObjectDeletedError).
    id_cita = cita.id_cita

    resp = await client.put(
        f"{API}/admin/{id_cita}",
        json={"estado": "Cancelada"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["estado"] == "Cancelada"

    listado = await client.get(f"{API}/all-admin", headers=auth_headers(tokens))
    assert listado.status_code == 200
    assert id_cita not in {c["id_cita"] for c in listado.json()}


# ──────────────────────────────────────────────────────────────
# GET /citas/horas-disponibles
# ──────────────────────────────────────────────────────────────
async def test_horas_disponibles_sin_fecha_422(client):
    resp = await client.get(f"{API}/horas-disponibles")
    assert resp.status_code == 422


async def test_horas_disponibles_domingo_vacio(client):
    domingo = date.today() + timedelta(days=1)
    while domingo.weekday() != 6:
        domingo += timedelta(days=1)
    resp = await client.get(
        f"{API}/horas-disponibles", params={"fecha": domingo.isoformat()}
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_horas_disponibles_fecha_pasada_vacia(client):
    resp = await client.get(
        f"{API}/horas-disponibles",
        params={"fecha": (date.today() - timedelta(days=3)).isoformat()},
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_horas_disponibles_sin_tecnicos_activos_vacio(client):
    """Comportamiento actual: sin técnicos activos no hay disponibilidad
    (lista vacía) aunque la fecha sea válida y no haya citas."""
    resp = await client.get(
        f"{API}/horas-disponibles", params={"fecha": _fecha_futura_laboral().isoformat()}
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_horas_disponibles_con_tecnico_activo(client, tecnico_logueado):
    """Con al menos un técnico activo se devuelven las franjas libres."""
    resp = await client.get(
        f"{API}/horas-disponibles", params={"fecha": _fecha_futura_laboral().isoformat()}
    )
    assert resp.status_code == 200
    horas = resp.json()
    assert horas, "debería haber franjas libres con un técnico activo"
    assert set(horas) <= set(FRANJAS)


async def test_horas_disponibles_por_tecnico(client, tecnico_logueado):
    """Filtrando por `tecnico_id` solo se libera franja si ESE técnico está
    libre (aquí lo está: devuelve todas las franjas)."""
    _, ficha, tokens = tecnico_logueado
    del tokens
    resp = await client.get(
        f"{API}/horas-disponibles",
        params={"fecha": _fecha_futura_laboral().isoformat(), "tecnico_id": ficha.id_tecnico},
    )
    assert resp.status_code == 200
    assert resp.json() == list(FRANJAS)


async def test_horas_disponibles_sin_franza_reservada(client, db, tecnico_logueado):
    """La franja que ya tiene una cita desaparece de la disponibilidad."""
    _, ficha, tokens = tecnico_logueado
    del tokens
    cliente = _cliente_unico(db)
    _crear_cita(db, cliente, hora="08:00", id_tecnico=ficha.id_tecnico)

    resp = await client.get(
        f"{API}/horas-disponibles", params={"fecha": _fecha_futura_laboral().isoformat()}
    )
    assert resp.status_code == 200
    assert resp.json() == ["11:00", "14:00", "17:00"]


# ──────────────────────────────────────────────────────────────
# GET /citas/tecnico-ocupado
# ──────────────────────────────────────────────────────────────
async def test_tecnico_ocupado_parametros_requeridos_422(client):
    resp = await client.get(f"{API}/tecnico-ocupado")
    assert resp.status_code == 422

    resp_fecha = await client.get(
        f"{API}/tecnico-ocupado", params={"fecha": date.today().isoformat()}
    )
    assert resp_fecha.status_code == 422


async def test_tecnico_ocupado_sin_citas_vacio(client, tecnico_logueado):
    _, ficha, tokens = tecnico_logueado
    del tokens
    resp = await client.get(
        f"{API}/tecnico-ocupado",
        params={"tecnico_id": ficha.id_tecnico, "fecha": _fecha_futura_laboral().isoformat()},
    )
    assert resp.status_code == 200
    assert resp.json() == {"horas": []}


async def test_tecnico_ocupado_con_cita(client, db, tecnico_logueado):
    """Una cita de 1,5 h (instalación) a las 11:00 bloquea 11:00 y 12:00."""
    _, ficha, tokens = tecnico_logueado
    del tokens
    fecha = _fecha_futura_laboral()
    _crear_cita(
        db,
        _cliente_unico(db),
        fecha=fecha,
        hora="11:00",
        tipo_servicio="instalacion",
        id_tecnico=ficha.id_tecnico,
        nombre_tecnico="Técnico agenda",
    )

    resp = await client.get(
        f"{API}/tecnico-ocupado",
        params={"tecnico_id": ficha.id_tecnico, "fecha": fecha.isoformat()},
    )
    assert resp.status_code == 200
    assert resp.json()["horas"] == ["11:00", "12:00"]


# ──────────────────────────────────────────────────────────────
# PUT /citas/{id} — reagendar / editar la cita propia
# ──────────────────────────────────────────────────────────────
async def test_editar_cita_sin_token_401(client):
    resp = await client.put(f"{API}/1", json={"direccion": "Otra cra"})
    assert resp.status_code == 401


async def test_editar_cita_con_token_de_empleado_401(client, tecnico_logueado):
    _, _, tokens = tecnico_logueado
    resp = await client.put(
        f"{API}/1", json={"direccion": "Otra cra"}, headers=auth_headers(tokens)
    )
    assert resp.status_code == 401


async def test_editar_cita_inexistente_404(client, cliente_logueado):
    _, tokens = cliente_logueado
    resp = await client.put(
        f"{API}/999999", json={"direccion": "Otra cra"}, headers=auth_headers(tokens)
    )
    assert resp.status_code == 404


async def test_editar_cita_de_otro_cliente_404(client, db, cliente_logueado):
    """HALLAZGO: editar una cita de OTRO cliente responde 404 (no 403),
    porque el dueño se resuelve con una búsqueda filtrada por id_cliente."""
    _, tokens = cliente_logueado
    ajena = _crear_cita(db, _cliente_unico(db))

    resp = await client.put(
        f"{API}/{ajena.id_cita}",
        json={"direccion": "Intento ajeno"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Cita no encontrada"


async def test_editar_cita_no_editable_400(client, db, cliente_logueado):
    """Solo se editan citas Pendiente/Confirmada."""
    cliente, tokens = cliente_logueado
    cita = _crear_cita(db, cliente, estado="Finalizada")

    resp = await client.put(
        f"{API}/{cita.id_cita}",
        json={"direccion": "Nueva dirección"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "finalizada o cancelada" in resp.json()["detail"]


async def test_editar_cita_exito(client, db, cliente_logueado):
    """Actualizar dirección/descripción sin mover la fecha."""
    cliente, tokens = cliente_logueado
    cita = _crear_cita(db, cliente)

    resp = await client.put(
        f"{API}/{cita.id_cita}",
        json={"direccion": "Av 9 #80-14", "descripcion": "Cambio de visita"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["direccion"] == "Av 9 #80-14"

    db.expire_all()
    assert cita.descripcion == "Cambio de visita"


async def test_editar_cita_reagendar_a_nueva_fecha(client, db, cliente_logueado):
    """Reagendamiento completo (fecha + hora) a una franja libre."""
    cliente, tokens = cliente_logueado
    cita = _crear_cita(db, cliente)
    nueva_fecha = _fecha_futura_laboral(dias=15)
    assert nueva_fecha != cita.fecha

    resp = await client.put(
        f"{API}/{cita.id_cita}",
        json={"fecha": nueva_fecha.isoformat(), "hora": "14:00"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["fecha"] == nueva_fecha.isoformat()
    assert resp.json()["hora"] == "14:00"

    db.expire_all()
    assert cita.fecha == nueva_fecha


async def test_editar_cita_dentro_de_las_3_horas_400(client, db, cliente_logueado):
    """Reagendar dentro de la ventana de 3 h responde 400."""
    cliente, tokens = cliente_logueado
    cita = _crear_cita(
        db, cliente, fecha=date.today() - timedelta(days=1), hora="08:00"
    )

    resp = await client.put(
        f"{API}/{cita.id_cita}",
        json={"direccion": "Misma dirección"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "3 horas" in resp.json()["detail"]


# ──────────────────────────────────────────────────────────────
# DELETE /citas/{id} — cancelar la cita propia
# ──────────────────────────────────────────────────────────────
async def test_cancelar_cita_sin_token_401(client):
    resp = await client.delete(f"{API}/1")
    assert resp.status_code == 401


async def test_cancelar_cita_de_otro_cliente_404(client, db, cliente_logueado):
    """HALLAZGO: cancelar una cita ajena responde 404 (no 403)."""
    _, tokens = cliente_logueado
    ajena = _crear_cita(db, _cliente_unico(db))

    resp = await client.delete(f"{API}/{ajena.id_cita}", headers=auth_headers(tokens))
    assert resp.status_code == 404


async def test_cancelar_cita_exito(client, db, cliente_logueado):
    cliente, tokens = cliente_logueado
    cita = _crear_cita(db, cliente)

    resp = await client.delete(f"{API}/{cita.id_cita}", headers=auth_headers(tokens))
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["estado"] == "Cancelada"
    assert cuerpo["estado_anterior"] == "Confirmada"

    db.expire_all()
    assert cita.estado == "Cancelada"


async def test_cancelar_cita_ya_cancelada_400(client, db, cliente_logueado):
    cliente, tokens = cliente_logueado
    cita = _crear_cita(db, cliente, estado="Cancelada")

    resp = await client.delete(f"{API}/{cita.id_cita}", headers=auth_headers(tokens))
    assert resp.status_code == 400
    assert "ya está cancelada" in resp.json()["detail"]


async def test_cancelar_cita_finalizada_400(client, db, cliente_logueado):
    cliente, tokens = cliente_logueado
    cita = _crear_cita(db, cliente, estado="Finalizada")

    resp = await client.delete(f"{API}/{cita.id_cita}", headers=auth_headers(tokens))
    assert resp.status_code == 400
    assert "finalizada" in resp.json()["detail"]


async def test_cancelar_cita_genera_reembolso_del_85(client, db, cliente_logueado,
                                                     admin_logueado):
    """Una cita pagada (aprobado) cancelada genera reembolso pendiente
    del 85 % del costo del servicio."""
    cliente, tokens = cliente_logueado
    _crear_tarifa(db)
    fecha = _fecha_futura_laboral()

    creada = await client.post(
        API, json=_body_cita(fecha), headers=auth_headers(tokens)
    )
    assert creada.status_code == 200, creada.text
    id_cita = creada.json()["id_cita"]

    resp = await client.delete(f"{API}/{id_cita}", headers=auth_headers(tokens))
    assert resp.status_code == 200
    reembolso = resp.json()["reembolso"]
    assert reembolso is not None
    assert reembolso["estado"] == "Pendiente"
    assert float(reembolso["monto"]) == round(COSTO_TARIFA * 0.85, 2)


# ──────────────────────────────────────────────────────────────
# Productos asociados a una cita
# ──────────────────────────────────────────────────────────────
async def test_productos_cita_sin_token_401(client):
    resp = await client.get(f"{API}/1/productos")
    assert resp.status_code == 401


async def test_productos_cita_cliente_401(client, db, cliente_logueado):
    """HALLAZGO: los clientes reciben 401 (no 403) en endpoints de
    empleado: son solo para administradores y técnicos."""
    _, tokens = cliente_logueado
    cita = _crear_cita(db, cliente_logueado[0])
    resp = await client.get(
        f"{API}/{cita.id_cita}/productos", headers=auth_headers(tokens)
    )
    assert resp.status_code == 401


async def test_productos_cita_tecnico_no_asignado_403(client, db, tecnico_logueado):
    """Un técnico que no es el asignado a la cita no tiene acceso (403)."""
    _, _, tokens = tecnico_logueado
    cita = _crear_cita(db, _cliente_unico(db))  # sin técnico asignado

    resp = await client.get(
        f"{API}/{cita.id_cita}/productos", headers=auth_headers(tokens)
    )
    assert resp.status_code == 403
    assert resp.json()["detail"] == "No tienes acceso a esta cita"


async def test_productos_cita_tecnico_asignado_200(client, db, tecnico_logueado):
    _, ficha, tokens = tecnico_logueado
    cita = _crear_cita(
        db,
        _cliente_unico(db),
        id_tecnico=ficha.id_tecnico,
        nombre_tecnico="Técnico asignado",
    )

    resp = await client.get(
        f"{API}/{cita.id_cita}/productos", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert resp.json() == []


async def test_productos_cita_admin_200(client, db, admin_logueado):
    _, tokens = admin_logueado
    cliente = _cliente_unico(db)
    cita = _crear_cita(db, cliente)
    producto = crear_producto(db)
    db.add(CitaProducto(id_cita=cita.id_cita, id_producto=producto.id_producto, cantidad=2))
    db.commit()

    resp = await client.get(
        f"{API}/{cita.id_cita}/productos", headers=auth_headers(tokens)
    )
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    assert resp.json()[0]["cantidad"] == 2
    assert resp.json()[0]["producto_nombre"] == producto.nombre_producto


async def test_productos_cita_inexistente_404(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.get(f"{API}/999999/productos", headers=auth_headers(tokens))
    assert resp.status_code == 404


async def test_agregar_producto_a_cita_exito(client, db, admin_logueado):
    _, tokens = admin_logueado
    cita = _crear_cita(db, _cliente_unico(db))
    producto = crear_producto(db, nombre_producto="Cable de cobre xyz")

    resp = await client.post(
        f"{API}/{cita.id_cita}/productos",
        json={"id_producto": producto.id_producto, "cantidad": 3, "notas": "Instalar"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["cantidad"] == 3
    assert resp.json()["producto_nombre"] == producto.nombre_producto
    assert (
        db.query(CitaProducto).filter_by(id_cita=cita.id_cita).count() == 1
    )


async def test_agregar_producto_a_cita_producto_inexistente_404(client, db, admin_logueado):
    _, tokens = admin_logueado
    cita = _crear_cita(db, _cliente_unico(db))

    resp = await client.post(
        f"{API}/{cita.id_cita}/productos",
        json={"id_producto": 999999},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404


async def test_agregar_producto_a_cita_cantidad_invalida_400(client, db, admin_logueado):
    _, tokens = admin_logueado
    cita = _crear_cita(db, _cliente_unico(db))
    producto = crear_producto(db)

    resp = await client.post(
        f"{API}/{cita.id_cita}/productos",
        json={"id_producto": producto.id_producto, "cantidad": 0},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "al menos 1" in resp.json()["detail"]


async def test_agregar_producto_a_cita_variante_ajena_400(client, db, admin_logueado):
    """La variante debe pertenecer al producto indicado."""
    _, tokens = admin_logueado
    cita = _crear_cita(db, _cliente_unico(db))
    producto_a = crear_producto(db, nombre_producto="Producto destino xyz")
    producto_b = crear_producto(db, nombre_producto="Producto origen xyz")
    variante = ProductoVariante(id_producto=producto_b.id_producto, nombre="Rojo", stock=5)
    db.add(variante)
    db.commit()
    db.refresh(variante)

    resp = await client.post(
        f"{API}/{cita.id_cita}/productos",
        json={"id_producto": producto_a.id_producto, "id_variante": variante.id},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "no pertenece" in resp.json()["detail"]


async def test_agregar_producto_a_cita_sin_token_401(client, db):
    cita = _crear_cita(db, _cliente_unico(db))
    producto = crear_producto(db)
    resp = await client.post(
        f"{API}/{cita.id_cita}/productos", json={"id_producto": producto.id_producto}
    )
    assert resp.status_code == 401


async def test_eliminar_producto_de_cita_exito(client, db, admin_logueado):
    _, tokens = admin_logueado
    cita = _crear_cita(db, _cliente_unico(db))
    producto = crear_producto(db)
    fila = CitaProducto(id_cita=cita.id_cita, id_producto=producto.id_producto, cantidad=1)
    db.add(fila)
    db.commit()
    db.refresh(fila)

    resp = await client.delete(
        f"{API}/{cita.id_cita}/productos/{fila.id_cita_producto}",
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["msg"] == "Producto eliminado de la cita"
    assert db.query(CitaProducto).count() == 0


async def test_eliminar_producto_de_cita_inexistente_404(client, db, admin_logueado):
    _, tokens = admin_logueado
    cita = _crear_cita(db, _cliente_unico(db))

    resp = await client.delete(
        f"{API}/{cita.id_cita}/productos/999999", headers=auth_headers(tokens)
    )
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# Ofertas de horario liberado
# ──────────────────────────────────────────────────────────────
async def test_ofertas_pendientes_sin_token_401(client):
    resp = await client.get(f"{API}/ofertas-pendientes")
    assert resp.status_code == 401


async def test_ofertas_pendientes_vacia_200(client, cliente_logueado):
    _, tokens = cliente_logueado
    resp = await client.get(f"{API}/ofertas-pendientes", headers=auth_headers(tokens))
    assert resp.status_code == 200
    assert resp.json() == []


async def test_aceptar_oferta_inexistente_409(client, cliente_logueado):
    _, tokens = cliente_logueado
    resp = await client.post(
        f"{API}/ofertas/999999/aceptar", headers=auth_headers(tokens)
    )
    assert resp.status_code == 409


async def test_aceptar_oferta_sin_token_401(client):
    resp = await client.post(f"{API}/ofertas/1/aceptar")
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# Endpoints de administración: historial, técnicos y reasignación
# ──────────────────────────────────────────────────────────────
async def test_historial_cita_admin(client, db, admin_logueado):
    _, tokens = admin_logueado
    cita = _crear_cita(db, _cliente_unico(db))

    ok = await client.get(
        f"{API}/admin/{cita.id_cita}/historial", headers=auth_headers(tokens)
    )
    assert ok.status_code == 200
    assert ok.json() == []

    no_existe = await client.get(
        f"{API}/admin/999999/historial", headers=auth_headers(tokens)
    )
    assert no_existe.status_code == 404


async def test_historial_cita_tecnico_403(client, tecnico_logueado):
    _, _, tokens = tecnico_logueado
    resp = await client.get(f"{API}/admin/1/historial", headers=auth_headers(tokens))
    assert resp.status_code == 403


async def test_historial_cita_sin_token_401(client):
    resp = await client.get(f"{API}/admin/1/historial")
    assert resp.status_code == 401


async def test_tecnicos_disponibles_para_cita(client, db, admin_logueado):
    """Lista los técnicos activos libres en la franja de la cita.

    No se usa el fixture `tecnico_logueado` porque su empleado colisiona
    con el del fixture `admin_logueado` (mismas kwargs por defecto).
    """
    _, tokens = admin_logueado
    ficha = _tecnico_unico(db)
    cita = _crear_cita(db, _cliente_unico(db))

    ok = await client.get(
        f"{API}/admin/{cita.id_cita}/tecnicos-disponibles", headers=auth_headers(tokens)
    )
    assert ok.status_code == 200
    assert ficha.id_tecnico in {t["id_tecnico"] for t in ok.json()}

    no_existe = await client.get(
        f"{API}/admin/999999/tecnicos-disponibles", headers=auth_headers(tokens)
    )
    assert no_existe.status_code == 404


async def test_reasignar_cita_admin_exito(client, db, admin_logueado):
    """Reasigna la cita a otro técnico y registra el historial."""
    _, tokens = admin_logueado
    cliente = _cliente_unico(db)
    cita = _crear_cita(db, cliente)
    nuevo_tecnico = _tecnico_unico(db)  # crea su propio usuario técnico
    nuevo_usuario = nuevo_tecnico.usuario

    resp = await client.post(
        f"{API}/admin/{cita.id_cita}/reasignar",
        json={"id_tecnico": nuevo_tecnico.id_tecnico, "motivo": "Prueba de reasignación"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["id_tecnico"] == nuevo_tecnico.id_tecnico
    assert resp.json()["nombre_tecnico"] == (
        f"{nuevo_usuario.first_name} {nuevo_usuario.last_name}".strip()
    )

    historial = await client.get(
        f"{API}/admin/{cita.id_cita}/historial", headers=auth_headers(tokens)
    )
    assert historial.status_code == 200
    assert any(h["accion"] == "reasignacion" for h in historial.json())


async def test_reasignar_cita_inexistente_404(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}/admin/999999/reasignar",
        json={"id_tecnico": 1},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404


async def test_reasignar_cita_tecnico_403(client, tecnico_logueado):
    _, _, tokens = tecnico_logueado
    resp = await client.post(
        f"{API}/admin/1/reasignar",
        json={"id_tecnico": 1},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 403


async def test_reasignar_cita_sin_token_401(client):
    resp = await client.post(f"{API}/admin/1/reasignar", json={"id_tecnico": 1})
    assert resp.status_code == 401


async def test_citas_pendientes_de_reasignar_admin(client, db, admin_logueado):
    """Citas futuras con técnico inhabilitado aparecen para reasignar.

    El técnico se crea con kwargs únicos: el fixture `tecnico_logueado`
    no puede combinarse con `admin_logueado` (colisión de email UNIQUE).
    """
    _, tokens = admin_logueado
    ficha = _tecnico_unico(db)
    cita = _crear_cita(
        db,
        _cliente_unico(db),
        id_tecnico=ficha.id_tecnico,
        nombre_tecnico="Técnico por inhabilitar",
    )
    ficha.usuario.is_active = False
    db.commit()

    resp = await client.get(f"{API}/admin/reasignar-pendientes", headers=auth_headers(tokens))
    assert resp.status_code == 200
    assert cita.id_cita in {c["id_cita"] for c in resp.json()}

    ficha.usuario.is_active = True
    db.commit()
