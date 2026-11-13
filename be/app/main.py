import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Importar middlewares desde la nueva carpeta
from app.middleware import (
    setup_cors,
    setup_rate_limit,
    setup_security_headers,
    setup_trusted_proxy,
)


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.services.scheduler import detener_scheduler, iniciar_scheduler

    # En pruebas E2E se arranca un servidor dedicado con DISABLE_SCHEDULER=1 para
    # no ejecutar trabajos en segundo plano sobre la base de pruebas.
    if os.getenv("DISABLE_SCHEDULER") != "1":
        iniciar_scheduler()
    # try/finally (S9152): garantiza que el scheduler se detenga también si el
    # proceso se apura por una excepción durante el arranque de la app.
    try:
        yield
    finally:
        if os.getenv("DISABLE_SCHEDULER") != "1":
            detener_scheduler()

# Importar routers
from app.routers import (
    auth_router,
    users_router,
    clients_router,
    tecnicos_router,
    productos_router,
    citas_router,
    solicitudes_router,
    reports_router,
    consultas_router,
    pedidos_router,
    tarifas_router,
    calificaciones_router,
    notificaciones_router,
    especializaciones_router,
    reembolsos_router,
    devoluciones_router,
    novedades_router,
)

# Crear la aplicación FastAPI (con scheduler de tareas en segundo plano)
app = FastAPI(
    title="Neodomus API",
    description=(
        "API del sistema de gestión de domótica NeoDomus: autenticación, "
        "catálogo de productos, pedidos y checkout con pagos (simulador "
        "académico), citas e instalaciones técnicas, entregas, "
        "devoluciones, reembolsos, calificaciones, notificaciones, "
        "novedades/reclamos y reportes. Documentación interactiva: "
        "Swagger UI en `/docs`, ReDoc en `/redoc` y contrato completo en "
        "`/openapi.json`."
    ),
    version="1.0.0",
    lifespan=lifespan,
    # Metadatos de etiquetas para agrupar los módulos en /docs y /redoc.
    openapi_tags=[
        {"name": "Authentication", "description": "Registro, verificación de correo, inicio/cierre de sesión, tokens, recuperación de contraseña y OAuth con Google."},
        {"name": "Clients", "description": "Perfil e información personal del cliente autenticado."},
        {"name": "Users", "description": "Perfil de empleados (administrador/técnico), foto y cambio de contraseña."},
        {"name": "Técnicos", "description": "Directorio de técnicos, disponibilidad y evidencias de entregas e instalaciones."},
        {"name": "Productos", "description": "Catálogo público y administración de productos, variantes e imágenes."},
        {"name": "Pedidos", "description": "Checkout, pedidos, pagos, facturas, entregas y seguimiento."},
        {"name": "Citas", "description": "Citas de servicio técnico e instalación: agenda, reasignación y estados."},
        {"name": "Solicitudes de cuenta", "description": "Solicitudes de habilitación/registro de cuentas que revisa el administrador."},
        {"name": "Reembolsos", "description": "Reembolsos vinculados a citas, pedidos y devoluciones."},
        {"name": "Devoluciones", "description": "Solicitudes de devolución de productos y su flujo de recogida."},
        {"name": "Calificaciones", "description": "Calificaciones del servicio prestado por los técnicos."},
        {"name": "Notificaciones", "description": "Bandeja de notificaciones del usuario autenticado."},
        {"name": "Especializaciones", "description": "Especializaciones técnicas usadas para asignar citas y entregas."},
        {"name": "Tarifas de servicio", "description": "Tarifas de los servicios técnicos."},
        {"name": "Reportes", "description": "Reportes administrativos (ventas, resumen) en JSON y PDF."},
        {"name": "Contacto", "description": "Consultas públicas del formulario de contacto."},
        {"name": "Novedades", "description": "Reclamos/novedades del cliente con evidencias y respuesta del equipo, y cupones de descuento asociados."},
    ],
)

# Configurar middlewares
setup_cors(app)
setup_rate_limit(app)
setup_security_headers(app)
# Debe ser el último en añadirse para quedar como middleware más externo y
# resolver IP/esquema reales antes del resto de la cadena.
setup_trusted_proxy(app)

# Prefijo común de la API
API_PREFIX = "/api/v1"

# Incluir routers con prefijo /api/v1
app.include_router(auth_router, prefix=API_PREFIX)
app.include_router(users_router, prefix=API_PREFIX)
app.include_router(clients_router, prefix=API_PREFIX)
app.include_router(tecnicos_router, prefix=API_PREFIX)
app.include_router(productos_router, prefix=API_PREFIX)
app.include_router(citas_router, prefix=API_PREFIX)
app.include_router(solicitudes_router, prefix=API_PREFIX)
app.include_router(reports_router, prefix=API_PREFIX)
app.include_router(consultas_router, prefix=API_PREFIX)
app.include_router(pedidos_router, prefix=API_PREFIX)
app.include_router(tarifas_router, prefix=API_PREFIX)
app.include_router(calificaciones_router, prefix=API_PREFIX)
app.include_router(notificaciones_router, prefix=API_PREFIX)
app.include_router(especializaciones_router, prefix=API_PREFIX)
app.include_router(reembolsos_router, prefix=API_PREFIX)
app.include_router(devoluciones_router, prefix=API_PREFIX)
app.include_router(novedades_router, prefix=API_PREFIX)

# Imágenes subidas (productos) servidas desde /uploads
PRODUCTOS_IMG_DIR = Path(__file__).resolve().parent / "static" / "productos"
PRODUCTOS_IMG_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=PRODUCTOS_IMG_DIR), name="uploads")

# Las evidencias de trabajo son archivos PRIVADOS del negocio: no se sirven por
# un montaje estático público. Se descargan mediante rutas autorizadas
# (app.routers.tecnicos: /tecnicos/evidencias/.../archivo) que comprueban
# asignación/rol. El directorio de archivos heredados se conserva (no se borra),
# pero ya no se expone directamente.

# Endpoint de prueba
@app.get("/")
def root():
    return {"message": "Neodomus API funcionando"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# Manejador de excepciones genéricas
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    import logging
    logging.exception("Unhandled exception")
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
    )

# Ejecución directa (opcional)
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="127.0.0.1", port=port)