"""
Pruebas del router de productos (`/api/v1/productos`).

Cubre el catálogo público (visibilidad y stock según la lógica real:
``visible_cliente`` y ``stock > STOCK_MINIMO`` o variantes con stock),
filtros de categoría/proveedor, búsqueda, paginación y sus validaciones,
detalle 404, listado de categorías, CRUD de proveedores (solo admin),
solicitud de reabastecimiento, CRUD de productos solo admin, subida de
imagen (MinIO stubeado por el conftest) y variantes de color/talla/medida.

Se ejecuta con la infraestructura de `conftest.py`: BD de pruebas, SMTP
apagado y `minio_service.subir_imagen` simulado (URL falsa).
"""

from __future__ import annotations

import io
from datetime import date

import pytest
from httpx import AsyncClient

from app.models.cita import Cita
from app.models.cita_producto import CitaProducto
from app.models.producto import Producto
from app.models.producto_variante import ProductoVariante
from app.models.proveedor import Proveedor
from app.tests.factories import (
    auth_headers,
    crear_categoria,
    crear_cliente,
    crear_empleado,
    crear_producto,
    crear_tecnico,
)

API = "/api/v1/productos"

# Umbral real definido en app/routers/productos.py (STOCK_MINIMO).
STOCK_MINIMO = 5

# Extensiones permitidas por el router (EXTENSIONES_IMAGEN).
EXT_PERMITIDAS = (".jpg", ".jpeg", ".png", ".webp", ".gif")


# ──────────────────────────────────────────────────────────────
# Helpers locales
# ──────────────────────────────────────────────────────────────
def _png_valido(tamano: int = 8) -> bytes:
    """PNG real y mínimo (valida el check de PIL del endpoint)."""
    from PIL import Image

    buf = io.BytesIO()
    Image.new("RGB", (tamano, tamano), (255, 0, 0)).save(buf, format="PNG")
    return buf.getvalue()


def _crear_proveedor(db, **kw) -> Proveedor:
    datos = dict(
        nombre_proveedor="Proveedor Andino de Prueba",
        contacto_proveedor="María López",
        telefono_proveedor="3009998877",
        correo_proveedor="ventas.proveedor@test.neodomus.com",
        direccion_proveedor="Cra 7 #34-56",
    )
    datos.update(kw)
    obj = Proveedor(**datos)
    db.add(obj)
    db.commit()
    db.refresh(obj)
    db.commit()
    return obj


def _body_producto(**kw) -> dict:
    datos = dict(
        nombre_producto="Cable THHN de prueba",
        precio_venta_producto=18500.0,
        precio_compra_producto=10000.0,
        referencia_producto="REF-UNICA-1",
        stock_producto=10,
    )
    datos.update(kw)
    return datos


def _ids(respuesta: dict) -> set[int]:
    return {p["id_producto"] for p in respuesta["data"]}


async def _admin(client, db):
    """Crea un administrador de prueba y lo loguea; devuelve (usuario, tokens)."""
    from app.tests.factories import login

    usuario = crear_empleado(db, rol="administrador")
    tokens = await login(client, usuario.email, "Test1234!", "employee")
    return usuario, tokens


# ──────────────────────────────────────────────────────────────
# Catálogo público
# ──────────────────────────────────────────────────────────────
async def test_listar_productos_publico_solo_visibles_y_con_stock(client, db):
    """El catálogo público solo muestra productos visibles y con
    stock estrictamente mayor al mínimo (5)."""
    visible = crear_producto(
        db, nombre_producto="Lámpara pública xyz", referencia_producto="REF-PUB-1"
    )
    oculto = crear_producto(
        db,
        nombre_producto="Lámpara oculta xyz",
        referencia_producto="REF-PUB-2",
        visible_cliente=False,
    )
    sin_stock = crear_producto(
        db,
        nombre_producto="Lámpara agotada xyz",
        referencia_producto="REF-PUB-3",
        stock_producto=STOCK_MINIMO,
    )

    resp = await client.get(f"{API}/")
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert set(cuerpo) >= {"total", "page", "limit", "data", "total_pages"}
    ids = _ids(cuerpo)
    assert visible.id_producto in ids
    assert oculto.id_producto not in ids
    assert sin_stock.id_producto not in ids
    assert cuerpo["total"] == len(cuerpo["data"])


async def test_listar_productos_publico_incluye_producto_con_stock_en_variante(client, db):
    """Un producto sin stock propio entra al catálogo si tiene una variante
    con stock suficiente."""
    producto = crear_producto(
        db,
        nombre_producto="Persiana con variante xyz",
        referencia_producto="REF-VAR-PUB",
        stock_producto=0,
    )
    db.add(
        ProductoVariante(
            id_producto=producto.id_producto,
            nombre="Blanco",
            hex="#ffffff",
            stock=20,
        )
    )
    db.commit()

    resp = await client.get(f"{API}/")
    assert resp.status_code == 200
    assert producto.id_producto in _ids(resp.json())


