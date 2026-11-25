import type { Forecast, PlaceData, Plan, Spending } from "./types.ts";

function minutes(time: string) {
  return Number(time.slice(0, 2)) * 60 + Number(time.slice(3, 5));
}

export function validatePlan(plan: Plan, data: PlaceData, forecast: Forecast, spending: Spending) {
  const violations: { code: string; pointer: string; detail: string }[] = [];
  function add(code: string, pointer: string, detail: string) {
    violations.push({ code, pointer, detail });
  }

  if (plan.days.every((day) => day.stops.length === 0)) {
    add("empty-plan", "/days", "The plan has no stops.");
  }
  const members = new Set(spending.members.map(({ userId }) => userId));
  plan.days.forEach(({ date, stops }, d) => {
    stops.forEach((stop, s) => {
      const pointer = `/days/${d}/stops/${s}`;
      const place = data.places.get(stop.placeId);
      const previous = stops[s - 1];
      const arrive = minutes(stop.arriveAt);
      const leave = minutes(stop.leaveAt);
      const previousLeave = previous ? minutes(previous.leaveAt) : undefined;
      const validTimes = arrive < leave && (previousLeave === undefined || previousLeave <= arrive);
      if (!place?.hours || !place.menu) {
        add("unknown-place", `${pointer}/placeId`, "The place has no complete listing.");
      }
      if (!validTimes) {
        add("bad-times", pointer, "The visit has invalid times or overlaps the previous stop.");
      }
      const hours = place?.hours?.get(date) ?? [];
      if (
        place?.hours &&
        arrive < leave &&
        !hours.some(({ opens, closes }) => minutes(opens) <= arrive && leave <= minutes(closes))
      ) {
        add("closed", pointer, "The visit falls outside the opening hours.");
      }
      if (previous && previousLeave !== undefined) {
        const travel = data.travelMinutes.get(previous.placeId)?.get(stop.placeId);
        if (travel !== undefined && previousLeave + travel > arrive) {
          add(
            "travel-time",
            pointer,
            "The schedule allows too little time for the motorbike transfer.",
          );
        }
      }
      const rain = forecast.get(date);
      if (place?.outdoor && rain && arrive < leave) {
        for (let hour = Math.floor(arrive / 60); hour * 60 < leave; hour++) {
          if ((rain.get(hour) ?? 0) > 60) {
            add("rain", pointer, "The chance of rain exceeds 60% during the outdoor visit.");
            break;
          }
        }
      }
      stop.items.forEach((item, i) => {
        const itemPointer = `${pointer}/items/${i}`;
        if (place?.menu && !place.menu.has(item.menuItemId)) {
          add("unknown-item", `${itemPointer}/menuItemId`, "The item is missing from the menu.");
        }
        if (!members.has(item.userId)) {
          add("unknown-member", `${itemPointer}/userId`, "The payer is not a trip member.");
        }
      });
    });
  });

  spending.members.forEach(({ limitVnd, spentVnd }, index) => {
    if (limitVnd !== null && spentVnd > limitVnd) {
      add(
        "over-member-limit",
        `/spending/members/${index}`,
        "The member exceeds the spending limit.",
      );
    }
  });
  if (spending.totalVnd > spending.budgetVnd) {
    add("over-group-total", "/spending/totalVnd", "The plan exceeds the trip budget.");
  }
  return violations;
}
