# Índice de evidencias — ACT-3.4 (documentación integral)

Evidencias reales de la ejecución de la actividad 3.4 (12 de noviembre de 2026).

| Archivo | Qué demuestra |
|---|---|
| `backend-suite-291tests-ok.txt` | Suite completa del backend (`python -m unittest discover -s app\tests -p "test_*.py"`, base `neodomus_test`): `Ran 291 tests in 194.827s — OK (skipped=15)`. Los 15 skips son pruebas de MinIO sin buckets de prueba configurados (comportamiento documentado en `be/app/tests/testdb.py`). |
| `fe-vitest-108tests-ok.txt` | Suite completa del frontend (`pnpm test` en `fe/`): `Test Files 28 passed (28) — Tests 108 passed (108)`. |

Contexto: ambas suites se ejecutaron durante la actividad 3.4 contra la base de pruebas `neodomus_test` (backend) y con red simulada (frontend). Adicionalmente, tras documentar las funciones críticas y ampliar los metadatos de la API, se re-ejecutaron los módulos afectados (`test_auth`, `test_auth_session`, `test_t1_1_cuentas`, `test_checkout_metros_http`, `test_t2_pago_pendiente`, `test_pen09_pen10_devoluciones_metros`, `test_citas_reembolsos_admin`): 102 pruebas OK.
