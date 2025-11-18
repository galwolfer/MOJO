# Mojo Workflow Flowchart

## High-Level System Overview

```mermaid
flowchart TB
    User([User]) --> CLI[Interactive CLI]
    CLI --> Auth{Authenticated?}
    Auth -->|No| Register[Register/Login]
    Register --> Auth
    Auth -->|Yes| Actions[Main Actions]
    
    Actions --> ManageTasks[Manage Tasks]
    Actions --> GetRecommendations[Get Recommendations]
    Actions --> ScheduleTasks[Schedule Tasks]
    
    ManageTasks --> DB[(MongoDB)]
    GetRecommendations --> Algorithm[Priority Algorithm]
    ScheduleTasks --> Calendar[Calendar Planner]
    
    Algorithm --> DB
    Calendar --> DB
    DB --> Display[Display Results]
    Display --> CLI
    
    style User fill:#90EE90
    style DB fill:#87CEEB
    style Algorithm fill:#FFD700
    style Calendar fill:#9370DB
```

## Simple Architecture

```mermaid
flowchart LR
    CLI[CLI Interface] --> Services[Business Logic]
    Services --> Database[(MongoDB)]
    Database --> Services
    Services --> CLI
    
    subgraph Services
        Priority[Task Priority]
        Tags[Auto-Tagging]
        Schedule[Calendar Scheduling]
    end
    
    subgraph Database
        Users[(Users)]
        Tasks[(Tasks)]
        Schedules[(Schedules)]
    end
```

## Core Workflow

```mermaid
flowchart TD
    Start([Start Application]) --> Connect[Connect to Database]
    Connect --> MainLoop{Main Menu}
    
    MainLoop -->|Add Task| CreateTask[Create Task with Details]
    CreateTask --> AutoProcess[Auto-tag & Score Task]
    AutoProcess --> Save[Save to Database]
    Save --> MainLoop
    
    MainLoop -->|Get Recommendation| Fetch[Fetch Open Tasks]
    Fetch --> Score[Calculate Priority Scores]
    Score --> Rank[Return Top Task]
    Rank --> MainLoop
    
    MainLoop -->|Plan Schedule| GetTasks[Get Unscheduled Tasks]
    GetTasks --> FindSlots[Find Available Time Slots]
    FindSlots --> Assign[Assign Tasks to Slots]
    Assign --> SaveSchedule[Save Schedule]
    SaveSchedule --> MainLoop
    
    MainLoop -->|Exit| End([Exit])
    
    style Start fill:#90EE90
    style End fill:#FFB6C1
    style AutoProcess fill:#FFD700
    style Score fill:#9370DB
```

## Detailed System Architecture

```mermaid
flowchart TB
    Start([User Starts CLI]) --> Connect[Connect to MongoDB]
    Connect --> Menu[Display Main Menu]
    
    Menu --> Choice{User Choice}
    
    %% Authentication Flow
    Choice -->|1. Register| Reg[Enter Username & Password]
    Reg --> HashPwd[Hash Password with bcrypt]
    HashPwd --> SaveUser[Save User to MongoDB]
    SaveUser --> Profile[Complete Preference Questionnaire]
    Profile --> Menu
    
    Choice -->|2. Login| Login[Enter Credentials]
    Login --> VerifyPwd{Verify Password}
    VerifyPwd -->|Invalid| LoginFail[Show Error]
    LoginFail --> Menu
    VerifyPwd -->|Valid| SetSession[Set Current User]
    SetSession --> Menu
    
    %% Task Management Flow
    Choice -->|3. Add Task| AddTask[Enter Task Details]
    AddTask --> TaskDetails[Title, Description, Importance, Effort, Due Date]
    TaskDetails --> AutoTag[Auto-detect Tags]
    AutoTag --> SaveTask[Save Task to MongoDB]
    SaveTask --> UpdateScores[Trigger Priority Score Update]
    UpdateScores --> Menu
    
    Choice -->|4. List Tasks| FetchTasks[Query User's Tasks from DB]
    FetchTasks --> DisplayTasks[Display All Tasks with Details]
    DisplayTasks --> Menu
    
    %% Recommendation Flow
    Choice -->|5. Recommend Next Task| GetOpenTasks[Fetch Open Tasks]
    GetOpenTasks --> ScoreTasks[Score Activities with Priority Algorithm]
    ScoreTasks --> CalcFactors[Calculate: Importance + Effort + Deadline + Tags]
    CalcFactors --> RankTasks[Rank Tasks by Score]
    RankTasks --> ShowTop[Display Top Recommended Task]
    ShowTop --> Menu
    
    %% Suggestion Flow
    Choice -->|6. Suggest New Task| GetProfile[Load User Profile & Preferences]
    GetProfile --> AnalyzeProfile[Analyze Life Areas: Work, Study, Health, etc.]
    AnalyzeProfile --> SuggestTask[Generate Task Suggestion]
    SuggestTask --> ShowSuggestion[Display Suggestion to User]
    ShowSuggestion --> Menu
    
    %% Planning Flow
    Choice -->|7. Plan Tasks| SelectTasks[Select Tasks to Schedule]
    SelectTasks --> LoadCalendar[Load Busy Blocks & Routines]
    LoadCalendar --> FindFreeSlots[Calculate Free Time Intervals]
    FindFreeSlots --> AllocateTime[Allocate Task Durations to Slots]
    AllocateTime --> SaveSchedule[Persist TaskSchedule to DB]
    SaveSchedule --> ShowPlan[Display Planned Schedule]
    ShowPlan --> Menu
    
    %% Schedule Management Flow
    Choice -->|8. View Schedule| QuerySchedule[Query TaskSchedule from DB]
    QuerySchedule --> DisplaySchedule[Display Upcoming Sessions]
    DisplaySchedule --> Menu
    
    Choice -->|9. Update Schedule| SelectSession[Select Schedule Entry]
    SelectSession --> ModifySession[Mark as Done/Skipped or Adjust Time]
    ModifySession --> UpdateDB[Update TaskSchedule in DB]
    UpdateDB --> Menu
    
    %% Calendar Constraints Flow
    Choice -->|10. Calendar Constraints| CalendarMenu{Calendar Submenu}
    CalendarMenu -->|Set Working Hours| SetHours[Define Start/End Times]
    SetHours --> SaveHours[Save to User Profile]
    SaveHours --> Menu
    CalendarMenu -->|Manage Routines| ManageRoutine[Add/View Routine Blocks]
    ManageRoutine --> SaveRoutine[Save BusyBlock to DB]
    SaveRoutine --> Menu
    CalendarMenu -->|Back| Menu
    
    %% Exit Flow
    Choice -->|0. Exit| Cleanup[Close Database Connection]
    Cleanup --> End([Goodbye Message])
    
    style Start fill:#90EE90
    style End fill:#FFB6C1
    style Connect fill:#87CEEB
    style SaveTask fill:#FFD700
    style UpdateScores fill:#FF6B6B
    style RankTasks fill:#9370DB
    style AllocateTime fill:#20B2AA
```

