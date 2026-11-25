# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
# ReenvÃ­o de factura (scripts/reenviar_factura.py):
# correo SIMULADO (doble del envÃ­o) sobre la BD de pruebas aislada.
# No toca la BD de desarrollo ni envÃ­a correos reales.
# â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
import asyncio
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import app.tests.testdb  # noqa: F401  (exige TEST_DATABASE_URL y aÃ­sla MinIO)
from app.database import SessionLocal
from app.models.cliente import Cliente
from app.models.factura import Factura
from app.models.pedido import Pedido
from app.models.user import User
from app.services import pedidos_service

# be/scripts: ahÃ­ vive el mÃ³dulo del script de reenvÃ­o que se prueba.
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "scripts"))

import reenviar_factura  # noqa: E402

NUMERO = "FAC-REENVIO-TEST"


class ReenvioFacturaTest(unittest.TestCase):
    def setUp(self):
        import uuid

        sufixo = uuid.uuid4().hex[:8]
        self.email = f"reenvio.{sufixo}@ejemplo.com"
        self.numero = f"FAC-REENVIO-{sufixo}"
        with SessionLocal() as db:
            self.usuario = User(
                first_name="Reenvio",
                last_name="Prueba",
                email=self.email,
                password_hash="x",
            )
            db.add(self.usuario)
            db.flush()
            self.cliente = Cliente(
                first_name="Reenvio",
                last_name="Prueba",
                email=self.email,
                is_active=True,
            )
            db.add(self.cliente)
            db.flush()
            self.cliente_id = self.cliente.id_cliente
            self.pedido = Pedido(id_cliente_pe=self.cliente.id_cliente)
            db.add(self.pedido)
            db.flush()
            self.factura = Factura(
                id_pedido=self.pedido.id_pedido,
                numero_factura=self.numero,
                fecha_factura=datetime.now(),
                monto_total=1000,
                estado_pago="aprobado",
            )
            db.add(self.factura)
            db.commit()

    def tearDown(self):
        with SessionLocal() as db:
            db.query(Factura).filter(Factura.numero_factura == self.numero).delete()
            db.query(Pedido).filter(Pedido.id_cliente_pe == self.cliente_id).delete()
            db.query(Cliente).filter(Cliente.email == self.email).delete()
            db.query(User).filter(User.email == self.email).delete()
            db.commit()

    def _ejecutar(self, forzar=False):
        return asyncio.run(reenviar_factura.reenviar(self.numero, None, forzar))

    def test_envio_simulado_marca_flag(self):
        envios = []

        async def fake_enviar(db, factura, pedido, cliente):
            envios.append((factura.numero_factura, cliente.email))
            factura.enviada_por_correo = True
            db.commit()

        with patch.object(reenviar_factura, "_enviar_factura", fake_enviar):
            rc = self._ejecutar()

        self.assertEqual(rc, 0)
        self.assertEqual(len(envios), 1)
        self.assertEqual(envios[0], (self.numero, self.email))
        with SessionLocal() as db:
            factura = (
                db.query(Factura).filter(Factura.numero_factura == self.numero).first()
            )
            self.assertTrue(factura.enviada_por_correo)

    def test_idempotente_sin_forzar_no_reenvia(self):
        envios = []
        async def fake_enviar(db, factura, pedido, cliente):
            factura.enviada_por_correo = True
            db.commit()

        with SessionLocal() as db:
            db.query(Factura).filter(Factura.numero_factura == self.numero).update(
                {"enviada_por_correo": True}
            )
            db.commit()
        with patch.object(reenviar_factura, "_enviar_factura", fake_enviar):
            rc = self._ejecutar()
        self.assertEqual(rc, 0)
        self.assertEqual(len(envios), 0)

    def test_sin_factura_devuelve_codigo_2(self):
        self.assertEqual(asyncio.run(reenviar_factura.reenviar("FAC-NO-EXISTE", None, False)), 2)


if __name__ == "__main__":
    unittest.main()
