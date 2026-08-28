Setup sin Docker — Neodomus
<!-- ¿Qué? Guía paso a paso para correr el proyecto sin Docker, instalando MySQL, Python y Node.js directamente en el sistema operativo. ¿Para qué? Útil cuando Docker no está disponible, cuando se quiere depurar el backend directamente con uvicorn --reload, o cuando se prefiere control total sobre cada servicio. ¿Impacto? Más pasos de configuración inicial, pero mayor flexibilidad para desarrollo activo: hot-reload nativo, debuggers de IDE, etc. -->
Modo recomendado para: desarrollo activo, depuración con IDE,
entornos donde Docker no está disponible o no se puede instalar.

Cada servicio corre directamente en el sistema operativo:

Servicio	Cómo corre	URL / Puerto
MySQL	Instalado en el sistema local	localhost:3306
Backend	uvicorn con .venv activo	http://localhost:8000
Frontend	pnpm dev (Vite dev server)	http://localhost:5173
Mailpit	Binario o Docker (opcional)	http://localhost:8025
Prerrequisitos
Instala las siguientes herramientas antes de comenzar:

Herramienta	Versión mínima	Verificar con	Descargar
Python	3.10+	python3 --version	https://www.python.org/downloads/
Node.js	22+	node --version	https://nodejs.org/
pnpm	11+	pnpm --version	corepack enable && corepack prepare pnpm@11.0.9 --activate
MySQL	8.0+	mysql --version	https://dev.mysql.com/downloads/
Git	2.40+	git --version	https://git-scm.com/downloads
⚠️ Nunca usar npm ni yarn — solo pnpm para instalar dependencias de Node.js.

🖥️ Windows: Usar siempre Git Bash como terminal.
Los comandos source, export y rutas con / no funcionan en CMD ni PowerShell.

Instalar pnpm (si no lo tienes)
bash
# Opción recomendada — vía corepack (incluido con Node.js 16+)
corepack enable
corepack prepare pnpm@11.0.9 --activate

# Alternativa — instalación independiente
curl -fsSL https://get.pnpm.io/install.sh | sh -
# Luego fijar la versión:
pnpm self-update 11.0.9
⚠️ pnpm 11 requiere Node.js ≥ 22.13. Si tienes Node 20, actualiza antes de instalar pnpm 11.

Instalar MySQL
Ubuntu / Debian:

bash
sudo apt update
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql
macOS (Homebrew):

bash
brew install mysql@8.0
brew services start mysql@8.0
Windows:
Descargar el instalador gráfico desde https://dev.mysql.com/downloads/installer/
Elegir "MySQL Server 8.0" y seguir los pasos. Recomendar poner root con contraseña root para entornos de desarrollo.

Paso 1 — Clonar el repositorio
bash
git clone <url-del-repositorio>
cd neodomus
Verificar la estructura:

bash
ls
# Deberías ver: backend/  frontend/  README.md  ...
Paso 2 — Preparar MySQL local
Crear el usuario y la base de datos que el backend necesita.

Conéctate a MySQL como root:

bash
sudo mysql -u root -p   # Linux (si pide contraseña, la que configuraste)
mysql -u root -p        # macOS / Windows (Git Bash)
Dentro de la consola de MySQL, ejecutar:

sql
-- Crear el usuario de la aplicación (con contraseña)
CREATE USER IF NOT EXISTS 'neodomus_user'@'localhost' IDENTIFIED BY 'neodomus_pass';

-- Crear la base de datos
CREATE DATABASE IF NOT EXISTS neodomus_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- Dar todos los privilegios
GRANT ALL PRIVILEGES ON neodomus_db.* TO 'neodomus_user'@'localhost';

-- Aplicar cambios
FLUSH PRIVILEGES;

-- Salir
EXIT;
Verificar la conexión:

bash
mysql -u neodomus_user -pneodomus_pass -h localhost neodomus_db -e "SELECT VERSION();"
# Deberías ver la versión de MySQL instalada
Paso 3 — Configurar el Backend
3.1 Crear el entorno virtual de Python
bash
cd backend

# Crear el entorno virtual (solo la primera vez)
python3 -m venv .venv

# Activar el entorno virtual
source .venv/bin/activate          # Linux / macOS / Windows (Git Bash)
# source .venv/Scripts/activate    # Windows (Git Bash — ruta alternativa si la anterior falla)

