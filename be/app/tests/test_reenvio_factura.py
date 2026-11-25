# ─────────────────────────────────────────────────────────────
# Reenvío de factura (scripts/reenviar_factura.py):
# correo SIMULADO (dobles del envío) sobre la BD de pruebas aislada.
# No toca la BD de desarrollo ni envía correos reales.
# ─────────────────────────────────────────────────────────────
import asyncio
import sys
import unittest
from datetime import datetime
from pathlib import Path
from unittest.mock import patch

import app.tests.testdb  # noqa: F401  (exige TEST_DATABASE_URL y aísla MinIO)
from app.database import SessionLocal
from app.models.cliente import Cliente
from app.models.factura import Factura
from app.models.pedido import Pedido
from app.models.user import User
from app.services import pedidos_service
from app.utils import email as email_utils
from app.utils import gmail_api

# be/scripts: ahí vive el módulo del script de reenvío que se prueba.
sys.path.append(str(Path(__file__).resolve().parent.parent.parent / "scripts"))

import reenviar_factura  # noqa: E402


class ReenvioFacturaTest(unittest.TestCase):
    def setUp(self):
        import uuid

        sufijo = uuid.uuid4().hex[:8]
        self.email = f"reenvio.{sufijo}@ejemplo.com"
        self.numero = f"FAC-REENVIO-{sufijo}"
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
            self.pedido = Pedido(id_cliente_pe=self.cliente_id)
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
        async def fake_enviar(db, factura, pedido, cliente):
            factura.enviada_por_correo = True
            db.commit()

        with SessionLocal() as db:
            db.query(Factura).filter(Factura.numero_factura == self.numero).update(
                {"enviada_por_correo": True}
            )
            db.commit()
        envios = []

        async def fake_enviar2(db, factura, pedido, cliente):
            envios.append(factura.numero_factura)

        with patch.object(reenviar_factura, "_enviar_factura", fake_enviar2):
            rc = self._ejecutar()
        self.assertEqual(rc, 0)
        self.assertEqual(len(envios), 0)

    def test_sin_factura_devuelve_codigo_2(self):
        self.assertEqual(
            asyncio.run(reenviar_factura.reenviar("FAC-NO-EXISTE", None, False)), 2
        )

    def test_flujo_real_sin_credenciales_no_marca_flag(self):
        """El envío REAL (gmail_api sin credenciales) falla y el flag queda 0."""
        # El envío va por el branch gmail_api de send_email_with_attachment;
        # sin GOOGLE_* el _access_token lanza y _enviar_factura lo registra
        # sin marcar el flag (ni envío real: RuntimeError antes de red).
        real_gmail = gmail_api.send_gmail_api

        async def original(to_email, subject, body, pdf_source):
            # Reimplementa el branch gmail_api de utils.email con creds vacías.
            return await gmail_api.send_gmail_api(
                to_email, subject, body, attachment_bytes=pdf_source.getvalue()
            )

        with patch.object(email_utils, "send_email_with_attachment", original), \
             patch.object(gmail_api.settings, "EMAIL_PROVIDER", "gmail_api"), \
             patch.object(gmail_api.settings, "GOOGLE_CLIENT_ID", ""), \
             patch.object(gmail_api.settings, "GOOGLE_CLIENT_SECRET", ""), \
             patch.object(gmail_api.settings, "GOOGLE_REFRESH_TOKEN", ""):
            with SessionLocal() as db:
                factura = (
                    db.query(Factura)
                    .filter(Factura.numero_factura == self.numero)
                    .first()
                )
                pedido = factura.pedido
                cliente = db.query(Cliente).filter(Cliente.email == self.email).first()
                # El envío real falla (RuntimeError antes de red) y _enviar
                # registra el error sin marcar el flag.
                asyncio.run(pedidos_service._enviar_factura(db, factura, pedido, cliente))
                db.expire_all()
                factura = (
                    db.query(Factura)
                    .filter(Factura.numero_factura == self.numero)
                    .first()
                )
                self.assertFalse(factura.enviada_por_correo)

    def _factura_refrescada(self):
        with SessionLocal() as db:
            return db.query(Factura).filter(Factura.numero_factura == self.numero).first()

    def test_adjunto_pdf_se_arma_para_gmail_api(self):
        """El PDF real (reportlab) viaja como adjunto base64 en el payload."""
        import base64

        from app.services.factura_service import generar_factura_pdf
        from app.utils import gmail_api

        with SessionLocal() as db:
            factura = (
                db.query(Factura).filter(Factura.numero_factura == self.numero).first()
            )
            pedido = factura.pedido
            cliente = db.query(Cliente).filter(Cliente.email == self.email).first()

            pdf = generar_factura_pdf(factura, pedido, cliente, [])
            self.assertTrue(pdf.getvalue().startswith(b"%PDF"))

            capturas = []

            def fake_post(url, payload, headers=None):
                capturas.append(payload)
                return {"id": "msg-1"}

            with patch.object(gmail_api, "_post_json", fake_post), \
                 patch.object(gmail_api, "_access_token", return_value="tok-falso"):
                ok = gmail_api.send_gmail_api(
                    cliente.email,
                    "Tu factura",
                    "<p>Gracias</p>",
                    attachment_bytes=pdf.getvalue(),
                )
            self.assertTrue(ok)
            self.assertEqual(len(capturas), 1)
            crudo = base64.urlsafe_b64decode(capturas[0]["raw"].encode("ascii"))
            # El PDF viaja base64 dentro del MIME (doble capa): se busca su
            # marca en ambas capas.
            self.assertIn(b"application/pdf", crudo)
            self.assertIn(b"JVBERi", crudo)  # '%PDF' en base64


if __name__ == "__main__":
    unittest.main()
