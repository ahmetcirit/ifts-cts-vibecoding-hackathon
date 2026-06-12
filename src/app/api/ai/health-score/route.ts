import { NextResponse } from "next/server";

type HealthInput = {
  completionRate: number;
  velocityTrend: string;
  blockerCount: number;
  carryoverRate: number;
  teamCapacityUsage: number;
  sprintGoalMet: boolean;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizeTrend(value: string): "up" | "down" | "stable" {
  const lower = value.toLowerCase();
  if (lower === "up" || lower === "improving") return "up";
  if (lower === "down" || lower === "declining") return "down";
  return "stable";
}

function computeHealthScore(input: HealthInput) {
  const completionScore = clamp(Math.round((input.completionRate / 100) * 40), 0, 40);

  const trend = normalizeTrend(input.velocityTrend);
  const velocityScore = trend === "up" ? 18 : trend === "stable" ? 15 : 9;

  const blockerScore = clamp(15 - input.blockerCount * 3, 0, 15);
  const carryoverScore = clamp(Math.round(((100 - input.carryoverRate) / 100) * 15), 0, 15);

  const usageDelta = Math.abs(input.teamCapacityUsage - 88);
  const capacityScore = clamp(10 - Math.round(usageDelta / 6), 0, 10);

  let score =
    completionScore + velocityScore + blockerScore + carryoverScore + capacityScore;

  if (!input.sprintGoalMet) {
    score = clamp(score - 6, 0, 100);
  }

  const grade =
    score >= 90 ? "A" : score >= 80 ? "B" : score >= 70 ? "C" : score >= 60 ? "D" : "F";

  const recommendations: string[] = [];

  if (input.carryoverRate >= 25) {
    recommendations.push("Sprint kapsamını daraltıp bitirme odaklı plan yapılmalı.");
  }
  if (input.blockerCount > 0) {
    recommendations.push("Blokerlerin sahipliği günlük olarak netleştirilmeli.");
  }
  if (input.teamCapacityUsage > 100 || input.teamCapacityUsage < 65) {
    recommendations.push("Kapasite planı gerçek iş yüküne göre yeniden ayarlanmalı.");
  }
  if (trend === "down") {
    recommendations.push("Velocity düşüşünün kök nedeni ayrıştırılıp sonraki sprintte korunmalı.");
  }

  const summary =
    score >= 80
      ? "Sprint dengeli ilerlemiş; temel riskler kontrol altında kalmış görünüyor."
      : score >= 60
        ? "Sprint çıktı üretmiş olsa da akışta verim kaybı ve plan sapması sinyali var."
        : "Sprint sağlığı zayıf; planlama, akış ve risk yönetimi birlikte ele alınmalı.";

  return {
    score,
    grade,
    breakdown: {
      completionScore,
      velocityScore,
      blockerScore,
      carryoverScore,
      capacityScore,
    },
    recommendations: recommendations.slice(0, 3),
    summary,
  };
}

export async function POST(request: Request) {
  try {
    const metrics = (await request.json()) as HealthInput;
    return NextResponse.json(computeHealthScore(metrics));
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
