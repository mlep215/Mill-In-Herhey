"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type LocationRow = { id: string; name: string };
type ItemRow = { id: string; name: string };

type LatestCountMap = Record<
  string, // item_id
  { qty_bottles: number | null; qty_ounces: number | null; counted_at: string | null }
>;

type RowState = {
  bottles: string; // keep as string for inputs
  ounces: string;
};

const TABLES = {
  locations: "locations", // <-- change if yours differs
  items: "items",         // <-- change if yours differs
  countBatches: "inventory_count_batches",
  counts: "inventory_counts",
};

export default function WeeklyCountPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [selectedLocationId, setSelectedLocationId] = useState<string>("");

  // latest counts for selected location, keyed by item_id
  const [latestCounts, setLatestCounts] = useState<LatestCountMap>({});

  // inputs keyed by item_id
  const [rows, setRows] = useState<Record<string, RowState>>({});

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      // Ensure logged in (you said you have login screen already)
      const { data: authData, error: authErr } = await supabase.auth.getUser();
      if (authErr) {
        setError(authErr.message);
        setLoading(false);
        return;
      }
      if (!authData.user) {
        setError("Not logged in. Please log in to count inventory.");
        setLoading(false);
        return;
      }

      // Load locations + items
      const [{ data: locs, error: locErr }, { data: its, error: itemErr }] =
        await Promise.all([
          supabase.from(TABLES.locations).select("id,name").order("name"),
          supabase.from(TABLES.items).select("id,name").order("name"),
        ]);

      if (locErr) {
        setError(`Locations load failed: ${locErr.message}`);
        setLoading(false);
        return;
      }
      if (itemErr) {
        setError(`Items load failed: ${itemErr.message}`);
        setLoading(false);
        return;
      }

      const locRows = (locs ?? []) as LocationRow[];
      const itemRows = (its ?? []) as ItemRow[];

      setLocations(locRows);
      setItems(itemRows);

      // default location to first if not set
      if (!selectedLocationId && locRows.length) {
        setSelectedLocationId(locRows[0].id);
      }

      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedLocationId) return;
    (async () => {
      setError(null);

      // Pull recent counts for this location (we’ll compute “latest per item” in JS)
      const { data, error: loadErr } = await supabase
        .from(TABLES.counts)
        .select("item_id, qty_bottles, qty_ounces, counted_at")
        .eq("location_id", selectedLocationId)
        .order("counted_at", { ascending: false })
        .limit(5000);

      if (loadErr) {
        setError(`Latest counts load failed: ${loadErr.message}`);
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

      // Initialize blank input rows (ALL items show, blanks allowed)
      // We do NOT auto-fill inputs, but we will show “Last:” as reference.
      const nextRows: Record<string, RowState> = {};
      for (const it of items) {
        nextRows[it.id] = rows[it.id] ?? { bottles: "", ounces: "" };
      }
      setRows(nextRows);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedLocationId]);

  const visibleRows = useMemo(() => {
    return items.map((it) => {
      const last = latestCounts[it.id] ?? { qty_bottles: null, qty_ounces: null, counted_at: null };
      const state = rows[it.id] ?? { bottles: "", ounces: "" };
      return { item: it, last, state };
    });
  }, [items, latestCounts, rows]);

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

  async function saveCount() {
    setSaving(true);
    setError(null);

    const { data: authData } = await supabase.auth.getUser();
    const userId = authData.user?.id ?? null;

    // Only save rows where user entered something (blanks = not counted)
    const payload = Object.entries(rows)
      .map(([itemId, st]) => ({
        item_id: itemId,
        qty_bottles: parseMaybeNumber(st.bottles),
        qty_ounces: parseMaybeNumber(st.ounces),
      }))
      .filter((r) => r.qty_bottles !== null || r.qty_ounces !== null);

    if (!selectedLocationId) {
      setError("Choose a location first.");
      setSaving(false);
      return;
    }

    if (payload.length === 0) {
      setError("Nothing to save — all fields are blank.");
      setSaving(false);
      return;
    }

    // 1) Create a batch
    const { data: batch, error: batchErr } = await supabase
      .from(TABLES.countBatches)
      .insert({
        location_id: selectedLocationId,
        counted_by: userId,
      })
      .select("id")
      .single();

    if (batchErr) {
      setError(`Create batch failed: ${batchErr.message}`);
      setSaving(false);
      return;
    }

    const batchId = (batch as any).id as string;

    // 2) Insert count rows
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

    // Clear inputs after save (optional; if you prefer keep them, tell me)
    setRows((prev) => {
      const cleared: typeof prev = {};
      for (const k of Object.keys(prev)) cleared[k] = { bottles: "", ounces: "" };
      return cleared;
    });

    // refresh latest counts
    // easiest: just trigger by re-setting location
    setSelectedLocationId((x) => x);

    setSaving(false);
    alert("Weekly count saved.");
  }

  if (loading) return <div className="p-6">Loading…</div>;

  return (
    <div className="p-6 space-y-4">
      <div>
        <h1 className="text-2xl font-semibold">Weekly Inventory Count</h1>
        <p className="text-sm opacity-80">
          Shows all items. Leave blank if you didn’t count it. Last count is shown for reference.
        </p>
      </div>

      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex flex-wrap items-end gap-3">
        <div className="space-y-1">
          <label className="text-sm font-medium">Location</label>
          <select
            className="border rounded px-3 py-2"
            value={selectedLocationId}
            onChange={(e) => setSelectedLocationId(e.target.value)}
          >
            {locations.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>

        <button
          className="rounded bg-black text-white px-4 py-2 disabled:opacity-50"
          onClick={saveCount}
          disabled={saving}
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
                    placeholder="e.g. 0.75"
                    value={state.bottles}
                    onChange={(e) => setRow(item.id, { bottles: e.target.value })}
                  />
                </td>
                <td className="p-2">
                  <input
                    className="border rounded px-2 py-1 w-32"
                    inputMode="decimal"
                    placeholder="e.g. 12"
                    value={state.ounces}
                    onChange={(e) => setRow(item.id, { ounces: e.target.value })}
                  />
                </td>
                <td className="p-2 opacity-80">
                  {last.qty_bottles !== null || last.qty_ounces !== null ? (
                    <div className="space-y-0.5">
                      <div>
                        Bottles: <span className="font-mono">{String(last.qty_bottles ?? "")}</span>
                        {"  "}
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