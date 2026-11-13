"""Unitarias de i18n de valores de BD y registro de auditoría — Semana 2.

- `language_from_request`: resolución es/en desde Accept-Language con
  pesos `q` (regla real del API de presentación).
- `traducir_valor`: los valores canónicos de BD se traducen solo si están en
  la lista blanca; los valores propios del cliente pasan intactos.
- `log_login_*`: la auditoría emite JSON con evento, motivo y el correo
  OFUSCADO (nunca el correo completo en el log).

Pruebas puras: sin base de datos ni red (la petición se simula con un stub).
"""
import json
import logging
from types import SimpleNamespace

import pytest

from app.utils import audit_log
from app.utils.database_values_i18n import (
    language_from_request,
    translate_database_value,
)


def peticion(accept_language: str):
    """Stub de Request con solo lo que usa el servicio (headers)."""
    return SimpleNamespace(headers={"accept-language": accept_language})


# ── Resolución de idioma ─────────────────────────────────────────────────────
def test_sin_cabecera_por_defecto_es_ingles_de_respaldo_espanol():
    assert language_from_request(peticion("")) == "es"


def test_idioma_simple_es():
    assert language_from_request(peticion("es")) == "es"


def test_en_con_region_se_reduce_a_en():
    assert language_from_request(peticion("en-US,en;q=0.9")) == "en"


def test_idioma_no_soportado_cae_a_es():
    assert language_from_request(peticion("fr-CA,fr;q=0.9")) == "es"


def test_gana_el_idioma_con_q_mayor():
    assert language_from_request(peticion("es;q=0.4,en;q=0.9")) == "en"


def test_empate_en_q_gana_el_primero_por_orden():
    assert language_from_request(peticion("es;q=0.8,en;q=0.8")) == "es"


def test_q_invalido_descarta_ese_idioma():
    # q corrupto → calidad 0 → se descarta; sin candidatos válidos → es.
    assert language_from_request(peticion("en;q=alto")) == "es"


def test_q_fuera_de_rango_descarta_ese_idioma():
    assert language_from_request(peticion("en;q=1.5,es;q=0.2")) == "es"


# ── Traducción de valores de BD (lista blanca) ──────────────────────────────
def test_valor_conocido_se_traduce_al_ingles():
    assert translate_database_value("pagado", "order_status", "en") == "Paid"
    assert translate_database_value("pagado", "order_status", "es") == "Pagado"


def test_valor_desconocido_pasa_intacto():
    # Los valores propios del cliente NO están en la lista blanca: quedan
    # canónicos (el llamador añade *_label separado).
    assert translate_database_value("Mi estado personalizado", "order_status", "en") == "Mi estado personalizado"


def test_conteo_de_acentos_y_caso_se_normaliza():
    # "Págado" normaliza a "pagado" y se traduce igual que el canónico.
    assert translate_database_value("Págado", "order_status", "en") == "Paid"


def test_categoria_desconocida_devuelve_el_valor_intacto():
    assert translate_database_value("valor", "categoria_inexistente", "en") == "valor"


def test_idioma_invalido_no_traduce():
    # Solo es/en están soportados; cualquier otro idioma devuelve el valor tal cual.
    assert translate_database_value("pagado", "order_status", "fr") == "pagado"


# ── Auditoría: eventos JSON con correo ofuscado ─────────────────────────────
def _ultimo_registro(caplog, evento):
    for record in reversed(caplog.records):
        datos = json.loads(record.getMessage())
        if datos.get("event") == evento:
            return datos
    raise AssertionError(f"No se registró el evento {evento}")


def test_login_exitoso_registra_evento_y_ofusca_el_correo(caplog):
    # Arrange
    correo = "persona.privada@neodomus.com"
    with caplog.at_level(logging.WARNING, logger="security.audit"):
        # Act
        audit_log.log_login_success(correo, "client", ip="10.0.0.1")
    # Assert
    registro = _ultimo_registro(caplog, "LOGIN_SUCCESS")
    assert registro["user_type"] == "client"
    assert registro["ip"] == "10.0.0.1"
    # Nunca el correo completo; el campo email está ofuscado.
    assert correo not in caplog.text
    assert registro["email"] != correo
    assert "@" in registro["email"]


def test_login_fallido_incluye_motivo_y_tipo(caplog):
    with caplog.at_level(logging.WARNING, logger="security.audit"):
        audit_log.log_login_failed("u1@neodomus.com", "invalid_credentials", "employee")
    registro = _ultimo_registro(caplog, "LOGIN_FAILED")
    assert registro["reason"] == "invalid_credentials"
    assert registro["user_type"] == "employee"


def test_registro_es_json_de_una_linea(caplog):
    with caplog.at_level(logging.WARNING, logger="security.audit"):
        audit_log.log_rate_limit_hit("/api/v1/auth/login", ip="127.0.0.1")
    registro = _ultimo_registro(caplog, "RATE_LIMIT_HIT")
    assert registro["endpoint"] == "/api/v1/auth/login"
    assert "\n" not in caplog.records[-1].getMessage()
