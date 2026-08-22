"""
Servicio: análisis del carrito y recomendación de técnicos.

Dado el carrito (items + servicios), calcula:
  - Especializaciones requeridas por los productos.
  - Dificultad y tiempo estimado de instalación.
  - Cuántos técnicos hacen falta (regla CONFIGURABLE, ver CONFIG).
  - Qué técnicos activos cubren las especializaciones pedidas.

La lógica NO está hardcodeada en el frontend: el frontend consume
POST /pedidos/recomendacion-tecnicos que devuelve este análisis.
"""
from __future__ import annotations

import math
from typing import Iterable, Optional

from sqlalchemy.orm import Session

from app.models.producto import Producto
from app.services.especialidades import (
    _tecnicos_activos,
    tecnico_ocupado,
    DURACION_MAX as DURACION_MAX_TECNICO,
)

# ────────────────────────────────────────────────────────────────
# ⚙️ Configuración de la regla de cálculo (editable sin tocar código
#    del frontend). Si mañana se quiere mover a BD, basta con leerla
#    de una tabla de parámetros y sobrescribir este dict al inicio.
# ────────────────────────────────────────────────────────────────
CONFIG: dict = {
    # Horas efectivas de trabajo por técnico dentro de una cita.
    "jornada_horas": 8.0,
    # Tiempo base por unidad según dificultad cuando el producto no define
    # tiempo_estimado_horas propio.
    "horas_por_dificultad": {"baja": 1.0, "media": 2.0, "alta": 4.0},
    # Tiempo por defecto si no hay dificultad ni tiempo estimado.
    "horas_default": 1.5,
    # Si el tiempo total estimado supera esto, se sugiere un segundo técnico.
    "umbral_segundo_tecnico_horas": 6.0,
    # Si hay productos con especializaciones distintas entre sí, se sugiere
    # un técnico adicional por cada grupo extra hasta este máximo.
    "max_tecnicos": 3,
}


def horas_estimadas_producto(producto: Producto, cantidad: float = 1.0) -> float:
    """Horas estimadas para instalar `cantidad` unidades de un producto."""
    if producto.tiempo_estimado_horas:
        por_unidad = float(producto.tiempo_estimado_horas)
    else:
        dificultad = (producto.dificultad_instalacion or "").strip().lower()
        por_unidad = CONFIG["horas_por_dificultad"].get(
            dificultad, CONFIG["horas_default"]
        )
    return round(por_unidad * max(float(cantidad or 1), 0.0), 2)


