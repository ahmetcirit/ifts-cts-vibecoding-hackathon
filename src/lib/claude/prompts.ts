import type { JiraIssue, JiraSprint, TeamMember } from "@/types";

export function buildPredictiveSizingPrompt(
  tasks: JiraIssue[],
  sprintHistory: JiraSprint[]
): string {
  const velocityData = sprintHistory.map((s) => ({
    sprint: s.name,
    planned: s.plannedPoints,
    completed: s.completedPoints,
    velocity: s.velocity,
  }));

  const taskData = tasks.map((t) => ({
    key: t.key,
    summary: t.summary,
    description: t.description,
    issueType: t.issueType,
    components: t.components,
    labels: t.labels,
  }));

  return `Sen bir deneyimli Scrum Master ve AI asistanısın. Takımın geçmiş sprint verilerine dayanarak backlog görevleri için story point tahmini yapacaksın.

## Takımın Geçmiş Sprint Velocity Verisi:
${JSON.stringify(velocityData, null, 2)}

## Tahmin Yapılacak Görevler:
${JSON.stringify(taskData, null, 2)}

Fibonacci dizisini kullan (1, 2, 3, 5, 8, 13, 21). Her görev için güven seviyesini belirlerken:
- high: çok benzer geçmiş görev var, açıklama yeterince detaylı
- medium: kısmen benzer görevler var
- low: yeni alan veya belirsiz kapsam

Şu JSON formatında yanıt ver:
{
  "predictions": [
    {
      "taskKey": "SCRUM-45",
      "suggestedPoints": 5,
      "confidence": "high",
      "reasoning": "Benzer profil sayfası görevleri geçmişte 3-5 puan aldı. Frontend + Backend bileşenleri orta kompleksite.",
      "similarTasks": ["SCRUM-12", "SCRUM-23"]
    }
  ],
  "velocityInsight": "Son 3 sprint ortalama velocity: X puan. Hafif düşüş trendi gözlemleniyor.",
  "sprintCapacityRecommendation": "Bu sprint için 25-28 puan alınması önerilir."
}

Sadece geçerli JSON döndür, başka metin ekleme.`;
}

export function buildTaskDecompositionPrompt(
  task: JiraIssue,
  teamMembers: TeamMember[]
): string {
  const memberData = teamMembers.map((m) => ({
    id: m.id,
    name: m.name,
    role: m.role,
    skills: m.skills,
    availableCapacity: m.capacity - m.currentLoad,
  }));

  return `Sen bir teknik lider AI asistanısın. Aşağıdaki Jira görevini mantıklı teknik alt görevlere böl ve takım üyelerine ata.

## Görev Detayı:
Key: ${task.key}
Başlık: ${task.summary}
Açıklama: ${task.description || "Belirtilmemiş"}
Tip: ${task.issueType}
Bileşenler: ${task.components.join(", ") || "Belirtilmemiş"}

## Takım Kapasitesi:
${JSON.stringify(memberData, null, 2)}

Alt görev tipleri: Frontend, Backend, Database, Test, DevOps, Design
Atamada kapasite > 0 olan üyeleri tercih et. Yetenek eşleşmesine bak.

Şu JSON formatında yanıt ver:
{
  "subtasks": [
    {
      "title": "Backend: Profil güncelleme API endpoint",
      "description": "PUT /api/users/:id endpoint, validasyon, DB güncelleme",
      "type": "Backend",
      "estimatedHours": 4,
      "suggestedAssignee": "user-2",
      "skills": ["Node.js", "PostgreSQL"]
    }
  ],
  "totalEstimatedHours": 18,
  "assignmentRationale": "Fatma backend uzmanlığı ve 7 saatlik kapasitesiyle backend görevlere uygun...",
  "risks": ["API tasarımı frontend geliştirmesini bloklayabilir"]
}

Sadece geçerli JSON döndür.`;
}

export function buildSprintReportPrompt(
  sprint: JiraSprint,
  metrics: Record<string, unknown>
): string {
  const done = sprint.issues.filter((i) => i.status === "Done");
  const notDone = sprint.issues.filter((i) => i.status !== "Done");

  return `Sen bir Scrum Master AI asistanısın. Tamamlanan sprint için kapsamlı bir sprint review raporu yaz.

## Sprint:
${JSON.stringify({ name: sprint.name, goal: sprint.goal, startDate: sprint.startDate, endDate: sprint.endDate }, null, 2)}

## Metrikler:
${JSON.stringify(metrics, null, 2)}

## Tamamlanan Görevler (${done.length} adet):
${JSON.stringify(done.map((i) => ({ key: i.key, summary: i.summary, points: i.storyPoints })), null, 2)}

## Tamamlanamayan Görevler (${notDone.length} adet):
${JSON.stringify(notDone.map((i) => ({ key: i.key, summary: i.summary, status: i.status, points: i.storyPoints })), null, 2)}

Türkçe ve stakeholder'lara yönelik profesyonel bir dil kullan. Tüm alanlar dahil toplam metin 1000 karakteri geçmeyecek şekilde özlü yaz. Şu JSON formatında yanıt ver:
{
  "summary": "Sprint genel özeti (1-2 cümle, max 150 karakter)",
  "achievements": ["Başarı 1 (max 80 karakter)", "Başarı 2", "Başarı 3"],
  "challenges": ["Zorluk 1 (max 80 karakter)", "Zorluk 2"],
  "nextSprintRecommendations": ["Öneri 1 (max 80 karakter)", "Öneri 2"],
  "demoNarrative": "Demo anlatısı (max 200 karakter)"
}

Sadece geçerli JSON döndür.`;
}

export function buildHealthScorePrompt(metrics: {
  completionRate: number;
  velocityTrend: string;
  blockerCount: number;
  carryoverRate: number;
  teamCapacityUsage: number;
  sprintGoalMet: boolean;
}): string {
  return `Sen bir Agile Coach AI asistanısın. Sprint metriklerine göre 1-100 sprint sağlık skoru hesapla.

## Metrikler:
${JSON.stringify(metrics, null, 2)}

## Ağırlıklar:
- Tamamlanma Oranı: %40
- Velocity Tutarlılığı: %20
- Blocker Durumu: %15
- Carryover Oranı: %15
- Kapasite Kullanımı: %10

Not skalası: 90-100=A, 80-89=B, 70-79=C, 60-69=D, <60=F

Şu JSON formatında yanıt ver:
{
  "score": 78,
  "grade": "B",
  "breakdown": {
    "completionScore": 85,
    "velocityScore": 70,
    "blockerScore": 90,
    "carryoverScore": 65,
    "capacityScore": 80
  },
  "recommendations": ["Öneri 1", "Öneri 2", "Öneri 3"],
  "summary": "Sprint sağlık değerlendirmesi"
}

Sadece geçerli JSON döndür.`;
}
