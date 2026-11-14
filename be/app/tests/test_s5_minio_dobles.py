"""Semana 5 del bootcamp — dobles de prueba para MinIO.

MinIO es una dependencia externa: estas pruebas lo sustituyen por un doble
en memoria (sin red ni credenciales) para verificar contratos, manejo de
errores y decisiones de bucket público/privado. No se escribe nada real.
"""
import pytest
from minio.error import S3Error

from app.config import settings
from app.services import minio_service


class _Respuesta:
    def __init__(self, data: bytes = b"contenido"):
        self._data = data
        self.cerrada = False
        self.liberada = False

    def read(self):
        return self._data

    def close(self):
        self.cerrada = True

    def release_conn(self):
        self.liberada = True


class _ClienteFalso:
    def __init__(self, existe=True, error_put=None, error_get=None, error_bucket=None):
        self.existe = existe
        self.error_put = error_put
        self.error_get = error_get
        self.error_bucket = error_bucket
        self.buckets_creados = []
        self.politicas = []
        self.puts = []
        self.eliminados = []
        self.lecturas = []

    def bucket_exists(self, bucket):
        if self.error_bucket:
            raise self.error_bucket
        return self.existe

    def make_bucket(self, bucket):
        self.buckets_creados.append(bucket)

    def set_bucket_policy(self, bucket, policy):
        self.politicas.append((bucket, policy))

    def put_object(self, bucket, objeto, data, length, content_type):
        if self.error_put:
            raise self.error_put
        self.puts.append({
            "bucket": bucket, "objeto": objeto, "data": data.read(),
            "length": length, "content_type": content_type,
        })

    def get_object(self, bucket, objeto):
        if self.error_get:
            raise self.error_get
        self.lecturas.append((bucket, objeto))
        return _Respuesta(f"leido:{objeto}".encode())

    def remove_object(self, bucket, objeto):
        self.eliminados.append((bucket, objeto))


def _s3(code="NoSuchKey"):
    return S3Error(None, code, "mensaje", "recurso", "request", "host")


@pytest.fixture(autouse=True)
def _sin_clientes_reales(monkeypatch):
    monkeypatch.setattr(minio_service, "_client", None)
    monkeypatch.setattr(minio_service, "_client_privado", None)


def test_cliente_publico_crea_bucket_y_cachea(mocker):
    # Arrange: el doble indica que el bucket no existe.
    falso = _ClienteFalso(existe=False)
    constructor = mocker.patch("app.services.minio_service.Minio", return_value=falso)
    # Act
    cliente1 = minio_service._cliente()
    cliente2 = minio_service._cliente()
    # Assert: una sola construcción, bucket creado y política pública aplicada.
    constructor.assert_called_once()
    assert cliente1 is cliente2 is falso
    assert falso.buckets_creados == [settings.MINIO_BUCKET]
    assert falso.politicas[0][0] == settings.MINIO_BUCKET
    assert "s3:GetObject" in falso.politicas[0][1]


def test_cliente_privado_crea_bucket_sin_politica(mocker):
    # Arrange
    falso = _ClienteFalso(existe=False)
    mocker.patch("app.services.minio_service.Minio", return_value=falso)
    # Act
    minio_service._cliente_privado()
    # Assert: el bucket privado se crea pero NUNCA recibe política pública.
    assert falso.buckets_creados == [settings.MINIO_PRIVATE_BUCKET]
    assert falso.politicas == []


def test_asegurar_bucket_envuelve_s3error_publico():
    # Act / Assert
    with pytest.raises(RuntimeError, match="No se pudo preparar el bucket"):
        minio_service._asegurar_bucket(_ClienteFalso(error_bucket=_s3("AccessDenied")))


def test_asegurar_bucket_privado_envuelve_s3error():
    with pytest.raises(RuntimeError, match="bucket privado"):
        minio_service._asegurar_bucket_privado(_ClienteFalso(error_bucket=_s3("AccessDenied")))


def test_subir_imagen_publica_devuelve_url_y_content_type(monkeypatch):
    # Arrange
    falso = _ClienteFalso()
    monkeypatch.setattr(minio_service, "_client", falso)
    # Act
    url = minio_service.subir_imagen("/productos/", "foto.PNG", b"abc")
    # Assert
    assert url == f"{settings.MINIO_PUBLIC_ENDPOINT}/{settings.MINIO_BUCKET}/productos/foto.PNG"
    put = falso.puts[0]
    assert put["bucket"] == settings.MINIO_BUCKET
    assert put["objeto"] == "productos/foto.PNG"
    assert put["data"] == b"abc"
    assert put["content_type"] == "image/png"


def test_subir_imagen_desconocida_usa_octet_stream_y_envuelve_error(monkeypatch):
    # Arrange
    falso = _ClienteFalso()
    monkeypatch.setattr(minio_service, "_client", falso)
    # Act: extensión sin tipo conocido.
    minio_service.subir_imagen("docs", "archivo.xyz", b"x")
    # Assert
    assert falso.puts[0]["content_type"] == "application/octet-stream"
    # Arrange 2: el doble de MinIO falla al subir.
    falso_falla = _ClienteFalso(error_put=_s3("InternalError"))
    monkeypatch.setattr(minio_service, "_client", falso_falla)
    # Act / Assert
    with pytest.raises(RuntimeError, match="Error subiendo"):
        minio_service.subir_imagen("docs", "archivo.jpg", b"x")


