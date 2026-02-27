"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

type Location = {
  id: string;
  name: string;
};

export default function NewSessionPage() {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadLocations();
  }, []);

  async function loadLocations() {
    const { data, error } = await supabase
      .from("locations")
      .select("*")
      .order("name");

    if (!error && data) {
      setLocations(data);
    }

    setLoading(false);
  }

  if (loading) {
    return (
      <div className="p-6 text-lg">
        Loading locations...
      </div>
    );
  }

  return (
    <div className=" hookuporadial p-6 space-y-6">

      {/* ===== TOP NAVIGATION ===== */}
      <div className="flex gap-3">
        <Link
          href="/alcohol/count"
          className="rounded bg-black text-white px-4 py-2"
        >
          Weekly Count
        </Link>

        <Link
          href="/alcohol/new-session"
          className="rounded border px-4 py-2"
        >
          New Session
        </Link>
      </div>

      {/* ===== PAGE TITLE ===== */}
      <div>
        <h1 className="text-2xl font-semibold">
          Alcohol — New Session
        </h1>
        <p className="text-sm opacity-70">
          Choose a location to begin inventory session.
        </p>
      </div>

      {/* ===== LOCATION CARDS ===== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {locations.map((location) => (
          <Link
            key={location.id}
            href={`/alcohol/session/location/${location.id}`}
            className="border rounded-lg p-6 hover:bg-gray-50 transition"
          >
            <div className="text-lg font-medium">
              {location.name}
            </div>
          </Link>
        ))}
      </div>

    </div>
  );
}