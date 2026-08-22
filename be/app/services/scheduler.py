"""
Módulo: services/scheduler.py

Programador de tareas en segundo plano (APScheduler). Se inicia junto con
la aplicación (lifespan en main.py) y ejecuta cada INTERVALO_MINUTOS:

- procesar_recordatorios_pendientes: avisos de citas próximas.
- expirar_pagos_vencidos: pagos punto de pago vencidos -> pedido cancelado.
"""

import logging

from apscheduler.schedulers.background import BackgroundScheduler

from app.database import SessionLocal
from app.services.tareas_programadas import (
    expirar_pagos_vencidos,
    procesar_recordatorios_pendientes,
)

INTERVALO_MINUTOS = 15

_scheduler: BackgroundScheduler | None = None


def _job_recordatorios() -> None:
    db = SessionLocal()
    try:
        enviados = procesar_recordatorios_pendientes(db)
        if enviados:
            logging.info("Scheduler: %d recordatorio(s) de cita enviados", enviados)
    except Exception as e:
        logging.exception("Error en job de recordatorios: %s", e)
    finally:
        db.close()


def _job_expirar_pagos() -> None:
    db = SessionLocal()
    try:
        expirados = expirar_pagos_vencidos(db)
        if expirados:
            logging.info("Scheduler: %d pago(s) vencido(s) expirado(s)", expirados)
    except Exception as e:
        logging.exception("Error en job de expiración de pagos: %s", e)
    finally:
        db.close()


def iniciar_scheduler() -> None:
    """Arranca el scheduler una sola vez por proceso."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        return
    _scheduler = BackgroundScheduler(timezone="America/Bogota")
    _scheduler.add_job(
        _job_recordatorios,
        "interval",
        minutes=INTERVALO_MINUTOS,
        id="recordatorios_citas",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.add_job(
        _job_expirar_pagos,
        "interval",
        minutes=INTERVALO_MINUTOS,
        id="expirar_pagos",
        max_instances=1,
        coalesce=True,
    )
    _scheduler.start()
    logging.info(
        "Scheduler iniciado (cada %d min): recordatorios y expiración de pagos",
        INTERVALO_MINUTOS,
    )


def detener_scheduler() -> None:
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
    _scheduler = None
