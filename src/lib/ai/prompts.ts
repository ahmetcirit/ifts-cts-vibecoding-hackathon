import type { JiraIssue, JiraSprint, TeamMember } from "@/types";

const JSON_ONLY_RULES = `
Zorunlu kurallar:
- Yalnizca verilen veriye dayan. Veri disi varsayim, hayal urunu detay ve kurum disi bilgi ekleme.
- Girdide olmayan isim, gorev, teknoloji, risk veya metrik uretme.
- Emin degilsen muhafazakar davran; en savunulabilir secenegi sec.
- Kanit zayifsa bunu sonuc alanlarina yansit: low confidence, daha dusuk puan, "Veri yetersiz" benzeri aciklama.
- Cikti schema ile tam uyumlu olsun.
- Markdown, code fence, giris cumlesi veya schema disi alan uretme.
`.trim();

function stringify(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

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
    description: t.description || "Belirtilmemis",
    issueType: t.issueType,
    components: t.components,
    labels: t.labels,
  }));

  return `Rolun: dikkatli bir agile planning asistani.

Amac:
- Takimin gecmis sprint verilerine ve gorev metinlerine dayanarak her gorev icin savunulabilir story point oner.
- Spekulatif davranma. Veriler zayifsa daha muhafazakar tahmin sec.

Degerlendirme kurallari:
- Sadece Fibonacci kullan: 1, 2, 3, 5, 8, 13, 21.
- Benzerlik degerlendirmesinde yalnizca verilen summary, description, issueType, component ve label bilgilerini kullan.
- Description bos veya yetersizse confidence en fazla medium olabilir.
- Teknik kapsam, entegrasyon, bilinmezlik veya bagimlilik net degilse confidence low olmaya daha yatkindir.
- Reasoning alani en fazla 2 kisa cumle olsun ve somut veri noktalarina dayansin.
- similarTasks alanina yalnizca verilen task key'lerinden veya sprint verisinden cikarilabilen kisa referanslar yaz. Dayanak yoksa bos dizi don.
- velocityInsight ve sprintCapacityRecommendation alanlarinda abartili iddia kurma; yalnizca gorunen trendi ozetle.
- Gecmis veri zayifsa bunu acikca belirt ve kesin dil kullanma.

${JSON_ONLY_RULES}

Gecmis sprint verileri:
${stringify(velocityData)}

Tahmin yapilacak gorevler:
${stringify(taskData)}`;
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

  return `Rolun: dikkatli bir teknik lider asistani.

Amac:
- Verilen Jira gorevini gercekci teknik alt gorevlere bol.
- Her alt gorev icin sadece eldeki takim bilgisine gore savunulabilir atama oner.

Parcalama kurallari:
- Yalnizca gercekten gerekli alt gorevleri uret. Gereksiz sisirme yapma.
- Alt gorev tipleri sadece su degerlerden biri olabilir: Frontend, Backend, Database, Test, DevOps, Design.
- estimatedHours degeri pozitif, gercekci ve muhafazakar olsun.
- suggestedAssignee yalnizca takim listesindeki id alanlarindan biri olsun. Isim degil id don.
- Uygun kisi yoksa suggestedAssignee icin bos string don.
- Kapasitesi 0 veya altinda olanlari zorunlu olmadikca secme.
- Assignment kararini once role ve skill uyumu, sonra availableCapacity ile ver.
- Task description belirsizse alt gorev sayisini ve tahminleri abartma; risklere belirsizlik ekle.
- risks alanina yalnizca gorev verisinden cikarilabilen somut riskleri yaz. Risk yoksa bos dizi don.
- assignmentRationale en fazla 3 kisa cumle olsun ve sadece mevcut takim verisine dayansin.

${JSON_ONLY_RULES}

Gorev:
${stringify({
  key: task.key,
  summary: task.summary,
  description: task.description || "Belirtilmemis",
  issueType: task.issueType,
  components: task.components,
  labels: task.labels,
})}

Takim:
${stringify(memberData)}`;
}

