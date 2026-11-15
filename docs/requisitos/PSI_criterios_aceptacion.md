# Requisito académico PSI: aclaraciones y criterios de aceptación

## Estado y alcance

En la documentación y código revisados no se encontró una definición de **PSI** como sigla de un requisito académico, asignatura, estándar o entregable. La palabra «académico» aparece asociada al simulador de pagos; no permite inferir qué significa PSI.

Por ahora, el significado, alcance institucional, obligatoriedad y evaluación del PSI están **PENDIENTES DE CONFIRMACIÓN**. Este documento registra la brecha y define cómo cerrarla; no sustituye el enunciado institucional ni atribuye a la sigla un significado supuesto.

Los criterios de esta página aceptan la **documentación del requisito**. No demuestran que el proyecto cumpla el PSI. La conformidad del proyecto solo se podrá evaluar después de recibir y confirmar la fuente oficial y sus condiciones.

## Referencias localizadas

| Referencia comprobada | Qué establece | Qué no permite concluir |
|---|---|---|
| `be/app/config.py`, `be/app/services/pagos_service.py`, `docs/requisitos/restricciones.md` | El proveedor de pago predeterminado es un simulador académico (`PAYMENT_PROVIDER=simulator`). | No define PSI como requisito del sistema. |
| `docs/requisitos/RFs/RF-011_realizacion_de_pagos.md` | Describe los pagos simulados del checkout de productos y citas y sus límites. | No establece criterios institucionales de PSI. |
| `docs/qa/` y `docs/MATRIZ_TRAZABILIDAD_REQUISITOS.md` | Contienen evidencia y trazabilidad de requisitos funcionales y técnicos concretos. | No se encontró una entrada identificada como PSI. |

## Información que debe confirmar la institución o el evaluador

1. Significado completo de PSI en este contexto y objetivo del requisito.
2. Enunciado oficial, institución emisora, versión o fecha y ubicación de la fuente.
3. Carácter obligatorio, recomendado o no aplicable; autoridad que toma esa decisión y efecto en la evaluación.
4. Entregables exigidos, alcance, formato, método de evaluación y evidencia aceptada.
5. Dependencias, fechas, restricciones, responsable de revisión y proceso para aprobar excepciones.

## Criterios de aceptación de esta documentación

La documentación se considera **ACEPTADA** cuando cada criterio de la tabla está cerrado con la evidencia indicada. Hasta entonces su estado es **PENDIENTE**. Si la fuente confirma que el PSI no aplica, se registra como **NO APLICA** solo con la decisión y justificación oficial; no se infiere por ausencia de información.

| ID | Condición verificable | Cómo comprobarla | Evidencia necesaria para cerrar | Estado inicial |
|---|---|---|---|---|
| PSI-DOC-01 | La sigla, el propósito y el alcance se transcriben o resumen fielmente desde una fuente oficial identificable. | Contrastar cada afirmación con el enunciado institucional. | Fuente accesible con institución emisora, versión o fecha y referencia precisa. | Pendiente |
| PSI-DOC-02 | Cada cláusula está clasificada como obligación, recomendación o condición de no aplicación, según la fuente. | Revisar la clasificación con quien evalúa o emite el requisito. | Matriz con cláusula, clasificación, referencia y responsable que la valida. | Pendiente |
| PSI-DOC-03 | Cada obligación tiene alcance, responsable, dependencias y condición observable de cumplimiento. | Revisar una por una las obligaciones contra la fuente y resolver ambigüedades. | Matriz de trazabilidad y registro de decisiones o preguntas resueltas. | Pendiente |
| PSI-DOC-04 | Cada condición de cumplimiento indica cómo se evalúa y qué evidencia se acepta. | Ejecutar el método acordado o inspeccionar la evidencia con el evaluador. | Método reproducible, resultado, evidencia vinculada y responsable de aceptación. | Pendiente |
| PSI-DOC-05 | Una exclusión o declaración de «no aplica» está aprobada por la autoridad correspondiente. | Verificar la decisión y sus fundamentos contra el procedimiento institucional. | Aprobación registrada, justificación, alcance de la exclusión y fecha. | Pendiente |

## Decisión pendiente y siguiente paso

El siguiente paso es obtener el enunciado o la confirmación oficial y actualizar esta matriz con sus referencias. Hasta entonces no se puede declarar el PSI cumplido, incumplido, obligatorio, opcional o no aplicable. El simulador académico de pagos es un hecho técnico distinto y no constituye evidencia de cumplimiento del PSI.
