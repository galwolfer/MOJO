<#
  cleanup-and-install.ps1
  Usage: .\cleanup-and-install.ps1
  ---------------------------------
  This script will:
   1. Stop common Node/Metro/gradle processes
   2. Temporarily pause OneDrive sync (if running)
   3. Delete node_modules and package-lock.json
   4. Clean npm cache
   5. Re-install dependencies (npm install)
#>

# 1. Stop node / expo / react-native / gradle related processes
# List of common process names
$procs = @("node", "npm", "gradle", "java", "expo", "react-native", "cmd")  
foreach ($p in $procs) {
  Get-Process -Name $p -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
}

# 2. Pause OneDrive sync (if running)
# This uses the OneDrive CLI to pause sync (Windows 10/11)
# If you don't use OneDrive — this will simply fail silently.
try {
  # OneDrive might be named "OneDrive" or "OneDriveSetup" etc.
  $od = Get-Process -Name "OneDrive" -ErrorAction SilentlyContinue
  if ($od) {
    # The following command calls the OneDrive executable with "pause" argument
    & "$($od.Path)" /pause
    Write-Output "Paused OneDrive sync."
  }
} catch {
  # Could not pause — ignore
}

# 3. Delete node_modules and package-lock.json
$projectRoot = Split-Path -Parent $MyInvocation.MyCommand.Definition
Set-Location $projectRoot

# Attempt recursive delete
Write-Output "Removing node_modules..."
Remove-Item .\node_modules -Recurse -Force -ErrorAction SilentlyContinue
Write-Output "Removing package-lock.json..."
Remove-Item .\package-lock.json -Force -ErrorAction SilentlyContinue

# 4. Clean npm cache
Write-Output "Cleaning npm cache..."
npm cache clean --force

# 5. Install dependencies
Write-Output "Installing dependencies..."
npm install

Write-Output "Done. You can now run `npm start` or `npx expo start`."