## Data Flow Architecture

```mermaid
flowchart LR
    subgraph CLI["CLI Layer (User Interface)"]
        UserInput[User Input]
        Display[Display Output]
    end
    
    subgraph Services["Service Layer (Business Logic)"]
        Priority[Priority Scoring]
        Tagging[Auto-Tagging]
        Suggestions[Task Suggestions]
        Planner[Calendar Planner]
        Calendar[Calendar Utils]
        Routine[Routine Blocks]
        Telemetry[Event Logging]
    end
    
    subgraph API["Express API Layer"]
        Routes[Routes]
        Controllers[Controllers]
        Middleware[Middleware]
    end
    
    subgraph Database["MongoDB (Data Storage)"]
        UserModel[(User Collection)]
        TaskModel[(Task Collection)]
        ScheduleModel[(TaskSchedule Collection)]
        BusyModel[(BusyBlock Collection)]
        EventModel[(EventLog Collection)]
    end
    
    UserInput --> Services
    Services --> API
    API --> Database
    Database --> Services
    Services --> Display
    
    Priority -.-> TaskModel
    Tagging -.-> TaskModel
    Planner -.-> ScheduleModel
    Routine -.-> BusyModel
    Telemetry -.-> EventModel
```

## Task Lifecycle

```mermaid
stateDiagram-v2
    [*] --> Created: User adds task
    Created --> AutoTagged: Detect tags from title/description
    AutoTagged --> Scored: Calculate priority score
    Scored --> Todo: Initial state
    
    Todo --> InProgress: User starts working
    Todo --> Planned: Task scheduled to calendar
    Planned --> InProgress: Scheduled time arrives
    
    InProgress --> Todo: User pauses
    InProgress --> Done: User completes
    
    Done --> [*]: Task archived
    
    Todo --> Updated: User modifies task
    InProgress --> Updated: User modifies task
    Updated --> Rescored: Recalculate priority
    Rescored --> Todo
    Rescored --> InProgress
```

## Priority Scoring Algorithm

```mermaid
flowchart TD
    Task[Task Input] --> ExtractFactors[Extract Factors]
    
    ExtractFactors --> Importance[Importance: 1-5]
    ExtractFactors --> Effort[Effort: 1-5]
    ExtractFactors --> Deadline[Due Date]
    ExtractFactors --> Tags[Tags/Categories]
    ExtractFactors --> Status[Status: todo/in_progress/done]
    
    Importance --> Calculate[Calculate Base Score]
    Effort --> Calculate
    
    Deadline --> Urgency{Days Until Due?}
    Urgency -->|< 1 day| UrgentBoost[+High Boost]
    Urgency -->|1-3 days| MediumBoost[+Medium Boost]
    Urgency -->|> 3 days| LowBoost[+Small Boost]
    Urgency -->|No deadline| NoBoost[No boost]
    
    Tags --> MatchProfile{Match User Profile?}
    MatchProfile -->|Yes| ProfileBoost[+Profile Weight]
    MatchProfile -->|No| NoProfileBoost[Standard weight]
    
    Status --> FilterOpen{Is Open?}
    FilterOpen -->|Yes| Calculate
    FilterOpen -->|No| Exclude[Exclude from ranking]
    
    Calculate --> UrgentBoost
    Calculate --> MediumBoost
    Calculate --> LowBoost
    Calculate --> NoBoost
    
    UrgentBoost --> ProfileBoost
    MediumBoost --> ProfileBoost
    LowBoost --> ProfileBoost
    NoBoost --> ProfileBoost
    
    ProfileBoost --> FinalScore[Final Priority Score]
    NoProfileBoost --> FinalScore
    
    FinalScore --> SaveScore[Update Task.priorityScore]
    SaveScore --> Rank[Rank All Tasks]
```

## User Profile & Preferences

```mermaid
mindmap
    root((User Profile))
        Life Areas
            Work/Projects
            Study/Learning
            Health/Fitness
            Social/Family
            Finance/Admin
            Household
            Creative
        Preferences
            Importance Weight: 1-5
            Focus Level: 1-5
            Urgency: 1-5
        Calendar Settings
            Working Hours
                Start Time
                End Time
            Routine Blocks
                Morning Routine
                Evening Routine
                Regular Meetings
            Busy Blocks
                One-time Events
                Unavailable Periods
```