async def test_listar_productos_admin_ve_invisibles_y_sin_stock(client, db, admin_logueado):
    """Un administrador autenticado ve el catálogo completo (sin filtros
    de visibilidad/stock que aplican al público)."""
    _, tokens = admin_logueado
    oculto = crear_producto(
        db,
        nombre_producto="Producto oculto admin xyz",
        referencia_producto="REF-ADM-1",
        visible_cliente=False,
    )
    agotado = crear_producto(
        db,
        nombre_producto="Producto agotado admin xyz",
        referencia_producto="REF-ADM-2",
        stock_producto=0,
    )

    resp = await client.get(f"{API}/", headers=auth_headers(tokens))
    assert resp.status_code == 200
    ids = _ids(resp.json())
    assert oculto.id_producto in ids
    assert agotado.id_producto in ids


async def test_listar_productos_filtro_categoria(client, db):
    """El parámetro `categoria` filtra por id de categoría."""
    cat_a = crear_categoria(db, nombre_categoria="Iluminación xyz")
    cat_b = crear_categoria(db, nombre_categoria="Seguridad xyz")
    p_a = crear_producto(
        db,
        nombre_producto="Foco inteligente xyz",
        referencia_producto="REF-CAT-A",
        id_cate_pr=cat_a.id_categoria,
    )
    p_b = crear_producto(
        db,
        nombre_producto="Cámara vigilancia xyz",
        referencia_producto="REF-CAT-B",
        id_cate_pr=cat_b.id_categoria,
    )

    resp = await client.get(f"{API}/", params={"categoria": cat_a.id_categoria})
    assert resp.status_code == 200
    assert _ids(resp.json()) == {p_a.id_producto}


async def test_listar_productos_filtro_proveedor(client, db):
    """El parámetro `proveedor` filtra por id de proveedor."""
    prov = _crear_proveedor(db)
    p_prov = crear_producto(
        db,
        nombre_producto="Cable cobre xyz",
        referencia_producto="REF-PROV-A",
        id_proveedor_pr=prov.id_proveedor,
    )
    crear_producto(db, nombre_producto="Interruptor xyz", referencia_producto="REF-PROV-B")

    resp = await client.get(f"{API}/", params={"proveedor": prov.id_proveedor})
    assert resp.status_code == 200
    assert _ids(resp.json()) == {p_prov.id_producto}


async def test_listar_productos_busqueda(client, db):
    """`search` hace coincidencia parcial (ilike) sobre el nombre."""
    crear_producto(db, nombre_producto="Termostato con wifi xyz", referencia_producto="REF-BUS-1")
    crear_producto(db, nombre_producto="Aspersor de jardín xyz", referencia_producto="REF-BUS-2")

    resp = await client.get(f"{API}/", params={"search": "termostato"})
    assert resp.status_code == 200
    assert resp.json()["total"] == 1
    assert "Termostato" in resp.json()["data"][0]["nombre_producto"]

    vacio = await client.get(f"{API}/", params={"search": "zzz-sin-coincidencias"})
    assert vacio.status_code == 200
    assert vacio.json()["total"] == 0
    assert vacio.json()["data"] == []


async def test_listar_productos_paginacion(client, db):
    """`limit`/`page` calculan total_pages y parten la respuesta."""
    for i in range(3):
        crear_producto(
            db,
            nombre_producto=f"Página paginación xyz {i}",
            referencia_producto=f"REF-PAG-{i}",
        )

    primera = await client.get(f"{API}/", params={"limit": 2, "page": 1})
    assert primera.status_code == 200
    cuerpo = primera.json()
    assert cuerpo["total"] == 3
    assert cuerpo["limit"] == 2
    assert cuerpo["total_pages"] == 2
    assert len(cuerpo["data"]) == 2

    segunda = await client.get(f"{API}/", params={"limit": 2, "page": 2})
    assert segunda.status_code == 200
    assert len(segunda.json()["data"]) == 1
    assert segunda.json()["page"] == 2


@pytest.mark.parametrize("params", [{"page": 0}, {"page": -1}])
async def test_listar_productos_pagina_invalida_422(client, params):
    """`page` exige ge=1: páginas 0 o negativas responden 422."""
    resp = await client.get(f"{API}/", params=params)
    assert resp.status_code == 422


@pytest.mark.parametrize("limit", [0, -5, 101])
async def test_listar_productos_limit_invalido_422(client, limit):
    """`limit` exige 1..100: 0, negativos o 101 responden 422."""
    resp = await client.get(f"{API}/", params={"limit": limit})
    assert resp.status_code == 422


