# MOJO Project Complete Reset Script
# This script will reset your project to a fresh state

Write-Host "🔄 MOJO Complete Reset" -ForegroundColor Cyan
Write-Host "=====================`n" -ForegroundColor Cyan

# Confirmation
$confirm = Read-Host "This will delete ALL data (database, users, cache). Continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "❌ Reset cancelled" -ForegroundColor Yellow
    exit
}

Write-Host "`n📦 Step 1: Stopping any running processes..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Get-Process expo -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 2

Write-Host "✅ Processes stopped`n" -ForegroundColor Green

Write-Host "🗄️  Step 2: Clearing MongoDB database..." -ForegroundColor Yellow
try {
    # Drop the entire mojo database
    $mongoCommand = "use mojo; db.dropDatabase();"
    $mongoCommand | mongosh --quiet 2>&1 | Out-Null
    Write-Host "✅ Database cleared`n" -ForegroundColor Green
} catch {
    Write-Host "⚠️  MongoDB clear failed (maybe not running?): $_" -ForegroundColor Yellow
    Write-Host "   You may need to clear it manually with: mongosh mojo --eval 'db.dropDatabase()'`n" -ForegroundColor Yellow
}

Write-Host "🧹 Step 3: Cleaning backend dependencies..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force node_modules
    Write-Host "   Removed node_modules" -ForegroundColor Gray
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force package-lock.json
    Write-Host "   Removed package-lock.json" -ForegroundColor Gray
}
Write-Host "✅ Backend cleaned`n" -ForegroundColor Green

Write-Host "🧹 Step 4: Cleaning frontend dependencies..." -ForegroundColor Yellow
Push-Location frontend
if (Test-Path "node_modules") {
    Remove-Item -Recurse -Force node_modules
    Write-Host "   Removed frontend/node_modules" -ForegroundColor Gray
}
if (Test-Path "package-lock.json") {
    Remove-Item -Force package-lock.json
    Write-Host "   Removed frontend/package-lock.json" -ForegroundColor Gray
}
if (Test-Path ".expo") {
    Remove-Item -Recurse -Force .expo
    Write-Host "   Removed .expo cache" -ForegroundColor Gray
}
Pop-Location
Write-Host "✅ Frontend cleaned`n" -ForegroundColor Green

Write-Host "🗑️  Step 5: Cleaning uploads and temp files..." -ForegroundColor Yellow
if (Test-Path "uploads") {
    Get-ChildItem uploads -File | Remove-Item -Force
    Write-Host "   Cleared uploads directory" -ForegroundColor Gray
}
Write-Host "✅ Temp files cleaned`n" -ForegroundColor Green

Write-Host "📥 Step 6: Reinstalling backend dependencies..." -ForegroundColor Yellow
npm install
Write-Host "✅ Backend dependencies installed`n" -ForegroundColor Green

Write-Host "📥 Step 7: Reinstalling frontend dependencies..." -ForegroundColor Yellow
Push-Location frontend
npm install
Pop-Location
Write-Host "✅ Frontend dependencies installed`n" -ForegroundColor Green

Write-Host "🎉 Reset Complete!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Make sure MongoDB is running: mongod" -ForegroundColor White
Write-Host "2. Start backend server: npm run dev" -ForegroundColor White
Write-Host "3. Start frontend: cd frontend; npx expo start" -ForegroundColor White
Write-Host "4. Create a new account in the app`n" -ForegroundColor White
