# Manual de usuario de NeoDomus

**Sistema:** Neodomus — gestión y automatización del hogar inteligente
**Versión documental:** 2.1
**Revisión:** 18 de noviembre de 2026
**Dirigido a:** visitantes, clientes, técnicos y administradores

## Propósito y alcance

Este manual explica cómo orientarse y realizar las acciones principales que aparecen en la aplicación web y móvil. Está organizado por perfil y se basa en las pantallas y rutas del repositorio revisado. La dirección de acceso, la disponibilidad de cada función y los textos de los controles pueden variar según la instalación.

El manual no certifica una URL pública ni una instalación específica. Quien administra el entorno debe entregar la dirección, las instrucciones de acceso y el canal de soporte. Los pagos están configurados por defecto en modo simulador y no representan un cobro bancario real.

## Contenido

1. [Qué ofrece NeoDomus](#qué-ofrece-neodomus)
2. [Conocimientos necesarios](#conocimientos-necesarios)
3. [Equipo y software](#equipo-y-software)
4. [Seguridad y cuidado de la cuenta](#seguridad-y-cuidado-de-la-cuenta)
5. [Ingresar y administrar la cuenta](#ingresar-y-administrar-la-cuenta)
6. [Navegación por perfil](#navegación-por-perfil)
7. [Funciones principales](#funciones-principales)
8. [Ayuda y reporte de situaciones](#ayuda-y-reporte-de-situaciones)
9. [Mensajes y orientación ante errores](#mensajes-y-orientación-ante-errores)
10. [Glosario](#glosario)
11. [Control del documento](#control-del-documento)

## Qué ofrece NeoDomus

NeoDomus reúne un catálogo de productos de domótica y funciones para gestionar pedidos, citas y trabajo técnico. La web presenta áreas públicas y paneles para clientes, técnicos y administradores. La aplicación móvil incluye navegación para clientes y técnicos.

| Perfil | Acciones principales identificadas |
|---|---|
| Visitante | Consultar el inicio, catálogo y detalles; usar el carrito; leer información, ayuda y páginas legales; registrarse e iniciar sesión. |
| Cliente | Consultar pedidos, perfil, citas, técnicos, novedades y devoluciones relacionadas con sus pedidos; acceder a facturas y otras secciones disponibles. |
| Técnico | Consultar actividades asignadas, citas, entregas y recogidas; registrar evidencias y revisar historial y otras secciones de su perfil. |
| Administrador | Gestionar productos, técnicos, instalaciones, pedidos, facturas, consultas, devoluciones, novedades, clientes, proveedores, reportes y notificaciones. |

La disponibilidad de una acción depende de la cuenta, el rol, el estado del registro y la configuración del entorno.

## Conocimientos necesarios

No se requiere saber programar. Es útil saber abrir una página o aplicación, completar formularios, usar el correo electrónico y seguir las indicaciones que aparecen en pantalla. Para reportar una situación, identifica la sección y la acción que estabas realizando.

Los técnicos pueden necesitar tomar una fotografía como evidencia de una actividad. Los administradores deben operar únicamente los módulos y registros para los que tengan autorización.

## Equipo y software

- Para la web: un dispositivo capaz de abrir un navegador actual y conectarse a la dirección del entorno.
- Para móvil: un teléfono compatible con la aplicación distribuida por el equipo y con conexión al servidor.
- El repositorio no establece requisitos oficiales de memoria, procesador, resolución ni una lista de versiones de navegador compatibles.
- El equipo administrador debe proporcionar la dirección web o el medio de instalación móvil. No adivines la dirección ni instales una copia no confirmada.

## Seguridad y cuidado de la cuenta

- Mantén tu contraseña privada y usa una contraseña que no compartas con otras cuentas.
- No entregues códigos de verificación, enlaces de recuperación, cookies ni información de sesión a otra persona.
- Cierra la sesión al terminar, en especial cuando compartas el dispositivo.
- Confirma que accedes desde la dirección entregada por el responsable del entorno.
- Adjunta solo las fotografías necesarias para describir el trabajo; evita mostrar información personal ajena al servicio.
- No envíes contraseñas ni datos de pago en un reporte de soporte.

El sistema incorpora autenticación y controles según el rol. Las medidas de cuidado de este apartado son recomendaciones para la persona usuaria y no significan que cada una sea comprobada automáticamente por la aplicación. No se encontró una política institucional de seguridad aprobada dentro de la documentación revisada.

## Ingresar y administrar la cuenta

### Abrir NeoDomus

1. Solicita al responsable la dirección web o las instrucciones de instalación móvil.
2. Abre NeoDomus y localiza la opción de acceso a la cuenta.
3. Escribe el correo y la contraseña registrados y selecciona **Iniciar sesión**.
4. Si el acceso se completa, la aplicación muestra las secciones permitidas para tu perfil.

Las rutas de acceso observadas en la web incluyen `/login` y `/register`. La dirección local de desarrollo se documenta en la [guía de instalación con Docker](../../setup/con-docker.md); no es una dirección de producción.

### Crear una cuenta de cliente

1. Desde la página de acceso, abre **Registro**.
2. Completa los campos que muestre el formulario y envía la solicitud.
3. Si la instalación solicita verificación, abre el mensaje enviado al correo y sigue sus instrucciones.
4. Completa la información adicional que la pantalla solicite antes de continuar.
5. Inicia sesión cuando la cuenta y el correo estén habilitados.

El envío del correo depende del proveedor configurado en el entorno. Si no recibes el mensaje, revisa la carpeta de correo no deseado y consulta al responsable del sistema.

### Iniciar sesión con Google

Si aparece la opción de Google, selecciónala y sigue el flujo de Google Identity. El acceso depende de la configuración del entorno y de que Google confirme el correo de la cuenta. Si la opción no aparece, usa el acceso por correo y contraseña o consulta al responsable.

### Recuperar o cambiar la contraseña

1. En la página de acceso, selecciona la opción para recuperar la contraseña.
2. Escribe el correo asociado con la cuenta y solicita el código.
3. Revisa tu correo, incluido correo no deseado, y escribe el código en la aplicación.
4. Define y confirma la nueva contraseña siguiendo las indicaciones.
5. Regresa al acceso e inicia sesión con la contraseña actualizada.

Si ya tienes una sesión, puedes cambiar la contraseña desde el perfil cuando la opción esté disponible. Algunas cuentas de empleado pueden requerir el cambio antes de continuar.

### Cerrar sesión

Abre el menú de cuenta y selecciona **Cerrar sesión**. En un dispositivo compartido, cierra también la ventana o aplicación al terminar.

## Navegación por perfil

La web agrupa las rutas por acceso público y por rol. Estas son las áreas principales identificadas en el código; algunos nombres pueden variar en la interfaz.

| Área | Secciones web |
|---|---|
| Pública | Inicio, productos, detalle de producto, carrito, ayuda, información, contacto y páginas legales. |
| Cliente | Perfil, técnicos, citas, novedades y ayuda; el checkout requiere una cuenta de cliente. |
| Técnico | Panel, citas, historial, clientes, mensajes, calificaciones, entregas, devoluciones y novedades. |
| Administrador | Panel, notificaciones, productos, catálogo, técnicos, instalaciones, pedidos, facturas, consultas, devoluciones, novedades, clientes, proveedores y reportes. |

En móvil, las pantallas se organizan por navegación de cliente y de técnico. La aplicación móvil no muestra un panel administrativo equivalente al de la web.

## Funciones principales

### Consultar productos

1. Abre **Productos** o el catálogo desde el inicio.
2. Selecciona un artículo para ver su detalle.
3. Revisa la información y las variantes disponibles.
4. Si deseas continuar, usa la acción para añadirlo al carrito.

La disponibilidad mostrada depende del inventario y de la respuesta del entorno.

### Revisar el carrito y realizar una compra

1. Abre **Carrito** y revisa los artículos y cantidades.
2. Ajusta las cantidades o elimina artículos según las opciones disponibles.
3. Continúa al checkout e inicia sesión como cliente si la aplicación lo solicita.
4. Completa los datos que aparezcan y revisa el resumen antes de confirmar.
5. Consulta después el pedido desde el perfil o la sección de pedidos.

El modo predeterminado de pagos es un simulador. Las respuestas de ese modo sirven para probar el flujo y no procesan dinero real.

### Consultar perfil, pedidos y facturas

Abre **Perfil** y selecciona la sección que necesites. En **Pedidos** puedes consultar pedidos y la información relacionada que la interfaz tenga disponible, incluidas devoluciones. Las secciones de facturas, reembolsos, datos personales e idioma pueden aparecer según el cliente y el entorno.

### Solicitar una devolución de un pedido

1. Abre tu perfil y entra en la sección **Pedidos**.
2. Selecciona el pedido y revisa qué productos y cantidades permite devolver.
3. Elige los artículos disponibles, selecciona el motivo y completa los campos que solicite el formulario.
4. Envía la solicitud y consulta su estado en la misma sección.

La opción depende de la elegibilidad del pedido y de sus cantidades disponibles. La solicitud pasa a revisión administrativa. El administrador puede aprobarla con resolución de reembolso o cambio, o rechazarla indicando el motivo. Si se requiere una recogida, se asigna a un técnico; el técnico registra la recogida y la evidencia desde su sección de devoluciones. Los estados visibles pueden incluir revisión, aprobación o rechazo, producto en devolución, recibido y reembolso procesado.

La resolución de reembolso queda registrada en NeoDomus. En el modo de pago simulado no significa que el dinero se haya devuelto por una entidad financiera.

### Consultar y gestionar citas

Como cliente, abre **Citas** para consultar o crear una solicitud con la información que requiera la pantalla. Como técnico, abre **Citas** para revisar las actividades asignadas y las acciones que estén habilitadas. Si una cita no aparece o requiere atención administrativa, registra el número o la fecha de la cita para el reporte.

### Registrar trabajo como técnico

1. Inicia sesión con la cuenta de técnico.
2. Abre el panel y revisa las citas, entregas o recogidas asignadas.
3. Selecciona el registro para consultar sus detalles.
4. Usa las acciones disponibles para actualizarlo y adjunta evidencia cuando se solicite.
5. Consulta el historial para revisar actividades anteriores.

Las evidencias de devolución y de otras tareas se guardan con controles de acceso; no compartas enlaces o imágenes de trabajo fuera del flujo autorizado.

### Operar módulos administrativos

1. Inicia sesión con una cuenta habilitada como administrador.
2. Abre el panel de administración y selecciona el módulo correspondiente.
3. Busca el registro y revisa sus datos antes de realizar una acción.
4. Sigue las indicaciones de la pantalla y confirma el resultado que muestre el sistema.

Las acciones administrativas pueden cambiar el estado de pedidos, cuentas, devoluciones y otros registros. Si no tienes certeza de la operación, consulta al responsable del sistema antes de confirmarla.

## Ayuda y reporte de situaciones

No se encontró en el repositorio un correo, teléfono, horario o persona responsable confirmados para la mesa de ayuda. Solicita el canal al equipo que administra tu instalación.

Al reportar una situación, incluye:

1. Tu perfil (visitante, cliente, técnico o administrador).
2. La sección y la acción que estabas realizando.
3. Fecha y hora aproximadas.
4. Dispositivo y navegador o aplicación móvil.
5. El texto que apareció en pantalla y los pasos previos.
6. Una captura solo si no revela contraseñas, códigos, tokens ni datos personales de otras personas.

No envíes credenciales ni tokens. Si el canal de ayuda aparece dentro del entorno, puedes usarlo según las instrucciones del responsable.

## Mensajes y orientación ante errores

Los textos exactos pueden cambiar entre versiones. Usa primero la orientación general y comunica el mensaje literal al soporte.

| Situación | Qué puedes hacer |
|---|---|
| No puedes iniciar sesión | Revisa el correo escrito, confirma que la cuenta esté verificada y vuelve a intentarlo. Si no recuerdas la contraseña, inicia la recuperación. |
| No llega el código o correo | Revisa correo no deseado y consulta al responsable si el proveedor de correo está habilitado para ese entorno. |
| No aparece el acceso con Google | Usa correo y contraseña o consulta al responsable de la instalación. La opción depende de la configuración de Google. |
| No carga el catálogo, pedido o cita | Comprueba la conexión y vuelve a intentar. Anota la hora y la sección para reportarlo si continúa. |
| No se ve una imagen o evidencia | Vuelve a abrir el registro y reporta qué producto, cita, pedido o devolución está afectado. |
| Una devolución sigue en revisión | Consulta el estado en tu perfil. La revisión y la recogida pueden requerir una acción del administrador o del técnico asignado. |
| El resultado del pago no es el esperado | Recuerda que el modo predeterminado es un simulador y consulta al responsable antes de asumir que hubo un cobro real. |

## Glosario

- **API:** servicio que comunica la aplicación con el sistema que gestiona los datos.
- **Carrito:** lista de productos que preparas antes de enviar un pedido.
- **Checkout:** pantalla donde revisas y confirmas una compra.
- **Evidencia:** fotografía u otro registro solicitado para documentar una tarea.
- **Perfil:** cuenta y secciones asociadas con tu rol.
- **Reembolso:** registro de devolución de dinero asociado a una operación; el simulador no procesa una transferencia financiera.
- **Rol:** tipo de cuenta que determina qué áreas de NeoDomus puedes usar.
- **Técnico:** perfil que atiende actividades de servicio, entrega o recogida asignadas.
- **URL:** dirección web que te proporciona quien administra el entorno.

## Control del documento

| Versión | Fecha | Descripción |
|---|---|---|
| 1.0 | 2026-10-30 | Primera versión de trabajo basada en las rutas y configuración del repositorio. |
| 1.1 | 2026-10-30 | Reorganización de contenidos y referencias. |
| 2.0 | 2026-11-02 | Ampliación según el manual de referencia y sus secciones de uso. |
| 2.1 | 2026-11-18 | Revisión frente a la aplicación actual; actualización de navegación y cobertura de Google, pedidos, devoluciones y operación móvil. |

**Aprobación institucional:** pendiente de confirmación por el equipo del proyecto.
**Documento relacionado:** [Manual técnico](../tecnico/MANUAL_TECNICO.md) · [Índice de documentación](../../README.md).
