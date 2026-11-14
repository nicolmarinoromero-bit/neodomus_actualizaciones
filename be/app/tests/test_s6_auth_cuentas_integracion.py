"""S6: autenticación, sesión y gestión de cuentas contra MySQL real.

Pruebas de integración de la Semana 6: ejercitan los endpoints HTTP reales de
``/auth`` sobre la base ``neodomus_test`` y verifican el estado persistido
(clientes, usuarios, tokens de recuperación y solicitudes de habilitación).

Cubre:
- login de cliente/empleado, roles, cuentas inactivas y formulario OAuth2;
- sesión por header y por cookie, refresh (cuerpo y cookie) y logout;
- cambio/actualización de contraseña (cliente y empleado);
- recuperación de contraseña con código de 6 dígitos y un solo uso;
- cambio de correo con código, intentos fallidos y límite de intentos;
- login con Google (mock del verificador), creación de cliente y vinculación
  de empleados;
- registro con verificación de correo y solicitudes de habilitación.

El correo SMTP y la verificación de Google se neutralizan con ``unittest.mock``;
no se envían correos reales ni se usan credenciales externas.
"""
from __future__ import annotations

import json
import unittest
from datetime import datetime, timedelta, timezone
from unittest.mock import patch

import app.tests.testdb  # noqa: F401  (aislamiento antes de importar la app)

from app.models.cliente import Cliente
from app.models.password_reset_token import PasswordResetToken
from app.models.pending_registration import PendingRegistration
from app.models.solicitud_cuenta import SolicitudCuenta
from app.models.solicitud_habilitacion_empleado import SolicitudHabilitacionEmpleado
from app.models.user import User
from app.tests.s6_base import BaseS6TestCase
from app.tests.test_t1_identidad import PASSWORD


async def _async_noop(*args, **kwargs):
    """Sustituye a los envíos de correo en las pruebas."""
    return True


def _ahora_naive() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)


