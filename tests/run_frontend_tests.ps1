#requires -Version 5.1
<#
.SYNOPSIS
  Ejecuta las pruebas unitarias/integracion del FRONTEND de NeoDomus (Vitest).

.DESCRIPTION
  Envuelve 'pnpm test' (vitest run) definido en fe/package.json. No toca bases
  de datos ni red (todas las pruebas FE usan mocks; jsdom).

  Seguridad:
    - No instala dependencias: si falta fe/node_modules o pnpm, lo informa.
    - No modifica archivos del proyecto.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tests\run_frontend_tests.ps1
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tests\run_frontend_tests.ps1 -File src/utils/metros.test.ts
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tests\run_frontend_tests.ps1 -Coverage
#>
[CmdletBinding()]
param(
    [string]$File = '',
    [switch]$Coverage
)

$ErrorActionPreference = 'Stop'
. (Join-Path $PSScriptRoot 'TestRunner.Common.ps1')
$Root  = Split-Path -Parent $PSScriptRoot
$FeDir = Join-Path $Root 'fe'
$Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

# ---------------------------------------------------------------- main ----
Write-Rule
Write-Host 'NEODOMUS - Suite frontend (Vitest)' -ForegroundColor Cyan
Write-Host ("Root      : " + $Root)
Write-Host ("Alcance   : " + ($(if ([string]::IsNullOrWhiteSpace($File)) { 'todos los *.test.ts(x) en fe/src' } else { ('archivo ' + $File) })))
Write-Host ("Cobertura : " + ($(if ($Coverage) { 'si (@vitest/coverage-v8)' } else { 'no' })))
Write-Rule

if (-not (Test-NodeProjectPrerequisites -ProjectName 'fe' -ProjectDirectory $FeDir)) {
    exit 2
}

Write-Host '[3] Validando cobertura...' -ForegroundColor Yellow
if ($Coverage) {
    if (-not (Test-Path (Join-Path $FeDir 'node_modules\@vitest\coverage-v8'))) {
        Write-Host '  ERROR: @vitest/coverage-v8 no esta instalada (vitest no dara cobertura).' -ForegroundColor Red
        Write-Host '  Instalacion manual (requiere autorizacion): cd fe; pnpm add -D @vitest/coverage-v8' -ForegroundColor Green
        Write-Host '  Mientras tanto ejecuta sin -Coverage.' -ForegroundColor Yellow
        exit 2
    }
    Write-Host '  OK: proveedor de cobertura presente.' -ForegroundColor Green
} else {
    Write-Host '  (no solicitada)' -ForegroundColor Yellow
}

$relPath = ''
if (-not [string]::IsNullOrWhiteSpace($File)) {
    $relPath = $File -replace '^fe[\\/]', ''
    $target = Join-Path $FeDir $relPath
    Write-Host '[4] Validando archivo de prueba...' -ForegroundColor Yellow
    if (-not (Test-Path $target)) {
        Write-Host ("  ERROR: no existe '{0}' bajo fe/." -f $relPath) -ForegroundColor Red
        Write-Host '  Ejemplos: src/utils/metros.test.ts | src/contexts/CartContext.test.tsx' -ForegroundColor Yellow
        exit 2
    }
    Write-Host '  OK: archivo encontrado.' -ForegroundColor Green
}

# ------------------------------------------------------------ ejecucion ---
Write-Rule
Write-Host 'Ejecutando pruebas...' -ForegroundColor Cyan

$code = 0
Push-Location $FeDir
try {
    if (-not [string]::IsNullOrWhiteSpace($relPath)) {
        & pnpm exec vitest run $relPath
        $code = $LASTEXITCODE
    } elseif ($Coverage) {
        & pnpm exec vitest run --coverage
        $code = $LASTEXITCODE
    } else {
        & pnpm test
        $code = $LASTEXITCODE
    }
} finally {
    Pop-Location
}

if ($null -eq $code) { $code = 1 }

# -------------------------------------------------------------- resumen ---
Write-Rule
$resultText = 'PASADO'
$foreColor  = 'Green'
if ($code -ne 0) { $resultText = 'FALLIDO'; $foreColor = 'Red' }
Write-Host ("[frontend/vitest]    Resultado: {0}    Codigo: {1}    Duracion: {2:n1}s" -f $resultText, $code, $Stopwatch.Elapsed.TotalSeconds) -ForegroundColor $foreColor
Write-Host ("     Ejecutado desde: fe/ con pnpm  |  Alcance: " + $(if ($relPath) { $relPath } else { 'suite completa (sin red ni BD)' }))
Write-Rule

exit $code
