"""
Módulo: services/inventario_service.py

Descuento de stock con bloqueo pesimista de filas (SELECT ... FOR UPDATE)
para que dos compras concurrentes no puedan vender las mismas unidades.

Lanza HTTP 409 cuando no hay stock suficiente en lugar de silenciar el
sobregiro con max(stock - n, 0).
"""

from fastapi import HTTPException
from sqlalchemy.orm import Session

from app.models.producto import Producto
from app.models.producto_variante import ProductoVariante
from app.models.producto_medida import ProductoMedida

STOCK_MINIMO_ALERTA = 5


def _verificar_stock_bajo(db: Session, producto: Producto) -> None:
    """Si el stock del producto bajó a ≤ STOCK_MINIMO_ALERTA, notifica a los admins."""
    stock = producto.stock_producto or 0
    if stock > STOCK_MINIMO_ALERTA:
        return
    try:
        from app.models.roles_usuario import RolesUsuario
        from app.models.user import User
        from app.services.notificaciones import notificar_admin_stock_bajo

        admins = (
            db.query(User)
            .join(RolesUsuario, RolesUsuario.id_rol == User.id_rol_u)
            .filter(RolesUsuario.nombre_rol.in_(["admin", "administrador"]), User.is_active == True)
            .all()
        )
        admin_ids = [a.id_usuario for a in admins]
        if admin_ids:
            notificar_admin_stock_bajo(
                db,
                admin_ids=admin_ids,
                producto_id=producto.id_producto,
                producto_nombre=producto.nombre_producto,
                stock_actual=stock,
                stock_minimo=STOCK_MINIMO_ALERTA,
            )
    except Exception as e:
        print(f"Error notificando stock bajo para producto #{producto.id_producto}: {e}")


def _verificar_stock_bajo_medida(db: Session, medida: ProductoMedida, producto_nombre: str) -> None:
    """Alerta de stock bajo por medida (≤5). Solo cuando cruza el umbral para evitar spam."""
    stock = medida.stock or 0
    if stock > STOCK_MINIMO_ALERTA or stock <= 0:
        # 0 se trata como agotado (otra alerta), no bajo
        return
    # Evitar duplicados: si ya existe una notificación reciente de stock bajo para esta medida con mismo stock, no repetir
    try:
        from app.models.notificacion import Notificacion

        # Buscar si en las últimas 24h ya se notificó stock bajo para este producto+medida
        reciente = (
            db.query(Notificacion)
            .filter(
                Notificacion.tipo == "stock_bajo_medida",
                Notificacion.mensaje.like(f"%Medida: {medida.metros:g} m%"),
                Notificacion.mensaje.like(f"%Producto: {producto_nombre}%"),
            )
            .order_by(Notificacion.fecha_creacion.desc())
            .first()
        )
        # Si ya existe y el stock actual es igual al último notificado, no duplicar
        if reciente and f"Stock restante: {stock}" in (reciente.mensaje or ""):
            return
        from app.models.roles_usuario import RolesUsuario
        from app.models.user import User

        admins = (
            db.query(User)
            .join(RolesUsuario, RolesUsuario.id_rol == User.id_rol_u)
            .filter(RolesUsuario.nombre_rol.in_(["admin", "administrador"]), User.is_active == True)
            .all()
        )
        for admin in admins:
            try:
                from app.services.notificaciones import crear_notificacion

                crear_notificacion(
                    db,
                    id_usuario=admin.id_usuario,
                    id_cliente=None,
                    tipo="stock_bajo_medida",
                    titulo="⚠️ STOCK BAJO - Medida",
                    mensaje=(
                        f"Producto: {producto_nombre}\n"
                        f"Medida: {medida.metros:g} m\n"
                        f"Stock restante: {stock}\n"
                        f"Se recomienda restablecer el stock de esta medida."
                    ),
                )
            except Exception:
                pass
        db.commit()
    except Exception as e:
        print(f"Error notificando stock bajo medida {medida.metros}g m: {e}")