async def test_listar_productos_filtro_estado_inactivo(client, db):
    """`estado=inactivo` lista solo productos inactivos (si el público
    además los ve: visibles y con stock)."""
    inactivo = crear_producto(
        db,
        nombre_producto="Producto dado de baja xyz",
        referencia_producto="REF-INACT-1",
        estado_producto="inactivo",
    )

    por_defecto = await client.get(f"{API}/")
    assert por_defecto.status_code == 200
    assert inactivo.id_producto not in _ids(por_defecto.json())

    filtrado = await client.get(f"{API}/", params={"estado": "inactivo"})
    assert filtrado.status_code == 200
    assert _ids(filtrado.json()) == {inactivo.id_producto}


async def test_listar_productos_no_expone_datos_sensibles(client, db):
    """La respuesta del catálogo no incluye claves de credenciales."""
    resp = await client.get(f"{API}/")
    assert resp.status_code == 200
    texto = resp.text
    for prohibido in ("password_hash", "password", "access_token"):
        assert prohibido not in texto


# ──────────────────────────────────────────────────────────────
# Categorías
# ──────────────────────────────────────────────────────────────
async def test_listar_categorias_publico(client, db):
    """GET /productos/categorias es público y devuelve el catálogo."""
    cat = crear_categoria(db, nombre_categoria="Categoría pública xyz")

    resp = await client.get(f"{API}/categorias")
    assert resp.status_code == 200
    assert isinstance(resp.json(), list)
    assert {c["id_categoria"] for c in resp.json()} >= {cat.id_categoria}
    assert all("nombre_categoria" in c for c in resp.json())


# ──────────────────────────────────────────────────────────────
# Proveedores (solo administrador)
# ──────────────────────────────────────────────────────────────
async def test_listar_proveedores_sin_token_401(client):
    """GET /productos/proveedores sin token responde 401."""
    resp = await client.get(f"{API}/proveedores")
    assert resp.status_code == 401


async def test_listar_proveedores_cliente_responde_401(client, cliente_logueado):
    """El token de un CLIENTE no da acceso a endpoints de empleado: el
    código responde 401 (no 403), para que el frontend cierre sesión."""
    _, tokens = cliente_logueado
    resp = await client.get(f"{API}/proveedores", headers=auth_headers(tokens))
    assert resp.status_code == 401


async def test_listar_proveedores_tecnico_responde_403(client, tecnico_logueado):
    """Un técnico autenticado NO es administrador: recibe 403."""
    _, _, tokens = tecnico_logueado
    resp = await client.get(f"{API}/proveedores", headers=auth_headers(tokens))
    assert resp.status_code == 403
    assert resp.json()["detail"] == "Permisos insuficientes"


async def test_listar_proveedores_admin(client, db, admin_logueado):
    """El administrador lista los proveedores existentes."""
    _, tokens = admin_logueado
    prov = _crear_proveedor(db, nombre_proveedor="Almacén El Dorado xyz")

    resp = await client.get(f"{API}/proveedores", headers=auth_headers(tokens))
    assert resp.status_code == 200
    assert prov.id_proveedor in {p["id_proveedor"] for p in resp.json()}


async def test_crear_proveedor_exito(client, db, admin_logueado):
    """POST /productos/proveedores crea el registro (201) para admin."""
    _, tokens = admin_logueado
    cuerpo = {
        "nombre_proveedor": "Distribuciones Noboa xyz",
        "contacto_proveedor": "Ana Noboa",
        "telefono_proveedor": "3112223344",
        "correo_proveedor": "contacto.noboa@test.neodomus.com",
        "direccion_proveedor": "Av 6 #12-45",
    }
    resp = await client.post(
        f"{API}/proveedores", json=cuerpo, headers=auth_headers(tokens)
    )
    assert resp.status_code == 201
    assert resp.json()["nombre_proveedor"] == cuerpo["nombre_proveedor"]
    assert resp.json()["correo_proveedor"] == cuerpo["correo_proveedor"]
    assert db.query(Proveedor).filter_by(id_proveedor=resp.json()["id_proveedor"]).count() == 1


async def test_crear_proveedor_correo_duplicado_400(client, db, admin_logueado):
    """No se permite un segundo proveedor con el mismo correo (400)."""
    _, tokens = admin_logueado
    _crear_proveedor(db, correo_proveedor="duplicado@test.neodomus.com")

    resp = await client.post(
        f"{API}/proveedores",
        json={
            "nombre_proveedor": "Otro proveedor xyz",
            "correo_proveedor": "duplicado@test.neodomus.com",
        },
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "correo" in resp.json()["detail"].lower()


async def test_crear_proveedor_nombre_en_blanco_400(client, admin_logueado):
    """Un nombre solo con espacios responde 400 (validación de negocio)."""
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}/proveedores",
        json={"nombre_proveedor": "   "},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400


