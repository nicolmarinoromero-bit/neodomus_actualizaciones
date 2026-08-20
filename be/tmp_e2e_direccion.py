import asyncio
import random

from app.database import SessionLocal
from app.models.cliente import Cliente
from app.models.user import User
from app.models.tecnico import Tecnico
from app.models.producto import Producto
from app.models.cita import Cita
from app.models.pedido import Pedido, DetallePedido
from app.models.pago import Pago
from app.models.factura import Factura
from app.services.pedidos_service import crear_pedido, confirmar_pago_pendiente

db = SessionLocal()

suf = random.randint(100000, 999999)
EMAIL_T = f"tecnico.dir.{suf}@test.com"
EMAIL_C = f"cliente.dir.{suf}@test.com"
DIR_CLIENTE = "Calle del Cliente 7-15, Medellín"

from app.models.roles_usuario import RolesUsuario
from sqlalchemy import select

rol_tecnico = db.execute(
    select(RolesUsuario.id_rol).where(RolesUsuario.nombre_rol == "tecnico")
).scalar_one_or_none()
assert rol_tecnico

user_t = User(first_name="PEDRO", last_name="RAMIREZ", email=EMAIL_T, password_hash="x", id_rol_u=rol_tecnico, is_active=True)
db.add(user_t)
db.flush()
tec = Tecnico(id_usuario_t=user_t.id_usuario, certificacion_t="Instalación y redes")
db.add(tec)
db.flush()

cliente = Cliente(first_name="LUISA", last_name="FERNANDEZ", email=EMAIL_C, password_hash="x", address=DIR_CLIENTE, is_active=True)
db.add(cliente)
db.flush()

producto = db.query(Producto).filter(Producto.estado_producto == "activo", Producto.stock_producto > 0).first()
assert producto, "No hay producto activo con stock"
db.commit()
print("SETUP_OK")


async def aprobado():
    return await crear_pedido(
        db,
        cliente,
        [{"id_producto": producto.id_producto, "cantidad": 1}],
        [
            {
                "nombre": "Instalación",
                "tipo_servicio": "Instalación",
                "precio": 120000,
                "fecha": None,
                "hora": "11:45",
            }
        ],
        "tarjeta_credito",
        {"numero": "4242424242424242", "titular": "LUISA FERNANDEZ", "expiracion": "12/28", "cvv": "123"},
    )


res = asyncio.run(aprobado())
ords = res.get("ordenes_instalacion") or []
assert len(ords) == 1, "Falta orden aprobada"
o = ords[0]
print("APROBADO_DIR:", o["direccion"])
assert o["direccion"] == DIR_CLIENTE, o["direccion"]
assert o["hora"] == "11:45", o["hora"]
id_pedido1 = res["pedido"].id_pedido

det = db.query(DetallePedido).filter(DetallePedido.id_pedido_d == id_pedido1, DetallePedido.id_producto_d.is_(None)).first()
assert det and det.direccion_servicio == DIR_CLIENTE, "direccion_servicio no guarda la del cliente"
print("DETALLE_DIR_OK")

db.query(Pago).filter(Pago.id_pedido == id_pedido1).delete()
db.query(Factura).filter(Factura.id_pedido == id_pedido1).delete()
db.query(DetallePedido).filter(DetallePedido.id_pedido_d == id_pedido1).delete()
db.query(Pedido).filter(Pedido.id_pedido == id_pedido1).delete()
db.query(Cita).filter(Cita.id_cliente == cliente.id_cliente).delete()
print("LIMPIADO_APROBADO")


async def pendiente():
    return await crear_pedido(
        db,
        cliente,
        [{"id_producto": producto.id_producto, "cantidad": 1}],
        [
            {
                "nombre": "Instalación",
                "tipo_servicio": "Instalación",
                "precio": 120000,
                "fecha": None,
                "hora": "09:05",
            }
        ],
        "punto_pago",
        {},
    )


res2 = asyncio.run(pendiente())
assert res2["pedido"].estado_pedido == "Pago pendiente"
id_pedido2 = res2["pedido"].id_pedido
res3 = asyncio.run(confirmar_pago_pendiente(db, id_pedido2, cliente))
o2 = (res3.get("ordenes_instalacion") or [])[0]
print("PENDIENTE_DIR:", o2["direccion"], "HORA:", o2["hora"])
assert o2["direccion"] == DIR_CLIENTE, o2["direccion"]
assert o2["hora"] == "09:05", o2["hora"]

db.query(Pago).filter(Pago.id_pedido == id_pedido2).delete()
db.query(Factura).filter(Factura.id_pedido == id_pedido2).delete()
db.query(DetallePedido).filter(DetallePedido.id_pedido_d == id_pedido2).delete()
db.query(Pedido).filter(Pedido.id_pedido == id_pedido2).delete()
db.query(Cita).filter(Cita.id_cliente == cliente.id_cliente).delete()
db.query(Cliente).filter(Cliente.id_cliente == cliente.id_cliente).delete()
db.query(Tecnico).filter(Tecnico.id_tecnico == tec.id_tecnico).delete()
db.query(User).filter(User.id_usuario == user_t.id_usuario).delete()
db.commit()
print("LIMPIEZA_OK")
print("E2E_DIRECCION_CLIENTE_OK")
