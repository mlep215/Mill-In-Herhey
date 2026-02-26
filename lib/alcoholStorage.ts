export type AlcoholCategory =
  | "vodka"
  | "gin"
  | "tequila"
  | "rum"
  | "bourbon"
  | "scotch"
  | "whiskey"
  | "brandy"
  | "liqueur"
  | "wine-red"
  | "wine-white"
  | "wine-sparkling"
  | "wine-rose"
  | "beer"
  | "other";

export type AlcoholCountItem = {
  id: string;
  name: string;

  category: AlcoholCategory;

  // stored as ounces so we can do math immediately
  bottleSizeOz: number; // 750ml=25.36, 1L=33.81, 1.75L=59.17, 3L=101.44
  bottleCost: number; // optional, cost per bottle

  // staff taps 0.25/0.5/0.75/1 only
  count: number;

  notes?: string;
  updatedAt: string; // ISO
};

export type AlcoholSessionData = {
  sessionId: string;
  locationId: string;
  createdAt: string;
  updatedAt: string;
  items: AlcoholCountItem[];
};

function key(sessionId: string, locationId: string) {
  return `alcoholCount:${sessionId}:${locationId}`;
}

export function loadAlcoholSession(
  sessionId: string,
  locationId: string
): AlcoholSessionData {
  if (typeof window === "undefined") {
    return {
      sessionId,
      locationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    };
  }

  const raw = window.localStorage.getItem(key(sessionId, locationId));
  if (!raw) {
    const fresh: AlcoholSessionData = {
      sessionId,
      locationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    };
    window.localStorage.setItem(key(sessionId, locationId), JSON.stringify(fresh));
    return fresh;
  }

  try {
    return JSON.parse(raw) as AlcoholSessionData;
  } catch {
    const fresh: AlcoholSessionData = {
      sessionId,
      locationId,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      items: [],
    };
    window.localStorage.setItem(key(sessionId, locationId), JSON.stringify(fresh));
    return fresh;
  }
}

export function saveAlcoholSession(data: AlcoholSessionData) {
  if (typeof window === "undefined") return;
  const next = { ...data, updatedAt: new Date().toISOString() };
  window.localStorage.setItem(key(data.sessionId, data.locationId), JSON.stringify(next));
}

export function clearAlcoholSession(sessionId: string, locationId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(key(sessionId, locationId));
}

export function ouncesForItem(it: AlcoholCountItem) {
  return it.count * it.bottleSizeOz;
}

export function valueForItem(it: AlcoholCountItem) {
  return it.count * it.bottleCost;
}

export function toCsv(data: AlcoholSessionData): string {
  const header = [
    "Location",
    "SessionId",
    "Category",
    "Name",
    "BottleSizeOz",
    "Fraction",
    "Ounces",
    "BottleCost",
    "Value",
    "Notes",
    "UpdatedAt",
  ];

  const rows = data.items.map((it) => [
    data.locationId,
    data.sessionId,
    it.category,
    it.name,
    String(it.bottleSizeOz),
    String(it.count),
    String(ouncesForItem(it)),
    String(it.bottleCost),
    String(valueForItem(it)),
    it.notes ?? "",
    it.updatedAt,
  ]);

  const escape = (v: string) => {
    const needs = /[",\n]/.test(v);
    const s = v.replace(/"/g, '""');
    return needs ? `"${s}"` : s;
  };

  return [header, ...rows].map((r) => r.map((c) => escape(c)).join(",")).join("\n");
}