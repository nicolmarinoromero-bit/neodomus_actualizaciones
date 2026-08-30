
---

## RF-010_modificacion_o_cancelacion_de_servicio.md

```markdown
# RF-010 — Modificación o cancelación de un servicio antes de su confirmación

<!--
  ¿Qué? El usuario puede modificar o cancelar un servicio pendiente antes de que el administrador lo confirme.
  ¿Para qué? Flexibilidad en caso de cambios de plan.
  ¿Impacto? Mejora la experiencia y reduce cancelaciones de última hora.
-->

## Identificación

| Campo         | Valor                                            |
| ------------- | ------------------------------------------------ |
| **ID**        | RF-010                                           |
| **Nombre**    | Modificación o cancelación de un servicio       |
| **Módulo**    | Servicios (Citas)                                |
| **Prioridad** | Alta                                             |
| **Estado**    | Propuesta                                        |
| **Fecha**     | Mayo 2026                                        |

> **Actualización 2026-08:** Modificación `PUT /citas/{id}` si `Pendiente/Confirmada` `citas.py:1631` con 3h anticipación `citas.py:1666`, exención oferta `citas.py:1638`. Cancelación `DELETE /citas/{id}` cualquier `!=Finalizada/Cancelada` genera **reembolso 85% Pendiente** `citas.py:1727` y oferta hueco `citas.py:1821`. No trigger 48h.

## Descripción

El sistema debe permitir al usuario modificar o cancelar un servicio antes de su confirmación (estado `pendiente`), siempre que la fecha/hora original cumpla la regla de 48 horas para cancelación.

## Entradas (modificación)

| Campo        | Tipo   | Obligatorio | Validaciones                          |
| ------------ | ------ | ----------- | ------------------------------------- |
| `fecha`      | date   | No          | ≥ hoy + 24h                          |
| `hora`       | time   | No          | Dentro del horario de atención        |
| `direccion`  | string | No          | Mínimo 5 caracteres                   |
| `comentarios`| string | No          | -                                     |


---

## RF-010_modificacion_o_cancelacion_de_servicio.md

```markdown
# RF-010 — Modificación o cancelación de un servicio antes de su confirmación

<!--
  ¿Qué? El usuario puede modificar o cancelar un servicio pendiente antes de que el administrador lo confirme.
  ¿Para qué? Flexibilidad en caso de cambios de plan.
  ¿Impacto? Mejora la experiencia y reduce cancelaciones de última hora.
-->

## Identificación

| Campo         | Valor                                            |
| ------------- | ------------------------------------------------ |
| **ID**        | RF-010                                           |
| **Nombre**    | Modificación o cancelación de un servicio       |
| **Módulo**    | Servicios (Citas)                                |
| **Prioridad** | Alta                                             |
| **Estado**    | Propuesta                                        |
| **Fecha**     | Mayo 2026                                        |

> **Actualización 2026-08:** Modificación `PUT /citas/{id}` si `Pendiente/Confirmada` `citas.py:1631` con 3h anticipación `citas.py:1666`, exención oferta `citas.py:1638`. Cancelación `DELETE /citas/{id}` cualquier `!=Finalizada/Cancelada` genera **reembolso 85% Pendiente** `citas.py:1727` y oferta hueco `citas.py:1821`. No trigger 48h.

## Descripción

El sistema debe permitir al usuario modificar o cancelar un servicio antes de su confirmación (estado `pendiente`), siempre que la fecha/hora original cumpla la regla de 48 horas para cancelación.

## Entradas (modificación)

| Campo        | Tipo   | Obligatorio | Validaciones                          |
| ------------ | ------ | ----------- | ------------------------------------- |
| `fecha`      | date   | No          | ≥ hoy + 24h                          |
| `hora`       | time   | No          | Dentro del horario de atención        |
| `direccion`  | string | No          | Mínimo 5 caracteres                   |
| `comentarios`| string | No          | -                                     |

## Proceso (cancelación)

1. Usuario hace clic en "Cancelar" en una cita en estado `pendiente`.
2. Backend verifica que `fecha` - ahora ≥ 48 horas.
3. Si cumple, cambia estado a `cancelada`, registra en `audit_log`.
4. Notifica al técnico (si ya estaba asignado) y al usuario.
5. Si no cumple, retorna error.

## Salidas

| Escenario                          | Código HTTP | Respuesta                                          |
| ---------------------------------- | ----------- | -------------------------------------------------- |
| Cancelación exitosa                | 200         | `"Servicio cancelado exitosamente"`                |
| Cancelación con <48h anticipación  | 400         | `"No se puede cancelar con menos de 48 horas"`     |
| Modificación exitosa               | 200         | `"Servicio modificado exitosamente"`               |
| Cita no encontrada                 | 404         | `"Servicio no encontrado"`                         |

## Endpoints asociados

| Método | Ruta                  | Auth | Descripción                       |
| ------ | --------------------- | ---- | --------------------------------- |
| PUT    | `/api/v1/citas/{id}`  | Sí   | Modifica una cita pendiente       |
| DELETE | `/api/v1/citas/{id}`  | Sí   | Cancela una cita pendiente        |

## Reglas de negocio

- **RN-023:** Solo se puede modificar/cancelar si el estado es `pendiente`.
- **RN-024:** La regla de 48 horas se implementa con un trigger en la base de datos.
- **RN-025:** Las modificaciones de fecha/hora deben respetar los mismos requisitos que una nueva solicitud. (cancelación)

1. Usuario hace clic en "Cancelar" en una cita en estado `pendiente`.
2. Backend verifica que `fecha` - ahora ≥ 48 horas.
3. Si cumple, cambia estado a `cancelada`, registra en `audit_log`.
4. Notifica al técnico (si ya estaba asignado) y al usuario.
5. Si no cumple, retorna error.

## Salidas

| Escenario                          | Código HTTP | Respuesta                                          |
| ---------------------------------- | ----------- | -------------------------------------------------- |
| Cancelación exitosa                | 200         | `"Servicio cancelado exitosamente"`                |
| Cancelación con <48h anticipación  | 400         | `"No se puede cancelar con menos de 48 horas"`     |
| Modificación exitosa               | 200         | `"Servicio modificado exitosamente"`               |
| Cita no encontrada                 | 404         | `"Servicio no encontrado"`                         |

## Endpoints asociados

| Método | Ruta                  | Auth | Descripción                       |
| ------ | --------------------- | ---- | --------------------------------- |
| PUT    | `/api/v1/citas/{id}`  | Sí   | Modifica una cita pendiente       |
| DELETE | `/api/v1/citas/{id}`  | Sí   | Cancela una cita pendiente        |

## Reglas de negocio

- **RN-023:** Solo se puede modificar/cancelar si el estado es `pendiente`.
- **RN-024:** La regla de 48 horas se implementa con un trigger en la base de datos.
- **RN-025:** Las modificaciones de fecha/hora deben respetar los mismos requisitos que una nueva solicitud.