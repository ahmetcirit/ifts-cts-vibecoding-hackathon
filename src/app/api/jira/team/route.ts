import { NextResponse } from "next/server";
import { mockTeamMembers } from "@/lib/mock/data";
import { cacheHeaders, getCached } from "@/lib/cache/memory";

const JIRA_CACHE_TTL_MS = 2 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const useMock = !process.env.JIRA_BASE_URL || searchParams.get("mock") === "true";
  const projectKey = searchParams.get("project") ?? process.env.JIRA_PROJECT_KEY ?? "SCRUM";

  if (useMock) {
    return NextResponse.json(
      {
        members: mockTeamMembers,
        source: "mock",
        project: { key: projectKey, name: `${projectKey} Team` },
      },
      { headers: cacheHeaders(JIRA_CACHE_TTL_MS) }
    );
  }

  try {
    const { fetchJiraProjectInfo, fetchTeamForProject } = await import("@/lib/jira/client");
    const refresh = searchParams.get("refresh") === "true";
    const result = await getCached(
      `jira:team:${projectKey}`,
      async () => {
        const [members, project] = await Promise.all([
          fetchTeamForProject(projectKey),
          fetchJiraProjectInfo(projectKey).catch(() => ({ key: projectKey, name: projectKey })),
        ]);

        if (members.length === 0) {
          return { members: mockTeamMembers, source: "mock_fallback", project };
        }

        return { members, source: "jira", project };
      },
      JIRA_CACHE_TTL_MS,
      refresh
    );

    return NextResponse.json(result, { headers: cacheHeaders(JIRA_CACHE_TTL_MS) });
  } catch (err) {
    console.error("[Jira Team]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
