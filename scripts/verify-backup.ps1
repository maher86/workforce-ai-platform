param()

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path $PSScriptRoot -Parent
$probeSuffix = [guid]::NewGuid().ToString('N').Substring(0, 8)
$restoreDatabase = 'workforce_restore_' + $probeSuffix
$probeTable = 'backup_probe_' + $probeSuffix
$probeMarker = [guid]::NewGuid().ToString('N')
$dumpPath = '/tmp/workforce-' + $probeSuffix + '.dump'
$fileRoot = '/tmp/workforce-backup-' + $probeSuffix
$restoreCreated = $false
$probeCreated = $false

function Invoke-BackupCompose {
    & docker --context desktop-linux compose exec -T @args
    if ($LASTEXITCODE -ne 0) { throw "Backup verification failed (exit $LASTEXITCODE)." }
}

if ($restoreDatabase -notmatch '^workforce_restore_[0-9a-f]{8}$' -or $fileRoot -notmatch '^/tmp/workforce-backup-[0-9a-f]{8}$') {
    throw 'Unsafe backup verification target.'
}
Push-Location $projectRoot
try {
    # Source is fixed to the synthetic test database. Never restore over workforce.
    Invoke-BackupCompose postgres psql -U workforce -d workforce_testing -v ON_ERROR_STOP=1 -c "CREATE TABLE $probeTable (marker text NOT NULL); INSERT INTO $probeTable VALUES ('$probeMarker');"
    $probeCreated = $true
    Invoke-BackupCompose postgres pg_dump -U workforce -d workforce_testing -Fc -f $dumpPath
    Invoke-BackupCompose postgres createdb -U workforce $restoreDatabase
    $restoreCreated = $true
    Invoke-BackupCompose postgres pg_restore -U workforce --no-owner --exit-on-error -d $restoreDatabase $dumpPath
    $restoredMarker = (& docker --context desktop-linux compose exec -T postgres psql -U workforce -d $restoreDatabase -At -c "SELECT marker FROM $probeTable" | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $restoredMarker -ne $probeMarker) { throw 'Database restore verification mismatch.' }
    Invoke-BackupCompose app mkdir -p "$fileRoot/restored"
    $probeMarker | & docker --context desktop-linux compose exec -T app sh -c "cat > '$fileRoot/probe.txt'"
    if ($LASTEXITCODE -ne 0) { throw 'Cannot create synthetic private-file probe.' }
    Invoke-BackupCompose app tar -cf "$fileRoot/media.tar" -C $fileRoot probe.txt
    Invoke-BackupCompose app tar -xf "$fileRoot/media.tar" -C "$fileRoot/restored"
    $restoredFile = (& docker --context desktop-linux compose exec -T app cat "$fileRoot/restored/probe.txt" | Out-String).Trim()
    if ($LASTEXITCODE -ne 0 -or $restoredFile -ne $probeMarker) { throw 'Private-file restore verification mismatch.' }
    Write-Host 'PASS: isolated PostgreSQL dump/restore and synthetic private-file archive/restore.'
} finally {
    if ($restoreCreated) { & docker --context desktop-linux compose exec -T postgres dropdb -U workforce --if-exists $restoreDatabase }
    if ($probeCreated) { & docker --context desktop-linux compose exec -T postgres psql -U workforce -d workforce_testing -v ON_ERROR_STOP=1 -c "DROP TABLE IF EXISTS $probeTable" }
    & docker --context desktop-linux compose exec -T postgres rm -f $dumpPath
    & docker --context desktop-linux compose exec -T app rm -f "$fileRoot/probe.txt" "$fileRoot/media.tar" "$fileRoot/restored/probe.txt"
    & docker --context desktop-linux compose exec -T app rmdir "$fileRoot/restored" $fileRoot 2>$null
    Pop-Location
}
