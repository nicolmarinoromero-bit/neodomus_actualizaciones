# Guía rápida de NeoDomus

## Iniciar el sistema local

1. Instala Git y Docker Desktop/Engine con Docker Compose.
2. Clona el repositorio y copia `.env.example` a `.env`.
3. Completa los valores locales indicados en el README; no reutilices secretos de producción.
4. Desde la raíz ejecuta `docker compose up --build`.
5. Abre la web en `http://localhost:5173`; la API y su estado están en `http://localhost:8000/docs` y `/health`.

## Usar las funciones principales

Regístrate e inicia sesión desde la web. Explora el catálogo, selecciona productos y variantes, gestiona el carrito y completa compras únicamente con los métodos simulados disponibles en el entorno local. Las cuentas de cliente, técnico y administración tienen áreas diferentes; las funciones dependen del rol autorizado. Para agendar instalaciones o entregas, sigue los formularios de la aplicación y revisa el estado en el panel correspondiente.

La aplicación móvil se inicia desde `movil/` con `pnpm install` y `pnpm start`; configura `EXPO_PUBLIC_API_URL` según el dispositivo en uso. Para instalación detallada y variables, consulta [README](../../README.md), [instalación Docker](../setup/con-docker.md) y [manual de usuario](../manuales/usuario/MANUAL_DE_USUARIO.md).

## Ayuda y reporte

Consulta la [FAQ](preguntas-frecuentes.md). Reporta errores con la plantilla de GitHub e incluye entorno, versión, pasos y evidencia depurada. Nunca adjuntes `.env`, contraseñas, tokens o datos de clientes.
