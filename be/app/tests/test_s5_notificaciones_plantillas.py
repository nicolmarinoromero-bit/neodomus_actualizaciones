"""Semana 5 del bootcamp — plantillas y efectos de notificaciones.

`notificaciones.py` es el punto único de correo + campana. Aquí se sustituyen
los efectos externos (`programar_correo` y `crear_notificacion`) por dobles y
se verifica QUÉ se notifica en cada evento, sin abrir SMTP ni tocar la BD.
"""
import asyncio
import threading

import pytest

from app.services import notificaciones as notif

# Otros módulos de la suite anulan estos servicios con parches de contexto;
# se conserva la referencia real para los casos que prueban SU comportamiento.
_CREAR_REAL = notif.crear_notificacion
_PROGRAMAR_REAL = notif.programar_correo


class _Admin:
    def __init__(self, id_usuario, nombre="Ada", apellido="Admin", email="admin@example.com"):
        self.id_usuario = id_usuario
        self.first_name = nombre
        self.last_name = apellido
        self.email = email


class _DbAdmins:
    """Sesión falsa para las consultas de administradores."""

    def __init__(self, admins):
        self.admins = admins

    def query(self, modelo):
        admins = self.admins

        class _Q:
            def filter(self, *a, **kw):
                return self

            def all(self):
                return admins

        return _Q()


@pytest.fixture
def efectos(monkeypatch):
    correos = []
    plataforma = []

    def _correo(correo=None, subject=None, body=None):
        correos.append({"correo": correo, "subject": subject, "body": body})

    def _aviso(db, id_usuario=None, tipo=None, titulo=None, mensaje=None, id_cliente=None):
        plataforma.append({
            "id_usuario": id_usuario, "tipo": tipo, "titulo": titulo,
            "mensaje": mensaje, "id_cliente": id_cliente,
        })

    monkeypatch.setattr(notif, "programar_correo", _correo)
    monkeypatch.setattr(notif, "crear_notificacion", _aviso)
    return correos, plataforma


DATOS = {
    "servicio": "Instalación de silla",
    "fecha": "2026-11-20",
    "hora": "10:00",
    "tecnico": "Tito Técnico",
    "cliente": "Carla Cliente",
    "direccion": "Calle 10 # 5-20",
    "telefono": "3001234567",
    "telefono_tecnico": "3007654321",
    "descripcion": "Silla ergonómica",
    "pedido": "#88",
    "total": 1250000,
    "estado_pago": "Pagado",
    "horas": 3,
    "cita": "#12",
    "monto": 250000,
    "motivo": "Cambio de fecha",
    "transaccion": "NEO-PAY-1",
    "transaccion_original": "NEO-PAY-0",
    "estado": "Reembolsado",
}


def test_bienvenida_tecnico_incluye_credenciales(efectos):
    # Act
    notif.notificar_bienvenida_tecnico("tec@example.com", "Tito", "tec@example.com", "Clave123")
    # Assert
    correos, plataforma = efectos
    assert correos and "credenciales" in correos[0]["subject"].lower()
    assert "Clave123" in correos[0]["body"]
    assert plataforma == []


@pytest.mark.parametrize(
    "funcion,args,con_db,avisos",
    [
        (notif.notificar_cita_reasignada_cliente, (7, "c@example.com", "Carla", DATOS), True, 1),
        (notif.notificar_cita_asignada_tecnico, (7, "t@example.com", "Tito", DATOS), True, 1),
        (notif.notificar_cita_reagendada_tecnico, (7, "t@example.com", "Tito", DATOS), True, 1),
        (notif.notificar_cita_finalizada_cliente, ("c@example.com", "Carla", DATOS), False, 0),
        (notif.notificar_cita_cancelada_cliente, ("c@example.com", "Carla", DATOS), False, 0),
        (notif.notificar_entrega_asignada_tecnico, (7, "t@example.com", "Tito", DATOS), True, 1),
        (notif.notificar_aviso_entrega_cliente, ("c@example.com", "Carla", DATOS), False, 0),
        (notif.notificar_entrega_programada_cliente, (7, "c@example.com", "Carla", DATOS), True, 1),
        (notif.notificar_pedido_entregado_cliente, (7, "c@example.com", "Carla", DATOS), True, 1),
        (notif.notificar_pedido_creado_cliente, (7, "c@example.com", "Carla", DATOS), True, 1),
        (notif.notificar_pago_confirmado_cliente, (7, "c@example.com", "Carla", DATOS), True, 1),
        (notif.notificar_entrega_asignada_cliente, (7, "c@example.com", "Carla", DATOS), True, 1),
        (notif.notificar_recogido_cliente, (7, "c@example.com", "Carla", DATOS), True, 1),
        (notif.notificar_en_camino_cliente, (7, "c@example.com", "Carla", DATOS), True, 1),
        (notif.notificar_oferta_horario, (7, "c@example.com", "Carla", DATOS), True, 1),
        (notif.notificar_reembolso_cliente, (7, "c@example.com", "Carla", DATOS, "Cita"), True, 1),
        (notif.notificar_recordatorio_cita, (7, "c@example.com", "Carla", DATOS), True, 1),
    ],
)
def test_cada_evento_programa_correo_y_campana(efectos, funcion, args, con_db, avisos):
    # Arrange
    db = _DbAdmins([])
    # Act
    funcion(db, *args) if con_db else funcion(*args)
    # Assert: todo evento encola exactamente un correo y los avisos esperados.
    correos, plataforma = efectos
    assert len(correos) == 1
    assert len(plataforma) == avisos
    cuerpo = correos[0]["body"]
    assert "Neodomus" in cuerpo and "<table" in cuerpo


