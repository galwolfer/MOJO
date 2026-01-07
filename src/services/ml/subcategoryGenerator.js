/**
 * @fileoverview Subcategory Generator Service
 * @module services/ml/subcategoryGenerator
 * 
 * Maps task text to predefined subcategories using keyword matching.
 * Each of the 18 main categories has a set of subcategories with associated keywords.
 * 
 * Key responsibilities:
 * - Match task title/description keywords to predefined subcategories
 * - Return the best matching subcategory for the task's category
 * - Support manual user overrides
 * 
 * Algorithm: Simple keyword matching with category-scoped subcategory lookup
 * Output: { label: string, source: string, confidence: number }
 */

/**
 * SUBCATEGORY_MAP: Maps each of the 18 categories to their subcategories.
 * Each subcategory has a display label and associated keywords for matching.
 * 
 * Categories (0-17):
 * 0: study_and_education, 1: skill_building, 2: workout, 3: reflection,
 * 4: home_and_chores, 5: family, 6: life_management, 7: work_and_career,
 * 8: creative_projects, 9: hobbies, 10: relationship, 11: goals,
 * 12: mindfulness, 13: health, 14: social_activity, 15: recovery,
 * 16: exploration, 17: uncategorized
 */
const SUBCATEGORY_MAP = {
  // 0: Study & Education
  study_and_education: [
    { label: "AI & Machine Learning", keywords: ["ai", "ml", "machine learning", "deep learning", "neural", "gpt", "llm", "artificial intelligence", "tensorflow", "pytorch"] },
    { label: "Mathematics", keywords: ["math", "calculus", "algebra", "geometry", "statistics", "probability", "trigonometry", "linear algebra", "equations"] },
    { label: "Science", keywords: ["science", "physics", "chemistry", "biology", "lab", "experiment", "research", "scientific"] },
    { label: "Computer Science", keywords: ["programming", "coding", "algorithm", "data structure", "software", "computer", "code", "development", "debugging"] },
    { label: "Languages", keywords: ["language", "english", "spanish", "french", "german", "chinese", "japanese", "hebrew", "arabic", "grammar", "vocabulary", "duolingo"] },
    { label: "History", keywords: ["history", "historical", "ancient", "medieval", "war", "civilization", "century"] },
    { label: "Literature", keywords: ["literature", "novel", "poetry", "shakespeare", "fiction", "book report", "essay", "writing"] },
    { label: "Business", keywords: ["business", "economics", "finance", "accounting", "marketing", "management", "mba"] },
    { label: "Medicine", keywords: ["medicine", "medical", "anatomy", "physiology", "nursing", "healthcare", "clinical"] },
    { label: "Law", keywords: ["law", "legal", "court", "contract", "constitution", "criminal", "civil"] },
    { label: "Art History", keywords: ["art history", "renaissance", "baroque", "impressionism", "modern art", "museum"] },
    { label: "Psychology", keywords: ["psychology", "cognitive", "behavioral", "therapy", "mental", "freud", "jung"] },
    { label: "Philosophy", keywords: ["philosophy", "ethics", "logic", "metaphysics", "epistemology", "plato", "aristotle"] },
    { label: "Engineering", keywords: ["engineering", "mechanical", "electrical", "civil", "structural", "thermodynamics"] },
    { label: "Exam Prep", keywords: ["exam", "test", "quiz", "midterm", "final", "sat", "gre", "gmat", "toefl", "ielts"] },
    { label: "Homework", keywords: ["homework", "assignment", "worksheet", "problem set", "exercise"] },
    { label: "Lecture", keywords: ["lecture", "class", "lesson", "course", "seminar", "webinar", "tutorial"] },
    { label: "Research", keywords: ["research", "thesis", "dissertation", "paper", "study", "investigation", "analysis"] },
    { label: "Reading", keywords: ["reading", "textbook", "chapter", "article", "journal", "publication"] },
    { label: "General Study", keywords: ["study", "learn", "review", "notes", "flashcard"] },
  ],

  // 1: Skill Building
  skill_building: [
    { label: "Programming", keywords: ["programming", "coding", "javascript", "python", "java", "react", "node", "typescript", "frontend", "backend", "api"] },
    { label: "Design", keywords: ["design", "ui", "ux", "figma", "sketch", "photoshop", "illustrator", "graphic"] },
    { label: "Music", keywords: ["music", "piano", "guitar", "violin", "drums", "singing", "instrument", "practice", "scales", "chords"] },
    { label: "Cooking", keywords: ["cooking", "recipe", "baking", "cuisine", "culinary", "chef", "kitchen"] },
    { label: "Writing", keywords: ["writing", "copywriting", "blogging", "content", "creative writing", "storytelling"] },
    { label: "Public Speaking", keywords: ["speaking", "presentation", "speech", "debate", "toastmasters", "rhetoric"] },
    { label: "Photography", keywords: ["photography", "camera", "lightroom", "editing", "portrait", "landscape", "photo"] },
    { label: "Video Production", keywords: ["video", "editing", "premiere", "davinci", "filmmaking", "cinematography", "youtube"] },
    { label: "Leadership", keywords: ["leadership", "management", "delegation", "team building", "mentoring"] },
    { label: "Networking", keywords: ["networking", "linkedin", "connections", "professional", "career networking"] },
    { label: "Negotiation", keywords: ["negotiation", "bargaining", "deal", "persuasion", "influence"] },
    { label: "Time Management", keywords: ["time management", "productivity", "efficiency", "organization", "planning"] },
    { label: "Communication", keywords: ["communication", "interpersonal", "listening", "feedback", "empathy"] },
    { label: "Data Analysis", keywords: ["data", "excel", "sql", "tableau", "analytics", "visualization", "dashboard"] },
    { label: "Marketing", keywords: ["marketing", "seo", "social media", "ads", "branding", "campaign"] },
    { label: "Sales", keywords: ["sales", "selling", "cold call", "pitch", "closing", "crm"] },
    { label: "Language Learning", keywords: ["language", "vocabulary", "grammar", "fluency", "conversation", "accent"] },
    { label: "DIY & Crafts", keywords: ["diy", "craft", "woodworking", "sewing", "knitting", "handmade"] },
    { label: "General Skill", keywords: ["skill", "practice", "improve", "learn", "develop", "training", "workshop"] },
  ],

  // 2: Workout
  workout: [
    { label: "Strength Training", keywords: ["strength", "weights", "lifting", "bench", "squat", "deadlift", "barbell", "dumbbell", "resistance"] },
    { label: "Cardio", keywords: ["cardio", "running", "jogging", "treadmill", "elliptical", "cycling", "bike", "spinning", "aerobic"] },
    { label: "HIIT", keywords: ["hiit", "interval", "tabata", "circuit", "high intensity", "burpee"] },
    { label: "Yoga", keywords: ["yoga", "vinyasa", "hatha", "ashtanga", "flow", "pose", "asana", "stretch"] },
    { label: "Pilates", keywords: ["pilates", "core", "reformer", "mat", "barre"] },
    { label: "Swimming", keywords: ["swimming", "pool", "laps", "freestyle", "backstroke", "breaststroke"] },
    { label: "Sports", keywords: ["basketball", "soccer", "football", "tennis", "volleyball", "baseball", "hockey", "golf", "badminton"] },
    { label: "Martial Arts", keywords: ["martial arts", "boxing", "mma", "karate", "judo", "taekwondo", "kickboxing", "muay thai", "jiu jitsu", "bjj"] },
    { label: "CrossFit", keywords: ["crossfit", "wod", "amrap", "emom", "box jump", "pull up", "muscle up"] },
    { label: "Flexibility", keywords: ["flexibility", "stretching", "mobility", "foam roll", "warmup", "cooldown"] },
    { label: "Walking", keywords: ["walk", "walking", "steps", "hike", "hiking", "stroll"] },
    { label: "Dance", keywords: ["dance", "zumba", "salsa", "hip hop", "ballet", "choreography"] },
    { label: "Outdoor Activity", keywords: ["outdoor", "park", "trail", "nature", "climbing", "rock climbing", "kayak", "paddle"] },
    { label: "Home Workout", keywords: ["home workout", "bodyweight", "no equipment", "at home", "living room"] },
    { label: "Gym Session", keywords: ["gym", "fitness center", "workout", "exercise", "training", "session", "weights room"] },
  ],

  // 3: Reflection
  reflection: [
    { label: "Daily Journal", keywords: ["journal", "journaling", "diary", "daily reflection", "morning pages", "evening reflection"] },
    { label: "Gratitude", keywords: ["gratitude", "thankful", "grateful", "appreciation", "blessings"] },
    { label: "Goal Review", keywords: ["goal review", "progress", "milestone", "achievement", "check in"] },
    { label: "Self Assessment", keywords: ["self assessment", "self evaluation", "strengths", "weaknesses", "improvement"] },
    { label: "Weekly Review", keywords: ["weekly review", "week recap", "weekly reflection", "week summary"] },
    { label: "Monthly Review", keywords: ["monthly review", "month recap", "monthly reflection", "month summary"] },
    { label: "Year Review", keywords: ["year review", "annual", "yearly", "year end", "retrospective"] },
    { label: "Lessons Learned", keywords: ["lesson", "learned", "takeaway", "insight", "realization"] },
    { label: "Decision Review", keywords: ["decision", "choice", "options", "pros cons", "evaluate"] },
    { label: "Emotional Check-in", keywords: ["emotional", "feelings", "mood", "how am i", "check in", "wellbeing"] },
    { label: "Values Reflection", keywords: ["values", "principles", "beliefs", "priorities", "what matters"] },
    { label: "Life Audit", keywords: ["life audit", "life review", "life assessment", "balance", "satisfaction"] },
    { label: "General Reflection", keywords: ["reflect", "reflection", "think", "ponder", "contemplate", "introspect"] },
  ],

  // 4: Home & Chores
  home_and_chores: [
    { label: "Cleaning", keywords: ["clean", "cleaning", "dust", "vacuum", "mop", "scrub", "wipe", "sanitize", "tidy"] },
    { label: "Laundry", keywords: ["laundry", "wash", "clothes", "fold", "iron", "dryer", "washing machine"] },
    { label: "Dishes", keywords: ["dishes", "dishwasher", "wash dishes", "kitchen sink", "pots", "pans"] },
    { label: "Cooking", keywords: ["cook", "cooking", "meal prep", "dinner", "lunch", "breakfast", "recipe"] },
    { label: "Grocery Shopping", keywords: ["grocery", "groceries", "shopping", "supermarket", "food shopping", "market"] },
    { label: "Organization", keywords: ["organize", "organization", "declutter", "sort", "arrange", "storage", "closet"] },
    { label: "Gardening", keywords: ["garden", "gardening", "plant", "water plants", "lawn", "mow", "yard", "landscaping"] },
    { label: "Home Repair", keywords: ["repair", "fix", "maintenance", "broken", "replace", "install", "plumbing", "electrical"] },
    { label: "Pet Care", keywords: ["pet", "dog", "cat", "feed", "walk dog", "vet", "groom", "litter"] },
    { label: "Trash & Recycling", keywords: ["trash", "garbage", "recycling", "bins", "take out", "waste"] },
    { label: "Bed Making", keywords: ["bed", "make bed", "sheets", "blanket", "pillow", "bedroom"] },
    { label: "Bathroom", keywords: ["bathroom", "toilet", "shower", "bath", "towels"] },
    { label: "Car Care", keywords: ["car", "vehicle", "wash car", "oil change", "tire", "gas", "fuel"] },
    { label: "Errands", keywords: ["errand", "errands", "pickup", "drop off", "post office", "bank", "pharmacy"] },
    { label: "General Chore", keywords: ["chore", "chores", "housework", "household", "home task"] },
  ],

  // 5: Family
  family: [
    { label: "Kids Activities", keywords: ["kids", "children", "child", "son", "daughter", "playground", "playdate", "school pickup"] },
    { label: "Parenting", keywords: ["parenting", "parent", "mom", "dad", "discipline", "bedtime", "homework help"] },
    { label: "Family Time", keywords: ["family time", "family activity", "together", "bonding", "quality time"] },
    { label: "Family Dinner", keywords: ["family dinner", "dinner together", "meal together", "eating together"] },
    { label: "School", keywords: ["school", "pta", "teacher", "conference", "school event", "report card"] },
    { label: "Birthday", keywords: ["birthday", "party", "celebration", "cake", "present", "gift"] },
    { label: "Anniversary", keywords: ["anniversary", "wedding anniversary", "celebration", "special day"] },
    { label: "Holiday", keywords: ["holiday", "christmas", "hanukkah", "thanksgiving", "easter", "passover", "new year"] },
    { label: "Elderly Care", keywords: ["elderly", "parent care", "grandparent", "senior", "aging", "assisted"] },
    { label: "Family Call", keywords: ["call family", "video call", "facetime", "zoom family", "check in family", "call mom", "call dad", "call parents", "phone mom", "phone dad"] },
    { label: "Family Trip", keywords: ["family trip", "vacation", "travel", "road trip", "family outing"] },
    { label: "Babysitting", keywords: ["babysit", "babysitter", "nanny", "childcare", "daycare"] },
    { label: "General Family", keywords: ["family", "relative", "sibling", "brother", "sister", "cousin", "aunt", "uncle"] },
  ],

  // 6: Life Management
  life_management: [
    { label: "Budgeting", keywords: ["budget", "budgeting", "expense", "spending", "money management", "financial plan"] },
    { label: "Bills & Payments", keywords: ["bill", "bills", "payment", "pay", "due", "invoice", "utilities", "rent", "mortgage"] },
    { label: "Banking", keywords: ["bank", "banking", "account", "transfer", "deposit", "withdrawal", "atm"] },
    { label: "Taxes", keywords: ["tax", "taxes", "irs", "tax return", "deduction", "w2", "1099", "accountant"] },
    { label: "Insurance", keywords: ["insurance", "policy", "coverage", "claim", "premium", "health insurance", "car insurance"] },
    { label: "Investments", keywords: ["investment", "investing", "stock", "portfolio", "401k", "ira", "retirement", "savings"] },
    { label: "Legal", keywords: ["legal", "lawyer", "attorney", "contract", "document", "notary", "will", "estate"] },
    { label: "Appointments", keywords: ["appointment", "schedule", "booking", "reservation", "slot", "calendar"] },
    { label: "Subscriptions", keywords: ["subscription", "cancel", "renew", "membership", "monthly", "annual"] },
    { label: "Documents", keywords: ["document", "paperwork", "file", "scan", "print", "copy", "passport", "id", "license"] },
    { label: "Moving", keywords: ["move", "moving", "relocation", "packing", "boxes", "new home", "apartment"] },
    { label: "Admin Tasks", keywords: ["admin", "administrative", "email", "correspondence", "form", "application"] },
    { label: "General Life Admin", keywords: ["life admin", "personal admin", "manage", "organize life", "adulting"] },
  ],

  // 7: Work & Career
  work_and_career: [
    { label: "Meetings", keywords: ["meeting", "call", "conference", "standup", "sync", "one on one", "1:1", "team meeting"] },
    { label: "Project Work", keywords: ["project", "deliverable", "milestone", "sprint", "task", "work item", "jira", "trello"] },
    { label: "Email", keywords: ["email", "inbox", "reply", "follow up", "correspondence", "outlook", "gmail"] },
    { label: "Reports", keywords: ["report", "reporting", "analysis", "dashboard", "metrics", "kpi", "presentation"] },
    { label: "Client Work", keywords: ["client", "customer", "stakeholder", "account", "client call", "client meeting"] },
    { label: "Deadline", keywords: ["deadline", "due date", "urgent", "priority", "asap", "time sensitive"] },
    { label: "Networking", keywords: ["networking", "linkedin", "connection", "coffee chat", "informational", "career"] },
    { label: "Job Search", keywords: ["job search", "resume", "cv", "cover letter", "application", "interview", "hiring"] },
    { label: "Training", keywords: ["training", "onboarding", "workshop", "certification", "course", "professional development"] },
    { label: "Performance Review", keywords: ["performance", "review", "feedback", "evaluation", "assessment", "goals"] },
    { label: "Team Collaboration", keywords: ["team", "collaboration", "teamwork", "colleague", "coworker", "slack"] },
    { label: "Strategy", keywords: ["strategy", "planning", "roadmap", "vision", "objectives", "okr"] },
    { label: "Administration", keywords: ["admin", "expense report", "timesheet", "hr", "pto", "leave", "vacation request"] },
    { label: "General Work", keywords: ["work", "office", "job", "career", "professional", "business"] },
  ],

  // 8: Creative Projects
  creative_projects: [
    { label: "Writing", keywords: ["writing", "write", "novel", "story", "blog", "article", "screenplay", "poetry", "creative writing"] },
    { label: "Art & Drawing", keywords: ["art", "drawing", "sketch", "paint", "painting", "illustration", "canvas", "watercolor"] },
    { label: "Music", keywords: ["music", "compose", "song", "lyrics", "record", "produce", "beat", "melody"] },
    { label: "Photography", keywords: ["photography", "photo", "shoot", "camera", "editing", "lightroom", "portrait"] },
    { label: "Video & Film", keywords: ["video", "film", "movie", "editing", "premiere", "youtube", "vlog", "documentary"] },
    { label: "Graphic Design", keywords: ["graphic design", "logo", "branding", "poster", "flyer", "photoshop", "illustrator", "canva"] },
    { label: "Web Design", keywords: ["web design", "website", "ui", "ux", "wireframe", "prototype", "figma"] },
    { label: "Crafts", keywords: ["craft", "diy", "handmade", "scrapbook", "jewelry", "pottery", "ceramics"] },
    { label: "Sewing & Textiles", keywords: ["sewing", "knitting", "crochet", "embroidery", "quilting", "fabric", "pattern"] },
    { label: "Woodworking", keywords: ["woodworking", "carpentry", "wood", "furniture", "carving", "workshop"] },
    { label: "3D & Animation", keywords: ["3d", "animation", "blender", "maya", "render", "modeling", "cgi"] },
    { label: "Game Development", keywords: ["game", "game dev", "unity", "unreal", "indie", "level design"] },
    { label: "Podcast", keywords: ["podcast", "audio", "recording", "episode", "interview", "hosting"] },
    { label: "General Creative", keywords: ["creative", "project", "create", "make", "build", "design"] },
  ],

  // 9: Hobbies
  hobbies: [
    { label: "Gaming", keywords: ["gaming", "game", "video game", "pc", "console", "playstation", "xbox", "nintendo", "steam"] },
    { label: "Reading", keywords: ["reading", "book", "novel", "kindle", "ebook", "library", "fiction", "nonfiction"] },
    { label: "Gardening", keywords: ["gardening", "garden", "plant", "flowers", "herbs", "vegetables", "greenhouse"] },
    { label: "Cooking", keywords: ["cooking", "baking", "recipe", "cuisine", "culinary", "kitchen", "food"] },
    { label: "Sports", keywords: ["sports", "basketball", "soccer", "tennis", "golf", "swimming", "cycling"] },
    { label: "Music", keywords: ["music", "instrument", "guitar", "piano", "drums", "singing", "band", "concert"] },
    { label: "Movies & TV", keywords: ["movie", "film", "tv", "series", "netflix", "streaming", "cinema", "show"] },
    { label: "Collecting", keywords: ["collect", "collection", "stamp", "coin", "card", "memorabilia", "antique"] },
    { label: "Puzzles & Games", keywords: ["puzzle", "crossword", "sudoku", "board game", "chess", "trivia", "escape room"] },
    { label: "Outdoors", keywords: ["outdoor", "hiking", "camping", "fishing", "hunting", "nature", "trail"] },
    { label: "Photography", keywords: ["photography", "camera", "photo", "landscape", "portrait", "editing"] },
    { label: "Travel", keywords: ["travel", "trip", "vacation", "explore", "adventure", "destination", "tourism"] },
    { label: "Pets", keywords: ["pet", "dog", "cat", "aquarium", "bird", "animal", "pet care"] },
    { label: "DIY Projects", keywords: ["diy", "project", "build", "make", "craft", "home improvement"] },
    { label: "General Hobby", keywords: ["hobby", "leisure", "pastime", "interest", "fun", "enjoyment"] },
  ],

  // 10: Relationship
  relationship: [
    { label: "Date Night", keywords: ["date", "date night", "romantic", "dinner date", "movie date", "couple"] },
    { label: "Quality Time", keywords: ["quality time", "together", "bonding", "connect", "spend time"] },
    { label: "Communication", keywords: ["talk", "conversation", "discuss", "communicate", "listen", "share"] },
    { label: "Anniversary", keywords: ["anniversary", "celebration", "special day", "milestone", "remember"] },
    { label: "Gift & Surprise", keywords: ["gift", "present", "surprise", "flowers", "thoughtful", "romantic gesture"] },
    { label: "Travel Together", keywords: ["trip", "vacation", "travel", "getaway", "weekend", "adventure together"] },
    { label: "Shared Activity", keywords: ["activity", "hobby together", "class", "workout together", "cook together"] },
    { label: "Meeting Family", keywords: ["meet family", "in laws", "parents", "family gathering", "introduce"] },
    { label: "Conflict Resolution", keywords: ["conflict", "argument", "resolve", "apologize", "forgive", "make up"] },
    { label: "Future Planning", keywords: ["future", "plan", "goals", "moving in", "engagement", "wedding", "family planning"] },
    { label: "General Relationship", keywords: ["relationship", "partner", "spouse", "boyfriend", "girlfriend", "significant other", "love"] },
  ],

  // 11: Goals
  goals: [
    { label: "Career Goals", keywords: ["career goal", "promotion", "job", "professional", "raise", "position"] },
    { label: "Financial Goals", keywords: ["financial goal", "savings", "investment", "retirement", "debt free", "net worth"] },
    { label: "Health Goals", keywords: ["health goal", "weight", "fitness", "diet", "quit smoking", "wellness"] },
    { label: "Education Goals", keywords: ["education goal", "degree", "certification", "course", "learn", "graduate"] },
    { label: "Personal Growth", keywords: ["personal growth", "self improvement", "habit", "mindset", "development"] },
    { label: "Relationship Goals", keywords: ["relationship goal", "marriage", "family", "friendship", "social"] },
    { label: "Creative Goals", keywords: ["creative goal", "project", "publish", "create", "art", "writing"] },
    { label: "Travel Goals", keywords: ["travel goal", "bucket list", "destination", "trip", "explore"] },
    { label: "Short-term Goals", keywords: ["short term", "this week", "this month", "quick win", "immediate"] },
    { label: "Long-term Goals", keywords: ["long term", "5 year", "10 year", "life goal", "vision", "dream"] },
    { label: "Milestone Tracking", keywords: ["milestone", "progress", "checkpoint", "achievement", "track"] },
    { label: "General Goal", keywords: ["goal", "objective", "target", "aim", "aspiration", "resolution"] },
  ],

  // 12: Mindfulness
  mindfulness: [
    { label: "Meditation", keywords: ["meditation", "meditate", "guided", "silent", "zen", "mindful", "headspace", "calm"] },
    { label: "Breathing", keywords: ["breathing", "breath", "breathwork", "deep breath", "pranayama", "box breathing"] },
    { label: "Yoga", keywords: ["yoga", "asana", "flow", "stretch", "pose", "vinyasa", "hatha"] },
    { label: "Gratitude Practice", keywords: ["gratitude", "thankful", "appreciation", "grateful", "blessings"] },
    { label: "Body Scan", keywords: ["body scan", "relaxation", "tension", "awareness", "progressive"] },
    { label: "Walking Meditation", keywords: ["walking meditation", "mindful walk", "nature walk", "slow walk"] },
    { label: "Visualization", keywords: ["visualization", "visualize", "imagine", "mental image", "manifestation"] },
    { label: "Affirmations", keywords: ["affirmation", "positive", "self talk", "mantra", "intention"] },
    { label: "Journaling", keywords: ["journal", "journaling", "writing", "reflection", "thoughts", "feelings"] },
    { label: "Digital Detox", keywords: ["digital detox", "unplug", "screen free", "phone free", "offline"] },
    { label: "Nature Connection", keywords: ["nature", "outdoors", "forest", "park", "grounding", "earthing"] },
    { label: "General Mindfulness", keywords: ["mindful", "mindfulness", "present", "awareness", "conscious", "centered"] },
  ],

  // 13: Health
  health: [
    { label: "Doctor Visit", keywords: ["doctor", "physician", "appointment", "checkup", "clinic", "hospital", "medical"] },
    { label: "Dentist", keywords: ["dentist", "dental", "teeth", "cleaning", "cavity", "orthodontist"] },
    { label: "Medication", keywords: ["medication", "medicine", "prescription", "pill", "pharmacy", "refill", "dose"] },
    { label: "Mental Health", keywords: ["mental health", "therapy", "therapist", "counseling", "psychologist", "psychiatrist"] },
    { label: "Nutrition", keywords: ["nutrition", "diet", "meal plan", "healthy eating", "calories", "macros", "vitamins"] },
    { label: "Sleep", keywords: ["sleep", "rest", "insomnia", "bedtime", "nap", "sleep schedule", "sleep hygiene"] },
    { label: "Eye Care", keywords: ["eye", "optometrist", "glasses", "contacts", "vision", "eye exam"] },
    { label: "Physical Therapy", keywords: ["physical therapy", "pt", "rehabilitation", "injury", "recovery", "exercises"] },
    { label: "Specialist", keywords: ["specialist", "dermatologist", "cardiologist", "neurologist", "allergist", "urologist"] },
    { label: "Vaccination", keywords: ["vaccine", "vaccination", "shot", "immunization", "flu shot", "booster"] },
    { label: "Lab Work", keywords: ["lab", "blood test", "bloodwork", "results", "screening", "test results"] },
    { label: "Preventive Care", keywords: ["preventive", "screening", "checkup", "annual", "wellness visit"] },
    { label: "General Health", keywords: ["health", "wellness", "wellbeing", "healthy", "symptom", "condition"] },
  ],

  // 14: Social Activity
  social_activity: [
    { label: "Friends Hangout", keywords: ["friends", "hangout", "hang out", "buddy", "pal", "catch up", "get together"] },
    { label: "Party", keywords: ["party", "celebration", "gathering", "bash", "event", "host"] },
    { label: "Dinner Out", keywords: ["dinner", "restaurant", "eat out", "dining", "brunch", "lunch out"] },
    { label: "Coffee Chat", keywords: ["coffee", "cafe", "tea", "chat", "catch up", "meet up"] },
    { label: "Night Out", keywords: ["night out", "bar", "club", "drinks", "nightlife", "going out"] },
    { label: "Group Activity", keywords: ["group", "team", "club", "class", "meetup", "community"] },
    { label: "Game Night", keywords: ["game night", "board game", "cards", "poker", "trivia", "game"] },
    { label: "Sports Event", keywords: ["sports event", "game", "match", "stadium", "arena", "watch party"] },
    { label: "Concert & Shows", keywords: ["concert", "show", "performance", "theater", "music", "live"] },
    { label: "Networking Event", keywords: ["networking", "event", "conference", "meetup", "professional"] },
    { label: "Video Call", keywords: ["video call", "zoom", "facetime", "skype", "virtual", "call friends"] },
    { label: "General Social", keywords: ["social", "socialize", "people", "meet", "connect", "interaction"] },
  ],

  // 15: Recovery
  recovery: [
    { label: "Rest Day", keywords: ["rest", "rest day", "relax", "recovery day", "take it easy", "recharge", "day off", "off day"] },
    { label: "Sleep Recovery", keywords: ["sleep", "nap", "catch up", "sleep in", "extra sleep", "tired"] },
    { label: "Physical Recovery", keywords: ["physical", "body", "sore", "muscle", "injury", "healing", "ice", "heat"] },
    { label: "Mental Recovery", keywords: ["mental", "stress", "burnout", "overwhelm", "decompress", "destress"] },
    { label: "Stretching", keywords: ["stretch", "stretching", "flexibility", "foam roll", "mobility"] },
    { label: "Massage", keywords: ["massage", "spa", "therapy", "bodywork", "relaxation"] },
    { label: "Light Activity", keywords: ["light", "gentle", "easy", "walk", "stroll", "light exercise"] },
    { label: "Hydration", keywords: ["hydration", "water", "fluids", "drink", "electrolytes"] },
    { label: "Nutrition Recovery", keywords: ["nutrition", "protein", "meal", "refuel", "post workout"] },
    { label: "Meditation", keywords: ["meditation", "calm", "relax", "mindful", "breathing"] },
    { label: "Illness Recovery", keywords: ["sick", "illness", "flu", "cold", "recover", "get better"] },
    { label: "General Recovery", keywords: ["recovery", "restoration", "rejuvenate", "refresh"] },
  ],

  // 16: Exploration
  exploration: [
    { label: "Travel", keywords: ["travel", "trip", "vacation", "journey", "destination", "flight", "hotel"] },
    { label: "Local Exploration", keywords: ["local", "neighborhood", "city", "town", "explore", "discover"] },
    { label: "Nature", keywords: ["nature", "park", "trail", "hike", "forest", "beach", "mountain", "lake"] },
    { label: "Museums & Culture", keywords: ["museum", "gallery", "exhibit", "culture", "art", "history", "tour"] },
    { label: "Food Exploration", keywords: ["food", "restaurant", "cuisine", "try", "new place", "foodie", "tasting"] },
    { label: "Adventure", keywords: ["adventure", "thrill", "extreme", "adrenaline", "challenge", "exciting"] },
    { label: "Road Trip", keywords: ["road trip", "drive", "scenic", "route", "highway", "cross country"] },
    { label: "Photography Trip", keywords: ["photo", "photography", "shoot", "capture", "scenic", "landscape"] },
    { label: "Learning Journey", keywords: ["learn", "workshop", "class", "course", "new skill", "experience"] },
    { label: "Meetup & Events", keywords: ["meetup", "event", "festival", "fair", "market", "gathering"] },
    { label: "Solo Exploration", keywords: ["solo", "alone", "independent", "self discovery", "personal"] },
    { label: "General Exploration", keywords: ["explore", "discovery", "new", "adventure", "experience", "curiosity"] },
  ],

  // 17: Uncategorized
  uncategorized: [
    { label: "Quick Task", keywords: ["quick", "fast", "simple", "easy", "brief", "short"] },
    { label: "Reminder", keywords: ["reminder", "remember", "don't forget", "note to self"] },
    { label: "Follow Up", keywords: ["follow up", "check back", "revisit", "review", "update"] },
    { label: "Research", keywords: ["research", "look up", "find out", "investigate", "search"] },
    { label: "Planning", keywords: ["plan", "planning", "prepare", "organize", "schedule"] },
    { label: "Waiting", keywords: ["waiting", "pending", "hold", "expect", "response"] },
    { label: "Miscellaneous", keywords: ["misc", "other", "random", "various", "general"] },
  ],
};

