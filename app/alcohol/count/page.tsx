"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type LocationRow = { id: string; name: string };
type ItemRow = { id: string; name: string };

type LatestCountMap = Record<
  string,
  { qty_bottles: number | null; qty_ounces: number | null; counted_at: string | null }
>;

type RowState = {
  bottles: string;
  ounces: string;
};

async function fetchLocations(): Promise<{ locations: LocationRow[]; debug: string }> {
  const candidates = [
    { table: "locations", id: "id", name: "name" },
    { table: "inventory_locations", id: "id", name: "name" },
    { table: "alcohol_locations", id: "id", name: "name" },
    { table: "locations", id: "id", name: "location_name" },
    { table: "inventory_locations", id: "id", name: "location_name" },
    { table: "alcohol_locations", id: "id", name: "location_name" },
  ] as const;

  for (const c of candidates) {
    const { data, error } = await supabase.from(c.table).select(`${c.id},${c.name}`);
    if (error) continue;

    const rows = (data ?? [])
      .map((r: any) => ({ id: String(r[c.id]), name: String(r[c.name]) }))
      .filter((x) => x.id && x.name);

    if (rows.length) {
      rows.sort((a, b) => a.name.localeCompare(b.name));
      return { locations: rows, debug: `Loaded locations from "${c.table}" (${c.id}, ${c.name})` };
    }
  }

  return {
    locations: [],
    debug:
      `Could not load locations from common tables. ` +
      `If you have Row Level Security enabled, it may be blocking SELECT on locations.`,
  };
}

async function fetchItems(): Promise<{ items: ItemRow[]; debug: string }> {
  const candidates = [
    { table: "items", id: "id", name: "name" },
    { table: "inventory_items", id: "id", name: "name" },
    { table: "alcohol_items", id: "id", name: "name" },
    { table: "items", id: "id", name: "item_name" },
    { table: "inventory_items", id: "id", name: "item_name" },
    { table: "alcohol_items", id: "id", name: "item_name" },
  ] as const;

  for (const c of candidates) {
    const { data, error } = await supabase.from(c.table).select(`${c.id},${c.name}`);
    if (error) continue;

    const rows = (data ?? [])
      .map((r: any) => ({ id: String(r[c.id]), name: String(r[c.name]) }))
      .filter((x) => x.id && x.name);

    if (rows.length) {
      rows.sort((a, b) => a.name.localeCompare(b.name));
      return { items: rows, debug: `Loaded items from "${c.table}" (${c.id}, ${c.name})` };
    }
  }

  return {
    items: [],
    debug:
      `Could not load items from common tables. ` +
      `If you have Row Level Security enabled, it may be blocking SELECT on items.`,
  };
}

const TABLES = {
  countBatches: "inventory_count_batches",
  counts: "inventory_counts",
};

// Turn your stored location names into the button labels you want
function prettyLocationLabel(name: string) {
  const n = name.trim().toLowerCase();

  // common patterns
  if (n === "bar 1" || n === "floor 1" || n.includes("bar 1") || n.includes("floor 1")) return "Floor 1";
  if (n === "bar 2" || n === "floor 2" || n.includes("bar 2") || n.includes("floor 2")) return "Floor 2";
  if (n === "bar 3" || n === "floor 3" || n.includes("bar 3") || n.includes("floor 3")) return "Floor 3";
  if (n.includes("liquor") && n.includes("cabinet")) return "Liquor Cabinet";

  // fallback = show whatever is in DB
  return name;
}

// Sort so your buttons appear in the order you expect
function sortLocationsForButtons(a: LocationRow, b: LocationRow) {
  const order = (label: string) => {
    const l = prettyLocationLabel(label).toLowerCase();
    if (l === "liquor cabinet") return 0;
    if (l === "floor 1") return 1;
    if (l === "floor 2") return 2;
    if (l === "floor 3") return 3;
    return 99;
  };
  return order(a.name) - order(b.name) || a.name.localeCompare(b.name);
}

