# Preguntas frecuentes

### ¿La compra procesa pagos reales?

No por defecto. El proyecto configura `PAYMENT_PROVIDER=simulator`; se trata de un simulador académico.

### ¿Qué hago si la API no responde?

Comprueba que Docker Compose haya iniciado `db`, `minio` y `api`, revisa `http://localhost:8000/health`, y consulta [RB-01](../runbooks/RB-01-api-no-disponible.md). No elimines volúmenes para intentar recuperarla.

### ¿Dónde veo la documentación de API?

Con el backend disponible, abre `http://localhost:8000/docs` (Swagger UI) o `http://localhost:8000/redoc`.

### ¿Cómo configuro una instalación local?

Usa `.env.example` como plantilla y sigue [Instalación con Docker](../setup/con-docker.md). Cada entorno debe tener valores propios.

### ¿Puedo compartir capturas o logs al pedir soporte?

Sí, tras quitar tokens, direcciones privadas, datos personales y cualquier valor de configuración sensible.
