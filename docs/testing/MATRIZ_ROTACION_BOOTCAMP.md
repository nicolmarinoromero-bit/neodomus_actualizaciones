# Matriz de rotación del bootcamp — NeoDomus

> Adaptación de la plantilla `matriz-rotacion.md` del bootcamp. En esta
> ejecución autónoma las cuatro capas las ejecuta el mismo agente de QA; la
> matriz registra qué capa se trabajó cada semana y el estado de cobertura
> real alcanzado (regla del trinquete: el umbral nunca baja).

| Semana | Capa principal | Entregable núcleo | Cobertura BE real (líneas) | Cobertura FE real | Umbral vigente BE/FE |
|---|---|---|---|---|---|
| S1 | E2E | Primer E2E con AAA + línea base de cobertura | **56.08 %** líneas (31.2 % ramas) | **27.55 %** líneas | línea base |
| S2 | Unitarias (BE+FE) | ≥3 unitarias de reglas de negocio + CI con umbral 30 % | 56.09 % líneas (Cover 50.53 %) | **30.01 %** líneas | BE 50 (combinado) / FE 30 |
| S3 | Componentes React | Formularios críticos con user-event | 56.09 % líneas (Cover 50.53 %) | **40.92 %** líneas | BE 50 (combinado) / FE 40 |
| S4 | Pruebas de API | Contrato HTTP de routers sin cubrir + negativos + H-4 (listados robustos) | **59.91 %** líneas (36.25 % ramas; Cover 54.51 %) | **52.75 %** líneas (74.01 % ramas) | BE 50 (combinado) / FE 52 |
| S5 | Dobles de prueba | Inventario de dependencias + dobles (MinIO/SMTP/Gmail/reloj/pagos/scheduler/MSW) | **60.64 %** líneas (36.25 % ramas; Cover 60.64 %) | **64.84 %** líneas (75.24 % ramas; 58.73 % funciones) | BE 60 (combinado) / FE 60 |
| S6 | Integración BD | MySQL de pruebas en compose + pruebas de repositorios | **81.87 %** líneas (80.30 % ramas; Cover 82 %) | **70.31 %** líneas (76.50 % ramas; 60.85 % funciones) | BE 70 / FE 70 |
| S7 | E2E avanzado | 3 flujos críticos estables + Page Objects + HTML report | **81.87 %** líneas (80.30 % ramas; sin cambios BE en S7) | **78.23 %** líneas (77.89 % ramas; 64.79 % funciones) | BE 70 / FE 75 |
| S8 | CI completo | Cobertura y artefactos en CI, 0 omitidas justificadas | — | — | 80 % |
| S9 | Integrador | Estrategia de pruebas + matrices | — | — | ≥80 % |
| S10 | TDD | Historia nueva con ciclos RED→GREEN→REFACTOR | — | — | ≥80 % |

Los valores de cobertura se rellenan al cerrar cada semana con la medición
real (nunca estimada) y quedan detallados en `docs/testing/MATRIZ_DE_COBERTURA.md`.
