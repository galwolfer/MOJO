## 18-Category System - Implementation Guide

This document describes how the centralized 18-category system works across the Mojo server.

### Overview

**Single Source of Truth**: [src/config/categories.js](src/config/categories.js)

All category references throughout the server should import from this single location to ensure consistency.

### The 18 Categories

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

### Key Components

#### 1. **Central Configuration** (`src/config/categories.js`)

Exports:
```javascript
// Main mappings
CATEGORIES              // {KEY: index} e.g., {STUDY_AND_EDUCATION: 0}
CATEGORY_INDEX_TO_KEY   // {index: key} e.g., {0: 'study_and_education'}
CATEGORY_DISPLAY_NAMES  // {key: display} e.g., {'study_and_education': 'Study & Education'}
CATEGORY_STRING_VALUES  // Array of valid string values for schema validation

// Utility functions
getCategoryIndex(key)         // Get numeric index from key
getCategoryKey(index)         // Get key from numeric index
getDisplayName(category)      // Get human-readable name
isValidCategory(value)        // Validate a category string
getAllCategoryIndices()       // Get [0, 1, ..., 17]
getAllCategoryKeys()          // Get all category keys
```

#### 2. **Task Schema** (`src/models/Task.js`)

```javascript
import { CATEGORY_STRING_VALUES, isValidCategory } from "../config/categories.js";

category: { 
  type: String, 
  enum: CATEGORY_STRING_VALUES,
  validate: {
    validator: function(value) {
      return isValidCategory(value) || value === "";
    },
    message: `Invalid category. Must be one of: ${CATEGORY_STRING_VALUES.join(', ')}`
  },
  default: "",
  trim: true,
  lowercase: true
}
```

**Benefits**:
- Only accepts valid 18-category values
- Lowercase normalization ensures consistent storage
- Enum validation at database level
- Clear error messages for invalid values

#### 3. **Automatic Categorization Flow**

```
Task Created/Modified
    ↓
taskSchema.pre('save')
    ↓
detectTags() → Returns one of 18 categories
    ↓
Category validated & stored
    ↓
generateSubCategory() → Maps category to subcategories
    ↓
Task saved
```

#### 4. **Category Detection** (`src/algorithms/priority/categorizing.js`)

The `detectTags()` function:
- Analyzes task title and description
- Matches keywords to tags
- Maps tags to 18 categories via `TAG_TO_CATEGORY`
- Returns a valid category string (never null/invalid)

```javascript
detectTags({ 
  title: "Learn Python", 
  description: "Complete online course" 
}) 
// Returns: "study_and_education"
```

#### 5. **ML Integration** (`src/utils/mlInputConverter.js`)

The ML system uses numeric indices (0-17):
- `categoryNormalizer()` converts string categories to indices
- `taskToMLInput()` prepares features for the model
- Model outputs 0-17 indices
- Converts back to string keys when storing

```javascript
import { CATEGORIES, CATEGORY_INDEX_TO_KEY } from "../config/categories.js";

const categoryIndex = 7;  // work_and_career
const categoryKey = CATEGORY_INDEX_TO_KEY[categoryIndex]; // "work_and_career"
```

#### 6. **Subcategories** (`src/services/ml/subcategoryGenerator.js`)

Maps each of 18 categories to detailed subcategories:
```javascript
const SUBCATEGORY_MAP = {
  study_and_education: [
    { label: "AI & Machine Learning", keywords: [...] },
    { label: "Mathematics", keywords: [...] },
    // ... more subcategories for this category
  ],
  skill_building: [
    { label: "Programming", keywords: [...] },
    // ... more subcategories
  ],
  // ... all 18 categories
}
```

### Usage Examples

#### ✅ Correct: Import from centralized config

```javascript
// Option 1: Import utilities
import { 
  CATEGORIES, 
  getCategoryIndex, 
  isValidCategory 
} from "../config/categories.js";

// Option 2: Create new category
task.category = "study_and_education";

// Option 3: Validate user input
if (isValidCategory(userInput)) {
  task.category = userInput.toLowerCase();
}

// Option 4: Get display name
console.log(getDisplayName("work_and_career")); // "Work & Career"
```

#### ❌ Incorrect: Hardcoded categories

```javascript
// DON'T: Hard-code category lists
const categories = ["work", "study", "health", ...];

// DON'T: Use arbitrary strings
task.category = "my_custom_category";

// DON'T: Rely on local constants
const MY_CATEGORIES = { WORK: 0, STUDY: 1, ... };
```

### Server-Wide Integration

The following files now use the centralized system:

1. **Task Schema** (`src/models/Task.js`)
   - Validates categories at save time
   - Imports validation functions

2. **Categorizing Algorithm** (`src/algorithms/priority/categorize/categorizing.js`)
   - Returns valid 18-category values only
   - Guarantees output matches centralized list

3. **ML Converter** (`src/utils/mlInputConverter.js`)
   - Uses centralized indices for ML features
   - Converts between strings and numeric indices

4. **Subcategory Generator** (`src/services/ml/subcategoryGenerator.js`)
   - Maps all 18 categories to subcategories
   - Already documented category indices

### Adding New Category-Related Features

When adding new features that reference categories:

1. **Import from centralized config**:
   ```javascript
   import { CATEGORY_STRING_VALUES, isValidCategory } from "../config/categories.js";
   ```

2. **Validate against valid values**:
   ```javascript
   if (!isValidCategory(category)) {
     throw new Error(`Invalid category: ${category}`);
   }
   ```

3. **Use utility functions**:
   ```javascript
   const index = getCategoryIndex(category);
   const display = getDisplayName(category);
   ```

### API Responses

When returning tasks in API responses, categories are strings:

```json
{
  "_id": "...",
  "taskname": "Study ML",
  "category": "study_and_education",
  "subCategory": {
    "label": "Machine Learning",
    "source": "keyword-match",
    "confidence": 0.85,
    "updatedAt": "2026-01-09T12:00:00.000Z"
  }
}
```

Note: Users also have their own saved subcategories stored on the `User` document as an array of `{ name: string, category: number }` (category is the numeric index 0-17). The `get_subcategories` tool combines user-saved subcategories and historical task subcategory labels and returns a deduplicated list of names.

Frontend can use the category string directly or import the centralized config for display purposes.

### Migration Notes

If existing tasks have categories outside the 18-category system:

1. Run a migration script using the centralized config
2. Normalize old values to nearest 18-category match
3. Validate all tasks post-migration

Example:
```javascript
import { isValidCategory } from "../config/categories.js";
import { Task } from "../models/Task.js";

// Find non-standard categories
const invalidTasks = await Task.find({
  category: { $exists: true }
}).then(tasks => 
  tasks.filter(t => !isValidCategory(t.category))
);
```

---

**Last Updated**: January 9, 2026
