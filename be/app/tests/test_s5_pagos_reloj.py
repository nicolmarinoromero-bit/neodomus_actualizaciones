"""Semana 5 del bootcamp — dobles de reloj/aleatoriedad en el simulador de pagos.

La pasarela es local, pero depende de `datetime.now()` y de `secrets`. Aquí se
fijan ambos con dobles para que las pruebas sean deterministas y se cubren
todas las ramas de validación sin cobrar nada real.
"""
from datetime import datetime

import pytest
from fastapi import HTTPException

from app.config import settings
from app.services import pagos_service as pagos


class _Pago:
    estado = "pendiente"
    fecha_pago = None
    numero_transaccion = "NEO-EFECTY-2026-ABC123"
    codigo_punto_pago = "1234 5678 9012 3456"


def test_resultado_simulacion_por_defecto_validos_e_invalidos():
    assert pagos._resultado_simulacion({}) == "aprobado"
    assert pagos._resultado_simulacion({"resultado_simulacion": " RECHAZADO "}) == "rechazado"
    assert pagos._resultado_simulacion({}, por_defecto="pendiente") == "pendiente"
    # Un valor válido global pero no permitido para el método también falla.
    with pytest.raises(HTTPException) as exc:
        pagos._resultado_simulacion({"resultado_simulacion": "pendiente"})
    assert exc.value.status_code == 400
    with pytest.raises(HTTPException):
        pagos._resultado_simulacion({"resultado_simulacion": "magia"})


@pytest.mark.parametrize(
    "numero,valido",
    [
        ("4242424242424242", True),
        ("4242 4242 4242 4242", True),
        ("4242424242424241", False),
        ("abc", False),
        ("1234", False),
        ("4" * 20, False),
    ],
)
def test_luhn(numero, valido):
    assert pagos._luhn_valida(numero) is valido


def test_fecha_expiracion_valida_ramas(monkeypatch):
    # Reloj fijo: 15/11/2026.
    monkeypatch.setattr(pagos, "datetime", type("FalsoDatetime", (), {
        "now": staticmethod(lambda: datetime(2026, 11, 15, 10, 0, 0)),
    }))
    assert pagos._fecha_expiracion_valida("11/26") is True
    assert pagos._fecha_expiracion_valida("12/26") is True
    assert pagos._fecha_expiracion_valida("10/26") is False  # mes ya pasado
    assert pagos._fecha_expiracion_valida("12/25") is False  # año pasado
    assert pagos._fecha_expiracion_valida("13/26") is False  # mes inválido
    assert pagos._fecha_expiracion_valida("1/26") is False   # formato
    assert pagos._fecha_expiracion_valida("") is False


@pytest.mark.parametrize("cvv,valido", [("123", True), ("1234", True), ("12", False), ("12a", False), ("", False), (None, False)])
def test_validar_cvv(cvv, valido):
    assert pagos._validar_cvv(cvv) is valido


def test_pagar_tarjeta_valida_titular_luhn_fecha_cvv_y_selector():
    base = {
        "numero": "4242424242424242", "titular": "Ana Torres",
        "expiracion": "12/99", "cvv": "123",
    }
    # Arrange: tarjeta de prueba conocida (aprobada).
    r = pagos._pagar_tarjeta(base)
    # Assert
    assert r["estado"] == "aprobado"
    assert r["ultimos_digitos"] == "4242"
    assert r["numero_transaccion"].startswith("NEO-PAY-")
    # Tarjeta documentada que rechaza.
    assert pagos._pagar_tarjeta({**base, "numero": "4242424242420001"})["estado"] == "rechazado"
    # Selector de simulación fuerza el resultado contrario.
    assert pagos._pagar_tarjeta({**base, "resultado_simulacion": "rechazado"})["estado"] == "rechazado"
    # Errores de validación, uno por rama.
    casos = [
        ({**base, "titular": "  "}, "titular"),
        ({**base, "numero": "4242424242424241"}, "Luhn"),
        ({**base, "expiracion": "01/20"}, "fecha de expiraci"),
        ({**base, "cvv": "1"}, "CVV"),
    ]
    for datos, fragmento in casos:
        with pytest.raises(HTTPException) as exc:
            pagos._pagar_tarjeta(datos)
        assert exc.value.status_code == 400 and fragmento.lower() in exc.value.detail.lower()


