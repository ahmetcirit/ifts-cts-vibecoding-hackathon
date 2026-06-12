import { z } from "zod";

export const predictiveSizingSchema = z.object({
  predictions: z.array(
    z.object({
      taskKey: z.string(),
      suggestedPoints: z.coerce.number(),
      confidence: z.enum(["low", "medium", "high"]),
      reasoning: z.string(),
      similarTasks: z.array(z.string()),
    })
  ),
  velocityInsight: z.string(),
  sprintCapacityRecommendation: z.string(),
});

export const taskDecompositionSchema = z.object({
  subtasks: z.array(
    z.object({
      title: z.string(),
      description: z.string(),
      type: z.enum(["Frontend", "Backend", "Database", "Test", "DevOps", "Design"]),
      estimatedHours: z.coerce.number(),
      suggestedAssignee: z.string(),
      skills: z.array(z.string()),
    })
  ),
  totalEstimatedHours: z.coerce.number(),
  assignmentRationale: z.string(),
  risks: z.array(z.string()),
});

export const sprintHealthScoreSchema = z.object({
  score: z.coerce.number(),
  grade: z.enum(["A", "B", "C", "D", "F"]),
  breakdown: z.object({
    completionScore: z.coerce.number(),
    velocityScore: z.coerce.number(),
    blockerScore: z.coerce.number(),
    carryoverScore: z.coerce.number(),
    capacityScore: z.coerce.number(),
  }),
  recommendations: z.array(z.string()),
  summary: z.string(),
});

export const sprintReportSchema = z.object({
  executiveSummary: z.string(),
  deliveryFocus: z.string(),
  riskFocus: z.string(),
  nextFocus: z.string(),
});
