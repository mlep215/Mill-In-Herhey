"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type LocationRow = {
  id: string;
  name: string;
};

// Try multiple table/column patterns so this works with your existing DB without guessing.
async function fetchLocations(): Promise<{ locations: LocationRow[]; debug: string }> {
  const candidates = [
    // Most common
    { table: "locations", id: "id", name: "name" },
    // Other common patterns
    { table: "inventory_locations", id: "id", name: "name" },
    { table: "alcohol_locations", id: "id", name: "name" },
    { table: "locations", id: "id", name: "location_name" },
    { table: "inventory_locations", id: "id", name: "location_name" },
    { table: "alcohol_locations", id: "id", name: "location_name" },
  ] as const;

  for (const c of candidates) {
    const selectCols = `${c.id},${c.name}`;
    const { data, error } = await supabase.from(c.table).select(selectCols);

    if (error) {
      // Try next candidate; keep debug
      continue;
    }

    const rows = (data ?? [])
      .map((r: any) => ({
        id: String(r[c.id]),
        name: String(r[c.name]),
      }))
      .filter((x) => x.id && x.name);

    if (rows.length > 0) {
      // Sort nicely
      rows.sort((a, b) => a.name.localeCompare(b.name));
      return { locations: rows, debug: `Loaded from table "${c.table}" (${c.id}, ${c.name})` };
    }
  }

  // If we got here, nothing worked
  return {
    locations: [],
    debug:
      `Could not load locations. Checked tables: locations, inventory_locations, alcohol_locations. ` +
      `If you have RLS enabled, the logged-in user may not have SELECT permission.`,
  };
}

export default function NewSessionPage() {
  const [loading, setLoading] = useState(true);
  const [locations, setLocations] = useState<LocationRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [debug, setDebug] = useState<string>("");

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);

      // Confirm auth (you said you have a login screen)
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

      const res = await fetchLocations();
      setLocations(res.locations);
      setDebug(res.debug);

      if (res.locations.length === 0) {
        setError(
          "No locations found. This usually means the locations table name/columns don’t match what the page expects, " +
            "or your database permissions (RLS) are blocking reads."
        );
      }

      setLoading(false);
    })();
  }, []);

  if (loading) {
    return <div className="p-6 text-lg">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-6">
      {/* Top Nav */}
      <div className="flex gap-3">
        <Link href="/alcohol/count" className="rounded bg-black text-white px-4 py-2">
          Weekly Count
        </Link>
        {/* You are already on /alcohol/new-session, so we don’t need a “New Session” button here. */}
      </div>

      {/* Title */}
      <div>
        <h1 className="text-2xl font-semibold">Alcohol — New Session</h1>
        <p className="text-sm opacity-70">Click a location to begin your inventory session.</p>
      </div>

      {/* Error / Debug */}
      {error && (
        <div className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-700">
          <div className="font-semibold">Why you’re not seeing locations</div>
          <div className="mt-1">{error}</div>
          <div className="mt-2 text-xs opacity-80">{debug}</div>
        </div>
      )}

      {/* Locations */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((location) => (
          <Link
            key={location.id}
            href={`/alcohol/session/location/${location.id}`}
            className="border rounded-lg p-6 hover:bg-gray-50 transition"
          >
            <div className="text-lg font-medium">{location.name}</div>
          </Link>
        ))}
      </div>

      {/* If empty, show a helpful note */}
      {locations.length === 0 && (
        <div className="text-sm opacity-80">
          If you want, paste the names of your Supabase tables (or a screenshot of the table list) and I’ll lock this to
          the exact right one.
        </div>
      )}
    </div>
  );
}