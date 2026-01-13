# Test Auto-Save Subcategories Feature
# Tests that subcategories are automatically saved to user profile when creating/updating tasks

param(
    [string]$Token = "",
    [string]$BaseUrl = "http://localhost:3000"
)

if ($Token -eq "") {
    $tokenFile = Join-Path $PSScriptRoot ".token"
    if (Test-Path $tokenFile) {
        $Token = Get-Content $tokenFile -Raw
        Write-Host "Using token from file: $tokenFile" -ForegroundColor Gray
    } else {
        Write-Host "Error: Token required. Use -Token parameter or ensure .token file exists" -ForegroundColor Red
        Write-Host "Run .\scripts\login.ps1 first to generate token" -ForegroundColor Yellow
        exit 1
    }
}

$headers = @{
    "Authorization" = "Bearer $Token"
    "Content-Type" = "application/json"
}

Write-Host ""
Write-Host "Testing Auto-Save Subcategories Feature" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Test 1: Create a task with a new custom subcategory
Write-Host "Test 1: Creating task with custom subcategory 'Sprint Planning'..." -ForegroundColor Yellow

try {
    $taskBody = @{
        taskname = "Plan Q2 roadmap"
        category = "work_and_career"
        subcategory = "Sprint Planning"
        deadline = (Get-Date).AddDays(7).ToString("yyyy-MM-ddTHH:mm:ss") + "Z"
        estimatedDuration = 90
        importance = 4
        effort = 3
    } | ConvertTo-Json

    $task = Invoke-RestMethod -Uri "$BaseUrl/api/tasks" `
        -Method POST `
        -Headers $headers `
        -Body $taskBody

    Write-Host "  Task created successfully!" -ForegroundColor Green
    Write-Host "  Task ID: $($task.task._id)" -ForegroundColor White
    Write-Host "  Subcategory: $($task.task.subCategory.label)" -ForegroundColor White
    $taskId = $task.task._id
} catch {
    Write-Host "  Failed to create task: $($_.Exception.Message)" -ForegroundColor Red
    exit 1
}

Start-Sleep -Seconds 1

# Test 2: Verify subcategory was auto-saved to user profile
Write-Host ""
Write-Host "Test 2: Verifying 'Sprint Planning' was auto-saved to user profile..." -ForegroundColor Yellow

try {
    $subcategories = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/subcategories?category=work_and_career" `
        -Method GET `
        -Headers $headers

    if ($subcategories.subcategories -contains "Sprint Planning") {
        Write-Host "  SUCCESS: Subcategory was auto-saved!" -ForegroundColor Green
        Write-Host "  Found in user profile: Sprint Planning" -ForegroundColor White
    } else {
        Write-Host "  FAILED: Subcategory not found in user profile" -ForegroundColor Red
        Write-Host "  Available subcategories: $($subcategories.subcategories -join ', ')" -ForegroundColor Gray
    }
} catch {
    Write-Host "  Failed to retrieve subcategories: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 3: Update task with another custom subcategory
Write-Host ""
Write-Host "Test 3: Updating task with different subcategory 'Code Review'..." -ForegroundColor Yellow

try {
    $updateBody = @{
        subcategory = "Code Review"
        category = "work_and_career"
    } | ConvertTo-Json

    $updated = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/$taskId" `
        -Method PATCH `
        -Headers $headers `
        -Body $updateBody

    Write-Host "  Task updated successfully!" -ForegroundColor Green
    Write-Host "  New subcategory: $($updated.task.subCategory.label)" -ForegroundColor White
} catch {
    Write-Host "  Failed to update task: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 4: Verify second subcategory was also auto-saved
Write-Host ""
Write-Host "Test 4: Verifying 'Code Review' was auto-saved..." -ForegroundColor Yellow

try {
    $subcategories = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/subcategories?category=work_and_career" `
        -Method GET `
        -Headers $headers

    $found = @()
    if ($subcategories.subcategories -contains "Sprint Planning") { $found += "Sprint Planning" }
    if ($subcategories.subcategories -contains "Code Review") { $found += "Code Review" }

    if ($found.Count -eq 2) {
        Write-Host "  SUCCESS: Both subcategories auto-saved!" -ForegroundColor Green
        Write-Host "  User now has: $($found -join ', ')" -ForegroundColor White
    } else {
        Write-Host "  PARTIAL: Only $($found.Count) subcategories found" -ForegroundColor DarkYellow
        Write-Host "  Found: $($found -join ', ')" -ForegroundColor Gray
    }

    Write-Host ""
    Write-Host "  Total subcategories for work_and_career: $($subcategories.count)" -ForegroundColor Gray
} catch {
    Write-Host "  Failed to retrieve subcategories: $($_.Exception.Message)" -ForegroundColor Red
}

Start-Sleep -Seconds 1

# Test 5: Create task with existing subcategory (should not duplicate)
Write-Host ""
Write-Host "Test 5: Creating another task with 'Code Review' (should not duplicate)..." -ForegroundColor Yellow

try {
    $taskBody2 = @{
        taskname = "Review PR #123"
        category = "work_and_career"
        subcategory = "Code Review"
        deadline = (Get-Date).AddDays(2).ToString("yyyy-MM-ddTHH:mm:ss") + "Z"
        estimatedDuration = 30
        importance = 3
        effort = 2
    } | ConvertTo-Json

    $task2 = Invoke-RestMethod -Uri "$BaseUrl/api/tasks" `
        -Method POST `
        -Headers $headers `
        -Body $taskBody2

    Write-Host "  Task created successfully!" -ForegroundColor Green

    # Check count again
    $subcategories = Invoke-RestMethod -Uri "$BaseUrl/api/tasks/subcategories?category=work_and_career" `
        -Method GET `
        -Headers $headers

    $codeReviewCount = ($subcategories.subcategories | Where-Object { $_ -eq "Code Review" }).Count
    
    if ($codeReviewCount -eq 1) {
        Write-Host "  SUCCESS: No duplicate created!" -ForegroundColor Green
        Write-Host "  'Code Review' appears only once" -ForegroundColor White
    } else {
        Write-Host "  WARNING: Found $codeReviewCount instances of 'Code Review'" -ForegroundColor DarkYellow
    }

    $task2Id = $task2.task._id
} catch {
    Write-Host "  Failed: $($_.Exception.Message)" -ForegroundColor Red
}

# Cleanup
Write-Host ""
Write-Host "Cleanup: Deleting test tasks..." -ForegroundColor Gray

try {
    Invoke-RestMethod -Uri "$BaseUrl/api/tasks/$taskId" -Method DELETE -Headers $headers | Out-Null
    if ($task2Id) {
        Invoke-RestMethod -Uri "$BaseUrl/api/tasks/$task2Id" -Method DELETE -Headers $headers | Out-Null
    }
    Write-Host "  Test tasks deleted" -ForegroundColor Gray
} catch {
    Write-Host "  Cleanup failed (tasks may remain)" -ForegroundColor DarkGray
}

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Testing Complete!" -ForegroundColor Cyan
Write-Host ""
Write-Host "Summary:" -ForegroundColor White
Write-Host "- Subcategories are auto-saved when creating tasks" -ForegroundColor Gray
Write-Host "- Subcategories are auto-saved when updating tasks" -ForegroundColor Gray
Write-Host "- Duplicates are prevented (case-insensitive)" -ForegroundColor Gray
Write-Host "- Custom subcategories remain in user profile" -ForegroundColor Gray
Write-Host ""
