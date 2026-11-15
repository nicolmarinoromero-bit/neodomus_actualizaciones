function Write-Rule([string]$Text = '=') {
    Write-Host ($Text * 78) -ForegroundColor DarkGray
}

function Test-TcpPort {
    param([string]$TargetHost, [int]$TargetPort, [int]$TimeoutMs = 3000)
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $async = $client.ConnectAsync($TargetHost, $TargetPort)
        return ($async.Wait($TimeoutMs) -and $client.Connected)
    } catch {
        return $false
    } finally {
        $client.Close()
    }
}

function Get-DatabaseInfo {
    param([string]$Url)
    if ($Url -match '@([^:/?]+)(?::(\d+))?/([^/?]+)') {
        $port = 3306
        if ($Matches[2]) { $port = [int]$Matches[2] }
        return [PSCustomObject]@{
            HostName = $Matches[1]
            Port     = $port
            Database = $Matches[3]
        }
    }
    return $null
}

function Get-MissingPythonPackages {
    param([string[]]$Required)
    # Consultar metadatos evita depender de pip, que no siempre viene instalado
    # en los entornos virtuales creados por uv. No instala ni modifica paquetes.
    $prevEap = $ErrorActionPreference
    try {
        $ErrorActionPreference = 'Continue'
        $metadataCode = @'
from importlib.metadata import distributions
names = {
    distribution.metadata['Name'].lower().replace('_', '-')
    for distribution in distributions()
    if distribution.metadata.get('Name')
}
print(chr(10).join(sorted(names)))
'@
        $raw = & python -c $metadataCode 2>$null
        $pythonExitCode = $LASTEXITCODE
    } finally {
        $ErrorActionPreference = $prevEap
    }
    if ($pythonExitCode -ne 0) {
        return @($Required)
    }
    $installed = @($raw | Where-Object { -not [string]::IsNullOrWhiteSpace($_) })
    return @($Required | Where-Object {
        $_.ToLower().Replace('_', '-') -notin $installed
    })
}
