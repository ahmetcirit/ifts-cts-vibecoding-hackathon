import { NextResponse } from "next/server";
import { mockTeamMembers } from "@/lib/mock/data";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const useMock = !process.env.JIRA_BASE_URL || searchParams.get("mock") === "true";

  if (useMock) {
    return NextResponse.json({ members: mockTeamMembers, source: "mock" });
  }

  try {
    const { fetchTeamFromBoard } = await import("@/lib/jira/client");
    const boardId = Number(searchParams.get("boardId") ?? process.env.JIRA_BOARD_ID ?? "1");
    const members = await fetchTeamFromBoard(boardId);

    if (members.length === 0) {
      // Board'da atanmış issue yoksa mock'a düş
      return NextResponse.json({ members: mockTeamMembers, source: "mock_fallback" });
    }

    return NextResponse.json({ members, source: "jira" });
  } catch (err) {
    console.error("[Jira Team]", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
