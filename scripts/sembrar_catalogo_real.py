"""
Siembra el catálogo REAL de Neodomus (50 productos de domótica).

- Elimina los productos genéricos sembrados antes (referencia NEO-*).
- Crea las categorías faltantes (control, electrodomésticos, energía).
- Inserta los 50 productos reales con precio, stock, marca, descripción,
  técnicos requeridos (0/1/2) y un placeholder de imagen por categoría.
- Idempotente: verifica por referencia única (REAL-###).

Uso dentro del contenedor api:
    docker compose exec api uv run python scripts/sembrar_catalogo_real.py
"""

import io
import sys
from datetime import datetime
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from PIL import Image, ImageDraw  # noqa: E402

from app.database import SessionLocal  # noqa: E402
from app.models.categoria import Categoria  # noqa: E402
from app.models.producto import Producto  # noqa: E402
from app.services import minio_service  # noqa: E402

# Categoría (nombre real) → color e ícono del placeholder.
CATEGORIA_VISUAL = {
    "sensores": ("#2f6fa5", "circulo"),
    "iluminación": ("#d4a017", "brillo"),
    "automatización": ("#1f8a70", "cuadrado"),
    "control": ("#7a4a9e", "triangulo"),
    "seguridad": ("#b03a3a", "escudo"),
    "electrodomésticos": ("#6a6a8a", "caja"),
    "climatización": ("#3a8aa5", "ventilador"),
    "energía": ("#c97a1a", "rayo"),
}