export default function WeeklyCountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string>("");

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  const [latestCounts, setLatestCounts] = useState<LatestCountMap>({});
  const [rows, setRows] = useState<Record<string, RowState>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      setDebug("");

      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        setError(authErr.message);
        setLoading(false);
        return;
      }
      if (!authData.user) {
        setError("Not logged in. Please log in first.");
        setLoading(false);
        return;
      }

      const [locRes, itemRes] = await Promise.all([fetchLocations(), fetchItems()]);

      const locsSorted = [...locRes.locations].sort(sortLocationsForButtons);

      setLocations(locsSorted);
      setItems(itemRes.items);
      setDebug(`${locRes.debug} | ${itemRes.debug}`);

      // pick default location
      if (!selectedLocationId && locsSorted.length) {
        setSelectedLocationId(locsSorted[0].id);
      }

      if (locsSorted.length === 0) {
        setError(
          "Locations are not loading, so the buttons can't show. This usually means the locations table name is different, " +
            "or database permissions (Row Level Security) are blocking reads."
        );
      } else if (itemRes.items.length === 0) {
        setError("No items found to count. Check your items table name/permissions.");
      }

      // initialize blank rows for ALL items
      const initRows: Record<string, RowState> = {};
      for (const it of itemRes.items) {
        initRows[it.id] = { bottles: "", ounces: "" };
      }
      setRows(initRows);

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedLocationId) return;

    (async () => {
      // Don't wipe error if it's the "no locations" error, but otherwise clear
      setError((prev) => (prev?.includes("Locations are not loading") ? prev : null));

      const { data, error: loadErr } = await supabase
        .from(TABLES.counts)
        .select("item_id, qty_bottles, qty_ounces, counted_at")
        .eq("location_id", selectedLocationId)
        .order("counted_at", { ascending: false })
        .limit(5000);

      if (loadErr) {
        setError(
          `Could not load previous counts (you can still enter counts, but last values won't show): ${loadErr.message}`
        );
        setLatestCounts({});
        return;
      }

      const map: LatestCountMap = {};
      for (const r of data ?? []) {
        const itemId = (r as any).item_id as string;
        if (!map[itemId]) {
          map[itemId] = {
            qty_bottles: (r as any).qty_bottles ?? null,
            qty_ounces: (r as any).qty_ounces ?? null,
            counted_at: (r as any).counted_at ?? null,
          };
        }
      }
      setLatestCounts(map);
    })();
  }, [selectedLocationId]);

  function setRow(itemId: string, patch: Partial<RowState>) {
    setRows((prev) => ({
      ...prev,
      [itemId]: { ...(prev[itemId] ?? { bottles: "", ounces: "" }), ...patch },
    }));
  }

  function parseMaybeNumber(s: string): number | null {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }

  const visibleRows = useMemo(() => {
    return items.map((it) => {
      const last = latestCounts[it.id] ?? { qty_bottles: null, qty_ounces: null, counted_at: null };
      const state = rows[it.id] ?? { bottles: "", ounces: "" };
      return { item: it, last, state };
    });
  }, [items, latestCounts, rows]);

  async function saveCount() {
    setSaving(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;

    if (!selectedLocationId) {
      setError("Choose a location first.");
      setSaving(false);
      return;
    }

    const payload = Object.entries(rows)
      .map(([itemId, st]) => ({
        item_id: itemId,
        qty_bottles: parseMaybeNumber(st.bottles),
        qty_ounces: parseMaybeNumber(st.ounces),
      }))
      .filter((r) => r.qty_bottles !== null || r.qty_ounces !== null);

    if (payload.length === 0) {
      setError("Nothing to save — all fields are blank.");
      setSaving(false);
      return;
    }

    // Create batch
    const { data: batch, error: batchErr } = await supabase
      .from(TABLES.countBatches)
      .insert({
        location_id: selectedLocationId,
        counted_by: userId,
      })
      .select("id")
      .single();

    if (batchErr) {
      setError(
        `Create batch failed. Table "${TABLES.countBatches}" may not exist yet or permissions block it. Error: ${batchErr.message}`
      );
      setSaving(false);
      return;
    }

    const batchId = (batch as any).id as string;

    // Insert counts
    const { error: rowsErr } = await supabase.from(TABLES.counts).insert(
      payload.map((r) => ({
        count_batch_id: batchId,
        location_id: selectedLocationId,
        item_id: r.item_id,
        qty_bottles: r.qty_bottles,
        qty_ounces: r.qty_ounces,
        counted_by: userId,
      }))
    );

    if (rowsErr) {
      setError(`Save counts failed: ${rowsErr.message}`);
      setSaving(false);
      return;
    }

    // Clear inputs after save
    setRows((prev) => {
      const cleared: typeof prev = {};
      for (const k of Object.keys(prev)) cleared[k] = { bottles: "", ounces: "" };
      return cleared;
    });

    alert("Weekly count saved.");
    setSaving(false);
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      {/* Top Nav */}
      <div className="flex gap-3">
        <Link href="/alcohol/count" className="rounded bg-black text-white px-4 py-2">
          Weekly Count
        </Link>
        <Link href="/alcohol/new-session" className="rounded border px-4 py-2">
          New Session
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-semibold">Weekly Inventory Count</h1>
        <p className="text-sm opacity-80">All items are shown with blanks. Leave blank if you didn’t count it.</p>
        <p className="text-xs opacity-60 mt-1">{debug}</p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">{error}</div>
      )}

      {/* Location Buttons */}
      <div className="space-y-2">
        <div className="text-sm font-medium">Location</div>

        {locations.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {locations.map((loc) => {
              const selected = loc.id === selectedLocationId;
              return (
                <button
                  key={loc.id}
                  type="button"
                  onClick={() => setSelectedLocationId(loc.id)}
                  className={[
                    "rounded px-4 py-3 border text-left",
                    selected ? "bg-black text-white border-black" : "bg-white hover:bg-gray-50",
                  ].join(" ")}
                >
                  <div className="text-sm font-semibold">{prettyLocationLabel(loc.name)}</div>
                  <div className="text-xs opacity-70">{loc.name}</div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="text-sm opacity-80">
            No locations loaded — once locations load, you’ll see Floor 1 / Floor 2 / Floor 3 / Liquor Cabinet buttons
            here.
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-end gap-3 pt-2">
        <button
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
          onClick={saveCount}
          disabled={saving || !selectedLocationId}
        >
          {saving ? "Saving…" : "Save Weekly Count"}
        </button>
      </div>

      <div className="overflow-auto border rounded">
        <table className="min-w-[900px] w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left p-2">Item</th>
              <th className="text-left p-2">Bottles</th>
              <th className="text-left p-2">Ounces</th>
              <th className="text-left p-2">Last Count</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.map(({ item, last, state }) => (
              <tr key={item.id} className="border-t">
                <td className="p-2 font-medium">{item.name}</td>
                <td className="p-2">
                  <input
                    className="border rounded px-2 py-1 w-32"
                    inputMode="decimal"
                    placeholder="e.g. 12"
                    value={state.bottles}
                    onChange={(e) => setRow(item.id, { bottles: e.target.value })}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="border rounded px-2 py-1 w-32"
                    inputMode="decimal"
                    placeholder="e.g. 8"
                    value={state.ounces}
                    onChange={(e) => setRow(item.id, { ounces: e.target.value })}
                  />
                </td>
                <td className="p-2 opacity-80">
                  {last.qty_bottles !== null || last.qty_ounces !== null ? (
                    <div className="space-y-0.5">
                      <div>
                        Bottles: <span className="font-mono">{String(last.qty_bottles ?? "")}</span>{" "}
                        Ounces: <span className="font-mono">{String(last.qty_ounces ?? "")}</span>
                      </div>
                      {last.counted_at && (
                        <div className="text-xs">Counted: {new Date(last.counted_at).toLocaleString()}</div>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs">No prior count</span>
                  )}
                </td>
              </tr>
            ))}

            {!visibleRows.length && (
              <tr>
                <td className="p-4" colSpan={4}>
                  No items found.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}