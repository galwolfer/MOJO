# Subcategory Management API

## Overview

User-defined subcategories allow users to create personalized task classifications within the 18 main categories. These subcategories are stored per-user and can be used to improve task organization and ML model predictions.

## Endpoints

### 1. Add Custom Subcategory

**POST** `/api/tasks/subcategories`

Add a new subcategory to a specific category for the authenticated user.

#### Request

```json
{
  "name": "Deep Work",
  "category": "work_and_career"
}
```

#### Validation Rules
- `name`: Required, 2-50 characters, trimmed
- `category`: Required, must be one of the 18 valid categories
- Maximum 50 subcategories per category per user
- Duplicate names (case-insensitive) are rejected

#### Response (201 Created)

```json
{
  "success": true,
  "message": "Subcategory added successfully",
  "subcategory": {
    "name": "Deep Work",
    "category": "work_and_career",
    "categoryIndex": 7
  }
}
```

#### Error Responses

**400 Bad Request** - Invalid input
```json
{
  "success": false,
  "error": "Subcategory name must be between 2 and 50 characters"
}
```

**400 Bad Request** - Duplicate
```json
{
  "success": false,
  "error": "Subcategory \"Deep Work\" already exists in Work & Career"
}
```

**400 Bad Request** - Limit reached
```json
{
  "success": false,
  "error": "Maximum 50 subcategories per category reached for Work & Career"
}
```

---

### 2. Get Subcategories

**GET** `/api/tasks/subcategories?category={category}`

Retrieve user's custom subcategories. If `category` query parameter is provided, returns subcategories for that category only (merged with historical task subcategories). Otherwise, returns all subcategories grouped by category.

#### Request Examples

Get all subcategories for a specific category:
```
GET /api/tasks/subcategories?category=work_and_career
```

Get all user subcategories (grouped):
```
GET /api/tasks/subcategories
```

#### Response (with category filter)

```json
{
  "success": true,
  "category": "work_and_career",
  "categoryDisplay": "Work & Career",
  "count": 5,
  "subcategories": [
    "Client Meeting",
    "Deep Work",
    "Email",
    "Planning",
    "Stand-up"
  ]
}
```

**Note:** Results include both:
- User-saved subcategories (from `User.subCategories`)
- Historical subcategories from completed tasks (from `Task.subCategory.label`)
- Merged and deduplicated for convenience

#### Response (all categories)

```json
{
  "success": true,
  "totalCount": 12,
  "subcategoriesByCategory": {
    "7": ["Deep Work", "Client Meeting", "Planning"],
    "0": ["Math Homework", "Reading", "Lab Report"],
    "2": ["Cardio", "Strength Training"]
  }
}
```

**Note:** Keys are category indices (0-17). Use `getCategoryKey()` to convert to readable names.

---

### 3. Delete Subcategory

**DELETE** `/api/tasks/subcategories/:name?category={category}`

Remove a custom subcategory from user's profile. Does NOT affect existing tasks that use this subcategory.

#### Request

```
DELETE /api/tasks/subcategories/Deep%20Work?category=work_and_career
```

#### Response (200 OK)

```json
{
  "success": true,
  "message": "Subcategory removed successfully",
  "removed": {
    "name": "Deep Work",
    "category": "work_and_career"
  }
}
```

#### Error Responses

**400 Bad Request** - Missing category
```json
{
  "success": false,
  "error": "Category query parameter is required"
}
```

**404 Not Found** - Subcategory doesn't exist
```json
{
  "success": false,
  "error": "Subcategory \"Deep Work\" not found in Work & Career"
}
```

---

## Integration with Existing Features

### Task Creation

When creating a task, the subcategory can now come from:
1. User-defined subcategories (stored in `User.subCategories`)
2. Predefined subcategories (from `subcategoryGenerator.js` keyword matching)
3. Historical task subcategories (from previous tasks)

The agent's `get_subcategories` mission already merges these sources.

### Task Model

Tasks store subcategories in the `subCategory` field:

```javascript
{
  subCategory: {
    label: "Deep Work",
    source: "user",  // "user" | "heuristic" | "manual"
    confidence: 1.0,
    updatedAt: Date
  }
}
```

When a user selects their custom subcategory, set `source: "user"` to indicate it's user-defined.

### ML Model Impact

User-defined subcategories provide valuable signals for ML predictions:
- They indicate user intent and task context
- Frequency of subcategory usage can be tracked
- Future enhancement: embed subcategory names into feature vectors

---

## Testing Examples

### Using PowerShell

#### 1. Add subcategory
```powershell
$token = "YOUR_JWT_TOKEN"
$body = @{
    name = "Deep Work"
    category = "work_and_career"
} | ConvertTo-Json

Invoke-RestMethod -Uri "http://localhost:5000/api/tasks/subcategories" `
    -Method POST `
    -Headers @{"Authorization"="Bearer $token"; "Content-Type"="application/json"} `
    -Body $body
```

#### 2. Get subcategories
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/tasks/subcategories?category=work_and_career" `
    -Method GET `
    -Headers @{"Authorization"="Bearer $token"}
```

#### 3. Delete subcategory
```powershell
Invoke-RestMethod -Uri "http://localhost:5000/api/tasks/subcategories/Deep%20Work?category=work_and_career" `
    -Method DELETE `
    -Headers @{"Authorization"="Bearer $token"}
```

---

## Database Schema

### User Model Enhancement

```javascript
subCategories: [{
  name: String,      // "Deep Work"
  category: Number   // 0-17 (category index)
}]
```

This field is already implemented in [User.js](../src/models/User.js#L78-L82).

---

## Valid Categories (Reference)

| Index | Key | Display Name |
|-------|-----|--------------|
| 0 | study_and_education | Study & Education |
| 1 | skill_building | Skill Building |
| 2 | workout | Workout |
| 3 | reflection | Reflection |
| 4 | home_and_chores | Home & Chores |
| 5 | family | Family |
| 6 | life_management | Life Management |
| 7 | work_and_career | Work & Career |
| 8 | creative_projects | Creative Projects |
| 9 | hobbies | Hobbies |
| 10 | relationship | Relationship |
| 11 | goals | Goals |
| 12 | mindfulness | Mindfulness |
| 13 | health | Health |
| 14 | social_activity | Social Activity |
| 15 | recovery | Recovery |
| 16 | exploration | Exploration |
| 17 | uncategorized | Uncategorized |

---

## Next Steps

### Frontend Integration (TODO)
1. Add subcategory management UI to settings screen
2. Update task creation form to show custom subcategories in dropdown
3. Add autocomplete with both predefined + custom subcategories
4. "+" button to create new subcategory inline during task creation

### ML Enhancement (TODO)
1. Add subcategory frequency as ML feature
2. Consider text embeddings for subcategory names
3. Track subcategory-specific completion rates

### Future Improvements
- Allow subcategory renaming
- Bulk import/export of subcategories
- Share subcategories between users (templates)
- Subcategory suggestions based on similar users' choices
