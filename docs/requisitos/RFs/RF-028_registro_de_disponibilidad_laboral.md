# RF-028 — Registro de disponibilidad laboral del técnico

<!--
  ¿Qué? El técnico puede configurar sus días y horas de trabajo.
  ¿Para qué? Que el administrador sepa cuándo asignarle servicios.
  ¿Impacto? Optimización de la asignación y respeto por la disponibilidad real.
-->

## Identificación

| Campo         | Valor                                          |
| ------------- | ---------------------------------------------- |
| **ID**        | RF-028                                         |
| **Nombre**    | Registro de disponibilidad laboral del técnico |
| **Módulo**    | Técnico                                        |
| **Prioridad** | Media                                          |
| **Estado**    | Propuesta                                      |
| **Fecha**     | Mayo 2026                                      |

## Descripción

El sistema debe permitir al técnico registrar su disponibilidad laboral (días y horas) para que el administrador asigne servicios solo dentro de esos bloques horarios.

## Entradas

| Campo           | Tipo   | Obligatorio | Descripción                                             |
| --------------- | ------ | ----------- | ------------------------------------------------------- |
| `disponibilidad`| JSON   | Sí          | Objeto con días de la semana y rangos horarios          |

Ejemplo de `disponibilidad`:

```json
{
  "lunes": { "activo": true, "desde": "09:00", "hasta": "18:00" },
  "martes": { "activo": true, "desde": "09:00", "hasta": "18:00" },
  "miercoles": { "activo": true, "desde": "09:00", "hasta": "18:00" },
  "jueves": { "activo": true, "desde": "09:00", "hasta": "18:00" },
  "viernes": { "activo": true, "desde": "09:00", "hasta": "18:00" },
  "sabado": { "activo": false },
  "domingo": { "activo": false }
}
Proceso
El técnico accede a /tech/disponibilidad.

Ve un formulario con 7 filas (días), cada una con toggle activo/inactivo y selectores de hora.

Configura su disponibilidad y guarda.

El backend valida que la hora de inicio sea menor que la hora de fin.

Guarda el JSON en el campo disponibilidad de la tabla tecnicos.

Salidas
Escenario	Código HTTP	Respuesta
Disponibilidad guardada	200	"Disponibilidad actualizada"
Hora inválida	400	"La hora de inicio debe ser anterior a la hora de fin"
Endpoints asociados
Método	Ruta	Auth	Descripción
PUT	/api/v1/tech/disponibilidad	Sí	Guarda la configuración de disponibilidad
GET	/api/v1/tech/disponibilidad	Sí	Obtiene la configuración actual
Reglas de negocio
RN-065: Por defecto, si un técnico nunca configuró su disponibilidad, se asume lunes a viernes de 9 a 18.

RN-066: La disponibilidad se usa en el algoritmo de asignación de servicios (RF-034).