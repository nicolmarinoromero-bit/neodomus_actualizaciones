"""Semana 5 del bootcamp — reglas de recomendación de técnicos con dobles.

El cálculo de horas/técnicos es lógica pura sobre productos y agendas: aquí se
sustituyen la BD y la consulta de disponibilidad por dobles para fijar la
regla configurable (jornada, umbral, desplazamiento y especialidades).
"""
from types import SimpleNamespace

import pytest

from app.services import recomendacion_service as rec


class _Especialidad(SimpleNamespace):
    pass


def _producto(**kw):
    base = dict(
        id_producto=1,
        nombre_producto="Producto",
        tiempo_estimado_horas=None,
        dificultad_instalacion=None,
        venta_por_metros=False,
        tecnicos_requeridos=1,
        especializaciones_requeridas=[],
    )
    base.update(kw)
    return SimpleNamespace(**base)


class _DbProductos:
    """Devuelve un producto por consulta, en el orden programado."""

    def __init__(self, productos):
        self.productos = list(productos)
        self.consultas = []

    def query(self, modelo):
        db = self

        class _Q:
            def filter(self, *a, **kw):
                return self

            def first(self):
                db.consultas.append(1)
                return db.productos.pop(0)

        return _Q()


def test_horas_estimadas_prioriza_tiempo_propio_y_normaliza_cantidad():
    # Arrange
    con_tiempo = _producto(tiempo_estimado_horas=2.5, dificultad_instalacion="alta")
    # Act / Assert: el tiempo propio manda sobre la dificultad.
    assert rec.horas_estimadas_producto(con_tiempo, 2) == 5.0
    # Cantidad 0 se normaliza a 1 (regla del servicio: `cantidad or 1`).
    assert rec.horas_estimadas_producto(con_tiempo, 0) == 2.5
    assert rec.horas_estimadas_producto(con_tiempo, None) == 2.5
    # Dificultad conocida, desconocida y ausente.
    assert rec.horas_estimadas_producto(_producto(dificultad_instalacion="Alta")) == 4.0
    assert rec.horas_estimadas_producto(_producto(dificultad_instalacion="rara")) == 1.5
    assert rec.horas_estimadas_producto(_producto()) == 1.5


def test_analizar_items_vacio_devuelve_minimos():
    # Act
    r = rec.analizar_items(_DbProductos([]), [])
    # Assert
    assert r["items"] == []
    assert r["especializaciones_requeridas"] == []
    assert r["tiempo_total_horas"] == 0
    assert r["tecnicos_necesarios"] == 1
    assert r["horas_por_tecnico"] == 1.0


def test_analizar_items_suma_horas_y_agrupa_especialidades():
    # Arrange: 3.5 h por metros + 8 h por cantidad (alta) = 11.5 h.
    e1 = _Especialidad(id_especializacion=2, nombre="Electricidad")
    e2 = _Especialidad(id_especializacion=1, nombre="Carpintería")
    p1 = _producto(
        id_producto=10, nombre_producto="Lámpara", venta_por_metros=True,
        tiempo_estimado_horas=1.0, tecnicos_requeridos=2,
        especializaciones_requeridas=[e1, e2],
    )
    p2 = _producto(
        id_producto=11, nombre_producto="Silla", dificultad_instalacion="alta",
        especializaciones_requeridas=[e2],
    )
    db = _DbProductos([p1, p2])
    # Act
    r = rec.analizar_items(db, [
        {"id_producto": 10, "metros": "3.5"},
        {"id_producto": 11, "cantidad": "2"},
    ])
    # Assert: máximo por producto, jornada, umbral, grupos y desplazamiento.
    assert r["tiempo_total_horas"] == 11.5
    assert r["tecnicos_necesarios"] == 3
    assert r["horas_por_tecnico"] == 2.5
    assert [e["id_especializacion"] for e in r["especializaciones_requeridas"]] == [1, 2]
    assert r["items"][0]["cantidad"] == 3.5
    assert r["items"][1]["cantidad"] == 2.0


def test_analizar_items_tolera_cantidades_invalidas_y_productos_ausentes():
    # Arrange: metros inválidos y cantidad inválida caen a 1; el inexistente se omite.
    p1 = _producto(id_producto=10, venta_por_metros=True, dificultad_instalacion="baja")
    p2 = _producto(id_producto=11)
    db = _DbProductos([None, p1, p2])
    # Act
    r = rec.analizar_items(db, [
        {"id_producto": 99},
        {"id_producto": 10, "metros": "no-numero", "cantidad": "tampoco"},
        {"id_producto": 11, "cantidad": "x"},
    ])
    # Assert
    assert len(r["items"]) == 2
    assert [i["cantidad"] for i in r["items"]] == [1.0, 1.0]
    assert r["tiempo_total_horas"] == 2.5


def test_analizar_items_usa_cantidad_si_no_hay_metros():
    # Arrange
    p = _producto(id_producto=10, venta_por_metros=True)
    # Act
    r = rec.analizar_items(_DbProductos([p]), [{"id_producto": 10, "cantidad": "2"}])
    # Assert
    assert r["items"][0]["cantidad"] == 2.0