def descontar_stock(
    db: Session,
    producto: Producto,
    variante: ProductoVariante | None,
    cantidad: int,
    medida: ProductoMedida | None = None,
) -> dict:
    """Bloquea y descuenta stock del producto / variante / medida.

    - Si `medida` no es None, descuenta de esa medida (venta por longitud por medida).
    - Si `variante` no es None, descuenta de variante.
    - Si no, descuenta de producto.

    Retorna {'producto_agotado': bool, 'variante_agotada': bool, 'medida_agotada': bool}.
    Debe llamarse dentro de la transacción del pago; si falla se lanza HTTPException.
    """
    unidades = max(int(cantidad or 1), 1)

    prod = (
        db.query(Producto)
        .with_for_update()
        .filter(Producto.id_producto == producto.id_producto)
        .first()
    )
    if not prod:
        raise HTTPException(status_code=404, detail=f"Producto #{producto.id_producto} no existe")

    # Prioridad: medida > variante > producto
    if medida is not None:
        med = (
            db.query(ProductoMedida)
            .with_for_update()
            .filter(ProductoMedida.id == medida.id)
            .first()
        )
        if not med:
            raise HTTPException(status_code=404, detail="Medida no encontrada")
        disponible = med.stock or 0
        if unidades > disponible:
            raise HTTPException(
                status_code=409,
                detail=f"No hay suficiente stock disponible para esta medida. (disponible: {disponible}, solicitado: {unidades})",
            )
        med.stock = disponible - unidades
        if med.stock <= 5:
            med.activa = False
        medida_agotada = med.stock <= 5
        # Alertas: agotado/bloqueado vs bajo (ahora ≤5 es bloqueado)
        if medida_agotada:
            # Notificación de agotado/bloqueado por llegar a ≤5
            try:
                from app.services.notificaciones import crear_notificacion
                from app.models.roles_usuario import RolesUsuario
                from app.models.user import User

                admins = (
                    db.query(User)
                    .join(RolesUsuario, RolesUsuario.id_rol == User.id_rol_u)
                    .filter(RolesUsuario.nombre_rol.in_(["admin", "administrador"]), User.is_active == True)
                    .all()
                )
                for admin in admins:
                    crear_notificacion(
                        db,
                        id_usuario=admin.id_usuario,
                        id_cliente=None,
                        tipo="stock_agotado_medida",
                        titulo="🔴 MEDIDA BLOQUEADA",
                        mensaje=(
                            f"Producto: {prod.nombre_producto}\n"
                            f"Medida: {med.metros:g} m\n"
                            f"Stock restante: {med.stock}\nBloqueada - stock ≤5."
                        ),
                    )
                db.commit()
            except Exception:
                pass
        else:
            _verificar_stock_bajo_medida(db, med, prod.nombre_producto)
        return {
            "producto_agotado": False,
            "variante_agotada": False,
            "medida_agotada": medida_agotada,
            "medida_stock": med.stock,
        }

    var = None
    if variante is not None:
        var = (
            db.query(ProductoVariante)
            .with_for_update()
            .filter(ProductoVariante.id == variante.id)
            .first()
        )

    disponible_var = None
    if var is not None:
        disponible_var = var.stock or 0
        if unidades > disponible_var:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Stock insuficiente de '{prod.nombre_producto}' en la variante "
                    f"seleccionada (disponible: {disponible_var}, solicitado: {unidades})"
                ),
            )
    else:
        disponible_prod = prod.stock_producto or 0
        if unidades > disponible_prod:
            raise HTTPException(
                status_code=409,
                detail=(
                    f"Stock insuficiente de '{prod.nombre_producto}' "
                    f"(disponible: {disponible_prod}, solicitado: {unidades})"
                ),
            )

    variante_agotada = False
    if var is not None:
        var.stock = disponible_var - unidades
        variante_agotada = var.stock == 0
    else:
        prod.stock_producto = disponible_prod - unidades

    # Notificar stock bajo después del descuento.
    _verificar_stock_bajo(db, prod)

    return {
        "producto_agotado": prod.stock_producto == 0,
        "variante_agotada": variante_agotada,
        "medida_agotada": False,
    }
