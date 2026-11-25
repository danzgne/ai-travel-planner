export type Item = { menuItemId: number; userId: number; qty: number };
export type Stop = {
  placeId: number;
  arriveAt: string;
  leaveAt: string;
  items: Item[];
};
export type Day = { date: string; stops: Stop[] };
export type Plan = {
  id: number;
  tripId: number;
  authorId: number;
  revision: number;
  savedRevision: number | null;
  savedAt: string | null;
  days: Day[];
};
export type Trip = { budgetVnd: number } & (
  | { kind: "individual"; ownerId: number }
  | { kind: "group"; members: { userId: number; capVnd: number | null }[] }
);
export type Spending = {
  budgetVnd: number;
  totalVnd: number;
  members: { userId: number; spentVnd: number; limitVnd: number | null }[];
};
export type SavedPlan = Omit<Plan, "days" | "savedAt" | "savedRevision"> & {
  status: "saved";
  savedRevision: number;
  savedAt: string;
  days: (Omit<Day, "stops"> & {
    stops: (Omit<Stop, "items"> & { items: (Item & { unitPriceVnd: number })[] })[];
  })[];
  spending: Spending;
};
export type Place = {
  outdoor: boolean;
  hours?: ReadonlyMap<string, readonly { opens: string; closes: string }[]>;
  menu?: ReadonlyMap<number, number>;
};
export type PlaceData = {
  places: ReadonlyMap<number, Place>;
  travelMinutes: ReadonlyMap<number, ReadonlyMap<number, number>>;
};
export type Forecast = ReadonlyMap<string, ReadonlyMap<number, number>>;
export type PlanStore = {
  getPlan(id: number): Plan | undefined;
  getTrip(id: number): Trip | undefined;
  getSaved(id: number, revision: number): SavedPlan | undefined;
  tryLock(id: number): boolean;
  unlock(id: number): void;
  save(plan: SavedPlan): void;
};
export type AppDeps = {
  verifyToken(token: string): number | undefined | Promise<number | undefined>;
  store: PlanStore;
  readPlaces(): Promise<PlaceData>;
  readForecast(): Promise<Forecast>;
};