# (nombre, marca, precio, categoría, stock, descripción, técnicos)
PRODUCTOS = [
    ("Sensor de fugas de agua WiFi", "Aqara", 89900, "sensores", 25, "Detecta fugas o acumulación de agua y envía alertas al celular.", 1),
    ("Sensor de vibración inteligente", "Aqara", 74900, "sensores", 20, "Detecta golpes, vibraciones y movimientos inusuales.", 0),
    ("Sensor de luz ambiental", "Sonoff", 59900, "sensores", 30, "Mide la intensidad de luz para automatizar la iluminación.", 1),
    ("Sensor de presencia mmWave", "Aqara", 159900, "sensores", 15, "Detecta presencia incluso cuando la persona permanece quieta.", 1),
    ("Sensor de inclinación inteligente", "Sonoff", 69900, "sensores", 18, "Detecta cambios de posición o inclinación en objetos.", 0),
    ("Sensor de apertura para cajones", "Aqara", 64900, "sensores", 22, "Detecta la apertura de cajones y compartimentos.", 0),
    ("Sensor de congelación", "Shelly", 79900, "sensores", 12, "Detecta temperaturas demasiado bajas y genera alertas.", 0),
    ("Sensor de lluvia inteligente", "Moes", 84900, "sensores", 14, "Detecta lluvia para activar automatizaciones exteriores.", 1),
    ("Sensor de nivel de agua", "Tuya", 99900, "sensores", 16, "Monitorea el nivel de agua en depósitos o tanques.", 1),
    ("Sensor de CO2 inteligente", "Netatmo", 329900, "sensores", 8, "Mide la concentración de CO2 y la calidad del aire interior.", 0),
    ("Bombilla inteligente GU10 WiFi", "Philips Hue", 129900, "iluminación", 20, "Bombilla inteligente regulable con control desde aplicación.", 0),
    ("Bombilla inteligente GU10 RGB", "Wiz", 89900, "iluminación", 24, "Bombilla RGB configurable desde el celular.", 0),
    ("Bombilla inteligente E14 RGB", "Wiz", 79900, "iluminación", 20, "Bombilla compacta con iluminación RGB y control inteligente.", 0),
    ("Bombilla inteligente A60 WiFi", "TP-Link Tapo", 69900, "iluminación", 30, "Bombilla LED inteligente con regulación de brillo.", 0),
    ("Lámpara de mesa inteligente", "Philips Hue", 299900, "iluminación", 10, "Lámpara ambiental con control inteligente y escenas.", 0),
    ("Lámpara de escritorio inteligente", "Yeelight", 219900, "iluminación", 12, "Lámpara regulable con automatización y control móvil.", 0),
    ("Foco inteligente exterior", "Wiz", 159900, "iluminación", 14, "Foco para exteriores con programación y control remoto.", 1),
    ("Luz nocturna inteligente", "Xiaomi", 89900, "iluminación", 25, "Luz ambiental con automatización y ajuste de intensidad.", 0),
    ("Controlador LED inteligente", "Govee", 119900, "iluminación", 18, "Permite controlar y automatizar sistemas de iluminación LED.", 1),
    ("Dimmer inteligente WiFi", "Shelly", 169900, "iluminación", 15, "Control inteligente de intensidad para iluminación compatible.", 1),
    ("Relé inteligente Zigbee 1 canal", "Aqara", 119900, "automatización", 20, "Permite automatizar circuitos eléctricos mediante Zigbee.", 1),
    ("Relé inteligente Zigbee 2 canales", "Sonoff", 139900, "automatización", 18, "Control independiente de dos circuitos eléctricos.", 1),
    ("Micro módulo interruptor inteligente", "Shelly", 149900, "automatización", 16, "Convierte interruptores convencionales en dispositivos inteligentes.", 1),
    ("Módulo de persiana inteligente", "Shelly", 189900, "automatización", 12, "Automatiza motores de persianas compatibles.", 1),
    ("Controlador de motor DC inteligente", "Sonoff", 179900, "automatización", 10, "Permite controlar motores DC mediante automatizaciones.", 1),
    ("Controlador de válvula inteligente", "Tuya", 149900, "automatización", 14, "Automatiza válvulas de agua compatibles.", 1),
    ("Temporizador inteligente programable", "Sonoff", 99900, "automatización", 20, "Permite programar el encendido y apagado de dispositivos.", 1),
    ("Botón inalámbrico inteligente", "Aqara", 69900, "control", 25, "Botón configurable para activar escenas y automatizaciones.", 0),
    ("Botón inteligente de escenas", "Tuya", 79900, "control", 20, "Activa diferentes acciones domóticas con un solo toque.", 0),
    ("Control remoto Zigbee", "Aqara", 109900, "control", 18, "Control inalámbrico para dispositivos y escenas compatibles.", 0),
    ("Teclado inteligente de acceso", "Tuya", 179900, "seguridad", 12, "Teclado digital para controlar accesos inteligentes.", 1),
    ("Sensor de rotura de vidrio", "Aqara", 119900, "seguridad", 15, "Detecta sonidos asociados a rotura de cristales.", 0),
    ("Detector de monóxido de carbono", "Heiman", 129900, "seguridad", 18, "Detecta niveles peligrosos de monóxido de carbono.", 0),
    ("Detector de gas inteligente", "Heiman", 139900, "seguridad", 14, "Detecta fugas de gas y genera alertas.", 1),
    ("Cámara IP 360° WiFi", "TP-Link Tapo", 199900, "seguridad", 15, "Cámara con visión panorámica y monitoreo remoto.", 1),
    ("Cámara IP exterior WiFi", "EZVIZ", 279900, "seguridad", 10, "Cámara resistente para vigilancia de espacios exteriores.", 1),
    ("Cámara IP PTZ inteligente", "Imou", 319900, "seguridad", 8, "Cámara motorizada con movimiento remoto y seguimiento.", 1),
    ("Cerradura inteligente biométrica", "Yale", 799900, "seguridad", 6, "Cerradura con acceso mediante métodos de autenticación inteligente.", 1),
    ("Cerradura inteligente con teclado", "Philips", 649900, "seguridad", 7, "Cerradura digital con apertura mediante código.", 1),
    ("Intercomunicador inteligente WiFi", "Hikvision", 499900, "seguridad", 8, "Sistema de comunicación y control de acceso desde dispositivos móviles.", 1),
    ("Aspiradora robot inteligente", "Xiaomi", 1299900, "electrodomésticos", 8, "Robot aspirador con programación y control desde aplicación.", 0),
    ("Robot limpiador de ventanas", "Ecovacs", 899900, "electrodomésticos", 5, "Robot diseñado para limpiar superficies de vidrio.", 0),
    ("Purificador de aire inteligente", "Xiaomi", 699900, "climatización", 10, "Purifica el aire y permite control mediante aplicación.", 0),
    ("Ventilador inteligente WiFi", "Xiaomi", 399900, "climatización", 10, "Ventilador con control remoto y programación inteligente.", 0),
    ("Humidificador inteligente", "Levoit", 349900, "climatización", 12, "Controla la humedad ambiental mediante programación inteligente.", 0),
    ("Aire acondicionado portátil inteligente", "Midea", 1599900, "climatización", 5, "Aire acondicionado portátil con control inteligente.", 1),
    ("Medidor inteligente de consumo eléctrico", "Shelly", 199900, "energía", 15, "Monitorea el consumo eléctrico en tiempo real.", 1),
    ("Monitor de energía trifásico WiFi", "Shelly", 449900, "energía", 8, "Permite monitorear instalaciones eléctricas trifásicas.", 2),
    ("Interruptor inteligente doble Zigbee", "Aqara", 159900, "control", 15, "Interruptor de dos canales con conectividad Zigbee.", 1),
    ("Interruptor inteligente triple WiFi", "Sonoff", 139900, "control", 15, "Control inteligente de tres circuitos de iluminación.", 1),
]


def _hex_rgb(hex_color: str) -> tuple[int, int, int]:
    h = hex_color.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4))


