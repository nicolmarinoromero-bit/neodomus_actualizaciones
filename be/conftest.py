"""
Conftest raíz de pytest (be/conftest.py).

Este archivo se importa ANTES que cualquier módulo del paquete `app`
(pytest carga los conftest del rootdir hacia abajo antes de coleccionar
tests). Es imprescindible porque `app/__init__.py` importa utilidades que
instancian `settings`, así que la variable DATABASE_URL debe apuntar a la
base de datos de pruebas ANTES de que `app` se importe en cualquier punto.

Toda la infraestructura de pruebas (migraciones, fixtures, limpieza) vive
en app/tests/conftest.py.
"""

import os

# Base de datos de pruebas: NUNCA la de producción (neodomus).
TEST_DATABASE_URL = os.environ.get(
    "TEST_DATABASE_URL",
    "mysql+pymysql://neodomus:neodomus123@db:3306/neodomus_test?charset=utf8mb4",
)
os.environ["DATABASE_URL"] = TEST_DATABASE_URL

# Ningún correo sale de la suite de pruebas (los envíos además están
# stubeados en app/tests/conftest.py).
os.environ.setdefault("SMTP_HOST", "")
