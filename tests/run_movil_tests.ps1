#requires -Version 5.1
<#
.SYNOPSIS
  Ejecuta las pruebas de la aplicacion MOVIL de NeoDomus (Jest + React Native Testing Library).

.DESCRIPTION
  Envuelve 'pnpm test' (jest) definido en movil/package.json. No toca bases de
  datos ni red (todas las pruebas movil usan mocks de expo/react-native via
  jest-expo y helpers de __tests__/helpers; no llaman al backend real).

  Seguridad:
    - No instala dependencias: si falta movil/node_modules o pnpm, lo informa.
    - No modifica archivos del proyecto.

.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tests\run_movil_tests.ps1
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tests\run_movil_tests.ps1 -File __tests__/utils/metros.test.ts
.EXAMPLE
  powershell -NoProfile -ExecutionPolicy Bypass -File tests\run_movil_tests.ps1 -Coverage
#>
[CmdletBinding()]
param(
    [string]$File = '',
    [switch]$Coverage
)

$ErrorActionPreference = 'Stop'
$Root    = Split-Path -Parent $PSScriptRoot
$MovilDir = Join-Path $Root 'movil'
$Stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

function Write-Rule([string]$Text = '=') {
    Write-Host ($Text * 78) -ForegroundColor DarkGray
}

# ---------------------------------------------------------------- main ----
Write-Rule
Write-Host 'NEODOMUS - Suite movil (Jest + jest-expo)' -ForegroundColor Cyan
Write-Host ("Root      : " + $Root)
Write-Host ("Alcance   : " + ($(if ([string]::IsNullOrWhiteSpace($File)) { 'todos los *.test.ts(x) en movil/__tests__' } else { ('archivo ' + $File) })))
Write-Host ("Cobertura : " + ($(if ($Coverage) { 'si (jest --coverage; umbrales de movil/jest.config.js)' } else { 'no' })))
Write-Rule

Write-Host '[1] Validando Node y pnpm...' -ForegroundColor Yellow
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
    Write-Host '  ERROR: node no esta disponible en PATH (instala Node.js, con autorizacion del equipo).' -ForegroundColor Red
    exit 2
}
if (-not (Get-Command pnpm -ErrorAction SilentlyContinue)) {
    Write-Host '  ERROR: pnpm no esta disponible en PATH.' -ForegroundColor Red
    Write-Host '  Con Node 22+: corepack enable (instala el shim; requiere accion manual).' -ForegroundColor Green
    exit 2
}
Write-Host '  OK: node y pnpm disponibles.' -ForegroundColor Green

Write-Host '[2] Validando dependencias del movil (movil/node_modules)...' -ForegroundColor Yellow
if (-not (Test-Path (Join-Path $MovilDir 'node_modules'))) {
    Write-Host '  ERROR: movil/node_modules no existe.' -ForegroundColor Red
    Write-Host '  Ejecuta manualmente (requiere instalacion): cd movil; pnpm install' -ForegroundColor Green
    exit 2
}
Write-Host '  OK: node_modules presente.' -ForegroundColor Green

Write-Host '[3] Validando cobertura...' -ForegroundColor Yellow
if ($Coverage) {
    $pkgJson = Get-Content (Join-Path $MovilDir 'package.json') -Raw
    if ($pkgJson -notmatch '"test:coverage"') {
        Write-Host '  ERROR: el script "test:coverage" no existe en movil/package.json (jest --coverage).' -ForegroundColor Red
        Write-Host '  Mientras tanto ejecuta sin -Coverage.' -ForegroundColor Yellow
        exit 2
    }
    Write-Host '  OK: script de cobertura presente (jest --coverage).' -ForegroundColor Green
} else {
    Write-Host '  (no solicitada)' -ForegroundColor Yellow
}

$relPath = ''
if (-not [string]::IsNullOrWhiteSpace($File)) {
    $relPath = $File -replace '^movil[\\/]', ''
    $target = Join-Path $MovilDir $relPath
    Write-Host '[4] Validando archivo de prueba...' -ForegroundColor Yellow
    if (-not (Test-Path $target)) {
        Write-Host ("  ERROR: no existe '{0}' bajo movil/." -f $relPath) -ForegroundColor Red
        Write-Host '  Ejemplos: __tests__/utils/metros.test.ts | __tests__/components/CookieConsent.test.tsx' -ForegroundColor Yellow
        exit 2
    }
    Write-Host '  OK: archivo encontrado.' -ForegroundColor Green
}

# ------------------------------------------------------------ ejecucion ---
Write-Rule
Write-Host 'Ejecutando pruebas...' -ForegroundColor Cyan

$code = 0
Push-Location $MovilDir
try {
    if (-not [string]::IsNullOrWhiteSpace($relPath)) {
        & pnpm exec jest $relPath
        $code = $LASTEXITCODE
    } elseif ($Coverage) {
        & pnpm run test:coverage
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
Write-Host ("[movil/jest]         Resultado: {0}    Codigo: {1}    Duracion: {2:n1}s" -f $resultText, $code, $Stopwatch.Elapsed.TotalSeconds) -ForegroundColor $foreColor
Write-Host ("     Ejecutado desde: movil/ con pnpm  |  Alcance: " + $(if ($relPath) { $relPath } else { 'suite completa (sin red ni BD)' }))
Write-Rule

exit $code