@pytest.mark.parametrize(
    "funcion,args",
    [
        (notif.notificar_cita_estado_cliente, (7, "c@example.com", "Carla", DATOS, "Pendiente")),
        (notif.notificar_cita_estado_cliente, (7, "c@example.com", "Carla", DATOS, "Confirmada")),
        (notif.notificar_cita_estado_cliente, (7, "c@example.com", "Carla", DATOS, "Finalizada")),
        (notif.notificar_cita_estado_cliente, (7, "c@example.com", "Carla", DATOS, "Cancelada", "Técnico desactivado")),
        (notif.notificar_cita_estado_cliente, (7, "c@example.com", "Carla", DATOS, "Reprogramada")),
    ],
)
def test_estados_de_cita_tienen_plantilla_propia(efectos, funcion, args):
    # Act
    funcion(_DbAdmins([]), *args)
    # Assert
    correos, plataforma = efectos
    assert correos and plataforma
    assert args[4] in correos[0]["body"]


@pytest.mark.parametrize("evento", ["solicitada", "en_revision", "aprobada", "rechazada", "recibida", "reembolso_procesado", "otro"])
def test_devolucion_notifica_cada_hito(efectos, evento):
    # Act
    notif.notificar_devolucion_cliente(
        _DbAdmins([]), 7, "c@example.com", "Carla",
        numero="DEV-001", pedido_id=88, evento=evento, monto=50000,
        motivo_rechazo="Producto usado", productos_txt="Silla x1",
    )
    # Assert
    correos, plataforma = efectos
    assert correos and plataforma
    assert "DEV-001" in correos[0]["body"]


def test_devolucion_sin_correo_ni_cliente_no_falla(efectos):
    # Act: los tres datos opcionales ausentes.
    notif.notificar_devolucion_cliente(
        _DbAdmins([]), None, None, "Carla",
        numero="DEV-002", pedido_id=89, evento="solicitada",
    )
    # Assert: sin correo no se envía nada; la campana registra el hito sin
    # cliente asociado (la crea igualmente el servicio), sin excepción.
    correos, plataforma = efectos
    assert correos == []
    assert len(plataforma) == 1
    assert plataforma[0]["id_cliente"] is None


def test_entrega_desasignada_y_cancelada_respetan_opcionales(efectos):
    # Act: sin cliente pero con correo; luego con ambos.
    notif.notificar_entrega_desasignada_cliente(_DbAdmins([]), None, "c@example.com", "Carla", 88)
    notif.notificar_entrega_sin_tecnico_cliente(_DbAdmins([]), 7, None, "Carla", 89)
    # Assert
    correos, plataforma = efectos
    assert len(correos) == 1 and len(plataforma) == 1


def test_pedido_cancelado_y_sin_tecnico_incluyen_motivo(efectos):
    # Act
    notif.notificar_pedido_cancelado_cliente(
        _DbAdmins([]), 7, "c@example.com", "Carla", 88, "Pago no confirmado",
    )
    # Assert
    correos, plataforma = efectos
    assert "Pago no confirmado" in correos[0]["body"]
    assert "88" in plataforma[0]["titulo"]


