import type { Plan, PlanStore, SavedPlan, Trip } from "./types.ts";

export function createPlanStore(
  plans: ReadonlyMap<number, Plan> = new Map(),
  trips: ReadonlyMap<number, Trip> = new Map(),
) {
  const entries = new Map<number, { plan: Plan; saved: Map<number, SavedPlan> }>();
  const locked = new Set<number>();
  const store: PlanStore = {
    getPlan: (id) => entries.get(id)?.plan,
    getTrip: (id) => trips.get(id),
    getSaved: (id, revision) => entries.get(id)?.saved.get(revision),
    tryLock(id) {
      if (locked.has(id)) return false;
      locked.add(id);
      return true;
    },
    unlock(id) {
      locked.delete(id);
    },
    save(plan) {
      const saved = new Map(entries.get(plan.id)?.saved);
      saved.set(plan.revision, plan);
      entries.set(plan.id, { plan, saved });
    },
  };
  function seedPlan(plan: Plan) {
    entries.set(plan.id, {
      plan,
      saved: entries.get(plan.id)?.saved ?? new Map<number, SavedPlan>(),
    });
  }
  for (const plan of plans.values()) seedPlan(plan);
  return { ...store, seedPlan };
}
