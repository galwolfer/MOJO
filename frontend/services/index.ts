// Barrel export for services

// Core configuration and HTTP client
export { getApiBase, setApiBase, DEFAULT_MACHINE_IP } from "./config";
export { setAuthToken } from "./httpClient";

// Authentication services
export * from "./apiClient";

// Chat services
export * from "./chatService";
