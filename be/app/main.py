import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Importar middlewares desde la nueva carpeta
from app.middleware import setup_cors, setup_rate_limit, setup_security_headers


@asynccontextmanager
async def lifespan(_app: FastAPI):
    from app.services.scheduler import detener_scheduler, iniciar_scheduler

    # En pruebas E2E se arranca un servidor dedicado con DISABLE_SCHEDULER=1 para
    # no ejecutar trabajos en segundo plano sobre la base de pruebas.
    if os.getenv("DISABLE_SCHEDULER") != "1":
        iniciar_scheduler()
    yield
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
    description="API para sistema de gestión de domótica",
    version="1.0.0",
    lifespan=lifespan,
)

# Configurar middlewares
setup_cors(app)
setup_rate_limit(app)
setup_security_headers(app)

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

# Manejador centralizado de errores de validación (422).
# Por defecto FastAPI devuelve en cada error la clave `input` con el VALOR
# recibido: si un atacante manda un mensaje de 50 000 caracteres, una
# contraseña o un token, el propio error se los devuelve en la respuesta
# (fuga de datos OWASP A02). Aquí se construye una respuesta limpia y en
# español con la MISMA estructura que consume el frontend (`detail` como
# lista con `loc`/`msg`), sin `input`, sin `url` internas, sin stack trace y
# sin rutas físicas (C:\...) que nunca salen al cliente.
_MENSAJES_422_ES = {
    "missing": "Campo obligatorio",
    "string_too_short": "Texto demasiado corto",
    "string_too_long": "Texto demasiado largo",
    "extra_forbidden": "Campo no permitido",
    # IDs en la ruta (ej. GET /clients/{id_cliente}/pedidos):
    "int_parsing": "Debe ser un número entero",
    "greater_than": "El valor debe ser mayor que cero",
    "greater_than_equal": "El valor debe ser mayor o igual que cero",
    # Tarifas / montos (ej. PUT /tarifas/{tipo_servicio}):
    "less_than_equal": "El valor excede el máximo permitido",
    "float_parsing": "Debe ser un número válido",
}


def _mensaje_422_para(err: dict) -> str:
    """Convierte un error de Pydantic al mensaje español limpio que exponemos."""
    tipo = err.get("type", "")
    if tipo in _MENSAJES_422_ES:
        return _MENSAJES_422_ES[tipo]
    mensaje = err.get("msg", "") or "Dato inválido"
    # Los field_validator del schema ya devuelven mensajes en español:
    # Pydantic solo les añade el prefijo "Value error, ".
    mensaje = mensaje.replace("Value error, ", "").replace("Assertion failed, ", "")
    if "valid email" in mensaje:
        return "Formato de correo no válido"
    return mensaje


@app.exception_handler(RequestValidationError)
async def validacion_de_entradas_handler(request: Request, exc: RequestValidationError):
    import logging

    logging.info("Entradas inválidas en %s %s", request.method, request.url.path)
    errores_limpios = [
        {
            "loc": list(err.get("loc", [])),
            "msg": _mensaje_422_para(err),
            "type": err.get("type", ""),
            # Sin `input` (no se devuelve el valor recibido) y sin `url`.
        }
        for err in exc.errors()
    ]
    return JSONResponse(
        status_code=422,
        content={"detail": errores_limpios},
    )


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