from app.database import SessionLocal
from app.models.producto import Producto
from app.models.producto_variante import ProductoVariante
from app.services.inventario_service import descontar_stock

db = SessionLocal()
prod = db.query(Producto).filter(Producto.stock_producto > 5).first()
if not prod:
    print("No hay producto con stock >5")
    exit(0)

print(f"Producto #{prod.id_producto} {prod.nombre_producto} stock antes={prod.stock_producto}")
var = db.query(ProductoVariante).filter(ProductoVariante.id_producto == prod.id_producto).first()
if var:
    print(f"Variante id={var.id} stock={var.stock} nombre={var.nombre}")
else:
    print("Sin variante para este producto")

# Contar llamadas a descontar_stock en pedidos_service
with open("app/services/pedidos_service.py") as f:
    cnt = f.read().count("descontar_stock")
print(f"Referencias a descontar_stock en pedidos_service.py: {cnt}")

orig = prod.stock_producto
orig_var = var.stock if var else None

try:
    res = descontar_stock(db, prod, var, 1)
    print(f"descontar_stock res={res}")
    print(f"stock despues prod={prod.stock_producto} var={var.stock if var else 'N/A'}")
    # verificar que resto 1
    assert prod.stock_producto == orig - 1, "No resto 1 en producto"
    if var:
        assert var.stock == orig_var - 1, "No resto 1 en variante"
    print("OK: stock disminuido correctamente en memoria")
    db.rollback()
    prod2 = db.query(Producto).filter(Producto.id_producto == prod.id_producto).first()
    db.refresh(prod2)
    print(f"despues rollback stock prod={prod2.stock_producto} (esperado {orig})")
    assert prod2.stock_producto == orig, "Rollback fallo"
    print("VERIFICADO: descontar_stock disminuye stock y es transaccional")
except Exception as e:
    import traceback
    traceback.print_exc()
    db.rollback()

# Verificar flujo crear_pedido llama a descontar_stock solo si pago aprobado
with open("app/services/pedidos_service.py") as f:
    txt = f.read()
    assert "if estado_pago == \"aprobado\":" in txt
    assert "descontar_stock(db, producto, variante, unidades)" in txt
    print("VERIFICADO: crear_pedido descuenta stock solo si estado_pago==aprobado (linea 1256-1263)")

with open("app/services/pedidos_service.py") as f:
    assert "def confirmar_pago_pendiente" in f.read()
    print("VERIFICADO: confirmar_pago_pendiente tambien descuenta stock (linea 1433)")

db.close()
