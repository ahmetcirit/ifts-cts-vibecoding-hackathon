import { NextResponse } from "next/server";
import { generateObject } from "ai";
import {
  getAiRequestConfig,
  isAiConfigurationError,
  MAX_OUTPUT_TOKENS,
  repairJsonText,
  TEMPERATURE,
} from "@/lib/ai/client";
import { buildTaskDecompositionPrompt } from "@/lib/ai/prompts";
import { taskDecompositionSchema } from "@/lib/ai/schemas";
import type { JiraIssue, TeamMember } from "@/types";

function normalizeSkills(values: string[]): string[] {
  return Array.from(new Set(values.filter(Boolean))).slice(0, 4);
}

function chooseAssignee(type: string, teamMembers: TeamMember[]): TeamMember | undefined {
  const normalizedType = type.toLowerCase();

  return [...teamMembers]
    .filter((member) => member.capacity - member.currentLoad > 0)
    .sort(
      (a, b) =>
        a.currentLoad / Math.max(a.capacity, 1) - b.currentLoad / Math.max(b.capacity, 1)
    )
    .find((member) => {
      const haystack = `${member.role} ${member.skills.join(" ")}`.toLowerCase();
      return haystack.includes(normalizedType);
    });
}

function buildFallbackDecomposition(task: JiraIssue, teamMembers: TeamMember[]) {
  const rawTypes =
    task.components.length > 0
      ? task.components
      : task.issueType === "Bug"
        ? ["Frontend", "Backend", "Test"]
        : ["Backend", "Test"];

  const types = Array.from(
    new Set(
      rawTypes
        .map((type) => {
          if (type === "UI") return "Frontend";
          return ["Frontend", "Backend", "Database", "Test", "DevOps", "Design"].includes(type)
            ? type
            : null;
        })
        .filter(
          (
            type
          ): type is "Frontend" | "Backend" | "Database" | "Test" | "DevOps" | "Design" =>
            Boolean(type)
        )
    )
  );

  const subtaskTypes = types.length > 0 ? types : ["Backend", "Test"];
  const subtasks = subtaskTypes.map((type, index) => {
    const assignee = chooseAssignee(type, teamMembers);
    const estimatedHours = type === "Test" ? 2 : type === "Database" || type === "DevOps" ? 3 : 4;
    const assigneeSkills = assignee ? assignee.skills.slice(0, 2) : [];

    return {
      title: `${type}: ${task.summary}`,
      description:
        index === 0
          ? `${task.key} görevi için ${type.toLowerCase()} kapsamındaki ana iş parçası.`
          : `${task.key} görevini destekleyen ${type.toLowerCase()} işi.`,
      type,
      estimatedHours,
      suggestedAssignee: assignee?.id ?? "",
      skills: normalizeSkills([type, ...task.components, ...task.labels, ...assigneeSkills]),
    };
  });

  return {
    subtasks,
    totalEstimatedHours: subtasks.reduce((sum, subtask) => sum + subtask.estimatedHours, 0),
    assignmentRationale:
      "AI çıktısı parse edilemediği için görev componentleri ve ekip kapasitesine göre muhafazakar bir dağılım uygulandı.",
    risks: task.description
      ? []
      : ["Görev açıklaması eksik olduğu için alt görev kapsamında belirsizlik bulunuyor."],
  };
}

export async function POST(request: Request) {
  const payload: { task: JiraIssue; teamMembers: TeamMember[] } = await request.json();

  try {
    const prompt = buildTaskDecompositionPrompt(payload.task, payload.teamMembers);
    const aiConfig = getAiRequestConfig();

    const { object } = await generateObject({
      model: aiConfig.languageModel,
      temperature: TEMPERATURE,
      maxOutputTokens: MAX_OUTPUT_TOKENS,
      providerOptions: aiConfig.providerOptions,
      experimental_repairText: repairJsonText,
      schema: taskDecompositionSchema,
      prompt,
    });

    return NextResponse.json(object);
  } catch (error) {
    if (isAiConfigurationError(error)) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(buildFallbackDecomposition(payload.task, payload.teamMembers));
  }
}