def test_subir_imagen_privada_marca_referencia(monkeypatch):
    # Arrange
    falso = _ClienteFalso()
    monkeypatch.setattr(minio_service, "_client_privado", falso)
    # Act
    ref = minio_service.subir_imagen_privada("evidencias", "foto.jpg", b"img")
    # Assert: referencia marcada y bucket privado.
    assert ref == "privado:evidencias/foto.jpg"
    assert falso.puts[0]["bucket"] == settings.MINIO_PRIVATE_BUCKET
    assert falso.puts[0]["content_type"] == "image/jpeg"


def test_leer_objeto_privado_cierra_y_traduce_no_such_key(monkeypatch, mocker):
    # Arrange
    respuesta = _Respuesta(b"evidencia")
    falso = mocker.Mock()
    falso.get_object.return_value = respuesta
    monkeypatch.setattr(minio_service, "_client_privado", falso)
    # Act
    data = minio_service.leer_objeto_privado("a.jpg")
    # Assert
    assert data == b"evidencia"
    assert respuesta.cerrada and respuesta.liberada
    # Arrange 2: NoSuchKey → FileNotFoundError.
    falso.get_object.side_effect = _s3("NoSuchKey")
    with pytest.raises(FileNotFoundError):
        minio_service.leer_objeto_privado("falta.jpg")
    # Arrange 3: otro error S3 se propaga sin disfraz.
    falso.get_object.side_effect = _s3("AccessDenied")
    with pytest.raises(S3Error):
        minio_service.leer_objeto_privado("privado.jpg")


def test_leer_objeto_publico_cierra_y_traduce_no_such_key(monkeypatch, mocker):
    # Arrange
    respuesta = _Respuesta(b"publico")
    falso = mocker.Mock()
    falso.get_object.return_value = respuesta
    monkeypatch.setattr(minio_service, "_client", falso)
    # Act
    data = minio_service.leer_objeto_publico("b.jpg")
    # Assert
    assert data == b"publico"
    assert respuesta.cerrada and respuesta.liberada
    falso.get_object.side_effect = _s3("NoSuchKey")
    with pytest.raises(FileNotFoundError):
        minio_service.leer_objeto_publico("falta.jpg")


@pytest.mark.parametrize(
    "ref,esperado",
    [
        (f"http://host/{settings.MINIO_BUCKET}/productos/a.jpg", "productos/a.jpg"),
        (f"http://host/{settings.MINIO_PRIVATE_BUCKET}/evidencias/b.jpg", "evidencias/b.jpg"),
        ("productos/c.jpg", "productos/c.jpg"),
        ("http://otro-host/sin-bucket.jpg", "http://otro-host/sin-bucket.jpg"),
    ],
)
def test_clave_desde_referencia_normaliza_urls(ref, esperado):
    assert minio_service._clave_desde_referencia(ref) == esperado


def test_leer_archivo_elige_bucket_y_media_type(monkeypatch, mocker):
    # Arrange
    privado = mocker.Mock()
    publico = mocker.Mock()
    monkeypatch.setattr(minio_service, "_client_privado", privado)
    monkeypatch.setattr(minio_service, "_client", publico)
    mocker.patch.object(minio_service, "leer_objeto_privado", return_value=b"priv")
    mocker.patch.object(minio_service, "leer_objeto_publico", return_value=b"pub")
    # Act
    data_priv, media_priv = minio_service.leer_archivo("privado:evidencias/foto.png")
    data_pub, media_pub = minio_service.leer_archivo("https://x/bucket/productos/a.pdf")
    # Assert
    assert (data_priv, media_priv) == (b"priv", "image/png")
    assert (data_pub, media_pub) == (b"pub", "application/pdf")


def test_eliminar_objeto_y_referencias_ignoran_errores(monkeypatch, mocker):
    # Arrange
    falso = _ClienteFalso()
    monkeypatch.setattr(minio_service, "_client", falso)
    monkeypatch.setattr(minio_service, "_client_privado", falso)
    # Act
    minio_service.eliminar_objeto_privado("privado:evidencias/a.jpg")
    minio_service.eliminar_objeto_privado("simple.jpg")
    # Assert
    assert falso.eliminados == [
        (settings.MINIO_PRIVATE_BUCKET, "evidencias/a.jpg"),
        (settings.MINIO_PRIVATE_BUCKET, "simple.jpg"),
    ]
    # Arrange 2: el doble falla; la operación es best-effort.
    falso.remove_object = mocker.Mock(side_effect=RuntimeError("sin red"))
    minio_service.eliminar_objeto_privado("x.jpg")
    minio_service.eliminar_objeto("x.jpg")


def test_eliminar_imagenes_solo_borra_referencias_del_bucket(monkeypatch):
    # Arrange
    falso = _ClienteFalso()
    monkeypatch.setattr(minio_service, "_client", falso)
    prefijo = f"{settings.MINIO_PUBLIC_ENDPOINT}/{settings.MINIO_BUCKET}/"
    # Act
    minio_service.eliminar_imagen_producto(f"{prefijo}productos/a.jpg")
    minio_service.eliminar_imagen_producto("https://otro-sitio/a.jpg")
    minio_service.eliminar_imagen_producto("")
    minio_service.eliminar_imagen_perfil(f"{prefijo}perfiles/b.jpg")
    minio_service.eliminar_imagen_perfil("")
    # Assert
    assert falso.eliminados == [
        (settings.MINIO_BUCKET, "productos/a.jpg"),
        (settings.MINIO_BUCKET, "perfiles/b.jpg"),
    ]
