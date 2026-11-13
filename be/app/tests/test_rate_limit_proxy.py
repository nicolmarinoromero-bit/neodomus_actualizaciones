"""Pruebas de resolución de IP real y del middleware de proxies de confianza.

Son unitarias: no requieren base de datos ni MinIO.
"""

import asyncio
import unittest
from unittest.mock import patch

from fastapi import FastAPI, Request, Response
from httpx import ASGITransport, AsyncClient
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded

from app.config import settings
from app.middleware.trusted_proxy import setup_trusted_proxy
from app.utils.client_ip import get_client_ip, parse_trusted_proxies, resolve_client_ip

NETWORKS = parse_trusted_proxies("127.0.0.1,::1,10.0.0.0/8")


def _pedir(app: FastAPI, client: tuple[str, int], headers: dict[str, str], path: str = "/ip"):
    async def run():
        transport = ASGITransport(app=app, client=client)
        async with AsyncClient(transport=transport, base_url="http://test") as ac:
            return await ac.get(path, headers=headers)

    return asyncio.run(run())


def _app_ip() -> FastAPI:
    app = FastAPI()
    setup_trusted_proxy(app)

    @app.get("/ip")
    def ip(request: Request):
        return {"ip": request.client.host, "scheme": request.url.scheme}

    return app


class ResolveClientIpTestCase(unittest.TestCase):
    def test_cliente_directo_ignora_cabeceras(self):
        self.assertEqual(
            resolve_client_ip("203.0.113.9", "1.2.3.4", NETWORKS),
            "203.0.113.9",
        )

    def test_proxy_confiable_usa_el_salto_mas_cercano(self):
        self.assertEqual(
            resolve_client_ip("127.0.0.1", "6.6.6.6, 198.51.100.7, 10.0.0.5", NETWORKS),
            "198.51.100.7",
        )

    def test_cadena_de_solo_proxies_devuelve_el_origen(self):
        self.assertEqual(
            resolve_client_ip("127.0.0.1", "10.0.0.2, 10.0.0.3", NETWORKS),
            "10.0.0.2",
        )

    def test_sin_xff_devuelve_el_peer(self):
        self.assertEqual(resolve_client_ip("127.0.0.1", None, NETWORKS), "127.0.0.1")

    def test_configuracion_invalida_falla(self):
        with self.assertRaises(ValueError):
            parse_trusted_proxies("no-es-una-ip")


class TrustedProxyMiddlewareTestCase(unittest.TestCase):
    def _con_proxies(self, raw: str):
        return patch.object(settings, "TRUSTED_PROXIES", raw)

    def test_proxy_confiable_reescribe_ip_y_esquema(self):
        with self._con_proxies("127.0.0.1,::1,10.0.0.0/8"):
            response = _pedir(
                _app_ip(),
                ("127.0.0.1", 5000),
                {
                    "X-Forwarded-For": "6.6.6.6, 198.51.100.7, 10.0.0.5",
                    "X-Forwarded-Proto": "https",
                },
            )
        self.assertEqual(response.json(), {"ip": "198.51.100.7", "scheme": "https"})

    def test_peer_no_confiable_no_hereda_cabeceras(self):
        with self._con_proxies("127.0.0.1,::1"):
            response = _pedir(
                _app_ip(),
                ("203.0.113.5", 5000),
                {
                    "X-Forwarded-For": "198.51.100.7",
                    "X-Forwarded-Proto": "https",
                },
            )
        self.assertEqual(response.json(), {"ip": "203.0.113.5", "scheme": "http"})

    def test_x_real_ip_como_respaldo(self):
        with self._con_proxies("127.0.0.1,::1"):
            response = _pedir(
                _app_ip(),
                ("127.0.0.1", 5000),
                {"X-Real-IP": "198.51.100.9"},
            )
        self.assertEqual(response.json()["ip"], "198.51.100.9")


class RateLimitPorIpRealTestCase(unittest.TestCase):
    def _app_limitada(self) -> FastAPI:
        limite = Limiter(
            key_func=get_client_ip,
            storage_uri="memory://",
            headers_enabled=True,
        )
        app = FastAPI()
        app.state.limiter = limite
        app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
        setup_trusted_proxy(app)

        @app.get("/limitado")
        @limite.limit("1/minute")
        def limitado(request: Request, response: Response):
            return {"ip": request.client.host}

        return app

    def _solicitar(self, app, ip: str):
        return _pedir(
            app,
            ("127.0.0.1", 5000),
            {"X-Forwarded-For": ip},
            path="/limitado",
        )

    def test_limita_por_ip_real_y_emite_429(self):
        with patch.object(settings, "TRUSTED_PROXIES", "127.0.0.1,::1"):
            app = self._app_limitada()
            primera = self._solicitar(app, "198.51.100.10")
            repetida = self._solicitar(app, "198.51.100.10")
            otra_ip = self._solicitar(app, "198.51.100.11")

        self.assertEqual(primera.status_code, 200, primera.text)
        self.assertEqual(repetida.status_code, 429, repetida.text)
        self.assertIn("retry-after", repetida.headers)
        self.assertEqual(otra_ip.status_code, 200, otra_ip.text)
