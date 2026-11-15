"""Semana 5 del bootcamp — reloj y tareas programadas con dobles.

El scheduler y las tareas automáticas dependen del reloj, de la sesión de BD y
de notificaciones. Aquí se fijan reloj, sesión y avisos para probar las
decisiones (ventana de 12 h, anti-spam, expiraciones) sin esperar ni dormir.
"""
from datetime import date, datetime, timedelta

import pytest

from app.services import scheduler, tareas_programadas as tareas

# La barrera de testdb sustituye el arranque/parada por no-ops; se conservan
# las implementaciones reales para probar el scheduler con un doble de APScheduler.
_INICIAR_REAL = getattr(scheduler, "_iniciar_scheduler_original", scheduler.iniciar_scheduler)
_DETENER_REAL = getattr(scheduler, "_detener_scheduler_original", scheduler.detener_scheduler)


class _DatetimeFijo(datetime):
    @classmethod
    def now(cls, tz=None):
        return datetime(2026, 11, 15, 10, 0, 0)


class _Cita:
    def __init__(self, **kw):
        self.id_cita = 1
        self.id_cliente = 7
        self.estado = "Pendiente"
        self.recordatorio_enviado = False
        self.fecha = date(2026, 11, 15)
        self.hora = "12:00"
        self.tipo_servicio = "Instalación"
        self.direccion = "Calle 1"
        self.__dict__.update(kw)


class _Cliente:
    def __init__(self, **kw):
        self.id_cliente = 7
        self.email = "cliente@example.com"
        self.first_name = "Carolina"
        self.last_name = "Mendez"
        self.__dict__.update(kw)


class _Query:
    def __init__(self, resultados):
        self._resultados = resultados
        self._actual = None
        self.filtros = []

    def filter(self, *args, **kw):
        self.filtros.append(args)
        return self

    def order_by(self, *a, **kw):
        return self

    def limit(self, *a, **kw):
        return self

    def outerjoin(self, *a, **kw):
        return self

    def group_by(self, *a, **kw):
        return self

    def update(self, *a, **kw):
        return self._actual

    def all(self):
        return self._actual

    def first(self):
        return self._actual[0] if self._actual else None

    def scalar(self):
        return self._actual


class _DbFalso:
    """Devuelve resultados en el orden en que se abren las consultas."""

    def __init__(self, resultados):
        self._resultados = list(resultados)
        self.commits = 0
        self.rollbacks = 0
        self.cerrada = False
        self.ultima = None

    def query(self, *modelos):
        valor = self._resultados.pop(0)
        q = _Query(self._resultados)
        q._actual = valor
        self.ultima = q
        return q

    def commit(self):
        self.commits += 1

    def rollback(self):
        self.rollbacks += 1

    def close(self):
        self.cerrada = True


# ── Tareas programadas ────────────────────────────────────────────────


def test_recordatorio_cita_respeta_estado_hora_y_ventana(monkeypatch):
    # Arrange
    monkeypatch.setattr(tareas, "datetime", _DatetimeFijo)
    db = _DbFalso([])
    cliente = _Cliente()
    # Act / Assert: estados no notificables y recordatorio ya enviado.
    assert tareas.enviar_recordatorio_si_corresponde(db, cliente, _Cita(estado="Cancelada")) is False
    assert tareas.enviar_recordatorio_si_corresponde(db, cliente, _Cita(recordatorio_enviado=True)) is False
    # Hora inválida (ValueError / IndexError).
    assert tareas.enviar_recordatorio_si_corresponde(db, cliente, _Cita(hora="no-es-hora")) is False
    assert tareas.enviar_recordatorio_si_corresponde(db, cliente, _Cita(hora="12")) is False
    # Fuera de ventana: pasada y a más de 12 h.
    assert tareas.enviar_recordatorio_si_corresponde(db, cliente, _Cita(hora="09:00")) is False
    assert tareas.enviar_recordatorio_si_corresponde(db, cliente, _Cita(hora="23:30")) is False
    # Arrange 2: dentro de la ventana.
    llamadas = []
    monkeypatch.setattr(tareas, "notificar_recordatorio_cita", lambda *a, **kw: llamadas.append(kw))
    cita = _Cita(hora="12:00")
    # Act
    assert tareas.enviar_recordatorio_si_corresponde(db, cliente, cita) is True
    # Assert
    assert cita.recordatorio_enviado is True
    assert db.commits == 1
    assert llamadas[0]["datos"]["servicio"] == "Instalación"


def test_procesar_recordatorios_aisla_errores_y_cuenta(monkeypatch):
    # Arrange: dos citas con cliente y una sin cliente.
    citas = [_Cita(id_cita=1), _Cita(id_cita=2), _Cita(id_cita=3, id_cliente=99)]
    db = _DbFalso([citas, [_Cliente()]])
    efectos = iter([True, RuntimeError("fallo")])

    def falso(*a, **kw):
        valor = next(efectos)
        if isinstance(valor, Exception):
            raise valor
        return valor

    monkeypatch.setattr(tareas, "enviar_recordatorio_si_corresponde", falso)
    # Act
    enviados = tareas.procesar_recordatorios_pendientes(db)
    # Assert: una enviada, la excepción se aísla y la cita sin cliente se omite.
    assert enviados == 1
    assert db.rollbacks == 1


