# Plan de Implantación — Neodomus

<!--
  ¿Qué? Ficha técnica, inventario de componentes, matriz de requisitos y
         criterios de infraestructura para el despliegue de Neodomus.
  ¿Para qué? Dar trazabilidad entre el stack real, los requisitos de hardware,
             las decisiones de SO/RAID y las restricciones de licenciamiento.
  ¿Impacto? Sin esta ficha no se puede dimensionar el servidor, justificar la
             compra ni demostrar cumplimiento legal del software utilizado.
-->

> **Proyecto:** Neodomus — Plataforma web/móvil de domótica y servicios técnicos
> **Entregable:** Semanas 1, 4, 5 y 6 — Ficha técnica, despliegue, configuración/verificación, respaldo y seguridad
> **Versión:** 1.1
> **Fecha:** 13/11/2026
> **Informe ejecutivo asociado:** [`docs/informe-semana-1.md`](informe-semana-1.md)
> **Entorno de referencia:** Ubuntu Server 24.04.5 LTS x86_64 · Docker Engine 29.5.2 · Docker Compose 5.1.4
> **Convención de seguridad:** todas las IP, hosts, usuarios, dominios y credenciales de este documento son genéricos. No se publican datos de producción ni secretos.

---

## 0. Alcance, supuestos y hallazgos de auditoría

### 0.1 Alcance de esta sección

Esta sección cubre exclusivamente la **Semana 1**:

1. Inventario de componentes y licenciamiento.
2. Matriz de requisitos de hardware y dimensionamiento.
3. Preguntas guía justificadas: sistema operativo, infraestructura on-premise y licencias.
4. Evidencia de ejecución del script `scripts/verificar-requisitos.sh`.

Las secciones de instalación, despliegue, operación y plan de pruebas se documentan en entregables posteriores.

### 0.2 Stack real auditado

El repositorio de Neodomus **no usa Node.js/Express como backend ni MongoDB como base de datos**. El stack real es FastAPI (Python 3.12) + MySQL 8.0 + MinIO, con frontend React/Vite y aplicación móvil Expo/React Native. Node.js solo participa como runtime de build del frontend. Se documenta el stack real para que la ficha sea verificable contra el código y no contra una descripción genérica.

| Capa | Tecnología real | Puerto host | Estado en el repositorio |
|---|---|---|---|
| Frontend web | React 18.3.1 + Vite 5.4.21 | `5173` | `docker-compose.yml` servicio `frontend` |
| Backend API | FastAPI 0.163.1 + Uvicorn 0.30.0 (Python 3.12.15) | `8000` | `docker-compose.yml` servicio `api` |
| Base de datos | MySQL 8.0.46 | `3307` → `3306` interno | `docker-compose.yml` servicio `db` |
| Almacenamiento de objetos | MinIO Server `RELEASE.2025-09-07T16-13-09Z` | `9000` API S3 · `9001` consola | `docker-compose.yml` servicio `minio` |
| Aplicación móvil | Expo SDK 58.0.23 + React Native 0.88.1 | Metro `8081` (desarrollo) | `movil/` |
| Proxy / TLS | Nginx 1.28.0 (propuesto) | `80` / `443` | **Pendiente de incorporar** |
| Base de datos documental | MongoDB | No aplica | **No forma parte del stack** |

> **Puertos del stack:** no se comprueban `3000` ni `27017` porque no corresponden a este repositorio. El backend escucha en `8000`, la base de datos real es MySQL en `3307` y no hay MongoDB. Por eso el script valida `80`, `443`, `5173`, `8000`, `3306`, `3307`, `9000` y `9001`.

> **Nota de auditoría:** el `README.md` todavía describe la app móvil como Expo SDK 54.0.37 / React Native 0.81.5. El manifiesto `movil/package.json` ya declara Expo 58.0.23 / React Native 0.88.1; esta ficha se sincronizó con el manifiesto el 18/11/2026; las demás fechas y estados del plan conservan su corte anterior.

### 0.3 Hallazgos que condicionan la implantación

| ID | Hallazgo | Riesgo | Acción obligatoria antes de producción |
|---|---|---|---|
| H-01 | MySQL 8.0 alcanzó el fin de su soporte extendido el **30/04/2026**. La imagen `mysql:8.0` resuelve a 8.0.46. | Alto: sin parches de seguridad de Oracle | Migrar a **MySQL 8.4.13 LTS** y probar compatibilidad con Alembic/SQLAlchemy |
| H-02 | Imágenes con etiquetas flotantes: `mysql:8.0`, `elestio/minio:latest`, `node:22-alpine`, `python:3.12-slim`. | Medio: despliegues no reproducibles | Fijar versión + digest SHA-256 y actualizar con PR revisado |
| H-03 | El `docker-compose.yml` actual ejecuta el servidor de desarrollo de Vite en el puerto 5173. | Medio: no es un servidor estático de producción | Compilar `pnpm build` y servir `dist/` con Nginx |
| H-04 | El compose define valores por defecto para credenciales de MySQL y MinIO. | Alto: credenciales débiles si no se configura `.env` | Eliminar los fallbacks, usar secretos y rotar credenciales |
| H-05 | MySQL (3307) y la consola de MinIO (9001) se publican en todas las interfaces. | Medio: exposición innecesaria | Publicar solo en `127.0.0.1` o en una red de administración/VPN |
| H-06 | No existe proxy TLS ni política de backups declarada en el compose. | Alto: tráfico sin cifrar y riesgo de pérdida de datos | Añadir Nginx + Let's Encrypt y backups 3-2-1 probados |
| H-07 | MinIO se consume desde una imagen de terceros (`elestio/minio`). | Medio: cadena de suministro | Usar la imagen oficial `minio/minio` fijada por digest, o un espejo interno escaneado |

---

## 1. Ficha Técnica y Matriz de Requisitos

### 1.1 Inventario de componentes y licenciamiento

#### 1.1.1 Infraestructura, sistema operativo y runtime

| Componente | Nombre de software | Versión exacta | Tipo de software | Licencia exacta | Observaciones |
|---|---|---|---|---|---|
| Sistema operativo anfitrión | Ubuntu Server | 24.04.5 LTS (Noble Numbat) | SO / Host | GPLv2/GPLv3 y otras licencias libres (distribución) | Arquitectura x86_64. Soporte estándar hasta 31/05/2029; ESM hasta 25/04/2034 |
| Runtime de contenedores | Docker Engine | 29.5.2 | Contenedor | Apache-2.0 | Se usa Docker Engine, no Docker Desktop |
| Orquestación local | Docker Compose | 5.1.4 | Contenedor | Apache-2.0 | Plugin oficial `docker compose` |
| Proxy inverso / TLS | Nginx | 1.28.0 | Proxy / Web | BSD-2-Clause | Propuesto para producción; sirve el build estático y termina TLS |
| Runtime de backend | Python | 3.12.15 | API runtime | PSF-2.0 | Imagen base `python:3.12-slim` |
| Runtime de build web | Node.js | 22.23.3 | Build / Toolchain | MIT | Solo build del frontend; no es servidor de producción |
| Gestor de paquetes web | pnpm | 10.34.7 | Build / Toolchain | MIT | Usado por `fe/Dockerfile` |
| Runtime móvil | Node.js + Expo CLI | Node.js 22.23.3 · Expo 58.0.23 | Build / Mobile | MIT | La app móvil no se ejecuta en el servidor |

#### 1.1.2 Aplicación: frontend web, API, base de datos y almacenamiento

| Componente | Nombre de software | Versión exacta | Tipo de software | Licencia exacta | Observaciones |
|---|---|---|---|---|---|
| Frontend web | React | 18.3.1 | Web | MIT | SPA servida por Vite en desarrollo; Nginx en producción |
| Frontend build | Vite | 5.4.21 | Web | MIT | `pnpm build` genera `dist/` |
| Lenguaje frontend | TypeScript | 5.9.3 | Web | Apache-2.0 | Tipado estático del frontend |
| Ruteo frontend | React Router DOM | 7.18.0 | Web | MIT | Rutas públicas y por rol |
| Cliente HTTP | Axios | 1.8.4 | Web | MIT | Interceptores JWT y refresh |
| Framework API | FastAPI | 0.163.1 | API | MIT | API REST versionada en `/api/v1` |
| Servidor ASGI | Uvicorn | 0.30.0 | API | BSD-3-Clause | Ejecuta FastAPI |
| ORM | SQLAlchemy | 2.0.30 | API / Acceso a datos | MIT | Modelos y sesiones |
| Migraciones | Alembic | 1.13.2 | DB / Migraciones | MIT | Head de migraciones del proyecto |
| Validación de datos | Pydantic | 2.7.0 | API | MIT | Schemas de entrada/salida |
| Driver de base de datos | PyMySQL | 1.1.0 | DB Driver | MIT | Conexión MySQL desde SQLAlchemy |
| Base de datos | MySQL Community Server | 8.0.46 actual / 8.4.13 LTS objetivo | DB | GPL-2.0-only con FOSS Exception | 8.0 sin soporte desde 30/04/2026; migración obligatoria |
| Almacenamiento de objetos | MinIO Server | `RELEASE.2025-09-07T16-13-09Z` | Almacenamiento S3 | AGPL-3.0-only | Imagen actual `elestio/minio`; fijar imagen oficial |
| SDK de objetos | MinIO Python SDK | 7.2.20 | API / Cliente S3 | Apache-2.0 | Subida de imágenes y evidencias |
| Aplicación móvil | Expo SDK | 58.0.23 | Mobile | MIT | Cliente Android/iOS |
| Framework móvil | React Native | 0.88.1 | Mobile | MIT | Runtime de la app móvil |
| UI móvil | React | 19.3.0 | Mobile | MIT | Componentes de la app |
| Lenguaje móvil | TypeScript | 6.0.3 | Mobile | Apache-2.0 | Tipado de la app móvil |

#### 1.1.3 Librerías de soporte y activos

| Componente | Nombre de software | Versión exacta | Tipo de software | Licencia exacta | Observaciones |
|---|---|---|---|---|---|
| Generación de PDF | ReportLab | 4.2.0 | API / Reporting | BSD-3-Clause | Facturas y reportes PDF |
| Generación de Excel | openpyxl | 3.1.5 | API / Reporting | MIT | Exportación de reportes |
| Tareas programadas | APScheduler | 3.11.3 | API / Scheduler | MIT | Recordatorios y cierres automáticos |
| Rate limiting | SlowAPI | 0.1.9 | API / Seguridad | MIT | Protección de endpoints sensibles |
| JWT | PyJWT | 2.15.1 | API / Seguridad | MIT | Firma y verificación de tokens |
| Hash de contraseñas | passlib | 1.7.4 | API / Seguridad | BSD-3-Clause | Esquema de hashing |
| Backend de hashing | bcrypt (Python) | 4.0.1 | API / Seguridad | Apache-2.0 | Implementación bcrypt |
| Tipografías web | Inter / Montserrat | Servidas desde Google Fonts | Activo web | SIL OFL-1.1 | Conservar aviso OFL si se autoalojan |
| Certificado TLS | Let's Encrypt | Certificado de 90 días | Servicio / TLS | No aplica (CA pública) | Renovación automática con ACME |

> **Nota sobre versiones:** las versiones de Python, Node.js, Docker y Compose corresponden a la imagen/entorno de referencia medido. Las etiquetas `latest` y `8.0` del compose no son reproducibles por sí solas; en producción se debe fijar la versión y el digest.

#### 1.1.4 Regla de versionado y reproducibilidad

1. Toda imagen de contenedor debe declararse con versión y digest:
   ```yaml
   # Ejemplo genérico; sustituir <DIGEST> por el valor real verificado.
   image: mysql:8.4.13@sha256:<DIGEST>
   image: minio/minio:RELEASE.2025-09-07T16-13-09Z@sha256:<DIGEST>
   image: node:22.23.3-alpine3.22@sha256:<DIGEST>
   image: python:3.12.15-slim-bookworm@sha256:<DIGEST>
   ```
2. Prohibido usar `latest` en producción.
3. Renovación mensual de dependencias mediante PR revisado, con análisis de vulnerabilidades (Trivy/Grype) y SBOM (Syft).
4. Revisión trimestral del calendario EOL de Ubuntu, MySQL, Python, Node.js, Nginx y MinIO.
5. `docker compose config --quiet` debe pasar antes de cada despliegue.

---

### 1.2 Matriz de requisitos hardware y dimensionamiento

#### 1.2.1 Escenario y método de medición

Los valores de consumo de esta ficha son una **línea base de laboratorio** para dimensionar el servidor. Deben repetirse en el hardware definitivo antes de la compra.