export function buildSprintReportPrompt(
  sprint: JiraSprint,
  metrics: Record<string, unknown>,
  mode: "primary" | "retry" = "primary"
): string {
  const done = sprint.issues.filter((i) => i.status === "Done");
  const notDone = sprint.issues.filter((i) => i.status !== "Done");
  const blocked = sprint.issues.filter((i) => i.status === "Blocked");

  const doneHighlights = done.slice(0, 6).map((i) => ({
    key: i.key,
    summary: i.summary,
    component: i.components[0] || null,
    type: i.issueType,
  }));
  const riskHighlights = notDone.slice(0, 8).map((i) => ({
    key: i.key,
    summary: i.summary,
    status: i.status,
    component: i.components[0] || null,
    type: i.issueType,
  }));

  const deliveryThemes = Array.from(
    new Set(done.flatMap((issue) => issue.components.slice(0, 1).concat(issue.labels.slice(0, 1))))
  )
    .filter(Boolean)
    .slice(0, 4);

  const riskThemes = Array.from(
    new Set(
      notDone.flatMap((issue) => issue.components.slice(0, 1).concat(issue.labels.slice(0, 1)))
    )
  )
    .filter(Boolean)
    .slice(0, 4);

  const openThemePressure = Array.from(
    notDone.reduce((acc, issue) => {
      const theme = issue.components[0] || issue.labels[0];
      if (!theme) return acc;
      acc.set(theme, (acc.get(theme) ?? 0) + 1);
      return acc;
    }, new Map<string, number>())
  )
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([theme, openItems]) => ({ theme, openItems }));

  const strictModeRules =
    mode === "retry"
      ? `
Ek zorunlu kurallar:
- Sprint adini tek basina yazip birakma.
- Yarım cumle donme.
- En az 4 tam cumle kur.
- Ilk 5 kelime icinde sprint adini tekrar edip takilma.
`.trim()
      : "";

  return `Rolun: sprint kapanis ozeti yazan dikkatli bir Scrum Master asistani.

Amac:
- Verilen sprint ve issue baglamindan Turkce, profesyonel ve Scrum Master odakli bir sprint ozeti yaz.
- Raporu yalnizca gorunen verilere dayandir. Basari veya sorun yoksa uydurma.

Yazim kurallari:
- Tek paragraf don.
- Toplam uzunluk 350-800 karakter bandinda olsun.
- Ekranda zaten gorunen sayilari tekrar etme; oran, puan, adet veya tarih tekrari yapma.
- Sayisal ozet yerine sprint akisina odaklan: ne kapandi, hangi hatlarda ilerleme var, hangi acik isler kapanisi baskiladi, nerede koordinasyon veya takip ihtiyaci dogdu, sonraki sprintte hangi operasyonel odak gerekli.
- Tamamlanmayan isleri basari gibi gostermeme.
- Veri eksikse bunu dolayli ve kisa ifade et; tahmin yurutme.
- Genel ve bos cumle kurma. Her cumle issue listesinde gorulen bir paterne dayansin.
- Teknik mikro detaylara inmeden scrum takibi dili kullan: akis, kapanis, tasinan is, odak, takip, koordinasyon, test veya entegrasyon baskisi.
- Takimin gunluk akisina hakim bir Scrum Master okuyacakmis gibi yaz; yonetici sunumu tonu kullanma.
- En az 4 cumle kur.
- Sprint adini en fazla bir kez kullan; sadece gercekten gerekiyorsa.
- Ekranda gorulen sayilari, task key'lerini ve ham issue basliklarini aynen tekrar etme.
- Duz metin disinda hicbir sey donme.
- "acil", "kritik", "engel", "blokaj" gibi guclu ifadeleri sadece girdi bunu destekliyorsa kullan.
- Guvenlik, entegrasyon, E2E, performans, chatbot gibi spesifik basliklari sadece ilgili open issue summary veya component bunu acikca destekliyorsa kullan.
- Bir component veya tema icin baski var diyorsan, bunun open issue listesinde karsiligi olmali.

${strictModeRules}

Sprint:
${stringify({
  name: sprint.name,
  goal: sprint.goal,
  startDate: sprint.startDate,
  endDate: sprint.endDate,
})}

Metrikler:
${stringify(metrics)}

Teslimat temalari:
${stringify(deliveryThemes)}

Acik risk temalari:
${stringify(riskThemes)}

Acik tema yogunlugu:
${stringify(openThemePressure)}

Tamamlanan gorevler:
${stringify(doneHighlights)}

Tamamlanamayan gorevler:
${stringify(riskHighlights)}

Blocked gorev sayisi:
${stringify(blocked.length)}

Ek kural:
- Metinde hicbir yerde veri setinde olmayan task key, isim veya sayi gecirme.
- "Sprint genel olarak iyi gitti" gibi yuzeysel kaliplar kullanma.
- "backend", "frontend", "api", "bugfix" gibi teknik etiketleri sadece gercekten gerekliysa kullan.
- Blocked issue yoksa "engel" veya "blokaj" deme; daha yumusak bir risk dili kullan.
- Open issue listesinde guvenlik gecmiyorsa guvenlik riski deme.
- Open issue listesinde E2E, test veya UAT ifadesi varsa test kapanisi veya dogrulama baskisindan soz edebilirsin.
- Tek paragraf olarak bitir ve 800 karakteri gecme.
- Raporu metrik tekrari olmadan, ama issue verisinden savunulabilir sekilde yaz.`;
}

export function buildHealthScorePrompt(metrics: {
  completionRate: number;
  velocityTrend: string;
  blockerCount: number;
  carryoverRate: number;
  teamCapacityUsage: number;
  sprintGoalMet: boolean;
}): string {
  return `Rolun: muhafazakar ve hesap odakli bir agile coach asistani.

Amac:
- Verilen sprint metriklerine gore 1-100 arasi tek bir sprint health score hesapla.
- Skoru asagidaki deterministik rubrige gore uret; serbest yorumla sayi uydurma.

Hesaplama kurallari:
- completionScore = 0-40 arasi. completionRate dogrudan ana etki olsun.
- velocityScore = 0-20 arasi.
  - improving veya stable ise daha yuksek,
  - declining ise belirgin daha dusuk.
- blockerScore = 0-15 arasi.
  - blockerCount arttikca puan dusmeli.
  - blockerCount 0 ise yuksek puan ver.
- carryoverScore = 0-15 arasi.
  - carryoverRate dustukce puan artmali.
- capacityScore = 0-10 arasi.
  - teamCapacityUsage %80-%95 bandina yakin ise daha iyi,
  - cok dusuk veya %100 ustu ise daha kotu.
- sprintGoalMet false ise toplam skorda asagi yonlu ihtiyatli etki uygula.
- breakdown alanlarinin toplami score degerine esit olmali.
- Tum sayilar tam sayi olsun.
- grade su araliklara gore ver:
  - 90-100 = A
  - 80-89 = B
  - 70-79 = C
  - 60-69 = D
  - 0-59 = F
- recommendations alanina en fazla 3 somut oneri yaz.
- summary en fazla 2 kisa cumle olsun ve breakdown ile tutarli olsun.

${JSON_ONLY_RULES}

Metrikler:
${stringify(metrics)}`;
}
