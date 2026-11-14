"""E2E Semana 5 — gestión de citas y tarifas del administrador.

Ejecuta ``fe/e2e/semana5-admin.e2e.spec.ts`` contra un Vite efímero; sesión y
datos se interceptan con ``page.route`` (sin fixtures ni escrituras en la BD).
"""
import sys

from e2e_semana5_lib import ejecutar

if __name__ == '__main__':
    sys.exit(ejecutar('admin'))
