# MOJO CLI - Register New User
# Usage: .\scripts\register.ps1 -Username "name" -Email "you@example.com" -Password "pass"

param(
    [Parameter(Mandatory=$true)]
    [string]$Username,
    
    [Parameter(Mandatory=$true)]
    [string]$Email,
    
    [Parameter(Mandatory=$true)]
    [string]$Password,
    
    [string]$ServerUrl = "http://localhost:3000"
)

$body = @{
    username = $Username
    email = $Email
    password = $Password
} | ConvertTo-Json

try {
    Write-Host "Registering user: $Username..." -ForegroundColor Cyan
    
    $response = Invoke-RestMethod `
        -Uri "$ServerUrl/api/auth/register" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    
    Write-Host "Registration successful!" -ForegroundColor Green
    Write-Host "Username: $($response.user.username)" -ForegroundColor White
    Write-Host "Email: $($response.user.email)" -ForegroundColor White
    Write-Host ""
    Write-Host "Your authentication token:" -ForegroundColor Yellow
    Write-Host $response.token -ForegroundColor White
    Write-Host ""
    Write-Host "Save this token to use in other scripts:" -ForegroundColor Cyan
    Write-Host "Example: `$env:MOJO_TOKEN = '$($response.token)'" -ForegroundColor Gray
    
    # Save token to file (relative to script directory)
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $tokenFile = Join-Path $scriptDir ".token"
    if ($null -ne $response.token -and $response.token -ne "") {
        Set-Content -Path $tokenFile -Value $response.token -NoNewline -Encoding UTF8
        Write-Host "Token saved to: $tokenFile" -ForegroundColor Green
    }
    
} catch {
    Write-Host "Registration failed!" -ForegroundColor Red
    
    if ($_.Exception.Response) {
        $reader = New-Object System.IO.StreamReader($_.Exception.Response.GetResponseStream())
        $errorBody = $reader.ReadToEnd()
        $reader.Close()
        Write-Host "Error: $errorBody" -ForegroundColor Red
    } else {
        Write-Host "Error: $_" -ForegroundColor Red
    }
}