"""Unitarias del servicio de recomendación — Semana 2 del bootcamp (pytest).

Reglas de negocio reales de `recomendacion_service.horas_estimadas_producto`
(cálculo puro de horas de instalación, sin base de datos):
- Un producto con tiempo propio manda sobre la tabla de dificultad.
- La dificultad desconocida cae al tiempo por defecto.
- Cantidad escalona el tiempo y se redondea a 2 decimales.

Objetos `Producto` se simulan con un stub simple (la función solo lee
atributos), de modo que la prueba NO necesita base de datos.
"""
from types import SimpleNamespace

import pytest

from app.services import recomendacion_service as rec


def producto(tiempo=None, dificultad=None):
    """Stub mínimo de Producto con los atributos que lee el servicio."""
    return SimpleNamespace(tiempo_estimado_horas=tiempo,
                           dificultad_instalacion=dificultad)


# ── Tiempo propio del producto ───────────────────────────────────────────────
def test_tiempo_propio_tiene_prioridad_sobre_la_dificultad():
    # Arrange
    p = producto(tiempo=2.5, dificultad="alta")  # alta valdría 4.0
    # Act
    horas = rec.horas_estimadas_producto(p, cantidad=1)
    # Assert
    assert horas == 2.5


def test_tiempo_propio_se_escalona_por_cantidad():
    assert rec.horas_estimadas_producto(producto(tiempo=1.25), cantidad=3) == 3.75


# ── Dificultad declarada ─────────────────────────────────────────────────────
@pytest.mark.parametrize(
    "dificultad, esperado",
    [
        ("baja", 1.0),
        ("media", 2.0),
        ("alta", 4.0),
    ],
)
def test_horas_por_dificultad_configurada(dificultad, esperado):
    assert rec.horas_estimadas_producto(producto(dificultad=dificultad)) == esperado


@pytest.mark.parametrize(
    "dificultad",
    ["desconocida", "", None],
)
def test_dificultad_desconocida_cae_al_tiempo_por_defecto(dificultad):
    # Valores fuera del mapa usan el tiempo por defecto (CONFIG["horas_default"]).
    assert rec.horas_estimadas_producto(producto(dificultad=dificultad)) == rec.CONFIG["horas_default"]


@pytest.mark.parametrize("dificultad, esperado", [("ALTA", 4.0), (" alta ", 4.0), ("Media", 2.0)])
def test_dificultad_se_normaliza_sin_importar_caso_ni_espacios(dificultad, esperado):
    # La regla real aplica strip().lower() antes de buscar en el mapa.
    assert rec.horas_estimadas_producto(producto(dificultad=dificultad)) == esperado


# ── Cantidad: normalización y redondeo ──────────────────────────────────────
def test_cantidad_nula_cuenta_como_una_unidad():
    assert rec.horas_estimadas_producto(producto(dificultad="media"), cantidad=None) == 2.0


def test_cantidad_cero_cuenta_como_una_unidad_comportamiento_actual():
    # Pin de comportamiento actual: `cantidad or 1` convierte 0 en 1. Si el
    # negocio decide que 0 unidades no debe contar, este test se ajusta a
    # propósito (y la regla de `analizar_items` se revisa en conjunto).
    assert rec.horas_estimadas_producto(producto(dificultad="baja"), cantidad=0) == 1.0


def test_cantidad_negativa_se_recorta_a_cero():
    assert rec.horas_estimadas_producto(producto(tiempo=3.0), cantidad=-2) == 0.0


def test_resultado_se_redondea_a_dos_decimales():
    # Arrange: 0.45 * 7 = 3.15 exacto; usar un caso que exija redondeo.
    p = producto(tiempo=0.333)
    # Act
    horas = rec.horas_estimadas_producto(p, cantidad=7)
    # Assert
    assert horas == round(0.333 * 7, 2)
    assert horas == 2.33