| Parámetro | Valor del banco de pruebas |
|---|---|
| Host de referencia | 4 vCPU · 8 GiB RAM · SSD SATA/NVMe · Ubuntu Server 24.04.5 LTS |
| Motor de contenedores | Docker Engine 29.5.2 · Docker Compose 5.1.4 |
| Carga simulada | 50 usuarios virtuales · rampa de 2 min · 10 min de meseta |
| Mezcla de tráfico | 70 % catálogo (GET), 20 % checkout (POST), 10 % login (POST) |
| Datos de prueba | 1.000 productos · 500 usuarios · 1.000 pedidos |
| Herramienta de carga | k6 o Artillery (fuera de los contenedores) |
| Criterio de aceptación | p95 API < 500 ms · tasa de error < 1 % |
| Muestreo | `docker stats --no-stream` cada 5 s durante 10 min |

Comando de captura usado:

```bash
# Ejecutar desde la raíz del repositorio, con el stack levantado.
docker stats --no-stream --format \
  'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.MemPerc}}\t{{.NetIO}}\t{{.BlockIO}}' \
  $(docker compose ps -q)
```

> `docker stats` expresa la CPU como porcentaje de **un núcleo**. Por eso la suma de varios contenedores puede superar el 100 % en un host multinúcleo. El dimensionamiento usa la suma como “vCPU equivalentes”.

#### 1.2.2 Consumo por servicio: reposo vs. carga simulada

| Servicio | Contenedor | CPU reposo | CPU bajo carga | RAM reposo | RAM bajo carga | Pico de RAM | Observaciones |
|---|---|---:|---:|---:|---:|---:|---|
| MySQL 8.0 | `neodomus_mysql` | 0,20 % | 35,00 % | 210 MiB | 480 MiB | 512 MiB | InnoDB, 120 QPS, escrituras de pedidos y citas |
| API FastAPI | `neodomus_api` | 0,30 % | 45,00 % | 115 MiB | 235 MiB | 256 MiB | 1 worker Uvicorn; endpoints de catálogo y checkout |
| MinIO | `neodomus_minio` | 0,10 % | 12,00 % | 95 MiB | 150 MiB | 160 MiB | Lectura/escritura de imágenes y evidencias |
| Frontend Vite (desarrollo) | `neodomus_frontend` | 0,20 % | 8,00 % | 175 MiB | 215 MiB | 224 MiB | Solo perfil de desarrollo; no usar en producción |
| Nginx (producción) | `neodomus_proxy` | 0,00 % | 5,00 % | 12 MiB | 20 MiB | 24 MiB | Reemplaza a Vite en producción y sirve `dist/` |
| **Total perfil desarrollo (Vite, sin Nginx)** | — | **0,80 %** | **100,00 %** | **595 MiB** | **1.080 MiB** | **1.152 MiB** | 1,00 vCPU equivalente en carga |
| **Total perfil producción (Nginx, sin Vite)** | — | **0,60 %** | **97,00 %** | **432 MiB** | **885 MiB** | **952 MiB** | 0,97 vCPU equivalente en carga |
| **Envelope de dimensionamiento** | — | **0,80 %** | **100,00 %** | **595 MiB** | **1.080 MiB** | **1.152 MiB** | Se toma el máximo entre ambos perfiles |

**Overhead del sistema operativo y del daemon de Docker:**

| Concepto | CPU | RAM | Nota |
|---|---:|---:|---|
| Ubuntu Server + Docker Engine + logs + agentes | 0,10 vCPU | 650 MiB | Medido fuera de los contenedores |
| **Demanda total de la plataforma** | **1,10 vCPU** | **1,76 GiB** | 1,00 vCPU + 0,10 vCPU; 1,125 GiB + 0,635 GiB |

#### 1.2.3 Composición del disco para el dimensionamiento

| Concepto | Tamaño estimado | Comentario |
|---|---:|---|
| Ubuntu Server + paquetes base | 6 GB | Sistema mínimo, sin escritorio |
| Imágenes Docker | 4 GB | API, frontend, MySQL, MinIO y Nginx |
| Datos MySQL (12 meses) | 2 GB | Crecimiento previsto de pedidos, citas y auditoría |
| Objetos MinIO (imágenes/evidencias, 12 meses) | 3 GB | Productos, perfiles y evidencias |
| Logs y archivos temporales | 1 GB | Rotación semanal |
| Backups locales (7 días) | 2 GB | Copia comprimida; no sustituye la copia externa |
| **Total usado estimado** | **18 GB** | Con 20 % de espacio libre operativo se requieren ≥ 22 GB |

> El script valida un **mínimo operativo de 10 GiB libres** (umbral de seguridad para que el host no se sature). El dimensionamiento de la ficha es mayor: **40 GB mínimos y 80 GB recomendados** de capacidad usable. Los 40 GB parten de los 22 GB calculados y añaden margen para capas temporales de Docker, actualizaciones y crecimiento; los 80 GB cubren el horizonte de 12 meses.

#### 1.2.4 Requisitos mínimos vs. recomendados

| Recurso | Mínimo | Recomendado | Justificación |
|---|---:|---:|---|
| CPU | 2 vCPU | 4 vCPU | El mínimo cubre el pico con holgura; el recomendado absorbe picos, backups y actualizaciones sin degradar la API |
| RAM | 4 GiB | 8 GiB | MySQL y MinIO crecen en caché; 8 GiB evita swap bajo carga |
| Disco usable | 40 GB SSD | 80 GB SSD | 22 GB calculados + margen para crecimiento, capas temporales y actualizaciones |
| IOPS (4K, mixto 70/30) | 500 IOPS | 1.500 IOPS | MySQL random writes y MinIO; el disco mecánico no es aceptable |
| Swap | 2 GiB | 4 GiB | Amortiguación ante picos; no sustituye RAM |
| Red | 100 Mbps | 1 Gbps | Descarga de imágenes, backups y atención concurrente |
| Retención de backup | 7 días local | 30 días local + copia externa | Ransomware, error humano y recuperación ante desastre |
| Disponibilidad objetivo | 99,5 % | 99,9 % | Un solo host no ofrece alta disponibilidad real; el 99,9 % requiere redundancia externa |

#### 1.2.5 Cálculo explícito del margen de seguridad (headroom)

Fórmulas aplicadas:

```text
Headroom (%) = ((Capacidad - Demanda pico) / Demanda pico) × 100
Incremento mínimo→recomendado (%) = ((Recomendado - Mínimo) / Mínimo) × 100
```

La demanda de IOPS se estima con 120 QPS de MySQL y un promedio de 3 operaciones de disco por transacción: `120 × 3 ≈ 360`, redondeado a **350 IOPS** para el cálculo conservador.

| Recurso | Demanda pico medida | Mínimo | Headroom mínimo | Recomendado | Headroom recomendado | Incremento mínimo→recomendado |
|---|---:|---:|---:|---:|---:|---:|
| CPU | 1,10 vCPU | 2 vCPU | 81,8 % | 4 vCPU | 263,6 % | +100 % |
| RAM | 1,76 GiB | 4 GiB | 127,3 % | 8 GiB | 354,5 % | +100 % |
| Disco usable | 18 GB | 40 GB | 122,2 % | 80 GB | 344,4 % | +100 % |
| IOPS | 350 IOPS | 500 IOPS | 42,9 % | 1.500 IOPS | 328,6 % | +200 % |

**Lectura del margen:**

- Se exige un **headroom mínimo ≥ 40 %** sobre el pico medido para CPU, RAM e IOPS. El mínimo de 2 vCPU/4 GiB/500 IOPS cumple: 81,8 %, 127,3 % y 42,9 %.
- El **recomendado** mantiene más de 3× la demanda pico en CPU, RAM, disco e IOPS. Ese colchón cubre:
  - crecimiento de tráfico del 50 % en 12 meses;
  - crecimiento de datos del 30 % en 12 meses;
  - ventanas de backup, migraciones Alembic y actualizaciones de imágenes;
  - pérdida temporal de un disco o de un nodo de aplicación.
- El incremento entre mínimo y recomendado es del **+100 % en CPU, RAM y disco** y del **+200 % en IOPS**. No es “el doble por duplicar”: responde a una regla de capacidad (3× pico) y a la criticidad de MySQL.
- Con la proyección a 12 meses (CPU 1,65 vCPU, RAM 2,29 GiB, disco 23,4 GB, IOPS 525), el servidor recomendado conserva más del **140 % de headroom** en todos los recursos.

#### 1.2.6 Resultado del dimensionamiento

| Escenario | Especificación |
|---|---|
| **Mínimo de laboratorio** | 2 vCPU · 4 GiB RAM · 40 GB SSD usable · 500 IOPS · red 100 Mbps |
| **Recomendado de producción** | 4 vCPU · 8 GiB RAM · 80 GB SSD usable · 1.500 IOPS · red 1 Gbps · doble NIC |
| **Almacenamiento físico propuesto** | 2× 480 GB SSD SATA/NVMe en RAID 1 para SO + 4× 480 GB SSD en RAID 10 para datos (Docker, MySQL y MinIO) |
| **Protección eléctrica** | UPS 1500 VA con apagado ordenado · doble fuente en el servidor |
| **Backup** | Local 7 días + copia externa cifrada 30 días · prueba de restauración trimestral |

> El RAID no es un backup. La copia externa debe estar en otra ubicación física o en almacenamiento de objetos con versionado, y debe probarse la restauración, no solo la copia.

---

### 1.3 Preguntas guía justificadas

#### 1.3.1 Sistema operativo, arquitectura y fin de soporte

| Criterio | Decisión |
|---|---|
| Sistema operativo | **Ubuntu Server 24.04.5 LTS (Noble Numbat)** |
| Arquitectura | **x86_64 / amd64** |
| Kernel | Serie GA 6.8 de Ubuntu 24.04 (HWE opcional para hardware nuevo) |
| Fecha de instalación de referencia | 20/10/2026 |
| Fin de soporte estándar | **31/05/2029** |
| Fin de ESM con Ubuntu Pro | **25/04/2034** (Canonical lo publica como mayo de 2034) |
| Ciclo de actualización | Parches de seguridad automáticos; reinicio programado mensual |
| Perfil de instalación | Servidor mínimo, sin escritorio, OpenSSH, UFW, AppArmor, `unattended-upgrades` |

**Justificación:**

1. **LTS con ciclo predecible:** 5 años de soporte estándar y 5 adicionales con ESM. Cubre el horizonte académico y permite planificar la actualización a Ubuntu 26.04 LTS sin urgencias.
2. **Compatibilidad con el stack:** Docker Engine, MySQL, MinIO, Python 3.12 y Nginx tienen soporte oficial y documentación para Ubuntu 24.04 x86_64.
3. **Seguridad por defecto:** AppArmor, UFW, actualizaciones de seguridad y soporte de CIS/DISA-STIG con Ubuntu Pro.
4. **Operación:** `cloud-init`, Netplan, systemd, `journald` y herramientas de diagnóstico estándar; el equipo ya está familiarizado con Debian/Ubuntu.
5. **Costo:** no hay licencia de SO. El costo aparece solo si se requiere ESM después de 2029 o soporte empresarial.

**Alternativas evaluadas:**

| Alternativa | Ventaja | Motivo para no elegirla como estándar |
|---|---|---|
| Ubuntu 26.04 LTS | Soporte hasta 2031/2036 | Lanzada en abril de 2026; 24.04.5 lleva más tiempo de madurez y pruebas del stack |
| Debian 13 (Trixie) | Estabilidad y philosophia libre | Ciclo de soporte y ecosistema de ESM menos alineado con el equipo; menor soporte comercial directo |
| RHEL 10 | Soporte empresarial fuerte | Suscripción por servidor y curva de aprendizaje; sobredimensionado para el proyecto |
| Windows Server | Integración con Active Directory | Licencias, mayor superficie de ataque y contenedores Linux en una capa extra |
| Ubuntu Desktop | Facilidad de uso | No es un SO de servidor; servicios y escritorio compiten por recursos |

**Checklist de hardening del SO:**

- [ ] SSH solo con claves; `PermitRootLogin no`; usuario administrador con `sudo`.
- [ ] UFW: permitir 22/tcp solo desde la red de administración, 80/443 desde Internet; denegar el resto.
- [ ] Publicar MySQL (3307) y MinIO (9001) solo en `127.0.0.1` o VPN.
- [ ] AppArmor activo; `unattended-upgrades` para parches de seguridad.
- [ ] NTP/chrony sincronizado; logs centralizados o retenidos 30 días.
- [ ] `/var/lib/docker` y `/srv/neodomus` en el volumen de datos, no en el disco de SO.
- [ ] Monitoreo de disco, RAM, carga y salud de los contenedores.

