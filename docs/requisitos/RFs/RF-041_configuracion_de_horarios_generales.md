# RF-041 — Configuración de horarios generales de atención

<!--
  ¿Qué? El administrador puede configurar los horarios generales de la plataforma.
  ¿Para qué? Sincronizar la disponibilidad de técnicos y usuarios.
  ¿Impacto? Evita solicitudes fuera del horario laboral.
-->

## Identificación

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| **ID**        | RF-041                                         |
| **Nombre**    | Configuración de horarios generales de atención |
| **Módulo**    | Administrador                                  |
| **Prioridad** | Media                                          |
| **Estado**    | Propuesta                                      |
| **Fecha**     | Mayo 2026                                      |

## Descripción

El sistema debe permitir al administrador configurar los horarios generales de atención de la empresa. Estos horarios determinan las franjas en las que los usuarios pueden solicitar servicios y los técnicos pueden ser asignados.

## Entradas

| Campo           | Tipo   | Obligatorio | Descripción                                             |
| --------------- | ------ | ----------- | ------------------------------------------------------- |
| `horario_semanal` | JSON  | Sí          | Configuración por día de la semana, similar a disponibilidad del técnico |

Ejemplo de `horario_semanal`:

```json
{
  "lunes": { "activo": true, "desde": "08:00", "hasta": "20:00" },
  "martes": { "activo": true, "desde": "08:00", "hasta": "20:00" },
  "miercoles": { "activo": true, "desde": "08:00", "hasta": "20:00" },
  "jueves": { "activo": true, "desde": "08:00", "hasta": "20:00" },
  "viernes": { "activo": true, "desde": "08:00", "hasta": "20:00" },
  "sabado": { "activo": true, "desde": "09:00", "hasta": "14:00" },
  "domingo": { "activo": false }
}
Proceso
El administrador accede a /admin/configuracion/horarios.

Visualiza un formulario con los 7 días, cada uno con toggle activo/inactivo y selectores de hora.

Modifica la configuración y guarda.

El backend valida que la hora de inicio sea anterior a la hora de fin.

Guarda la configuración en la tabla configuracion (clave horario_general).

A partir de entonces, los endpoints de solicitud de servicio (POST /api/v1/citas) y de consulta de horarios disponibles validan contra esta configuración.

Salidas
Escenario	Código HTTP	Respuesta
Configuración guardada	200	"Horarios generales actualizados"
Horario inválido	400	"La hora de inicio debe ser anterior a la hora de fin"
Endpoints asociados
Método	Ruta	Auth	Descripción
GET	/api/v1/admin/config/horarios	Sí (admin)	Obtiene la configuración actual
PUT	/api/v1/admin/config/horarios	Sí (admin)	Actualiza los horarios generales
Reglas de negocio
RN-095: Los horarios generales son la base; luego la disponibilidad individual de cada técnico (RF-028) puede ser más restrictiva, pero no más amplia.

RN-096: Si no hay configuración, se asume lunes a viernes de 9 a 18.

