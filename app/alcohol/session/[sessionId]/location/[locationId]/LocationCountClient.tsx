"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  AlcoholCategory,
  AlcoholCountItem,
  AlcoholSessionData,
  clearAlcoholSession,
  loadAlcoholSession,
  ouncesForItem,
  saveAlcoholSession,
  toCsv,
  valueForItem,
} from "@/lib/alcoholStorage";

const SIZE_PRESETS = [
  { label: "750ml", oz: 25.36 },
  { label: "1L", oz: 33.81 },
  { label: "1.75L", oz: 59.17 },
  { label: "3L", oz: 101.44 },
] as const;

const FRACTIONS = [0.25, 0.5, 0.75, 1] as const;

function round2(n: number) {
  return Math.round(n * 100) / 100;
}

function prettyLocation(id: string) {
  return id
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function prettyCategory(c: AlcoholCategory) {
  const map: Record<AlcoholCategory, string> = {
    vodka: "Vodka",
    gin: "Gin",
    tequila: "Tequila",
    rum: "Rum",
    bourbon: "Bourbon",
    scotch: "Scotch",
    whiskey: "Whiskey",
    brandy: "Brandy",
    liqueur: "Liqueur",
    "wine-red": "Wine (Red)",
    "wine-white": "Wine (White)",
    "wine-sparkling": "Wine (Sparkling)",
    "wine-rose": "Wine (Rosé)",
    beer: "Beer",
    other: "Other",
  };
  return map[c] ?? c;
}

function downloadText(filename: string, text: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export default function LocationCountClient({
  sessionId,
  locationId,
}: {
  sessionId: string;
  locationId: string;
}) {
  const router = useRouter();

  const [data, setData] = useState<AlcoholSessionData | null>(null);

  // Add form state
  const [name, setName] = useState("");
  const [category, setCategory] = useState<AlcoholCategory>("vodka");
  const [bottleSizeOz, setBottleSizeOz] = useState<number>(25.36); // 750ml default
  const [fraction, setFraction] = useState<number>(0.25);
  const [bottleCost, setBottleCost] = useState<string>(""); // optional
  const [notes, setNotes] = useState<string>("");

  // Load
  useEffect(() => {
    setData(loadAlcoholSession(sessionId, locationId));
  }, [sessionId, locationId]);

  // Autosave
  useEffect(() => {
    if (!data) return;
    saveAlcoholSession(data);
  }, [data]);

  const sortedItems = useMemo(() => {
    if (!data) return [];
    return [...data.items].sort((a, b) => {
      const cat = a.category.localeCompare(b.category);
      if (cat !== 0) return cat;
      return a.name.localeCompare(b.name);
    });
  }, [data]);

  function addItem() {
    if (!data) return;
    const trimmed = name.trim();
    if (!trimmed) return;

    const costNum = bottleCost.trim() === "" ? 0 : Number(bottleCost);
    if (Number.isNaN(costNum) || costNum < 0) return;

    const now = new Date().toISOString();
    const item: AlcoholCountItem = {
      id: crypto.randomUUID(),
      name: trimmed,
      category,
      bottleSizeOz,
      bottleCost: costNum,
      count: fraction,
      notes: notes.trim() ? notes.trim() : "",
      updatedAt: now,
    };

    setData({
      ...data,
      items: [...data.items, item],
      updatedAt: now,
    });

    // reset form
    setName("");
    setCategory("vodka");
    setBottleSizeOz(25.36);
    setFraction(0.25);
    setBottleCost("");
    setNotes("");
  }

  function updateItem(id: string, patch: Partial<AlcoholCountItem>) {
    if (!data) return;
    const now = new Date().toISOString();
    setData({
      ...data,
      items: data.items.map((it) =>
        it.id === id ? { ...it, ...patch, updatedAt: now } : it
      ),
      updatedAt: now,
    });
  }

  function deleteItem(id: string) {
    if (!data) return;
    const now = new Date().toISOString();
    setData({
      ...data,
      items: data.items.filter((it) => it.id !== id),
      updatedAt: now,
    });
  }

  function exportCsv() {
    if (!data) return;
    downloadText(
      `alcohol-count_${locationId}_${sessionId.slice(0, 8)}.csv`,
      toCsv(data)
    );
  }

  function resetSession() {
    if (!confirm("Clear this count session? This cannot be undone.")) return;
    clearAlcoholSession(sessionId, locationId);
    setData(loadAlcoholSession(sessionId, locationId));
  }

  if (!data) {
    return (
      <main style={{ minHeight: "100vh", background: "#f4f4f5", padding: 24 }}>
        <div style={{ fontFamily: "sans-serif", color: "#111" }}>Loading…</div>
      </main>
    );
  }

  return (
    <main
      style={{
        minHeight: "100vh",
        backgroundColor: "#f4f4f5",
        fontFamily: "sans-serif",
        padding: 24,
      }}
    >
      <div style={{ maxWidth: 1100, margin: "0 auto", display: "grid", gap: 16 }}>
        {/* Header */}
        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
            display: "flex",
            justifyContent: "space-between",
            gap: 12,
            alignItems: "flex-start",
          }}
        >
          <div>
            <div style={{ fontSize: 12, color: "#666", fontWeight: 800 }}>
              Alcohol Count
            </div>
            <h1 style={{ marginTop: 6, fontSize: 24, color: "#111" }}>
              {prettyLocation(locationId)}
            </h1>
            <div style={{ marginTop: 6, fontSize: 12, color: "#666" }}>
              Session: {sessionId.slice(0, 8)}… • Items: {data.items.length}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <button
              onClick={() => router.push("/alcohol/new-session")}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "white",
                cursor: "pointer",
                fontWeight: 800,
                color: "#111",
              }}
            >
              Back
            </button>
            <button
              onClick={exportCsv}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                cursor: "pointer",
                fontWeight: 800,
              }}
            >
              Export CSV
            </button>
            <button
              onClick={resetSession}
              style={{
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid #ddd",
                background: "#fafafa",
                cursor: "pointer",
                fontWeight: 800,
                color: "#111",
              }}
            >
              Clear Session
            </button>
          </div>
        </div>

        {/* Add Item */}
        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontWeight: 900, color: "#111" }}>Add Bottle / Item</div>

          <div style={{ marginTop: 12, display: "grid", gap: 10 }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Item name (e.g., Tito’s Vodka)"
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ccc",
                color: "#111",
                background: "white",
              }}
            />

            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, fontWeight: 900, color: "#111" }}>
                Category
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value as AlcoholCategory)}
                  style={{
                    marginLeft: 10,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    color: "#111",
                    background: "white",
                  }}
                >
                  <option value="vodka">Vodka</option>
                  <option value="gin">Gin</option>
                  <option value="tequila">Tequila</option>
                  <option value="rum">Rum</option>
                  <option value="bourbon">Bourbon</option>
                  <option value="scotch">Scotch</option>
                  <option value="whiskey">Whiskey</option>
                  <option value="brandy">Brandy</option>
                  <option value="liqueur">Liqueur</option>
                  <option value="wine-red">Wine (Red)</option>
                  <option value="wine-white">Wine (White)</option>
                  <option value="wine-sparkling">Wine (Sparkling)</option>
                  <option value="wine-rose">Wine (Rosé)</option>
                  <option value="beer">Beer</option>
                  <option value="other">Other</option>
                </select>
              </label>

              <label style={{ fontSize: 12, fontWeight: 900, color: "#111" }}>
                Bottle Cost (optional)
                <input
                  value={bottleCost}
                  onChange={(e) => setBottleCost(e.target.value)}
                  placeholder="e.g., 18.99"
                  inputMode="decimal"
                  style={{
                    marginLeft: 10,
                    padding: 10,
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    color: "#111",
                    background: "white",
                    width: 160,
                  }}
                />
              </label>
            </div>

            {/* Bottle size presets */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#111" }}>
                Bottle Size:
              </div>
              {SIZE_PRESETS.map((p) => (
                <button
                  key={p.label}
                  onClick={() => setBottleSizeOz(p.oz)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: bottleSizeOz === p.oz ? "1px solid #111" : "1px solid #ddd",
                    background: bottleSizeOz === p.oz ? "#111" : "#fafafa",
                    color: bottleSizeOz === p.oz ? "white" : "#111",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  {p.label}
                </button>
              ))}
              <div style={{ fontSize: 12, color: "#666" }}>({bottleSizeOz} oz)</div>
            </div>

            {/* Fraction buttons ONLY */}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ fontSize: 12, fontWeight: 900, color: "#111" }}>
                Amount in bottle:
              </div>
              {FRACTIONS.map((f) => (
                <button
                  key={String(f)}
                  onClick={() => setFraction(f)}
                  style={{
                    padding: "8px 10px",
                    borderRadius: 10,
                    border: fraction === f ? "1px solid #111" : "1px solid #ddd",
                    background: fraction === f ? "#111" : "#fafafa",
                    color: fraction === f ? "white" : "#111",
                    cursor: "pointer",
                    fontWeight: 900,
                  }}
                >
                  {f}
                </button>
              ))}
              <div style={{ fontSize: 12, color: "#666" }}>
                = {round2(fraction * bottleSizeOz)} oz
              </div>
            </div>

            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Notes (optional)"
              style={{
                padding: 10,
                borderRadius: 8,
                border: "1px solid #ccc",
                color: "#111",
                background: "white",
              }}
            />

            <button
              onClick={addItem}
              style={{
                padding: "10px 14px",
                borderRadius: 10,
                border: "1px solid #111",
                background: "#111",
                color: "white",
                cursor: "pointer",
                fontWeight: 900,
                width: 140,
              }}
            >
              Add Item
            </button>

            <div style={{ fontSize: 12, color: "#666" }}>
              Staff cannot type fractions — they must tap 0.25 / 0.5 / 0.75 / 1.
            </div>
          </div>
        </div>

        {/* Table */}
        <div
          style={{
            background: "white",
            borderRadius: 12,
            padding: 20,
            boxShadow: "0 10px 25px rgba(0,0,0,0.08)",
          }}
        >
          <div style={{ fontWeight: 900, color: "#111" }}>Current Count</div>

          {sortedItems.length === 0 ? (
            <div style={{ marginTop: 14, color: "#666" }}>
              No items yet. Add your first bottle above.
            </div>
          ) : (
            <div style={{ marginTop: 14, overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ textAlign: "left", color: "#111" }}>
                    <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Category</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Name</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Size (oz)</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Fraction</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Ounces</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Cost</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Value</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Notes</th>
                    <th style={{ padding: 10, borderBottom: "1px solid #eee" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {sortedItems.map((it) => (
                    <tr key={it.id}>
                      <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                        {prettyCategory(it.category)}
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                        <input
                          value={it.name}
                          onChange={(e) => updateItem(it.id, { name: e.target.value })}
                          style={{
                            width: "100%",
                            padding: 8,
                            borderRadius: 8,
                            border: "1px solid #ddd",
                            color: "#111",
                            background: "white",
                          }}
                        />
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                        {round2(it.bottleSizeOz)}
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          {FRACTIONS.map((f) => (
                            <button
                              key={String(f)}
                              onClick={() => updateItem(it.id, { count: f })}
                              style={{
                                padding: "6px 8px",
                                borderRadius: 10,
                                border: it.count === f ? "1px solid #111" : "1px solid #ddd",
                                background: it.count === f ? "#111" : "#fafafa",
                                color: it.count === f ? "white" : "#111",
                                cursor: "pointer",
                                fontWeight: 900,
                              }}
                            >
                              {f}
                            </button>
                          ))}
                        </div>
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                        {round2(ouncesForItem(it))}
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                        ${round2(it.bottleCost)}
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                        ${round2(valueForItem(it))}
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                        <input
                          value={it.notes ?? ""}
                          onChange={(e) => updateItem(it.id, { notes: e.target.value })}
                          placeholder="Optional"
                          style={{
                            width: "100%",
                            padding: 8,
                            borderRadius: 8,
                            border: "1px solid #ddd",
                            color: "#111",
                            background: "white",
                          }}
                        />
                      </td>

                      <td style={{ padding: 10, borderBottom: "1px solid #f2f2f2" }}>
                        <button
                          onClick={() => deleteItem(it.id)}
                          style={{
                            padding: "8px 10px",
                            borderRadius: 10,
                            border: "1px solid #ddd",
                            background: "#fafafa",
                            cursor: "pointer",
                            fontWeight: 900,
                            color: "#111",
                          }}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <div style={{ marginTop: 10, fontSize: 12, color: "#666" }}>
                Autosaves as you type. Export CSV when finished.
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}