#### 1.3.2 Infraestructura on-premise: Rack vs. Torre vs. Blade y RAID

**Comparación de formato:**

| Criterio | Rack 1U/2U | Torre | Blade |
|---|---|---|---|
| Densidad | Alta: varias unidades en un gabinete | Baja: una unidad por equipo | Muy alta: chasis compartido |
| Redundancia | Fuentes redundantes, NIC duales, IPMI/BMC | Limitada; fuentes y NIC según modelo | Fuentes y ventiladores compartidos, alta disponibilidad |
| Mantenimiento | Extracción frontal, cables ordenados, acceso remoto | Acceso local; más difícil en gabinete | Gestión centralizada, pero dependencia del chasis |
| Costo inicial | Medio | Bajo | Alto (chasis, módulos, licencias) |
| Consumo y ruido | Medio; requiere ventilación | Bajo/medio; apto para oficina | Alto; requiere sala técnica |
| Escalabilidad | Buena, añadiendo unidades | Limitada | Excelente, pero con vendor lock-in |
| Recomendación | **Sí, para producción** | Solo laboratorio/oficina pequeña | No para esta escala |

**Decisión:** servidor **rack 1U o 2U** con 8 bahías para discos 2.5", doble fuente, IPMI/BMC, RAM ECC y dos NIC. Un rack de 12U con UPS, PDU y ventilación es suficiente para el servidor, el switch y el equipo de backup. Torre solo se justifica si no existe gabinete ni sala técnica; Blade no se justifica para un único host y añade costo y complejidad.

**Comparación de RAID:**

| Nivel | Tolerancia a fallos | Capacidad usable | Rendimiento | Uso recomendado |
|---|---|---|---|---|
| RAID 0 | Ninguna | 100 % | Máximo | No usar para datos |
| RAID 1 | 1 disco por espejo | 50 % | Lectura alta; escritura media | **SO y arranque** |
| RAID 5 | 1 disco | (N-1)/N | Penalización de escritura; rebuild lento | No recomendado para MySQL |
| RAID 6 | 2 discos | (N-2)/N | Mayor penalización | Archivo, no base de datos |
| RAID 10 | 1 disco por espejo | 50 % | Muy alto en lectura y escritura | **Datos de MySQL, MinIO y Docker** |

**Decisión de RAID:**

- **RAID 1** con 2× 480 GB SSD para el sistema operativo: simplicidad, arranque redundante y recuperación rápida.
- **RAID 10** con 4× 480 GB SSD para `/var/lib/docker`, MySQL y MinIO: mejor equilibrio entre IOPS, latencia de escritura y tolerancia a fallos. El rebuild es más rápido que RAID 5/6 y no tiene el “write hole” clásico.
- **Hot spare** si el chasis lo permite; controladora con caché protegida (BBU/capacitor) y monitorización SMART.
- **Backup 3-2-1:** copia local, copia externa cifrada y una copia offline/inmutable. Probar restauración trimestral.

**Si el presupuesto solo permite un arreglo:** 2× 480 GB SSD en RAID 1 para todo el sistema es aceptable para el laboratorio, pero el rendimiento de escritura y la capacidad no cumplen el escenario recomendado. Documentar la limitación y no prometer alta disponibilidad.

#### 1.3.3 Restricciones de licencias y costos implícitos

| Componente / servicio | Licencia o modelo | Obligación o restricción clave | Costo implícito | Mitigación |
|---|---|---|---|---|
| MySQL Community 8.0/8.4 | GPL-2.0-only con FOSS Exception | Copyleft: distribuir una versión modificada del servidor exige liberar el código; el uso interno como SaaS no obliga a publicar la aplicación | Soporte Oracle opcional; migración y pruebas | Migrar a 8.4 LTS; no distribuir un appliance cerrado con MySQL sin revisión legal |
| MinIO Server | AGPL-3.0-only | Si se modifica y se ofrece como servicio de red, hay que ofrecer el código correspondiente a los usuarios; usar sin modificar reduce el riesgo | Licencia comercial si se requiere soporte o uso embebido | No modificar MinIO; aislar el servicio; no exponer la consola 9001; conservar avisos |
| Docker Engine / Compose | Apache-2.0 | Permisiva; conservar NOTICE y avisos; no hay obligación de abrir el código propio | Docker Desktop no es gratis para grandes organizaciones; el servidor usa Engine | No instalar Docker Desktop en el servidor; usar Engine + Compose |
| Ubuntu Server 24.04 | GPLv3 y otras licencias libres | El SO es libre; ESM después de 2029 requiere Ubuntu Pro | Ubuntu Pro gratuito hasta 5 máquinas personales; suscripción empresarial si aplica | Planificar ESM o migración a 26.04 LTS antes de 2029 |
| Nginx | BSD-2-Clause | Conservar copyright/licencia; no usar el nombre del proyecto para promocionar derivados | NGINX Plus es comercial y opcional | Nginx open source es suficiente |
| FastAPI / Uvicorn / SQLAlchemy / Pydantic / React / Vite / Expo | MIT / BSD-3 / Apache-2.0 | Conservar avisos de copyright y licencia; Apache-2.0 incluye concesión de patentes | Ninguno | Generar `THIRD_PARTY_LICENSES` y revisar en cada release |
| ReportLab | BSD-3-Clause (open source) | La versión open source es permisiva; ReportLab PLUS es comercial | ReportLab PLUS solo si se necesitan funciones avanzadas | Verificar que el código no importe módulos exclusivos de PLUS |
| Tipografías Inter / Montserrat | SIL OFL-1.1 | Se pueden usar y redistribuir con la licencia; no se pueden vender por separado | Ninguno | Incluir el texto OFL si se autoalojan |
| Google OAuth | Términos de servicio de Google | Cuotas, políticas de privacidad y disponibilidad del proveedor | Gratuito con límites; costos si se superan cuotas | Tener login local como fallback; revisar scopes |
| SMTP / Resend | Servicio de terceros | Límites de envío, reputación y tratamiento de datos | Gratuito con límites; plan pago desde cierto volumen | Usar dominio propio, SPF/DKIM/DMARC y proveedor transaccional |
| Pasarela de pagos (futuro) | Contrato del proveedor | Comisión por transacción, PCI-DSS y conciliación | Porcentaje por venta + costos de integración | En la entrega académica se usa el simulador; en producción cotizar |
| Let's Encrypt | CA pública | Certificados de 90 días; automatizar renovación | Gratuito | `certbot` + renovación automática + monitoreo |
| Dominio y DNS | Registro | Renovación anual y protección de la cuenta | USD 10–25/año | Registrar con MFA y bloqueo de transferencia |

**Costos implícitos de infraestructura (orden de magnitud, no cotización):**

| Concepto | Modelo | Rango estimado | Nota |
|---|---|---:|---|
| Servidor rack 1U/2U, 4 vCPU, 8 GiB, 8 bahías | CAPEX | USD 1.500–3.000 | Depende de marca, CPU, RAM y garantía |
| 6 SSD 480 GB (2 SO + 4 datos) | CAPEX | USD 300–700 | Preferir SSD con TBW y garantía |
| UPS 1500 VA + PDU | CAPEX | USD 300–600 | Apagado ordenado y protección de picos |
| Gabinete 12U, bandejas y cables | CAPEX | USD 200–600 | Ventilación y acceso |
| Ubuntu Pro / soporte | OPEX | USD 0–variable | Gratis para uso personal hasta 5 máquinas |
| MySQL / MinIO / Nginx / Docker | OPEX | USD 0 | Código abierto; soporte comercial opcional |
| Dominio + DNS | OPEX | USD 10–25/año | Renovación y privacidad WHOIS |
| Correo transaccional | OPEX | USD 0–20/mes | Según volumen |
| Backup externo | OPEX | USD 5–30/mes | 100 GB cifrados, fuera del sitio |
| Pasarela de pagos | Variable | % por transacción | No aplica con el simulador académico |
| Operación y mantenimiento | OPEX | 8–16 h/mes | Parches, backups, monitoreo y incidentes |

> Los precios son referencias de orden de magnitud para la sustentación; no constituyen una cotización. Deben validarse con proveedores locales y con IVA/impuestos aplicables.

**Checklist de cumplimiento de licencias:**

- [ ] Generar SBOM (Syft) y escanear vulnerabilidades (Trivy/Grype) en cada build.
- [ ] Publicar `THIRD_PARTY_LICENSES` con MIT, BSD, Apache-2.0 y OFL.
- [ ] Revisar obligaciones AGPL de MinIO antes de modificar o redistribution.
- [ ] No distribuir MySQL dentro de un appliance propietario sin revisión legal.
- [ ] Confirmar que ReportLab usado es la versión BSD, no módulos PLUS.
- [ ] No instalar Docker Desktop en el servidor Linux.
- [ ] Decidir y documentar Ubuntu Pro antes del 31/05/2029.
- [ ] Revisar tratamiento de datos personales (Ley 1581 de 2012 en Colombia) y política de privacidad.

---

### 1.4 Salida real del script `verificar-requisitos.sh`

#### 1.4.1 Ejecución

```bash
# Desde la raíz del repositorio
chmod +x scripts/verificar-requisitos.sh
./scripts/verificar-requisitos.sh

# Prueba de fallo controlado para la sustentación
SIMULATE_FAIL=true ./scripts/verificar-requisitos.sh
# Equivalente:
./scripts/verificar-requisitos.sh --simulate-fail
```

El script no requiere root si el usuario pertenece al grupo `docker`, no imprime credenciales y no modifica el sistema. La validación de `docker-compose.yml` ejecuta `docker compose config --quiet`, que resuelve variables de entorno y `.env` sin mostrar sus valores.

El código se organiza en funciones independientes: `check_os`, `check_permissions`, `check_docker`, `check_memory`, `check_disk` y `check_ports`. Los umbrales se ajustan con `MIN_RAM_GB`, `MIN_DISK_GB`, `DISK_PATH` y `PORTS_TO_CHECK`. La función `print_summary` devuelve `0` solo cuando `FAIL_COUNT` es cero; cualquier fallo crítico o la simulación terminan con código `1`.

#### 1.4.2 Salida de referencia — entorno conforme

> Captura de referencia en Ubuntu Server 24.04.5 LTS. El host y el usuario se han genericado por seguridad; los valores de RAM, disco y puertos son los del servidor de laboratorio.

```text
$ ./scripts/verificar-requisitos.sh

==============================================================
  Neodomus — Verificación de requisitos de implantación
  Semana 1 · Ficha técnica y matriz de requisitos
==============================================================

[INFO] Host: servidor-ejemplo | Usuario: usuario-ejemplo | Fecha: 2026-10-20 10:15:42 -05
[INFO] Umbrales: RAM >= 4 GiB · Disco libre >= 10 GiB en / · Puertos: 80 443 5173 8000 3306 3307 9000 9001
[INFO] SIMULATE_FAIL=false · NO_COLOR=false

[INFO] 1. Sistema operativo y arquitectura
[ OK ] Sistema Linux detectado (kernel 6.8.0-xx-generic).
[ OK ] Arquitectura x86_64 compatible con las imágenes del stack.
[ OK ] Distribución homologada: Ubuntu 24.04.5 LTS.

[INFO] 2. Usuario y permisos
[ OK ] Ejecución con usuario sin privilegios (uid=1000).
[ OK ] El usuario 'usuario-ejemplo' pertenece al grupo docker.

[INFO] 3. Docker Engine y Docker Compose
[ OK ] Docker Engine instalado (29.5.2).
[ OK ] Daemon de Docker operativo (29.5.2).
[ OK ] Versión de Docker Engine >= 20.
[ OK ] Docker Compose v2+ disponible (5.1.4).
[ OK ] docker-compose.yml válido y resoluble.

[INFO] 4. Memoria RAM
[ OK ] RAM total: 7.76 GiB (mínimo requerido: 4 GiB).
[INFO] RAM disponible en el momento de la prueba: 6.42 GiB.

[INFO] 5. Espacio en disco
[ OK ] Espacio libre en /: 74.31 GiB de 80.00 GiB (mínimo requerido: 10 GiB).

[INFO] 6. Disponibilidad de puertos
[ OK ] Puerto 80/tcp libre.
[ OK ] Puerto 443/tcp libre.
[ OK ] Puerto 5173/tcp libre.
[ OK ] Puerto 8000/tcp libre.
[ OK ] Puerto 3306/tcp libre.
[ OK ] Puerto 3307/tcp libre.
[ OK ] Puerto 9000/tcp libre.
[ OK ] Puerto 9001/tcp libre.

[INFO] Resumen: 20 aprobadas, 0 advertencias, 0 fallidas.
[ OK ] Entorno APTO para el despliegue de Neodomus.
```

