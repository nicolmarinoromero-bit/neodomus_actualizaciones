#!/usr/bin/env bash
set -Eeuo pipefail
# Ejecutar en consola/ventana de mantenimiento desde acceso fuera de banda.
# UFW no filtra puertos Docker publicados directamente; mantener DB sin ports
# públicos y filtrar también en firewall del proveedor/VPC.
command -v ufw >/dev/null || { echo 'Instale ufw primero' >&2; exit 127; }
: "${SSH_ADMIN_CIDR:?Defina SSH_ADMIN_CIDR con la red/VPN administrativa autorizada}"
ufw default deny incoming
ufw default allow outgoing
ufw allow from "$SSH_ADMIN_CIDR" to any port 22 proto tcp comment 'SSH administración'
ufw allow 80/tcp comment 'HTTP redirect/ACME'
ufw allow 443/tcp comment 'HTTPS'
ufw deny 5432/tcp comment 'No PostgreSQL public access'
ufw deny 3306/tcp comment 'No MySQL public access'
ufw deny 3307/tcp comment 'No MySQL host mapping public access'
ufw --force enable
ufw status verbose
