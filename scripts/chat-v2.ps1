<#
MOJO CLI - Interactive Chat Session
Usage: .\scripts\chat.ps1
This script provides an interactive chat session with MOJO (ASCII-only version)
#>

param(
    [string]$Token = "",
    [string]$ServerUrl = "http://localhost:3000"
)

# Load token from file if not provided
if ([string]::IsNullOrEmpty($Token)) {
    $tokenFile = ".\scripts\.token"
    if (Test-Path $tokenFile) {
        $Token = (Get-Content $tokenFile -Raw).Trim()
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
        Write-Host $response.response -ForegroundColor White
        Write-Host ""
        
    } catch {
        Write-Host ""
        Write-Host "Error: " -ForegroundColor Red -NoNewline
        
        if ($_.Exception.Response) {
            $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
            $errorBody = $reader.ReadToEnd()
            $reader.Close()
            
            try {
                $errorJson = $errorBody | ConvertFrom-Json
                Write-Host $errorJson.error -ForegroundColor Red
            } catch {
                Write-Host $errorBody -ForegroundColor Red
            }
        } else {
            Write-Host $_.Exception.Message -ForegroundColor Red
        }
        Write-Host ""
    }
}
