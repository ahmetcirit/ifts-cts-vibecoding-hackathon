import { NextResponse } from "next/server";
import { mockSprintHistory } from "@/lib/mock/data";
import { cacheHeaders, getCached } from "@/lib/cache/memory";

const JIRA_CACHE_TTL_MS = 2 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const useMock = !process.env.JIRA_BASE_URL || searchParams.get("mock") === "true";

  if (useMock) {
    return NextResponse.json({ sprints: mockSprintHistory }, { headers: cacheHeaders(JIRA_CACHE_TTL_MS) });
  }

  try {
    const { fetchAllJiraSprints } = await import("@/lib/jira/client");
    const projectKey = searchParams.get("project") ?? process.env.JIRA_PROJECT_KEY ?? "SCRUM";
    const refresh = searchParams.get("refresh") === "true";
    const result = await getCached(
      `jira:sprints:${projectKey}`,
      async () => {
        const allSprints = await fetchAllJiraSprints(projectKey);
        const active = allSprints.filter((sprint) => sprint.state === "active");
        const future = allSprints.filter((sprint) => sprint.state === "future").slice(0, 1);
        const closed = allSprints.filter((sprint) => sprint.state === "closed").slice(-6);
        const sprints = [...closed, ...future, ...active].sort((a, b) => {
          const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
          const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
          if (aTime !== bTime) return aTime - bTime;
          return a.id - b.id;
        });

        return { sprints };
      },
      JIRA_CACHE_TTL_MS,
      refresh
    );

    return NextResponse.json(result, { headers: cacheHeaders(JIRA_CACHE_TTL_MS) });
  } catch (err) {
    console.error("[Jira Sprints]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
