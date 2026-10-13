import type { PlanId } from "@/constants/plans";

const RANK: Record<PlanId, number> = {
  free: 0,
  starter: 1,
  pro: 2,
};

export function planRank(plan: PlanId): number {
  return RANK[plan] ?? 0;
}

export function isUpgrade(from: PlanId, to: PlanId): boolean {
  return planRank(to) > planRank(from);
}

export function isDowngrade(from: PlanId, to: PlanId): boolean {
  return planRank(to) < planRank(from);
}