def test_expirar_pagos_vencidos_cancela_y_notifica(monkeypatch):
    # Arrange
    pedido = type("Pedido", (), {
        "id_pedido": 88, "estado_pedido": "Pago pendiente", "id_cliente_pe": 7,
    })()
    pago = type("Pago", (), {"estado": "pendiente", "pedido": pedido})()
    pago_sin_pedido = type("Pago", (), {"estado": "pendiente", "pedido": None})()
    db = _DbFalso([[pago_sin_pedido, pago], [_Cliente()]])
    notificaciones = []
    monkeypatch.setattr(tareas, "crear_notificacion", lambda *a, **kw: notificaciones.append(kw))
    # El servicio se importa DENTRO de la tarea; se parchea en su módulo.
    monkeypatch.setattr(
        "app.services.notificaciones.notificar_pedido_cancelado_cliente",
        lambda *a, **kw: notificaciones.append(kw),
    )
    # Act
    n = tareas.expirar_pagos_vencidos(db)
    # Assert
    assert n == 2 and db.commits == 1
    assert pago_sin_pedido.estado == "expirado"
    assert pedido.estado_pedido == "Cancelado"
    assert len(notificaciones) == 2
    assert notificaciones[0]["titulo"].startswith("Pago del pedido #88")


def test_expirar_pagos_ignora_errores_del_aviso(monkeypatch):
    # Arrange: el correo falla, pero la expiración debe completarse.
    pedido = type("Pedido", (), {
        "id_pedido": 89, "estado_pedido": "Pago pendiente", "id_cliente_pe": 7,
    })()
    pago = type("Pago", (), {"estado": "pendiente", "pedido": pedido})()
    db = _DbFalso([[pago], [_Cliente()]])
    monkeypatch.setattr(tareas, "crear_notificacion", lambda *a, **kw: None)
    monkeypatch.setattr(
        "app.services.notificaciones.notificar_pedido_cancelado_cliente",
        lambda *a, **kw: (_ for _ in ()).throw(RuntimeError("smtp caído")),
    )
    # Act
    n = tareas.expirar_pagos_vencidos(db)
    # Assert
    assert n == 1 and pago.estado == "expirado"


def test_expirar_ofertas_vencidas_solo_commitea_si_hay_cambios():
    # Arrange
    db = _DbFalso([2])
    # Act / Assert
    assert tareas.expirar_ofertas_vencidas(db) == 2
    assert db.commits == 1
    db0 = _DbFalso([0])
    assert tareas.expirar_ofertas_vencidas(db0) == 0
    assert db0.commits == 0


def test_renovar_recordatorio_previo_y_recientes(monkeypatch):
    # Arrange: un aviso reciente impide enviar otro.
    monkeypatch.setattr(tareas, "datetime", _DatetimeFijo)
    reciente = type("N", (), {"fecha_creacion": datetime(2026, 11, 15, 9, 30), "leida": False})()
    db = _DbFalso([[reciente]])
    assert tareas._renovar_recordatorio_previo(db, 7, "recordatorio_cita") is False
    # Un aviso viejo se marca leído y permite el nuevo.
    viejo = type("N", (), {"fecha_creacion": datetime(2026, 11, 15, 5, 0), "leida": False})()
    db = _DbFalso([[viejo]])
    assert tareas._renovar_recordatorio_previo(db, 7, "recordatorio_cita") is True
    assert viejo.leida is True
    # Mismo criterio para el grupo de recordatorios.
    db = _DbFalso([[reciente]])
    assert tareas._recordatorios_pendientes_recientes(db, 7, ("recordatorio_cita",)) is True
    db = _DbFalso([[viejo]])
    assert tareas._recordatorios_pendientes_recientes(db, 7, ("recordatorio_cita",)) is False


def test_consultas_de_pendientes_de_calificacion(monkeypatch):
    # Arrange: una cita finalizada sin calificar.
    db = _DbFalso([[(7, 2)]])
    assert tareas._clientes_con_servicios_sin_calificar(db) == {7: 2}
    # Arrange 2: un pedido completado con dos productos y solo uno calificado.
    pedido = type("P", (), {"id_pedido": 88, "id_cliente_pe": 7})()
    detalles = [object(), object()]
    db = _DbFalso([[pedido], detalles, 1])
    monkeypatch.setattr("app.services.pedidos_service.pedido_completado", lambda db, p: True)
    # Act
    resultado = tareas._pedidos_pendientes_calificacion_productos(db)
    # Assert
    assert resultado == {7: [88]}
    # Pedido sin cliente se omite.
    db = _DbFalso([[type("P", (), {"id_pedido": 89, "id_cliente_pe": None})()]])
    assert tareas._pedidos_pendientes_calificacion_productos(db) == {}