# Verificar que el venv está activo — deberías ver (.venv) al inicio del prompt
python --version
# → Python 3.10.x o superior
⚠️ Importante: Activar el entorno virtual cada vez que abras una terminal nueva
antes de ejecutar cualquier comando de Python.

3.2 Instalar dependencias
bash
# Con el .venv activo:
pip install -r requirements.txt

# Verificar instalación
pip list | grep fastapi
# → fastapi   0.115.x
3.3 Configurar variables de entorno
bash
cp .env.example .env
Abrir backend/.env y ajustar los valores para desarrollo local sin Docker:

bash
# Base de datos — apuntar a localhost
DATABASE_URL=mysql+pymysql://neodomus_user:neodomus_pass@localhost:3306/neodomus_db

# JWT — generar una clave segura (ver más abajo)
SECRET_KEY=your-super-secret-key-change-in-production-min-32-chars

# Frontend — Vite dev server corre en 5173
FRONTEND_URL=http://localhost:5173

# Email — ver Paso 5 para opciones de configuración
SMTP_HOST=
SMTP_PORT=
SMTP_USERNAME=
SMTP_PASSWORD=
RESEND_API_KEY=
Generar una SECRET_KEY segura (recomendado):

bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
# Copiar el resultado en SECRET_KEY= del .env
3.4 Inicializar la base de datos (crear tablas)
El proyecto usa Alembic para migraciones. Ejecutar:

bash
# Con el .venv activo y desde backend/
alembic upgrade head
Deberías ver algo como:

text
INFO  [alembic.runtime.migration] Running upgrade  -> 001_initial, create tables...
Si no hay migraciones aún (proyecto recién comenzado), se puede crear la base de datos manualmente con el script SQL:

bash
mysql -u neodomus_user -pneodomus_pass neodomus_db < database/schema.sql
Verificar que las tablas se crearon:

bash
mysql -u neodomus_user -pneodomus_pass neodomus_db -e "SHOW TABLES;"
# Deberías ver: usuarios, tecnicos, servicios, citas, pagos, etc.
Paso 4 — Configurar el Frontend
bash
cd ../frontend    # o `cd frontend` desde la raíz del proyecto

# Instalar dependencias con pnpm (¡NUNCA con npm!)
pnpm install

# Copiar variables de entorno
cp .env.example .env
Verificar el contenido de frontend/.env:

bash
# URL del backend — el Vite dev server hace proxy al backend en este puerto
VITE_API_URL=http://localhost:8000
Este valor ya es correcto para desarrollo sin Docker — no hace falta cambiarlo.

Paso 5 — Configurar emails (desarrollo local)
Tienes tres opciones para probar el envío de emails:

Opción A — Sin emails (modo más simple)
Dejar las variables de email vacías en backend/.env:

bash
SMTP_HOST=
RESEND_API_KEY=
El backend imprimirá el enlace de verificación/recuperación directamente en los logs
de uvicorn. Copiar el enlace desde la terminal para usarlo.

Opción B — Mailpit local (bandeja visual, recomendado)
Mailpit captura los emails en una UI web sin enviarlos a internet.

Instalar Mailpit:

bash
# Linux/macOS — descarga el binario
curl -sL https://raw.githubusercontent.com/axllent/mailpit/develop/install.sh | bash

# O con Homebrew (macOS)
brew install mailpit
Iniciar Mailpit (en una terminal aparte):

bash
mailpit
# → SMTP en localhost:1025
# → Web UI en http://localhost:8025
Configurar backend/.env:

bash
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USERNAME=
SMTP_PASSWORD=
Abrir http://localhost:8025 para ver los emails capturados.

Opción C — Resend (emails reales, cuenta gratuita)
Obtener API key en https://resend.com (3,000 emails/mes gratuitos).

bash
RESEND_API_KEY=re_tu_api_key_aqui
RESEND_FROM_EMAIL=onboarding@resend.dev   # dominio de prueba de Resend
RESEND_FROM_NAME=Neodomus
SMTP_HOST=                                # dejar vacío
Paso 6 — Levantar el sistema (3 terminales)
Necesitas 3 terminales abiertas simultáneamente:

Terminal 1 — Backend (FastAPI)
bash
cd backend
source .venv/bin/activate   # activar siempre antes de uvicorn
uvicorn app.main:app --reload
Salida esperada:

text
INFO:     Uvicorn running on http://127.0.0.1:8000 (Press CTRL+C to quit)
INFO:     Started reloader process [...] using WatchFiles
INFO:     Started server process [...]
INFO:     Waiting for application startup.
INFO:     Application startup complete.
URLs disponibles:

