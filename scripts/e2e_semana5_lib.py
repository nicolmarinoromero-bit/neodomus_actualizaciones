"""Infraestructura común de los E2E de la Semana 5 (técnico y admin).

Levanta un Vite efímero y ejecuta el spec de Playwright indicado. La sesión y
los datos se sirven con ``page.route`` dentro de los specs, por lo que estos
recorridos no crean fixtures ni escriben en la base de pruebas.

Requiere TEST_DATABASE_URL (guarda del runner E2E) apuntando a ``neodomus_test``.
"""
import os
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
SPECS = {
    'tecnico': 'semana5-tecnico.e2e.spec.ts',
    'admin': 'semana5-admin.e2e.spec.ts',
}


def free_port():
    with socket.socket() as s:
        s.bind(('127.0.0.1', 0))
        return s.getsockname()[1]


def wait_ready(process, url):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError('Servidor E2E terminó antes de estar listo')
        try:
            with urlopen(url, timeout=1) as r:
                if r.status == 200:
                    return
        except (OSError, TimeoutError):
            pass
        time.sleep(0.2)
    raise RuntimeError('Servidor E2E no respondió en 60 s')


def ejecutar(flujo):
    if flujo not in SPECS:
        raise RuntimeError(f'Flujo desconocido: {flujo}')
    url = os.environ.get('TEST_DATABASE_URL', '')
    if '/neodomus?' in url or url.rstrip('/').endswith('/neodomus'):
        raise RuntimeError('TEST_DATABASE_URL apunta a la base de desarrollo')

    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node no disponible')

    web_port = free_port()
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    procesos = []
    temp = None
    try:
        temp = tempfile.TemporaryDirectory(prefix='neodomus-s5-e2e-', ignore_cleanup_errors=True)
        env = os.environ.copy()
        env.update(
            DISABLE_SCHEDULER='1',
            PAYMENT_PROVIDER='simulator',
            # La API nunca se contacta: todos los /api/v1/** se interceptan.
            VITE_API_URL='http://127.0.0.1:9/api/v1',
            E2E_BASE_URL=f'http://127.0.0.1:{web_port}',
        )
        log_path = Path(temp.name) / 'vite.log'
        with open(log_path, 'w', encoding='utf-8') as log:
            procesos.append(
                subprocess.Popen(
                    [node, 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1',
                     '--port', str(web_port), '--strictPort'],
                    cwd=ROOT / 'fe', env=env, stdout=log, stderr=log, creationflags=flags,
                )
            )
            wait_ready(procesos[0], env['E2E_BASE_URL'])

            result = subprocess.run(
                [node, 'node_modules/@playwright/test/cli.js', 'test', SPECS[flujo], '--workers=1'],
                cwd=ROOT / 'fe', env=env, creationflags=flags, timeout=600,
                capture_output=True, text=True, encoding='utf-8', errors='replace',
            )
            enc = sys.stdout.encoding or 'utf-8'
            print(result.stdout.encode(enc, errors='replace').decode(enc))
            print(result.stderr.encode(enc, errors='replace').decode(enc))
            print(f'Playwright exit: {result.returncode}')
            return result.returncode
    finally:
        for p in reversed(procesos):
            if p.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(p.pid), '/T', '/F'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=flags, check=False)
                else:
                    p.terminate()
                try:
                    p.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    p.kill()
        if temp:
            temp.cleanup()
