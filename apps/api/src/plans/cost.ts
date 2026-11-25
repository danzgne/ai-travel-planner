import type { PlaceData, Plan, SavedPlan, Spending, Trip } from "./types.ts";

export function tripMemberIds(trip: Trip) {
  return trip.kind === "individual" ? [trip.ownerId] : trip.members.map(({ userId }) => userId);
}

export function pricePlan(plan: Plan, trip: Trip, data: PlaceData) {
  const spent = new Map(tripMemberIds(trip).map((id) => [id, 0]));
  const caps = trip.kind === "group" ? trip.members.flatMap(({ capVnd }) => capVnd ?? []) : [];
  const limitVnd =
    trip.kind === "individual" ? trip.budgetVnd : caps.length > 0 ? Math.min(...caps) : null;

  const days: SavedPlan["days"] = plan.days.map((day) => ({
    ...day,
    stops: day.stops.map((stop) => {
      const menu = data.places.get(stop.placeId)?.menu;
      return {
        ...stop,
        items: stop.items.flatMap((item) => {
          const unitPriceVnd = menu?.get(item.menuItemId);
          const spentVnd = spent.get(item.userId);
          if (unitPriceVnd === undefined || spentVnd === undefined) return [];
          spent.set(item.userId, spentVnd + unitPriceVnd * item.qty);
          return [{ ...item, unitPriceVnd }];
        }),
      };
    }),
  }));

  const members = Array.from(spent, ([userId, spentVnd]) => ({ userId, spentVnd, limitVnd }));
  const spending: Spending = {
    budgetVnd: trip.budgetVnd,
    totalVnd: members.reduce((total, member) => total + member.spentVnd, 0),
    members,
  };
  return { days, spending };
}
