import { NextResponse } from "next/server";
import { mockBacklogIssues } from "@/lib/mock/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Use mock when JIRA_BASE_URL is not set OR when explicitly forced with ?mock=true
  const useMock = !process.env.JIRA_BASE_URL || searchParams.get("mock") === "true";

  if (useMock) {
    return NextResponse.json({ issues: mockBacklogIssues });
  }

  try {
    const { fetchJiraBacklog, mapJiraIssue } = await import("@/lib/jira/client");
    const projectKey = searchParams.get("project") ?? process.env.JIRA_PROJECT_KEY ?? "SCRUM";
    const data = await fetchJiraBacklog(projectKey);
    return NextResponse.json({ issues: (data.issues ?? []).map(mapJiraIssue) });
  } catch (err) {
    console.error("[Jira Backlog]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
