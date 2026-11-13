#!/usr/bin/env bash
set -Eeuo pipefail
# Ubuntu 24.04. Ejecutar como root desde consola o sesión administrativa existente.
[[ $EUID -eq 0 ]] || { echo 'Ejecute como root' >&2; exit 1; }
for group in sysadmin deployer sysdevs; do getent group "$group" >/dev/null || groupadd --system "$group"; done
if ! id appuser >/dev/null 2>&1; then
  useradd --system --create-home --home-dir /opt/neodomus --shell /usr/sbin/nologin appuser
fi
install -o root -g root -m 0440 "$(dirname "$0")/sudoers.d/neodomus" /etc/sudoers.d/neodomus
visudo -cf /etc/sudoers.d/neodomus
install -d -o appuser -g appuser -m 0750 /opt/neodomus
echo 'Grupos y cuenta de servicio listos. Cree una cuenta Linux individual por persona con add-team-member.sh antes de cerrar la sesión administrativa.'
