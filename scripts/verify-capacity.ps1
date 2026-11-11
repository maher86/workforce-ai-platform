param()
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$probePath = Join-Path $PSScriptRoot 'verify-capacity.php'
$probePrefix = 'capacity_' + [guid]::NewGuid().ToString('N') + '_'
Push-Location $projectRoot
try {
    Write-Host 'Synthetic PostgreSQL/Redis queue probe. Do not run alongside backend tests.'
    & docker --context desktop-linux compose run --rm --no-deps `
        -e APP_ENV=testing -e DB_DATABASE=workforce_testing -e DB_URL= `
        -e REDIS_DB=3 -e REDIS_CACHE_DB=4 -e REDIS_URL= -e "REDIS_PREFIX=$probePrefix" `
        -e CACHE_STORE=redis -e QUEUE_CONNECTION=redis -e SESSION_DRIVER=array `
        -e MAIL_MAILER=array -e BCRYPT_ROUNDS=4 -e WORKFORCE_AI_PROVIDER=demo `
        -e OPENAI_API_KEY= -e WORKFORCE_REPORT_ANALYSIS=text `
        -v "${probePath}:/tmp/capacity-probe.php:ro" app php /tmp/capacity-probe.php
    if ($LASTEXITCODE -ne 0) { throw 'Synthetic capacity probe failed.' }
} finally {
    Pop-Location
}