// Build a reverse lookup: keyword -> { category, subcategoryLabel }
const KEYWORD_TO_SUBCATEGORY = new Map();
for (const [category, subcategories] of Object.entries(SUBCATEGORY_MAP)) {
  for (const { label, keywords } of subcategories) {
    for (const keyword of keywords) {
      const key = keyword.toLowerCase();
      if (!KEYWORD_TO_SUBCATEGORY.has(key)) {
        KEYWORD_TO_SUBCATEGORY.set(key, []);
      }
      KEYWORD_TO_SUBCATEGORY.get(key).push({ category, label });
    }
  }
}

/**
 * Normalize text into lowercase tokens for keyword matching
 */
const tokenize = (text = "") =>
  String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 1);

/**
 * Check if user manually set the subcategory (should be respected)
 */
const shouldRespectManual = (subCategory = {}) => {
  if (!subCategory || typeof subCategory !== "object") return false;
  if (!subCategory.label) return false;
  return subCategory.source === "user" || subCategory.source === "imported";
};

/**
 * Get the default subcategory for a category (last item in the list, typically "General X")
 */
const getDefaultSubcategory = (category) => {
  const subcategories = SUBCATEGORY_MAP[category];
  if (!subcategories || subcategories.length === 0) return null;
  return subcategories[subcategories.length - 1];
};