class AuthCuentasS6TestCase(BaseS6TestCase):
    """Flujos de identidad y cuentas sobre la base de pruebas real."""

    def setUp(self):
        super().setUp()
        # Correos usados para limpiar PasswordResetToken (sin FK a cliente).
        self._emails_reset: list[str] = []

    def tearDown(self):
        try:
            self.db.rollback()
            emails = set(self._emails_reset)
            if self._ids_cliente:
                emails.update(
                    email
                    for (email,) in self.db.query(Cliente.email)
                    .filter(Cliente.id_cliente.in_(self._ids_cliente))
                    .all()
                    if email
                )
            if self._ids_usuario:
                emails.update(
                    email
                    for (email,) in self.db.query(User.email)
                    .filter(User.id_usuario.in_(self._ids_usuario))
                    .all()
                    if email
                )
            emails.update(self._emails_pending)
            if emails:
                self.db.query(PasswordResetToken).filter(
                    PasswordResetToken.email.in_(list(emails))
                ).delete(synchronize_session=False)
                self.db.commit()
        finally:
            super().tearDown()

    # ── utilidades de la suite ──────────────────────────────────────────
    def _crear_cliente_seguimiento(self, sufijo: str, activo: bool = True) -> Cliente:
        cliente = self._crear_cliente(sufijo, activo)
        self._emails_reset.append(cliente.email)
        return cliente

    def _crear_usuario_seguimiento(
        self, sufijo: str, id_rol: int | None, activo: bool = True
    ) -> User:
        usuario = self._crear_usuario(sufijo, id_rol, activo)
        self.db.commit()
        self.db.refresh(usuario)
        self._emails_reset.append(usuario.email)
        return usuario

    def _login_detallado(self, email: str, password: str = PASSWORD, user_type=None):
        cuerpo = {"email": email, "password": password}
        if user_type:
            cuerpo["user_type"] = user_type
        return self._post("/api/v1/auth/login", json=cuerpo)

    def _ultimo_token(self, email: str) -> PasswordResetToken | None:
        self._resincronizar()
        return (
            self.db.query(PasswordResetToken)
            .filter(PasswordResetToken.email == email)
            .order_by(PasswordResetToken.id.desc())
            .first()
        )

    def _google_patch(self, **claims):
        """Parchea el verificador de Google con los claims indicados."""
        info = {
            "sub": "google-sub-s6",
            "email": self._email("t6.gmail"),
            "given_name": "Ana",
            "family_name": "Gómez",
            "email_verified": True,
        }
        info.update(claims)
        return patch(
            "google.oauth2.id_token.verify_oauth2_token", return_value=info
        )

    # ── 1. login, sesión, refresh y logout ─────────────────────────────
    def test_login_sesion_refresh_logout_y_cuentas_inactivas(self):
        cliente = self._crear_cliente_seguimiento("auth")
        login = self._login(cliente.email)
        self.assertEqual(login.status_code, 200, login.text)
        body = login.json()
        self.assertEqual(body["user_type"], "client")
        self.assertEqual(body["rol"], "cliente")
        self.assertEqual(body["token_type"], "bearer")
        self.assertIn("access_token", login.cookies)
        self.assertIn("refresh_token", login.cookies)
        cabeceras_cookie = " ".join(login.headers.get_list("set-cookie"))
        self.assertIn("HttpOnly", cabeceras_cookie)
        access = body["access_token"]
        refresh = body["refresh_token"]

        # Credenciales incorrectas y cuentas inexistentes.
        self.assertEqual(self._login(cliente.email, "WrongPass123").status_code, 401)
        self.assertEqual(
            self._login_detallado(cliente.email, user_type="employee").status_code, 401
        )
        self.assertEqual(
            self._login("t6.inexistente@neodomus.com").status_code, 401
        )

        # Sesión: prioridad del header, respaldo por cookie y sin token.
        sesion = self._get("/api/v1/auth/session", headers=self._bearer(access))
        self.assertEqual(sesion.status_code, 200, sesion.text)
        self.assertEqual(sesion.json()["user_type"], "client")
        self.assertEqual(sesion.json()["rol"], "cliente")
        self.assertEqual(sesion.json()["uid"], str(cliente.id_cliente))
        sesion_cookie = self._get(
            "/api/v1/auth/session", cookies={"access_token": access}
        )
        self.assertEqual(sesion_cookie.status_code, 200, sesion_cookie.text)
        self.assertEqual(self._get("/api/v1/auth/session").status_code, 401)

        # Refresh por cuerpo y por cookie.
        refresco = self._post(
            "/api/v1/auth/refresh", json={"refresh_token": refresh}
        )
        self.assertEqual(refresco.status_code, 200, refresco.text)
        access2 = refresco.json()["access_token"]
        self.assertEqual(
            self._get("/api/v1/auth/session", headers=self._bearer(access2)).status_code,
            200,
        )
        refresco_cookie = self._post(
            "/api/v1/auth/refresh", cookies={"refresh_token": refresh}
        )
        # El primer refresh rota el token; reutilizar el anterior debe fallar
        # y revocar la familia completa para prevenir replay.
        self.assertEqual(refresco_cookie.status_code, 401, refresco_cookie.text)

        # Errores de refresh: sin token, token de acceso y token corrupto.
        self.assertEqual(self._post("/api/v1/auth/refresh").status_code, 400)
        self.assertEqual(
            self._post(
                "/api/v1/auth/refresh", json={"refresh_token": access}
            ).status_code,
            401,
        )
        self.assertEqual(
            self._post(
                "/api/v1/auth/refresh", json={"refresh_token": "no-es-un-jwt"}
            ).status_code,
            401,
        )

        # Logout: elimina ambas cookies HttpOnly.
        logout = self._post("/api/v1/auth/logout")
        self.assertEqual(logout.status_code, 200, logout.text)
        cookies_borradas = " ".join(logout.headers.get_list("set-cookie"))
        self.assertIn("access_token", cookies_borradas)
        self.assertIn("refresh_token", cookies_borradas)
        self.assertIn("Max-Age=0", cookies_borradas)

        # Un cliente desactivado no puede refrescar su sesión.
        cliente.is_active = False
        self.db.commit()
        self.assertEqual(
            self._post(
                "/api/v1/auth/refresh", json={"refresh_token": refresh}
            ).status_code,
            401,
        )

        # Empleados: técnico activo e inactivo.
        tecnico, _ = self._crear_tecnico("auth")
        self._emails_reset.append(tecnico.email)
        r_tec = self._login(tecnico.email)
        self.assertEqual(r_tec.status_code, 200, r_tec.text)
        self.assertEqual(r_tec.json()["user_type"], "employee")
        self.assertEqual(r_tec.json()["rol"], "tecnico")
        sesion_tec = self._get(
            "/api/v1/auth/session", headers=self._bearer(r_tec.json()["access_token"])
        )
        self.assertEqual(sesion_tec.status_code, 200, sesion_tec.text)
        self.assertEqual(sesion_tec.json()["rol"], "tecnico")

        inactivo = self._crear_usuario_seguimiento("authina", 2, activo=False)
        self.assertEqual(self._login(inactivo.email).status_code, 403)

        # Cliente inactivo (login directo).
        cliente_inactivo = self._crear_cliente_seguimiento("authcli", activo=False)
        self.assertEqual(self._login(cliente_inactivo.email).status_code, 403)

    # ── 2. rol inválido y formulario OAuth2 ────────────────────────────
    def test_login_rol_invalido_y_formulario_oauth2(self):
        sin_rol = self._crear_usuario_seguimiento("sinrol", None)
        r = self._login(sin_rol.email)
        self.assertEqual(r.status_code, 403, r.text)
        self.assertIn("rol válido", r.json()["detail"])

        tecnico, _ = self._crear_tecnico("oauth")
        self._emails_reset.append(tecnico.email)
        r_form = self._post(
            "/api/v1/auth/token",
            data={"username": tecnico.email, "password": PASSWORD},
        )
        self.assertEqual(r_form.status_code, 200, r_form.text)
        self.assertEqual(r_form.json()["user_type"], "employee")
        self.assertIn("access_token", r_form.json())

        r_mal = self._post(
            "/api/v1/auth/token",
            data={"username": tecnico.email, "password": "WrongPass123"},
        )
        self.assertEqual(r_mal.status_code, 401)

        # Registro pendiente: el login informa correo sin verificar (403) y,
        # si el código expiró, pide solicitar uno nuevo (400).
        email = self._email("t6.pend")
        self._emails_pending.append(email)
        with patch(
            "app.services.auth_service.send_verification_email", new=_async_noop
        ):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/register/client",
                    json={
                        "first_name": "Pendiente",
                        "last_name": "Prueba",
                        "email": email,
                        "password": PASSWORD,
                    },
                ).status_code,
                200,
            )
        self.assertEqual(self._login(email).status_code, 403)
        self._resincronizar()
        pendiente = (
            self.db.query(PendingRegistration)
            .filter(PendingRegistration.email == email)
            .first()
        )
        pendiente.expires_at = _ahora_naive() - timedelta(hours=1)
        self.db.commit()
        self.assertEqual(self._login(email).status_code, 400)

    # ── 3. cambio de contraseña ─────────────────────────────────────────
    def test_cambio_password_cliente_y_empleado(self):
        cliente = self._crear_cliente_seguimiento("chg")
        cabeceras = self._bearer(self._login(cliente.email).json()["access_token"])

        incorrecta = self._post(
            "/api/v1/auth/change-password",
            headers=cabeceras,
            json={"current_password": "WrongPass123", "new_password": "NuevaPass123"},
        )
        self.assertEqual(incorrecta.status_code, 400, incorrecta.text)

        debil = self._post(
            "/api/v1/auth/change-password",
            headers=cabeceras,
            json={"current_password": PASSWORD, "new_password": "corta"},
        )
        self.assertEqual(debil.status_code, 422)

        cambio = self._post(
            "/api/v1/auth/change-password",
            headers=cabeceras,
            json={"current_password": PASSWORD, "new_password": "NuevaPass123"},
        )
        self.assertEqual(cambio.status_code, 200, cambio.text)
        self.assertEqual(self._login(cliente.email, PASSWORD).status_code, 401)
        self.assertEqual(self._login(cliente.email, "NuevaPass123").status_code, 200)

        # El endpoint de actualización directa es solo para empleados.
        self.assertEqual(
            self._post(
                "/api/v1/auth/update-password",
                headers=cabeceras,
                json={"new_password": "OtraClave123"},
            ).status_code,
            403,
        )

        # Empleado con cambio obligatorio: al cambiarla se limpia la marca.
        tecnico, _ = self._crear_tecnico("chg")
        self._emails_reset.append(tecnico.email)
        tecnico.password_reset_required = True
        self.db.commit()
        login_tec = self._login(tecnico.email)
        self.assertEqual(login_tec.status_code, 200, login_tec.text)
        self.assertTrue(login_tec.json()["password_reset_required"])
        cabeceras_tec = self._bearer(login_tec.json()["access_token"])
        self.assertEqual(
            self._post(
                "/api/v1/auth/change-password",
                headers=cabeceras_tec,
                json={"current_password": PASSWORD, "new_password": "ClaveTec123"},
            ).status_code,
            200,
        )
        self._resincronizar()
        self.db.refresh(tecnico)
        self.assertFalse(tecnico.password_reset_required)
        self.assertEqual(self._login(tecnico.email, "ClaveTec123").status_code, 200)
        self.assertEqual(self._login(tecnico.email, PASSWORD).status_code, 401)

    # ── 4. actualización de contraseña sin actual ───────────────────────
    def test_update_password_empleado_sin_clave_actual(self):
        tecnico, _ = self._crear_tecnico("upd")
        self._emails_reset.append(tecnico.email)
        cabeceras = self._bearer(self._login(tecnico.email).json()["access_token"])
        self.assertEqual(
            self._post(
                "/api/v1/auth/update-password",
                headers=cabeceras,
                json={"new_password": "Directa123"},
            ).status_code,
            200,
        )
        self.assertEqual(self._login(tecnico.email, "Directa123").status_code, 200)
        self.assertEqual(self._login(tecnico.email, PASSWORD).status_code, 401)
        # Validación de fortaleza antes de tocar la cuenta.
        self.assertEqual(
            self._post(
                "/api/v1/auth/update-password",
                headers=cabeceras,
                json={"new_password": "sinmayus"},
            ).status_code,
            422,
        )

    # ── 5. recuperación de contraseña ───────────────────────────────────
    def test_forgot_password_codigo_reset_y_un_solo_uso(self):
        cliente = self._crear_cliente_seguimiento("fg")
        existente = self._post(
            "/api/v1/auth/forgot-password", json={"email": cliente.email}
        )
        inexistente = self._post(
            "/api/v1/auth/forgot-password", json={"email": self._email("t6.noforgot")}
        )
        self.assertEqual(existente.status_code, 200, existente.text)
        self.assertEqual(inexistente.status_code, 200, inexistente.text)
        self.assertEqual(existente.json(), inexistente.json())

        token = self._ultimo_token(cliente.email)
        self.assertIsNotNone(token)
        self.assertEqual(token.user_type, "client")
        codigo_malo = "000000" if token.code != "000000" else "111111"

        self.assertEqual(
            self._post(
                "/api/v1/auth/verify-code",
                json={"email": cliente.email, "code": codigo_malo},
            ).status_code,
            400,
        )
        self.assertEqual(
            self._post(
                "/api/v1/auth/verify-code",
                json={"email": cliente.email, "code": token.code},
            ).status_code,
            200,
        )
        self.assertEqual(
            self._post(
                "/api/v1/auth/reset-password",
                json={"token": codigo_malo, "new_password": "NuevaPass123"},
            ).status_code,
            400,
        )
        assert self._post(
            "/api/v1/auth/reset-password",
            json={"token": token.code, "new_password": "NuevaPass123"},
        ).status_code == 200
        self.assertEqual(self._login(cliente.email, "NuevaPass123").status_code, 200)
        self.assertEqual(self._login(cliente.email, PASSWORD).status_code, 401)
        # El código de 6 dígitos es de un solo uso.
        self.assertEqual(
            self._post(
                "/api/v1/auth/reset-password",
                json={"token": token.code, "new_password": "OtraClave123"},
            ).status_code,
            400,
        )

        # Código expirado.
        cliente2 = self._crear_cliente_seguimiento("fg2")
        self.assertEqual(
            self._post(
                "/api/v1/auth/forgot-password", json={"email": cliente2.email}
            ).status_code,
            200,
        )
        token2 = self._ultimo_token(cliente2.email)
        token2.expires_at = _ahora_naive() - timedelta(minutes=1)
        self.db.commit()
        self.assertEqual(
            self._post(
                "/api/v1/auth/reset-password",
                json={"token": token2.code, "new_password": "NuevaPass123"},
            ).status_code,
            400,
        )

        # Empleado: el token se registra con user_type "employee".
        tecnico, _ = self._crear_tecnico("fg")
        self._emails_reset.append(tecnico.email)
        self.assertEqual(
            self._post(
                "/api/v1/auth/forgot-password", json={"email": tecnico.email}
            ).status_code,
            200,
        )
        token_tec = self._ultimo_token(tecnico.email)
        self.assertEqual(token_tec.user_type, "employee")
        self.assertEqual(
            self._post(
                "/api/v1/auth/reset-password",
                json={"token": token_tec.code, "new_password": "ClaveTec123"},
            ).status_code,
            200,
        )
        self.assertEqual(self._login(tecnico.email, "ClaveTec123").status_code, 200)

    # ── 6. cambio de correo electrónico ─────────────────────────────────
    def test_cambio_email_cliente_y_empleado(self):
        cliente = self._crear_cliente_seguimiento("mail")
        cabeceras = self._bearer(self._login(cliente.email).json()["access_token"])
        nuevo = self._email("t6.mailnuevo")
        self._emails_reset.append(nuevo)

        self.assertEqual(
            self._post(
                "/api/v1/auth/request-email-change",
                headers=cabeceras,
                json={"nuevo_email": cliente.email},
            ).status_code,
            400,
        )
        otro = self._crear_cliente_seguimiento("mail2")
        self.assertEqual(
            self._post(
                "/api/v1/auth/request-email-change",
                headers=cabeceras,
                json={"nuevo_email": otro.email},
            ).status_code,
            400,
        )

        with patch(
            "app.services.auth_service.send_email_change_code", new=_async_noop
        ):
            solicitud = self._post(
                "/api/v1/auth/request-email-change",
                headers=cabeceras,
                json={"nuevo_email": nuevo},
            )
        self.assertEqual(solicitud.status_code, 200, solicitud.text)
        registro = self._ultimo_token(cliente.email)
        self.assertIsNotNone(registro)
        datos = json.loads(registro.token)
        self.assertEqual(datos["nuevo_email"], nuevo)

        codigo_malo = "000000" if registro.code != "000000" else "111111"
        incorrecto = self._post(
            "/api/v1/auth/verify-email-change",
            headers=cabeceras,
            json={"code": codigo_malo, "nuevo_email": nuevo},
        )
        self.assertEqual(incorrecto.status_code, 400, incorrecto.text)
        self._resincronizar()
        self.db.refresh(registro)
        self.assertEqual(json.loads(registro.token)["intentos"], 1)

        no_coincide = self._post(
            "/api/v1/auth/verify-email-change",
            headers=cabeceras,
            json={"code": registro.code, "nuevo_email": self._email("t6.otro")},
        )
        self.assertEqual(no_coincide.status_code, 400, no_coincide.text)

        correcto = self._post(
            "/api/v1/auth/verify-email-change",
            headers=cabeceras,
            json={"code": registro.code, "nuevo_email": nuevo},
        )
        self.assertEqual(correcto.status_code, 200, correcto.text)
        self._resincronizar()
        self.db.refresh(cliente)
        self.assertEqual(cliente.email, nuevo)
        self.assertEqual(self._login(nuevo).status_code, 200)

        # Límite de intentos: al llegar a 5 la solicitud queda invalidada.
        cliente3 = self._crear_cliente_seguimiento("mail3")
        cab3 = self._bearer(self._login(cliente3.email).json()["access_token"])
        nuevo3 = self._email("t6.mail3nuevo")
        self._emails_reset.append(nuevo3)
        with patch(
            "app.services.auth_service.send_email_change_code", new=_async_noop
        ):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/request-email-change",
                    headers=cab3,
                    json={"nuevo_email": nuevo3},
                ).status_code,
                200,
            )
        registro3 = self._ultimo_token(cliente3.email)
        registro3.token = json.dumps({"nuevo_email": nuevo3, "intentos": 5})
        self.db.commit()
        limite = self._post(
            "/api/v1/auth/verify-email-change",
            headers=cab3,
            json={"code": registro3.code, "nuevo_email": nuevo3},
        )
        self.assertEqual(limite.status_code, 429, limite.text)

        # Empleado: mismo flujo y el login usa el nuevo correo.
        tecnico, _ = self._crear_tecnico("mail")
        self._emails_reset.append(tecnico.email)
        cab_tec = self._bearer(self._login(tecnico.email).json()["access_token"])
        nuevo_tec = self._email("t6.mailtec")
        self._emails_reset.append(nuevo_tec)
        with patch(
            "app.services.auth_service.send_email_change_code", new=_async_noop
        ):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/request-email-change",
                    headers=cab_tec,
                    json={"nuevo_email": nuevo_tec},
                ).status_code,
                200,
            )
        registro_tec = self._ultimo_token(tecnico.email)
        self.assertEqual(
            self._post(
                "/api/v1/auth/verify-email-change",
                headers=cab_tec,
                json={"code": registro_tec.code, "nuevo_email": nuevo_tec},
            ).status_code,
            200,
        )
        self.assertEqual(self._login(nuevo_tec).status_code, 200)

    # ── 7. login con Google y vinculación de empleados ──────────────────
    def test_google_login_cliente_empleado_y_vinculacion(self):
        # Token inválido / incompleto → 401.
        with patch(
            "google.oauth2.id_token.verify_oauth2_token",
            side_effect=Exception("token inválido"),
        ):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/google", json={"credential": "malo"}
                ).status_code,
                401,
            )
        with self._google_patch(email="", sub="solo-sub"):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/google", json={"credential": "incompleto"}
                ).status_code,
                401,
            )

        # Cliente existente: se vincula google_id y se emiten tokens de cliente.
        cliente = self._crear_cliente_seguimiento("goog")
        uid = f"google-{cliente.id_cliente}"
        with self._google_patch(email=cliente.email, sub=uid):
            login = self._post(
                "/api/v1/auth/google", json={"credential": "ok"}
            )
        self.assertEqual(login.status_code, 200, login.text)
        self.assertEqual(login.json()["user_type"], "client")
        self._resincronizar()
        self.db.refresh(cliente)
        self.assertEqual(cliente.google_id, uid)

        # Cliente nuevo: se crea con auth_provider google.
        email_nuevo = self._email("t6.goognuevo")
        self._emails_pending.append(email_nuevo)
        with self._google_patch(email=email_nuevo, sub="google-nuevo-s6"):
            alta = self._post(
                "/api/v1/auth/google", json={"credential": "ok"}
            )
        self.assertEqual(alta.status_code, 200, alta.text)
        self.assertEqual(alta.json()["user_type"], "client")
        self.assertTrue(alta.json()["perfil_incompleto"])
        self._resincronizar()
        creado = (
            self.db.query(Cliente).filter(Cliente.email == email_nuevo).first()
        )
        self.assertIsNotNone(creado)
        self._ids_cliente.append(creado.id_cliente)
        self.assertEqual(creado.auth_provider, "google")
        self.assertIsNone(creado.password_hash)

        # Sin creación explícita, una cuenta Google desconocida → 409.
        with self._google_patch(
            email=self._email("t6.googsinvincular"), sub="google-sin-vincular"
        ):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/google",
                    json={"credential": "ok", "create_client": False},
                ).status_code,
                409,
            )

        # Cliente inactivo → 403.
        inactivo = self._crear_cliente_seguimiento("googina", activo=False)
        with self._google_patch(email=inactivo.email, sub="google-inactivo"):
            self.assertEqual(
                self._post("/api/v1/auth/google", json={"credential": "ok"}).status_code,
                403,
            )

        # Correo de empleado: entra como empleado.
        tecnico, _ = self._crear_tecnico("goog")
        self._emails_reset.append(tecnico.email)
        with self._google_patch(email=tecnico.email, sub="google-tec-s6"):
            r_tec = self._post("/api/v1/auth/google", json={"credential": "ok"})
        self.assertEqual(r_tec.status_code, 200, r_tec.text)
        self.assertEqual(r_tec.json()["user_type"], "employee")
        self.assertEqual(r_tec.json()["rol"], "tecnico")

        empleado_inactivo = self._crear_usuario_seguimiento(
            "googempina", 2, activo=False
        )
        with self._google_patch(email=empleado_inactivo.email, sub="google-emp-ina"):
            self.assertEqual(
                self._post("/api/v1/auth/google", json={"credential": "ok"}).status_code,
                403,
            )

        empleado_sin_rol = self._crear_usuario_seguimiento("googempnorol", None)
        with self._google_patch(email=empleado_sin_rol.email, sub="google-emp-norol"):
            self.assertEqual(
                self._post("/api/v1/auth/google", json={"credential": "ok"}).status_code,
                403,
            )

        # Vinculación de empleados con Google.
        with patch(
            "google.oauth2.id_token.verify_oauth2_token",
            side_effect=Exception("token inválido"),
        ):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/google/link-employee",
                    json={"credential": "malo", "email": tecnico.email, "password": PASSWORD},
                ).status_code,
                401,
            )
        with self._google_patch(email=tecnico.email, sub="google-link", email_verified=False):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/google/link-employee",
                    json={"credential": "ok", "email": tecnico.email, "password": PASSWORD},
                ).status_code,
                401,
            )
        with self._google_patch(email=tecnico.email, sub="", email_verified=True):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/google/link-employee",
                    json={"credential": "ok", "email": tecnico.email, "password": PASSWORD},
                ).status_code,
                401,
            )
        with self._google_patch(email=tecnico.email, sub="google-link"):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/google/link-employee",
                    json={
                        "credential": "ok",
                        "email": tecnico.email,
                        "password": "WrongPass123",
                    },
                ).status_code,
                401,
            )
        with self._google_patch(email=empleado_inactivo.email, sub="google-link-ina"):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/google/link-employee",
                    json={
                        "credential": "ok",
                        "email": empleado_inactivo.email,
                        "password": PASSWORD,
                    },
                ).status_code,
                403,
            )
        with self._google_patch(email=empleado_sin_rol.email, sub="google-link-norol"):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/google/link-employee",
                    json={
                        "credential": "ok",
                        "email": empleado_sin_rol.email,
                        "password": PASSWORD,
                    },
                ).status_code,
                403,
            )

        # Google ya vinculado a otro empleado → 409.
        tecnico2, _ = self._crear_tecnico("goog2")
        self._emails_reset.append(tecnico2.email)
        tecnico.google_id = "google-ocupado-s6"
        self.db.commit()
        with self._google_patch(email=tecnico.email, sub="google-ocupado-s6"):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/google/link-employee",
                    json={
                        "credential": "ok",
                        "email": tecnico2.email,
                        "password": PASSWORD,
                    },
                ).status_code,
                409,
            )

        # Vinculación correcta y login posterior por google_id.
        uid_tecnico = "google-vinculado-s6"
        with self._google_patch(email=tecnico2.email, sub=uid_tecnico):
            vinculado = self._post(
                "/api/v1/auth/google/link-employee",
                json={
                    "credential": "ok",
                    "email": tecnico2.email,
                    "password": PASSWORD,
                },
            )
        self.assertEqual(vinculado.status_code, 200, vinculado.text)
        self.assertEqual(vinculado.json()["user_type"], "employee")
        self._resincronizar()
        self.db.refresh(tecnico2)
        self.assertEqual(tecnico2.google_id, uid_tecnico)

        with self._google_patch(email="otro-correo@neodomus.com", sub=uid_tecnico):
            relogin = self._post("/api/v1/auth/google", json={"credential": "ok"})
        self.assertEqual(relogin.status_code, 200, relogin.text)
        self.assertEqual(relogin.json()["user_type"], "employee")

        # Identidad Google vinculada a una cuenta inactiva → 403.
        tecnico2.is_active = False
        self.db.commit()
        with self._google_patch(email="otro-correo@neodomus.com", sub=uid_tecnico):
            self.assertEqual(
                self._post("/api/v1/auth/google", json={"credential": "ok"}).status_code,
                403,
            )

    # ── 8. registro con verificación y solicitudes de habilitación ──────
    def test_registro_verificacion_y_solicitudes_habilitacion(self):
        email = self._email("t6.reg")
        self._emails_pending.append(email)
        with patch(
            "app.services.auth_service.send_verification_email", new=_async_noop
        ):
            registro = self._post(
                "/api/v1/auth/register/client",
                json={
                    "first_name": "Nuevo",
                    "last_name": "Registro",
                    "email": email,
                    "password": PASSWORD,
                    "documento_cliente": 1020304050,
                    "telefono_cliente": 3001112233,
                    "address": "Calle 1 # 2-3",
                },
            )
        self.assertEqual(registro.status_code, 200, registro.text)
        self._resincronizar()
        pendiente = (
            self.db.query(PendingRegistration)
            .filter(PendingRegistration.email == email)
            .first()
        )
        self.assertIsNotNone(pendiente)
        self.assertEqual(pendiente.first_name, "NUEVO")
        codigo_viejo = pendiente.code

        # Contraseña débil rechazada por el esquema.
        self.assertEqual(
            self._post(
                "/api/v1/auth/register/client",
                json={
                    "first_name": "Debil",
                    "last_name": "Prueba",
                    "email": self._email("t6.debil"),
                    "password": "corta",
                },
            ).status_code,
            422,
        )

        # Reenvío: cambia el código y el anterior deja de servir.
        with patch(
            "app.services.auth_service.send_verification_email", new=_async_noop
        ):
            self.assertEqual(
                self._post(
                    "/api/v1/auth/resend-verification", json={"email": email}
                ).status_code,
                200,
            )
        self._resincronizar()
        self.db.refresh(pendiente)
        self.assertNotEqual(pendiente.code, codigo_viejo)
        self.assertEqual(
            self._post(
                "/api/v1/auth/verify-email", params={"code": codigo_viejo}
            ).status_code,
            400,
        )
        self.assertEqual(
            self._post(
                "/api/v1/auth/verify-email", params={"code": "000000"}
            ).status_code,
            400,
        )
        self.assertEqual(
            self._post(
                "/api/v1/auth/verify-email", params={"code": pendiente.code}
            ).status_code,
            200,
        )
        self._resincronizar()
        creado = self.db.query(Cliente).filter(Cliente.email == email).first()
        self.assertIsNotNone(creado)
        self.assertTrue(creado.is_active)
        self.assertIsNone(
            self.db.query(PendingRegistration)
            .filter(PendingRegistration.email == email)
            .first()
        )
        self.assertEqual(self._login(email).status_code, 200)
        # El correo ya verificado no puede registrarse de nuevo.
        self.assertEqual(
            self._post(
                "/api/v1/auth/register/client",
                json={
                    "first_name": "Otra",
                    "last_name": "Vez",
                    "email": email,
                    "password": PASSWORD,
                },
            ).status_code,
            400,
        )
        # Reenvío sin registro pendiente → 404.
        self.assertEqual(
            self._post(
                "/api/v1/auth/resend-verification",
                json={"email": self._email("t6.sinpendiente")},
            ).status_code,
            404,
        )

        # Solicitud de habilitación: cliente inactivo.
        inactivo = self._crear_cliente_seguimiento("hab", activo=False)
        self.assertEqual(
            self._post(
                "/api/v1/auth/solicitar-habilitacion",
                json={"email": inactivo.email, "password": "WrongPass123"},
            ).status_code,
            401,
        )
        self.assertEqual(
            self._post(
                "/api/v1/auth/solicitar-habilitacion",
                json={"email": inactivo.email, "password": PASSWORD},
            ).status_code,
            200,
        )
        self._resincronizar()
        solicitud = (
            self.db.query(SolicitudCuenta)
            .filter(SolicitudCuenta.id_cliente == inactivo.id_cliente)
            .first()
        )
        self.assertIsNotNone(solicitud)
        self.assertEqual(solicitud.tipo, "habilitar")
        self.assertEqual(solicitud.estado, "pendiente")
        self.assertEqual(
            self._post(
                "/api/v1/auth/solicitar-habilitacion",
                json={"email": inactivo.email, "password": PASSWORD},
            ).status_code,
            400,
        )

        activo = self._crear_cliente_seguimiento("hab2")
        self.assertEqual(
            self._post(
                "/api/v1/auth/solicitar-habilitacion",
                json={"email": activo.email, "password": PASSWORD},
            ).status_code,
            400,
        )

        # Solicitud de habilitación: empleado inactivo.
        empleado = self._crear_usuario_seguimiento("habemp", 2, activo=False)
        self.assertEqual(
            self._post(
                "/api/v1/auth/solicitar-habilitacion",
                json={"email": empleado.email, "password": PASSWORD},
            ).status_code,
            200,
        )
        self._resincronizar()
        solicitud_emp = (
            self.db.query(SolicitudHabilitacionEmpleado)
            .filter(SolicitudHabilitacionEmpleado.id_usuario == empleado.id_usuario)
            .first()
        )
        self.assertIsNotNone(solicitud_emp)
        self.assertEqual(solicitud_emp.estado, "pendiente")
        self.assertEqual(
            self._post(
                "/api/v1/auth/solicitar-habilitacion",
                json={"email": empleado.email, "password": PASSWORD},
            ).status_code,
            400,
        )


if __name__ == "__main__":
    unittest.main(verbosity=2)
