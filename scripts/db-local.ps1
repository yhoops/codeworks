param(
  [ValidateSet("start", "stop", "status", "reset")]
  [string] $Command = "start",
  [int] $Port = 55432
)

$ErrorActionPreference = "Stop"

$root = Resolve-Path (Join-Path $PSScriptRoot "..")
$dataDir = Join-Path $root ".tmp/postgres"
$logFile = Join-Path $root ".tmp/postgres.log"

function Ensure-DataDir {
  if (-not (Test-Path $dataDir)) {
    New-Item -ItemType Directory -Force -Path (Split-Path $dataDir) | Out-Null
    initdb -D $dataDir -U codeworks --auth=trust | Out-Null
  }
}

switch ($Command) {
  "start" {
    Ensure-DataDir
    pg_ctl -D $dataDir -o "-p $Port" -l $logFile start
  }
  "stop" {
    if (Test-Path $dataDir) {
      pg_ctl -D $dataDir stop
    }
  }
  "status" {
    if (Test-Path $dataDir) {
      pg_ctl -D $dataDir status
    }
  }
  "reset" {
    if (Test-Path $dataDir) {
      pg_ctl -D $dataDir stop 2>$null
      Remove-Item -LiteralPath $dataDir -Recurse -Force
    }
  }
}
