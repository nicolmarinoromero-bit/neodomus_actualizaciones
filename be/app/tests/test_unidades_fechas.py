"""Unitarias de utilidades de fecha/hora — Semana 2 del bootcamp (pytest).

El contenedor del API corre en UTC y las fechas de negocio se guardan naive
en hora de Bogotá (UTC-5, sin horario de verano). Estas pruebas fijan ese
contrato sin base de datos ni reloj simulado (tolerancia de 2 s).
"""
from datetime import timedelta

from app.utils.fechas import BOGOTA_TZ, ahora_utc_naiva, fecha_bogota


def test_ahora_utc_es_naive():
    # Naive = sin tzinfo (comparable con columnas DateTime de la BD).
    assert ahora_utc_naiva().tzinfo is None


def test_fecha_bogota_es_naive():
    assert fecha_bogota().tzinfo is None


def test_bogota_corresponde_a_utc_menos_cinco_horas():
    # Arrange: dos lecturas seguidas del reloj real.
    utc = ahora_utc_naiva()
    bogota = fecha_bogota()
    # Act: si Bogotá es UTC-5, bogota + 5 h debe caer sobre utc.
    delta = abs((bogota + timedelta(hours=5)) - utc)
    # Assert: tolerancia de 2 s por el tiempo entre las dos lecturas.
    assert delta < timedelta(seconds=2), (bogota, utc)
    assert BOGOTA_TZ is not None