def test_alertas_admin_llegan_a_todos_los_administradores(efectos):
    # Arrange
    db = _DbAdmins([_Admin(1), _Admin(2, "Beto", "Root")])
    # Act
    notif.notificar_admin_citas_reasignar(db, 8, "Tito", [f"Cita {i}" for i in range(8)])
    notif.notificar_admin_devolucion_solicitada(db, 88, "Carla", "Silla", None)
    notif.notificar_admin_reembolso_pendiente_cita(db, 12, "Carla", None, 250000, "Sin técnico")
    notif.notificar_reembolso_fallido_admin(db, [1, 2], 5, "Banco rechazó")
    notif.notificar_admin_stock_bajo(db, [1, 2], 9, "Silla", 3, 5)
    # Assert: dos avisos por alerta (uno por admin) y un correo por admin en la primera.
    correos, plataforma = efectos
    assert len(plataforma) == 10
    assert len(correos) == 2
    assert "..." in correos[0]["body"]  # resumen recortado a 5 citas


def test_alertas_admin_sin_administradores_no_encolan(efectos):
    # Act
    notif.notificar_admin_citas_reasignar(_DbAdmins([]), 1, "Tito", ["Cita 1"])
    notif.notificar_admin_resultado_desactivacion(_DbAdmins([]), "Tito")
    # Assert
    assert efectos == ([], [])


def test_resultado_desactivacion_resume_y_elige_tipo(efectos):
    # Arrange
    db = _DbAdmins([_Admin(1)])
    # Act: con citas canceladas usa tipo "cita" y nota de reembolso.
    notif.notificar_admin_resultado_desactivacion(db, "Tito", canceladas=2)
    # Assert
    correos, plataforma = efectos
    assert plataforma[0]["tipo"] == "cita"
    assert "reembolso" in plataforma[0]["mensaje"]
    # Sin conteos: resumen neutral y tipo "sistema".
    efectos[1].clear()
    notif.notificar_admin_resultado_desactivacion(db, "Tito")
    assert "sin agenda pendiente" in efectos[1][0]["mensaje"]
    assert efectos[1][0]["tipo"] == "sistema"


def test_crear_notificacion_trunca_y_hace_commit(monkeypatch):
    # Arrange: se restaura la implementación real bajo prueba.
    monkeypatch.setattr(notif, "crear_notificacion", _CREAR_REAL)
    class _Db:
        def __init__(self):
            self.agregado = None
            self.commits = 0

        def add(self, obj):
            self.agregado = obj

        def commit(self):
            self.commits += 1

        def rollback(self):
            raise AssertionError("no debía hacer rollback")

    db = _Db()
    # Act
    notif.crear_notificacion(db, 1, "cita", "T" * 200, "M" * 600)
    # Assert
    assert db.commits == 1
    assert len(db.agregado.titulo) == 150
    assert len(db.agregado.mensaje) == 500


def test_crear_notificacion_absorbe_errores_y_rollback(monkeypatch, capsys):
    # Arrange
    monkeypatch.setattr(notif, "crear_notificacion", _CREAR_REAL)
    class _Db:
        def add(self, obj):
            raise RuntimeError("tabla caída")

        def rollback(self):
            self.rollback_hecho = True

    db = _Db()
    # Act
    notif.crear_notificacion(db, None, "sistema", "t", "m", id_cliente=7)
    # Assert: no propaga y deja diagnóstico sin secretos.
    assert db.rollback_hecho is True
    assert "Error creando notificación" in capsys.readouterr().out


def test_programar_correo_sin_loop_usa_hilo(monkeypatch):
    # Arrange
    monkeypatch.setattr(notif, "programar_correo", _PROGRAMAR_REAL)
    ejecutados = []
    monkeypatch.setattr(threading, "Thread", lambda **kw: type(
        "HiloFalso", (), {"start": lambda self: kw["target"]()},
    )())

    async def falso(correo, subject, body):
        ejecutados.append((correo, subject))

    monkeypatch.setattr("app.utils.email.send_email", falso)
    # Act: sin event loop activo.
    notif.programar_correo("a@example.com", "s", "b")
    # Assert
    assert ejecutados == [("a@example.com", "s")]


def test_programar_correo_con_loop_crea_tarea_y_absorbe_error(monkeypatch):
    # Arrange
    monkeypatch.setattr(notif, "programar_correo", _PROGRAMAR_REAL)
    ejecutados = []

    async def falso(correo, subject, body):
        ejecutados.append(subject)
        raise RuntimeError("smtp caído")

    monkeypatch.setattr("app.utils.email.send_email", falso)

    async def correr():
        notif.programar_correo("a@example.com", "s", "b")
        await asyncio.sleep(0)

    # Act: dentro de un loop activo la tarea se crea sin bloquear.
    asyncio.run(correr())
    # Assert
    assert ejecutados == ["s"]
