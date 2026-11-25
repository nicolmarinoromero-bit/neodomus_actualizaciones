# ─────────────────────────────────────────────────────────────
# Guardado endurecido de credenciales (scripts/obtener_refresh_token.py):
# whitelist de claves, rechazo de CR/LF, preservación del archivo ante
# error y ausencia de secretos en la salida.
# ─────────────────────────────────────────────────────────────
import importlib.util
import io
import os
import sys
import tempfile
import unittest
from contextlib import redirect_stdout
from pathlib import Path

_RUTA_SCRIPT = Path(r"C:\Users\Alienware\Desktop\neodomus_final\scripts\obtener_refresh_token.py")
if not _RUTA_SCRIPT.exists():
    # Ruta relativa (CI/otro checkout): scripts/ es hermano de be/
    _RUTA_SCRIPT = Path(__file__).resolve().parent.parent.parent.parent / "scripts" / "obtener_refresh_token.py"

_spec = importlib.util.spec_from_file_location("obtener_refresh_token", _RUTA_SCRIPT)
ort = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(ort)


class GuardarEnvTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.env = Path(self.tmp.name) / ".env"
        self.env.write_text("EXISTENTE=valor_previo\n", encoding="utf-8")
        ort.ENV_PATH = self.env

    def tearDown(self):
        self.tmp.cleanup()

    def test_claves_permitidas(self):
        for clave in ("GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET", "GOOGLE_REFRESH_TOKEN"):
            ort.guardar_env(clave, "v-" + clave)
        texto = self.env.read_text(encoding="utf-8")
        self.assertIn("GOOGLE_CLIENT_ID=v-GOOGLE_CLIENT_ID", texto)
        self.assertIn("GOOGLE_CLIENT_SECRET=v-GOOGLE_CLIENT_SECRET", texto)
        self.assertIn("GOOGLE_REFRESH_TOKEN=v-GOOGLE_REFRESH_TOKEN", texto)

    def test_rechaza_clave_no_listada(self):
        with self.assertRaises(ValueError):
            ort.guardar_env("MALA_CLAVE", "x")

    def test_rechaza_salto_de_linea(self):
        for malo in ("v\nINYECCION=1", "v\rINYECCION=1", "v\r\nINYECCION=1"):
            with self.assertRaises(ValueError):
                ort.guardar_env("GOOGLE_CLIENT_ID", malo)

    def test_preserva_archivo_ante_error(self):
        with self.assertRaises(ValueError):
            ort.guardar_env("GOOGLE_CLIENT_ID", "ok\nMALO")
        texto = self.env.read_text(encoding="utf-8")
        self.assertEqual(texto, "EXISTENTE=valor_previo\n")

    def test_no_imprime_secretos(self):
        buffer = io.StringIO()
        with redirect_stdout(buffer):
            ort.guardar_env("GOOGLE_CLIENT_SECRET", "secreto-ultra")
        self.assertNotIn("secreto-ultra", buffer.getvalue())


if __name__ == "__main__":
    unittest.main()