API: http://localhost:8000

Swagger UI: http://localhost:8000/docs

Health check: http://localhost:8000/api/v1/health

Terminal 2 — Frontend (React + Vite)
bash
cd frontend
pnpm dev
Salida esperada:

text
  VITE v6.x.x  ready in xxx ms

  ➜  Local:   http://localhost:5173/
  ➜  Network: use --host to expose
Terminal 3 — Mailpit (si usas la Opción B)
bash
mailpit
Paso 7 — Verificar que todo funciona
Abrir en el navegador:

URL	Qué muestra
http://localhost:5173	Landing page / catálogo
http://localhost:8000/docs	Swagger UI del backend
http://localhost:8000/api/v1/health	JSON {"status": "healthy"}
http://localhost:8025	Mailpit (si está corriendo)
Probar el flujo completo:

bash
# 1. Registrar un usuario (cliente)
curl -X POST http://localhost:8000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "nombre": "Test",
    "apellido": "User",
    "tipo_documento": "DNI",
    "numero_documento": "12345678",
    "direccion": "Calle Falsa 123",
    "telefono": "+5491112345678",
    "password": "Test1234!"
  }'

# 2. Ver el email de verificación en Mailpit (http://localhost:8025)
#    o copiar el enlace de los logs de uvicorn (Terminal 1)

# 3. Iniciar sesión
curl -X POST http://localhost:8000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test1234!"}'
# → Devuelve access_token, refresh_token y rol
Paso 8 — Ejecutar tests
Backend
bash
cd backend && source .venv/bin/activate

# Todos los tests
pytest -v

# Con cobertura
pytest --cov=app --cov-report=term-missing

# Un módulo específico
pytest app/tests/test_auth.py -v
Frontend
bash
cd frontend

# Todos los tests (modo run)
pnpm test

# Modo watch (re-ejecuta al guardar)
pnpm test:watch

# Con cobertura
pnpm test:coverage
Linting y formateo
bash
# Backend
cd backend && source .venv/bin/activate
ruff check app/        # detectar errores
ruff format app/       # formatear código

# Frontend
cd frontend
pnpm lint              # detectar errores
pnpm format            # formatear código
Solución de problemas comunes
"No module named 'fastapi'" o errores de importación
El entorno virtual no está activado:

bash
cd backend
source .venv/bin/activate      # Linux / macOS / Windows (Git Bash)
# Verificar: el prompt debe mostrar (.venv) al inicio
"Can't connect to MySQL server on 'localhost'"
bash
# Verificar que MySQL está corriendo
sudo systemctl status mysql      # Linux
brew services list | grep mysql  # macOS

# Iniciar si está detenido
sudo systemctl start mysql       # Linux
brew services start mysql@8.0    # macOS

# Verificar credenciales
mysql -u neodomus_user -pneodomus_pass -h localhost -e "SELECT 1"
"Access denied for user 'neodomus_user'"
El usuario o contraseña no coinciden. Repetir el Paso 2, asegurando que el usuario se creó con IDENTIFIED BY 'neodomus_pass' y que se le otorgaron privilegios.

Error de migración de Alembic
bash
# Ver el estado actual
alembic current

# Revertir la última migración
alembic downgrade -1

# Volver a aplicar
alembic upgrade head
Si no hay migraciones, ejecutar el script SQL manual desde la carpeta database/.

"EADDRINUSE" — puerto 5173 o 8000 ya en uso
bash
# Encontrar el proceso que usa el puerto (ej: 8000)
lsof -i :8000

# Terminar el proceso
kill -9 <PID>
El frontend muestra errores de CORS o "Network Error"
Verificar:

El backend está corriendo en http://localhost:8000

VITE_API_URL=http://localhost:8000 en frontend/.env

FRONTEND_URL=http://localhost:5173 en backend/.env

El CORS está configurado para aceptar ese origen (FastAPI debe permitir http://localhost:5173).

Resumen rápido
bash
# ─── Setup inicial (una sola vez) ───
git clone <url> && cd neodomus

# MySQL: crear usuario y BD (ver Paso 2)

# Backend
cd backend && python3 -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # editar DATABASE_URL y FRONTEND_URL
alembic upgrade head

# Frontend
cd ../frontend && pnpm install && cp .env.example .env

# ─── Día a día (3 terminales) ───
# T1: cd backend && source .venv/bin/activate && uvicorn app.main:app --reload
# T2: cd frontend && pnpm dev
# T3: mailpit (opcional)