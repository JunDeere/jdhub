$ErrorActionPreference = 'Stop'
$bridgeRoot = Split-Path -Parent $PSScriptRoot
Set-Location -LiteralPath $bridgeRoot
& node '.\notepad-bridge\syncWindowsNotepad.js'
