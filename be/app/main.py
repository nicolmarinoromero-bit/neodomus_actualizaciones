"""
Punto de entrada principal de la aplicación FastAPI.

Este archivo configura la aplicación, los middlewares, los routers y los
manejadores de excepciones globales. Es el archivo que Uvicorn carga al
iniciar el servidor (uvicorn app.main:app).

Flujo de una petición HTTP:
  1. CORSMiddleware  → valida Origin, responde preflights OPTIONS
  2. SecurityHeaders → añade X-Frame-Options, nosniff, etc.
  3. Rate Limit      → limita peticiones por IP (solo handler, no middleware)
  4. Router → Endpoint → Dependencies (auth, DB, etc.)
  5. Respuesta → SecurityHeaders → CORS (añade cabeceras) → Cliente
"""
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

# Importar middlewares desde la carpeta middleware/.
# Cada uno encapsula una preocupación transversal (CORS, rate-limit, headers).
from app.middleware import setup_cors, setup_rate_limit, setup_security_headers


@asynccontextmanager
async def lifespan(_app: FastAPI):
    """Lifecycle manager de la app.

    ¿Para qué? Inicia y detiene el scheduler de tareas en segundo plano
    (por ejemplo, envío programado de emails, limpieza de tokens, etc.)
    cuando el servidor arranca o se apaga.

    Impacto: sin esto, las tareas programadas nunca se ejecutarían y al
    apagar el servidor podrían quedar conexiones abiertas.
    """
    from app.services.scheduler import detener_scheduler, iniciar_scheduler

    iniciar_scheduler()
    yield
    detener_scheduler()

# Importar todos los routers de la aplicación.
# Cada router agrupa endpoints relacionados (auth, usuarios, productos, etc.)
# y se monta bajo el prefijo /api/v1 para versionado de la API.
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
)

# Crear la aplicación FastAPI (con scheduler de tareas en segundo plano).
# Este objeto `app` es el que Uvicorn usa como ASGI application.
app = FastAPI(
    title="Neodomus API",
    description="API para sistema de gestión de domótica",
    version="1.0.0",
    lifespan=lifespan,
)

# ─── Middlewares ────────────────────────────────────────────────────────
#
# ORDEN CRÍTICO: FastAPI aplica middlewares en orden PILA (LIFO).
# El ÚLTIMO add_middleware() es el middleware EXTERNO (primero en recibir
# peticiones, último en procesar respuestas).
#
# Orden correcto:
#   1. rate_limit      → solo registra handler de excepciones, NO añade middleware real
#   2. security_headers → añade cabeceras de seguridad a TODAS las respuestas
#   3. cors             → SE REGISTRA ÚLTIMO = middleware EXTERNO
#
# ¿Por qué CORS último?
#   - CORSMiddleware necesita interceptar preflights OPTIONS ANTES que
#     cualquier otro middleware para responder sin llegar al router.
#   - Necesita añadir cabeceras Access-Control-* a TODAS las respuestas,
#     incluyendo las de error (500, 401, etc.) generadas por exception
#     handlers. Si CORS estuviera dentro de otro middleware, las respuestas
#     de error podrían salir sin cabeceras CORS → el navegador bloquearía
#     la lectura de la respuesta y mostraría "CORS error" en vez del
#     error real.
#
# Impacto: con CORS externo, el navegador SIEMPRE puede leer la respuesta
# del servidor, incluso cuando hay errores. Sin esto, errores inesperados
# se manifiestan como "CORS blocked" confusos en la consola del navegador.
# ────────────────────────────────────────────────────────────────────────
setup_rate_limit(app)       # 1. Handler de RateLimitExceeded (sin middleware real)
setup_security_headers(app) # 2. BaseHTTPMiddleware: X-Frame-Options, nosniff, etc.
setup_cors(app)             # 3. CORSMiddleware EXTERNO: cabeceras Access-Control-*

# ─── Routers ───────────────────────────────────────────────────────────
#
# Cada include_router registra un módulo de endpoints bajo /api/v1.
# El prefijo se aplica a TODOS los endpoints del router.
# Ejemplo: @router.get("/login") → POST /api/v1/auth/login
#
# Impacto: separar en routers mantiene el código organizado y permite
# aplicar prefijos/tags/middlewares por grupo de endpoints.
# ────────────────────────────────────────────────────────────────────────
app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(clients_router, prefix="/api/v1")
app.include_router(tecnicos_router, prefix="/api/v1")
app.include_router(productos_router, prefix="/api/v1")
app.include_router(citas_router, prefix="/api/v1")
app.include_router(solicitudes_router, prefix="/api/v1")
app.include_router(reports_router, prefix="/api/v1")
app.include_router(consultas_router, prefix="/api/v1")
app.include_router(pedidos_router, prefix="/api/v1")
app.include_router(tarifas_router, prefix="/api/v1")
app.include_router(calificaciones_router, prefix="/api/v1")
app.include_router(notificaciones_router, prefix="/api/v1")
app.include_router(especializaciones_router, prefix="/api/v1")
app.include_router(reembolsos_router, prefix="/api/v1")
app.include_router(devoluciones_router, prefix="/api/v1")

