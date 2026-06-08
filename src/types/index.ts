// ─── Jira ────────────────────────────────────────────────────────────────────

export interface JiraIssue {
  id: string;
  key: string;
  summary: string;
  description?: string;
  status: "To Do" | "In Progress" | "Done" | "Blocked";
  priority: "Highest" | "High" | "Medium" | "Low" | "Lowest";
  storyPoints?: number;
  assignee?: JiraUser;
  labels: string[];
  issueType: "Story" | "Task" | "Bug" | "Epic" | "Sub-task";
  epicKey?: string;
  components: string[];
}

export interface JiraUser {
  accountId: string;
  displayName: string;
  emailAddress: string;
  avatarUrl?: string;
}

export interface JiraSprint {
  id: number;
  name: string;
  state: "active" | "closed" | "future";
  startDate: string;
  endDate: string;
  completedDate?: string;
  goal?: string;
  issues: JiraIssue[];
  velocity?: number;
  completedPoints?: number;
  plannedPoints?: number;
}

// ─── Team ─────────────────────────────────────────────────────────────────────

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: string;
  skills: string[];
  currentLoad: number;   // story points in active sprint
  capacity: number;      // total capacity in story points per sprint
  avatarUrl?: string;
}

// ─── AI Responses ─────────────────────────────────────────────────────────────

export interface PredictiveSizingResult {
  predictions: {
    taskKey: string;
    suggestedPoints: number;
    confidence: "low" | "medium" | "high";
    reasoning: string;
    similarTasks: string[];
  }[];
  velocityInsight: string;
  sprintCapacityRecommendation: string;
}

export type SubTaskType = "Frontend" | "Backend" | "Database" | "Test" | "DevOps" | "Design";

export interface SubTask {
  title: string;
  description: string;
  type: SubTaskType;
  estimatedHours: number;
  suggestedAssignee: string;
  skills: string[];
}

export interface DecompositionResult {
  subtasks: SubTask[];
  totalEstimatedHours: number;
  assignmentRationale: string;
  risks: string[];
}

export interface SprintHealthScore {
  score: number;
  grade: "A" | "B" | "C" | "D" | "F";
  breakdown: {
    completionScore: number;
    velocityScore: number;
    blockerScore: number;
    carryoverScore: number;
    capacityScore: number;
  };
  recommendations: string[];
  summary: string;
}

export interface SprintReport {
  summary: string;
  achievements: string[];
  challenges: string[];
  nextSprintRecommendations: string[];
  demoNarrative: string;
}

export interface SprintMetrics {
  plannedPoints: number;
  completedPoints: number;
  completionRate: number;
  plannedTasks: number;
  completedTasks: number;
  carryoverTasks: number;
  blockedTasks: number;
  averageVelocity: number;
  velocityTrend: "up" | "down" | "stable";
}