/**
 * Find matching subcategory based on text and category
 */
function findSubcategory(text = "", category = "") {
  const tokens = tokenize(text);
  const normalizedCategory = (category || "").toLowerCase().replace(/[^a-z_]/g, "");
  
  // Get subcategories for this category
  const categorySubcategories = SUBCATEGORY_MAP[normalizedCategory] || SUBCATEGORY_MAP.uncategorized;
  
  // Score each subcategory based on keyword matches
  const scores = new Map();
  
  for (const { label, keywords } of categorySubcategories) {
    let score = 0;
    
    for (const keyword of keywords) {
      const kwLower = keyword.toLowerCase();
      const kwTokens = kwLower.split(/\s+/);
      const textLower = text.toLowerCase();
      
      // Check for multi-word keyword match (phrase match)
      if (kwTokens.length > 1) {
        if (textLower.includes(kwLower)) {
          score += kwTokens.length * 3; // Strong bonus for phrase match
        }
      } else {
        // Single word keyword - check for exact token match
        for (const token of tokens) {
          // Exact match gets highest score
          if (token === kwLower) {
            score += 3;
          }
          // Token starts with keyword (e.g., "gym" matches "gymnasium")
          else if (token.startsWith(kwLower) && kwLower.length >= 3) {
            score += 2;
          }
          // Keyword starts with token (e.g., "med" matches "meditation") - only if token is substantial
          else if (kwLower.startsWith(token) && token.length >= 4) {
            score += 1;
          }
        }
      }
    }
    
    if (score > 0) {
      scores.set(label, score);
    }
  }
  
  // Find the best match
  let bestLabel = null;
  let bestScore = 0;
  
  for (const [label, score] of scores) {
    if (score > bestScore) {
      bestScore = score;
      bestLabel = label;
    }
  }
  
  if (bestLabel) {
    // Confidence based on score (capped at 0.95)
    const confidence = Math.min(0.95, 0.5 + bestScore * 0.1);
    return { label: bestLabel, confidence, source: "keyword-match" };
  }
  
  // Fallback to default subcategory for this category
  const defaultSub = getDefaultSubcategory(normalizedCategory);
  if (defaultSub) {
    return { label: defaultSub.label, confidence: 0.3, source: "category-default" };
  }
  
  return null;
}