# ─── Archivos estáticos ────────────────────────────────────────────────
#
# Monta directorios del filesystem como endpoints de solo lectura.
# FastAPI sirve los archivos directamente sin pasar por los routers.
#
# Impacto: las imágenes de productos y evidencias de técnicos se sirven
# directamente por HTTP (ej: GET /uploads/producto_1.jpg). Sin esto,
# el frontend no podría mostrar imágenes subidas.
# ────────────────────────────────────────────────────────────────────────
PRODUCTOS_IMG_DIR = Path(__file__).resolve().parent / "static" / "productos"
PRODUCTOS_IMG_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=PRODUCTOS_IMG_DIR), name="uploads")

EVIDENCIAS_DIR = Path(__file__).resolve().parent / "static" / "evidencias"
EVIDENCIAS_DIR.mkdir(parents=True, exist_ok=True)
app.mount("/evidencias", StaticFiles(directory=EVIDENCIAS_DIR), name="evidencias")

# ─── Endpoints de utilidad ─────────────────────────────────────────────
#
# / y /health son endpoints simples para verificar que el servidor funciona.
# /health es usado por Docker healthcheck y monitores externos.
#
# Impacto: sin /health, Docker no podría saber si el contenedor está vivo
# y no reiniciaría el servicio si se bloquea.
# ────────────────────────────────────────────────────────────────────────
@app.get("/")
def root():
    return {"message": "Neodomus API funcionando"}

@app.get("/health")
def health_check():
    return {"status": "ok"}

# ─── Manejador de excepciones genéricas ────────────────────────────────
#
# ¿Para qué?
#   Captura CUALQUIER excepción no controlada que se escape de los
#   endpoints (errores de base de datos, ImportError, KeyError, etc.)
#   y devuelve una respuesta 500 JSON en vez de crashear el worker.
#
# ¿Por qué incluye cabeceras CORS?
#   Porque este handler devuelve un JSONResponse DIRECTAMENTE. En
#   FastAPI/Starlette, las respuestas de exception handlers pasan a
#   través del stack de middleware. CON CORS COMO EXTERNO, las
#   cabeceras CORS se añaden después. PERO como red de seguridad,
#   también las añadimos aquí por si CORS no procesa la respuesta
#   (por ejemplo, si el error ocurre DENTRO de un middleware antes
#   de llegar a CORS).
#
# ¿Por qué no captura HTTPException?
#   Starlette busca handlers por MRO (Method Resolution Order).
#   HTTPException tiene su propio handler registrado por FastAPI.
#   Al buscar: HTTPException → Exception → BaseException → object,
#   Starlette encuentra el handler de HTTPException PRIMERO y lo
#   usa. Nunca llega a nuestro handler de Exception.
#
# Impacto: sin este handler, una excepción no controlada mataría el
# worker de Uvicorn y el usuario vería un error genérico del proxy/
# navegador (o un "CORS blocked" si CORS no procesó la respuesta).
# Con CORS en la respuesta, el frontend puede leer el error 500 y
# mostrar un mensaje util al usuario.
# ────────────────────────────────────────────────────────────────────────
@app.exception_handler(Exception)
async def generic_exception_handler(request: Request, exc: Exception):
    import logging
    logging.exception("Unhandled exception")
    # Añadir CORS como red de seguridad: si el CORSMiddleware externo
    # no procesó esta respuesta, el navegador aún podrá leer el error.
    origin = request.headers.get("origin", "")
    headers = {}
    if origin:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Access-Control-Allow-Credentials"] = "true"
    return JSONResponse(
        status_code=500,
        content={"detail": "Error interno del servidor"},
        headers=headers,
    )

# ─── Ejecución directa ─────────────────────────────────────────────────
#
# Permite ejecutar: python -m app.main o python app/main.py
# Uvicorn carga app.main:app (el objeto `app` definido arriba).
# No se usa en producción (Docker ejecuta uvicorn directamente).
# ────────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import uvicorn
    port = int(os.getenv("PORT", 8000))
    uvicorn.run(app, host="0.0.0.0", port=port)