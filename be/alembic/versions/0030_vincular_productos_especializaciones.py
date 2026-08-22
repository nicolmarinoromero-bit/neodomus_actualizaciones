"""catálogo domótico completo + vinculación automática de TODOS los productos

Revision ID: 0030
Revises: 0029
Create Date: 2026-08-21

- Amplía el catálogo de especializaciones (instalación eléctrica, energía,
  riego, piscinas, motores/persianas).
- Vincula automáticamente CADA producto existente a sus especializaciones
  según palabras clave del nombre (INSERT IGNORE: nunca quita vínculos
  manuales que el administrador haya creado).
"""

from alembic import op
import sqlalchemy as sa

revision = "0030"
down_revision = "0029"
branch_labels = None
depends_on = None


# Especializaciones nuevas que complementan las de la migración 0025.
NUEVAS_ESPECIALIZACIONES = [
    (
        "Instalación eléctrica y cableado",
        "Circuitos, tomas, canalizado y alimentación para dispositivos domóticos",
    ),
    (
        "Energía solar y respaldo eléctrico",
        "Paneles solares, baterías y UPS para el hogar inteligente",
    ),
    (
        "Riego y jardinería inteligente",
        "Programadores, electroválvulas y sensores de humedad",
    ),
    (
        "Piscinas y spas inteligentes",
        "Dosificación, filtración y control remoto de piscinas",
    ),
    (
        "Motores, persianas y cortinas",
        "Automatización de persianas, cortinas y toldos",
    ),
]

# (especialización, palabras clave sobre nombre del producto, en minúsculas)
REGLAS_VINCULACION = [
    (
        "Instalación de cámaras de seguridad",
        ["camara", "cámara", "cctv", "vigilancia", "dvr", "nvr", "grabador"],
    ),
    (
        "Sistemas de alarmas",
        ["alarma", "sirena", "intrus", "antirrobo", "pánico", "panico"],
    ),
    (
        "Cerraduras inteligentes",
        ["cerradura", "chapa", "biométric", "biometric", "huella", "candado"],
    ),
    (
        "Control de acceso",
        ["acceso", "rfid", "tarjeta", "lector", "tag", "llave"],
    ),
    (
        "Iluminación inteligente",
        ["luz", "luces", "iluminaci", "led", "bombilla", "foco", "lámpara", "lampara", "tira", "dimmer", "interruptor"],
    ),
    (
        "Sensores inteligentes",
        ["sensor", "movimiento", "humo", "gas", "apertura", "inundaci", "presencia", "detector"],
    ),
    (
        "Redes y conectividad IoT",
        ["wifi", "wi-fi", "router", "red", "zigbee", "z-wave", "zwave", "hub", "gateway", "bluetooth", "mesh", "repetidor"],
    ),
    (
        "Climatización inteligente",
        ["termostato", "aire acondicionado", "clima", "temperatura", "ventilador", "calefac"],
    ),
    (
        "Audio y video inteligente",
        ["audio", "altavoz", "parlante", "bocina", "soundbar", "video", "portero", "timbre", "multisala", "multiroom"],
    ),
    (
        "Automatización de hogares",
        ["alexa", "google home", "asistente", "automatiza", "escena", "rutina", "central", "domotic", "controlador", "smart"],
    ),
    (
        "Instalación eléctrica y cableado",
        ["electric", "eléctric", "cable", "toma", "enchufe", "tablero", "voltaje", "relé", "rele", "fuente", "transformador", "220", "110v"],
    ),
    (
        "Energía solar y respaldo eléctrico",
        ["solar", "panel", "batería", "bateria", "ups", "inversor"],
    ),
    (
        "Riego y jardinería inteligente",
        ["riego", "aspersor", "electroválvula", "electrovalvula", "jardín", "jardin", "grifo"],
    ),
    (
        "Piscinas y spas inteligentes",
        ["piscina", "spa", "jacuzzi", "cloro", "filtración", "filtracion"],
    ),
    (
        "Motores, persianas y cortinas",
        ["persiana", "cortina", "motor", "toldo", "puerta automática", "puerta automatica"],
    ),
    (
        "Integración de dispositivos domóticos",
        ["integración", "integracion", "compatib", "kit", "paquete", "combo"],
    ),
    (
        "Mantenimiento de sistemas domóticos",
        ["mantenimiento", "reparación", "reparacion", "servicio técnico", "servicio tecnico", "diagnóstico", "diagnostico", "soporte"],
    ),
]


def upgrade() -> None:
    bind = op.get_bind()

    # 1) Completar catálogo (INSERT IGNORE por nombre único).
    for nombre, descripcion in NUEVAS_ESPECIALIZACIONES:
        bind.execute(
            sa.text(
                "INSERT IGNORE INTO especializaciones (nombre, descripcion, activa) "
                "VALUES (:nombre, :descripcion, 1)"
            ),
            {"nombre": nombre, "descripcion": descripcion},
        )

    # 2) Vincular automáticamente cada producto a sus especializaciones por
    #    palabras clave. Idempotente: solo AÑADE vínculos faltantes.
    total = 0
    for esp_nombre, palabras in REGLAS_VINCULACION:
        condiciones = " OR ".join(
            "LOWER(p.nombre_producto) LIKE :kw%d" % i for i in range(len(palabras))
        )
        params: dict = {"esp": esp_nombre}
        for i, kw in enumerate(palabras):
            params[f"kw{i}"] = f"%{kw}%"
        res = bind.execute(
            sa.text(
                "INSERT IGNORE INTO producto_especializacion "
                "(id_producto, id_especializacion) "
                "SELECT p.id_producto, e.id_especializacion "
                f"FROM productos p JOIN especializaciones e ON e.nombre = :esp "
                f"WHERE ({condiciones})"
            ),
            params,
        )
        total += res.rowcount or 0

    print(f"[0030] Vínculos producto↔especialización creados: {total}")


def downgrade() -> None:
    # No se revierten los vínculos automáticos: son datos útiles y la baja del
    # catálogo podría romper citas/entregas ya asignadas.
    pass
