param(
    [ValidateSet('Start', 'Stop', 'Status')]
    [string] $Action = 'Status'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$runtimePath = Join-Path $projectRoot '.preview/runtime.json'
$previousUrl = $env:WORKFORCE_PUBLIC_URL
$previousProxy = $env:WORKFORCE_TRUSTED_PROXIES

function Invoke-PreviewCompose {
    & docker --context desktop-linux compose --profile preview @args
    if ($LASTEXITCODE -ne 0) { throw "Preview Compose failed (exit $LASTEXITCODE)." }
}

Push-Location $projectRoot
try {
    switch ($Action) {
        'Start' {
            Invoke-PreviewCompose up -d --wait postgres redis mailpit
            $runningTunnel = (& docker --context desktop-linux compose ps --status running -q tunnel | Out-String).Trim()
            $logSince = @()
            if (-not $runningTunnel) {
                $logSince = @('--since', (Get-Date).ToUniversalTime().ToString('o'))
            }
            Invoke-PreviewCompose up -d --no-deps tunnel
            $publicUrl = $null
            for ($attempt = 0; $attempt -lt 30; $attempt++) {
                $tunnelLogs = (& docker --context desktop-linux compose logs --no-color --tail 100 @logSince tunnel 2>&1 | Out-String)
                $urlMatches = [regex]::Matches($tunnelLogs, 'https://[a-z0-9-]+\.trycloudflare\.com')
                if ($urlMatches.Count -gt 0) {
                    $publicUrl = $urlMatches[$urlMatches.Count - 1].Value
                    break
                }
                Start-Sleep -Seconds 2
            }
            if (-not $publicUrl) { throw 'No HTTPS URL returned. Inspect: docker --context desktop-linux compose logs tunnel' }
            $containerId = (& docker --context desktop-linux compose ps -q tunnel | Out-String).Trim()
            $container = (& docker --context desktop-linux inspect $containerId | ConvertFrom-Json)[0]
            $proxyAddress = $container.NetworkSettings.Networks.'workforce-ai-platform_default'.IPAddress
            [System.Net.IPAddress] $parsedProxy = $null
            if (-not [System.Net.IPAddress]::TryParse($proxyAddress, [ref]$parsedProxy)) {
                throw 'Cannot determine the exact tunnel container IP.'
            }
            $env:WORKFORCE_PUBLIC_URL = $publicUrl
            $env:WORKFORCE_TRUSTED_PROXIES = $proxyAddress
            Invoke-PreviewCompose up -d --no-deps app preview
            New-Item -ItemType Directory -Path (Split-Path $runtimePath) -Force | Out-Null
            @{ url = $publicUrl; startedAt = (Get-Date).ToUniversalTime().ToString('o') } |
                ConvertTo-Json | Set-Content -LiteralPath $runtimePath -Encoding utf8
            Write-Host "Phone preview: $publicUrl"
            Write-Host 'Generate a NEW employee QR. Existing localhost QR links cannot change.'
            Write-Host 'Temporary synthetic-data preview only. Stop with: ./scripts/preview.ps1 Stop'
        }
        'Stop' {
            Invoke-PreviewCompose stop tunnel preview
            $env:WORKFORCE_PUBLIC_URL = ''
            $env:WORKFORCE_TRUSTED_PROXIES = ''
            Invoke-PreviewCompose up -d --no-deps app
            if (Test-Path -LiteralPath $runtimePath) { Remove-Item -LiteralPath $runtimePath }
            Write-Host 'Phone preview stopped. Local QR links use localhost again.'
        }
        'Status' {
            Invoke-PreviewCompose ps app preview tunnel
            if (Test-Path -LiteralPath $runtimePath) {
                $runtime = Get-Content -LiteralPath $runtimePath -Raw | ConvertFrom-Json
                Write-Host "Last issued preview URL: $($runtime.url)"
            }
        }
    }
} catch {
    if ($Action -eq 'Start') {
        & docker --context desktop-linux compose --profile preview stop tunnel preview | Out-Null
        $env:WORKFORCE_PUBLIC_URL = ''
        $env:WORKFORCE_TRUSTED_PROXIES = ''
        & docker --context desktop-linux compose up -d --no-deps app | Out-Null
    }
    throw
} finally {
    $env:WORKFORCE_PUBLIC_URL = $previousUrl
    $env:WORKFORCE_TRUSTED_PROXIES = $previousProxy
    Pop-Location
}