/**
 * Main function to generate subcategory for a task
 * 
 * @param {Object} options
 * @param {string} options.userId - User ID (not used in manual mapping but kept for API compatibility)
 * @param {string} options.title - Task title
 * @param {string} options.description - Task description
 * @param {string[]} options.categories - Task categories array
 * @param {Object} options.current - Current subcategory (for manual override check)
 * @param {Object} options.TaskModel - Mongoose model (not used in manual mapping)
 * @returns {Object} { label, source, confidence, updatedAt }
 */
export async function generateSubCategory({
  userId,
  title = "",
  description = "",
  categories = [],
  current = {},
  TaskModel = null,
} = {}) {
  // Respect user-set subcategories
  if (shouldRespectManual(current)) {
    return {
      label: current.label.trim(),
      source: current.source,
      confidence: Math.max(0.5, Math.min(1, current.confidence ?? 0.8)),
      updatedAt: current.updatedAt || new Date(),
    };
  }

  // Combine title and description for keyword matching
  const combinedText = `${title || ""} ${description || ""}`.trim();
  
  // Get the primary category (first one in the array)
  const primaryCategory = Array.isArray(categories) && categories.length > 0
    ? String(categories[0] || "").toLowerCase().replace(/[^a-z_]/g, "")
    : "uncategorized";
  
  // Find matching subcategory
  const result = findSubcategory(combinedText, primaryCategory);
  
  if (result) {
    return {
      label: result.label,
      source: result.source,
      confidence: result.confidence,
      updatedAt: new Date(),
    };
  }
  
  // Ultimate fallback
  return {
    label: "General",
    source: "fallback",
    confidence: 0.2,
    updatedAt: new Date(),
  };
}

/**
 * Get all available subcategories for a given category
 * Useful for UI dropdowns
 * 
 * @param {string} category - The category key
 * @returns {string[]} Array of subcategory labels
 */
export function getSubcategoriesForCategory(category) {
  const normalizedCategory = (category || "").toLowerCase().replace(/[^a-z_]/g, "");
  const subcategories = SUBCATEGORY_MAP[normalizedCategory] || SUBCATEGORY_MAP.uncategorized;
  return subcategories.map(({ label }) => label);
}

/**
 * Get all categories and their subcategories
 * Useful for UI or documentation
 * 
 * @returns {Object} Map of category -> subcategory labels
 */
export function getAllSubcategories() {
  const result = {};
  for (const [category, subcategories] of Object.entries(SUBCATEGORY_MAP)) {
    result[category] = subcategories.map(({ label }) => label);
  }
  return result;
}

// Export the subcategory map for external use if needed
export { SUBCATEGORY_MAP };
