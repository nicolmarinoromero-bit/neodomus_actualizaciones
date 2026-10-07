"""
Garantiza que la suite NUNCA toca la base de datos de producción.

`app/config.py` instancia settings al importar; `app/__init__.py` importa
utilidades que arrastran ese import, por lo que el conftest raíz
(be/conftest.py) fija DATABASE_URL ANTES de cualquier import de `app`.
Estos tests validan que ese aislamiento se mantenga.
"""

from app.config import settings
from app.database import engine


def test_settings_apuntan_a_bd_de_pruebas():
    assert "neodomus_test" in settings.DATABASE_URL, (
        f"¡Aislamiento roto! settings.DATABASE_URL = {settings.DATABASE_URL}"
    )


def test_engine_apunta_a_bd_de_pruebas():
    assert "neodomus_test" in str(engine.url), (
        f"¡Aislamiento roto! engine.url = {engine.url}"
    )
