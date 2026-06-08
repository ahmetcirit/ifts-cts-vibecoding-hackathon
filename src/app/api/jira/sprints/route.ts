import { NextResponse } from "next/server";
import { mockSprintHistory } from "@/lib/mock/data";
import type { JiraSprint } from "@/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const useMock = !process.env.JIRA_BASE_URL || searchParams.get("mock") === "true";

  if (useMock) {
    return NextResponse.json({ sprints: mockSprintHistory });
  }

  try {
    const { fetchAllJiraSprints, fetchSprintIssues, mapJiraIssue } = await import("@/lib/jira/client");
    const boardId = Number(searchParams.get("boardId") ?? process.env.JIRA_BOARD_ID ?? "1");

    // Board'daki TÜM sprintleri pagination ile getir (state filtresiz)
    const rawSprints = await fetchAllJiraSprints(boardId);

    // Fetch issues for each sprint to calculate velocity
    const sprints: JiraSprint[] = await Promise.all(
      rawSprints.map(async (s) => {
        const id = s.id as number;
        let issues: JiraSprint["issues"] = [];

        try {
          const issueData = await fetchSprintIssues(id);
          issues = (issueData.issues ?? []).map(mapJiraIssue);
        } catch {
          // Sprint issues unavailable — skip silently
        }

        const plannedPoints = issues.reduce((a, i) => a + (i.storyPoints ?? 0), 0);
        const completedPoints = issues
          .filter((i) => i.status === "Done")
          .reduce((a, i) => a + (i.storyPoints ?? 0), 0);

        return {
          id,
          name: (s.name as string) ?? `Sprint ${id}`,
          state: (s.state as JiraSprint["state"]) ?? "closed",
          startDate: (s.startDate as string) ?? "",
          endDate: (s.endDate as string) ?? "",
          completedDate: s.completeDate as string | undefined,
          goal: s.goal as string | undefined,
          issues,
          plannedPoints,
          completedPoints,
          velocity: completedPoints,
        };
      })
    );

    return NextResponse.json({ sprints });
  } catch (err) {
    console.error("[Jira Sprints]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
