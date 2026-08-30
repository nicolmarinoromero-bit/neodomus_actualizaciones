
---

## RF-007_solicitud_de_servicio.md

```markdown
# RF-007 — Solicitud de servicio

<!--
  ¿Qué? Permite al usuario solicitar un servicio con fecha, hora y dirección.
  ¿Para qué? Agendar una atención según su disponibilidad.
  ¿Impacto? Es el núcleo del negocio: convertir interés en cita.
-->

## Identificación

| Campo         | Valor                    |
| ------------- | ------------------------ |
| **ID**        | RF-007                   |
| **Nombre**    | Solicitud de servicio    |
| **Módulo**    | Servicios (Citas)        |
| **Prioridad** | Alta                     |
| **Estado**    | Propuesta                |
| **Fecha**     | Mayo 2026                |

> **Actualización 2026-08:** Anticipación **3h** (no 24h) `citas.py:548`, valida lun-sáb 08-18 `citas.py:501-510`, `slot_tomado` + `tecnico_ocupado`, requiere `TarifaServicio` (`citas.py:562`), estado inicial **Confirmada** `citas.py:602`, pago obligatorio `metodo_pago+datos_pago` `schemas/cita.py:22`, notifica técnico `citas.py:642` y genera factura `citas.py:647`. Endpoint `GET /citas/horas-disponibles` (`citas.py:660`).

## Descripción

El sistema debe permitir al usuario autenticado solicitar un servicio completando un formulario que incluya la selección del servicio, fecha, hora, dirección (puede ser la misma del perfil o una nueva) y comentarios opcionales.

## Entradas

| Campo        | Tipo   | Obligatorio | Validaciones                               |
| ------------ | ------ | ----------- | ------------------------------------------ |
| `servicio_id`| int    | Sí          | Debe existir en `servicios`                |
| `fecha`      | date   | Sí          | ≥ hoy + 24h                                |
| `hora`       | time   | Sí          | Dentro del horario de atención configurado |
| `direccion`  | string | Sí          | Mínimo 5 caracteres                        |
| `comentarios`| string | No          | Máximo 500 caracteres                      |


---

## RF-007_solicitud_de_servicio.md

```markdown
# RF-007 — Solicitud de servicio

<!--
  ¿Qué? Permite al usuario solicitar un servicio con fecha, hora y dirección.
  ¿Para qué? Agendar una atención según su disponibilidad.
  ¿Impacto? Es el núcleo del negocio: convertir interés en cita.
-->

## Identificación

| Campo         | Valor                    |
| ------------- | ------------------------ |
| **ID**        | RF-007                   |
| **Nombre**    | Solicitud de servicio    |
| **Módulo**    | Servicios (Citas)        |
| **Prioridad** | Alta                     |
| **Estado**    | Propuesta                |
| **Fecha**     | Mayo 2026                |

> **Actualización 2026-08:** Anticipación **3h** (no 24h) `citas.py:548`, valida lun-sáb 08-18 `citas.py:501-510`, `slot_tomado` + `tecnico_ocupado`, requiere `TarifaServicio` (`citas.py:562`), estado inicial **Confirmada** `citas.py:602`, pago obligatorio `metodo_pago+datos_pago` `schemas/cita.py:22`, notifica técnico `citas.py:642` y genera factura `citas.py:647`. Endpoint `GET /citas/horas-disponibles` (`citas.py:660`).

## Descripción

El sistema debe permitir al usuario autenticado solicitar un servicio completando un formulario que incluya la selección del servicio, fecha, hora, dirección (puede ser la misma del perfil o una nueva) y comentarios opcionales.

## Entradas

| Campo        | Tipo   | Obligatorio | Validaciones                               |
| ------------ | ------ | ----------- | ------------------------------------------ |
| `servicio_id`| int    | Sí          | Debe existir en `servicios`                |
| `fecha`      | date   | Sí          | ≥ hoy + 24h                                |
| `hora`       | time   | Sí          | Dentro del horario de atención configurado |
| `direccion`  | string | Sí          | Mínimo 5 caracteres                        |
| `comentarios`| string | No          | Máximo 500 caracteres                      |

## Proceso

1. Usuario selecciona un servicio, fecha, hora.
2. El frontend consulta horarios disponibles (`GET /api/v1/citas/horarios-disponibles`).
3. Usuario envía la solicitud.
4. Backend valida:
   - Fecha ≥ hoy + 24h.
   - Hora dentro del rango de atención.
   - Usuario no tiene otra cita en el mismo horario.
5. Crea una cita en estado `pendiente`, con `usuario_id` del autenticado.
6. Registra en `audit_log` la acción.
7. Envía notificación de confirmación (correo + in-app).

## Salidas

| Escenario                     | Código HTTP | Respuesta                              |
| ----------------------------- | ----------- | -------------------------------------- |
| Solicitud exitosa             | 201         | Datos de la cita creada                |
| Fecha inválida (<24h)         | 400         | "La fecha debe ser al menos 24h después" |
| Conflicto de horario          | 400         | "Ya tienes una cita en ese horario"    |
| No autenticado                | 401         | Redirigir a login                      |

## Endpoints asociados

| Método | Ruta                            | Auth | Descripción                                |
| ------ | ------------------------------- | ---- | ------------------------------------------ |
| POST   | `/api/v1/citas`                 | Sí   | Crea una nueva solicitud de servicio      |
| GET    | `/api/v1/citas/horarios-disponibles` | Sí | Consulta horarios libres para una fecha   |

## Reglas de negocio

- **RN-017:** La solicitud comienza con estado `pendiente`; el administrador la confirma o rechaza.
- **RN-018:** No se permite solicitar con menos de 24 horas de anticipación.

1. Usuario selecciona un servicio, fecha, hora.
2. El frontend consulta horarios disponibles (`GET /api/v1/citas/horarios-disponibles`).
3. Usuario envía la solicitud.
4. Backend valida:
   - Fecha ≥ hoy + 24h.
   - Hora dentro del rango de atención.
   - Usuario no tiene otra cita en el mismo horario.
5. Crea una cita en estado `pendiente`, con `usuario_id` del autenticado.
6. Registra en `audit_log` la acción.
7. Envía notificación de confirmación (correo + in-app).

## Salidas

| Escenario                     | Código HTTP | Respuesta                              |
| ----------------------------- | ----------- | -------------------------------------- |
| Solicitud exitosa             | 201         | Datos de la cita creada                |
| Fecha inválida (<24h)         | 400         | "La fecha debe ser al menos 24h después" |
| Conflicto de horario          | 400         | "Ya tienes una cita en ese horario"    |
| No autenticado                | 401         | Redirigir a login                      |

## Endpoints asociados

| Método | Ruta                            | Auth | Descripción                                |
| ------ | ------------------------------- | ---- | ------------------------------------------ |
| POST   | `/api/v1/citas`                 | Sí   | Crea una nueva solicitud de servicio      |
| GET    | `/api/v1/citas/horarios-disponibles` | Sí | Consulta horarios libres para una fecha   |

## Reglas de negocio

- **RN-017:** La solicitud comienza con estado `pendiente`; el administrador la confirma o rechaza.
- **RN-018:** No se permite solicitar con menos de 24 horas de anticipación.