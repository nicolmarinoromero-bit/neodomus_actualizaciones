from sqlalchemy import Column, Integer, Numeric, String
from ..database import Base

class TipoDocumento(Base):
    __tablename__ = "tipos_documento"
    id_tipo_documento = Column(Integer, primary_key=True, autoincrement=True)
    nombre_tipo = Column(String(2))


class Comision(Base):
    __tablename__ = "comisiones"
    id_comision = Column(Integer, primary_key=True, autoincrement=True)
    porcentaje_comision = Column(Numeric(5, 2))
    valor_comision = Column(Numeric(10, 2))