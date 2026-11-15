<!-- Plantilla de PR (adaptada del bootcamp Testing ADSO al flujo de NeoDomus) -->

## Qué cambia

<!-- Resumen en 2-3 líneas: qué capa del bootcamp, qué problema de testing ataca -->

## Semana / capa del bootcamp

<!-- S1 E2E · S2 Unitarias · S3 Componentes · S4 API · S5 Dobles · S6 Integración BD · S7 E2E avanzado · S8 CI · S9 Integrador · S10 TDD -->

## Evidencia de ejecución (local, con comandos y salida real)

- Comando ejecutado:
- Resultado (número de pruebas, aprobadas/fallidas/omitidas):

## Cobertura

- Backend (líneas/ramas): __ % / __ %
- Frontend (líneas/ramas): __ % / __ %
- ¿El umbral vigente sigue cumplido? (regla del trinquete: nunca baja)

## Mutante documentado (¿qué prueba lo detecta?)

<!-- Semanal: qué mutaste (1 línea de producción), qué test falló y por qué -->

## Riesgos y aislamiento

- [ ] No toca la base de desarrollo (`neodomus`): solo `neodomus_test`
- [ ] No toca MinIO/SMTP/pagos de desarrollo (transportes neutralizados)
- [ ] Sin credenciales reales en archivos (env de sesión únicamente)
- [ ] Sin `waitForTimeout` fijos en E2E

## Checklist

- [ ] Las pruebas nuevas pasan y las anteriores siguen pasando
- [ ] Cada test tiene aserciones reales y estructura AAA
- [ ] Sin exclusiones de cobertura nuevas sobre lógica de negocio
- [ ] `tests/INVENTARIO.md` y `docs/testing/PROGRESO_BOOTCAMP.md` actualizados
