# Informe de cierre — Bootcamp Testing ADSO en NeoDomus

Fecha de cierre: 14 de noviembre de 2026
Rama revisada: `testing/bootcamp-adso`

## Resultado

Las semanas 1 a 10 quedan registradas como **completadas** en
`docs/testing/PROGRESO_BOOTCAMP.md`. Se corrigió la tabla general: las semanas
7, 8 y 9 ya estaban desarrolladas y aprobadas en sus registros, pero por error
seguían apareciendo como pendientes.

## Semana 10 — historia y trabajo

Historia: un cliente autenticado puede retirar su solicitud de baja mientras
está pendiente, conservando el registro de auditoría.

Se implementó `DELETE /api/v1/clients/me/cuenta-solicitud` en el backend:

- 204 sin cuerpo al cancelar la solicitud pendiente propia.
- 404 si no existe una solicitud pendiente.
- 401 sin sesión de cliente.
- La fila se conserva, cambia a `cancelada` y recibe `resuelta_at`.
- Las solicitudes de otros clientes y las ya resueltas quedan intactas.

Se añadieron cinco pruebas backend para esos criterios. El registro TDD
conserva el RED de la sesión anterior (5 respuestas 405 antes de implementar),
el GREEN implementado y el refactor/revisión final.

## Verificación final

- Pruebas enfocadas de S10, después del ajuste final: **5 passed · 0 skipped ·
  EXIT 0** en 12,59 s.
- Suite backend completa contra MySQL y MinIO de pruebas: **587 passed · 0
  skipped · EXIT 0**, cobertura **81,91 %** con piso de 80 %.
- `git diff --check`: sin errores.

La primera regresión completa produjo 4 fallas en otras pruebas; las cuatro
pasaron cuando se ejecutaron aisladas y la repetición completa quedó verde. Se
conservaron los reportes de ambos intentos para mostrar ese resultado inicial y
su repetición, en vez de ocultarlo.

Evidencias guardadas en `evidencias/testing/`:

- `s10_targeted_final.txt` — pruebas S10 finales.
- `s10_backend_full.txt` — primera regresión (4 fallas no reproducibles al
  aislarlas).
- `s10_backend_full_retry.txt` — regresión final aprobada.

## Cambios preexistentes y cuidado del repositorio

Se trabajó en `testing/bootcamp-adso`. Había cambios de workflows, SQL y otras
pruebas en el árbol compartido; se conservaron. No se hizo commit, push, reset,
merge ni cambio de rama.
