"""Pruebas puras de idempotencia y verificación de objetos migrados."""
import json
import sys
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch

sys.path.insert(0, str(Path(__file__).resolve().parents[3]))

from scripts.migrate_legacy_evidence import (
    EvidenceRef,
    _copy_verified,
    _counts,
    _storage_inventory,
    _write_report,
    main,
    private_target_key,
)


class MigracionEvidenciasLegacyTestCase(unittest.TestCase):
    def test_conteo_normaliza_url_y_clave_de_la_misma_fuente(self):
        refs = [
            EvidenceRef(
                "evidencias",
                1,
                "url_archivo",
                "https://minio.local/neodomus-media/evidencias/a.jpg",
                None,
            ),
            EvidenceRef("evidencias_entrega", 2, "url_archivo", "evidencias/a.jpg", None),
        ]

        conteos = _counts(refs)

        self.assertEqual(conteos["referencias"], 2)
        self.assertEqual(conteos["referencias_legadas_unicas_por_tabla"], 2)

    def test_clave_privada_es_determinista_por_contenido(self):
        data = b"evidencia sintetica"

        self.assertEqual(
            private_target_key(data, "evidencias_entrega/foto.jpg"),
            private_target_key(data, "legacy/foto.jpg"),
        )

    def test_reutiliza_destino_identico_sin_volver_a_subir(self):
        with patch(
            "scripts.migrate_legacy_evidence.minio_service.leer_objeto_privado",
            return_value=b"same bytes",
        ), patch(
            "scripts.migrate_legacy_evidence.minio_service.subir_imagen_privada"
        ) as subir:
            creada = _copy_verified(b"same bytes", "evidencias_migradas/aa/file.jpg")

        self.assertFalse(creada)
        subir.assert_not_called()

    def test_rechaza_destino_existente_con_contenido_distinto(self):
        with patch(
            "scripts.migrate_legacy_evidence.minio_service.leer_objeto_privado",
            return_value=b"other bytes",
        ), patch(
            "scripts.migrate_legacy_evidence.minio_service.subir_imagen_privada"
        ) as subir:
            with self.assertRaisesRegex(RuntimeError, "contenido diferente"):
                _copy_verified(b"expected bytes", "evidencias_migradas/aa/file.jpg")

        subir.assert_not_called()

    def test_inventario_no_crea_buckets_ausentes(self):
        class ReadOnlyMinio:
            def bucket_exists(self, bucket):
                return False

        with patch(
            "scripts.migrate_legacy_evidence._readonly_client",
            return_value=ReadOnlyMinio(),
        ):
            inventario = _storage_inventory()

        self.assertEqual(inventario["public_objects"], [])
        self.assertEqual(inventario["private_objects"], [])

    def test_crea_y_verifica_destino_ausente(self):
        key = "evidencias_migradas/aa/file.jpg"
        with patch(
            "scripts.migrate_legacy_evidence.minio_service.leer_objeto_privado",
            side_effect=[FileNotFoundError(key), b"expected bytes"],
        ), patch(
            "scripts.migrate_legacy_evidence.minio_service.subir_imagen_privada",
            return_value=f"privado:{key}",
        ) as subir:
            creada = _copy_verified(b"expected bytes", key)

        self.assertTrue(creada)
        subir.assert_called_once_with("evidencias_migradas/aa", "file.jpg", b"expected bytes")


class MigracionEvidenciasRutasTestCase(unittest.TestCase):
    def test_reporte_dentro_del_directorio_permitido(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(
            "os.environ", {"NEODOMUS_EVIDENCE_REPORT_DIR": tmp}
        ):
            target = Path(tmp) / "report.json"

            _write_report(target, {"ok": True})

            self.assertEqual(json.loads(target.read_text(encoding="utf-8")), {"ok": True})

    def test_rechaza_reporte_con_travesia(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(
            "os.environ", {"NEODOMUS_EVIDENCE_REPORT_DIR": tmp}
        ):
            target = Path(tmp) / ".." / f"escape-{Path(tmp).name}.json"

            with self.assertRaisesRegex(ValueError, "fuera del directorio"):
                _write_report(target, {})

            self.assertFalse(target.resolve().exists())

    def test_rechaza_reporte_absoluto_fuera_del_directorio(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(
            "os.environ", {"NEODOMUS_EVIDENCE_REPORT_DIR": tmp}
        ):
            target = Path(tmp).parent / f"outside-{Path(tmp).name}.json"

            with self.assertRaisesRegex(ValueError, "fuera del directorio"):
                _write_report(target, {})

            self.assertFalse(target.exists())

    def test_main_rechaza_manifiesto_fuera_del_directorio_antes_de_conectar(self):
        with tempfile.TemporaryDirectory() as tmp, patch.dict(
            "os.environ", {"NEODOMUS_EVIDENCE_REPORT_DIR": tmp}
        ), patch("scripts.migrate_legacy_evidence._storage_inventory") as inventory:
            manifest = Path(tmp).parent / f"manifest-{Path(tmp).name}.json"
            report = Path(tmp) / "report.json"

            codigo = main(["--rollback", str(manifest), "--report", str(report)])

            self.assertEqual(codigo, 2)
            inventory.assert_not_called()


if __name__ == "__main__":
    unittest.main(verbosity=2)
