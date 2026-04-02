// src/lib/project-manager.ts

// --- Interfaces ---

/**
 * Represents a project within the system.
 */
export interface Project {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'archived' | 'completed';
  created: string; // ISO 8601 date string (YYYY-MM-DD)
  deadline?: string; // ISO 8601 date string (YYYY-MM-DD)
  color: string; // Hex color code, e.g., '#RRGGBB'
}

/**
 * Represents a task within a project.
 */
export interface Task {
  id: string;
  projectId: string;
  title: string;
  description: string;
  status: 'backlog' | 'todo' | 'in-progress' | 'review' | 'done';
  priority: 'low' | 'medium' | 'high' | 'critical';
  assignee?: string;
  dueDate?: string; // ISO 8601 date string (YYYY-MM-DD)
  tags: string[];
  estimate?: number; // Estimated effort in hours
  timeSpent: number; // Actual time spent in hours
  created: string; // ISO 8601 date string (YYYY-MM-DD)
  completed?: string; // ISO 8601 date string (YYYY-MM-DD), set when status is 'done'
  parentId?: string; // ID of the parent task, if this is a subtask
  subtasks: string[]; // Array of subtask IDs
}

// --- Helper Functions (internal to the module) ---

/**
 * Generates a simple unique ID. Not cryptographically secure, but sufficient for this context.
 * @returns A unique string ID.
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Returns the current date in YYYY-MM-DD format.
 * @returns Current date as an ISO 8601 date string.
 */
function getCurrentDateISO(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Adds a specified number of days to a given Date object.
 * @param date The starting Date object.
 * @param days The number of days to add.
 * @returns A new Date object with