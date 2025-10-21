# MOJO CLI - Get User Profile
# Usage: .\scripts\get-profile.ps1

param(
    [string]$Token = "",
    [string]$ServerUrl = "http://localhost:3000"
)

# Load token from file if not provided
if ([string]::IsNullOrEmpty($Token)) {
    $tokenFile = ".\scripts\.token"
    if (Test-Path $tokenFile) {
        $Token = (Get-Content $tokenFile -Raw).Trim()
    } else {
        Write-Host "❌ No token found! Please login first." -ForegroundColor Red
        exit 1
    }
}

try {
    Write-Host "👤 Fetching profile..." -ForegroundColor Cyan
    
    $response = Invoke-RestMethod `
        -Uri "$ServerUrl/api/auth/me" `
        -Method Get `
        -Headers @{ Authorization = "Bearer $Token" } `
        -ErrorAction Stop
    
    Write-Host "✅ Profile loaded!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Username: $($response.user.username)" -ForegroundColor White
    Write-Host "Email: $($response.user.email)" -ForegroundColor White
    Write-Host "Tone: $($response.user.profile.tone)" -ForegroundColor Cyan
    Write-Host "Persona: $($response.user.profile.persona)" -ForegroundColor Cyan
    Write-Host "Created: $($response.user.createdAt)" -ForegroundColor Gray
    
} catch {
    Write-Host "❌ Failed to get profile!" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        $reader.Close()
        Write-Host "Error: $errorBody" -ForegroundColor Red
    }
}
