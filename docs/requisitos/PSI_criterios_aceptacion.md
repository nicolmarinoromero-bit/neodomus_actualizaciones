# Requisito académico PSI: aclaraciones y criterios de aceptación

## Estado de identificación

En la documentación y código revisados no se encontró una definición de **PSI** como sigla de un requisito académico, asignatura, estándar o entregable. La palabra «académico» aparece asociada al simulador de pagos; no permite inferir qué significa PSI. Por tanto, el significado, alcance institucional y obligatoriedad del PSI quedan **PENDIENTES DE DEFINICIÓN**. Este documento no atribuye a la sigla un significado supuesto.

## Referencias localizadas

| Referencia comprobada | Qué establece | Qué no permite concluir |
|---|---|---|
| `be/app/config.py`, `be/app/services/pagos_service.py`, `docs/requisitos/restricciones.md` | El proveedor de pago predeterminado es un simulador académico (`PAYMENT_PROVIDER=simulator`). | No define PSI como requisito del sistema. |
| `docs/requisitos/RFs/RF-011_realizacion_de_pagos.md` | Describe los pagos simulados del checkout de productos y citas y sus límites. | No establece criterios institucionales de PSI. |
| `docs/qa/` y `docs/MATRIZ_TRAZABILIDAD_REQUISITOS.md` | Contienen evidencia y trazabilidad de requisitos funcionales y técnicos concretos. | No se encontró una entrada identificada como PSI. |

## Preguntas pendientes de aclaración

1. ¿Qué significa PSI en el contexto de la institución o evaluación?
2. ¿Cuál es el enunciado oficial, fuente y versión del requisito?
3. ¿Es obligatorio para aprobar, o es una recomendación? ¿Quién lo determina?
4. ¿Qué artefactos, alcance, formato y evidencias exige la evaluación?
5. ¿Qué dependencias, fechas o restricciones institucionales aplican?

## Criterios verificables propuestos para cerrar la documentación

Estos criterios son condiciones para aceptar la **documentación del requisito una vez aclarado**, no requisitos académicos inventados.

| ID | Condición de aceptación | Método | Evidencia esperada | Estado |
|---|---|---|---|---|
| PSI-DOC-01 | El significado de PSI coincide con una fuente oficial identificada y accesible. | Contrastar el texto con la fuente entregada por la institución. | Enunciado, institución, versión/fecha verificable y referencia. | Pendiente |
| PSI-DOC-02 | Se separan obligaciones de recomendaciones según el enunciado oficial. | Revisar cada cláusula contra la fuente. | Tabla de obligaciones/recomendaciones con trazabilidad. | Pendiente |
| PSI-DOC-03 | Cada obligación tiene alcance, condición de cumplimiento y dependencias explícitas. | Revisión requisito por requisito con evaluador o responsable académico. | Matriz de aceptación y preguntas resueltas. | Pendiente |
| PSI-DOC-04 | Cada criterio define método de comprobación y evidencia esperada. | Ejecutar o inspeccionar el método acordado. | Resultado reproducible y evidencia vinculada. | Pendiente |

## Límite actual

Hasta recibir la aclaración, no se puede declarar el PSI cumplido, incumplido, obligatorio ni opcional. El simulador académico de pagos constituye un hecho técnico distinto y no sirve como evidencia de cumplimiento de PSI.