def test_analizar_items_topes_de_tecnicos_requeridos_y_config(monkeypatch):
    # Arrange: un producto pide 5 técnicos y otro define 9 h (jornada = 2).
    p1 = _producto(id_producto=10, tecnicos_requeridos=5)
    p2 = _producto(id_producto=11, tiempo_estimado_horas=9.0)
    # Act
    r = rec.analizar_items(_DbProductos([p1, p2]), [{"id_producto": 10}, {"id_producto": 11}])
    # Assert: nunca supera CONFIG["max_tecnicos"].
    assert r["tecnicos_necesarios"] == rec.CONFIG["max_tecnicos"]
    # Jornada 0 no divide por cero y el umbral se puede desactivar.
    monkeypatch.setitem(rec.CONFIG, "jornada_horas", 0)
    monkeypatch.setitem(rec.CONFIG, "umbral_segundo_tecnico_horas", 99)
    monkeypatch.setitem(rec.CONFIG, "horas_por_dificultad", {})
    r2 = rec.analizar_items(_DbProductos([_producto(id_producto=10)]), [{"id_producto": 10}])
    assert r2["tecnicos_necesarios"] == 1


def _tecnico(id_tecnico, nombre, apellido, especialidades, certificacion="Técnico", con_usuario=True):
    usuario = SimpleNamespace(
        first_name=nombre, last_name=apellido,
        foto_url=f"http://fotos/{id_tecnico}.jpg", telefono_usuario="3000000000",
    ) if con_usuario else None
    return SimpleNamespace(
        id_tecnico=id_tecnico,
        usuario=usuario,
        certificacion_t=certificacion,
        especializaciones=especialidades,
    )


def test_recomendar_ordena_por_cobertura_y_datos_del_tecnico(monkeypatch):
    # Arrange
    e1 = _Especialidad(id_especializacion=1, nombre="Carpintería")
    e2 = _Especialidad(id_especializacion=2, nombre="Electricidad")
    p = _producto(id_producto=10, especializaciones_requeridas=[e1, e2])
    completo = _tecnico(1, "Ana", "Todo", [e1, e2])
    parcial = _tecnico(2, "Beto", "Parcial", [e1])
    ninguno = _tecnico(3, "Ciro", "Nada", [], con_usuario=False)
    monkeypatch.setattr(rec, "_tecnicos_activos", lambda db: [parcial, ninguno, completo])
    monkeypatch.setattr(rec, "tecnico_ocupado", lambda *a, **kw: False)
    # Act
    r = rec.recomendar_tecnicos(_DbProductos([p]), [{"id_producto": 10}])
    # Assert: primero quien cubre todo; desempate por cubiertas y nombre.
    assert [t["id_tecnico"] for t in r["tecnicos_sugeridos"]] == [1, 2, 3]
    assert r["tecnicos_sugeridos"][0]["cubre_todo"] is True
    assert r["tecnicos_sugeridos"][1]["cubiertas"] == 1
    assert r["tecnicos_sugeridos"][2]["nombre"] == ""
    assert r["tecnicos_sugeridos"][2]["foto_url"] is None


def test_recomendar_descarta_ocupados_solo_si_hay_fecha(monkeypatch):
    # Arrange
    e1 = _Especialidad(id_especializacion=1, nombre="Carpintería")
    p = _producto(id_producto=10, especializaciones_requeridas=[e1])
    t1 = _tecnico(1, "Ana", "Ocupada", [e1])
    t2 = _tecnico(2, "Beto", "Libre", [e1])
    monkeypatch.setattr(rec, "_tecnicos_activos", lambda db: [t1, t2])
    llamadas = []

    def ocupado(db, id_tecnico, fecha, hora, duracion_horas):
        llamadas.append((id_tecnico, fecha, hora, duracion_horas))
        return id_tecnico == 1

    monkeypatch.setattr(rec, "tecnico_ocupado", ocupado)
    # Act
    r = rec.recomendar_tecnicos(
        _DbProductos([p]), [{"id_producto": 10}], fecha="2026-11-20", hora="10:00",
    )
    # Assert: la ocupada se descarta y la duración respeta el máximo.
    assert [t["id_tecnico"] for t in r["tecnicos_sugeridos"]] == [2]
    assert llamadas == [(1, "2026-11-20", "10:00", 1.5), (2, "2026-11-20", "10:00", 1.5)]


def test_recomendar_sin_requeridas_marca_cubre_todo(monkeypatch):
    # Arrange: carrito vacío.
    t1 = _tecnico(1, "Ana", "Uno", [])
    t2 = _tecnico(2, "Beto", "Dos", [])
    monkeypatch.setattr(rec, "_tecnicos_activos", lambda db: [t1, t2])
    # Act
    r = rec.recomendar_tecnicos(_DbProductos([]), [])
    # Assert
    assert all(t["cubre_todo"] for t in r["tecnicos_sugeridos"])
    assert r["tiempo_total_horas"] == 0