def test_enviar_recordatorios_calificacion_agrupa_y_evita_spam(monkeypatch):
    # Arrange: un cliente con servicio y productos pendientes.
    monkeypatch.setattr(tareas, "_clientes_con_servicios_sin_calificar", lambda db: {7: 1})
    monkeypatch.setattr(tareas, "_pedidos_pendientes_calificacion_productos", lambda db: {7: [88, 89]})
    monkeypatch.setattr(tareas, "_recordatorios_pendientes_recientes", lambda *a: False)
    monkeypatch.setattr(tareas, "_renovar_recordatorio_previo", lambda *a: True)
    creadas = []
    monkeypatch.setattr(tareas, "crear_notificacion", lambda *a, **kw: creadas.append(kw))
    db = _DbFalso([[_Cliente()]])
    # Act
    assert tareas.enviar_recordatorios_calificacion(db) == 2
    # Assert: un aviso por grupo y los pedidos agrupados.
    assert [c["tipo"] for c in creadas] == ["recordatorio_cita", "recordatorio_producto"]
    assert "#88, #89" in creadas[1]["mensaje"]
    # Sin pendientes no consulta clientes.
    monkeypatch.setattr(tareas, "_clientes_con_servicios_sin_calificar", lambda db: {})
    monkeypatch.setattr(tareas, "_pedidos_pendientes_calificacion_productos", lambda db: {})
    assert tareas.enviar_recordatorios_calificacion(_DbFalso([])) == 0
    # Cliente inexistente en la consulta: se omite.
    monkeypatch.setattr(tareas, "_clientes_con_servicios_sin_calificar", lambda db: {7: 1})
    monkeypatch.setattr(tareas, "_pedidos_pendientes_calificacion_productos", lambda db: {})
    assert tareas.enviar_recordatorios_calificacion(_DbFalso([[]])) == 0


# ── Scheduler (APScheduler con doble) ─────────────────────────────────


class _SchedulerFalso:
    instancias = []

    def __init__(self, timezone):
        self.timezone = timezone
        self.jobs = []
        self.running = False
        self.start_llamado = False
        self.shutdown_llamado = False
        type(self).instancias.append(self)

    def add_job(self, fn, trigger, **kw):
        self.jobs.append((fn, trigger, kw))

    def start(self):
        self.start_llamado = True
        self.running = True

    def shutdown(self, wait=False):
        self.shutdown_llamado = True
        self.running = False


def _reset_scheduler(monkeypatch):
    _SchedulerFalso.instancias = []
    monkeypatch.setattr(scheduler, "_scheduler", None)
    monkeypatch.setattr(scheduler, "iniciar_scheduler", _INICIAR_REAL)
    monkeypatch.setattr(scheduler, "detener_scheduler", _DETENER_REAL)
    monkeypatch.setattr(scheduler, "BackgroundScheduler", _SchedulerFalso)


def test_iniciar_scheduler_una_sola_vez_y_cuatro_jobs(monkeypatch):
    # Arrange
    _reset_scheduler(monkeypatch)
    # Act
    scheduler.iniciar_scheduler()
    scheduler.iniciar_scheduler()
    # Assert: una instancia, 4 jobs y un solo start.
    assert len(_SchedulerFalso.instancias) == 1
    instancia = _SchedulerFalso.instancias[0]
    assert instancia.timezone == "America/Bogota"
    assert len(instancia.jobs) == 4
    assert instancia.start_llamado is True


def test_detener_scheduler_solo_si_esta_corriendo(monkeypatch):
    # Arrange
    _reset_scheduler(monkeypatch)
    scheduler.detener_scheduler()  # sin instancia: no falla
    instancia = _SchedulerFalso("UTC")
    instancia.running = True
    monkeypatch.setattr(scheduler, "_scheduler", instancia)
    # Act
    scheduler.detener_scheduler()
    # Assert
    assert instancia.shutdown_llamado is True
    assert scheduler._scheduler is None


@pytest.mark.parametrize("job,servicio,valor", [
    ("_job_recordatorios", "procesar_recordatorios_pendientes", 2),
    ("_job_recordatorios_calificacion", "enviar_recordatorios_calificacion", 1),
    ("_job_expirar_pagos", "expirar_pagos_vencidos", 3),
    ("_job_expirar_ofertas", "expirar_ofertas_vencidas", 4),
])
def test_jobs_cierran_sesion_y_absorben_errores(monkeypatch, job, servicio, valor):
    # Arrange
    db = _DbFalso([])
    monkeypatch.setattr(scheduler, "SessionLocal", lambda: db)
    monkeypatch.setattr(scheduler, servicio, lambda _db: valor)
    # Act: éxito.
    getattr(scheduler, job)()
    # Assert
    assert db.cerrada is True
    # Arrange 2: error del servicio.
    db2 = _DbFalso([])
    monkeypatch.setattr(scheduler, "SessionLocal", lambda: db2)

    def falla(_db):
        raise RuntimeError("job caído")

    monkeypatch.setattr(scheduler, servicio, falla)
    # Act: el job no propaga la excepción.
    getattr(scheduler, job)()
    assert db2.cerrada is True
