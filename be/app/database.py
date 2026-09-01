"""
Módulo: app/database.py

¿Qué hace?
  Crea el engine de SQLAlchemy, configura el sessionmaker y expone la
  dependencia get_db() que inyecta sesiones en los endpoints de FastAPI.

Impacto: Sin él no existiría conexión a la base de datos ni forma de
inyectar sesiones de forma segura en cada petición.
"""

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker, Session
from typing import Generator

from app.config import settings

engine = create_engine(
    settings.DATABASE_URL,
    pool_pre_ping=True,
    pool_recycle=3600,
    echo=False,
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

class Base(DeclarativeBase):
    pass

# Esta es la función que falta
def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()