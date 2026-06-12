import type { JiraIssue, JiraSprint, TeamMember } from "@/types";

const BASE = process.env.JIRA_BASE_URL;
const TOKEN = process.env.JIRA_API_TOKEN;
const DEFAULT_MEMBER_CAPACITY_POINTS = 18;

type JiraSearchResponse = {
  issues?: Record<string, unknown>[];
  total?: number;
  startAt?: number;
  maxResults?: number;
};

type ParsedSprint = {
  id: number;
  rapidViewId?: number;
  state: JiraSprint["state"];
  name: string;
  startDate?: string;
  endDate?: string;
  completeDate?: string;
  activatedDate?: string;
  sequence?: number;
  goal?: string;
};

const ISSUE_FIELDS = [
  "summary",
  "description",
  "status",
  "priority",
  "customfield_10016",
  "customfield_10020",
  "customfield_10028",
  "customfield_10106",
  "customfield_11222",
  "customfield_23920",
  "customfield_24520",
  "customfield_24521",
  "assignee",
  "labels",
  "issuetype",
  "components",
].join(",");

function authHeaders(): HeadersInit {
  if (!BASE || !TOKEN) {
    throw new Error("JIRA_BASE_URL / JIRA_API_TOKEN env variables not configured");
  }

  return {
    Authorization: `Bearer ${TOKEN}`,
    Accept: "application/json",
    "Content-Type": "application/json",
  };
}