def test_pagar_pse_valida_banco_y_estado():
    assert pagos._pagar_pse({"banco": "Bancolombia", "titular": " Ana "})["titular"] == "Ana"
    assert pagos._pagar_pse({"banco": "Bancolombia", "resultado_simulacion": "pendiente"})["estado"] == "pendiente"
    with pytest.raises(HTTPException, match="banco"):
        pagos._pagar_pse({})
    with pytest.raises(HTTPException, match="no está soportado"):
        pagos._pagar_pse({"banco": "Banco Falso"})


def test_pagar_paypal_valida_correo_y_estado():
    r = pagos._pagar_paypal({"correo_paypal": "ana@example.com", "titular": "Ana"})
    assert r["correo_paypal"] == "ana@example.com" and r["estado"] == "aprobado"
    assert pagos._pagar_paypal({
        "correo_paypal": "ana@example.com", "resultado_simulacion": "rechazado",
    })["estado"] == "rechazado"
    with pytest.raises(HTTPException, match="PayPal"):
        pagos._pagar_paypal({"correo_paypal": "sin-arroba"})


def test_pagar_punto_pago_genera_referencia_y_fecha_limite(monkeypatch):
    # Reloj fijo para que la fecha límite sea determinista.
    monkeypatch.setattr(pagos, "datetime", type("FalsoDatetime", (), {
        "now": staticmethod(lambda: datetime(2026, 11, 15, 10, 0, 0)),
    }))
    monkeypatch.setattr(pagos.secrets, "randbelow", lambda n: 122)
    r = pagos._pagar_punto_pago({"punto_pago": "Efecty", "titular": "Ana"})
    assert r["estado"] == "pendiente"
    assert r["referencia_pago"] == "NEODOMUS-2026-000123"
    assert r["fecha_limite"].startswith("2026-11-18T10:00:00")
    assert r["titular"] == "Ana"
    with pytest.raises(HTTPException, match="punto de pago"):
        pagos._pagar_punto_pago({"punto_pago": "Ventana"})


def test_generadores_usan_formato_publico(monkeypatch):
    monkeypatch.setattr(pagos.secrets, "choice", lambda alfabeto: alfabeto[0])
    assert pagos._generar_numero_transaccion("PAY").startswith("NEO-PAY-")
    assert pagos._generar_codigo_punto_pago().count(" ") == 3


def test_procesar_pago_delega_y_rechaza_metodo(monkeypatch):
    # Arrange
    llamados = []
    monkeypatch.setitem(pagos.PROCESADORES, "tarjeta_credito", lambda datos: llamados.append(datos) or {"estado": "aprobado"})
    # Act
    r = pagos.procesar_pago("tarjeta_credito", {"numero": "x"}, monto=1000)
    # Assert
    assert r["estado"] == "aprobado" and llamados == [{"numero": "x"}]
    with pytest.raises(HTTPException, match="no soportado"):
        pagos.procesar_pago("bitcoin", {})


def test_confirmar_pago_pendiente_y_reembolso(monkeypatch):
    # Arrange
    pago = _Pago()
    monkeypatch.setattr(pagos, "ahora_utc_naiva", lambda: datetime(2026, 11, 15, 12, 0, 0))
    monkeypatch.setattr(settings, "PAYMENT_PROVIDER", " Simulator ")
    # Act
    confirmado = pagos.confirmar_pago_pendiente(pago)
    reembolso = pagos.procesar_reembolso(12345.678, "NEO-PAY-1")
    # Assert
    assert confirmado["estado"] == "aprobado"
    assert pago.fecha_pago == datetime(2026, 11, 15, 12, 0, 0)
    assert reembolso["aprobado"] is True
    assert reembolso["monto"] == 12345.68
    assert reembolso["proveedor"] == "simulator"
    assert reembolso["referencia_original"] == "NEO-PAY-1"
    assert pagos.metodo_pago_legible("pse") == "PSE (Débito bancario)"
    assert pagos.metodo_pago_legible("otro") == "otro"