**Código de salida:** `0`.

#### 1.4.3 Salida de referencia — fallo simulado

```text
$ SIMULATE_FAIL=true ./scripts/verificar-requisitos.sh

==============================================================
  Neodomus — Verificación de requisitos de implantación
  Semana 1 · Ficha técnica y matriz de requisitos
==============================================================

[INFO] Host: servidor-ejemplo | Usuario: usuario-ejemplo | Fecha: 2026-10-20 10:18:07 -05
[INFO] Umbrales: RAM >= 4 GiB · Disco libre >= 10 GiB en / · Puertos: 80 443 5173 8000 3306 3307 9000 9001
[INFO] SIMULATE_FAIL=true · NO_COLOR=false

[... misma salida de las secciones 1 a 6 ...]

[INFO] 7. Simulación de fallo
[FAIL] Fallo simulado activado (SIMULATE_FAIL=true). Se fuerza el resultado global a NO APTO.

[INFO] Resumen: 20 aprobadas, 0 advertencias, 1 fallida.
[FAIL] Entorno NO APTO. Corrija los requisitos marcados como [FAIL] y vuelva a ejecutar.
```

**Código de salida:** `1`.

#### 1.4.4 Interpretación de resultados

| Código | Significado | Acción |
|---:|---|---|
| `0` | Todos los requisitos críticos se cumplen | Continuar con la instalación |
| `1` | Falla un requisito crítico, un umbral o la simulación | Corregir y volver a ejecutar |
| `[WARN]` | Requisito no bloqueante (por ejemplo, distribución no homologada o usuario sin grupo docker) | Revisar antes de producción; no impide la ejecución |
| `[FAIL]` | Requisito bloqueante (Docker, RAM, disco, puerto ocupado o simulación) | No continuar hasta resolverlo |

> La salida completa con colores ANSI se muestra solo en terminal interactiva. Si se redirige a un archivo, el script desactiva los colores y conserva los prefijos `[INFO]`, `[ OK ]`, `[WARN]` y `[FAIL]`.

---

### 1.5 Criterios de aceptación de la Semana 1

| Criterio | Evidencia | Estado |
|---|---|---|
| Inventario completo con versión y licencia | Tablas 1.1.1 a 1.1.3 | ✅ |
| Matriz de consumo en reposo y bajo carga | Tabla 1.2.2 y método 1.2.1 | ✅ |
| Requisitos mínimos vs. recomendados | Tabla 1.2.4 | ✅ |
| Cálculo explícito de headroom | Tabla 1.2.5 y fórmulas | ✅ |
| SO, arquitectura y EOL justificados | Sección 1.3.1 | ✅ |
| Rack vs. torre vs. blade y RAID | Sección 1.3.2 | ✅ |
| Restricciones y costos de licencias | Sección 1.3.3 | ✅ |
| Script ejecutable, seguro y con salida 0/1 | `scripts/verificar-requisitos.sh` y sección 1.4 | ✅ |
| Prueba de fallo controlado | `SIMULATE_FAIL=true` y sección 1.4.3 | ✅ |

**Acciones que pasan a la Semana 2:** migrar MySQL a 8.4 LTS, fijar imágenes por digest, incorporar Nginx/TLS, eliminar credenciales por defecto y definir el plan de backups.

---

## Fuentes consultadas

- Canonical. *Ubuntu release cycle*. https://ubuntu.com/about/release-cycle (consultado el 20/10/2026).
- endoflife.date. *Ubuntu 24.04 LTS*. https://endoflife.date/ubuntu (consultado el 20/10/2026).
- endoflife.date. *MySQL lifecycle*. https://endoflife.date/mysql (consultado el 20/10/2026).
- Oracle. *Lifetime Support Policy*. https://www.oracle.com/us/support/library/lifetime-support-technology-069183.pdf
- MinIO. *Licencia AGPL-3.0*. https://github.com/minio/minio/blob/master/LICENSE
- Docker. *Docker Engine license y suscripciones de Docker Desktop*. https://www.docker.com/legal/docker-subscription-service-agreement/
- Node.js. *Releases*. https://nodejs.org/en/about/previous-releases (consultado el 20/10/2026).
- Nginx. *Licencia BSD-2-Clause*. https://nginx.org/LICENSE
- Open Source Initiative. *MIT, BSD-2-Clause, BSD-3-Clause, Apache-2.0*. https://opensource.org/licenses

---

> **Cierre de la Sección 1.** La evidencia de migración se documenta en la Sección 2; las secciones 3 y 4 corresponden a sus entregables respectivos; el despliegue de la Semana 4 está en la Sección 5 y la configuración/verificación de Semana 5 en la Sección 6.

## 2. Evidencia y procedimiento de migración — Semana 5

**Estado de cierre:** parcial. Hay evidencia histórica de despliegue y smoke test básico en Linux/WSL y Railway, además de actualización/rollback de la web. Esas evidencias no prueban una migración de datos. La comparación de conteos y SHA-256, el corte real y el smoke test ampliado posterior al corte siguen pendientes.

| Evidencia previa | Registro disponible | Qué demuestra | Qué no demuestra |
|---|---|---|---|
| `evidencias/smoke-linux.txt` | Prueba Linux/WSL, HTTP 200 y catálogo con 10 productos | Web/API respondían en ese momento | Migración de origen a destino, huellas comparadas ni autenticación del smoke test actual |
| `evidencias/smoke-nube.txt` | Prueba histórica de web/API/catálogo en Railway | Despliegue básico de nube y lectura del catálogo | Migración de datos, MinIO, carga/descarga de objetos ni huellas post-corte |
| `evidencias/actualizacion-linux.txt` y `evidencias/rollback-linux.txt` | Web 1.0.1 desplegada y rollback a 1.0.0 con HTTP 200 | Cambio y reversión de imagen web | Rollback de esquema/base de datos |

La evidencia se considera histórica y debe repetirse contra la versión/destino que se acepte ahora. No atribuirle resultado al corte de datos.

### 2.1 Preparación y ensayo

1. Designar responsable técnico, responsable funcional y ventana de mantenimiento; confirmar acceso administrativo y espacio del destino.
2. Confirmar compatibilidad del motor con la aplicación y fijar versión de origen, destino y migraciones. Para Neon/Supabase, bloquear esta fase hasta completar portabilidad PostgreSQL en código y Alembic.
3. Inventariar tablas, vistas, índices, constraints, triggers, usuarios/roles, volumen de archivos MinIO y tamaño de respaldos. Registrar conteos base antes del ensayo.
4. Ensayar una restauración íntegra en un destino aislado. Aplicar migraciones, verificar conteos/checksums y ejecutar smoke test contra esa copia. Registrar hora UTC, versiones, responsable y resultados sin incluir secretos ni datos personales.
5. Preparar respaldo cifrado con Restic y retención definida. En despliegue, usar el script de Semana 6 con un archivo root-only de configuración; no generar dumps SQL sin cifrar en el repositorio del proyecto. Para el ensayo de migración, restaurar el dump desde el snapshot a un directorio cifrado temporal.
6. Verificar que Restic puede leer el snapshot, que el SHA-256 del dump restaurado coincide con el sidecar registrado y que se puede importar en ambiente aislado. El dump contiene información sensible y no debe anexarse al informe.

### 2.2 Corte y copia

1. Anunciar inicio de ventana y activar mantenimiento visible. Suspender escrituras: poner la web en modo mantenimiento y detener procesos, workers, tareas programadas y clientes que puedan escribir. Confirmar que no hay sesiones de escritura activas.
2. Tomar respaldo final consistente de origen. Registrar fecha/hora, versión, nombre del artefacto (sin ruta sensible) y SHA-256 del archivo. Conservar origen sin cambios hasta aceptar el destino.
3. Migrar estructura y datos con herramienta compatible con los motores elegidos. Mantener orden de dependencias/foreign keys; conservar codificación y zona horaria acordadas. Para cambio a PostgreSQL, usar un proceso de conversión probado y aprobado, no restaurar un dump MySQL directamente.
4. Migrar objetos MinIO por un flujo separado; comparar inventario, número de objetos y checksums del contenido cuando el proveedor permita descargarlos. La verificación SQL no cubre archivos.
5. Ejecutar `scripts/verificar-migracion.py` con `SOURCE_DATABASE_URL` y `TARGET_DATABASE_URL` configuradas de forma segura en el entorno. El script compara tablas reflejadas, `COUNT(*)` exacto y SHA-256 de filas canonizadas. Código de salida: `0` si todas coinciden, `1` si hay diferencias, `2` si no se pudo ejecutar. Para instalar el driver PostgreSQL solo en el entorno temporal:

```bash
uv run --project be --with "psycopg[binary]" python scripts/verificar-migracion.py
```

6. No exponer URLs en terminales compartidas o logs de CI; el verificador no imprime credenciales ni valores de filas. Los cambios de tipo/precisión o conversiones pueden requerir reglas de canonicalización aprobadas antes del corte; no se aceptan diferencias sin explicación firmada.
7. Configurar el backend al destino aprobado, iniciar API y dependencias, observar healthchecks y ejecutar el smoke test completo. Verificar login, consulta del catálogo, lectura de detalle y flujos de lectura priorizados por el responsable funcional.
8. Aceptar el corte solo con cero diferencias inexplicadas en conteos y hashes, smoke test satisfactorio, métricas estables y aprobación registrada. Entonces retirar modo mantenimiento y habilitar escrituras en el nuevo destino.

### 2.3 Evidencia que debe adjuntarse al informe

| Evidencia | Registro requerido | Estado en este entregable |
|---|---|---|
| Configuración validada | Resultado `docker compose config --quiet`, fecha y versión | Validada estáticamente en el workspace; pendiente registrar en host de despliegue |
| Respaldo final | Fecha UTC, tamaño y SHA-256; ubicación se conserva fuera del informe | Pendiente de ventana de corte |
| Conteos y hashes | Salida del verificador por tabla; sin URLs ni datos de filas | Pendiente de acceso a origen y destino |
| Healthchecks | Estado `healthy` de web, API, MySQL y MinIO | Definidos en Compose; estado actual del servidor pendiente |
| Smoke test | Código de salida, endpoints y hora UTC; ocultar credenciales | Básico histórico aprobado en Linux/WSL y nube; repetir smoke ampliado con autenticación después del corte |
| Aprobación funcional | Responsable, fecha/hora y resultado de flujos críticos | Pendiente |

**Declaración de ejecución:** No se realizó una migración de datos en esta entrega porque no se proporcionaron acceso al origen/destino, credenciales ni ventana de mantenimiento. Por tanto, no se afirman conteos, hashes ni pruebas externas como ejecutadas. La evidencia se completa durante el corte real con los artefactos de la tabla anterior.

**Criterio de cierre de Semana 5:** origen y destino identificados; respaldo restaurable; conteos y SHA-256 coincidentes (o diferencias formalmente conciliadas); smoke test autenticado satisfactorio en destino después del corte; healthchecks saludables; aprobación funcional y técnica registradas. Hasta completar esos puntos, el estado es **PARCIAL / PENDIENTE DE CORTE REAL**.

---

## 5. Procedimiento de despliegue — Semana 4

### 5.1 Liberación e instalación en Linux

La versión base usa imágenes separadas para web y API. Nginx sirve la web compilada y reenvía las consultas a FastAPI. MySQL y MinIO permanecen en la red del Compose. La prueba se realizó en Ubuntu sobre WSL, con el proyecto en /opt/neodomus y el puerto 8080 publicado en la interfaz local.

Crear `deploy/.env.prod` desde `deploy/env.prod.example`, reemplazar todos los placeholders por secretos únicos (contraseñas DB con `openssl rand -hex 32`), establecer `FRONTEND_URL`/`CORS_ORIGINS` y proteger con modo `0600`. No cambiar la contraseña root en una base con volumen existente sin un procedimiento de rotación.

Desde la raíz del proyecto en Linux, con Docker y Compose disponibles:

```bash
chmod 600 deploy/.env.prod
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml config --quiet
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml up -d --build db minio
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml --profile ops run --rm migrate
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml up -d --build api web
read -r -p 'Email de prueba: ' SMOKE_EMAIL
read -r -s -p 'Contraseña de prueba: ' SMOKE_PASSWORD; echo
export SMOKE_EMAIL SMOKE_PASSWORD
bash scripts/smoke-test.sh http://localhost:8080
unset SMOKE_EMAIL SMOKE_PASSWORD
```

Resultado esperado: web, salud y consulta del producto responden HTTP 200. La evidencia inicial registró 10 productos en el catálogo.

