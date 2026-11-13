"""Rotación y revocación de refresh tokens (flujos HTTP reales).

Verifica que cada refresh emite un token nuevo, que reutilizar un token ya
rotado revoca toda la familia, y que el logout y el cambio de contraseña
invalidan los refresh tokens vigentes.
"""
import app.tests.testdb  # noqa: F401  (aislamiento antes de importar la app)

from app.tests.test_t1_identidad import BaseT1TestCase, PASSWORD


class RotacionRefreshTokenTestCase(BaseT1TestCase):
    def _refresh(self, refresh_token):
        return self._post("/api/v1/auth/refresh", json={"refresh_token": refresh_token})

    def test_refresh_rota_y_reuso_revoca_familia(self):
        c = self._crear_cliente("rot")
        login = self._login(c.email)
        self.assertEqual(login.status_code, 200, login.text)
        original = login.json()["refresh_token"]

        rotado = self._refresh(original)
        self.assertEqual(rotado.status_code, 200, rotado.text)
        nuevo = rotado.json()["refresh_token"]
        self.assertNotEqual(nuevo, original)

        # Reutilizar el token anterior se detecta y revoca la familia completa.
        self.assertEqual(self._refresh(original).status_code, 401)
        self.assertEqual(self._refresh(nuevo).status_code, 401)

    def test_logout_por_cuerpo_revoca_refresh_token(self):
        c = self._crear_cliente("logout")
        refresh_token = self._login(c.email).json()["refresh_token"]

        r = self._post("/api/v1/auth/logout", json={"refresh_token": refresh_token})
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self._refresh(refresh_token).status_code, 401)

    def test_cambio_password_revoca_refresh_tokens(self):
        c = self._crear_cliente("pwd")
        sesion = self._login(c.email).json()
        access, refresh_token = sesion["access_token"], sesion["refresh_token"]

        r = self._post(
            "/api/v1/auth/change-password",
            json={"current_password": PASSWORD, "new_password": "NuevaClave123!"},
            headers=self._bearer(access),
        )
        self.assertEqual(r.status_code, 200, r.text)
        self.assertEqual(self._refresh(refresh_token).status_code, 401)
