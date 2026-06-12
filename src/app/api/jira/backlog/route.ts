import { NextResponse } from "next/server";
import { mockBacklogIssues } from "@/lib/mock/data";
import { cacheHeaders, getCached } from "@/lib/cache/memory";

const JIRA_CACHE_TTL_MS = 2 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  // Use mock when JIRA_BASE_URL is not set OR when explicitly forced with ?mock=true
  const useMock = !process.env.JIRA_BASE_URL || searchParams.get("mock") === "true";

  if (useMock) {
    return NextResponse.json({ issues: mockBacklogIssues }, { headers: cacheHeaders(JIRA_CACHE_TTL_MS) });
  }

  try {
    const { fetchJiraBacklog, mapJiraIssue } = await import("@/lib/jira/client");
    const projectKey = searchParams.get("project") ?? process.env.JIRA_PROJECT_KEY ?? "SCRUM";
    const refresh = searchParams.get("refresh") === "true";
    const result = await getCached(
      `jira:backlog:${projectKey}`,
      async () => {
        const data = await fetchJiraBacklog(projectKey);
        return { issues: (data.issues ?? []).map(mapJiraIssue) };
      },
      JIRA_CACHE_TTL_MS,
      refresh
    );

    return NextResponse.json(result, { headers: cacheHeaders(JIRA_CACHE_TTL_MS) });
  } catch (err) {
    console.error("[Jira Backlog]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
