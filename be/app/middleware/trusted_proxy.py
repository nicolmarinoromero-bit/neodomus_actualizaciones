"""Middleware ASGI que normaliza IP y esquema cuando hay un proxy delante.

Solo actúa si la conexión inmediata pertenece a ``TRUSTED_PROXIES``; en caso
contrario deja intactos ``scope["client"]`` y ``scope["scheme"]`` para que las
cabeceras enviadas por un cliente directo no puedan suplantar su origen.
"""

from __future__ import annotations

from fastapi import FastAPI
from starlette.types import ASGIApp, Receive, Scope, Send

from app.utils.client_ip import (
    is_trusted,
    parse_ip,
    resolve_client_ip,
    trusted_proxies,
)


class TrustedProxyMiddleware:
    """Resuelve la IP/esquema reales antes de que lleguen a los endpoints."""

    def __init__(self, app: ASGIApp) -> None:
        self.app = app

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] in ("http", "websocket"):
            self._apply(scope)
        await self.app(scope, receive, send)

    @staticmethod
    def _apply(scope: Scope) -> None:
        client = scope.get("client")
        peer_ip = client[0] if client else None
        peer = parse_ip(peer_ip)
        networks = trusted_proxies()
        if peer is None or not is_trusted(peer, networks):
            return

        headers = {
            key.lower(): value for key, value in scope.get("headers", [])
        }
        forwarded_for = headers.get(b"x-forwarded-for") or headers.get(b"x-real-ip")
        if forwarded_for is not None:
            resolved = resolve_client_ip(
                peer_ip,
                forwarded_for.decode("latin-1"),
                networks,
            )
            if resolved:
                port = client[1] if client else 0
                scope["client"] = (resolved, port)

        proto = headers.get(b"x-forwarded-proto")
        if proto is not None:
            scheme = proto.decode("latin-1").split(",", 1)[0].strip().lower()
            if scheme in ("http", "https"):
                if scope["type"] == "websocket":
                    scheme = "ws" if scheme == "http" else "wss"
                scope["scheme"] = scheme


def setup_trusted_proxy(app: FastAPI) -> None:
    """Valida ``TRUSTED_PROXIES`` al arrancar y registra el middleware."""
    trusted_proxies()
    app.add_middleware(TrustedProxyMiddleware)
