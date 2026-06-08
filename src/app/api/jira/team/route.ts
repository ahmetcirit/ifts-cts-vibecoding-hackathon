import { NextResponse } from "next/server";
import { mockTeamMembers } from "@/lib/mock/data";

export async function GET() {
  return NextResponse.json({ members: mockTeamMembers });
}
