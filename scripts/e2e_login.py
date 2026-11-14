"""Login real del cliente con fixtures propios y servidores aislados (testdb).

Desde be, con TEST_DATABASE_URL configurada: python ../scripts/e2e_login.py
Crea un cliente activo efimero, prueba login valido + contraseña incorrecta y
limpia sus fixtures. No reutiliza cuentas ni datos de otros E2E.
"""
import os
from pathlib import Path
import shutil
import socket
import subprocess
import sys
import tempfile
import time
from urllib.request import urlopen
from uuid import uuid4

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / 'be'))
os.chdir(ROOT / 'be')
import app.tests.testdb as testdb
from app.models.cliente import Cliente
from app.utils.security import hash_password
from sqlalchemy import select, func


def free_port():
    with socket.socket() as sock:
        sock.bind(('127.0.0.1', 0))
        return sock.getsockname()[1]


def wait_ready(process, url):
    deadline = time.monotonic() + 60
    while time.monotonic() < deadline:
        if process.poll() is not None:
            raise RuntimeError('Servidor de pruebas terminó antes de estar listo')
        try:
            with urlopen(url, timeout=1) as response:
                if response.status == 200:
                    return
        except (OSError, TimeoutError):
            pass
        time.sleep(.2)
    raise RuntimeError('Servidor de pruebas no respondió en 60 segundos')


def main():
    testdb.ensure_test_schema()
    node = shutil.which('node')
    if not node:
        raise RuntimeError('Node no está disponible')
    tag = uuid4().hex
    email = f'e2e.login.{tag}@example.com'
    acceso_demo = f'Login{tag}9'
    # Contraseña INCORRECTA distinta de la real (el cliente activo existe, la
    # contraseña no coincide: el backend debe responder 401).
    acceso_malo = 'Contrasena' + tag[:6] + 'x7'
    db = testdb.TestSessionLocal()
    client_id = None
    processes = []
    session_temp = None
    flags = subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
    try:
        client = Cliente(first_name='Login', last_name='E2E', email=email,
                         password_hash=hash_password(acceso_demo), is_active=True,
                         id_tipo_documento_c=1, documento_cliente=900000011,
                         telefono_cliente=3000000011, address='Calle login 123')
        db.add(client)
        db.flush()
        client_id = client.id_cliente
        db.commit()
        api_port, web_port = free_port(), free_port()
        env = os.environ.copy()
        env.update(DISABLE_SCHEDULER='1', PAYMENT_PROVIDER='simulator',
                   VITE_API_URL=f'http://127.0.0.1:{api_port}/api/v1',
                   E2E_BASE_URL=f'http://127.0.0.1:{web_port}',
                   E2E_LOGIN_EMAIL=email, E2E_LOGIN_PASSWORD=acceso_demo,
                   E2E_LOGIN_BAD_PASSWORD=acceso_malo)
        # El propio servidor importa testdb ANTES de importar la aplicación.
        bootstrap = ('import app.tests.testdb as t; '
                     'from app.main import app; import uvicorn; '
                     'app.state.limiter.enabled=False; '
                     f'uvicorn.run(app,host="127.0.0.1",port={api_port},log_level="warning",access_log=False)')
        session_temp = tempfile.TemporaryDirectory(prefix='neodomus-login-', ignore_cleanup_errors=True)
        with session_temp as temporary:
            with open(Path(temporary) / 'servers.log', 'w', encoding='utf-8') as log:
                for args, cwd in [
                    ([sys.executable, '-c', bootstrap], ROOT / 'be'),
                    ([node, 'node_modules/vite/bin/vite.js', '--host', '127.0.0.1', '--port', str(web_port), '--strictPort'], ROOT / 'fe'),
                ]:
                    processes.append(subprocess.Popen(args, cwd=cwd, env=env, stdout=log, stderr=log, creationflags=flags))
                wait_ready(processes[0], f'http://127.0.0.1:{api_port}/health')
                wait_ready(processes[1], env['E2E_BASE_URL'])
                repeat = os.environ.get('E2E_REPEAT_EACH', '2')
                result = subprocess.run([node, 'node_modules/@playwright/test/cli.js', 'test',
                                         'login.e2e.spec.ts', f'--repeat-each={repeat}'],
                                        cwd=ROOT / 'fe', env=env, creationflags=flags, timeout=600,
                                        capture_output=True, text=True, encoding='utf-8', errors='replace')
                encoding = sys.stdout.encoding or 'utf-8'
                print(result.stdout.encode(encoding, errors='replace').decode(encoding))
                print(result.stderr.encode(encoding, errors='replace').decode(encoding))
                print(f'Playwright exit: {result.returncode}')
                return result.returncode
    finally:
        for process in reversed(processes):
            if process.poll() is None:
                if os.name == 'nt':
                    subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'],
                                   stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                                   creationflags=flags, check=False)
                else:
                    process.terminate()
                try:
                    process.wait(timeout=10)
                except subprocess.TimeoutExpired:
                    process.kill()
                    process.wait()
        if session_temp:
            session_temp.cleanup()
        db.rollback()
        if client_id:
            db.query(Cliente).filter(Cliente.id_cliente == client_id).delete(synchronize_session=False)
        db.commit()
        remaining = db.scalar(select(func.count()).select_from(Cliente).where(Cliente.email == email))
        db.close()
        print(f'Fixtures propios restantes: {remaining}')
        if remaining:
            raise RuntimeError('Limpieza incompleta')


if __name__ == '__main__':
    raise SystemExit(main())
