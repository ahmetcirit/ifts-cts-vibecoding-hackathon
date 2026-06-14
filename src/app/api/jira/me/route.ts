import { NextResponse } from "next/server";
import { cacheHeaders, getCached } from "@/lib/cache/memory";

const JIRA_CACHE_TTL_MS = 2 * 60 * 1000;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const useMock = !process.env.JIRA_BASE_URL || searchParams.get("mock") === "true";

  if (useMock) {
    return NextResponse.json(
      { user: null, source: "mock" },
      { headers: cacheHeaders(JIRA_CACHE_TTL_MS) }
    );
  }

  try {
    const { fetchJiraCurrentUser } = await import("@/lib/jira/client");
    const refresh = searchParams.get("refresh") === "true";
    const result = await getCached(
      "jira:me",
      async () => {
        const user = await fetchJiraCurrentUser();
        return { user, source: "jira" };
      },
      JIRA_CACHE_TTL_MS,
      refresh
    );

    return NextResponse.json(result, { headers: cacheHeaders(JIRA_CACHE_TTL_MS) });
  } catch (err) {
    console.error("[Jira Me]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
