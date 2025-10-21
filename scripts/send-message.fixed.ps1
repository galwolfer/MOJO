# MOJO CLI - Send Message (fixed copy)
# Usage: .\scripts\send-message.fixed.ps1 -Message "Your message"

param(
    [Parameter(Mandatory=$true)]
    [string]$Message,

    [string]$Token = "",

    [string]$SessionId = "",

    [string]$ServerUrl = "http://localhost:3000"
)

if ([string]::IsNullOrEmpty($Token)) {
    $tokenFile = ".\scripts\.token"
    if (Test-Path $tokenFile) {
        $Token = (Get-Content $tokenFile -Raw).Trim()
        Write-Host "📄 Loaded token from file" -ForegroundColor Gray
    } else {
        Write-Host "❌ No token provided and no saved token found!" -ForegroundColor Red
        Write-Host "Please login first: .\scripts\login.ps1 -Username 'yourname' -Password 'yourpass'" -ForegroundColor Yellow
        exit 1
    }
}

if ([string]::IsNullOrEmpty($SessionId)) {
    $SessionId = "session_$(Get-Date -Format 'yyyyMMdd_HHmmss')"
}

$body = @{
    message = $Message
    sessionId = $SessionId
} | ConvertTo-Json

try {
    Write-Host "💬 Sending message..." -ForegroundColor Cyan
    $response = Invoke-RestMethod `
        -Uri "$ServerUrl/api/chat/message" `
        -Method Post `
        -ContentType "application/json" `
        -Headers @{ Authorization = "Bearer $Token" } `
        -Body $body `
        -ErrorAction Stop

    Write-Host "✅ Response received!" -ForegroundColor Green
    Write-Host "MOJO: $($response.response)"
    Write-Host "Session: $($response.sessionId)  |  Messages: $($response.messageCount)"

} catch {
    Write-Host "❌ Failed to send message!" -ForegroundColor Red
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        $reader.Close()
        Write-Host "Error: $errorBody" -ForegroundColor Red
    } else {
        Write-Host "Error: $_" -ForegroundColor Red
    }
    exit 1
}
