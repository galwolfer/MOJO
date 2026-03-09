# Mojo

<p align="center">
  <img src="frontend/assets/app-logo.png" alt="Mojo Logo" width="200"/>
</p>

Welcome to **Mojo** — an AI-powered productivity app that helps you manage tasks, stay focused, and get things done.

Mojo combines a smart AI assistant, automatic task scheduling, and a mobile-friendly interface so you always know what to work on next.

---

## About the Project

Most task managers just store your to-do list. Mojo actually helps you work through it.

You talk to Mojo in plain language — "add a task to finish the report by Friday" — and it creates the task, scores its priority, and schedules work sessions for you automatically. A daily streak system and smart push notifications keep you motivated and on track.

---

## Features

- **AI Chat Assistant (OJO)** — talk to the app in natural language to add, update, and manage tasks
- **Smart Priority Scoring** — every task gets a priority score based on importance, deadline, and effort
- **Automatic Scheduling** — tasks are broken into focused work sessions and placed in your calendar
- **Four OJO Personalities** — choose your coaching style: Mentor, Bro, Bestie, or Strict Coach

  <p>
    <img src="frontend/assets/mentorojo-icon.png" alt="MentorJo" width="55" title="MentorJo"/>
    <img src="frontend/assets/brojo-icon.png" alt="BroJo" width="55" title="BroJo"/>
    <img src="frontend/assets/bestojo-icon.png" alt="BestoJo" width="55" title="BestoJo"/>
    <img src="frontend/assets/strictojo-icon.png" alt="StrictJo" width="55" title="StrictJo"/>
  </p>

- **Daily Streaks** — stay motivated with a streak counter that resets if you miss a day
- **Push Notifications** — morning digest and smart reminders to keep you on track
- **Overdue Task Alerts** — never miss a deadline
- **Secure Accounts** — personal login with JWT authentication

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| **Frontend** | React Native, Expo, TypeScript |
| **Backend** | Node.js, Express.js |
| **Database** | MongoDB |
| **AI / Chat** | Google Gemini AI, LangChain |
| **Scheduling** | Python (CSP Algorithm) |
| **Notifications** | Expo Push Notifications, Firebase FCM |
| **Auth** | JWT, bcrypt |

---

## Installation

Make sure the following are installed on your machine before you begin:

- [Node.js](https://nodejs.org/) (version 18 or higher)
- [Python](https://www.python.org/) (version 3.9 or higher)
- [MongoDB](https://www.mongodb.com/try/download/community) (local) or a MongoDB Atlas URI
- npm (comes with Node.js)
- pip (comes with Python)

---

## Setup

### 1. Clone the Repository

```bash
git clone <repository-url>
cd Mojo
```

### 2. Backend Setup

```bash
npm install
```

### 3. Frontend Setup

```bash
cd frontend
npm install
cd ..
```

### 4. Environment Variables

Copy the example environment file and fill in your values:

```bash
# macOS / Linux
cp .env.example .env

# Windows PowerShell
Copy-Item .env.example .env
```

Open `.env` and set the following:

```env
# Server
PORT=3000
NODE_ENV=development

# Database
MONGODB_URI=mongodb://localhost:27017/mojo

# Authentication
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Google Gemini AI
GEMINI_API_KEY=your_gemini_api_key_here

# Your machine's local IP (needed when testing on a physical Android device)
DEFAULT_MACHINE_IP=192.168.1.100
```

To get a free Gemini API key, visit [Google AI Studio](https://aistudio.google.com/).

> **Physical device tip:** If you run the app on a real phone (not an emulator), set `DEFAULT_MACHINE_IP` to your computer's local IP address so the app can reach the backend. Find it with `ipconfig` (Windows) or `ifconfig` (macOS/Linux).

---

## Running the Project

You will need **two terminal windows** open at the same time.

### Terminal 1 — Start the Backend

```bash
npm run dev
```

You should see:
```
Server running on http://localhost:3000
MongoDB connected
```

### Terminal 2 — Start the Frontend

```bash
cd frontend
npx expo start
```

Then:
- Press **`a`** to open in an Android emulator
- Press **`i`** to open in an iOS simulator
- Scan the **QR code** with the Expo Go app on your phone
- Press **`w`** to open in your browser

> **Note:** Make sure MongoDB is running before starting the backend.
> - On Windows: start the MongoDB service from Services or run `mongod`
> - On macOS/Linux: `sudo service mongod start`

---

## How to Use the System

Once the app is running:

1. **Create an account** or log in through the onboarding screen
2. **Pick your OJO personality** — the coaching style you prefer
3. **Open the Chat screen** and start talking to OJO:
   - *"Add a task to study for the exam on Thursday"*
   - *"What should I work on today?"*
   - *"Show me all my tasks"*
   - *"Mark my gym task as done"*
4. **Check your Calendar** to see scheduled work sessions
5. **Track your streak** and complete tasks daily to keep it going

---

## Project Structure

```
Mojo/
├── src/                  # Backend — server, API, AI agent, services
│   ├── server.js         # Entry point
│   ├── agent/            # OJO AI chat agent
│   ├── controllers/      # Route logic
│   ├── models/           # Database schemas
│   ├── services/         # Business logic and background jobs
│   ├── algorithms/       # Priority scoring and scheduling
│   └── predict_model/    # ML prediction service (Python)
│
├── frontend/             # Mobile app (React Native + Expo)
│   ├── screens/          # App screens (chat, calendar, tasks, settings)
│   ├── components/       # Reusable UI components
│   ├── navigation/       # Screen navigation
│   ├── services/         # API calls
│   └── assets/           # Images, fonts, animations
│
├── scripts/              # Helper scripts (register, login, test)
├── docs/                 # Feature documentation
├── .env.example          # Environment variable template
└── README.md
```

---

## Authors

- **Ofek Avan Danan**
- **Gal Wolfer**
- **Jonathan Tchebiner**

---

We sincerely appreciate you taking the time to explore our project.
This app represents many hours of hard work, collaboration, and a genuine desire to build something useful.

If you have any questions or feedback, feel free to reach out!
