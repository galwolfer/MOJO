param(
    [string]$Token,
    [string]$ServerUrl
)

# Provide defaults
if (-not $ServerUrl) { $ServerUrl = 'http://localhost:3000' }
if (-not $Token) { $Token = '' }

# Resolve token file relative to script directory
$scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
$tokenFile = Join-Path $scriptDir '.token'

# Load token from file if not provided
if ([string]::IsNullOrEmpty($Token)) {
    if (Test-Path $tokenFile) {
    # Read token file as UTF8 to avoid encoding issues on Windows
    $tokenRaw = Get-Content $tokenFile -Raw -Encoding UTF8
        if ($null -eq $tokenRaw -or [string]::IsNullOrWhiteSpace($tokenRaw)) {
            Write-Host "Token file exists but is empty. Please login first:" -ForegroundColor Red
            Write-Host ".\scripts\login.ps1 -Username 'yourname' -Password 'yourpass'" -ForegroundColor Yellow
            exit 1
        }
        $Token = $tokenRaw.Trim()
        Write-Host "Loaded token from file: $tokenFile" -ForegroundColor Gray
    } else {
        Write-Host "No token found! Please login first:" -ForegroundColor Red
        Write-Host ".\scripts\login.ps1 -Username 'yourname' -Password 'yourpass'" -ForegroundColor Yellow
        exit 1
    }
}

# Generate session ID
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
    Write-Host -NoNewline "You: " -ForegroundColor Green
    $message = Read-Host

    if ([string]::IsNullOrWhiteSpace($message)) { continue }
    if ($message -in @('exit','quit')) { Write-Host "Goodbye!" -ForegroundColor Cyan; break }
    if ($message -in @('clear','cls')) { Clear-Host; Write-Host "========================================" -ForegroundColor Cyan; Write-Host "      MOJO - Interactive Chat           " -ForegroundColor Cyan; Write-Host "========================================" -ForegroundColor Cyan; continue }

    $body = @{ message = $message; sessionId = $SessionId } | ConvertTo-Json

    try {
        # Ensure the request body is sent as UTF-8 bytes and include charset in Content-Type
        $utf8Bytes = [System.Text.Encoding]::UTF8.GetBytes($body)
        $response = Invoke-RestMethod -Uri "$ServerUrl/api/chat/message" -Method Post -ContentType 'application/json; charset=utf-8' -Headers @{ Authorization = "Bearer $Token" } -Body $utf8Bytes -ErrorAction Stop

        Write-Host ""; Write-Host "MOJO: " -ForegroundColor Cyan -NoNewline
        if ($null -ne $response -and $response.PSObject.Properties.Name -contains 'response') {
            Write-Host $response.response -ForegroundColor White
        } elseif ($null -ne $response) {
            $response | ConvertTo-Json -Depth 5 | Write-Host
        } else {
            Write-Host "(no response)" -ForegroundColor Yellow
        }
        Write-Host ""
    } catch {
        Write-Host ""; Write-Host "Error: " -ForegroundColor Red -NoNewline
        if ($_.Exception.Response) {
                try {
                # Read error response as UTF8 to preserve non-ASCII characters
                $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream(), [System.Text.Encoding]::UTF8)
                $errorBody = $reader.ReadToEnd(); $reader.Close()
                try { $eJson = $errorBody | ConvertFrom-Json; if ($eJson.error) { Write-Host $eJson.error -ForegroundColor Red } else { $eJson | ConvertTo-Json -Depth 5 | Write-Host } } catch { Write-Host $errorBody -ForegroundColor Red }
            } catch { Write-Host $_.Exception.Message -ForegroundColor Red }
        } else { Write-Host $_.Exception.Message -ForegroundColor Red }
        Write-Host ""
    }
}