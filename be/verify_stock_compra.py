import asyncio
from app.database import SessionLocal
from app.models.producto import Producto
from app.models.cliente import Cliente
from app.services.pedidos_service import crear_pedido

async def main():
    db = SessionLocal()
    cliente = db.query(Cliente).filter(Cliente.email == "laura.garcia@gmail.com").first()
    if not cliente:
        cliente = db.query(Cliente).first()
    print(f"Cliente: {cliente.email} id={cliente.id_cliente}")

    prod = db.query(Producto).filter(Producto.stock_producto > 5, Producto.estado_producto == "activo").first()
    print(f"Producto #{prod.id_producto} {prod.nombre_producto} stock ANTES={prod.stock_producto}")

    stock_antes = prod.stock_producto

    items = [{"id_producto": prod.id_producto, "cantidad": 2}]
    # datos pago aprobado
    datos_pago = {
        "numero": "4242424242424242",
        "titular": "Test User",
        "expiracion": "12/30",
        "cvv": "123",
        "resultado_simulacion": "aprobado"
    }

    res = await crear_pedido(db, cliente, items, None, "tarjeta_debito", datos_pago)
    print(f"Pedido creado id={res['pedido'].id_pedido} estado={res['pedido'].estado_pedido} pago={res['pago'].estado}")

    # recargar producto
    db.refresh(prod)
    # o requery
    prod2 = db.query(Producto).filter(Producto.id_producto == prod.id_producto).first()
    print(f"Producto #{prod2.id_producto} stock DESPUES={prod2.stock_producto}")
    print(f"Diferencia: {stock_antes} -> {prod2.stock_producto} (debe ser -2)")

    if prod2.stock_producto == stock_antes - 2:
        print("VERIFICADO: compra disminuye stock correctamente en be/app/services/pedidos_service.py:1263 via descontar_stock")
    else:
        print(f"ERROR: stock no disminuyo como esperado")

    # Verificar que si pago rechazado NO descuenta
    prod3 = db.query(Producto).filter(Producto.stock_producto > 5).first()
    stock_antes2 = prod3.stock_producto
    print(f"\nPrueba pago rechazado producto #{prod3.id_producto} stock antes={stock_antes2}")
    items2 = [{"id_producto": prod3.id_producto, "cantidad": 1}]
    datos_rechazado = {
        "numero": "4242424242420001",
        "titular": "Test User",
        "expiracion": "12/30",
        "cvv": "123",
        "resultado_simulacion": "rechazado"
    }
    res2 = await crear_pedido(db, cliente, items2, None, "tarjeta_debito", datos_rechazado)
    prod3_after = db.query(Producto).filter(Producto.id_producto == prod3.id_producto).first()
    print(f"Pedido rechazado id={res2['pedido'].id_pedido} estado={res2['pedido'].estado_pedido} stock despues={prod3_after.stock_producto}")
    if prod3_after.stock_producto == stock_antes2:
        print("VERIFICADO: pago rechazado NO disminuye stock (correcto)")
    else:
        print("ERROR: pago rechazado no deberia descontar stock")

    # Limpieza: restaurar stocks y borrar pedidos de prueba
    # Restaurar primer producto
    prod2.stock_producto = stock_antes
    db.commit()
    print(f"\nLimpieza: restaurado stock producto #{prod2.id_producto} a {stock_antes}")
    # No borramos pedidos para dejar trazabilidad, pero se podria
    db.close()

asyncio.run(main())
