"""Resolución segura de la IP del cliente detrás de proxies de confianza.

``X-Forwarded-For`` solo se tiene en cuenta cuando la conexión inmediata
proviene de una IP/CIDR declarada en ``TRUSTED_PROXIES``. De este modo, un
cliente que llega directo a la API no puede falsificar su IP para evadir el
rate limiting ni falsear los registros de auditoría.
"""

from __future__ import annotations

import ipaddress
from functools import lru_cache

from starlette.requests import Request

from app.config import settings

IPAddress = ipaddress.IPv4Address | ipaddress.IPv6Address
IPNetwork = ipaddress.IPv4Network | ipaddress.IPv6Network

TRUST_ALL = "*"


def parse_ip(value: str | None) -> IPAddress | None:
    """Convierte texto en una IP, normalizando IPv4 mapeada sobre IPv6."""
    if not value:
        return None
    try:
        address = ipaddress.ip_address(value.strip())
    except ValueError:
        return None
    if isinstance(address, ipaddress.IPv6Address) and address.ipv4_mapped:
        return address.ipv4_mapped
    return address


def parse_trusted_proxies(raw: str | None) -> tuple[IPNetwork, ...]:
    """Parsea ``TRUSTED_PROXIES`` (IPs o CIDR separados por comas)."""
    networks: list[IPNetwork] = []
    for entry in (raw or "").split(","):
        entry = entry.strip()
        if not entry:
            continue
        if entry == TRUST_ALL:
            return (
                ipaddress.ip_network("0.0.0.0/0"),
                ipaddress.ip_network("::/0"),
            )
        try:
            networks.append(ipaddress.ip_network(entry, strict=False))
        except ValueError as exc:
            raise ValueError(f"TRUSTED_PROXIES inválido: {entry!r}") from exc
    return tuple(networks)


@lru_cache(maxsize=8)
def _cached_trusted_proxies(raw: str) -> tuple[IPNetwork, ...]:
    return parse_trusted_proxies(raw)


def trusted_proxies() -> tuple[IPNetwork, ...]:
    """Redes de confianza configuradas, con caché por valor."""
    return _cached_trusted_proxies(settings.TRUSTED_PROXIES)


def is_trusted(address: IPAddress, networks: tuple[IPNetwork, ...]) -> bool:
    """Indica si ``address`` pertenece a alguna red de confianza."""
    return any(
        address.version == network.version and address in network
        for network in networks
    )


def resolve_client_ip(
    peer_ip: str | None,
    forwarded_for: str | None,
    networks: tuple[IPNetwork, ...],
) -> str | None:
    """Devuelve la IP real del cliente a partir de la conexión y ``XFF``.

    Solo lee ``X-Forwarded-For`` si la conexión inmediata es un proxy de
    confianza. La cadena se recorre de derecha a izquierda descartando los
    saltos que también son proxies: el valor más a la derecha lo añade el
    proxy más cercano y no puede ser falsificado por el cliente.
    """
    peer = parse_ip(peer_ip)
    if peer is None:
        return peer_ip
    if not is_trusted(peer, networks):
        return str(peer)

    hops = [hop.strip() for hop in (forwarded_for or "").split(",") if hop.strip()]
    if not hops:
        return str(peer)

    for hop in reversed(hops):
        address = parse_ip(hop)
        if address is None:
            break
        if is_trusted(address, networks):
            continue
        return str(address)

    # Toda la cadena son proxies de confianza: el origen es el primer salto.
    first = parse_ip(hops[0])
    return str(first) if first else str(peer)


def get_client_ip(request: Request) -> str:
    """IP resuelta para rate limiting, auditoría y trazas."""
    peer = request.client.host if request.client else None
    resolved = resolve_client_ip(
        peer,
        request.headers.get("x-forwarded-for"),
        trusted_proxies(),
    )
    return resolved or "127.0.0.1"
