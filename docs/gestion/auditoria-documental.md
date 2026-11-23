# Auditoría documental de NeoDomus

**Fecha de revisión:** 18 de noviembre de 2026

**Alcance:** revisión documental frente al checkout disponible. Se cotejaron los manuales de usuario y técnico, el índice, la arquitectura, las referencias de API y datos, las guías locales, los planes y documentos de auditoría/permisos con manifiestos, configuración, rutas, servicios, modelos y migraciones relevantes.

## Resultado

Los manuales de usuario y técnico fueron revisados y actualizados con datos presentes en el repositorio. Describen capacidades identificadas en código y configuración; no certifican que estén habilitadas o funcionando en un despliegue concreto. La revisión fue estática: no se inició la aplicación, no se accedió a una base de datos o entorno productivo y no se ejecutaron pruebas.

Se actualizaron referencias centrales de stack, autenticación, almacenamiento, pagos, migraciones y devoluciones. Los requisitos e historias conservan carácter normativo: su presencia no demuestra que cada función esté implementada o validada.

## Hechos cotejados

- El repositorio separa backend `be/`, web `fe/` y móvil `movil/`. La API FastAPI registra routers bajo `/api/v1`; OpenAPI se genera desde la aplicación activa.
- Los manifiestos revisados declaran FastAPI 0.163.1 y Python mínimo `>=3.11`; la web declara React 18.3.1 y Vite 5.4.21; móvil declara Expo 58.0.23, Expo Router 58.0.30, React Native 0.88.1 y React 19.3.0. Son versiones de este checkout y pueden cambiar.
- El backend genera tokens y también establece cookies `HttpOnly`; los clientes web y móvil observados envían el token de acceso como `Authorization: Bearer`. La autorización del backend prioriza ese encabezado y admite cookie como alternativa.
- El acceso con Google depende de credenciales y configuración por entorno. Su presencia en el código no confirma que esté habilitado en producción.
- `PAYMENT_PROVIDER` usa `simulator` como valor predeterminado del Compose. Las pantallas o registros de pago no prueban procesamiento financiero real.
- El almacenamiento distingue un bucket público para medios públicos y uno privado para evidencias. Hay rutas de compatibilidad y referencias históricas; no se afirma que todos los objetos heredados hayan sido migrados.
- El archivo de migración más reciente visible es `0066_reparar_refresh_tokens.py`. Esto no demuestra que una base desplegada esté actualizada a esa revisión.
- Las devoluciones contemplan solicitud, revisión administrativa, resolución y operaciones de recogida con técnico. Los detalles exactos por entorno deben consultarse en OpenAPI y en la versión desplegada.
- La matriz de trazabilidad conserva resultados de pruebas con fecha 12/11/2026. Son evidencia histórica; no se volvieron a ejecutar para esta revisión.

## Estado de los manuales

- **Manual de usuario:** organizado por perfiles y acciones; explica cuenta, catálogo, pedidos, citas, devoluciones, pagos simulados y orientación ante incidencias. La disponibilidad puede depender del rol y de la configuración.
- **Manual técnico:** actualizado con arquitectura, versiones declaradas, autenticación, Google, pedidos/pagos, devoluciones, datos, almacenamiento y operación local. Distingue configuración local de producción.
- **Referencias técnicas:** arquitectura, API, esquema, guías de instalación y varios documentos relacionados fueron sincronizados o anotados como históricos cuando correspondía.
- **Diccionario de datos:** continúa siendo heredado y no se cotejó columna por columna con todas las migraciones. No debe tratarse como definición física completa del esquema vigente.
- **Planes, reportes y documentación QA:** algunos conservan cronologías, herramientas y versiones de sus cortes. Deben leerse como registros fechados, no como estado presente, salvo que indiquen una revisión reciente.

## Diferencias y pendientes documentales

1. En `docs/requisitos/restricciones.md`, la restricción normativa sobre OAuth/cookies difiere de la implementación observada. La nota documenta la diferencia sin cambiar la regla ni el software. El equipo debe decidir si revisa el requisito.
2. El diccionario de datos requiere reconciliación detallada entre modelos, migraciones y, si se necesita describir un entorno concreto, el esquema desplegado.
3. La documentación histórica T1 y otros reportes QA describen estados de archivos, dependencias y tareas en su fecha de corte. No son un inventario actual de producción; deben mantenerse identificados como históricos.
4. La documentación no aporta URL productiva confirmada, propietarios de soporte, horarios ni acuerdos de servicio. Estos datos deben proporcionarlos los responsables del entorno.
5. Los documentos de requisitos y planes incluyen estados de avance que no se revalidaron uno a uno durante esta auditoría.
6. La existencia de rutas, pantallas o pruebas no sustituye una comprobación funcional de los flujos ni una validación del despliegue.

## Validación y límites

La comparación se hizo mediante lectura de archivos y control de diferencias documental. No se modificó código, configuración, base de datos, dependencias ni pruebas; no se instalaron paquetes ni se ejecutaron procesos de la aplicación. Esta revisión no certifica seguridad, disponibilidad, cobertura de requisitos, datos productivos ni comportamiento en un entorno desplegado.

## Control de cambios documentales

Esta revisión actualiza los manuales técnico y de usuario y corrige referencias documentales centrales para reflejar el checkout consultado. Los cambios están limitados a `docs/`. La lista definitiva de archivos se confirma con Git al cierre.
