import type { JiraIssue, TeamMember } from "@/types";

const BASE = process.env.JIRA_BASE_URL;
const EMAIL = process.env.JIRA_EMAIL;
const TOKEN = process.env.JIRA_API_TOKEN;

function authHeaders(): HeadersInit {
  if (!BASE || !TOKEN) throw new Error("JIRA_BASE_URL / JIRA_API_TOKEN env variables not configured");
  // Jira Server/DC Personal Access Token (PAT) — Bearer auth
  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function jiraFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: authHeaders(),
    // Server-side only — no cache
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira ${path} → ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }
  return res.json();
}

// ─── Mappers ─────────────────────────────────────────────────────────────────

function mapIssueType(name: string): JiraIssue["issueType"] {
  const map: Record<string, JiraIssue["issueType"]> = {
    Story: "Story",
    Task: "Task",
    Bug: "Bug",
    Epic: "Epic",
    "Sub-task": "Sub-task",
    Subtask: "Sub-task",
  };
  return map[name] ?? "Task";
}

function mapStatus(name: string, categoryKey?: string): JiraIssue["status"] {
  if (categoryKey === "done") return "Done";
  const lower = name.toLowerCase();
  if (lower.includes("done") || lower.includes("closed") || lower.includes("resolved")) return "Done";
  if (lower.includes("progress") || lower.includes("development") || lower.includes("review") || lower.includes("testing")) return "In Progress";
  if (lower.includes("block")) return "Blocked";
  return "To Do";
}

export function mapJiraIssue(raw: Record<string, unknown>): JiraIssue {
  const f = raw.fields as Record<string, unknown>;
  const status = f.status as Record<string, unknown> | undefined;
  const priority = f.priority as Record<string, unknown> | undefined;
  const assignee = f.assignee as Record<string, unknown> | undefined;
  const issuetype = f.issuetype as Record<string, unknown> | undefined;
  const components = (f.components as Record<string, unknown>[] | undefined) ?? [];

  // Story points: try multiple common custom field IDs
  const storyPoints =
    (f.customfield_10016 as number | null) ??
    (f.customfield_10028 as number | null) ??
    (f.customfield_10106 as number | null) ??
    (f.story_points as number | null) ??
    undefined;

  // Description: plain string (Server v2) or ADF (Cloud v3)
  let description: string | undefined;
  if (typeof f.description === "string") {
    description = f.description || undefined;
  } else if (f.description && typeof f.description === "object") {
    // ADF: extract first text node
    const adf = f.description as { content?: { content?: { text?: string }[] }[] };
    description = adf.content?.[0]?.content?.[0]?.text ?? undefined;
  }

  return {
    id: raw.id as string,
    key: raw.key as string,
    summary: (f.summary as string) ?? "",
    description,
    status: mapStatus(
      (status?.name as string) ?? "",
      (status as { statusCategory?: { key?: string } } | undefined)?.statusCategory?.key
    ),
    priority: (["Highest", "High", "Medium", "Low", "Lowest"].includes(priority?.name as string)
      ? (priority?.name as JiraIssue["priority"])
      : "Medium"),
    storyPoints: storyPoints != null ? Number(storyPoints) : undefined,
    assignee: assignee
      ? {
          accountId: (assignee.accountId as string) ?? (assignee.name as string) ?? "",
          displayName: (assignee.displayName as string) ?? (assignee.name as string) ?? "Unknown",
          emailAddress: (assignee.emailAddress as string) ?? "",
        }
      : undefined,
    labels: (f.labels as string[]) ?? [],
    issueType: mapIssueType((issuetype?.name as string) ?? "Task"),
    components: components.map((c) => c.name as string),
  };
}

// ─── API calls ───────────────────────────────────────────────────────────────

const ISSUE_FIELDS = [
  "summary",
  "description",
  "status",
  "priority",
  "customfield_10016",
  "customfield_10028",
  "customfield_10106",
  "assignee",
  "labels",
  "issuetype",
  "components",
].join(",");

export async function fetchJiraBacklog(projectKey: string, maxResults = 50) {
  // Jira Server uses /rest/api/2, Cloud uses /rest/api/3 — both accept this JQL
  const jql = encodeURIComponent(
    `project = "${projectKey}" AND sprint is EMPTY AND statusCategory != Done ORDER BY priority ASC`
  );
  return jiraFetch(
    `/rest/api/2/search?jql=${jql}&maxResults=${maxResults}&fields=${ISSUE_FIELDS}`
  );
}

export async function fetchJiraSprints(boardId: number, state: string, maxResults = 10) {
  return jiraFetch(
    `/rest/agile/1.0/board/${boardId}/sprint?state=${state}&maxResults=${maxResults}`
  );
}

