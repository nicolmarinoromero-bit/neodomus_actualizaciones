#!/usr/bin/env bash
set -Eeuo pipefail

# Uso root: add-team-member.sh <usuario-individual> <sysadmin|deployer|sysdevs> <archivo.pub>
[[ $EUID -eq 0 ]] || { echo 'Ejecute como root' >&2; exit 1; }
[[ $# -eq 3 ]] || { echo "Uso: $0 <usuario> <grupo> <archivo.pub>" >&2; exit 2; }
user=$1 group=$2 public_key_file=$3
[[ "$user" =~ ^[a-z_][a-z0-9_-]{1,31}$ ]] || { echo 'Nombre de usuario inválido' >&2; exit 2; }
case "$group" in sysadmin|deployer|sysdevs) ;; *) echo 'Grupo no autorizado' >&2; exit 2 ;; esac
[[ -r "$public_key_file" ]] || { echo 'No se puede leer el archivo de llave pública' >&2; exit 2; }
read -r key_type key_material _ < "$public_key_file"
[[ "$key_type" == ssh-ed25519 && -n "$key_material" ]] || { echo 'Se requiere una llave pública Ed25519' >&2; exit 2; }
ssh-keygen -lf "$public_key_file" >/dev/null || { echo 'Llave pública inválida' >&2; exit 2; }
getent group "$group" >/dev/null || { echo "No existe el grupo $group; ejecute provision-users.sh" >&2; exit 2; }
if ! id "$user" >/dev/null 2>&1; then useradd --create-home --shell /bin/bash "$user"; fi
usermod -aG "$group" "$user"
ssh_dir="$(getent passwd "$user" | cut -d: -f6)/.ssh"
install -d -o "$user" -g "$user" -m 0700 "$ssh_dir"
touch "$ssh_dir/authorized_keys"
chown "$user:$user" "$ssh_dir/authorized_keys"
chmod 0600 "$ssh_dir/authorized_keys"
grep -qxF "$(<"$public_key_file")" "$ssh_dir/authorized_keys" || cat "$public_key_file" >> "$ssh_dir/authorized_keys"
echo "Cuenta $user provisionada en $group. Revise el acceso con la llave antes de cerrar la sesión administrativa."
