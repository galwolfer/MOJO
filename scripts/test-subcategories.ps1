# Test script for Subcategory Management API
# Prerequisites: Server running on localhost:5000, user logged in

param(
    [string]$Token = "",
    [string]$BaseUrl = "http://localhost:5000"
)

if ($Token -eq "") {
    Write-Host "❌ Error: Token required. Use -Token parameter or run login.ps1 first" -ForegroundColor Red
    Write-Host "Example: .\test-subcategories.ps1 -Token 'YOUR_JWT_TOKEN'" -ForegroundColor Yellow
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

Write-Host "`n🧪 Testing Subcategory Management API" -ForegroundColor Cyan
Write-Host "========================================`n" -ForegroundColor Cyan

# Test 1: Add subcategories
Write-Host "📝 Test 1: Adding custom subcategories..." -ForegroundColor Yellow

$subcategoriesToAdd = @(
    @{ name = "Deep Work"; category = "work_and_career" },
    @{ name = "Client Meeting"; category = "work_and_career" },
    @{ name = "Math Homework"; category = "study_and_education" },
    @{ name = "HIIT Training"; category = "workout" }
)

foreach ($sub in $subcategoriesToAdd) {
    try {
        $body = $sub | ConvertTo-Json
        $response = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/subcategories" `
            -Method POST `
            -Headers $headers `
            -Body $body
        
        Write-Host "  ✅ Added: $($sub.name) → $($sub.category)" -ForegroundColor Green
    } catch {
        $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "  ⚠️  $($sub.name): $($errorMsg.error)" -ForegroundColor DarkYellow
    }
}

Start-Sleep -Seconds 1

# Test 2: Get subcategories for specific category
Write-Host "`n📋 Test 2: Retrieving work_and_career subcategories..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/subcategories?category=work_and_career" `
        -Method GET `
        -Headers $headers
    
    Write-Host "  ✅ Found $($response.count) subcategories:" -ForegroundColor Green
    $response.subcategories | ForEach-Object {
        Write-Host "     • $_" -ForegroundColor White
    }
} catch {
    Write-Host "  ❌ Failed to retrieve subcategories" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 3: Get all subcategories
Write-Host "`n📋 Test 3: Retrieving all subcategories..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/subcategories" `
        -Method GET `
        -Headers $headers
    
    Write-Host "  ✅ Total: $($response.totalCount) subcategories across all categories" -ForegroundColor Green
    
    foreach ($categoryIndex in $response.subcategoriesByCategory.PSObject.Properties.Name) {
        $subs = $response.subcategoriesByCategory.$categoryIndex
        Write-Host "     Category $categoryIndex`: $($subs -join ', ')" -ForegroundColor White
    }
} catch {
    Write-Host "  ❌ Failed to retrieve all subcategories" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 4: Validation tests
Write-Host "`n🔍 Test 4: Validation checks..." -ForegroundColor Yellow

# Test 4a: Duplicate
Write-Host "  Testing duplicate rejection..." -ForegroundColor Gray
try {
    $body = @{ name = "Deep Work"; category = "work_and_career" } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/subcategories" `
        -Method POST `
        -Headers $headers `
        -Body $body
    Write-Host "    ⚠️  Duplicate was allowed (should have been rejected)" -ForegroundColor DarkYellow
} catch {
    $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "    ✅ Duplicate correctly rejected: $($errorMsg.error)" -ForegroundColor Green
}

# Test 4b: Invalid category
Write-Host "  Testing invalid category..." -ForegroundColor Gray
try {
    $body = @{ name = "Test"; category = "invalid_category" } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/subcategories" `
        -Method POST `
        -Headers $headers `
        -Body $body
    Write-Host "    ⚠️  Invalid category was allowed (should have been rejected)" -ForegroundColor DarkYellow
} catch {
    $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "    ✅ Invalid category correctly rejected" -ForegroundColor Green
}

# Test 4c: Empty name
Write-Host "  Testing empty name..." -ForegroundColor Gray
try {
    $body = @{ name = ""; category = "workout" } | ConvertTo-Json
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/subcategories" `
        -Method POST `
        -Headers $headers `
        -Body $body
    Write-Host "    ⚠️  Empty name was allowed (should have been rejected)" -ForegroundColor DarkYellow
} catch {
    $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "    ✅ Empty name correctly rejected" -ForegroundColor Green
}

Start-Sleep -Seconds 1

# Test 5: Delete subcategory
Write-Host "`n🗑️  Test 5: Deleting a subcategory..." -ForegroundColor Yellow

try {
    $nameToDelete = "HIIT Training"
    $encodedName = [System.Uri]::EscapeDataString($nameToDelete)
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/subcategories/${encodedName}?category=workout" `
        -Method DELETE `
        -Headers $headers
    
    Write-Host "  ✅ Deleted: $nameToDelete" -ForegroundColor Green
} catch {
    $errorMsg = $_.ErrorDetails.Message | ConvertFrom-Json
    Write-Host "  ❌ Failed to delete: $($errorMsg.error)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 6: Verify deletion
Write-Host "`n🔍 Test 6: Verifying deletion..." -ForegroundColor Yellow

try {
    $response = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/subcategories?category=workout" `
        -Method GET `
        -Headers $headers
    
    if ($response.subcategories -contains "HIIT Training") {
        Write-Host "  ❌ Deletion failed - subcategory still exists" -ForegroundColor Red
    } else {
        Write-Host "  ✅ Deletion confirmed - subcategory removed" -ForegroundColor Green
    }
} catch {
    Write-Host "  ❌ Failed to verify deletion" -ForegroundColor Red
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Note: Some subcategories added during this test remain in your account." -ForegroundColor Gray
Write-Host "You can delete them manually or via the DELETE endpoint." -ForegroundColor Gray
Write-Host ""
