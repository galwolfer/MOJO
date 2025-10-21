<#
MOJO CLI - Interactive Chat Session
Usage: .\scripts\chat.ps1
This script provides an interactive chat session with MOJO (ASCII-only version)
#>

param(
    $Token,
    $ServerUrl
)

# Provide safe defaults if params are missing
if (-not $ServerUrl) { $ServerUrl = 'http://localhost:3000' }
if (-not $Token) { $Token = '' }

# MOJO CLI - Interactive Chat Session
# Usage: .\scripts\chat.ps1
# This script provides an interactive chat session with MOJO (ASCII-only version)

param(
    [string]$Token = "",
    [string]$ServerUrl = "http://localhost:3000"
)

# Resolve token file relative to the script location so it works when run from any CWD
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$tokenFile = Join-Path $scriptDir ".token"

# Load token from file if not provided
if ([string]::IsNullOrEmpty($Token)) {
    if (Test-Path $tokenFile) {
        $tokenRaw = Get-Content $tokenFile -Raw
        if ($null -eq $tokenRaw -or [string]::IsNullOrWhiteSpace($tokenRaw)) {
            Write-Host "Token file exists but is empty. Please login first:" -ForegroundColor Red
            Write-Host ".\scripts\login.ps1 -Username 'yourname' -Password 'yourpass'" -ForegroundColor Yellow
            exit 1
        }
        $Token = $tokenRaw.Trim()
        Write-Host "Loaded token from file" -ForegroundColor Gray
    } else {
        Write-Host "No token found! Please login first:" -ForegroundColor Red
        Write-Host ".\scripts\login.ps1 -Username 'yourname' -Password 'yourpass'" -ForegroundColor Yellow
        exit 1
    }
}

# Generate session ID for this chat
$SessionId = "chat_session_$(Get-Date -Format 'yyyyMMdd_HHmmss')"

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "      MOJO - Interactive Chat           " -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Session ID: $SessionId" -ForegroundColor Gray
Write-Host "Type 'exit' or 'quit' to end the session" -ForegroundColor Gray
Write-Host "Type 'clear' to clear screen" -ForegroundColor Gray
Write-Host ""

while ($true) {
    Write-Host "You: " -ForegroundColor Green -NoNewline
    $message = Read-Host

    if ([string]::IsNullOrWhiteSpace($message)) {
        continue
    }

    if ($message -eq "exit" -or $message -eq "quit") {
        Write-Host ""
        Write-Host "Goodbye!" -ForegroundColor Cyan
        break
    }

    if ($message -eq "clear" -or $message -eq "cls") {
        Clear-Host
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host "      MOJO - Interactive Chat           " -ForegroundColor Cyan
        Write-Host "========================================" -ForegroundColor Cyan
        Write-Host ""
        continue
    }

    $body = @{
        message = $message
        sessionId = $SessionId
    } | ConvertTo-Json

    try {
        $response = Invoke-RestMethod `
            -Uri "$ServerUrl/api/chat/message" `
            -Method Post `
            -ContentType "application/json" `
            -Headers @{ Authorization = "Bearer $Token" } `
            -Body $body `
            -ErrorAction Stop

        Write-Host ""
        Write-Host "MOJO: " -ForegroundColor Cyan -NoNewline
        if ($null -ne $response) {
            if ($response.PSObject.Properties.Name -contains 'response') {
                Write-Host $response.response -ForegroundColor White
            } else {
                # Fallback: print the whole response object as JSON
                $response | ConvertTo-Json -Depth 5 | Write-Host
            }
        } else {
            Write-Host "(no response)" -ForegroundColor Yellow
        }
        Write-Host ""

    } catch {
        Write-Host ""
        Write-Host "Error: " -ForegroundColor Red -NoNewline

        # If the response contains a body, read and try to pretty-print JSON
        if ($_.Exception.Response) {
            try {
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
                $errorBody = $reader.ReadToEnd()
                $reader.Close()

                try {
                    $errorJson = $errorBody | ConvertFrom-Json
                    if ($errorJson.error) { Write-Host $errorJson.error -ForegroundColor Red } else { $errorJson | ConvertTo-Json -Depth 5 | Write-Host }
                } catch {
                    Write-Host $errorBody -ForegroundColor Red
                }
            } catch {
                Write-Host $_.Exception.Message -ForegroundColor Red
            }
        } else {
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
        Write-Host ""
    }
}
