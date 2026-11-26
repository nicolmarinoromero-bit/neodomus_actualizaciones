# ─────────────────────────────────────────────────────────────
# Factura PDF: sección «SERVICIOS AGENDADOS» a partir de la cita
# guardada (tipo, fecha, hora Bogotá y técnicos), con casos de un
# técnico, dos técnicos y asignación pendiente. Sin cita: sin sección.
# ─────────────────────────────────────────────────────────────
import unittest
from datetime import date

from app.services.factura_service import (
    _filas_citas_pdf,
    generar_factura_pdf,
    texto_tipo_servicio,
)


class _CitaFalsa:
    def __init__(self, tipo, fecha, hora, t1=None, t2=None, t3=None):
        self.tipo_servicio = tipo
        self.fecha = fecha
        self.hora = hora
        self.nombre_tecnico = t1
        self.nombre_tecnico_2 = t2
        self.nombre_tecnico_3 = t3


class _FacturaFalsa:
    numero_factura = "FAC-TEST-1"
    fecha_factura = date(2026, 11, 26)
    monto_total = 300000
    metodo_pago = "Tarjeta débito"
    estado_pago = "aprobado"
    numero_transaccion = "NEO-PAY-1"


class _PedidoFalso:
    total_pedido = 300000


class _ClienteFalso:
    first_name = "Cliente"
    last_name = "Prueba"
    documento_cliente = 99999991
    telefono_cliente = 3000000001
    address = "Calle Prueba 123"
    email = "cliente.qa@pruebas-qa.com"


class FilasCitasPdfTest(unittest.TestCase):
    def test_un_tecnico(self):
        filas = _filas_citas_pdf([
            _CitaFalsa("mantenimiento", date(2026, 11, 27), "14:00",
                       t1="JORGE DANIEL CHARRY PÉREZ"),
        ])
        self.assertEqual(filas, [[
            "Mantenimiento", "27/11/2026", "14:00", "JORGE DANIEL CHARRY PÉREZ",
        ]])

    def test_dos_tecnicos_unidos_por_y(self):
        filas = _filas_citas_pdf([
            _CitaFalsa("instalacion", date(2026, 11, 27), "08:00",
                       t1="CARLOS ANDRÉS GÓMEZ RÍOS", t2="JORGE DANIEL CHARRY PÉREZ"),
        ])
        self.assertEqual(filas[0][0], "Instalación")
        self.assertEqual(filas[0][3], "CARLOS ANDRÉS GÓMEZ RÍOS y JORGE DANIEL CHARRY PÉREZ")

    def test_asignacion_pendiente(self):
        filas = _filas_citas_pdf([
            _CitaFalsa("mantenimiento", date(2026, 11, 27), "14:00"),
        ])
        self.assertEqual(filas[0][3], "Asignación pendiente")

    def test_tipo_desconocido_y_vacio(self):
        self.assertEqual(texto_tipo_servicio(None), "Servicio")
        self.assertEqual(texto_tipo_servicio("acondicionamiento"), "Acondicionamiento")
        self.assertEqual(_filas_citas_pdf([]), [])


class PdfConServiciosTest(unittest.TestCase):
    def _texto_pdf(self, pdf_bytes) -> str:
        import pymupdf

        with pymupdf.open(stream=pdf_bytes.getvalue(), filetype="pdf") as doc:
            return "\n".join(p.get_text() for p in doc)

    def test_pdf_sin_citas_no_incluye_seccion(self):
        pdf = generar_factura_pdf(_FacturaFalsa(), _PedidoFalso(), _ClienteFalso(), [])
        texto = self._texto_pdf(pdf)
        self.assertNotIn("SERVICIOS AGENDADOS", texto)

    def test_pdf_con_citas_muestra_servicio_y_tecnicos(self):
        citas = [
            _CitaFalsa("mantenimiento", date(2026, 11, 27), "14:00",
                       t1="JORGE DANIEL CHARRY PÉREZ"),
        ]
        pdf = generar_factura_pdf(_FacturaFalsa(), _PedidoFalso(), _ClienteFalso(), [], citas=citas)
        texto = self._texto_pdf(pdf)
        self.assertIn("SERVICIOS AGENDADOS", texto)
        self.assertIn("Mantenimiento", texto)
        self.assertIn("27/11/2026", texto)
        self.assertIn("14:00", texto)
        self.assertIn("JORGE DANIEL CHARRY PÉREZ", texto)


if __name__ == "__main__":
    unittest.main()
