# Services Directory

This directory contains all API service modules for the frontend application. All API calls are centralized here for maintainability and consistency.

## Architecture

### Core Modules

#### `config.ts`
- **Purpose**: Centralized API base URL configuration
- **Exports**:
  - `DEFAULT_MACHINE_IP` - Default IP for Android/development (configurable)
  - `getApiBase()` - Get current API base URL
  - `setApiBase(url)` - Override API base URL
- **Features**:
  - Automatic platform detection (web/Android)
  - Environment variable support (`API_BASE`, `HOST_IP`, `PORT`)
  - Metro dev server auto-detection for Android

#### `httpClient.ts`
- **Purpose**: Shared HTTP client for all API requests
- **Exports**:
  - `get<T>(endpoint)` - GET request
  - `post<T>(endpoint, body?)` - POST request
  - `put<T>(endpoint, body?)` - PUT request
  - `patch<T>(endpoint, body?)` - PATCH request
  - `del<T>(endpoint)` - DELETE request
  - `setAuthToken(token)` - Set authentication token
- **Features**:
  - Automatic header injection (Content-Type, Authorization)
  - Unified error handling
  - Type-safe responses

### Service Modules

#### `apiClient.ts`
- **Purpose**: Authentication services
- **Endpoints**:
  - `login(payload)` - POST /api/auth/login
  - `register(payload)` - POST /api/auth/register
- **Types**: `LoginRequest`, `RegisterRequest`, `AuthResponse`

#### `chatService.ts`
- **Purpose**: Chat/messaging services
- **Endpoints**:
  - `sendChatMessage(payload)` - POST /api/chat/message
  - `getChatHistory(sessionId)` - GET /api/chat/history/:sessionId
  - `resetChatSession(sessionId)` - POST /api/chat/reset
  - `checkChatHealth()` - GET /api/chat/health
- **Types**: `SendMessageRequest`, `SendMessageResponse`, `ChatHistoryResponse`, etc.
- **Aliases**: `setChatAuthToken()` - convenience wrapper for `setAuthToken()`

## Usage

### Basic Setup

```typescript
import { setApiBase, setAuthToken } from "@/services";

// Optional: Override default API base
setApiBase("http://192.168.1.100:3000/api");

// Set auth token after login
setAuthToken(token);
```

### Authentication

```typescript
import { login, register } from "@/services";

// Login
const response = await login({ 
  username: "user", 
  password: "pass" 
});

// Register
const response = await register({
  username: "newuser",
  email: "user@example.com",
  password: "pass123",
  displayName: "New User"
});

// Both return: { success, token, user }
```

### Chat

```typescript
import { 
  sendChatMessage, 
  getChatHistory, 
  setChatAuthToken 
} from "@/services";

// Set auth token (required)
setChatAuthToken(token);

// Send message
const response = await sendChatMessage({
  message: "Hello!",
  sessionId: "session_123" // optional
});

// Get history
const history = await getChatHistory("session_123");
```

### Adding New Services

1. **Create service file** in `services/` directory
2. **Import shared modules**:
   ```typescript
   import { get, post, put, del } from "./httpClient";
   ```
3. **Define types** for requests/responses
4. **Implement API functions** using HTTP client methods
5. **Export** from `services/index.ts`:
   ```typescript
   export * from "./yourNewService";
   ```

### Example: Adding a new service

```typescript
// services/taskService.ts
import { get, post, put, del } from "./httpClient";

export type Task = {
  id: string;
  title: string;
  completed: boolean;
};

export async function getTasks(): Promise<Task[]> {
  return get<Task[]>("/tasks");
}

export async function createTask(title: string): Promise<Task> {
  return post<Task>("/tasks", { title });
}

export async function updateTask(id: string, updates: Partial<Task>): Promise<Task> {
  return put<Task>(`/tasks/${id}`, updates);
}

export async function deleteTask(id: string): Promise<void> {
  return del<void>(`/tasks/${id}`);
}
```

## Configuration

### Environment Variables

- `API_BASE` - Full API base URL (e.g., `http://localhost:3000/api`)
- `HOST_IP` / `LOCAL_IP` - Machine IP for Android development
- `PORT` / `REACT_APP_PORT` - Server port

### Android Development

For Android physical devices or emulators to connect to your dev server:

1. Update `DEFAULT_MACHINE_IP` in `config.ts` to your machine's local IP
2. Or set `HOST_IP` environment variable
3. The system will auto-detect Metro's dev server host when available

## Best Practices

1. **Always use the shared HTTP client** - Never call `fetch` directly
2. **Define TypeScript types** for all requests and responses
3. **Use descriptive function names** - e.g., `getUserProfile()` not `get()`
4. **Document endpoints** - Include HTTP method and path in JSDoc
5. **Handle errors in components** - Let errors propagate up from services
6. **Keep services thin** - Business logic belongs in components/hooks, not services

## Testing

```typescript
// Mock in tests
jest.mock("@/services/httpClient", () => ({
  get: jest.fn(),
  post: jest.fn(),
  // ...
}));
```