### 5.2 Respaldo, actualización y rollback

```bash
sudo bash -c 'set -a; . /etc/neodomus/backup.env; set +a; exec /usr/local/sbin/neodomus-backup-restic'
```

Continuar solo después de confirmar que el respaldo terminó correctamente. Para la prueba se creó una imagen derivada con un marcador de versión:

```bash
docker build -t neodomus-web:1.0.1 - <<'EOF'
FROM neodomus-web:1.0.0
RUN printf 'Neodomus web 1.0.1\n' > /usr/share/nginx/html/version.txt
EOF
docker compose --env-file deploy/.env.prod \
  -f deploy/compose.prod.yaml -f deploy/compose.update.yaml up -d --no-deps web
curl -fsS http://localhost:8080/version.txt
read -r -p 'Email de prueba: ' SMOKE_EMAIL
read -r -s -p 'Contraseña de prueba: ' SMOKE_PASSWORD; echo
export SMOKE_EMAIL SMOKE_PASSWORD
bash scripts/smoke-test.sh http://localhost:8080
unset SMOKE_EMAIL SMOKE_PASSWORD
```

El marcador devolvió Neodomus web 1.0.1. Para volver a la imagen anterior:

```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml up -d --no-deps web
docker inspect --format '{{.Config.Image}}' neodomus-prod-web-1
read -r -p 'Email de prueba: ' SMOKE_EMAIL
read -r -s -p 'Contraseña de prueba: ' SMOKE_PASSWORD; echo
export SMOKE_EMAIL SMOKE_PASSWORD
bash scripts/smoke-test.sh http://localhost:8080
unset SMOKE_EMAIL SMOKE_PASSWORD
```

La inspección devolvió neodomus-web:1.0.0 y la web y el producto respondieron HTTP 200. El cambio fue solo de la web, por lo que no requirió restaurar MySQL. Las migraciones aditivas pueden permitir rollback si la versión anterior sigue funcionando con el esquema nuevo. Ante una eliminación de columnas o una transformación incompatible, detener escrituras y ensayar la restauración antes de recuperar el servicio. Esa restauración no se probó en esta entrega.

### 5.3 Despliegue en Railway

Se conectaron las imágenes juliancc13/neodomus-api:1.0.0 y juliancc13/neodomus-web:1.0.0 desde Docker Hub. La API se conectó a MySQL por red privada. Los secretos se configuraron en Railway. La web usa la configuración deploy/nginx.railway.conf y reenvía las consultas a la API por HTTPS. La prueba verificó el catálogo y el detalle del producto. La carga de archivos en MinIO en la nube queda sin verificar.

El resultado anterior corresponde a la evidencia histórica de la Semana 4. El smoke test ampliado de Semana 5 también exige readiness de MinIO y autenticación con una cuenta de prueba; su ejecución contra Railway queda pendiente hasta configurar y verificar esa dependencia.

```bash
read -r -p 'Email de prueba: ' SMOKE_EMAIL
read -r -s -p 'Contraseña de prueba: ' SMOKE_PASSWORD; echo
export SMOKE_EMAIL SMOKE_PASSWORD
bash scripts/smoke-test.sh https://neodomus-web-production.up.railway.app
unset SMOKE_EMAIL SMOKE_PASSWORD
```

Evidencias: [Linux](../evidencias/smoke-linux.txt), [Railway](../evidencias/smoke-nube.txt), [actualización](../evidencias/actualizacion-linux.txt) y [rollback](../evidencias/rollback-linux.txt).

### 5.4 Costos

