
---

## RF-006_consulta_de_detalles_de_servicio.md

```markdown
# RF-006 — Consulta de detalles de un servicio

<!--
  ¿Qué? Mostrar información completa de un servicio específico.
  ¿Para qué? Que el usuario pueda tomar una decisión informada.
  ¿Impacto? Permite comparar servicios y ver promociones.
-->

## Identificación

| Campo         | Valor                                    |
| ------------- | ---------------------------------------- |
| **ID**        | RF-006                                   |
| **Nombre**    | Consulta de detalles de un servicio     |
| **Módulo**    | Catálogo                                 |
| **Prioridad** | Alta                                     |
| **Estado**    | Propuesta                                |
| **Fecha**     | Mayo 2026                                |

> **Actualización 2026-08:** Detalle es de **producto** `GET /api/v1/productos/{id}` (`productos.py:658`) + variantes `GET /productos/{id}/variantes` (`productos.py:676`). Precio final con vigencia `precio_final` (`productos.py:222`).

## Descripción

El sistema debe permitir al usuario consultar el precio, la descripción completa, la duración estimada, requisitos previos y promociones aplicables de cada servicio.

## Entradas

| Parámetro | Tipo | Obligatorio | Descripción        |
| --------- | ---- | ----------- | ------------------ |
| `id`      | int  | Sí          | ID del servicio    |

## Proceso

1. Usuario hace clic en un servicio del catálogo → navega a `/productos/{id}`.
2. Backend consulta el servicio por ID.
3. Si existe, retorna todos sus campos.
4. Si hay una promoción activa (ver RF-038), se calcula el precio final y se muestra el descuento.

## Salidas

```json
{
  "id": 1,
  "nombre": "Instalación de domótica",
  "descripcion_larga": "Servicio completo que incluye...",
  "precio": 25000.00,
  "duracion_estimada": 120,
  "categoria": "instalacion",
  "requisitos": "Conexión a internet estable",
  "promocion": {
    "tipo": "porcentaje",
    "valor": 15,
    "precio_final": 21250.00
  }
}
Endpoints asociados
Método	Ruta	Auth	Descripción
GET	/api/v1/productos/{id}	No	Obtiene el detalle del servicio
Reglas de negocio
RN-015: Si el servicio no existe, retorna 404.

RN-016: La duración se muestra en minutos, pero en la interfaz se convierte a horas/minutos legibles.
