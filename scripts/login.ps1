<#
MOJO CLI - Login
Usage: .\scripts\login.ps1 -Username "yourname" -Password "yourpass"
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$Username,
    
    [Parameter(Mandatory=$true)]
    [string]$Password,
    
    [string]$ServerUrl = "http://localhost:3000"
)

$body = @{
    username = $Username
    password = $Password
} | ConvertTo-Json

try {
    Write-Host "Logging in as: $Username..." -ForegroundColor Cyan

    # Use Invoke-WebRequest and parse raw JSON for more robust behavior across systems
    $resp = Invoke-WebRequest `
        -Uri "$ServerUrl/api/auth/login" `
        -Method Post `
        -ContentType "application/json" `
        -Body $body `
        -ErrorAction Stop
    $raw = $resp.Content
    $response = $raw | ConvertFrom-Json

    Write-Host "Login successful!" -ForegroundColor Green
    if ($response.user -and $response.user.username) {
        Write-Host "Welcome, $($response.user.username)!" -ForegroundColor White
    }
    Write-Host ""
    Write-Host "Your authentication token:" -ForegroundColor Yellow
    Write-Host $response.token -ForegroundColor White
    Write-Host ""
    Write-Host "To use this token, set it as an environment variable:" -ForegroundColor Cyan
    Write-Host "`$env:MOJO_TOKEN = '$($response.token)'" -ForegroundColor Gray
    Write-Host ""
    Write-Host "Or use it directly in commands with -Token parameter" -ForegroundColor Cyan

    # Save token to file for convenience (write raw token, no newline issues)
    $scriptDir = Split-Path -Parent $MyInvocation.MyCommand.Definition
    $tokenFile = Join-Path $scriptDir ".token"
    if ($null -ne $response.token -and $response.token -ne "") {
        # Use Set-Content to write the token as-is
        Set-Content -Path $tokenFile -Value $response.token -NoNewline -Encoding UTF8
        Write-Host "Token saved to: $tokenFile" -ForegroundColor Green
    } else {
        Write-Host "Warning: no token received from server" -ForegroundColor Yellow
    }

    # Return the token for use in pipelines
    return $response.token

} catch {
    Write-Host "Login failed!" -ForegroundColor Red

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
