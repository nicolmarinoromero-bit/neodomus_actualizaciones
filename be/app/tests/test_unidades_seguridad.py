"""Unitarias de reglas de seguridad — Semana 2 del bootcamp (pytest, AAA).

Objetivo: probar reglas de negocio REALES y aisladas, sin base de datos:
- Política de fortaleza de contraseñas (schemas/auth.py).
- Hash/verificación de contraseñas (utils/security.py), incluida la vía de
  hash inválido/legacy que bcrypt no puede verificar.
- Emisión/validación de JWT de acceso y refresco (tipos, expiración, alteración).

FIRST: rápidas (sin red/BD), independientes, repetibles, autoverificables.
"""
import pytest
from fastapi import HTTPException
from jose import jwt

from app.config import settings
from app.schemas.auth import _validate_password_strength
from app.utils import security
from app.utils.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
    verify_token,
)


# ── Política de fortaleza de contraseñas ─────────────────────────────────────
@pytest.mark.parametrize(
    "password",
    [
        "Abcdefg1",          # límite inferior exacto: 8 caracteres con todo
        "Xyz1234567890",     # larga y completa
        "Aa1" + "b" * 20,    # mayúscula, minúscula y dígito con relleno
    ],
)
def test_password_valida_se_acepta_y_se_devuelve_intacta(password):
    # Arrange / Act
    resultado = _validate_password_strength(password)
    # Assert: la validación devuelve la misma contraseña (solo valida).
    assert resultado == password


@pytest.mark.parametrize(
    "password, motivo",
    [
        ("Aa1b", "menos de 8 caracteres"),
        ("Aa12345", "7 caracteres: un carácter por debajo del límite"),
    ],
)
def test_password_corta_se_rechaza(password, motivo):
    with pytest.raises(ValueError, match="8 caracteres"):
        _validate_password_strength(password)


@pytest.mark.parametrize(
    "password, motivo_esperado",
    [
        ("abcdefg1", "sin mayúscula"),
        ("ABCDEFG1", "sin minúscula"),
        ("Abcdefgh", "sin número"),
    ],
)
def test_password_sin_requisito_se_rechaza(password, motivo_esperado):
    # Arrange: cada caso viola exactamente un requisito.
    # Act / Assert
    with pytest.raises(ValueError):
        _validate_password_strength(password)


# ── Hash y verificación de contraseñas ───────────────────────────────────────
def test_hash_y_verificacion_coinciden():
    # Arrange
    contraseña = "ContrasenaSegura123"
    # Act
    hash_generado = hash_password(contraseña)
    verificado = verify_password(contraseña, hash_generado)
    # Assert
    assert hash_generado != contraseña          # no se guarda en claro
    assert verificado is True


def test_verificacion_falla_con_otra_contraseña():
    # Arrange
    hash_generado = hash_password("Correcta123")
    # Act / Assert
    assert verify_password("Incorrecta999", hash_generado) is False


def test_hash_invalido_o_legacy_se_rechaza_sin_excepcion():
    # Arrange: un hash no bcrypt (formato legacy) debe dar False y NO levantar.
    # Act / Assert
    assert verify_password("loquesea1", "no-es-un-hash-bcrypt") is False


# ── Tokens JWT: tipos, expiración y alteración ───────────────────────────────
def test_token_de_acceso_lleva_tipo_uid_rol_y_sub():
    # Arrange / Act
    token = create_access_token({"sub": "a@neodomus.com"}, user_type="client",
                                rol="cliente", user_id=42)
    payload = decode_token(token)
    # Assert
    assert payload["type"] == "access"
    assert payload["sub"] == "a@neodomus.com"
    assert payload["user_type"] == "client"
    assert payload["rol"] == "cliente"
    assert payload["uid"] == "42"


def test_token_de_refresco_lleva_tipo_refresh():
    token = create_refresh_token({"sub": "a@neodomus.com"}, user_type="client")
    payload = decode_token(token)
    assert payload["type"] == "refresh"


def test_verify_token_rechaza_tipo_distinto():
    # Arrange: un refresh no sirve como access (cada tipo para su propósito).
    refresh = create_refresh_token({"sub": "a@neodomus.com"})
    # Act / Assert
    with pytest.raises(HTTPException) as excinfo:
        verify_token(refresh, token_type="access")
    assert excinfo.value.status_code == 401


def test_verify_token_acepta_su_tipo():
    access = create_access_token({"sub": "b@neodomus.com"}, user_type="employee")
    payload = verify_token(access, token_type="access")
    assert payload["user_type"] == "employee"


def test_token_expirado_se_rechaza(monkeypatch):
    # Arrange: emitir con expiración negativa (5 min antes de ahora).
    monkeypatch.setattr(security, "ACCESS_TOKEN_EXPIRE_MINUTES", -10)
    token = create_access_token({"sub": "c@neodomus.com"}, user_type="client")
    # Act
    payload = decode_token(token)
    # Assert: jose lo rechaza por expiración.
    assert payload is None
    with pytest.raises(HTTPException) as excinfo:
        verify_token(token, token_type="access")
    assert excinfo.value.status_code == 401


def test_token_alterado_se_rechaza():
    # Arrange: token válido cuyo payload se modifica sin re-firmar.
    token = create_access_token({"sub": "d@neodomus.com"}, user_type="client")
    encabezado, cuerpo, firma = token.split(".")
    cuerpo_alterado = cuerpo[:-4] + "AAAA"
    token_alterado = f"{encabezado}.{cuerpo_alterado}.{firma}"
    # Act / Assert
    assert decode_token(token_alterado) is None


def test_decode_token_rechaza_firma_de_otra_clave():
    # Arrange: token firmado con una clave distinta a settings.SECRET_KEY.
    ajeno = jwt.encode({"sub": "x", "type": "access"}, "clave-falsa-de-prueba",
                       algorithm=settings.ALGORITHM)
    # Act / Assert
    assert decode_token(ajeno) is None
