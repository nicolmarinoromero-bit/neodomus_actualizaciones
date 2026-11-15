"""E2E Semana 5 — historial y reporte de novedades del técnico.

Ejecuta ``fe/e2e/semana5-tecnico.e2e.spec.ts`` contra un Vite efímero; sesión y
datos se interceptan con ``page.route`` (sin fixtures ni escrituras en la BD).
"""
import sys

from e2e_semana5_lib import ejecutar

if __name__ == '__main__':
    sys.exit(ejecutar('tecnico'))
