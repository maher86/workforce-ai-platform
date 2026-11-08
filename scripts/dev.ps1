param(
    [ValidateSet('Setup', 'Start', 'Stop', 'Check', 'Status')]
    [string] $Action = 'Status'
)
$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
Push-Location $projectRoot
function Invoke-Compose {
    & docker --context desktop-linux compose @args
    if ($LASTEXITCODE -ne 0) { throw "Docker Compose failed (exit $LASTEXITCODE)." }
}
try {
    switch ($Action) {
        'Setup' {
            if (-not (Test-Path apps/platform/.env)) {
                Copy-Item apps/platform/.env.example apps/platform/.env
            }
            Invoke-Compose build app
            Invoke-Compose up -d --wait postgres redis mailpit
            Invoke-Compose run --rm --no-deps app composer install --no-interaction --prefer-dist
            if ((Get-Content apps/platform/.env) -contains 'APP_KEY=') {
                Invoke-Compose run --rm --no-deps app php artisan key:generate
            }
            Invoke-Compose run --rm --no-deps app npm ci
            Invoke-Compose run --rm --no-deps app npm run build
            Invoke-Compose run --rm --no-deps app php artisan migrate --force
            Invoke-Compose up -d --wait app worker scheduler
        }
        'Start' {
            # Resume explicitly enabled phone-preview mode; never replace its public origin with localhost.
            if (Test-Path -LiteralPath (Join-Path $projectRoot '.preview/runtime.json')) {
                & (Join-Path $PSScriptRoot 'preview.ps1') Start
                Invoke-Compose up -d --no-deps --wait worker scheduler
            } else {
                Invoke-Compose up -d --wait app worker scheduler postgres redis mailpit
            }
        }
        'Stop' { Invoke-Compose stop }
        'Status' { Invoke-Compose ps }
        'Check' {
            Invoke-Compose config --quiet
            Invoke-Compose run --rm --no-deps app composer validate --strict
            Invoke-Compose run --rm --no-deps app npm run build
            Invoke-Compose run --rm --no-deps app npm run check
            Invoke-Compose run --rm --no-deps app npm run types:check
            Invoke-Compose run --rm --no-deps app composer test
            Invoke-Compose run --rm --no-deps app composer audit --locked
            Invoke-Compose run --rm --no-deps app npm audit --omit=dev --audit-level=high
        }
    }
} finally {
    Pop-Location
}