export async function fetchSprintIssues(sprintId: number, maxResults = 100) {
  return jiraFetch(
    `/rest/agile/1.0/sprint/${sprintId}/issue?maxResults=${maxResults}&fields=${ISSUE_FIELDS}`
  );
}

// ─── Team ─────────────────────────────────────────────────────────────────────

const SKILL_KEYWORDS: [RegExp, string][] = [
  [/frontend|ui\b|react|angular|vue|css|html/i, "Frontend"],
  [/backend|api\b|service|rest|soap|grpc|spring|node/i, "Backend"],
  [/database|db\b|sql|oracle|postgres|mongo|redis/i, "Database"],
  [/test|qa\b|selenium|cypress|junit|quality/i, "Test"],
  [/devops|ci\b|cd\b|docker|k8s|kubernetes|deploy|pipeline/i, "DevOps"],
  [/design|figma|ux\b|prototype/i, "Design"],
];

function inferSkills(texts: string[]): string[] {
  const found = new Set<string>();
  const combined = texts.join(" ").toLowerCase();
  for (const [pattern, skill] of SKILL_KEYWORDS) {
    if (pattern.test(combined)) found.add(skill);
  }
  return Array.from(found);
}

function inferRole(skills: string[]): string {
  if (skills.includes("Test")) return "QA Engineer";
  if (skills.includes("DevOps")) return "DevOps Engineer";
  if (skills.includes("Frontend") && skills.includes("Backend")) return "Full Stack Developer";
  if (skills.includes("Frontend")) return "Frontend Developer";
  if (skills.includes("Backend")) return "Backend Developer";
  return "Developer";
}

function storyPoints(f: Record<string, unknown>): number {
  const v =
    (f.customfield_10016 as number | null) ??
    (f.customfield_10028 as number | null) ??
    (f.customfield_10106 as number | null);
  return v != null ? Number(v) : 0;
}

export async function fetchTeamFromBoard(boardId: number): Promise<TeamMember[]> {
  // Fetch active sprint + most recent closed sprint in parallel
  const [activeData, closedData] = await Promise.all([
    fetchJiraSprints(boardId, "active", 1),
    fetchJiraSprints(boardId, "closed", 1),
  ]);

  const activeSprint = (activeData.values ?? [])[0] as Record<string, unknown> | undefined;
  const recentClosed = (closedData.values ?? [])[0] as Record<string, unknown> | undefined;

  if (!activeSprint && !recentClosed) return [];

  // Fetch issues for available sprints in parallel
  const fetches: Promise<{ active: boolean; issues: Record<string, unknown>[] }>[] = [];
  if (activeSprint) {
    fetches.push(
      fetchSprintIssues(activeSprint.id as number)
        .then((d) => ({ active: true, issues: (d.issues ?? []) as Record<string, unknown>[] }))
        .catch(() => ({ active: true, issues: [] }))
    );
  }
  if (recentClosed) {
    fetches.push(
      fetchSprintIssues(recentClosed.id as number)
        .then((d) => ({ active: false, issues: (d.issues ?? []) as Record<string, unknown>[] }))
        .catch(() => ({ active: false, issues: [] }))
    );
  }

  const results = await Promise.all(fetches);

  // Build member map: accountId → TeamMember
  const map = new Map<string, TeamMember & { _texts: string[] }>();

  for (const { active, issues } of results) {
    for (const raw of issues) {
      const f = raw.fields as Record<string, unknown>;
      const assignee = f.assignee as Record<string, unknown> | null;
      if (!assignee) continue;

      const id = ((assignee.accountId ?? assignee.name) as string | undefined)?.trim();
      if (!id) continue;

      if (!map.has(id)) {
        map.set(id, {
          id,
          name: (assignee.displayName ?? assignee.name ?? "Unknown") as string,
          email: (assignee.emailAddress ?? "") as string,
          role: "Developer",
          skills: [],
          currentLoad: 0,
          capacity: 20,
          _texts: [],
        });
      }

      const member = map.get(id)!;

      // Accumulate text signals for skill inference
      const summary = (f.summary as string) ?? "";
      const components = ((f.components as { name: string }[]) ?? []).map((c) => c.name);
      const labels = (f.labels as string[]) ?? [];
      member._texts.push(summary, ...components, ...labels);

      // currentLoad = story points assigned in ACTIVE sprint
      if (active) {
        const pts = storyPoints(f);
        // If story points not configured, count each issue as 2pts (rough proxy)
        member.currentLoad += pts > 0 ? pts : 2;
      }
    }
  }

  // Finalize members: derive skills + role, remove internal _texts
  return Array.from(map.values())
    .map(({ _texts, ...member }) => {
      const skills = inferSkills(_texts);
      return {
        ...member,
        skills,
        role: skills.length > 0 ? inferRole(skills) : "Developer",
      };
    })
    .sort((a, b) => a.name.localeCompare(b.name, "tr"));
}