async function jiraFetch(path: string) {
  const res = await fetch(`${BASE}${path}`, {
    headers: authHeaders(),
    cache: "no-store",
  });

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Jira ${path} -> ${res.status} ${res.statusText}: ${body.slice(0, 200)}`);
  }

  return res.json();
}

async function searchJiraIssues(
  jql: string,
  fields = ISSUE_FIELDS,
  maxResults = 100,
  startAt = 0
): Promise<JiraSearchResponse> {
  const encoded = encodeURIComponent(jql);
  return jiraFetch(
    `/rest/api/2/search?jql=${encoded}&startAt=${startAt}&maxResults=${maxResults}&fields=${fields}`
  );
}

async function searchAllJiraIssues(
  jql: string,
  fields = ISSUE_FIELDS,
  pageSize = 100,
  maxTotal = 2000
): Promise<Record<string, unknown>[]> {
  const all: Record<string, unknown>[] = [];
  let startAt = 0;

  while (startAt < maxTotal) {
    const page = await searchJiraIssues(jql, fields, pageSize, startAt);
    const issues = (page.issues ?? []) as Record<string, unknown>[];
    all.push(...issues);

    const total = typeof page.total === "number" ? page.total : all.length;
    if (issues.length === 0 || all.length >= total || issues.length < pageSize) break;

    startAt += pageSize;
  }

  return all;
}

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
  if (lower === "xl block" || lower.includes("block")) return "Blocked";

  if (lower.includes("done") || lower.includes("closed") || lower.includes("resolved")) {
    return "Done";
  }
  if (
    lower.includes("progress") ||
    lower.includes("development") ||
    lower.includes("review") ||
    lower.includes("testing")
  ) {
    return "In Progress";
  }

  return "To Do";
}

function getStoryPoints(fields: Record<string, unknown>): number | undefined {
  const value =
    (fields.customfield_11222 as number | null) ??
    (fields.customfield_23920 as number | null) ??
    (fields.customfield_24520 as number | null) ??
    (fields.customfield_24521 as number | null) ??
    (fields.customfield_10016 as number | null) ??
    (fields.customfield_10028 as number | null) ??
    (fields.customfield_10106 as number | null) ??
    undefined;

  return value != null ? Number(value) : undefined;
}

function getIssueStatus(fields: Record<string, unknown>): JiraIssue["status"] {
  const status = fields.status as Record<string, unknown> | undefined;
  return mapStatus(
    (status?.name as string) ?? "",
    (status as { statusCategory?: { key?: string } } | undefined)?.statusCategory?.key
  );
}

function parseDescription(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value || undefined;
  }

  if (value && typeof value === "object") {
    const adf = value as { content?: { content?: { text?: string }[] }[] };
    return adf.content?.[0]?.content?.[0]?.text ?? undefined;
  }

  return undefined;
}

function sanitizeSprintValue(value: string | undefined): string | undefined {
  if (!value || value === "<null>") return undefined;
  return value;
}

function matchSprintField(input: string, field: string): string | undefined {
  const match = input.match(new RegExp(`${field}=([^,\\]]+)`));
  return sanitizeSprintValue(match?.[1]);
}

function parseSprintState(value: string | undefined): JiraSprint["state"] {
  switch ((value ?? "").toUpperCase()) {
    case "ACTIVE":
      return "active";
    case "CLOSED":
      return "closed";
    case "FUTURE":
      return "future";
    default:
      return "closed";
  }
}

function parseSprintValue(value: unknown): ParsedSprint | null {
  if (!value) return null;

  if (typeof value === "string") {
    const id = Number(matchSprintField(value, "id"));
    if (!Number.isFinite(id)) return null;

    const rapidViewId = Number(matchSprintField(value, "rapidViewId"));
    const sequence = Number(matchSprintField(value, "sequence"));

    return {
      id,
      rapidViewId: Number.isFinite(rapidViewId) ? rapidViewId : undefined,
      state: parseSprintState(matchSprintField(value, "state")),
      name: matchSprintField(value, "name") ?? `Sprint ${id}`,
      startDate: matchSprintField(value, "startDate"),
      endDate: matchSprintField(value, "endDate"),
      completeDate: matchSprintField(value, "completeDate"),
      activatedDate: matchSprintField(value, "activatedDate"),
      sequence: Number.isFinite(sequence) ? sequence : undefined,
      goal: matchSprintField(value, "goal"),
    };
  }

  if (typeof value === "object") {
    const sprint = value as Record<string, unknown>;
    const id = Number(sprint.id);
    if (!Number.isFinite(id)) return null;

    return {
      id,
      rapidViewId:
        typeof sprint.rapidViewId === "number" ? sprint.rapidViewId : Number(sprint.rapidViewId) || undefined,
      state: parseSprintState(typeof sprint.state === "string" ? sprint.state : undefined),
      name: (sprint.name as string) ?? `Sprint ${id}`,
      startDate: sanitizeSprintValue(sprint.startDate as string | undefined),
      endDate: sanitizeSprintValue(sprint.endDate as string | undefined),
      completeDate: sanitizeSprintValue(
        (sprint.completeDate as string | undefined) ?? (sprint.completedDate as string | undefined)
      ),
      activatedDate: sanitizeSprintValue(sprint.activatedDate as string | undefined),
      sequence: typeof sprint.sequence === "number" ? sprint.sequence : Number(sprint.sequence) || undefined,
      goal: sanitizeSprintValue(sprint.goal as string | undefined),
    };
  }

  return null;
}

export function getIssueSprints(fields: Record<string, unknown>): ParsedSprint[] {
  const raw = fields.customfield_10020;
  const values = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const parsed = values
    .map(parseSprintValue)
    .filter((value): value is ParsedSprint => Boolean(value));

  const byId = new Map<number, ParsedSprint>();
  for (const sprint of parsed) {
    const existing = byId.get(sprint.id);
    if (!existing) {
      byId.set(sprint.id, sprint);
      continue;
    }

    byId.set(sprint.id, {
      ...existing,
      ...sprint,
      name: sprint.name || existing.name,
      state: sprint.state || existing.state,
      startDate: sprint.startDate ?? existing.startDate,
      endDate: sprint.endDate ?? existing.endDate,
      completeDate: sprint.completeDate ?? existing.completeDate,
      activatedDate: sprint.activatedDate ?? existing.activatedDate,
      goal: sprint.goal ?? existing.goal,
      rapidViewId: sprint.rapidViewId ?? existing.rapidViewId,
      sequence: sprint.sequence ?? existing.sequence,
    });
  }

  return Array.from(byId.values());
}

function compareSprints(a: ParsedSprint, b: ParsedSprint): number {
  const aStateRank = a.state === "active" ? 3 : a.state === "future" ? 2 : 1;
  const bStateRank = b.state === "active" ? 3 : b.state === "future" ? 2 : 1;
  if (aStateRank !== bStateRank) return bStateRank - aStateRank;

  const aSeq = a.sequence ?? 0;
  const bSeq = b.sequence ?? 0;
  if (aSeq !== bSeq) return bSeq - aSeq;

  const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
  const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
  return bTime - aTime;
}

function getCurrentSprint(fields: Record<string, unknown>): ParsedSprint | undefined {
  const sprints = getIssueSprints(fields);
  return sprints.sort(compareSprints)[0];
}

function createSprintMapFromIssues(issues: Record<string, unknown>[]): Map<number, JiraSprint> {
  const sprintMap = new Map<number, JiraSprint>();

  for (const raw of issues) {
    const fields = raw.fields as Record<string, unknown>;
    const mappedIssue = mapJiraIssue(raw);
    const sprints = getIssueSprints(fields);

    for (const sprint of sprints) {
      const existing = sprintMap.get(sprint.id);
      if (!existing) {
        sprintMap.set(sprint.id, {
          id: sprint.id,
          name: sprint.name,
          state: sprint.state,
          startDate: sprint.startDate ?? "",
          endDate: sprint.endDate ?? "",
          completedDate: sprint.completeDate,
          goal: sprint.goal,
          issues: [mappedIssue],
        });
      } else {
        existing.issues.push(mappedIssue);
        existing.state = sprint.state || existing.state;
        existing.name = sprint.name || existing.name;
        existing.startDate = sprint.startDate ?? existing.startDate;
        existing.endDate = sprint.endDate ?? existing.endDate;
        existing.completedDate = sprint.completeDate ?? existing.completedDate;
        existing.goal = sprint.goal ?? existing.goal;
      }
    }
  }

  for (const sprint of sprintMap.values()) {
    sprint.plannedPoints = sprint.issues.reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0);
    sprint.completedPoints = sprint.issues
      .filter((issue) => issue.status === "Done")
      .reduce((sum, issue) => sum + (issue.storyPoints ?? 0), 0);
    sprint.velocity = sprint.completedPoints;
  }

  return sprintMap;
}

export function mapJiraIssue(raw: Record<string, unknown>): JiraIssue {
  const fields = raw.fields as Record<string, unknown>;
  const priority = fields.priority as Record<string, unknown> | undefined;
  const assignee = fields.assignee as Record<string, unknown> | undefined;
  const issueType = fields.issuetype as Record<string, unknown> | undefined;
  const components = (fields.components as Record<string, unknown>[] | undefined) ?? [];

  return {
    id: raw.id as string,
    key: raw.key as string,
    summary: (fields.summary as string) ?? "",
    description: parseDescription(fields.description),
    status: getIssueStatus(fields),
    priority: ["Highest", "High", "Medium", "Low", "Lowest"].includes(priority?.name as string)
      ? (priority?.name as JiraIssue["priority"])
      : "Lowest",
    storyPoints: getStoryPoints(fields),
    assignee: assignee
      ? {
          accountId: (assignee.accountId as string) ?? (assignee.name as string) ?? "",
          displayName: (assignee.displayName as string) ?? (assignee.name as string) ?? "Unknown",
          emailAddress: (assignee.emailAddress as string) ?? "",
        }
      : undefined,
    labels: (fields.labels as string[]) ?? [],
    issueType: mapIssueType((issueType?.name as string) ?? "Task"),
    components: components.map((component) => component.name as string),
  };
}

export async function fetchJiraBacklog(projectKey: string, maxResults = 50) {
  return searchJiraIssues(
    `project = "${projectKey}" AND sprint is EMPTY AND statusCategory != Done ORDER BY priority ASC`,
    ISSUE_FIELDS,
    maxResults
  );
}

export async function fetchJiraProjectIssues(projectKey: string, maxResults = 100) {
  return searchJiraIssues(
    `project = "${projectKey}" AND assignee is not EMPTY ORDER BY updated DESC`,
    ISSUE_FIELDS,
    maxResults
  );
}

export async function fetchAllJiraSprintIssues(projectKey: string): Promise<Record<string, unknown>[]> {
  return searchAllJiraIssues(
    `project = "${projectKey}" AND sprint is not EMPTY ORDER BY updated DESC`,
    ISSUE_FIELDS
  );
}

export async function fetchAllJiraSprints(projectKey: string): Promise<JiraSprint[]> {
  const issues = await fetchAllJiraSprintIssues(projectKey);
  return Array.from(createSprintMapFromIssues(issues).values()).sort((a, b) => {
    const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
    const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
    if (aTime !== bTime) return aTime - bTime;
    return a.id - b.id;
  });
}

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
  if (skills.includes("Frontend") && skills.includes("Backend")) return "Full Stack Developer";
  if (skills.includes("Backend")) return "Backend Developer";
  if (skills.includes("Frontend")) return "Frontend Developer";
  if (skills.includes("Database")) return "Database Developer";
  if (skills.includes("DevOps")) return "DevOps Engineer";
  if (skills.includes("Test")) return "QA Engineer";
  return "Developer";
}

function buildTeamMembersFromIssues(
  issues: Record<string, unknown>[],
  activeSprintId?: number
): TeamMember[] {
  const map = new Map<string, TeamMember & { _texts: string[] }>();

  for (const raw of issues) {
    const fields = raw.fields as Record<string, unknown>;
    const assignee = fields.assignee as Record<string, unknown> | null;
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
        capacity: DEFAULT_MEMBER_CAPACITY_POINTS,
        _texts: [],
      });
    }

    const member = map.get(id)!;
    const summary = (fields.summary as string) ?? "";
    const components = ((fields.components as { name: string }[]) ?? []).map((component) => component.name);
    const labels = (fields.labels as string[]) ?? [];
    member._texts.push(summary, ...components, ...labels);

    const status = getIssueStatus(fields);
    if (activeSprintId != null && (status === "In Progress" || status === "To Do")) {
      const belongsToActiveSprint = getIssueSprints(fields).some((sprint) => sprint.id === activeSprintId);
      if (belongsToActiveSprint) {
        const points = getStoryPoints(fields);
        member.currentLoad += points && points > 0 ? points : 0;
      }
    }
  }

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

export async function fetchTeamForProject(projectKey: string): Promise<TeamMember[]> {
  const issues = await searchAllJiraIssues(
    `project = "${projectKey}" AND assignee is not EMPTY ORDER BY updated DESC`,
    ISSUE_FIELDS
  );
  const sprintIssues = issues.filter((issue) => {
    const fields = issue.fields as Record<string, unknown>;
    return getIssueSprints(fields).length > 0;
  });
  const sprints = Array.from(createSprintMapFromIssues(sprintIssues).values());
  const activeSprint = sprints
    .filter((sprint) => sprint.state === "active")
    .sort((a, b) => {
      const aTime = a.startDate ? new Date(a.startDate).getTime() : 0;
      const bTime = b.startDate ? new Date(b.startDate).getTime() : 0;
      return bTime - aTime;
    })[0];

  return buildTeamMembersFromIssues(issues, activeSprint?.id);
}