Para la demostración se eligió Railway Trial porque permitió conservar MySQL y usar crédito de prueba. La prueba ofrece USD 5 por única vez, hasta 30 días. Como alternativa en la misma plataforma, Hobby tiene un mínimo de USD 5 al mes, con el consumo incluido hasta ese importe y cobro adicional si se supera. El costo real depende de CPU, memoria, almacenamiento y tráfico. Consultado el 4 de noviembre de 2026. [Prueba de Railway](https://docs.railway.com/pricing/free-trial) · [Planes y tarifas](https://docs.railway.com/pricing/plans)

### 5.10 Instalación automatizada mediante IaC — Semana 10 opcional

**No implementada; evaluación técnica: no aplica por ahora.** El repositorio describe un despliegue en VPS/Ubuntu por Compose y no declara proveedor de infraestructura ni inventario de recursos cloud. No hay suficientes variables de entorno/infraestructura aprobadas para crear cloud-init, Ansible o OpenTofu sin asumir usuarios, redes, firewall, DNS, almacenamiento o proveedor. La instalación actualmente documentada está en las secciones 5.1–5.2. Si se selecciona infraestructura objetivo, diseñar primero aprovisionamiento idempotente y protección de recursos persistentes, validar en máquinas desechables y nunca guardar secretos o estado sensible en Git. No ejecutar `apply`/`destroy` en recursos reales sin autorización.


---

## 6. Configuración, verificación y resiliencia — Semana 5

### Alcance

Esta entrega establece configuración reproducible, validación temprana de variables, checks de salud, pruebas de humo y un procedimiento auditable para mover datos. El backend del repositorio es FastAPI con SQLAlchemy/Alembic y el despliegue existente usa MySQL 8, además de MinIO para objetos. Las migraciones contienen construcciones específicas de MySQL. Por ello, Neon y Supabase PostgreSQL **no son destinos intercambiables en el estado actual**: antes de utilizarlos se requiere portar y probar el esquema, migraciones, consultas, valores ENUM, colaciones y dependencias.

La migración a PostgreSQL no se declara ejecutada ni compatible. El procedimiento operativo de corte descrito aquí aplica cuando el destino ya sea compatible con la versión de base de datos soportada por la aplicación. Para usar Neon/Supabase, completar primero el trabajo de portabilidad y una migración de ensayo.

### 6.1 Gestión de configuración y secretos (12-Factor)

La aplicación lee configuración del entorno o de `.env`; los `.env` reales no se versionan. Plantillas disponibles: `.env.example`, `be/.env.example` y `deploy/env.prod.example`. En producción, la plataforma de despliegue debe inyectar los secretos desde un gestor de secretos y no desde el repositorio.

Variables críticas:

| Variable | Uso | Regla |
|---|---|---|
| `DATABASE_URL` | Conexión SQLAlchemy al MySQL soportado | Obligatoria; esquema `mysql+pymysql://` |
| `SECRET_KEY` | Firma de tokens JWT | Obligatoria; sustituir el valor de ejemplo; mínimo 32 caracteres en producción |
| `MYSQL_APP_USER` / `MYSQL_APP_PASSWORD` | Cuenta de API con rol DML | Obligatoria; distinta de owner/backup; password aleatoria hexadecimal |
| `MYSQL_OWNER_USER` / `MYSQL_OWNER_PASSWORD` | Cuenta exclusiva para job de migraciones | Obligatoria; no se entrega a la API |
| `MYSQL_BACKUP_USER` / `MYSQL_BACKUP_PASSWORD` | Cuenta de lectura usada por el dump | Obligatoria; sin DDL ni DML de escritura |
| `MYSQL_ROOT_PASSWORD` | Bootstrap/administración de emergencia de MySQL | Solo DBA; nunca API ni backup diario |
| `MINIO_PASSWORD` / `MINIO_SECRET_KEY` | Acceso al almacenamiento de objetos | Inyectar un secreto distinto al de ejemplo |
| `FRONTEND_URL` | Origen de enlaces y configuración de la aplicación | Debe corresponder al dominio publicado |
| `CORS_ORIGINS` | Orígenes web autorizados | Obligatoria en producción; no se admite `*` |
| `LOG_LEVEL` | Nivel de logging (`CRITICAL`, `ERROR`, `WARNING`, `INFO`, `DEBUG`) | Por defecto `INFO` |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USERNAME`, `SMTP_PASSWORD`, `EMAIL_PROVIDER` | Envío de correos transaccionales | Configurar solo según el proveedor habilitado |
| `TRUSTED_PROXIES`, `RATE_LIMIT_*` | Proxy inverso y limitación de solicitudes | Limitar la confianza al proxy/red interna reales |
| `MINIO_ENDPOINT`, `MINIO_BUCKET`, `MINIO_PUBLIC_ENDPOINT` | Almacenamiento y URLs de medios | Ajustar a los endpoints internos/públicos del entorno |

Al importar la capa de base de datos, `validate_startup_settings()` comprueba que existan `DATABASE_URL` y `SECRET_KEY`, rechaza la clave de ejemplo y el motor no soportado, valida la clave de producción y el nivel de logs. Si falla, el proceso termina antes de crear el engine y emite un mensaje accionable sin imprimir credenciales. FastAPI entrega `/health` como liveness y `/health/readiness` comprueba `SELECT 1` y el endpoint de disponibilidad de MinIO.

Crear secretos de ejemplo localmente (no copiar la salida al repositorio):

```bash
openssl rand -hex 32
```

### 6.2 Orquestación y resiliencia

El archivo `deploy/compose.prod.yaml` orquesta `web` (React/Vite compilado y servido por Nginx), `api` (FastAPI), `db` (MySQL) y `minio` (objetos). Los servicios usan `restart: unless-stopped`, `json-file` con límite `10m` y tres archivos, y healthchecks con intervalo de 10 s, timeout de 5 s, tres reintentos y periodo inicial de 15 s. `web` espera a `api` saludable; `api` espera a MySQL y MinIO saludables.

Antes de levantar servicios, crear `deploy/.env.prod` a partir de `deploy/env.prod.example`, completar secretos en el host y proteger sus permisos. No compartir el archivo ni adjuntarlo a evidencias. Comprobar configuración sin imprimir secretos:

```bash
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml config --quiet
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml build
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml up -d db minio
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml --profile ops run --rm migrate
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml up -d api web
docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml ps
```

El servicio API productivo ejecuta Uvicorn con el rol limitado y no aplica Alembic al iniciar. El perfil `ops` ejecuta una migración aprobada con `neodomus_owner`; no usarlo como cuenta runtime. Docker no reinicia un contenedor solo por pasar a estado `unhealthy`: ese estado refleja fallos del healthcheck, mientras `restart` reacciona al proceso que termina. Diagnosticar `docker inspect`, `docker logs` y `docker compose ps`; corregir la causa del healthcheck o del proceso.

### 6.3 Verificación posterior al despliegue

`scripts/smoke-test.sh [BASE_URL] [PRODUCT_ID]` valida HTTP 200 en la aplicación SPA, ruta de producto, `/health`, `/health/readiness`, `/openapi.json`, listado y detalle de productos. Falla con código distinto de cero ante cualquier error. Requiere `SMOKE_EMAIL` y `SMOKE_PASSWORD` de una cuenta temporal habilitada; prueba login y sesión Bearer sin imprimir credenciales ni token.

Ejemplo (usar una cuenta temporal de pruebas; introducir la contraseña de forma interactiva y no guardar valores en el historial):

```bash
read -r -p 'Email de prueba: ' SMOKE_EMAIL
read -r -s -p 'Contraseña de prueba: ' SMOKE_PASSWORD; echo
export SMOKE_EMAIL SMOKE_PASSWORD
scripts/smoke-test.sh https://<dominio-neodomus> 10
unset SMOKE_EMAIL SMOKE_PASSWORD
```

### 6.4 Reversión (rollback)

1. Mantener el origen íntegro y sin eliminarlo durante la ventana de observación acordada. No permitir escrituras simultáneas en origen y destino.
2. Si falla la compatibilidad, readiness, verificación de integridad o smoke test, mantener modo mantenimiento y bloquear escrituras en el destino.
3. Restaurar la configuración anterior del backend y reconectar al origen. Si el origen recibió escrituras después del corte, definir y ejecutar primero una reconciliación aprobada para no perder esas operaciones.
4. Iniciar servicios contra el origen y comprobar liveness, readiness, login y lecturas clave con el smoke test. Reabrir escrituras solo cuando el responsable funcional confirme.
5. Registrar incidente, causa, hora, versión y decisión. Conservar logs y respaldos según política; retirar el destino fallido solo después de preservar evidencia y autorización operativa.

## Semana 6 — Respaldo y seguridad operativa

> **Entregable:** Sección 3 final (respaldo y recuperación) y Sección 7 (seguridad, usuarios y permisos)
> **Fecha:** 13/11/2026 · **Sistema:** Ubuntu Server 24.04 LTS, Docker Compose, FastAPI y MySQL
> **Estado de validación:** diseño y artefactos preparados; el simulacro de restauración debe ejecutarse en infraestructura aislada y registrarse en la bitácora de §3.7. No se declara una restauración ejecutada por este documento.

### 1. Alcance y decisiones

La configuración aplica mínimo privilegio al host y MySQL, limita el acceso administrativo por llave SSH y documenta un respaldo cifrado con Restic. El stack real de NEODOMUS usa MySQL; PostgreSQL (5432) solo se bloquea expresamente en el firewall como defensa adicional. MySQL debe permanecer en la red privada de Compose y sin publicación en interfaces públicas.

**Metas heredadas de Semana 2:** RPO ≤ 24 horas y RTO ≤ 4 horas. Se ejecuta una copia diaria; no hay PITR/binlogs en esta solución, por lo que no se promete recuperación a minutos. Si el registro rector de Semana 2 establece otro objetivo aprobado, prevalece ese registro.

### 3. Plan de Respaldo Final y Recuperación

#### 3.1 Estrategia 3-2-1

| Copia | Medio/ubicación | Protección |
|---|---|---|
| 1 | Repositorio Restic local en volumen/disco dedicado distinto del volumen de datos | Cifrado nativo Restic, contraseña desde archivo root-only |
| 2 | Repositorio Restic remoto S3 o Backblaze B2 en cuenta/proyecto separado | TLS, cifrado Restic de extremo a extremo, credencial IAM de mínimo privilegio y versionado/retención protegida del bucket |
| 3 | Snapshot/replicación administrada del proveedor o medio desconectado periódico | Cuenta/ubicación y credenciales separadas; prueba de recuperación trimestral |

El repositorio local y remoto no cuentan como medios independientes si comparten el mismo disco, credencial administrativa o dominio de fallo. El responsable de plataforma confirma la separación física/lógica y activa Object Lock cuando esté disponible. Restic cifra el contenido y los metadatos del repositorio; la contraseña debe guardarse separada del host en gestor de secretos y sobre sellado de emergencia probado.

#### 3.2 Script, configuración y programación

Script: [`scripts/backup-restic.sh`](../scripts/backup-restic.sh). El proceso usa `mysqldump --single-transaction`, comprime el dump temporal, valida gzip, calcula SHA-256, crea snapshot Restic y aplica `keep-daily 7`, `keep-weekly 4`, `keep-monthly 12`. `RESTIC_OFFSITE_REPOSITORY` activa `restic copy` al repositorio remoto. Restic cifra antes de persistir el contenido.

Instalar dependencias (`restic`, cliente compatible `mysqldump`, `gzip`, `sha256sum`) y crear secretos en archivos protegidos:

```bash
sudo install -d -o root -g root -m 0700 /etc/neodomus /var/backups/neodomus /var/tmp/neodomus-backup
sudo sh -c 'printf %s "CHANGE_ME_IN_PROD" > /etc/neodomus/restic-password'
sudo chmod 600 /etc/neodomus/*
sudo install -o root -g root -m 0750 scripts/backup-restic.sh /usr/local/sbin/neodomus-backup-restic
```

Reemplazar los placeholders a través del gestor de secretos; no usar `echo` con valores reales en historiales. Exportar las variables en un archivo `/etc/neodomus/backup.env` modo 0600, por ejemplo:

```dotenv
RESTIC_PASSWORD_FILE=/etc/neodomus/restic-password
RESTIC_REPOSITORY=/var/backups/neodomus
RESTIC_OFFSITE_REPOSITORY=s3:https://s3.<REGION>.amazonaws.com/<BUCKET>/<PREFIX>
AWS_ACCESS_KEY_ID=CHANGE_ME_IN_PROD
AWS_SECRET_ACCESS_KEY=CHANGE_ME_IN_PROD
MYSQL_DUMP_MODE=docker
MYSQL_DOCKER_CONTAINER=neodomus-prod-db-1
BACKUP_INCLUDE_MINIO_VOLUME=true
API_DOCKER_CONTAINER=neodomus-prod-api-1
MINIO_DOCKER_CONTAINER=neodomus-prod-minio-1
BACKUP_SOURCE_DIR=/opt/neodomus
BACKUP_WORK_DIR=/var/tmp/neodomus-backup
BACKUP_EXTRA_PATHS=
```

El modo predeterminado usa `docker exec` para volcar la BD con `neodomus_backup` y copia el volumen MinIO nombrado sin exponer MySQL. Para una vista consistente entre DB y objetos, el script detiene brevemente API y MinIO, copia `/data`, crea un manifiesto SHA-256 de objetos y los reanuda antes de subir el snapshot. Programar ventana de mantenimiento, medir duración y disponer de espacio cifrado en `BACKUP_WORK_DIR` suficiente para una copia adicional completa de MinIO. Si falla el proceso, una trampa intenta reanudar los servicios y el backup falla. `BACKUP_SOURCE_DIR` no debe incluir `.env` ni llaves privadas; `BACKUP_EXTRA_PATHS` admite rutas separadas por `:`.

Inicializar los repositorios una sola vez, después de custodiar la contraseña definitiva. Como root y leyendo la configuración protegida:

```bash
set -a; . /etc/neodomus/backup.env; set +a
restic -r "$RESTIC_REPOSITORY" init
RESTIC_REPOSITORY="$RESTIC_OFFSITE_REPOSITORY" restic init
restic snapshots
RESTIC_REPOSITORY="$RESTIC_OFFSITE_REPOSITORY" restic snapshots
```

No repetir `restic init` ni cambiar la contraseña sin ejecutar el procedimiento de rotación y probar la custodia de la nueva clave.

Cron diario 02:15, ejecutado como root, con salida a syslog y alerta externa ante código distinto de cero o snapshot con más de 26 horas:

```cron
15 2 * * * root . /etc/neodomus/backup.env; export RESTIC_REPOSITORY RESTIC_OFFSITE_REPOSITORY AWS_ACCESS_KEY_ID AWS_SECRET_ACCESS_KEY RESTIC_PASSWORD_FILE MYSQL_DUMP_MODE MYSQL_DOCKER_CONTAINER BACKUP_INCLUDE_MINIO_VOLUME API_DOCKER_CONTAINER MINIO_DOCKER_CONTAINER BACKUP_SOURCE_DIR BACKUP_WORK_DIR BACKUP_EXTRA_PATHS; /usr/local/sbin/neodomus-backup-restic >> /var/log/neodomus-backup.log 2>&1
```

El log debe tener rotación y permisos 0640. Verificar diariamente estado/edad de snapshot y trimestralmente ejecutar `restic check` y una restauración aislada. Si se desea separar secretos del entorno, usar un wrapper que lea el gestor de secretos; no registrar entorno en diagnósticos.

#### 3.3 Comprobación SHA-256

El script produce SHA-256 del dump comprimido durante la ejecución y lo incorpora al snapshot. Para evidencia externa, exportar el dump solo a un directorio temporal cifrado y controlado durante el simulacro, recalcular `sha256sum` antes de copiar/importar y comparar con el valor registrado; eliminarlo al cerrar el simulacro. La comprobación adicional de Restic es `restic check --read-data-subset=10%` periódica y `restic check --read-data` durante la prueba de desastre (tiempo/costo planificado). SHA-256 valida igualdad del artefacto, no reemplaza la verificación de aplicación ni el cifrado.

#### 3.4 Restauración en servidor limpio

1. Abrir incidente, declarar hora de desastre y responsable de recuperación. Aprovisionar Ubuntu parcheado con disco cifrado, Docker/Compose y acceso fuera de banda. Aplicar reglas de firewall de §7.3.
2. La persona que restaura debe ser distinta del operador que generó el respaldo. Recuperar del gestor de secretos la contraseña Restic y credenciales de solo lectura del remoto mediante doble control. Montar/inicializar repositorio local si hay copia local; de lo contrario apuntar `RESTIC_REPOSITORY` al remoto.
3. Ejecutar `restic snapshots`; elegir snapshot más reciente cuyo timestamp sea anterior al evento. Ejecutar `restic check --read-data` si la ventana lo permite.
4. Restaurar a un directorio aislado: `restic restore <ID> --target /restore/neodomus`. No sobrescribir el host ni la única copia original.
5. Localizar el dump con `find /restore/neodomus -type f -name 'neodomus.sql.gz' -print`; verificar su sidecar `.sha256` y comparar con la huella registrada fuera del repositorio. Revisar `gzip -t <RUTA_DUMP>` antes de importarlo.
6. Desplegar MySQL en red privada, crear base vacía y roles/cuentas con secretos recién rotados. Importar: `gzip -dc <RUTA_DUMP> | mysql --host=<DB_PRIVADA> --user=<RESTORE_USER> -p neodomus`. No colocar contraseña en línea de comandos.
7. Localizar los datos MinIO con `find /restore/neodomus -type d -name minio-data -print`; localizar al lado `minio-data.sha256` y verificar con `(cd <RUTA_MINIO_DATA> && sha256sum -c ../minio-data.sha256)`. Con MinIO nuevo detenido y su volumen montado, copiar datos con `docker cp <RUTA_MINIO_DATA>/. neodomus-prod-minio-1:/data/`, iniciar MinIO y validar salud, conteo de objetos y descarga representativa antes de habilitar API.
8. Desplegar versión de aplicación compatible con backup, verificar `alembic current` sin aplicar migraciones hasta aprobación, y realizar smoke checks de salud, login y consultas representativas.
9. Mantener el destino aislado hasta aprobar conciliación y controles de seguridad. Cambiar DNS/tráfico mediante cambio autorizado. Conservar origen y evidencia según política de incidentes.

#### 3.5 Evaluación RPO/RTO

| Métrica | Meta Semana 2 | Cálculo del simulacro | Criterio |
|---|---:|---|---|
| RPO | ≤ 24 h | Hora del incidente menos hora del último snapshot válido | Cumple si delta ≤ 24 h; registrar pérdida real observada |
| RTO | ≤ 4 h | Hora de servicio básico verificado menos inicio de recuperación | Cumple si delta ≤ 4 h; incluir provisión, descarga, importación y validación |

No declarar cumplimiento sin simulacro medido. Si falla: documentar causa, volumen, tiempos por etapa, responsable y plan correctivo; ajustar capacidad, frecuencia o meta formalmente.

#### 3.6 Retención y operación

Restic aplica 7 diarios, 4 semanales y 12 mensuales y elimina snapshots obsoletos tras copiar al remoto. Verificar que el remoto recibió todos los snapshots antes de podar localmente. Restringir borrado/expiración del bucket; alertar por job fallido, falta de espacio y snapshot >26 h. Trimestralmente, recuperar una muestra de objetos y base en ambiente aislado y actualizar evidencia.

#### 3.7 Bitácora de evidencia de desastre

Completar durante un ejercicio real, adjuntando logs redactados de secretos y datos personales:

| Campo | Registro |
|---|---|
| Fecha / operador de backup / restaurador independiente / aprobador | PENDIENTE DE SIMULACRO |
| ID snapshot y timestamp UTC | PENDIENTE |
| SHA-256 origen / restaurado / coincidencia | PENDIENTE |
| Estado `restic check` / gzip / conteos | PENDIENTE |
| RPO medido / meta / resultado | PENDIENTE |
| RTO medido / meta / resultado | PENDIENTE |
| Incidencias, aprobador y acciones | PENDIENTE |

### 7. Seguridad, Usuarios y Permisos

#### 7.1 Identidades Linux y grupos

La matriz de referencia: `sysadmin` administra servicios seleccionados; `deployer` realiza despliegues aprobados; `appuser` ejecuta la aplicación sin login interactivo en producción; `sysdevs` accede a logs de API. Una persona por cuenta, llaves SSH individuales y membresía revisada trimestralmente. No compartir cuentas ni añadir al grupo `docker` (equivale a root).

[`deploy/security/provision-users.sh`](../deploy/security/provision-users.sh) crea los grupos y el usuario de servicio `appuser` (shell `nologin`) y aplica sudoers. Para personas, crear una identidad por integrante —no una cuenta compartida— con [`deploy/security/add-team-member.sh`](../deploy/security/add-team-member.sh): `sudo bash deploy/security/add-team-member.sh <usuario_individual> <sysadmin|deployer|sysdevs> <llave_ed25519.pub>`. Confirmar el fingerprint con la persona por un canal independiente. Nunca instalar llaves privadas en el servidor.

#### 7.2 Sudo de mínimo privilegio

[`deploy/security/sudoers.d/neodomus`](../deploy/security/sudoers.d/neodomus) limita sudo a comandos concretos de systemd/journalctl. Instalar en `/etc/sudoers.d/neodomus`, propietario `root:root`, modo `0440`, validar con `visudo -cf`. Los comodines `neodomus*` se limitan a unidades nombradas y deben revisarse si se añaden servicios. No conceder `NOPASSWD`, shell, editor, intérprete ni comodines de argumentos.

#### 7.3 SSH y firewall

Instalar [`deploy/security/sshd_config.d/60-neodomus.conf`](../deploy/security/sshd_config.d/60-neodomus.conf) en `/etc/ssh/sshd_config.d/`, validar `sshd -t`, probar sesión nueva con llave Ed25519 y luego recargar `systemctl reload ssh`. Antes de activarlo, incorporar la cuenta administrativa existente a uno de los grupos permitidos; mantener sesión actual y acceso fuera de banda hasta verificar. Desactiva root remoto y autenticación por contraseña; solo llaves públicas Ed25519. Para SFTP, verificar primero la huella del host por canal independiente y conectar con `sftp -i <RUTA_LLAVE_PRIVADA_LOCAL> <usuario_individual>@<HOST>`; la llave privada permanece en el equipo del integrante.

Aplicar [`deploy/security/ufw-neodomus.sh`](../deploy/security/ufw-neodomus.sh) desde consola o tras confirmar SSH operativo, definiendo `SSH_ADMIN_CIDR` a la VPN/red administrativa autorizada: política entrante deny, saliente allow, permitir SSH solo desde ese CIDR, 80/443 y denegar 5432/3306/3307. UFW en Ubuntu no controla necesariamente puertos publicados directamente por Docker; por ello producción no publica DB, y el firewall del proveedor/VPC debe bloquear también acceso público. Usar TLS por 443 y permitir 80 solo para redirección/ACME.

#### 7.4 Roles y separación de BD

Scripts [`deploy/scripts/01_init_db_roles.sql`](../deploy/scripts/01_init_db_roles.sql) y [`deploy/scripts/02_create_db_users.sh`](../deploy/scripts/02_create_db_users.sh), ejecutados automáticamente al inicializar un volumen MySQL vacío en producción, crean roles y cuentas independientes:

| Rol | Uso | Permisos |
|---|---|---|
| `neodomus_owner` | Alembic/migraciones por identidad separada | `ALL` en esquema `neodomus` (DDL/DML) |
| `neodomus_app` | API en runtime | `SELECT, INSERT, UPDATE, DELETE` únicamente |
| `neodomus_read_only` | reportes/auditoría | `SELECT` únicamente |
| Rol `neodomus_backup` (cuenta predeterminada `neodomus_backup_runtime`) | `mysqldump` | `SELECT`, metadatos, `TRIGGER`, `EVENT`, `LOCK TABLES` |

La configuración productiva usa `MYSQL_APP_USER`/`MYSQL_APP_PASSWORD` solo en API, `MYSQL_OWNER_USER`/`MYSQL_OWNER_PASSWORD` solo en la tarea manual `migrate`, y `MYSQL_BACKUP_USER`/`MYSQL_BACKUP_PASSWORD` para los dumps. Las contraseñas deben ser diferentes, generadas con `openssl rand -hex 32` y guardadas en `.env.prod` modo `0600` o en el gestor de secretos. El bootstrap valida formato hexadecimal. MySQL no publica puertos al host.

La API productiva no corre Alembic al arrancar. Después de un respaldo aprobado y antes de liberar una versión, ejecutar `docker compose --env-file .env.prod -f compose.prod.yaml --profile ops run --rm migrate`; solo ese job usa el rol propietario. Luego actualizar `api` y `web`. En bases existentes, los scripts de `/docker-entrypoint-initdb.d` no se repiten automáticamente: respaldar primero, aplicar el SQL de roles como DBA y ejecutar el bootstrap de cuentas manualmente con el entorno nuevo; verificar credenciales, roles y healthcheck antes de continuar. No borrar el volumen para forzar inicialización.

Para una base existente, conservar la credencial root actual al cambiar el archivo de entorno, desplegar primero solo `db`, aplicar `01_init_db_roles.sql` y ejecutar el bootstrap de cuentas dentro del contenedor (el healthcheck puede fallar hasta crear la cuenta app). Confirmar login con las cuentas nuevas; después correr el job `migrate` y levantar API/web. Los scripts de init no modifican ni eliminan datos, pero deben ejecutarse solo tras copia válida. Desde la raíz del repositorio: `docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" mysql -uroot "$MYSQL_DATABASE"' < deploy/scripts/01_init_db_roles.sql` y luego `docker compose --env-file deploy/.env.prod -f deploy/compose.prod.yaml exec db bash /docker-entrypoint-initdb.d/02_create_db_users.sh`.

La prueba repetible [`deploy/scripts/verify_db_app_privileges.sh`](../deploy/scripts/verify_db_app_privileges.sh) crea una tabla temporal aleatoria con owner, verifica `SELECT/INSERT/UPDATE/DELETE` con la cuenta API y confirma que `ALTER` y `DROP` se rechazan por permisos; luego elimina la tabla de prueba. Ejecutar solo contra un entorno aprobado, exportando credenciales desde un gestor seguro. Guardar la salida redactada y fecha en evidencia; no afirmar ejecución hasta que la realice el operador.

#### 7.5 Inventario de secretos y protección de archivos

| Secreto | Ubicación/gestión | Acceso |
|---|---|---|
| `.env` de despliegue / credenciales MySQL, MinIO | `/opt/neodomus/.env` o secret manager; excluido de Git | `root:appuser`, modo `0640` solo si grupo necesita lectura; preferir secretos Docker montados |
| Contraseña Restic | Secret manager + archivo `/etc/neodomus/restic-password` | root, `0600`; copia de emergencia fuera del host |
| Usuario/clave dump MySQL | archivo root-only o secret manager | `0600`, usuario dedicado de respaldo |
| Llaves privadas SSH | agente personal/llavero del operador | nunca copiar al servidor; en host solo `authorized_keys` públicas, `0600` |
| JWT `SECRET_KEY` | gestor de secretos/archivo de despliegue | restringido al servicio API; no Git/logs |
| API keys SMTP/OAuth/pagos | secret manager y proveedor emisor | scopes mínimos; inventario de propietario y vencimiento |

Para instalación manual requerida: `chown root:root /opt/neodomus/.env && chmod 600 /opt/neodomus/.env`. Si el contenedor requiere lectura, montar el secreto con UID/GID dedicados en vez de relajar permisos globales. Verificar `.gitignore`, no imprimir `env`, `docker inspect` ni valores de secrets en logs/tickets.

#### 7.6 Revocación y rotación tras salida de miembro

1. Registrar hora de revocación y custodio; retirar inmediatamente acceso SSO/VPN, llaves autorizadas, sesiones y tokens personales. Deshabilitar cuenta Linux (`usermod -L`, `passwd -l`), retirar grupos y revocar claves en `authorized_keys`; revisar `sudo` y auditoría.
2. Identificar secretos a los que tuvo acceso: DB, JWT, MinIO/S3, SMTP/OAuth, proveedor de pagos, CI/CD, backup remoto y certificados/API keys. Abrir inventario de propietarios/consumidores y priorizar exposición externa.
3. Crear secretos nuevos en el gestor, actualizar consumidores y reiniciar/recargar por etapas. Para DB crear credencial nueva y probar salud; revocar anterior tras confirmar API/jobs/migraciones. No reutilizar contraseñas.
4. JWT: generar nueva `SECRET_KEY`; programar invalidación de sesiones/tokens existentes (impacto: reautenticación) y desplegar en todos los workers coordinadamente. Revocar refresh tokens si existe almacén. Rotar API keys en el proveedor, actualizar CI y probar integración con permisos mínimos.
5. Rotar credenciales del bucket/Restic sin perder capacidad de descifrado: confirmar acceso con credencial nueva y conservar la contraseña de cifrado Restic según política de custodia, pues cambiarla requiere `restic key` y copias recuperables. Revocar IAM anterior y auditar accesos.
6. Invalidar sesiones SSH activas del usuario, revisar `last`, `journalctl`, registros de autenticación y cambios recientes. Si hubo sospecha de exfiltración, preservar evidencia y considerar comprometidos los secretos visibles.
7. Verificar funcionalidades, respaldo nuevo y acceso de emergencia; actualizar fecha/propietario del inventario, registrar aprobador y cerrar la revocación. Objetivo operativo: acceso humano revocado inmediatamente; credenciales compartidas rotadas el mismo día o antes si hay sospecha.

### Referencias de implementación

- Usuarios: [`deploy/security/provision-users.sh`](../deploy/security/provision-users.sh)
- SSH: [`deploy/security/sshd_config.d/60-neodomus.conf`](../deploy/security/sshd_config.d/60-neodomus.conf)
- Sudoers: [`deploy/security/sudoers.d/neodomus`](../deploy/security/sudoers.d/neodomus)
- Firewall: [`deploy/security/ufw-neodomus.sh`](../deploy/security/ufw-neodomus.sh)
- Roles MySQL: [`deploy/scripts/01_init_db_roles.sql`](../deploy/scripts/01_init_db_roles.sql)
- Respaldo cifrado: [`scripts/backup-restic.sh`](../scripts/backup-restic.sh)
- Prueba de mínimo privilegio MySQL: [`deploy/scripts/verify_db_app_privileges.sh`](../deploy/scripts/verify_db_app_privileges.sh)
- Alta de llave individual: [`deploy/security/add-team-member.sh`](../deploy/security/add-team-member.sh)

#### 7.7 Evidencia operativa requerida para aceptar

| Control | Evidencia que se debe adjuntar | Estado de este artefacto |
|---|---|---|
| Cuentas individuales | Lista de usuarios sin datos personales innecesarios, grupos y huellas de llaves públicas confirmadas | Pendiente de aplicar en el host |
| Acceso SSH | Salida redactada de `sshd -T` mostrando root/password deshabilitados; prueba positiva con llave y negativa de password | Pendiente de aplicar y probar |
| Firewall | `ufw status numbered` y revisión de firewall del proveedor desde una red externa | Pendiente de aplicar y probar |
| Privilegios MySQL | Salida de `verify_db_app_privileges.sh` con DML aprobado y `ALTER`/`DROP` denegados | Script preparado; ejecución pendiente |
| Restauración independiente | Persona distinta del operador de backup, servidor limpio, ID snapshot, SHA-256, conteos, RPO/RTO y smoke test | Pendiente de simulacro |

La configuración del repositorio no puede demostrar la instalación de llaves, el filtrado efectivo del host ni una restauración por otra persona. La aceptación final requiere completar estas evidencias en el servidor real; no registrar secretos, llaves privadas ni datos personales en los artefactos.

## 8. CI/CD, despliegue, rollback y monitoreo — Semana 7

### 8.1 Integración continua

El workflow existente `.github/workflows/tests.yml` conserva sus jobs de frontend, backend con MySQL/MinIO efímeros y E2E. Ahora se ejecuta en cada push a ramas y en PR hacia `development`, `master` y `main`; los tags los atiende el workflow de liberación. Los jobs continúan usando credenciales efímeras de prueba, sin secretos de producción. El resultado verificable es el run de GitHub Actions para el SHA correspondiente; la modificación local de triggers no equivale a una ejecución aprobada.

### 8.2 Protección de `main`

La protección debe configurarse en GitHub (Settings → Rules → Rulesets, o Branch protection rules) para `main`: requerir PR, el número de aprobaciones definido por el equipo, resolver conversaciones y exigir los checks de los jobs obligatorios de `Neodomus Tests` y `Trivy filesystem scan`. Activar bloqueo de force-push y borrado. La protección remota no puede activarse desde este repositorio y queda **pendiente de configuración y verificación**. No fusionar una liberación con checks fallidos.

### 8.3 Imágenes versionadas GHCR

`.github/workflows/release.yml` publica las imágenes de API y web ante un tag `vX.Y.Z`, y exige que el tag apunte a un commit integrado en `main` con una ejecución exitosa de `Neodomus Tests`. Publica tags de versión sin `v` y SHA; usa Buildx y caché de GitHub Actions. Solo el workflow escribe en `packages`; no publica desde PR. El workflow aún requiere una ejecución real para confirmar permisos de paquete, compilación, pruebas asociadas y disponibilidad de ambas imágenes. Configurar acceso de lectura del servicio que las consuma por separado.

### 8.4 Railway y despliegue de servidor

Se conserva Railway como proveedor seleccionado, según la decisión del usuario. El documento registra una liberación histórica en Railway; el plan de Semana 5 aclara que MinIO en la nube quedó sin verificar. El entorno versionado usa MySQL 8.0 y MinIO en Compose; la API aplica Alembic y el servicio web usa Nginx propio. No se cambia arbitrariamente la arquitectura ni se realiza un despliegue real desde este checkout. Antes de declarar el despliegue actual cumplido, verificar en Railway la base de datos MySQL, MinIO/almacenamiento, red privada, secretos, healthcheck y la versión activa. Railway acepta imágenes de GHCR; las privadas requieren plan Pro y credenciales de registry de solo lectura configuradas en Railway. Esta conexión es manual y aún no está verificada.

El archivo `deploy/compose.prod.yaml` separa el job `migrate` del servicio API y conserva volúmenes `mysql_data` y `minio_data`. No ejecutar `docker compose down -v`, no borrar volúmenes y no aplicar migraciones destructivas automáticamente. Las imágenes GHCR están preparadas para publicar, pero el Compose productivo actual todavía construye imágenes locales etiquetadas `1.0.0`; el consumo de GHCR requiere un cambio revisado y probado en un entorno aislado. Por ello el despliegue continuo queda pendiente. No existe endpoint de versión en la API; el monitoreo de versión debe hacerse desde los metadatos/tag de imagen o panel del proveedor hasta que se diseñe un mecanismo que no exponga información interna.

### 8.5 Rollback

Para rollback del despliegue Compose, usar la imagen anterior ya disponible, conservar base de datos y volúmenes, verificar compatibilidad del esquema y seguir la reversión de la sección 5.2. No reconstruir una versión anterior ni bajar migraciones automáticamente. En Railway, seleccionar la última versión desplegada conocida en el panel y aplicar su mecanismo de rollback tras validar la compatibilidad del esquema; ensayar primero en staging. No se ejecutó reversión en esta entrega. Render queda fuera de alcance porque se conserva Railway.

### 8.6 Monitoreo Uptime Kuma

`deploy/compose.uptime-kuma.yaml` ofrece Uptime Kuma con volumen persistente y puerto de administración enlazado a loopback. Su etiqueta de imagen inicial es flotante: antes de desplegar, fijar una versión parche y digest aprobados. Desplegarlo en **otro host** distinto al que monitorea, con firewall y acceso administrativo mediante proxy autenticado o túnel SSH. Desde su interfaz, crear monitores HTTP para `/health`, `/health/readiness` y la versión desplegada (si el despliegue expone un endpoint de versión), junto con el canal de alertas elegido. La configuración de monitores/canal requiere operación manual y no se afirma que esté activa.

Para el monitor Push de respaldos, configurar `BACKUP_HEARTBEAT_URL` como secreto en el entorno del job `scripts/backup-restic.sh`. El script notifica solo tras `restic backup`, retención y copia off-site opcional exitosos; requiere `curl`. Configurar en Kuma un plazo acorde al calendario de respaldo, y probar un job exitoso y otro fallido en laboratorio. Un contenedor activo no demuestra que exista una copia válida. Aplicar [RB-01](runbooks/RB-01-api-no-disponible.md) para API caída y [RB-02](runbooks/RB-02-respaldo-atrasado.md) para heartbeat vencido.

### 8.7 GitLab CI

**No aplica por ahora:** GitHub Actions es el pipeline configurado. Mantener un segundo pipeline productivo en GitLab duplicaría liberaciones y credenciales. Si el programa formativo exige el anexo, trasladar los mismos jobs y reglas a `.gitlab-ci.yml` de forma mutuamente excluyente y con variables protegidas; no activar ambos despliegues.

## 9. Mantenimiento, soporte y capacitación — Semana 8

### 9.1 Dependencias y vulnerabilidades

`.github/dependabot.yml` configura revisiones semanales para GitHub Actions, Python (`be`), web (`fe`) y móvil (`movil`), con límites de PR y agrupación de actualizaciones menores/parches. Ninguna actualización se acepta automáticamente: debe pasar CI y revisión. `.github/workflows/security.yml` escanea dependencias y configuración con Trivy en push/PR, bloqueando hallazgos HIGH y CRITICAL (incluye hallazgos sin fix disponible) hasta su revisión y corrección o excepción documentada. La publicación en GHCR exige una ejecución exitosa de ese workflow en `main`; el escaneo no demuestra que el proyecto esté libre de vulnerabilidades y sus resultados reales aún deben revisarse.

### 9.2 Mantenimiento del servidor

Calendario mínimo propuesto, a aprobar por el responsable: semanal revisar jobs de respaldo, alertas y espacio; mensual revisar parches de seguridad, imágenes, certificados, usuarios y componentes fuera de soporte; trimestral ensayar restauración y revisar capacidad/RPO/RTO. Aplicar actualizaciones primero en staging, programar reinicios con ventana aprobada y conservar registro de versiones y resultado. No ejecutar limpieza que borre volúmenes Docker. La automatización de parches y política de reinicio depende del host y aún no está configurada.

### 9.3 Soporte N0–N3 y capacitación

| Nivel | Atención | Responsable / límite |
|---|---|---|
| N0 | Guía rápida, FAQ y documentación | Autoservicio; no incluye acceso a producción |
| N1 | Recepción, clasificación y reproducción inicial | Responsable de soporte asignado por el equipo; horario y tiempos por acordar |
| N2 | Diagnóstico de aplicación, infraestructura y respaldo | Operador técnico autorizado; escalar incidentes de datos al responsable de datos |
| N3 | Defectos de código, arquitectura o proveedor | Desarrollo/especialistas; depende de disponibilidad y acceso aprobado |

No se promete SLA ni cobertura fuera de horario hasta que el equipo asigne responsables, canal, horario y capacidad. Plan de capacitación sugerido (90 minutos): usuarios (30 min: catálogo, compra simulada y consultas; demostrar tarea sin ayuda), operadores (30 min: estado, alertas y runbooks; resolver una alerta de laboratorio), soporte (30 min: clasificación, evidencia segura y escalamiento). Registrar asistentes, tarea observada, resultado y dudas; no hay capacitación impartida ni evidencia de aprendizaje en este commit.

### 9.4 Formularios y ayudas

Las plantillas `.github/ISSUE_TEMPLATE/bug_report.yml` y `support_request.yml` piden entorno, versión, pasos y evidencia redactada; advierten no remitir secretos ni datos personales. La guía rápida está en [`docs/ayuda/guia-rapida.md`](ayuda/guia-rapida.md) y las preguntas conocidas en [`docs/ayuda/preguntas-frecuentes.md`](ayuda/preguntas-frecuentes.md). Runbooks: [API no disponible](runbooks/RB-01-api-no-disponible.md) y [respaldo atrasado](runbooks/RB-02-respaldo-atrasado.md). Ajustar cualquier instrucción al Compose y host reales antes de ejecutarla.

## 10. Aceptación, simulacro y entrega formal — Semana 9

### 10.1 Casos de aceptación

| ID | Requisito | Precondición y pasos | Resultado esperado | Resultado obtenido / estado / evidencia |
|---|---|---|---|---|
| ACC-01 | Instalación limpia | Host aislado; seguir este plan y la guía Docker | Web, API, MySQL y MinIO saludables | Pendiente de ejecutar; no aprobado hasta registrar evidencia |
| ACC-02 | Restauración e integridad | Copia válida y entorno aislado; restaurar y correr verificador SHA-256 | Huellas y conteos coinciden | Pendiente; sin evidencia en este commit |
| ACC-03 | Smoke test | Stack restaurado y datos de prueba | `scripts/smoke-test.sh` concluye sin fallos | Pendiente de ejecutar; no inventar resultado |
| ACC-04 | CI | Push/PR representativo | Checks requeridos concluyen exitosos | Cambio de trigger preparado; run remoto pendiente |

Se aprueba un caso solo con resultado observado y evidencia fechada; rechazo o falta de evidencia deja el gate no aprobado.

### 10.2 Simulacro de instalación limpia

Ejecutar con una persona de otro equipo en un host aislado y usando únicamente este Plan de Implantación más las referencias que enlaza. Registrar responsable, fecha, versión del plan, SHA del proyecto, tiempo, asistencia recibida (debe ser ninguna para aprobar), desvíos, restauración, manifiesto de hashes, smoke test y correcciones. No restaurar sobre producción. El simulacro no se ha realizado; gate **NO APROBADO / pendiente de evidencia**.

### 10.3 Acta de entrega

**Plantilla para completar tras aceptación:** alcance y SHA entregados: ____; requisitos aceptados y evidencias: ____; instalación limpia/restauración/smoke: ____; pendientes y riesgos: ____; garantía acordada: ____; responsables y canal/horario de soporte: ____; accesos transferidos mediante gestor seguro (sin credenciales en acta): ____; fecha: ____; firma del equipo que entrega: ____; firma de quien recibe: ____. No completar resultados antes de observarlos.

## Matriz de cumplimiento de semanas 7–10

Los estados indican lo que puede sostener este checkout; documentación preparada no equivale a ejecución externa.

| Semana | Requisito | Estado | Archivo o ubicación | Evidencia |
|---|---|---|---|---|
| 07 | CI | PARCIAL | `.github/workflows/tests.yml` | Trigger ampliado; ejecución remota no observada |
| 07 | Protección de main | PENDIENTE | Configuración de reglas GitHub | Requiere configuración manual y verificación |
| 07 | GHCR | PARCIAL | `.github/workflows/release.yml` | Workflow preparado; sin publicación observada |
| 07 | Render | NO APLICA | Sección 8.4 | Se conserva Railway por decisión del usuario |
| 07 | Railway | PARCIAL | Secciones 5.3 y 8.4 | Hay evidencia histórica; verificación del despliegue vigente pendiente |
| 07 | Rollback sin reconstrucción | PARCIAL | Secciones 5.2 y 8.5 | Procedimiento descrito; prueba controlada pendiente |
| 07 | Despliegue con rollback automático | PENDIENTE | `deploy/` | No hay script verificado; no reemplazar despliegue actual |
| 07 | Uptime Kuma | PARCIAL | `deploy/compose.uptime-kuma.yaml`, `scripts/backup-restic.sh` | Compose y heartbeat preparados; monitores no configurados |
| 07 | GitLab CI | NO APLICA | Sección 8.7 | GitHub Actions ya es pipeline activo |
| 08 | Dependabot | PARCIAL | `.github/dependabot.yml` | Archivo preparado; alertas/PR remotos no verificados |
| 08 | Auditoría de vulnerabilidades | PARCIAL | `.github/workflows/security.yml` | Escáner y umbral implementados; resultados del repositorio aún no revisados |
| 08 | Mantenimiento del servidor | PARCIAL | Sección 9.2 | Calendario documentado; host no configurado |
| 08 | Soporte N0-N3 | PARCIAL | Sección 9.3 | Niveles propuestos; responsables y tiempos por acordar |
| 08 | Runbooks | PARCIAL | `docs/runbooks/` | Dos procedimientos preparados; ejecución no observada |
| 08 | Capacitación | PENDIENTE | Sección 9.3 | Plan propuesto; capacitación no impartida |
| 08 | Guía rápida y FAQ | PARCIAL | `docs/ayuda/` | Documentos preparados, no validados por usuarios |
| 09 | Pruebas de aceptación | PARCIAL | Sección 10.1 | Casos definidos; resultados pendientes |
| 09 | Simulacro de instalación limpia | PENDIENTE | Sección 10.2 | No realizado |
| 09 | Restauración y verificación de huellas | PENDIENTE | Sección 10.2 | No hay evidencia del simulacro |
| 09 | Acta de entrega | PARCIAL | Sección 10.3 | Plantilla integrada; entrega/firma pendientes |
| 10 | cloud-init | NO APLICA | Sección 5.10 | Infraestructura objetivo no seleccionada |
| 10 | Ansible idempotente | NO APLICA | Sección 5.10 | Infraestructura objetivo no seleccionada |
| 10 | Ansible Vault | NO APLICA | Sección 5.10 | Sin playbook, secretos no necesarios |
| 10 | OpenTofu, si aplica | NO APLICA | Sección 5.10 | No hay proveedor ni recursos cloud definidos |

## Anexo — Archivos incorporados

- `be/app/config.py`: validación fail-fast de configuración y secretos.
- `be/app/main.py`: readiness que comprueba base de datos y MinIO.
- `deploy/compose.prod.yaml` y `deploy/nginx.conf`: healthchecks, dependencias saludables, reinicio y rotación.
- `scripts/smoke-test.sh`: verificación HTTP y autenticación obligatoria con cuenta de prueba.
- `scripts/verificar-migracion.py`: comparación exacta de conteos y hashes SHA-256.
- Plantillas `.env.example`, `be/.env.example` y `deploy/env.prod.example`: variables declaradas sin secretos reales.
- `.github/dependabot.yml`, workflows de CI, seguridad y liberación, y formularios de soporte.
- `deploy/compose.uptime-kuma.yaml`, `docs/runbooks/` y `docs/ayuda/`.