async def test_crear_proveedor_sin_nombre_422(client, admin_logueado):
    """`nombre_proveedor` es obligatorio en el esquema: falta → 422."""
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}/proveedores",
        json={"correo_proveedor": "sin.nombre@test.neodomus.com"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 422


async def test_crear_proveedor_sin_token_401(client):
    resp = await client.post(
        f"{API}/proveedores", json={"nombre_proveedor": "Sin auth xyz"}
    )
    assert resp.status_code == 401


async def test_crear_proveedor_cliente_401(client, cliente_logueado):
    """El cliente no administra proveedores (401 por tipo de sesión)."""
    _, tokens = cliente_logueado
    resp = await client.post(
        f"{API}/proveedores",
        json={"nombre_proveedor": "Cliente intenta xyz"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 401


async def test_actualizar_proveedor_exito(client, db, admin_logueado):
    """PUT /productos/proveedores/{id} actualiza los datos."""
    _, tokens = admin_logueado
    prov = _crear_proveedor(db, nombre_proveedor="Nombre viejo xyz")

    resp = await client.put(
        f"{API}/proveedores/{prov.id_proveedor}",
        json={
            "nombre_proveedor": "Nombre nuevo xyz",
            "telefono_proveedor": "3000001111",
            "correo_proveedor": prov.correo_proveedor,
        },
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["nombre_proveedor"] == "Nombre nuevo xyz"
    db.expire_all()
    assert prov.telefono_proveedor == "3000001111"


async def test_actualizar_proveedor_inexistente_404(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.put(
        f"{API}/proveedores/999999",
        json={"nombre_proveedor": "Fantasma xyz"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404


async def test_actualizar_proveedor_correo_duplicado_400(client, db, admin_logueado):
    """No se puede copiar el correo de otro proveedor (400)."""
    _, tokens = admin_logueado
    _crear_proveedor(db, correo_proveedor="original@test.neodomus.com")
    otro = _crear_proveedor(
        db, nombre_proveedor="Segundo proveedor xyz", correo_proveedor="otro@test.neodomus.com"
    )

    resp = await client.put(
        f"{API}/proveedores/{otro.id_proveedor}",
        json={
            "nombre_proveedor": "Segundo proveedor xyz",
            "correo_proveedor": "original@test.neodomus.com",
        },
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400


async def test_reabastecimiento_responde_500_por_error_de_formato(client, db, admin_logueado):
    """HALLAZGO (bug real): con ítems válidos el endpoint revienta.

    En `app/routers/productos.py` la plantilla de la fila HTML usa 6
    marcadores `%s` pero se le pasan 7 argumentos → `TypeError`, que el
    servidor convierte en 500. Es decir, la solicitud de reabastecimiento
    NUNCA puede completarse con al menos un producto seleccionado.
    Se documenta el comportamiento ACTUAL (ver hallazgos/productos_citas.md).
    """
    _, tokens = admin_logueado
    prov = _crear_proveedor(db, correo_proveedor="reabastecer@test.neodomus.com")
    prod = crear_producto(
        db,
        nombre_producto="Tornillos autorroscables xyz",
        referencia_producto="REF-REAB-1",
        id_proveedor_pr=prov.id_proveedor,
    )

    with pytest.raises(TypeError):
        await client.post(
            f"{API}/proveedores/{prov.id_proveedor}/solicitar-reabastecimiento",
            json=[{"id_producto": prod.id_producto, "cantidad": 25}],
            headers=auth_headers(tokens),
        )


async def test_reabastecimiento_proveedor_inexistente_404(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}/proveedores/999999/solicitar-reabastecimiento",
        json=[{"id_producto": 1, "cantidad": 5}],
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404


async def test_reabastecimiento_proveedor_sin_correo_400(client, db, admin_logueado):
    """Un proveedor sin correo configurado no puede recibir la solicitud."""
    _, tokens = admin_logueado
    prov = _crear_proveedor(db, correo_proveedor=None)
    prod = crear_producto(
        db,
        nombre_producto="Clavos xyz",
        referencia_producto="REF-REAB-2",
        id_proveedor_pr=prov.id_proveedor,
    )
    resp = await client.post(
        f"{API}/proveedores/{prov.id_proveedor}/solicitar-reabastecimiento",
        json=[{"id_producto": prod.id_producto, "cantidad": 3}],
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400


async def test_reabastecimiento_sin_items_validos_400(client, db, admin_logueado):
    """Sin ítems (lista vacía) la solicitud se rechaza con 400."""
    _, tokens = admin_logueado
    prov = _crear_proveedor(db, correo_proveedor="vacio@test.neodomus.com")
    resp = await client.post(
        f"{API}/proveedores/{prov.id_proveedor}/solicitar-reabastecimiento",
        json=[],
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400


async def test_reabastecimiento_sin_token_401(client, db):
    prov = _crear_proveedor(db, correo_proveedor="sin.token@test.neodomus.com")
    resp = await client.post(
        f"{API}/proveedores/{prov.id_proveedor}/solicitar-reabastecimiento",
        json=[{"id_producto": 1, "cantidad": 1}],
    )
    assert resp.status_code == 401


# ──────────────────────────────────────────────────────────────
# Detalle de producto
# ──────────────────────────────────────────────────────────────
async def test_obtener_producto_inexistente_404(client):
    resp = await client.get(f"{API}/999999")
    assert resp.status_code == 404
    assert resp.json()["detail"] == "Producto no encontrado"


async def test_obtener_producto_publico_ok(client, db):
    """El público ve el detalle de un producto activo, visible y con stock."""
    prod = crear_producto(
        db, nombre_producto="Detector de humo xyz", referencia_producto="REF-DET-1"
    )
    resp = await client.get(f"{API}/{prod.id_producto}")
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["id_producto"] == prod.id_producto
    assert cuerpo["stock_estado"] == "disponible"
    assert cuerpo["visible_cliente"] is True


async def test_obtener_producto_publico_sin_stock_404(client, db):
    """Sin stock suficiente el detalle NO es visible para el público."""
    prod = crear_producto(
        db,
        nombre_producto="Llave inglesa xyz",
        referencia_producto="REF-NOSTOCK",
        stock_producto=STOCK_MINIMO,
    )
    resp = await client.get(f"{API}/{prod.id_producto}")
    assert resp.status_code == 404


async def test_obtener_producto_publico_inactivo_404(client, db):
    prod = crear_producto(
        db,
        nombre_producto="Producto retirado xyz",
        referencia_producto="REF-RET-1",
        estado_producto="inactivo",
    )
    anonimo = await client.get(f"{API}/{prod.id_producto}")
    assert anonimo.status_code == 404

    _, tokens = await _admin(client, db)
    admin = await client.get(f"{API}/{prod.id_producto}", headers=auth_headers(tokens))
    assert admin.status_code == 200
    assert admin.json()["estado_producto"] == "inactivo"


async def test_obtener_producto_stock_bajo(client, db):
    """Stock entre 1 y STOCK_MINIMO-1 se reporta como 'bajo'."""
    prod = crear_producto(
        db,
        nombre_producto="Enchufe modular xyz",
        referencia_producto="REF-BAJO-1",
        stock_producto=STOCK_MINIMO - 1,
    )
    # El público no lo ve (stock no supera el mínimo)…
    assert (await client.get(f"{API}/{prod.id_producto}")).status_code == 404
    # …pero el admin sí y ve el estado de stock calculado.
    _, tokens = await _admin(client, db)
    resp = await client.get(f"{API}/{prod.id_producto}", headers=auth_headers(tokens))
    assert resp.status_code == 200
    assert resp.json()["stock_estado"] == "bajo"


# ──────────────────────────────────────────────────────────────
# Variantes (color / talla / medidas)
# ──────────────────────────────────────────────────────────────
async def test_listar_variantes_publico(client, db):
    """GET /productos/{id}/variantes es público y serializa las variantes."""
    prod = crear_producto(
        db, nombre_producto="Puerta inteligente xyz", referencia_producto="REF-VAR-1"
    )
    db.add(
        ProductoVariante(
            id_producto=prod.id_producto,
            nombre="Negro",
            hex="#000000",
            ancho_cm=90,
            alto_cm=210,
            stock=4,
        )
    )
    db.commit()

    resp = await client.get(f"{API}/{prod.id_producto}/variantes")
    assert resp.status_code == 200
    assert len(resp.json()) == 1
    variante = resp.json()[0]
    assert variante["nombre"] == "Negro"
    assert variante["etiqueta_medida"] == "90 cm por 210 cm"


async def test_listar_variantes_producto_inexistente_404(client):
    resp = await client.get(f"{API}/999999/variantes")
    assert resp.status_code == 404


async def test_crear_variante_admin_exito(client, db, admin_logueado):
    _, tokens = admin_logueado
    prod = crear_producto(
        db, nombre_producto="Cortina motorizada xyz", referencia_producto="REF-VAR-2"
    )
    resp = await client.post(
        f"{API}/{prod.id_producto}/variantes",
        json={"nombre": "Blanco", "hex": "#ffffff", "precio": 25000, "stock": 7},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["nombre"] == "Blanco"
    assert resp.json()["stock"] == 7
    assert db.query(ProductoVariante).count() == 1


async def test_crear_variante_permisos(client, db):
    """Crear variantes exige sesión de administrador."""
    prod = crear_producto(
        db, nombre_producto="Regleta con wifi xyz", referencia_producto="REF-VAR-3"
    )
    cuerpo = {"nombre": "Rojo", "hex": "#ff0000"}

    sin_token = await client.post(f"{API}/{prod.id_producto}/variantes", json=cuerpo)
    assert sin_token.status_code == 401

    usuario = crear_empleado(db, rol="tecnico")
    crear_tecnico(db, usuario=usuario)
    from app.tests.factories import login

    tokens = await login(client, usuario.email, "Test1234!", "employee")
    tecnico = await client.post(
        f"{API}/{prod.id_producto}/variantes", json=cuerpo, headers=auth_headers(tokens)
    )
    assert tecnico.status_code == 403

    cliente = crear_cliente(db)
    tokens_cliente = await login(client, cliente.email, "Test1234!", "client")
    cliente_resp = await client.post(
        f"{API}/{prod.id_producto}/variantes", json=cuerpo, headers=auth_headers(tokens_cliente)
    )
    assert cliente_resp.status_code == 401


async def test_crear_variante_nombre_en_blanco_400(client, db, admin_logueado):
    _, tokens = admin_logueado
    prod = crear_producto(
        db, nombre_producto="Bombilla xyz", referencia_producto="REF-VAR-4"
    )
    resp = await client.post(
        f"{API}/{prod.id_producto}/variantes",
        json={"nombre": "   "},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400


async def test_crear_variante_producto_inexistente_404(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}/999999/variantes",
        json={"nombre": "Rojo"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404


async def test_editar_variante_exito(client, db, admin_logueado):
    _, tokens = admin_logueado
    prod = crear_producto(
        db, nombre_producto="Ventilador de techo xyz", referencia_producto="REF-VAR-5"
    )
    variante = ProductoVariante(id_producto=prod.id_producto, nombre="Gris", stock=1)
    db.add(variante)
    db.commit()
    db.refresh(variante)

    resp = await client.put(
        f"{API}/{prod.id_producto}/variantes/{variante.id}",
        json={"nombre": "Gris oscuro", "hex": "#444444", "stock": 12},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["nombre"] == "Gris oscuro"
    assert resp.json()["stock"] == 12


async def test_editar_variante_inexistente_404(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.put(
        f"{API}/999999/variantes/999999",
        json={"nombre": "Fantasma"},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404


async def test_eliminar_variante_exito(client, db, admin_logueado):
    _, tokens = admin_logueado
    prod = crear_producto(
        db, nombre_producto="Llave digital xyz", referencia_producto="REF-VAR-6"
    )
    variante = ProductoVariante(id_producto=prod.id_producto, nombre="Dorado", stock=2)
    db.add(variante)
    db.commit()
    db.refresh(variante)

    resp = await client.delete(
        f"{API}/{prod.id_producto}/variantes/{variante.id}",
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["msg"] == "Variante eliminada correctamente"
    assert db.query(ProductoVariante).count() == 0


async def test_eliminar_variante_inexistente_404(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.delete(
        f"{API}/999999/variantes/999999", headers=auth_headers(tokens)
    )
    assert resp.status_code == 404


# ──────────────────────────────────────────────────────────────
# Subida de imagen (MinIO simulado por el conftest)
# ──────────────────────────────────────────────────────────────
async def test_upload_imagen_sin_token_401(client):
    resp = await client.post(
        f"{API}/upload-imagen", files={"file": ("foto.png", _png_valido(), "image/png")}
    )
    assert resp.status_code == 401


async def test_upload_imagen_cliente_401(client, cliente_logueado):
    _, tokens = cliente_logueado
    resp = await client.post(
        f"{API}/upload-imagen",
        files={"file": ("foto.png", _png_valido(), "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 401


async def test_upload_imagen_tecnico_403(client, tecnico_logueado):
    _, _, tokens = tecnico_logueado
    resp = await client.post(
        f"{API}/upload-imagen",
        files={"file": ("foto.png", _png_valido(), "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 403


async def test_upload_imagen_extension_invalida_400(client, admin_logueado):
    """Solo se aceptan JPG, PNG, WEBP o GIF."""
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}/upload-imagen",
        files={"file": ("documento.exe", b"contenido", "application/octet-stream")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "Formato no permitido" in resp.json()["detail"]


async def test_upload_imagen_vacia_400(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}/upload-imagen",
        files={"file": ("vacia.png", b"", "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "vacío" in resp.json()["detail"]


async def test_upload_imagen_supera_5mb_400(client, admin_logueado):
    """Archivos mayores a 5 MB se rechazan (400)."""
    _, tokens = admin_logueado
    grande = b"a" * (5 * 1024 * 1024 + 1)
    resp = await client.post(
        f"{API}/upload-imagen",
        files={"file": ("grande.png", grande, "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "5 MB" in resp.json()["detail"]


async def test_upload_imagen_no_es_imagen_400(client, admin_logueado):
    """Con extensión válida pero contenido que PIL no valida → 400."""
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}/upload-imagen",
        files={"file": ("falsa.png", b"esto no es una imagen", "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "no es una imagen válida" in resp.json()["detail"]


async def test_upload_imagen_exito(client, admin_logueado):
    """Sube un PNG real y devuelve la URL del MinIO simulado."""
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}/upload-imagen",
        files={"file": ("producto.png", _png_valido(), "image/png")},
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["url"].startswith("http://test-minio:9000/neodomus-media/productos/")
    assert cuerpo["filename"].endswith(".png")


# ──────────────────────────────────────────────────────────────
# CRUD de productos (solo administrador)
# ──────────────────────────────────────────────────────────────
async def test_crear_producto_exito(client, db, admin_logueado):
    _, tokens = admin_logueado
    cat = crear_categoria(db, nombre_categoria="Cableado xyz")

    resp = await client.post(
        f"{API}",
        json=_body_producto(
            nombre_producto="Cable THHN xyz",
            referencia_producto="REF-CRUD-1",
            id_cate_pr=cat.id_categoria,
            dificultad_instalacion="baja",
        ),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    cuerpo = resp.json()
    assert cuerpo["id_producto"]
    assert cuerpo["referencia_producto"] == "REF-CRUD-1"
    assert cuerpo["estado_producto"] == "activo"
    assert cuerpo["stock_estado"] == "disponible"
    assert cuerpo["nombre_categoria"] == "Cableado xyz"

    guardado = db.query(Producto).filter_by(id_producto=cuerpo["id_producto"]).first()
    assert guardado is not None
    assert guardado.referencia_producto == "REF-CRUD-1"


async def test_crear_producto_referencia_duplicada_400(client, db, admin_logueado):
    _, tokens = admin_logueado
    crear_producto(db, referencia_producto="REF-DUP-1", nombre_producto="Original xyz")

    resp = await client.post(
        f"{API}",
        json=_body_producto(nombre_producto="Copia xyz", referencia_producto="REF-DUP-1"),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "La referencia ya está en uso"


async def test_crear_producto_sin_campos_obligatorios_422(client, admin_logueado):
    """Sin nombre ni precio de venta el esquema responde 422."""
    _, tokens = admin_logueado

    sin_nombre = await client.post(f"{API}", json={}, headers=auth_headers(tokens))
    assert sin_nombre.status_code == 422

    sin_precio = await client.post(
        f"{API}",
        json={"nombre_producto": "Solo nombre xyz"},
        headers=auth_headers(tokens),
    )
    assert sin_precio.status_code == 422


async def test_crear_producto_nombre_en_blanco_400(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}",
        json=_body_producto(nombre_producto="    ", referencia_producto="REF-VACIO"),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400


async def test_crear_producto_dificultad_invalida_400(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}",
        json=_body_producto(
            nombre_producto="Dificultad rara xyz",
            referencia_producto="REF-DIF-1",
            dificultad_instalacion="imposible",
        ),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "baja, media o alta" in resp.json()["detail"]


async def test_crear_producto_especializaciones_invalidas_400(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.post(
        f"{API}",
        json=_body_producto(
            nombre_producto="Producto con especialización xyz",
            referencia_producto="REF-ESP-1",
            especializaciones_ids=[999999],
        ),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 400
    assert "Especializaciones no válidas" in resp.json()["detail"]


async def test_crear_producto_sin_token_401(client):
    """POST /productos sin token responde 401."""
    resp = await client.post(
        f"{API}", json=_body_producto(nombre_producto="Sin token xyz", referencia_producto="REF-NT-1")
    )
    assert resp.status_code == 401


async def test_crear_producto_cliente_401(client, db, cliente_logueado):
    _, tokens = cliente_logueado
    resp = await client.post(
        f"{API}",
        json=_body_producto(nombre_producto="Cliente xyz", referencia_producto="REF-CL-1"),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 401


async def test_crear_producto_tecnico_403(client, tecnico_logueado):
    _, _, tokens = tecnico_logueado
    resp = await client.post(
        f"{API}",
        json=_body_producto(nombre_producto="Técnico xyz", referencia_producto="REF-TE-1"),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 403


async def test_editar_producto_exito(client, db, admin_logueado):
    """PUT /productos/{id} actualiza precio, stock y estado."""
    _, tokens = admin_logueado
    prod = crear_producto(
        db, nombre_producto="Motor de persiana xyz", referencia_producto="REF-PUT-1"
    )

    resp = await client.put(
        f"{API}/{prod.id_producto}",
        json=_body_producto(
            nombre_producto="Motor de persiana xyz",
            referencia_producto="REF-PUT-1",
            precio_venta_producto=99999.0,
            stock_producto=3,
            estado_producto="inactivo",
        ),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 200
    assert resp.json()["precio_venta_producto"] == 99999.0
    assert resp.json()["estado_producto"] == "inactivo"
    assert resp.json()["stock_estado"] == "bajo"

    db.expire_all()
    assert prod.estado_producto == "inactivo"


async def test_editar_producto_inexistente_404(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.put(
        f"{API}/999999",
        json=_body_producto(nombre_producto="Fantasma xyz", referencia_producto="REF-404"),
        headers=auth_headers(tokens),
    )
    assert resp.status_code == 404


async def test_editar_producto_sin_token_401(client, db):
    prod = crear_producto(db, referencia_producto="REF-PUT-NOAUTH")
    resp = await client.put(
        f"{API}/{prod.id_producto}",
        json=_body_producto(nombre_producto="Sin auth xyz", referencia_producto="REF-PUT-NOAUTH"),
    )
    assert resp.status_code == 401


async def test_toggle_visibilidad_exito(client, db, admin_logueado):
    """PUT /productos/{id}/visibilidad alterna visible_cliente."""
    _, tokens = admin_logueado
    prod = crear_producto(
        db, nombre_producto="Sensor de apertura xyz", referencia_producto="REF-VIS-1"
    )

    ocultar = await client.put(
        f"{API}/{prod.id_producto}/visibilidad", headers=auth_headers(tokens)
    )
    assert ocultar.status_code == 200
    assert ocultar.json()["visible_cliente"] is False
    assert "oculto" in ocultar.json()["mensaje"]

    mostrar = await client.put(
        f"{API}/{prod.id_producto}/visibilidad", headers=auth_headers(tokens)
    )
    assert mostrar.status_code == 200
    assert mostrar.json()["visible_cliente"] is True

    # Confirmar el efecto real en el catálogo público.
    catalogo = await client.get(f"{API}/")
    assert prod.id_producto in _ids(catalogo.json())


async def test_toggle_visibilidad_inexistente_404(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.put(f"{API}/999999/visibilidad", headers=auth_headers(tokens))
    assert resp.status_code == 404


async def test_toggle_visibilidad_sin_token_401(client, db):
    prod = crear_producto(db, referencia_producto="REF-VIS-NOAUTH")
    resp = await client.put(f"{API}/{prod.id_producto}/visibilidad")
    assert resp.status_code == 401


async def test_eliminar_producto_exito(client, db, admin_logueado):
    """Sin historial asociado el producto se borra de la BD."""
    _, tokens = admin_logueado
    # HALLAZGO: la migración base siembra `bodega_et` e `inventario_f` con
    # filas que apuntan a los productos 1..10 y esas tablas no tienen modelo
    # SQLAlchemy (el TRUNCATE del conftest no las limpia). Por eso un
    # producto con id <= 10 no se puede borrar y el endpoint lo desactiva.
    # Se crean productos de relleno hasta salir de ese rango.
    for i in range(11):
        crear_producto(
            db,
            nombre_producto=f"Relleno de borrado {i}",
            referencia_producto=f"REF-FILL-DEL-{i}",
        )
    prod = crear_producto(
        db, nombre_producto="Adaptador wifi xyz", referencia_producto="REF-DEL-1"
    )

    resp = await client.delete(f"{API}/{prod.id_producto}", headers=auth_headers(tokens))
    assert resp.status_code == 200
    assert resp.json()["eliminado"] is True
    db.expire_all()
    assert (
        db.query(Producto).filter_by(id_producto=prod.id_producto).first() is None
    )


async def test_eliminar_producto_con_historial_lo_desactiva(client, db, admin_logueado):
    """Si otro registro referencia al producto (historial de citas/pedidos),
    DELETE no lo borra: lo desactiva y responde eliminado=False."""
    _, tokens = admin_logueado
    cliente = crear_cliente(db)
    prod = crear_producto(
        db, nombre_producto="Panel solar xyz", referencia_producto="REF-DEL-2"
    )
    cita = Cita(
        id_cliente=cliente.id_cliente,
        tipo_servicio="instalacion",
        fecha=date(2026, 12, 1),
        hora="08:00",
        direccion="Cra 1 #2-3",
        estado="Confirmada",
    )
    db.add(cita)
    db.commit()
    db.refresh(cita)
    db.add(
        CitaProducto(id_cita=cita.id_cita, id_producto=prod.id_producto, cantidad=1)
    )
    db.commit()

    resp = await client.delete(f"{API}/{prod.id_producto}", headers=auth_headers(tokens))
    assert resp.status_code == 200
    assert resp.json()["eliminado"] is False

    db.expire_all()
    guardado = db.query(Producto).filter_by(id_producto=prod.id_producto).first()
    assert guardado is not None
    assert guardado.estado_producto == "inactivo"


async def test_eliminar_producto_inexistente_404(client, admin_logueado):
    _, tokens = admin_logueado
    resp = await client.delete(f"{API}/999999", headers=auth_headers(tokens))
    assert resp.status_code == 404


async def test_eliminar_producto_sin_token_401(client, db):
    prod = crear_producto(db, referencia_producto="REF-DEL-NOAUTH")
    resp = await client.delete(f"{API}/{prod.id_producto}")
    assert resp.status_code == 401
