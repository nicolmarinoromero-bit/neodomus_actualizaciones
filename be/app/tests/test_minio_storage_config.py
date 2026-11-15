"""Pruebas puras de inicialización concurrente del almacenamiento MinIO."""
import unittest

from minio.error import S3Error

from app.config import Settings
from app.services.minio_service import _crear_bucket_si_falta


def _s3_error(code: str) -> S3Error:
    return S3Error(None, code, "bucket response", "/bucket", "request", "host")


class MinioStorageConfigTestCase(unittest.TestCase):
    def test_buckets_publico_y_privado_no_pueden_coincidir(self):
        with self.assertRaisesRegex(ValueError, "deben ser distintos"):
            Settings(MINIO_BUCKET="same-bucket", MINIO_PRIVATE_BUCKET="same-bucket")

    def test_bucket_creado_por_otra_replica_no_falla_inicio(self):
        class ConcurrentBucket:
            exists = False

            def bucket_exists(self, bucket):
                return self.exists

            def make_bucket(self, bucket):
                self.exists = True
                raise _s3_error("BucketAlreadyOwnedByYou")

        client = ConcurrentBucket()

        _crear_bucket_si_falta(client, "private-files")

        self.assertTrue(client.exists)

    def test_error_de_permisos_no_se_trata_como_bucket_existente(self):
        class DeniedBucket:
            def bucket_exists(self, bucket):
                return False

            def make_bucket(self, bucket):
                raise _s3_error("AccessDenied")

        with self.assertRaises(S3Error):
            _crear_bucket_si_falta(DeniedBucket(), "private-files")


if __name__ == "__main__":
    unittest.main(verbosity=2)
