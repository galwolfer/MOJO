/**
 * User Profile API Service
 *
 * Handles fetching user profile data, stats, friends, and progress.
 */

import { get } from "./httpClient";

// Types
export type UserStats = {
  tasks: number;
  points: number;
  streak: number;
};

export type UserProgress = {
  data: number[];
  labels?: string[];
};

export type Friend = {
  id: string;
  name: string;
  avatar: string | null;
  isOnline: boolean;
  stats: {
    tasks: number;
    streak: number;
    points: number;
  };
};

export type UserProfileData = {
  user: {
    id: string;
    username: string;
    displayName?: string;
    email?: string;
    profileImage?: string | null;
  };
  stats: UserStats;
  progress: UserProgress;
  friends: Friend[];
};

/**
 * Get user profile stats
 * GET /api/user/stats
 */
export async function getUserStats(): Promise<UserStats> {
  try {
    const response = await get<{ success: boolean; stats: UserStats }>("/user/stats");
    return response.stats;
  } catch (error) {
    console.warn("Failed to fetch user stats, using defaults:", error);
    // Return mock data as fallback
    return { tasks: 0, points: 0, streak: 0 };
  }
}

/**
 * Get user progress data for the graph
 * GET /api/user/progress
 */
export async function getUserProgress(): Promise<UserProgress> {
  try {
    const response = await get<{ success: boolean; progress: UserProgress }>("/user/progress");
    return response.progress;
  } catch (error) {
    console.warn("Failed to fetch user progress, using defaults:", error);
    // Return mock data as fallback
    return { data: [20, 35, 25, 50, 45, 60, 55, 70, 65, 80, 75] };
  }
}

/**
 * Get user's friends list
 * GET /api/user/friends
 */
export async function getUserFriends(): Promise<Friend[]> {
  try {
    const response = await get<{ success: boolean; friends: Friend[] }>("/user/friends");
    return response.friends;
  } catch (error) {
    console.warn("Failed to fetch friends, using defaults:", error);
    // Return empty array as fallback
    return [];
  }
}

/**
 * Get complete user profile data (combines all endpoints)
 */
export async function getUserProfileData(): Promise<UserProfileData | null> {
  try {
    const [stats, progress, friends] = await Promise.all([
      getUserStats(),
      getUserProgress(),
      getUserFriends(),
    ]);

    return {
      user: {
        id: "",
        username: "",
      },
      stats,
      progress,
      friends,
    };
  } catch (error) {
    console.warn("Failed to fetch user profile data:", error);
    return null;
  }
}

export default {
  getUserStats,
  getUserProgress,
  getUserFriends,
  getUserProfileData,
};