def _icono(draw: ImageDraw.ImageDraw, tipo: str, cx: int, cy: int, color: tuple) -> None:
    if tipo == "circulo":
        draw.ellipse([cx - 90, cy - 90, cx + 90, cy + 90], fill=color)
    elif tipo == "brillo":
        draw.ellipse([cx - 80, cy - 80, cx + 80, cy + 80], fill=color)
        for dx, dy in ((-120, 0), (120, 0), (0, -120), (0, 120)):
            draw.line([(cx, cy), (cx + dx, cy + dy)], fill=color, width=18)
    elif tipo == "cuadrado":
        draw.rectangle([cx - 90, cy - 90, cx + 90, cy + 90], fill=color)
    elif tipo == "triangulo":
        draw.polygon([(cx, cy - 100), (cx - 100, cy + 80), (cx + 100, cy + 80)], fill=color)
    elif tipo == "escudo":
        draw.polygon([(cx, cy - 110), (cx + 90, cy - 70), (cx + 90, cy + 30), (cx, cy + 120), (cx - 90, cy + 30), (cx - 90, cy - 70)], fill=color)
    elif tipo == "caja":
        draw.rounded_rectangle([cx - 95, cy - 95, cx + 95, cy + 95], radius=28, fill=color)
    elif tipo == "ventilador":
        for dy in (-60, 0, 60):
            draw.line([(cx - 90, cy + dy), (cx + 90, cy + dy)], fill=color, width=20)
    elif tipo == "rayo":
        draw.polygon([(cx + 10, cy - 110), (cx - 60, cy + 20), (cx - 5, cy + 20), (cx - 20, cy + 110), (cx + 60, cy - 20), (cx + 5, cy - 20)], fill=color)


def generar_imagen(color_hex: str, tipo: str) -> bytes:
    W, H = 800, 800
    base = _hex_rgb(color_hex)
    img = Image.new("RGB", (W, H))
    draw = ImageDraw.Draw(img)
    for y in range(H):
        f = y / H
        r = int(base[0] + (250 - base[0]) * f * 0.5)
        g = int(base[1] + (250 - base[1]) * f * 0.5)
        b = int(base[2] + (250 - base[2]) * f * 0.5)
        draw.line([(0, y), (W, y)], fill=(r, g, b))
    _icono(draw, tipo, W // 2, H // 2, (255, 255, 255))
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=90)
    return buf.getvalue()


def _categoria_id(db, nombre: str) -> int:
    cat = db.query(Categoria).filter(Categoria.nombre_categoria == nombre).first()
    if not cat:
        cat = Categoria(nombre_categoria=nombre, descripcion=None)
        db.add(cat)
        db.flush()
    return cat.id_categoria


def main() -> None:
    db = SessionLocal()
    try:
        # 1) Limpiar los genéricos sembrados antes.
        filler = db.query(Producto).filter(Producto.referencia_producto.like("NEO-%")).all()
        for p in filler:
            db.delete(p)
        if filler:
            print(f"[!] Eliminados {len(filler)} productos genéricos (NEO-*)")
        db.flush()

        # 2) Resolver/crear categorías.
        categorias = {c.nombre_categoria: c.id_categoria for c in db.query(Categoria).all()}
        faltantes = {n for _, _, _, n, _, _, _ in PRODUCTOS} - set(categorias)
        for n in faltantes:
            categorias[n] = _categoria_id(db, n)
            print(f"[✓] Categoría creada: {n}")

        # 3) Insertar productos.
        creados = 0
        omitidos = 0
        for i, (nombre, marca, precio, cat, stock, desc, tecnicos) in enumerate(PRODUCTOS, start=1):
            ref = f"REAL-{i:03d}"
            if db.query(Producto).filter(Producto.referencia_producto == ref).first():
                omitidos += 1
                continue

            color, icono = CATEGORIA_VISUAL.get(cat, ("#555555", "circulo"))
            try:
                contenido = generar_imagen(color, icono)
                imagen_url = minio_service.subir_imagen("productos", f"real-{ref.lower()}.jpg", contenido)
            except Exception as e:
                print(f"  [!] {ref}: imagen ({e})")
                imagen_url = None

            db.add(Producto(
                nombre_producto=nombre,
                marca=marca,
                venta_por_metros=0,
                referencia_producto=ref,
                id_proveedor_pr=None,
                precio_compra_producto=round(precio * 0.6),
                precio_venta_producto=precio,
                fecha_registro_producto=datetime.now(),
                imagen_url=imagen_url,
                id_cate_pr=categorias[cat],
                descripcion_producto=desc,
                caracteristicas_producto=None,
                colores_producto=None,
                estado_producto="activo",
                stock_producto=stock,
                descuento_activo=None,
                promocion_hasta=None,
                es_nuevo_producto=False,
                tecnicos_requeridos=tecnicos,
                dificultad_instalacion=("media" if tecnicos > 0 else None),
                tiempo_estimado_horas=(0.5 * tecnicos if tecnicos > 0 else None),
                tiene_medidas=False,
                visible_cliente=True,
            ))
            creados += 1

        db.commit()
        print(f"\nResultado: {creados} productos creados, {omitidos} omitidos")
    except Exception as e:
        db.rollback()
        print(f"\nERROR: {e}", file=sys.stderr)
        sys.exit(1)
    finally:
        db.close()


if __name__ == "__main__":
    main()