def analizar_items(db: Session, items: list[dict]) -> dict:
    """Analiza las líneas de producto del carrito.

    Devuelve:
      items: detalle por línea (producto, cantidad, especializaciones…)
      especializaciones_requeridas: lista única de especializaciones
      tiempo_total_horas: suma de tiempos estimados
      tecnicos_necesarios: entero >= 1 según CONFIG
    """
    detalle_items = []
    ids_especializaciones: set[int] = set()
    nombres_especializaciones: dict[int, str] = {}
    tiempo_total = 0.0

    for item in items or []:
        id_producto = item.get("id_producto")
        producto = db.query(Producto).filter(Producto.id_producto == id_producto).first()
        if not producto:
            continue
        if producto.venta_por_metros:
            try:
                cantidad = float(item.get("metros") or item.get("cantidad") or 1)
            except (TypeError, ValueError):
                cantidad = 1.0
        else:
            try:
                cantidad = float(item.get("cantidad") or 1)
            except (TypeError, ValueError):
                cantidad = 1.0

        horas = horas_estimadas_producto(producto, cantidad)
        tiempo_total += horas

        specs = [
            {
                "id_especializacion": e.id_especializacion,
                "nombre": e.nombre,
            }
            for e in (producto.especializaciones_requeridas or [])
        ]
        for e in (producto.especializaciones_requeridas or []):
            ids_especializaciones.add(e.id_especializacion)
            nombres_especializaciones[e.id_especializacion] = e.nombre

        detalle_items.append(
            {
                "id_producto": producto.id_producto,
                "nombre": producto.nombre_producto,
                "cantidad": cantidad,
                "dificultad_instalacion": producto.dificultad_instalacion,
                "tiempo_estimado_horas": horas,
                "tecnicos_requeridos": producto.tecnicos_requeridos or 1,
                "especializaciones": specs,
            }
        )

    # ── Cálculo configurable de técnicos necesarios ──────────────
    tecnicos_necesarios = 1
    if detalle_items:
        # 1) Base: lo que pida el producto más exigente.
        tecnicos_necesarios = max(
            int(i["tecnicos_requeridos"] or 1) for i in detalle_items
        )
        # 2) Carga de trabajo: tiempo total vs jornada.
        por_jornada = math.ceil(tiempo_total / CONFIG["jornada_horas"]) if CONFIG["jornada_horas"] else 1
        tecnicos_necesarios = max(tecnicos_necesarios, por_jornada)
        # 3) Umbral: mucho trabajo en una sola cita → segundo técnico.
        if tiempo_total > CONFIG["umbral_segundo_tecnico_horas"]:
            tecnicos_necesarios = max(tecnicos_necesarios, 2)
        # 4) Especialidades distintas → un técnico adicional por grupo extra.
        grupos_distintos = len(ids_especializaciones)
        if grupos_distintos > 1:
            tecnicos_necesarios = max(tecnicos_necesarios, min(grupos_distintos + 1, CONFIG["max_tecnicos"]))
        # 5) Desplazamiento: cada técnico dedica máximo DURACION_MAX (2.5 h) a
        #    esta cita porque luego debe moverse a otra agenda → se añaden
        #    técnicos hasta que a cada uno le toque ≤ 2.5 h (y ≥ 1 h).
        if tiempo_total > 0:
            por_desplazamiento = math.ceil(tiempo_total / DURACION_MAX_TECNICO)
            tecnicos_necesarios = max(tecnicos_necesarios, por_desplazamiento)
        tecnicos_necesarios = min(max(tecnicos_necesarios, 1), CONFIG["max_tecnicos"])

    # Horas que TRABAJA cada técnico dentro de la cita: siempre entre 1 y
    # DURACION_MAX_TECNICO (2.5 h) — nunca más, por los desplazamientos.
    horas_por_tecnico = (
        round(min(DURACION_MAX_TECNICO, max(1.0, tiempo_total / tecnicos_necesarios)), 2)
        if tiempo_total > 0
        else 1.0
    )

    return {
        "items": detalle_items,
        "especializaciones_requeridas": [
            {"id_especializacion": i, "nombre": nombres_especializaciones[i]}
            for i in sorted(ids_especializaciones)
        ],
        "tiempo_total_horas": round(tiempo_total, 2),
        "horas_por_tecnico": horas_por_tecnico,
        "tecnicos_necesarios": tecnicos_necesarios,
    }


def recomendar_tecnicos(
    db: Session,
    items: list[dict],
    fecha=None,
    hora: Optional[str] = None,
) -> dict:
    """Analiza el carrito y devuelve los técnicos sugeridos ordenados por
    cobertura de especializaciones (primero los que cubren TODO)."""
    analisis = analizar_items(db, items)
    requeridas = [e["id_especializacion"] for e in analisis["especializaciones_requeridas"]]
    total_req = len(requeridas)

    # Duración que ocupará cada técnico en la agenda (1-2.5 h): el trabajo
    # total se reparte entre los técnicos necesarios (regla de desplazamiento).
    tecnicos = max(1, analisis["tecnicos_necesarios"])
    duracion_por_tecnico = analisis.get(
        "horas_por_tecnico",
        round(min(2.5, max(1.0, analisis["tiempo_total_horas"] / tecnicos)), 2),
    ) if analisis["tiempo_total_horas"] > 0 else 1.0

    sugeridos = []
    for t in _tecnicos_activos(db):
        if fecha is not None and tecnico_ocupado(
            db, t.id_tecnico, fecha, hora, duracion_horas=duracion_por_tecnico
        ):
            continue
        propias = {e.id_especializacion for e in (t.especializaciones or [])}
        cubiertas = len(set(requeridas) & propias)
        resumen = {
            "id_tecnico": t.id_tecnico,
            "nombre": f"{t.usuario.first_name} {t.usuario.last_name}".strip() if t.usuario else "",
            "foto_url": t.usuario.foto_url if t.usuario else None,
            "telefono": t.usuario.telefono_usuario if t.usuario else None,
            "certificacion": t.certificacion_t,
            "especializaciones": [
                {"id_especializacion": e.id_especializacion, "nombre": e.nombre}
                for e in (t.especializaciones or [])
            ],
            "cubiertas": cubiertas,
            "total_requeridas": total_req,
            "cubre_todo": set(requeridas).issubset(propias) if requeridas else True,
        }
        sugeridos.append(resumen)

    # Los que cubren todo primero; luego por número de especialidades cubiertas.
    sugeridos.sort(key=lambda r: (not r["cubre_todo"], -r["cubiertas"], r["nombre"]))

    return {
        **analisis,
        "tecnicos_sugeridos": sugeridos,
    }
